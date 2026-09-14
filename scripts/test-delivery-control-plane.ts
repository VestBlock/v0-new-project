import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildRevenueLoopJobPayload,
  isStaleRunningJob,
  staleJobRecoveryPatch,
  type CommandCenterJobRow,
} from '../lib/admin/jobLifecycleCore'
import { buildResendDeliveryIdentityMetadata } from '../lib/email/resendDeliveryCore'
import {
  deliveryBreakerAllowsLenderCanary,
  evaluateLenderRecoveryCanaryReadiness,
  isVerifiedLenderCanaryCandidate,
} from '../lib/lenders/canary'
import { evaluateDeliveryCircuitBreaker, providerHasDeliveryTelemetry } from '../lib/leads/deliveryHealthCore'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '../lib/outreach/commercialCompliance'
import { buildOutboundSendIdentity } from '../lib/outreach/deliveryIdentity'
import {
  deliveryModeRequiresBudget,
  normalizeDeliveryBudget,
  OUTREACH_DELIVERY_BUDGET_LIMIT,
} from '../lib/outreach/deliveryBudgetCore'
import { allocatePartnerPipelineSendCap } from '../lib/outreach/partnerPipelineCore'
import { evaluateOutreachRecipientSnapshot } from '../lib/outreach/suppressionCore'
import { getConfiguredOutboundProvider } from '../lib/outreach/provider-preference'
import {
  canAutoApproveFollowupMessage,
  canClaimMessageForSend,
  canApproveOutreachMessage,
  hasActionableReplyEvidence,
  isMessageGenerationProtected,
} from '../lib/outreach/messageState'

const now = new Date('2026-09-14T12:00:00.000Z')
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

assert.equal(OUTREACH_DELIVERY_BUDGET_LIMIT, 5)
assert.equal(deliveryModeRequiresBudget('controlled_trial'), true)
assert.equal(deliveryModeRequiresBudget('recovery_canary'), true)
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
assert.deepEqual(allocatePartnerPipelineSendCap(5), { buyers: 2, lenders: 2, investors: 1 })
assert.equal(Object.values(allocatePartnerPipelineSendCap(14)).reduce((sum, value) => sum + value, 0), 14)
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
  'app/api/cron/seller-targeted-send/route.ts',
]) {
  const routeSource = source(routePath)
  assert.match(routeSource, /claim(?:Outreach|BuyerOutreach|LenderOutreach)MessageForSend/)
  assert.match(routeSource, /already been claimed or sent|Another worker already claimed/)
}

for (const outboundPath of [
  'lib/leads/outbound.ts',
  'lib/buyers/outbound.ts',
  'lib/lenders/outbound.ts',
]) {
  const outboundSource = source(outboundPath)
  assert.match(outboundSource, /X-VestBlock-Correlation-ID/)
  assert.match(outboundSource, /idempotencyKey/)
}
assert.match(source('lib/buyers/outbound.ts'), /scope: 'buyer-packet'/)
assert.match(source('lib/buyers/packetDelivery.ts'), /messageId: `buyer-packet:\$\{packet\.id\}:\$\{buyer\.id\}`/)
assert.match(
  source('lib/buyers/outbound.ts'),
  /sendBuyerPacketEmail[\s\S]*getCommercialOutreachMailingAddress\(\)[\s\S]*buildCommercialOutreachBody/
)
assert.match(source('lib/email/resendDeliveryCore.ts'), /recordType: 'buyer_packet_outreach'/)

for (const repositoryPath of ['lib/buyers/repository.ts', 'lib/lenders/repository.ts']) {
  const repositorySource = source(repositoryPath)
  assert.match(repositorySource, /getReviewable(?:Buyer|Lender)OutreachMessageByChannel[\s\S]*\.in\('status', \[\.\.\.FOLLOWUP_AUTOMATION_REVIEWABLE_STATUSES\]\)[\s\S]*\.is\('sent_at', null\)/)
  assert.match(repositorySource, /approve(?:Buyer|Lender)FollowupMessageIfReviewable[\s\S]*\.in\('status', \[\.\.\.FOLLOWUP_AUTOMATION_REVIEWABLE_STATUSES\]\)[\s\S]*\.is\('sent_at', null\)/)
}
for (const servicePath of ['lib/buyers/service.ts', 'lib/lenders/service.ts']) {
  const serviceSource = source(servicePath)
  assert.match(serviceSource, /const approvedMessage = await approve(?:Buyer|Lender)FollowupMessageIfReviewable/)
  assert.match(serviceSource, /if \(!approvedMessage\)[\s\S]*reason: 'message_state_changed'[\s\S]*continue/)
}

const canaryRouteSource = source('app/api/cron/outreach-canary/route.ts')
assert.match(canaryRouteSource, /mode === 'recovery_canary'/)
assert.match(canaryRouteSource, /runDailyLenderSend\(5/)
assert.match(canaryRouteSource, /dryRun: !send/)
assert.match(canaryRouteSource, /recoveryExplicitlyRequested: explicitRecoveryRequest/)

assert.match(
  source('lib/investors/service.ts'),
  /effectiveLimit = Math\.min\(limit, deliveryCircuitBreaker\?\.maxBatchSize/
)
assert.match(
  source('lib/lenders/automation.ts'),
  /Math\.min\(limit, deliveryCircuitBreaker\?\.maxBatchSize/
)
assert.match(source('lib/investors/outbound.ts'), /disableProviderFallback: true/)

const leadServiceSource = source('lib/leads/service.ts')
assert.doesNotMatch(leadServiceSource, /sendLeadOutreachEmail|allowImmediateAutoSend|autoSendApprovedLeadEmail/)
for (const suppressionReadPath of [
  'lib/leads/service.ts',
  'lib/leads/dailyAutomation.ts',
  'app/api/admin/leads/[id]/outreach/route.ts',
  'app/api/admin/leads/bulk/route.ts',
  'app/api/admin/leads/route.ts',
  'app/api/leads/export/route.ts',
]) {
  assert.doesNotMatch(source(suppressionReadPath), /listSuppressions\(\)\.catch/)
}

for (const outboundPath of [
  'lib/leads/outbound.ts',
  'lib/buyers/outbound.ts',
  'lib/lenders/outbound.ts',
  'lib/investors/outbound.ts',
]) {
  const outboundSource = source(outboundPath)
  assert.match(outboundSource, /acquireGuardedDeliveryAttempt/)
  assert.match(outboundSource, /releaseGuardedDeliveryAttempt/)
  assert.match(outboundSource, /getOutreachRecipientGuard/)
}

for (const claimPath of [
  'lib/leads/dailyAutomation.ts',
  'lib/buyers/automation.ts',
  'lib/lenders/automation.ts',
  'lib/investors/service.ts',
  'app/api/admin/leads/[id]/outreach/route.ts',
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
  'app/api/cron/seller-targeted-send/route.ts',
]) {
  assert.match(source(claimPath), /getOutreachRecipientGuard/)
}

const budgetSource = source('lib/outreach/deliveryBudget.ts')
assert.match(budgetSource, /job_type: 'suppression_sync'/)
assert.match(budgetSource, /\.eq\('updated_at', row\.updated_at\)/)
assert.match(budgetSource, /attemptMarkers/)
const resendDeliverySource = source('lib/email/resendDelivery.ts')
assert.match(resendDeliverySource, /suppressAndCancelPendingOutreach/)
assert.match(resendDeliverySource, /recordPartnerOutreachDelivery/)

for (const approvalRoute of [
  'app/api/admin/leads/[id]/outreach/route.ts',
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
]) {
  assert.match(source(approvalRoute), /canApproveOutreachMessage/)
}
assert.doesNotMatch(source('app/api/admin/leads/bulk/route.ts'), /\.in\('status', \['needs_review', 'queued'\]\)/)
assert.match(source('app/api/cron/partner-network-pipeline/route.ts'), /allocatePartnerPipelineSendCap/)

console.log('delivery-control-plane: ok')
