import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildOutlookDispatchAllocationPlan,
  deriveOutreachDispatchCapacity,
  resolveLeadOutlookSendLimit,
} from '@/lib/outreach/outreachDispatchCapacityCore'
import {
  deriveHunterSendVerificationLimits,
  hunterVerificationReplacementScanLimit,
} from '@/lib/outreach/hunterSendVerificationCore'
import {
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  inspectOutlookColdBudget,
  reserveOutlookColdBudget,
  seedOutlookColdBudget,
} from '@/lib/outreach/outlookColdBudgetCore'
import { evaluateOutreachThroughputGovernor } from '@/lib/outreach/throughputGovernorCore'

const now = new Date('2026-09-15T16:00:00.000Z')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
let metrics = seedOutlookColdBudget()

for (let index = 0; index < OUTLOOK_COLD_B2B_INVOCATION_CAP; index += 1) {
  const reservation = reserveOutlookColdBudget({
    metrics,
    idempotencyKeyHash: hash(`message-${index}`),
    recipientDomainHash: hash(`domain-${index}.test`),
    invocationIdHash: hash('shared-invocation'),
    strategyKey: 'dealvault_records',
    reservationId: `reservation-${index}`,
    now,
  })
  assert.equal(reservation.allowed, true)
  metrics = reservation.metrics!
}

const invocationBlocked = reserveOutlookColdBudget({
  metrics,
  idempotencyKeyHash: hash('message-overflow'),
  recipientDomainHash: hash('overflow.test'),
  invocationIdHash: hash('shared-invocation'),
  strategyKey: 'dealvault_records',
  reservationId: 'reservation-overflow',
  now,
})
assert.equal(invocationBlocked.allowed, false)
assert.equal(invocationBlocked.reason, 'outlook_cold_invocation_cap_exhausted')

const inspection = inspectOutlookColdBudget(metrics, now)
const capacity = deriveOutreachDispatchCapacity(inspection)
const allocationPlan = buildOutlookDispatchAllocationPlan(now)
assert.equal(allocationPlan.target, OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP)
assert.equal(allocationPlan.baseAllocation, 1)
assert.equal(allocationPlan.remainder, 1)
assert.equal(
  allocationPlan.allocations.reduce((sum, lane) => sum + lane.target, 0),
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
  'the decision lane allocations must add up to the same 25-attempt global cap'
)
for (const lane of allocationPlan.allocations) {
  assert.equal(allocationPlan.byKey[lane.key], lane.target)
  if (lane.group === 'seller') assert.equal(lane.target, 0)
}
for (const [strategyKey, laneCap] of Object.entries(inspection.laneCaps)) {
  assert.equal(allocationPlan.byKey[strategyKey as keyof typeof allocationPlan.byKey], laneCap)
}
const heldAllocationPlan = buildOutlookDispatchAllocationPlan(now, false)
assert.equal(heldAllocationPlan.target, 0)
assert.equal(heldAllocationPlan.allocations.some((lane) => lane.target !== 0), false)
assert.equal(capacity.globalAttemptCount, OUTLOOK_COLD_B2B_INVOCATION_CAP)
assert.equal(capacity.leadLaneRemaining + capacity.partnerLaneRemaining, capacity.globalRemaining)
assert.equal(
  capacity.globalRemaining,
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - OUTLOOK_COLD_B2B_INVOCATION_CAP,
  'using the full two-attempt invocation allowance must not exhaust the 25-attempt rolling budget'
)

const recoveryDecision = evaluateOutreachThroughputGovernor({
  mode: 'recovery_canary',
  sampleSize: 0,
  complained: 0,
  badRate: 0,
  globalFailureRate: 0,
  terminalCompleteness: 1,
  requestedDailyTarget: 1_000,
  now,
})
const recoveryCapacity = deriveOutreachDispatchCapacity(inspection, recoveryDecision)
assert.equal(recoveryDecision.effectiveDailyCap, 5)
assert.equal(
  recoveryCapacity.globalRemaining,
  3,
  'the recovery decision must subtract prior Outlook attempts from its five-attempt ceiling'
)
assert.equal(recoveryCapacity.remainingByLane.dealvault_records, 0)
assert.equal(recoveryCapacity.remainingByLane.buyers, 0)
assert.equal(recoveryCapacity.remainingByLane.lenders, inspection.laneCaps.lenders)
assert.equal(recoveryCapacity.leadLaneRemaining, 0)
assert.equal(recoveryCapacity.partnerLaneRemaining, inspection.laneCaps.lenders)

const heldDecision = evaluateOutreachThroughputGovernor({
  mode: 'blocked',
  sampleSize: 0,
  complained: 0,
  badRate: 0,
  globalFailureRate: 0,
  requestedDailyTarget: 1_000,
  now,
})
const heldCapacity = deriveOutreachDispatchCapacity(inspection, heldDecision)
assert.equal(heldCapacity.globalRemaining, 0)
assert.equal(Object.values(heldCapacity.remainingByLane).some((remaining) => remaining !== 0), false)

assert.equal(
  resolveLeadOutlookSendLimit({ requestedSendLimit: 50, capacity }),
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  'one provider invocation remains capped at two even while global capacity remains'
)
assert.equal(
  resolveLeadOutlookSendLimit({
    requestedSendLimit: 50,
    capacity: { ...capacity, globalRemaining: 1 },
  }),
  1,
  'the advisory preflight must reduce an invocation to the final rolling-budget slot'
)
const defaultHunterReplacementLimit = hunterVerificationReplacementScanLimit(
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  10
)
assert.deepEqual(
  deriveHunterSendVerificationLimits({
    effectiveDailyCap: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
    requestedSendLimit: OUTLOOK_COLD_B2B_INVOCATION_CAP,
    globalRemaining: capacity.globalRemaining,
    leadLaneRemaining: capacity.leadLaneRemaining,
    configuredDailyLimit: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
    configuredPerRunLimit: defaultHunterReplacementLimit,
  }),
  { dailyLimit: 25, perRunLimit: 20 },
  'replacement verification may scan beyond two candidates without increasing provider capacity'
)

const invalidCapacity = deriveOutreachDispatchCapacity(inspectOutlookColdBudget(null, now))
assert.equal(invalidCapacity.globalRemaining, 0, 'invalid persisted budget state must fail closed')
assert.equal(invalidCapacity.leadLaneRemaining, 0)
assert.equal(invalidCapacity.partnerLaneRemaining, 0)

const capacityRuntimeSource = readFileSync(
  resolve(process.cwd(), 'lib/outreach/outreachDispatchCapacity.ts'),
  'utf8'
)
assert.match(capacityRuntimeSource, /command_center_jobs/)
assert.match(capacityRuntimeSource, /inspectOutlookColdBudget/)
assert.doesNotMatch(
  capacityRuntimeSource,
  /outreach_attempt_reservations/,
  'capacity health must read the same Outlook rolling budget used by atomic provider reservations'
)

const leadRepositorySource = readFileSync(
  resolve(process.cwd(), 'lib/leads/repository.ts'),
  'utf8'
)
assert.doesNotMatch(
  leadRepositorySource,
  /outreach_attempt_reservations/,
  'lead queue admission must not consult the retired reservation ledger'
)
assert.match(leadRepositorySource, /options\.remainingByLane/)

const leadAutomationSource = readFileSync(
  resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'),
  'utf8'
)
assert.match(leadAutomationSource, /OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP/)
assert.match(leadAutomationSource, /OUTLOOK_COLD_B2B_INVOCATION_CAP/)
assert.match(leadAutomationSource, /buildOutlookDispatchAllocationPlan/)
assert.match(leadAutomationSource, /readOutreachDispatchCapacity\(throughputDecision, outlookCapacityNow\)/)
assert.match(leadAutomationSource, /resolveLeadOutlookSendLimit/)
assert.match(
  leadAutomationSource,
  /remainingByLane: throughputCapacity\.remainingByLane/,
  'lead queue selection must receive authoritative Outlook lane capacity directly'
)
assert.match(
  leadAutomationSource,
  /strategyEngineAllowsApprovedDelivery\(currentLead, currentRow\)[\s\S]*currentRow\.status === 'approved'/,
  'capacity changes must leave the strategy review and explicit approval gate in place'
)

console.log('outreach-dispatch-capacity: ok')
