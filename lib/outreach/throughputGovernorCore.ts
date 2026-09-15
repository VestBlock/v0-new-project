import {
  DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET,
  allocateDailyStrategyOutput,
  totalDailyStrategyOutputByGroup,
  type DailyStrategyOutputPlan,
} from '@/lib/outreach/dailyStrategyOutputCore'

export const MAX_DAILY_OUTREACH_THROUGHPUT = DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET

export const OUTREACH_THROUGHPUT_STAGES = [
  'hold',
  'recovery',
  'prove_25',
  'prove_100',
  'prove_250',
  'prove_500',
  'full_1000',
] as const

export type OutreachThroughputStage = (typeof OUTREACH_THROUGHPUT_STAGES)[number]

export const OUTREACH_THROUGHPUT_STAGE_CAPS = {
  hold: 0,
  recovery: 5,
  prove_25: 25,
  prove_100: 100,
  prove_250: 250,
  prove_500: 500,
  full_1000: 1_000,
} as const satisfies Record<OutreachThroughputStage, number>

export type OutreachThroughputDeliveryMode =
  | 'healthy'
  | 'controlled_trial'
  | 'recovery_canary'
  | 'blocked'
  | 'unavailable'

export type OutreachThroughputEvidence = {
  mode: OutreachThroughputDeliveryMode
  /** Unique provider messages with a terminal delivery state in the evidence window. */
  sampleSize: number
  /** Complaint events in the evidence window. One complaint is a hard stop. */
  complained: number
  /** Combined bounce, complaint, suppression, and provider-failure rate (0 to 1). */
  badRate: number
  /** Provider-wide terminal failure rate (0 to 1). */
  globalFailureRate: number
  /**
   * Share of sufficiently aged provider attempts that reached a terminal state.
   * Omit this value when the reporting window has not been measured.
   */
  terminalCompleteness?: number | null
}

export type OutreachThroughputGovernorInput = OutreachThroughputEvidence & {
  requestedDailyTarget?: number | null
  now?: Date
}

export type OutreachThroughputGovernorDecision = {
  stage: OutreachThroughputStage
  stageCap: number
  requestedDailyTarget: number
  effectiveDailyCap: number
  reason: string
  allocationPlan: DailyStrategyOutputPlan
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function normalizeRate(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

export function normalizeOutreachThroughputTarget(value?: number | null) {
  if (value === undefined || value === null) return MAX_DAILY_OUTREACH_THROUGHPUT
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_DAILY_OUTREACH_THROUGHPUT, Math.max(0, Math.floor(value)))
}

export function outreachThroughputStageForSample(sampleSize: number): OutreachThroughputStage {
  const sample = normalizeCount(sampleSize)
  if (sample >= 1_500) return 'full_1000'
  if (sample >= 500) return 'prove_500'
  if (sample >= 200) return 'prove_250'
  if (sample >= 50) return 'prove_100'
  if (sample >= 20) return 'prove_25'
  return 'recovery'
}

export function downshiftOutreachThroughputStage(
  stage: OutreachThroughputStage,
  steps = 1
): OutreachThroughputStage {
  const currentIndex = OUTREACH_THROUGHPUT_STAGES.indexOf(stage)
  const safeSteps = normalizeCount(steps)
  return OUTREACH_THROUGHPUT_STAGES[Math.max(0, currentIndex - safeSteps)]
}

function lowerStage(
  current: OutreachThroughputStage,
  ceiling: OutreachThroughputStage
): OutreachThroughputStage {
  const currentIndex = OUTREACH_THROUGHPUT_STAGES.indexOf(current)
  const ceilingIndex = OUTREACH_THROUGHPUT_STAGES.indexOf(ceiling)
  return OUTREACH_THROUGHPUT_STAGES[Math.min(currentIndex, ceilingIndex)]
}

function allocateRecoveryCanaryOutput(target: number, now?: Date): DailyStrategyOutputPlan {
  const plan = allocateDailyStrategyOutput(target, now)
  const allocations = plan.allocations.map((lane) => ({
    ...lane,
    target: lane.key === 'lenders' ? target : 0,
  }))
  const byKey = Object.fromEntries(
    allocations.map((allocation) => [allocation.key, allocation.target])
  ) as DailyStrategyOutputPlan['byKey']

  return {
    ...plan,
    baseAllocation: 0,
    remainder: target,
    allocations,
    byKey,
    groupTotals: totalDailyStrategyOutputByGroup(allocations),
  }
}

/**
 * Converts delivery evidence into a conservative daily send ceiling, then
 * distributes normal throughput evenly across every canonical strategy lane.
 * An explicitly requested recovery canary reserves its five-message allowance
 * for the verified lender path. This function is intentionally side-effect
 * free so every sender can use the same decision before an atomic database
 * reservation.
 */
export function evaluateOutreachThroughputGovernor(
  input: OutreachThroughputGovernorInput
): OutreachThroughputGovernorDecision {
  const requestedDailyTarget = normalizeOutreachThroughputTarget(input.requestedDailyTarget)
  const sampleSize = normalizeCount(input.sampleSize)
  const complained = normalizeCount(input.complained)
  const badRate = normalizeRate(input.badRate)
  const globalFailureRate = normalizeRate(input.globalFailureRate)
  const terminalCompleteness = input.terminalCompleteness == null
    ? null
    : normalizeRate(input.terminalCompleteness)
  const explicitRecoveryCanary = input.mode === 'recovery_canary'
  const reasons: string[] = []

  let stage: OutreachThroughputStage

  if (input.mode === 'blocked' || input.mode === 'unavailable') {
    stage = 'hold'
    reasons.push(`delivery_mode_${input.mode}`)
  } else if (input.mode === 'controlled_trial' || input.mode === 'recovery_canary') {
    stage = 'recovery'
    reasons.push(`delivery_mode_${input.mode}`)
  } else {
    stage = outreachThroughputStageForSample(sampleSize)
    reasons.push(
      stage === 'recovery'
        ? `healthy_but_terminal_sample_below_20:${sampleSize}`
        : `healthy_terminal_sample:${sampleSize}`
    )
  }

  if (complained > 0) {
    stage = 'hold'
    reasons.push(`complaint_evidence:${complained}`)
  } else if (badRate > 0.05) {
    if (explicitRecoveryCanary) {
      reasons.push(`combined_bad_rate_above_5_percent_recovery_cap:${badRate.toFixed(4)}`)
    } else {
      stage = 'hold'
      reasons.push(`combined_bad_rate_above_5_percent:${badRate.toFixed(4)}`)
    }
  } else if (badRate > 0.02) {
    stage = lowerStage(stage, 'recovery')
    reasons.push(`combined_bad_rate_above_2_percent:${badRate.toFixed(4)}`)
  }

  if (globalFailureRate > 0.2) {
    stage = 'hold'
    reasons.push(`provider_failure_rate_above_20_percent:${globalFailureRate.toFixed(4)}`)
  } else if (globalFailureRate > 0.05) {
    if (explicitRecoveryCanary) {
      reasons.push(`provider_failure_rate_above_5_percent_recovery_cap:${globalFailureRate.toFixed(4)}`)
    } else {
      stage = downshiftOutreachThroughputStage(stage)
      reasons.push(`provider_failure_rate_above_5_percent_downshift:${globalFailureRate.toFixed(4)}`)
    }
  }

  if (terminalCompleteness !== null && terminalCompleteness < 0.95) {
    if (explicitRecoveryCanary) {
      reasons.push(`terminal_completeness_below_95_percent_recovery_cap:${terminalCompleteness.toFixed(4)}`)
    } else {
      stage = downshiftOutreachThroughputStage(stage)
      reasons.push(`terminal_completeness_below_95_percent_downshift:${terminalCompleteness.toFixed(4)}`)
    }
  }

  if (requestedDailyTarget === 0) {
    stage = 'hold'
    reasons.push('requested_daily_target_zero')
  }

  const stageCap = OUTREACH_THROUGHPUT_STAGE_CAPS[stage]
  const effectiveDailyCap = Math.min(requestedDailyTarget, stageCap)
  const allocationPlan = explicitRecoveryCanary && stage === 'recovery'
    ? allocateRecoveryCanaryOutput(effectiveDailyCap, input.now)
    : allocateDailyStrategyOutput(effectiveDailyCap, input.now)

  return {
    stage,
    stageCap,
    requestedDailyTarget,
    effectiveDailyCap,
    reason: reasons.join('; '),
    allocationPlan,
  }
}
