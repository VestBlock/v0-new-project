import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  MAX_DAILY_OUTREACH_THROUGHPUT,
  OUTREACH_THROUGHPUT_STAGE_CAPS,
  downshiftOutreachThroughputStage,
  evaluateOutreachThroughputGovernor,
  normalizeOutreachThroughputTarget,
  outreachThroughputStageForSample,
  type OutreachThroughputDeliveryMode,
} from '@/lib/outreach/throughputGovernorCore'
import {
  OUTREACH_RAMP_PROMOTION_COOLDOWN_MS,
  evaluateRampPromotionGuard,
} from '@/lib/outreach/rampPromotionGuardCore'

const now = new Date('2026-09-15T17:00:00.000Z')

function decision(overrides: Partial<Parameters<typeof evaluateOutreachThroughputGovernor>[0]> = {}) {
  return evaluateOutreachThroughputGovernor({
    mode: 'healthy',
    sampleSize: 1_500,
    complained: 0,
    badRate: 0,
    globalFailureRate: 0,
    terminalCompleteness: 1,
    requestedDailyTarget: 1_000,
    now,
    ...overrides,
  })
}

const healthyThresholds = [
  { sampleSize: 0, stage: 'recovery', cap: 5 },
  { sampleSize: 19, stage: 'recovery', cap: 5 },
  { sampleSize: 20, stage: 'prove_25', cap: 25 },
  { sampleSize: 49, stage: 'prove_25', cap: 25 },
  { sampleSize: 50, stage: 'prove_100', cap: 100 },
  { sampleSize: 199, stage: 'prove_100', cap: 100 },
  { sampleSize: 200, stage: 'prove_250', cap: 250 },
  { sampleSize: 499, stage: 'prove_250', cap: 250 },
  { sampleSize: 500, stage: 'prove_500', cap: 500 },
  { sampleSize: 1_499, stage: 'prove_500', cap: 500 },
  { sampleSize: 1_500, stage: 'full_1000', cap: 1_000 },
] as const

for (const expected of healthyThresholds) {
  assert.equal(outreachThroughputStageForSample(expected.sampleSize), expected.stage)
  const result = decision({ sampleSize: expected.sampleSize })
  assert.equal(result.stage, expected.stage)
  assert.equal(result.stageCap, expected.cap)
  assert.equal(result.effectiveDailyCap, expected.cap)
  assert.equal(result.allocationPlan.target, expected.cap)
  assert.equal(
    result.allocationPlan.allocations.reduce((sum, lane) => sum + lane.target, 0),
    expected.cap
  )
  const laneTargets = result.allocationPlan.allocations.map((lane) => lane.target)
  assert.ok(Math.max(...laneTargets) - Math.min(...laneTargets) <= 1)
}

const healthyToday = decision()
const healthyNextDay = decision({ now: new Date('2026-09-16T17:00:00.000Z') })
assert.notDeepEqual(
  healthyToday.allocationPlan.allocations
    .filter((lane) => lane.target > healthyToday.allocationPlan.baseAllocation)
    .map((lane) => lane.key),
  healthyNextDay.allocationPlan.allocations
    .filter((lane) => lane.target > healthyNextDay.allocationPlan.baseAllocation)
    .map((lane) => lane.key),
  'healthy remainder slots should keep rotating between business dates'
)

for (const mode of ['blocked', 'unavailable'] satisfies OutreachThroughputDeliveryMode[]) {
  const result = decision({ mode })
  assert.equal(result.stage, 'hold')
  assert.equal(result.effectiveDailyCap, 0)
  assert.match(result.reason, new RegExp(`delivery_mode_${mode}`))
}

const controlledTrial = decision({ mode: 'controlled_trial', sampleSize: 5_000 })
assert.equal(controlledTrial.stage, 'recovery')
assert.equal(controlledTrial.effectiveDailyCap, 5)
assert.match(controlledTrial.reason, /delivery_mode_controlled_trial/)
assert.equal(controlledTrial.allocationPlan.byKey.lenders, 5)
assert.deepEqual(controlledTrial.allocationPlan.groupTotals, {
  seller: 0,
  business: 0,
  partner: 5,
})
assert.ok(
  controlledTrial.allocationPlan.allocations
    .filter((lane) => lane.key !== 'lenders')
    .every((lane) => lane.target === 0)
)
const nextDayControlledTrial = decision({
  mode: 'controlled_trial',
  sampleSize: 5_000,
  now: new Date('2026-09-16T17:00:00.000Z'),
})
assert.equal(nextDayControlledTrial.allocationPlan.byKey.lenders, 5)

const realisticRecoveryCanary = decision({
  mode: 'recovery_canary',
  sampleSize: 5,
  badRate: 0.2,
  globalFailureRate: 0,
})
assert.equal(realisticRecoveryCanary.stage, 'recovery')
assert.equal(realisticRecoveryCanary.effectiveDailyCap, 5)
assert.equal(realisticRecoveryCanary.allocationPlan.byKey.lenders, 5)
assert.deepEqual(realisticRecoveryCanary.allocationPlan.groupTotals, {
  seller: 0,
  business: 0,
  partner: 5,
})
assert.ok(
  realisticRecoveryCanary.allocationPlan.allocations
    .filter((lane) => lane.key !== 'lenders')
    .every((lane) => lane.target === 0)
)
assert.match(realisticRecoveryCanary.reason, /combined_bad_rate_above_5_percent_recovery_cap/)

const recoveryWithElevatedProviderFailures = decision({
  mode: 'recovery_canary',
  sampleSize: 5,
  badRate: 0.2,
  globalFailureRate: 0.1,
})
assert.equal(recoveryWithElevatedProviderFailures.stage, 'recovery')
assert.equal(recoveryWithElevatedProviderFailures.effectiveDailyCap, 5)
assert.equal(recoveryWithElevatedProviderFailures.allocationPlan.byKey.lenders, 5)

const complaintBlock = decision({ complained: 1 })
assert.equal(complaintBlock.stage, 'hold')
assert.equal(complaintBlock.effectiveDailyCap, 0)
assert.match(complaintBlock.reason, /complaint_evidence/)

const recoveryComplaintBlock = decision({
  mode: 'recovery_canary',
  sampleSize: 5,
  badRate: 0.2,
  complained: 1,
})
assert.equal(recoveryComplaintBlock.stage, 'hold')
assert.equal(recoveryComplaintBlock.effectiveDailyCap, 0)

const badRateRecovery = decision({ badRate: 0.0201 })
assert.equal(badRateRecovery.stage, 'recovery')
assert.equal(badRateRecovery.effectiveDailyCap, 5)

const badRateBlock = decision({ badRate: 0.0501 })
assert.equal(badRateBlock.stage, 'hold')
assert.equal(badRateBlock.effectiveDailyCap, 0)

const providerFailureDownshift = decision({ sampleSize: 500, globalFailureRate: 0.0501 })
assert.equal(providerFailureDownshift.stage, 'prove_250')
assert.equal(providerFailureDownshift.effectiveDailyCap, 250)
assert.match(providerFailureDownshift.reason, /provider_failure_rate_above_5_percent_downshift/)

const providerFailureBlock = decision({ globalFailureRate: 0.2001 })
assert.equal(providerFailureBlock.stage, 'hold')
assert.equal(providerFailureBlock.effectiveDailyCap, 0)

const recoveryProviderFailureBlock = decision({
  mode: 'recovery_canary',
  sampleSize: 5,
  badRate: 0.2,
  globalFailureRate: 0.2001,
})
assert.equal(recoveryProviderFailureBlock.stage, 'hold')
assert.equal(recoveryProviderFailureBlock.effectiveDailyCap, 0)

const incompleteTelemetry = decision({ sampleSize: 200, terminalCompleteness: 0.949 })
assert.equal(incompleteTelemetry.stage, 'prove_100')
assert.equal(incompleteTelemetry.effectiveDailyCap, 100)
assert.match(incompleteTelemetry.reason, /terminal_completeness_below_95_percent_downshift/)

const stackedQualityPenalties = decision({
  sampleSize: 1_500,
  globalFailureRate: 0.051,
  terminalCompleteness: 0.94,
})
assert.equal(stackedQualityPenalties.stage, 'prove_250')
assert.equal(stackedQualityPenalties.effectiveDailyCap, 250)

assert.equal(downshiftOutreachThroughputStage('full_1000'), 'prove_500')
assert.equal(downshiftOutreachThroughputStage('prove_100', 2), 'recovery')
assert.equal(downshiftOutreachThroughputStage('hold'), 'hold')

assert.equal(normalizeOutreachThroughputTarget(undefined), MAX_DAILY_OUTREACH_THROUGHPUT)
assert.equal(normalizeOutreachThroughputTarget(10_000), MAX_DAILY_OUTREACH_THROUGHPUT)
assert.equal(normalizeOutreachThroughputTarget(999.9), 999)
assert.equal(normalizeOutreachThroughputTarget(-1), 0)
assert.equal(normalizeOutreachThroughputTarget(Number.NaN), 0)

const clampedTarget = decision({ requestedDailyTarget: 20_000 })
assert.equal(clampedTarget.requestedDailyTarget, 1_000)
assert.equal(clampedTarget.effectiveDailyCap, 1_000)
assert.equal(clampedTarget.allocationPlan.target, 1_000)
assert.equal(
  clampedTarget.allocationPlan.allocations.reduce((sum, lane) => sum + lane.target, 0),
  1_000
)

const lowerRequestedTarget = decision({ requestedDailyTarget: 73 })
assert.equal(lowerRequestedTarget.stage, 'full_1000')
assert.equal(lowerRequestedTarget.stageCap, OUTREACH_THROUGHPUT_STAGE_CAPS.full_1000)
assert.equal(lowerRequestedTarget.effectiveDailyCap, 73)
assert.equal(lowerRequestedTarget.allocationPlan.target, 73)

const zeroRequestedTarget = decision({ requestedDailyTarget: 0 })
assert.equal(zeroRequestedTarget.stage, 'hold')
assert.equal(zeroRequestedTarget.effectiveDailyCap, 0)
assert.ok(zeroRequestedTarget.allocationPlan.allocations.every((lane) => lane.target === 0))

const governorStore = readFileSync(
  resolve(process.cwd(), 'lib/outreach/throughputGovernor.ts'),
  'utf8'
)
assert.match(governorStore, /record_outreach_sender_ramp_decision/)
assert.match(governorStore, /p_evidence_observed_at: evidenceObservedAt/)
assert.match(governorStore, /p_evidence_watermark: input\.breaker\.evidenceWatermark \?\? null/)
assert.match(governorStore, /allocationByKey: input\.decision\.allocationPlan\.byKey/)
assert.match(governorStore, /authoritativeGlobalLimit/)
assert.match(governorStore, /authoritativeLaneTarget/)

const governorMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915141718_create_outreach_throughput_governor.sql'),
  'utf8'
)
assert.match(governorMigration, /evidence_observed_at TIMESTAMPTZ NOT NULL/)
assert.match(governorMigration, /evidence_watermark BIGINT NOT NULL/)
assert.match(governorMigration, /outreach_delivery_evidence_version_seq/)
assert.match(governorMigration, /get_outreach_delivery_evidence_watermark/)
assert.match(governorMigration, /PERFORM pg_catalog\.pg_advisory_xact_lock\(2086227401\)/)
assert.match(governorMigration, /p_evidence_watermark <> v_current_evidence_watermark/)
assert.match(governorMigration, /last_conservative_decision_at TIMESTAMPTZ NOT NULL/)
assert.match(governorMigration, /p_evidence_observed_at <= v_latest_lower_decision_at/)
assert.match(governorMigration, /WHEN NOT v_is_promotion THEN v_now/)
assert.match(governorMigration, /v_now < v_promotion_eligible_at/)
assert.match(governorMigration, /v_existing\.last_transition_at \+ INTERVAL '15 minutes'/)
assert.match(governorMigration, /provider_delivery_complaint_hard_stop/)
assert.match(governorMigration, /PERFORM public\.hard_stop_outreach_sender/)
assert.match(
  governorMigration,
  /v_authoritative_global_limit := LEAST\(p_global_rolling_limit, v_ramp\.effective_cap\)/
)
assert.match(governorMigration, /v_ramp\.evidence_json->'allocationByKey'->p_strategy_key/)
assert.match(governorMigration, /v_global_count >= v_authoritative_global_limit/)
assert.match(governorMigration, /v_lane_count >= v_authoritative_lane_target/)
assert.match(governorMigration, /v_global_count <= v_authoritative_global_limit/)
assert.match(governorMigration, /v_lane_count <= v_authoritative_lane_target/)
assert.match(governorMigration, /v_existing\.business_date = v_business_date/)

const deliveryHealthSource = readFileSync(
  resolve(process.cwd(), 'lib/leads/deliveryHealth.ts'),
  'utf8'
)
assert.ok(
  deliveryHealthSource.indexOf("admin.rpc('get_outreach_delivery_evidence_watermark'") <
    deliveryHealthSource.indexOf('await Promise.all(['),
  'the database evidence watermark must be captured before asynchronous evidence reads begin'
)

const conservativeOlderHold = evaluateRampPromotionGuard({
  currentEffectiveCap: 500,
  proposedEffectiveCap: 0,
  snapshotEvidenceWatermark: 2,
  currentEvidenceWatermark: 9,
  snapshotObservedAt: new Date('2026-09-15T17:00:00.000Z'),
  currentStateTransitionedAt: new Date('2026-09-15T17:01:00.000Z'),
  now: new Date('2026-09-15T17:02:00.000Z'),
})
assert.deepEqual(conservativeOlderHold, {
  allowed: true,
  promotion: false,
  reason: 'conservative_transition',
})

async function runInvertedQueryCompletionRegression() {
  let currentEvidenceWatermark = 40
  let lowerState = {
    effectiveCap: 5,
    transitionedAt: new Date('2026-09-15T17:00:00.000Z'),
  }
  let releaseHealthyPersist: (() => void) | undefined
  const healthyMayFinish = new Promise<void>((resolve) => {
    releaseHealthyPersist = resolve
  })

  // The healthy worker takes its snapshot first, but is deliberately delayed
  // before persistence. A complaint then increments the DB watermark and a
  // different worker commits the lower state first.
  const healthySnapshot = {
    evidenceWatermark: currentEvidenceWatermark,
    observedAt: new Date('2026-09-15T17:00:30.000Z'),
  }
  const delayedHealthyPromotion = (async () => {
    await healthyMayFinish
    return evaluateRampPromotionGuard({
      currentEffectiveCap: lowerState.effectiveCap,
      proposedEffectiveCap: 1_000,
      snapshotEvidenceWatermark: healthySnapshot.evidenceWatermark,
      currentEvidenceWatermark,
      snapshotObservedAt: healthySnapshot.observedAt,
      currentStateTransitionedAt: lowerState.transitionedAt,
      now: new Date('2026-09-15T17:01:02.000Z'),
    })
  })()

  currentEvidenceWatermark += 1
  lowerState = {
    effectiveCap: 0,
    transitionedAt: new Date('2026-09-15T17:01:00.000Z'),
  }
  releaseHealthyPersist?.()

  const staleHealthyResult = await delayedHealthyPromotion
  assert.deepEqual(staleHealthyResult, {
    allowed: false,
    promotion: true,
    reason: 'promotion_evidence_changed',
  })

  const configHoldStillRejectsPreHoldSnapshot = evaluateRampPromotionGuard({
    currentEffectiveCap: 0,
    proposedEffectiveCap: 1_000,
    snapshotEvidenceWatermark: currentEvidenceWatermark,
    currentEvidenceWatermark,
    snapshotObservedAt: new Date('2026-09-15T17:00:59.000Z'),
    currentStateTransitionedAt: lowerState.transitionedAt,
    now: new Date('2026-09-15T17:20:00.000Z'),
  })
  assert.equal(configHoldStillRejectsPreHoldSnapshot.reason, 'promotion_evidence_predates_lower_state')

  // Repeating the exact same hold is still a newer conservative decision. It
  // must invalidate an already-running healthy worker even though stage, cap,
  // and reason did not change and the provider watermark stayed constant.
  const healthyBeforeRepeatedHold = evaluateRampPromotionGuard({
    currentEffectiveCap: 0,
    proposedEffectiveCap: 25,
    snapshotEvidenceWatermark: currentEvidenceWatermark,
    currentEvidenceWatermark,
    snapshotObservedAt: new Date('2026-09-15T17:20:00.000Z'),
    currentStateTransitionedAt: lowerState.transitionedAt,
    lastConservativeDecisionAt: new Date('2026-09-15T17:20:01.000Z'),
    now: new Date('2026-09-15T17:20:02.000Z'),
  })
  assert.equal(healthyBeforeRepeatedHold.reason, 'promotion_evidence_predates_lower_state')

  const earlyFreshSnapshot = evaluateRampPromotionGuard({
    currentEffectiveCap: 0,
    proposedEffectiveCap: 25,
    snapshotEvidenceWatermark: currentEvidenceWatermark,
    currentEvidenceWatermark,
    snapshotObservedAt: new Date('2026-09-15T17:02:00.000Z'),
    currentStateTransitionedAt: lowerState.transitionedAt,
    now: new Date(lowerState.transitionedAt.getTime() + OUTREACH_RAMP_PROMOTION_COOLDOWN_MS - 1),
  })
  assert.equal(earlyFreshSnapshot.reason, 'promotion_cooldown_active')

  const serialFreshSnapshot = evaluateRampPromotionGuard({
    currentEffectiveCap: 0,
    proposedEffectiveCap: 25,
    snapshotEvidenceWatermark: currentEvidenceWatermark,
    currentEvidenceWatermark,
    snapshotObservedAt: new Date('2026-09-15T17:16:01.000Z'),
    currentStateTransitionedAt: lowerState.transitionedAt,
    now: new Date('2026-09-15T17:16:02.000Z'),
  })
  assert.deepEqual(serialFreshSnapshot, {
    allowed: true,
    promotion: true,
    reason: 'promotion_validated',
  })
}

runInvertedQueryCompletionRegression()
  .then(() => console.log('Outreach throughput governor tests passed.'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
