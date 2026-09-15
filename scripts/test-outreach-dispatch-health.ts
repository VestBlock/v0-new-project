import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  evaluateAutomatedRecoveryCanaryHealth,
  evaluateOutreachDispatchHealth,
  isControlledTrialAllowanceFilled,
} from '../lib/outreach/outreachDispatchCore'

const healthy = {
  dryRun: false,
  liveEnabled: true,
  expectedSendCount: 10,
  sentCount: 10,
  remainingCapacityAfterRun: 30,
  globalRemainingAfterRun: 400,
}

assert.deepEqual(
  evaluateOutreachDispatchHealth(healthy),
  {
    ok: true,
    operationalFailure: false,
    status: 'completed',
    reason: 'The live run met its expected send count.',
    expectedSendCount: 10,
    sentCount: 10,
    remainingCapacityAfterRun: 30,
    globalRemainingAfterRun: 400,
    underfilled: false,
  }
)

const fullTargetWithProviderFailure = evaluateOutreachDispatchHealth({
  ...healthy,
  providerFailureCount: 1,
})
assert.equal(fullTargetWithProviderFailure.status, 'operational_failure')
assert.equal(fullTargetWithProviderFailure.ok, false)
assert.match(fullTargetWithProviderFailure.reason, /provider send operation/)

assert.equal(
  evaluateOutreachDispatchHealth({ ...healthy, dryRun: true, sentCount: 0 }).status,
  'dry_run'
)

assert.equal(
  isControlledTrialAllowanceFilled({ mode: 'controlled_trial', effectiveSendLimit: 5, sentCount: 5 }),
  true
)
assert.equal(
  isControlledTrialAllowanceFilled({ mode: 'controlled_trial', effectiveSendLimit: 5, sentCount: 0 }),
  false,
  'zero progress must not suppress the controlled-trial refill passes'
)
assert.equal(
  isControlledTrialAllowanceFilled({ mode: 'controlled_trial', effectiveSendLimit: 5, sentCount: 4 }),
  false
)
assert.equal(
  isControlledTrialAllowanceFilled({ mode: 'healthy', effectiveSendLimit: 5, sentCount: 5 }),
  false
)
assert.equal(
  evaluateOutreachDispatchHealth({ ...healthy, liveEnabled: false, sentCount: 0 }).status,
  'live_disabled'
)
assert.equal(
  evaluateOutreachDispatchHealth({ ...healthy, sentCount: 0, targetGapBeforeRun: 0 }).status,
  'target_exhausted'
)

assert.deepEqual(
  evaluateAutomatedRecoveryCanaryHealth({
    runOk: true,
    resultStatuses: ['accepted', 'accepted', 'accepted', 'accepted', 'accepted'],
    sentLast24h: 0,
    effectiveLimit: 5,
    sendGateOpen: true,
  }),
  {
    ok: true,
    accepted: 5,
    expected: 5,
    capacityAlreadyUsed: false,
    blockedReasons: [],
  }
)
assert.equal(
  evaluateAutomatedRecoveryCanaryHealth({
    runOk: true,
    resultStatuses: [],
    sentLast24h: 5,
    effectiveLimit: 0,
    sendGateOpen: false,
    blockedReasons: ['recovery_canary_daily_limit_reached'],
  }).ok,
  false,
  'used capacity is not proof that the five-message recovery batch produced healthy terminal outcomes'
)
assert.equal(
  evaluateAutomatedRecoveryCanaryHealth({
    runOk: true,
    resultStatuses: ['accepted', 'hunter_preflight_blocked:hunter_invalid'],
    sentLast24h: 0,
    effectiveLimit: 5,
    sendGateOpen: true,
  }).ok,
  false,
  'an underfilled recovery canary must remain visible as an operational failure'
)

const governorBlocked = evaluateOutreachDispatchHealth({
  ...healthy,
  expectedSendCount: 0,
  sentCount: 0,
  remainingCapacityAfterRun: 0,
  globalRemainingAfterRun: 0,
  throughputBlockedReason: 'delivery_mode_blocked',
})
assert.equal(governorBlocked.status, 'operational_failure')
assert.equal(governorBlocked.ok, false)

for (const exhausted of [
  { expectedSendCount: 0, sentCount: 0, remainingCapacityAfterRun: 0, globalRemainingAfterRun: 200 },
  { expectedSendCount: 10, sentCount: 4, remainingCapacityAfterRun: 30, globalRemainingAfterRun: 0 },
  { expectedSendCount: 10, sentCount: 4, remainingCapacityAfterRun: 0, globalRemainingAfterRun: 200 },
]) {
  const health = evaluateOutreachDispatchHealth({ ...healthy, ...exhausted })
  assert.equal(health.status, 'capacity_exhausted')
  assert.equal(health.ok, true)
}

for (const failure of [
  { sentCount: 0, blockingReasons: ['reply_capture_not_ready'] },
  { sentCount: 0, operationalFailureCount: 1 },
  { sentCount: 0, providerCircuitTripped: true },
  { sentCount: 0 },
  { sentCount: 4 },
  { expectedSendCount: 0, sentCount: 0 },
]) {
  const health = evaluateOutreachDispatchHealth({ ...healthy, ...failure })
  assert.equal(health.status, 'operational_failure')
  assert.equal(health.ok, false)
}

const leadRoute = readFileSync(
  resolve(process.cwd(), 'app/api/cron/outreach-dispatch/route.ts'),
  'utf8'
)
assert.match(leadRoute, /suppressDigest: true/)
assert.match(leadRoute, /runLeadThroughputSprint/)
assert.match(leadRoute, /taskType: 'outreach_dispatch_operational_failure'/)
assert.match(leadRoute, /const ok = result\.ok && dispatchHealth\.ok/)
assert.match(leadRoute, /status: ok \? 200 : 500/)

const partnerRoute = readFileSync(
  resolve(process.cwd(), 'app/api/cron/partner-network-pipeline/route.ts'),
  'utf8'
)
assert.match(partnerRoute, /taskType: 'partner_dispatch_operational_failure'/)
assert.match(partnerRoute, /const ok = pipelineOk && dispatchOk/)
assert.match(partnerRoute, /OUTREACH_AUTOMATED_RECOVERY_CANARY_ENABLED/)
assert.match(partnerRoute, /recoveryExplicitlyRequested: true/)
assert.match(partnerRoute, /const normalDispatchBlockedReason = throughputBlockedReason/)
assert.doesNotMatch(partnerRoute, /automatedRecoveryCanary\?\.ok\s*\?\s*null/)
assert.match(partnerRoute, /status: ok \? 200 : 500/)

const leadAutomation = readFileSync(
  resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'),
  'utf8'
)
assert.match(
  leadAutomation,
  /leadOpsAlertEmail && !options\.dryRun && !options\.suppressDigest/,
  'frequent refill runs must honor the cron digest suppression flag'
)

console.log('outreach-dispatch-health: ok')
