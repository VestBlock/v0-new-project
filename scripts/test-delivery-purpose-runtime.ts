import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { DAILY_STRATEGY_OUTPUT_LANES } from '@/lib/outreach/dailyStrategyOutputCore'
import {
  PURPOSE_BOUND_EMAIL_PROVIDER,
  resolvePurposeBoundOutboundProvider,
} from '@/lib/outreach/deliveryRuntime'
import { hashMarketingConsentRecipient } from '@/lib/outreach/marketingConsentCore'

const noOutlook = { gmail: true, resend: true, outlook: false }
const outlookOnly = { gmail: false, resend: false, outlook: true }
const marketingRecipient = 'member@example.test'
const marketingConsentEvidence = {
  source: 'next_move_questionnaires',
  recordId: '22222222-2222-4222-8222-222222222222',
  status: 'current',
  consentedAt: '2026-09-01T12:00:00.000Z',
  verifiedAt: new Date().toISOString(),
  revokedAt: null,
  recipientHash: hashMarketingConsentRecipient(marketingRecipient),
} as const

assert.equal(PURPOSE_BOUND_EMAIL_PROVIDER, 'outlook')

for (const lane of DAILY_STRATEGY_OUTPUT_LANES) {
  const unavailable = resolvePurposeBoundOutboundProvider(
    { strategyKey: lane.key, purpose: 'transactional' },
    noOutlook
  )
  assert.equal(unavailable.allowed, false)
  assert.equal(unavailable.action, 'hold_provider_unavailable')
  assert.equal(unavailable.provider, 'none')
}

const sellerCold = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'preforeclosure-equity', purpose: 'cold_outreach' },
  outlookOnly
)
assert.equal(sellerCold.allowed, false)
assert.equal(sellerCold.action, 'hold_non_email')
assert.equal(sellerCold.policy.reason, 'consumer_cold_email_prohibited')

for (const strategyKey of [
  'dealvault_records',
  'funding_prep',
  'search_visibility',
  'ai_receptionist',
  'buyers',
  'lenders',
  'investors',
] as const) {
  const unproven = resolvePurposeBoundOutboundProvider(
    { strategyKey, purpose: 'cold_outreach' },
    outlookOnly
  )
  assert.equal(unproven.allowed, false, `${strategyKey} must require business-contact evidence.`)
  assert.equal(unproven.action, 'hold_non_email')

  const permitted = resolvePurposeBoundOutboundProvider(
    { strategyKey, purpose: 'cold_outreach', isBusinessContact: true },
    outlookOnly
  )
  assert.equal(permitted.allowed, true)
  assert.equal(permitted.action, 'send_outlook')
  assert.equal(permitted.provider, 'outlook')

  const graphUnavailable = resolvePurposeBoundOutboundProvider(
    { strategyKey, purpose: 'cold_outreach', isBusinessContact: true },
    noOutlook
  )
  assert.equal(graphUnavailable.allowed, false)
  assert.equal(graphUnavailable.action, 'hold_provider_unavailable')
}

for (const permitted of [
  resolvePurposeBoundOutboundProvider(
    { strategyKey: 'ai_receptionist', purpose: 'transactional' },
    outlookOnly
  ),
  resolvePurposeBoundOutboundProvider(
    {
      strategyKey: 'buyers',
      purpose: 'marketing',
      recipientEmail: marketingRecipient,
      marketingConsentEvidence,
    },
    outlookOnly
  ),
]) {
  assert.equal(permitted.allowed, true)
  assert.equal(permitted.action, 'send_outlook')
  assert.equal(permitted.provider, 'outlook')
}

const missingPurpose = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'ai_receptionist', purpose: undefined as unknown as string },
  outlookOnly
)
assert.equal(missingPurpose.allowed, false)
assert.equal(missingPurpose.action, 'hold_non_email')
assert.equal(missingPurpose.policy.reason, 'unknown_delivery_purpose')

const marketingWithoutConsent = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'buyers', purpose: 'marketing', hasExplicitOptIn: true },
  outlookOnly
)
assert.equal(marketingWithoutConsent.allowed, false)

const adapter = fs.readFileSync(
  path.join(process.cwd(), 'lib/outreach/outlookDelivery.ts'),
  'utf8'
)
assert.match(adapter, /sendGuardedOutlookEmail/)
assert.match(adapter, /deriveRecipientBoundBusinessContactEvidence/)
assert.match(adapter, /assessVerifiedBusinessColdEmailAdmission/)
assert.match(adapter, /getOutreachRecipientGuard/)
assert.match(adapter, /getOperationalReplyCaptureReadiness/)
assert.match(adapter, /reserveOutlookColdEmailAttempt/)
assert.match(adapter, /sendTransactionalEmailWithMicrosoftGraphIdempotently/)
assert.doesNotMatch(adapter, /sendWithResend|acquireGuardedDeliveryAttempt|getDeliveryCircuitBreaker/)

console.log('Delivery-purpose runtime tests passed for Outlook-only fail-closed routing.')
