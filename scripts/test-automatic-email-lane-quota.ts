import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS,
  normalizeAutomaticEmailAttemptQuota,
  reserveAutomaticEmailAttemptQuota,
  seedAutomaticEmailAttemptQuota,
} from '@/lib/outreach/laneAttemptQuotaCore'

const now = new Date('2026-09-14T18:00:00.000Z')
const history = [
  { messageId: 'sent-1', sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
  { messageId: 'sent-2', sentAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString() },
]

const seed = seedAutomaticEmailAttemptQuota({
  observedSentCount: history.length,
  observedSentAttempts: history,
  now,
})
assert.equal(seed.valid, true)
assert.equal(seed.attemptCount, 2)
assert.equal(seed.attemptMarkers.length, 2)

const finalSlot = reserveAutomaticEmailAttemptQuota({
  metrics: seed,
  observedSentCount: history.length,
  observedSentAttempts: history,
  messageId: 'claimed-3',
  claimId: 'claim-version-3',
  reservationId: 'reservation-3',
  dailyLimit: 3,
  now,
})
assert.equal(finalSlot.allowed, true)
assert.equal(finalSlot.attemptCount, 3)
assert.equal(finalSlot.remaining, 0)

const competingWorker = reserveAutomaticEmailAttemptQuota({
  metrics: finalSlot.metrics,
  observedSentCount: history.length,
  observedSentAttempts: history,
  messageId: 'claimed-4',
  claimId: 'claim-version-4',
  reservationId: 'reservation-4',
  dailyLimit: 3,
  now: new Date(now.getTime() + 1),
})
assert.equal(competingWorker.allowed, false)
assert.equal(competingWorker.reason, 'automatic_email_daily_attempt_quota_exhausted')

// A provider failure has no sent_at row, but its reservation still consumes the slot.
const afterProviderFailure = reserveAutomaticEmailAttemptQuota({
  metrics: finalSlot.metrics,
  observedSentCount: history.length,
  observedSentAttempts: history,
  messageId: 'claimed-after-failure',
  claimId: 'claim-after-failure',
  reservationId: 'reservation-after-failure',
  dailyLimit: 3,
  now: new Date(now.getTime() + 60_000),
})
assert.equal(afterProviderFailure.allowed, false)

// A later sent_at row for the same message reconciles by message ID and is not double-counted.
const acceptedHistory = [
  ...history,
  { messageId: 'claimed-3', sentAt: new Date(now.getTime() + 30_000).toISOString() },
]
const afterAccepted = reserveAutomaticEmailAttemptQuota({
  metrics: finalSlot.metrics,
  observedSentCount: acceptedHistory.length,
  observedSentAttempts: acceptedHistory,
  messageId: 'claimed-4',
  claimId: 'claim-version-4',
  reservationId: 'reservation-4',
  dailyLimit: 4,
  now: new Date(now.getTime() + 60_000),
})
assert.equal(afterAccepted.allowed, true)
assert.equal(afterAccepted.attemptCount, 4)

const duplicateMessage = reserveAutomaticEmailAttemptQuota({
  metrics: finalSlot.metrics,
  observedSentCount: history.length,
  observedSentAttempts: history,
  messageId: 'claimed-3',
  claimId: 'claim-version-3',
  reservationId: 'duplicate-reservation',
  dailyLimit: 10,
  now: new Date(now.getTime() + 60_000),
})
assert.equal(duplicateMessage.allowed, false)
assert.equal(duplicateMessage.reason, 'automatic_email_attempt_already_reserved')

const retriedMessage = reserveAutomaticEmailAttemptQuota({
  metrics: finalSlot.metrics,
  observedSentCount: history.length,
  observedSentAttempts: history,
  messageId: 'claimed-3',
  claimId: 'new-claim-version-3',
  reservationId: 'retry-reservation',
  dailyLimit: 10,
  now: new Date(now.getTime() + 60_000),
})
assert.equal(retriedMessage.allowed, true)
assert.equal(retriedMessage.attemptCount, 4)

const atRollingBoundary = normalizeAutomaticEmailAttemptQuota(
  {
    windowStartedAt: new Date(now.getTime() - AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS).toISOString(),
    attemptCount: 2,
    attemptMarkers: [
      {
        reservationId: 'expired',
        claimId: 'expired-claim',
        messageId: 'expired-message',
        reservedAt: new Date(now.getTime() - AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS).toISOString(),
        source: 'reservation',
      },
      {
        reservationId: 'active',
        claimId: 'active-claim',
        messageId: 'active-message',
        reservedAt: new Date(now.getTime() - AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS + 1).toISOString(),
        source: 'reservation',
      },
    ],
  },
  now
)
assert.equal(atRollingBoundary.valid, true)
assert.equal(atRollingBoundary.attemptCount, 1)
assert.deepEqual(atRollingBoundary.attemptMarkers.map((marker) => marker.messageId), ['active-message'])

const truncatedObservedSeed = seedAutomaticEmailAttemptQuota({
  observedSentCount: 4,
  observedSentAttempts: history,
  now,
})
assert.equal(truncatedObservedSeed.valid, true)
assert.equal(truncatedObservedSeed.attemptCount, 4)
assert.equal(truncatedObservedSeed.legacyAttemptCount, 2)

const reducedLimit = reserveAutomaticEmailAttemptQuota({
  metrics: truncatedObservedSeed,
  observedSentCount: 4,
  observedSentAttempts: history,
  messageId: 'over-reduced-limit',
  claimId: 'over-reduced-limit-claim',
  reservationId: 'over-reduced-limit-reservation',
  dailyLimit: 2,
  now,
})
assert.equal(reducedLimit.allowed, false)
assert.equal(reducedLimit.reason, 'automatic_email_daily_attempt_quota_exhausted')

const futureState = reserveAutomaticEmailAttemptQuota({
  metrics: {
    windowStartedAt: now.toISOString(),
    attemptCount: 1,
    attemptMarkers: [{
      reservationId: 'future',
      claimId: 'future-claim',
      messageId: 'future-message',
      reservedAt: new Date(now.getTime() + 60_000).toISOString(),
      source: 'reservation',
    }],
  },
  observedSentCount: 0,
  observedSentAttempts: [],
  messageId: 'new-message',
  claimId: 'new-claim',
  reservationId: 'new-reservation',
  dailyLimit: 25,
  now,
})
assert.equal(futureState.allowed, false)
assert.equal(futureState.reason, 'automatic_email_attempt_quota_timestamp_in_future')

const repoRoot = process.cwd()
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'lib/outreach/laneAttemptQuota.ts'), 'utf8')
assert.match(runtimeSource, /job_type: 'suppression_sync'/)
assert.match(runtimeSource, /error\.code !== '23505'/)
assert.match(runtimeSource, /\.eq\('updated_at', row\.updated_at\)/)
assert.match(runtimeSource, /\.not\('sent_at', 'is', null\)/)
assert.match(runtimeSource, /outreach-buyer-auto-email-attempt-budget/)
assert.match(runtimeSource, /outreach-investor-auto-email-attempt-budget/)
assert.match(runtimeSource, /outreach-lender-auto-email-attempt-budget/)
assert.doesNotMatch(runtimeSource, /releaseAutomaticEmailLaneAttempt/)

const laneChecks = [
  {
    file: 'lib/buyers/automation.ts',
    scope: "scope: 'buyer'",
    claim: 'claimBuyerOutreachMessageForSend(row.id, row.updated_at)',
    reserve: 'reserveAutomaticEmailLaneAttempt({',
    send: 'sendBuyerOutreachEmail({',
  },
  {
    file: 'lib/investors/service.ts',
    scope: "scope: 'investor'",
    claim: 'claimInvestorOutreachMessageForSend(row.id, row.updated_at)',
    reserve: 'reserveAutomaticEmailLaneAttempt({',
    send: 'sendInvestorOutreachEmail({',
  },
  {
    file: 'lib/lenders/automation.ts',
    scope: "scope: 'lender'",
    claim: 'claimLenderOutreachMessageForSend(row.id, row.updated_at)',
    reserve: 'reserveAutomaticEmailLaneAttempt({',
    send: 'sendLenderOutreachEmail({',
  },
]

for (const check of laneChecks) {
  const source = fs.readFileSync(path.join(repoRoot, check.file), 'utf8')
  const sendFunctionStart = source.indexOf(check.claim)
  const suppression = source.lastIndexOf(check.scope, sendFunctionStart)
  const reserve = source.indexOf(check.reserve, sendFunctionStart)
  const provider = source.indexOf(check.send, reserve)
  assert.ok(suppression >= 0 && suppression < sendFunctionStart, `${check.file} suppresses before claim`)
  assert.ok(sendFunctionStart < reserve, `${check.file} claims before quota reservation`)
  assert.ok(reserve < provider, `${check.file} reserves before provider call`)
  assert.match(source.slice(sendFunctionStart, provider), /restore[A-Za-z]+OutreachMessageAfterQuotaDenial/)
}

for (const file of [
  'lib/buyers/repository.ts',
  'lib/investors/repository.ts',
  'lib/lenders/repository.ts',
]) {
  const source = fs.readFileSync(path.join(repoRoot, file), 'utf8')
  const restoreStart = source.indexOf('OutreachMessageAfterQuotaDenial')
  const restoreSource = source.slice(restoreStart, restoreStart + 900)
  assert.match(restoreSource, /\.eq\('status', 'queued'\)/)
  assert.match(restoreSource, /\.eq\('updated_at', claimedUpdatedAt\)/)
  assert.match(restoreSource, /\.is\('sent_at', null\)/)
  assert.match(restoreSource, /status: 'approved', send_error: null/)
}

console.log('automatic email lane quota tests passed')
