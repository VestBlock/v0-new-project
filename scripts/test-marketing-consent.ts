import assert from 'node:assert/strict'

import { verifyDurableMarketingConsent } from '../lib/outreach/marketingConsent'
import {
  assessDurableMarketingConsentEvidence,
  hashMarketingConsentRecipient,
} from '../lib/outreach/marketingConsentCore'

const recordId = '33333333-3333-4333-8333-333333333333'
const recipientEmail = 'member@example.test'
const now = new Date('2026-09-15T20:00:00.000Z')

function adminReturning(data: unknown, error: unknown = null) {
  const query = {
    select() {
      return query
    },
    eq(column: string, value: string) {
      assert.equal(column, 'id')
      assert.equal(value, recordId)
      return query
    },
    async maybeSingle() {
      return { data, error }
    },
  }
  return {
    from(table: string) {
      assert.equal(table, 'next_move_questionnaires')
      return query
    },
  }
}

async function main() {
  const currentRecord = {
    id: recordId,
    email: recipientEmail,
    marketing_consent: true,
    marketing_consented_at: '2026-08-01T12:00:00.000Z',
    deleted_at: null,
  }
  const verified = await verifyDurableMarketingConsent(
    {
      reference: { source: 'next_move_questionnaires', recordId },
      recipientEmail,
      now,
    },
    adminReturning(currentRecord) as never
  )
  assert.equal(verified.verified, true)
  if (!verified.verified) throw new Error('Expected durable marketing consent evidence.')
  assert.equal(verified.evidence.recipientHash, hashMarketingConsentRecipient(recipientEmail))
  assert.equal(verified.evidence.revokedAt, null)
  assert.equal(
    assessDurableMarketingConsentEvidence({
      evidence: verified.evidence,
      recipientEmail,
      now,
    }).valid,
    true
  )

  const mismatch = await verifyDurableMarketingConsent(
    {
      reference: { source: 'next_move_questionnaires', recordId },
      recipientEmail: 'other@example.test',
      now,
    },
    adminReturning(currentRecord) as never
  )
  assert.deepEqual(mismatch, { verified: false, reason: 'recipient_mismatch' })

  for (const record of [
    { ...currentRecord, marketing_consent: false },
    { ...currentRecord, marketing_consented_at: null },
    { ...currentRecord, deleted_at: '2026-09-15T19:00:00.000Z' },
  ]) {
    const revoked = await verifyDurableMarketingConsent(
      {
        reference: { source: 'next_move_questionnaires', recordId },
        recipientEmail,
        now,
      },
      adminReturning(record) as never
    )
    assert.deepEqual(revoked, { verified: false, reason: 'consent_not_current' })
  }

  const unavailable = await verifyDurableMarketingConsent(
    {
      reference: { source: 'next_move_questionnaires', recordId },
      recipientEmail,
      now,
    },
    adminReturning(null, { message: 'database unavailable' }) as never
  )
  assert.deepEqual(unavailable, { verified: false, reason: 'record_unavailable' })

  const staleEvidence = {
    ...verified.evidence,
    verifiedAt: '2026-09-15T19:54:59.000Z',
  }
  assert.deepEqual(
    assessDurableMarketingConsentEvidence({
      evidence: staleEvidence,
      recipientEmail,
      now,
    }),
    { valid: false, reason: 'verification_stale' }
  )

  console.log('marketing-consent: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
