import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildRevenueLoopJobPayload,
  isStaleRunningJob,
  staleJobRecoveryPatch,
  type CommandCenterJobRow,
} from '../lib/admin/jobLifecycleCore'
import {
  buildResendDeliveryIdentityMetadata,
  deliveryProjectionAllowedCurrentStatuses,
  parseResendOutreachIdentityTags,
  selectResendDeliveryProjection,
} from '../lib/email/resendDeliveryCore'
import {
  deliveryBreakerAllowsLenderCanary,
  evaluateLenderRecoveryCanaryReadiness,
  isVerifiedLenderCanaryCandidate,
} from '../lib/lenders/canary'
import { evaluateDeliveryCircuitBreaker, providerHasDeliveryTelemetry } from '../lib/leads/deliveryHealthCore'
import {
  classifyDealMachineAcquisitionOutcome,
  dealMachineAcquisitionHttpStatus,
  dealMachineAcquisitionPersistenceStatus,
} from '../lib/n8n/dealMachineSourceAcquisitionCore'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '../lib/outreach/commercialCompliance'
import { buildOutboundSendIdentity, buildResendOutreachTags } from '../lib/outreach/deliveryIdentity'
import {
  deliveryModeRequiresBudget,
  normalizeDeliveryBudget,
  OUTREACH_DELIVERY_BUDGET_LIMIT,
} from '../lib/outreach/deliveryBudgetCore'
import {
  allocatePartnerPipelineSendCap,
  partnerPipelineRotationOffset,
} from '../lib/outreach/partnerPipelineCore'
import { evaluateOutreachRecipientSnapshot } from '../lib/outreach/suppressionCore'
import {
  getConfiguredOutboundProvider,
  getConfiguredOutboundSender,
  getOutboundProviderAvailability,
  getOutboundSenderForProvider,
} from '../lib/outreach/provider-preference'
import {
  canAutoApproveFollowupMessage,
  canClaimMessageForSend,
  canApproveOutreachMessage,
  hasActionableReplyEvidence,
  isMessageGenerationProtected,
} from '../lib/outreach/messageState'

const now = new Date('2026-09-14T12:00:00.000Z')

const dealMachinePartial = {
  ok: false,
  fetched: 10,
  ingested: 10,
  creditsReserved: 27,
  strategyRuns: [
    { status: 'searched' },
    { status: 'failed' },
    { status: 'skipped_budget' },
  ],
}
assert.equal(classifyDealMachineAcquisitionOutcome(dealMachinePartial), 'partial')
assert.equal(
  dealMachineAcquisitionHttpStatus({ ok: false, deferred: false, outcome: 'partial' }),
  502
)
assert.equal(deliveryProjectionAllowedCurrentStatuses('delivered').includes('bounced'), false)
assert.equal(deliveryProjectionAllowedCurrentStatuses('delivered').includes('complained'), false)
assert.equal(deliveryProjectionAllowedCurrentStatuses('delivered').includes('replied'), false)
assert.equal(deliveryProjectionAllowedCurrentStatuses('bounced').includes('delivered'), true)
assert.equal(deliveryProjectionAllowedCurrentStatuses('bounced').includes('complained'), false)
assert.equal(deliveryProjectionAllowedCurrentStatuses('complained').includes('bounced'), true)
assert.equal(dealMachineAcquisitionPersistenceStatus('partial'), 'failed')
assert.equal(dealMachineAcquisitionPersistenceStatus('blocked'), 'blocked')
assert.equal(
  classifyDealMachineAcquisitionOutcome({
    ok: false,
    fetched: 0,
    ingested: 0,
    creditsReserved: 0,
    strategyRuns: [{ status: 'failed' }],
  }),
  'blocked'
)
assert.equal(
  dealMachineAcquisitionHttpStatus({ ok: false, deferred: false, outcome: 'blocked' }),
  503
)
assert.equal(
  dealMachineAcquisitionHttpStatus({ ok: true, deferred: true, outcome: 'deferred' }),
  200
)
const runId = 'run-test-001'
const runningPayload = buildRevenueLoopJobPayload({
  status: 'running',
  lastStatus: 'live_run_started',
  runId,
  now,
})
assert.equal(runningPayload.job_type, 'seller_outreach_batch')
assert.equal(runningPayload.status, 'running')
assert.equal(runningPayload.metrics_json.runId, runId)
assert.equal(runningPayload.locked_until, '2026-09-14T12:15:00.000Z')

const terminalPayload = buildRevenueLoopJobPayload({
  status: 'active',
  lastStatus: 'completed',
  runId,
  now,
})
assert.equal(terminalPayload.status, 'active')
assert.equal(terminalPayload.last_status, 'completed')
assert.equal(terminalPayload.locked_until, null)

const staleJob = {
  id: 'job-1',
  job_key: 'seller-outreach-batch',
  status: 'running',
  last_status: 'live_run_started',
  last_run_at: '2026-09-14T11:40:00.000Z',
  updated_at: '2026-09-14T11:40:00.000Z',
  locked_until: '2026-09-14T11:55:00.000Z',
  metrics_json: { runId: 'abandoned-run' },
} satisfies CommandCenterJobRow
assert.equal(isStaleRunningJob(staleJob, now), true)
assert.equal(
  isStaleRunningJob({ ...staleJob, locked_until: '2026-09-14T12:05:00.000Z' }, now),
  false
)

const canaryReady = evaluateLenderRecoveryCanaryReadiness({
  explicitlyRequested: true,
  featureEnabled: true,
  lenderAutoSendEnabled: true,
  deliveryCanaryPermitted: true,
  replyCaptureConfigured: true,
  mailingAddressConfigured: true,
  eligibleCandidateCount: 5,
  remainingCapacity: 5,
})
assert.deepEqual(canaryReady, { allowed: true, blockedReasons: [] })
assert.equal(deliveryBreakerAllowsLenderCanary({ mode: 'controlled_trial', recoveryCanaryAllowed: false }), true)
assert.equal(deliveryBreakerAllowsLenderCanary({ mode: 'blocked', recoveryCanaryAllowed: true }), true)
assert.equal(deliveryBreakerAllowsLenderCanary({ mode: 'blocked', recoveryCanaryAllowed: false }), false)
assert.deepEqual(
  evaluateLenderRecoveryCanaryReadiness({
    explicitlyRequested: false,
    featureEnabled: true,
    lenderAutoSendEnabled: true,
    deliveryCanaryPermitted: true,
    replyCaptureConfigured: true,
    mailingAddressConfigured: true,
    eligibleCandidateCount: 5,
    remainingCapacity: 5,
  }),
  { allowed: false, blockedReasons: ['recovery_canary_not_explicitly_requested'] }
)
assert.equal(
  evaluateLenderRecoveryCanaryReadiness({
    explicitlyRequested: true,
    featureEnabled: true,
    lenderAutoSendEnabled: true,
    deliveryCanaryPermitted: true,
    replyCaptureConfigured: false,
    mailingAddressConfigured: true,
    eligibleCandidateCount: 5,
    remainingCapacity: 5,
  }).allowed,
  false
)
assert.equal(isStaleRunningJob({ ...staleJob, status: 'active' }, now), false)
const recoveryPatch = staleJobRecoveryPatch(staleJob, now)
assert.equal(recoveryPatch.status, 'failed')
assert.equal(recoveryPatch.last_status, 'stale_run_reconciled')
assert.equal(recoveryPatch.locked_until, null)
assert.equal(recoveryPatch.metrics_json.staleRunReconciled, true)

assert.equal(isMessageGenerationProtected({ status: 'sent', sent_at: null }), true)
assert.equal(isMessageGenerationProtected({ status: 'failed', sent_at: now.toISOString() }), true)
assert.equal(isMessageGenerationProtected({ status: 'queued', sent_at: null }), true)
assert.equal(isMessageGenerationProtected({ status: 'approved', sent_at: null }), true)
assert.equal(isMessageGenerationProtected({ status: 'needs_review', sent_at: null }), false)
assert.equal(canClaimMessageForSend({ status: 'approved', sent_at: null }), true)
assert.equal(canClaimMessageForSend({ status: 'queued', sent_at: null }), false)
assert.equal(canClaimMessageForSend({ status: 'approved', sent_at: now.toISOString() }), false)
assert.equal(canApproveOutreachMessage({ status: 'needs_review', sent_at: null }), true)
assert.equal(canApproveOutreachMessage({ status: 'approved', sent_at: null }), true)
assert.equal(canApproveOutreachMessage({ status: 'queued', sent_at: null }), false)
assert.equal(canApproveOutreachMessage({ status: 'sent', sent_at: null }), false)
assert.equal(canApproveOutreachMessage({ status: 'needs_review', sent_at: now.toISOString() }), false)
assert.equal(canAutoApproveFollowupMessage({ status: 'draft', sent_at: null }), true)
assert.equal(canAutoApproveFollowupMessage({ status: 'needs_review', sent_at: null }), true)
assert.equal(canAutoApproveFollowupMessage({ status: 'approved', sent_at: null }), false)
assert.equal(canAutoApproveFollowupMessage({ status: 'queued', sent_at: null }), false)
assert.equal(canAutoApproveFollowupMessage({ status: 'sent', sent_at: now.toISOString() }), false)

// A message selected for review can race with a sender. The conditional approval
// predicate must reject the fresh queued state rather than reopening it.
const selectedFollowup = { status: 'needs_review', sent_at: null }
assert.equal(canAutoApproveFollowupMessage(selectedFollowup), true)
const racedFollowup = { ...selectedFollowup, status: 'queued' }
assert.equal(canAutoApproveFollowupMessage(racedFollowup), false)

assert.equal(hasActionableReplyEvidence({ metadata_json: { actionableReply: true } }), true)
assert.equal(hasActionableReplyEvidence({ metadata_json: { actionableReply: false } }), false)
assert.equal(hasActionableReplyEvidence({ metadata_json: { classification: 'low_priority' } }), false)

const identityA = buildOutboundSendIdentity({ scope: 'lender', entityId: 'L-1', messageId: 'M-1', sequenceStep: 2 })
const identityB = buildOutboundSendIdentity({ scope: 'LENDER', entityId: 'l-1', messageId: 'm-1', sequenceStep: 2 })
const identityFirstTouch = buildOutboundSendIdentity({ scope: 'lender', entityId: 'L-1', messageId: 'M-1', sequenceStep: 1 })
assert.deepEqual(identityA, identityB)
assert.notEqual(identityA.idempotencyKey, identityFirstTouch.idempotencyKey)
assert.match(identityA.idempotencyKey, /^vestblock-[a-f0-9]{64}$/)
assert.match(identityA.correlationId, /^vbo_[a-f0-9]{32}$/)
const webhookIdentityTags = parseResendOutreachIdentityTags(
  Object.fromEntries(buildResendOutreachTags(identityA).map((tag) => [tag.name, tag.value]))
)
assert.deepEqual(webhookIdentityTags, {
  scope: 'lender',
  entityId: 'l-1',
  messageId: 'm-1',
  correlationId: identityA.correlationId,
  idempotencyKey: identityA.idempotencyKey,
  sequenceStep: 2,
  recordType: 'lender_outreach',
})
assert.deepEqual(
  buildResendDeliveryIdentityMetadata({ webhookTags: webhookIdentityTags }),
  {
    idempotencyKey: identityA.idempotencyKey,
    correlationId: identityA.correlationId,
    outreachRecordType: 'lender_outreach',
    outreachRecordId: 'm-1',
    outreachScope: 'lender',
    outreachEntityId: 'l-1',
  }
)

assert.equal(OUTREACH_DELIVERY_BUDGET_LIMIT, 5)
// The sender-specific atomic throughput reservation is now the authoritative
// rolling cap. The retired global counter must not consume capacity from a
// different sender or duplicate the same controlled-trial reservation.
assert.equal(deliveryModeRequiresBudget('controlled_trial'), false)
assert.equal(deliveryModeRequiresBudget('recovery_canary'), false)
assert.equal(deliveryModeRequiresBudget('healthy'), false)
const activeBudget = normalizeDeliveryBudget(
  { windowStartedAt: '2026-09-14T11:00:00.000Z', attemptCount: 4 },
  now
)
assert.equal(activeBudget.attemptCount, 4)
const expiredBudget = normalizeDeliveryBudget(
  { windowStartedAt: '2026-09-13T11:59:59.000Z', attemptCount: 5 },
  now
)
assert.equal(expiredBudget.attemptCount, 0)
const trailingBudget = normalizeDeliveryBudget(
  {
    windowStartedAt: '2026-09-13T12:00:01.000Z',
    attemptCount: 3,
    attemptMarkers: [
      { attemptedAt: '2026-09-13T11:59:59.000Z' },
      { attemptedAt: '2026-09-13T12:00:01.000Z' },
      { attemptedAt: '2026-09-14T11:59:59.000Z' },
    ],
  },
  now
)
assert.equal(trailingBudget.attemptCount, 2)
assert.deepEqual(
  trailingBudget.attemptMarkers.map((marker) => marker.attemptedAt),
  ['2026-09-13T12:00:01.000Z', '2026-09-14T11:59:59.000Z']
)
const skewedBudget = normalizeDeliveryBudget(
  {
    windowStartedAt: '2026-09-14T11:00:00.000Z',
    attemptCount: 5,
    attemptMarkers: [
      { attemptedAt: '2026-09-14T12:00:01.000Z' },
      { attemptedAt: 'invalid' },
      { attemptedAt: '2026-09-14T11:55:00.000Z' },
      { attemptedAt: '2026-09-14T11:56:00.000Z' },
      { attemptedAt: '2026-09-14T11:57:00.000Z' },
    ],
  },
  now
)
assert.equal(skewedBudget.attemptCount, 5)
assert.equal(skewedBudget.attemptMarkers.length, 5)
const futureWindowBudget = normalizeDeliveryBudget(
  {
    windowStartedAt: '2026-09-14T12:00:01.000Z',
    attemptCount: 5,
    attemptMarkers: Array.from({ length: 5 }, (_, index) => ({
      attemptedAt: '2026-09-14T12:00:01.000Z',
      permitId: `future-${index}`,
    })),
  },
  now
)
assert.equal(futureWindowBudget.attemptCount, 5)
assert.equal(futureWindowBudget.attemptMarkers.length, 5)
assert.equal(futureWindowBudget.windowStartedAt, now.toISOString())
assert.equal(
  normalizeDeliveryBudget(futureWindowBudget, new Date('2026-09-15T12:00:00.000Z')).attemptCount,
  0
)
const missingStartBudget = normalizeDeliveryBudget(
  { windowStartedAt: null, attemptCount: 5, attemptMarkers: [] },
  now
)
assert.equal(missingStartBudget.attemptCount, 5)
assert.equal(missingStartBudget.windowStartedAt, now.toISOString())
assert.equal(
  normalizeDeliveryBudget(missingStartBudget, new Date('2026-09-15T12:00:00.000Z')).attemptCount,
  0
)
assert.deepEqual(allocatePartnerPipelineSendCap(5), { buyers: 2, lenders: 2, investors: 1 })
assert.deepEqual(allocatePartnerPipelineSendCap(5, 1), { buyers: 1, lenders: 2, investors: 2 })
assert.deepEqual(allocatePartnerPipelineSendCap(5, 2), { buyers: 2, lenders: 1, investors: 2 })
assert.deepEqual(allocatePartnerPipelineSendCap(5, 0, ['buyers', 'investors']), { buyers: 3, lenders: 0, investors: 2 })
assert.deepEqual(allocatePartnerPipelineSendCap(5, 1, ['buyers', 'investors']), { buyers: 2, lenders: 0, investors: 3 })
assert.deepEqual(allocatePartnerPipelineSendCap(5, 0, []), { buyers: 0, lenders: 0, investors: 0 })
assert.equal(Object.values(allocatePartnerPipelineSendCap(14)).reduce((sum, value) => sum + value, 0), 14)
assert.equal(partnerPipelineRotationOffset(new Date('2026-09-14T23:59:59.000Z')), partnerPipelineRotationOffset(new Date('2026-09-14T00:00:00.000Z')))
assert.equal(
  getConfiguredOutboundProvider({
    RESEND_API_KEY: 'resend-key',
    FROM_EMAIL: 'sender@example.com',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_REFRESH_TOKEN: 'google-refresh',
    OUTREACH_PROVIDER_PREFERENCE: 'gmail',
  }),
  'gmail'
)
assert.equal(
  getConfiguredOutboundProvider({
    RESEND_API_KEY: 'resend-key',
    FROM_EMAIL: 'sender@example.com',
    OUTREACH_PROVIDER_PREFERENCE: 'gmail',
  }),
  'resend'
)
const conflictingSenderEnv = {
  RESEND_API_KEY: 'resend-key',
  RESEND_FROM_EMAIL: 'resend-sender@example.com',
  RESEND_EMAIL: 'legacy-resend@example.com',
  OUTREACH_FROM_EMAIL: 'gmail-sender@example.com',
  FROM_EMAIL: 'fallback@example.com',
  GOOGLE_WORKSPACE_SENDER: 'workspace-sender@example.com',
}
assert.equal(getOutboundSenderForProvider('resend', conflictingSenderEnv), 'resend-sender@example.com')
assert.equal(getOutboundSenderForProvider('gmail', conflictingSenderEnv), 'gmail-sender@example.com')
assert.equal(getConfiguredOutboundSender(conflictingSenderEnv), 'resend-sender@example.com')
assert.equal(getOutboundProviderAvailability({
  RESEND_API_KEY: 'resend-key',
  RESEND_FROM_EMAIL: 'resend-only@example.com',
}).resend, true)

assert.equal(
  evaluateOutreachRecipientSnapshot({
    exists: true,
    expectedEmail: 'Partner@Example.com',
    currentEmail: 'partner@example.com',
    suppressed: false,
    outreachStatus: 'approved',
  }).allowed,
  true
)
assert.equal(
  evaluateOutreachRecipientSnapshot({
    exists: true,
    expectedEmail: 'partner@example.com',
    currentEmail: 'partner@example.com',
    suppressed: true,
  }).reason,
  'recipient_suppressed'
)
assert.equal(
  evaluateOutreachRecipientSnapshot({
    exists: true,
    expectedEmail: 'partner@example.com',
    currentEmail: 'partner@example.com',
    outreachStatus: 'do_not_contact',
  }).allowed,
  false
)

assert.equal(
  getCommercialOutreachMailingAddress({ BUSINESS_MAILING_ADDRESS: '100 Main St, Milwaukee, WI 53202' }),
  '100 Main St, Milwaukee, WI 53202'
)
const compliantBody = buildCommercialOutreachBody({
  body: 'Hello from VestBlock.',
  complianceNote: 'Reply opt out to stop messages.',
  mailingAddress: '100 Main St, Milwaukee, WI 53202',
})
assert.match(compliantBody, /Reply opt out/)
assert.match(compliantBody, /VestBlock mailing address: 100 Main St/)
assert.equal((compliantBody.match(/VestBlock mailing address:/g) || []).length, 1)
assert.throws(
  () =>
    buildCommercialOutreachBody({
      body: 'Buyer packet body.',
      complianceNote: 'Reply opt out to stop messages.',
      mailingAddress: '',
    }),
  /mailing address is required/
)
const compliantBuyerPacketBody = buildCommercialOutreachBody({
  body: 'The requested buyer packet is attached.',
  complianceNote: 'If you do not want property opportunities from VestBlock, reply opt out and we will stop.',
  mailingAddress: '100 Main St, Milwaukee, WI 53202',
})
assert.match(compliantBuyerPacketBody, /reply opt out/i)
assert.match(compliantBuyerPacketBody, /VestBlock mailing address: 100 Main St/)

const breakerOptions = {
  provider: 'resend',
  windowDays: 7,
  threshold: 0.05,
  minimumSample: 20,
  trialBatchSize: 12,
  allowControlledTrial: true,
}
const healthy = evaluateDeliveryCircuitBreaker(
  Array.from({ length: 20 }, (_, index) => ({ provider_message_id: `healthy-${index}`, delivery_status: 'delivered' })),
  breakerOptions
)
assert.equal(healthy.mode, 'healthy')
assert.equal(healthy.broadSendingAllowed, true)
assert.equal(healthy.recoveryCanaryAllowed, false)
assert.equal(providerHasDeliveryTelemetry('resend'), true)
assert.equal(providerHasDeliveryTelemetry('gmail'), false)

const laterEngagementCannotHideEarlierComplaint = evaluateDeliveryCircuitBreaker(
  [
    { provider_message_id: 'complained-then-opened', delivery_status: 'opened' },
    { provider_message_id: 'complained-then-opened', delivery_status: 'complained' },
    ...Array.from({ length: 19 }, (_, index) => ({
      provider_message_id: `complaint-regression-ok-${index}`,
      delivery_status: 'delivered',
    })),
  ],
  breakerOptions
)
assert.equal(laterEngagementCannotHideEarlierComplaint.complained, 1)
assert.equal(laterEngagementCannotHideEarlierComplaint.delivered, 19)
assert.equal(laterEngagementCannotHideEarlierComplaint.allowed, false)
assert.match(laterEngagementCannotHideEarlierComplaint.reason || '', /complaint_evidence/)

const providerGlobalFailure = evaluateDeliveryCircuitBreaker(
  Array.from({ length: 20 }, (_, index) => ({ provider_message_id: `outreach-ok-${index}`, delivery_status: 'delivered' })),
  {
    ...breakerOptions,
    globalRows: [
      ...Array.from({ length: 7 }, (_, index) => ({ provider_message_id: `global-ok-${index}`, delivery_status: 'delivered' })),
      ...Array.from({ length: 3 }, (_, index) => ({ provider_message_id: `global-failed-${index}`, delivery_status: 'failed' })),
    ],
    globalMinimumSample: 10,
    globalFailureThreshold: 0.2,
  }
)
assert.equal(providerGlobalFailure.allowed, false)
assert.equal(providerGlobalFailure.providerGlobalHealthBlocked, true)
assert.match(providerGlobalFailure.reason || '', /provider_global_failure_rate/)

const unrelatedRecipientQuality = evaluateDeliveryCircuitBreaker(
  Array.from({ length: 20 }, (_, index) => ({ provider_message_id: `scoped-ok-${index}`, delivery_status: 'delivered' })),
  {
    ...breakerOptions,
    globalRows: Array.from({ length: 20 }, (_, index) => ({
      provider_message_id: `unrelated-bounce-${index}`,
      delivery_status: 'bounced',
    })),
  }
)
assert.equal(unrelatedRecipientQuality.allowed, true)
assert.equal(unrelatedRecipientQuality.badRate, 0)

const bounceEvidence = [
  ...Array.from({ length: 18 }, (_, index) => ({ provider_message_id: `bounce-ok-${index}`, delivery_status: 'delivered' })),
  { provider_message_id: 'bounce-1', delivery_status: 'bounced' },
  { provider_message_id: 'bounce-2', delivery_status: 'bounced' },
]
const bounceBlocked = evaluateDeliveryCircuitBreaker(bounceEvidence, breakerOptions)
assert.equal(bounceBlocked.allowed, false)
assert.equal(bounceBlocked.broadSendingAllowed, false)
const recoveryCanary = evaluateDeliveryCircuitBreaker(bounceEvidence, {
  ...breakerOptions,
  allowRecoveryCanary: true,
})
assert.equal(recoveryCanary.mode, 'recovery_canary')
assert.equal(recoveryCanary.allowed, true)
assert.equal(recoveryCanary.broadSendingAllowed, false)
assert.equal(recoveryCanary.recoveryCanaryAllowed, true)
assert.equal(recoveryCanary.maxBatchSize, 5)

const complaintBlocked = evaluateDeliveryCircuitBreaker(
  [
    ...Array.from({ length: 99 }, (_, index) => ({ provider_message_id: `complaint-ok-${index}`, delivery_status: 'delivered' })),
    { provider_message_id: 'complaint-1', delivery_status: 'complained' },
  ],
  { ...breakerOptions, allowRecoveryCanary: true }
)
assert.equal(complaintBlocked.allowed, false)
assert.equal(complaintBlocked.recoveryCanaryAllowed, false)
assert.match(complaintBlocked.reason || '', /complaint_evidence/)

const buyerPacketIdentity = buildResendDeliveryIdentityMetadata({
  buyerPacketSend: {
    id: 'packet-send-1',
    metadata_json: {
      idempotencyKey: 'packet-idempotency-key',
      correlationId: 'packet-correlation-id',
    },
  },
})
assert.deepEqual(buyerPacketIdentity, {
  idempotencyKey: 'packet-idempotency-key',
  correlationId: 'packet-correlation-id',
  outreachRecordType: 'buyer_packet_outreach',
  outreachRecordId: 'packet-send-1',
})
assert.equal(
  selectResendDeliveryProjection([
    {
      provider_event_id: 'delivered-newer',
      delivery_status: 'delivered',
      occurred_at: '2026-09-14T12:00:00.000Z',
    },
    {
      provider_event_id: 'sent-older',
      delivery_status: 'accepted',
      occurred_at: '2026-09-14T11:59:00.000Z',
    },
  ])?.provider_event_id,
  'delivered-newer',
  'an older sent event must not regress a delivered projection'
)
assert.equal(
  selectResendDeliveryProjection([
    {
      provider_event_id: 'complaint-newer',
      delivery_status: 'complained',
      occurred_at: '2026-09-14T12:00:00.000Z',
    },
    {
      provider_event_id: 'delivered-retry',
      delivery_status: 'delivered',
      occurred_at: '2026-09-14T11:59:00.000Z',
    },
  ])?.provider_event_id,
  'complaint-newer',
  'a late delivered retry must not erase complaint evidence'
)
const outreachScopedPacketComplaint = [
  ...Array.from({ length: 20 }, (_, index) => ({
    provider_message_id: `packet-delivered-${index}`,
    delivery_status: 'delivered',
    metadata_json: { outreachRecordType: 'buyer_packet_outreach' },
  })),
  {
    provider_message_id: 'packet-complaint-1',
    delivery_status: 'complained',
    metadata_json: buyerPacketIdentity,
  },
].filter((row) => Boolean(row.metadata_json.outreachRecordType))
const packetComplaintBlocked = evaluateDeliveryCircuitBreaker(outreachScopedPacketComplaint, breakerOptions)
assert.equal(packetComplaintBlocked.allowed, false)
assert.match(packetComplaintBlocked.reason || '', /complaint_evidence/)

const verifiedLender = {
  contact_email: 'partner@examplecapital.com',
  metadata_json: {
    hunterContactEnrichment: {
      primaryCandidate: {
        email: 'partner@examplecapital.com',
        verificationStatus: 'valid',
        confidence: 95,
      },
    },
  },
}
const verifiedInput = {
  lender: verifiedLender,
  channel: 'email_followup',
  hasPriorInitialSend: true,
  suppressed: false,
}
assert.equal(isVerifiedLenderCanaryCandidate(verifiedInput), true)
assert.equal(isVerifiedLenderCanaryCandidate({ ...verifiedInput, hasPriorInitialSend: false }), false)
assert.equal(isVerifiedLenderCanaryCandidate({ ...verifiedInput, suppressed: true }), false)
assert.equal(isVerifiedLenderCanaryCandidate({ ...verifiedInput, channel: 'email_intro' }), false)
assert.equal(
  isVerifiedLenderCanaryCandidate({
    ...verifiedInput,
    lender: {
      ...verifiedLender,
      metadata_json: {
        hunterContactEnrichment: {
          primaryCandidate: {
            email: 'partner@examplecapital.com',
            verificationStatus: 'accept_all',
            confidence: 99,
          },
        },
      },
    },
  }),
  false
)
assert.equal(
  isVerifiedLenderCanaryCandidate({
    ...verifiedInput,
    lender: {
      ...verifiedLender,
      metadata_json: {
        hunterContactEnrichment: {
          primaryCandidate: { email: 'other@examplecapital.com', verificationStatus: 'valid', confidence: 95 },
        },
      },
    },
  }),
  false
)
assert.equal(
  isVerifiedLenderCanaryCandidate({
    ...verifiedInput,
    lender: {
      contact_email: 'partner@agency.gov',
      metadata_json: {
        hunterContactEnrichment: {
          primaryCandidate: { email: 'partner@agency.gov', verificationStatus: 'valid', confidence: 95 },
        },
      },
    },
  }),
  false
)

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')
const dailyLoopSource = source('lib/admin/dailyOperatingLoop.ts')
assert.match(dailyLoopSource, /finally\s*{/)
assert.match(dailyLoopSource, /recordRevenueLoopJob\(\{[\s\S]*final:\s*true/)
assert.doesNotMatch(dailyLoopSource, /revenue_operations_control/)

for (const repositoryPath of [
  'lib/leads/repository.ts',
  'lib/buyers/repository.ts',
  'lib/lenders/repository.ts',
  'lib/investors/repository.ts',
]) {
  const repositorySource = source(repositoryPath)
  assert.match(repositorySource, /isMessageGenerationProtected/)
  assert.match(repositorySource, /\.eq\('status', 'approved'\)/)
  assert.match(repositorySource, /\.is\('sent_at', null\)/)
}

for (const routePath of [
  'app/api/admin/leads/[id]/outreach/route.ts',
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
]) {
  const routeSource = source(routePath)
  assert.match(routeSource, /claim(?:Outreach|BuyerOutreach|LenderOutreach)MessageForSend/)
  assert.match(routeSource, /already been claimed or sent|Another worker already claimed/)
}

for (const outboundPath of [
  'lib/leads/outbound.ts',
  'lib/buyers/outbound.ts',
  'lib/lenders/outbound.ts',
  'lib/investors/outbound.ts',
]) {
  const outboundSource = source(outboundPath)
  assert.match(outboundSource, /sendGuardedOutlookEmail/)
  assert.match(outboundSource, /providerMessageId/)
  assert.match(outboundSource, /internetMessageId/)
  assert.match(outboundSource, /dispatchId/)
  assert.doesNotMatch(outboundSource, /sendWithResend|acquireGuardedDeliveryAttempt/)
}
assert.match(source('lib/buyers/outbound.ts'), /scope: 'buyer-packet'/)
assert.match(source('lib/buyers/packetDelivery.ts'), /messageId: `buyer-packet:\$\{packet\.id\}:\$\{buyer\.id\}`/)

const sellerTargetedRoute = source('app/api/cron/seller-targeted-send/route.ts')
assert.match(sellerTargetedRoute, /wouldSend: false/)
assert.match(sellerTargetedRoute, /seller_cold_email_prohibited/)
assert.doesNotMatch(sellerTargetedRoute, /sendLeadOutreachEmail|claimOutreachMessageForSend/)

for (const repositoryPath of [
  'lib/buyers/repository.ts',
  'lib/lenders/repository.ts',
  'lib/investors/repository.ts',
]) {
  const repositorySource = source(repositoryPath)
  assert.match(
    repositorySource,
    /downgrade(?:Buyer|Lender|Investor)OutreachMessageIfApproved[\s\S]*?\.eq\('status', 'approved'\)[\s\S]*?\.is\('sent_at', null\)/
  )
}
for (const revalidationPath of [
  'lib/buyers/automation.ts',
  'lib/lenders/automation.ts',
  'lib/investors/service.ts',
]) {
  const revalidationSource = source(revalidationPath)
  assert.match(revalidationSource, /downgrade(?:Buyer|Lender|Investor)OutreachMessageIfApproved/)
  assert.match(revalidationSource, /message_state_changed/)
}

const budgetSource = source('lib/outreach/outlookColdBudget.ts')
assert.match(budgetSource, /job_type: 'suppression_sync'/)
assert.match(budgetSource, /\.eq\('updated_at', row\.updated_at\)/)
assert.match(budgetSource, /reservationId/)
for (const outlookBoundPath of [
  'lib/leads/outbound.ts',
  'lib/buyers/outbound.ts',
  'lib/lenders/outbound.ts',
  'lib/investors/outbound.ts',
]) {
  const outlookBoundSource = source(outlookBoundPath)
  assert.match(outlookBoundSource, /sendGuardedOutlookEmail/)
  assert.doesNotMatch(outlookBoundSource, /sendEmailViaResend/)
}
const sendEmailSource = source('lib/email/sendEmail.ts')
assert.match(sendEmailSource, /prefersMicrosoftGraphTransactionalEmail/)
assert.match(sendEmailSource, /sendTransactionalEmailWithMicrosoftGraphIdempotently/)
assert.match(sendEmailSource, /crossProviderFallbackAllowed: false/)
const outlookMailboxSource = source('lib/email/outlookMailbox.ts')
assert.match(outlookMailboxSource, /reconcileAmbiguousOutlookDispatchFromInbound/)
assert.match(outlookMailboxSource, /projectReconciledOutlookSourceFromInbound/)
assert.match(outlookMailboxSource, /projectOutlookDeliveryFailure/)
assert.match(source('app/api/cron/outreach-dispatch/route.ts'), /runLeadThroughputSprint/)
assert.match(source('app/api/cron/outreach-dispatch/route.ts'), /OUTREACH_DISPATCH_CRON_SEND/)
assert.match(source('lib/leads/outbound.ts'), /deferredScope\?: 'record' \| 'lane' \| 'global' \| 'infrastructure'/)
assert.match(source('lib/leads/outbound.ts'), /deferredScope: hunter\.reason\.includes\('budget'\) \? 'global' : 'record'/)
assert.match(source('lib/leads/dailyAutomation.ts'), /sendResult\.deferredScope !== 'lane'/)

const throughputMigrationSource = source(
  'supabase/migrations/20260915141718_create_outreach_throughput_governor.sql'
)
assert.match(throughputMigrationSource, /v_reuse_cancelled BOOLEAN := FALSE/)
assert.match(throughputMigrationSource, /v_existing\.state <> 'cancelled'/)
assert.match(throughputMigrationSource, /reopenedCancelledReservationAt/)
assert.match(throughputMigrationSource, /out_of_order_or_terminal_outcome/)
assert.match(throughputMigrationSource, /outreach_recipient_24h_cooldown/)
assert.match(throughputMigrationSource, /outreach_send_events_provider_event_unique/)
assert.match(throughputMigrationSource, /INTERVAL '23 hours'/)
assert.match(throughputMigrationSource, /ADD COLUMN IF NOT EXISTS sender_email TEXT/)
assert.match(throughputMigrationSource, /idx_provider_delivery_events_sender_time/)
assert.match(source('lib/outreach/throughputGovernor.ts'), /reconcileStaleOutreachReservations/)

for (const approvalRoute of [
  'app/api/admin/leads/[id]/outreach/route.ts',
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
]) {
  assert.match(source(approvalRoute), /canApproveOutreachMessage/)
}
assert.doesNotMatch(source('app/api/admin/leads/bulk/route.ts'), /\.in\('status', \['needs_review', 'queued'\]\)/)
const partnerPipelineRoute = source('app/api/cron/partner-network-pipeline/route.ts')
assert.match(partnerPipelineRoute, /allocateDailyStrategyOutput/)
assert.match(partnerPipelineRoute, /Promise\.allSettled/)
assert.match(partnerPipelineRoute, /serializePartnerSend/)
assert.match(partnerPipelineRoute, /let invocationRemaining = 2/)
for (const pipelinePath of [
  'lib/buyers/automation.ts',
  'lib/lenders/automation.ts',
  'lib/investors/automation.ts',
]) {
  const pipelineSource = source(pipelinePath)
  assert.match(pipelineSource, /sendExecutor/)
  assert.match(pipelineSource, /options\.sendExecutor/)
}
assert.match(partnerPipelineRoute, /LENDERS_PIPELINE_CRON_SEND/)
assert.match(partnerPipelineRoute, /INVESTORS_PIPELINE_CRON_SEND/)
assert.doesNotMatch(
  partnerPipelineRoute,
  /PARTNER_PIPELINE_CRON_SEND \|\| process\.env\.BUYERS_PIPELINE_CRON_SEND/
)
const investorPipelineRoute = source('app/api/cron/investors-pipeline/route.ts')
assert.match(investorPipelineRoute, /INVESTORS_PIPELINE_CRON_SEND/)
assert.match(investorPipelineRoute, /deliveryEnabled = enabled\(process\.env\.INVESTORS_PIPELINE_CRON_SEND\) && !dryRun/)
const investorSendRoute = source('app/api/cron/investors-send/route.ts')
assert.match(investorSendRoute, /searchParams\.get\('send'\)/)
assert.match(investorSendRoute, /INVESTORS_PIPELINE_CRON_SEND/)
assert.match(investorSendRoute, /INVESTOR_AUTO_SEND_ENABLED/)
assert.match(investorSendRoute, /status: 409/)

console.log('delivery-control-plane: ok')
