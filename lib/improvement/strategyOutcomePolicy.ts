export type StrategyOutcomeState = 'active' | 'cooling' | 'exhausted' | 'blocked' | 'paused'

export type StrategyOutcomeMetrics = {
  sent: number
  delivered: number
  replied: number
  bounced: number
}

export type StrategyOutcomeDecision = {
  status: StrategyOutcomeState
  priorityScore: number
  nextRunAt: string | null
  action: 'hold' | 'promote' | 'maintain' | 'cool'
  reason: string
  metrics: StrategyOutcomeMetrics & {
    sampleSize: number
    replyRate: number
    bounceRate: number
    observedAt: string
  }
}

const MINIMUM_SAMPLE = 3

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function futureIso(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Turns attributed, provider-backed outreach outcomes into bounded source
 * scheduling guidance. It deliberately never unpauses blocked/exhausted lanes,
 * changes a sending cap, or treats a draft as a delivery outcome.
 */
export function decideStrategyOutcome(input: {
  currentStatus: StrategyOutcomeState
  currentPriorityScore: number
  currentNextRunAt: string | null
  metrics: StrategyOutcomeMetrics
  now?: Date
}): StrategyOutcomeDecision {
  const now = input.now || new Date()
  const sent = Math.max(0, Math.floor(input.metrics.sent || 0))
  const delivered = Math.max(0, Math.floor(input.metrics.delivered || 0))
  const replied = Math.max(0, Math.floor(input.metrics.replied || 0))
  const bounced = Math.max(0, Math.floor(input.metrics.bounced || 0))
  const replyRate = ratio(replied, sent)
  const bounceRate = ratio(bounced, sent)
  const metrics = {
    sent,
    delivered,
    replied,
    bounced,
    sampleSize: sent,
    replyRate,
    bounceRate,
    observedAt: now.toISOString(),
  }

  if (['paused', 'blocked', 'exhausted'].includes(input.currentStatus)) {
    return {
      status: input.currentStatus,
      priorityScore: input.currentPriorityScore,
      nextRunAt: input.currentNextRunAt,
      action: 'hold',
      reason: `Lane remains ${input.currentStatus}; outcome learning cannot reactivate it.`,
      metrics,
    }
  }

  if (sent < MINIMUM_SAMPLE) {
    return {
      status: input.currentStatus,
      priorityScore: input.currentPriorityScore,
      nextRunAt: input.currentNextRunAt,
      action: 'hold',
      reason: `Only ${sent} attributed send${sent === 1 ? '' : 's'} in the observation window; minimum sample is ${MINIMUM_SAMPLE}.`,
      metrics,
    }
  }

  if (bounceRate >= 0.2) {
    return {
      status: 'cooling',
      priorityScore: clamp(input.currentPriorityScore - 16, -100, 100),
      nextRunAt: futureIso(now, 21),
      action: 'cool',
      reason: `Bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds the 20% safeguard.`,
      metrics,
    }
  }

  if (replyRate >= 0.1 && bounceRate <= 0.1) {
    return {
      status: 'active',
      priorityScore: clamp(input.currentPriorityScore + 12, -100, 100),
      nextRunAt: futureIso(now, 4),
      action: 'promote',
      reason: `Reply rate ${(replyRate * 100).toFixed(1)}% with acceptable bounce evidence earns an earlier revisit.`,
      metrics,
    }
  }

  if (replyRate >= 0.04 && bounceRate <= 0.15) {
    return {
      status: 'active',
      priorityScore: clamp(input.currentPriorityScore + 4, -100, 100),
      nextRunAt: futureIso(now, 7),
      action: 'maintain',
      reason: `Reply rate ${(replyRate * 100).toFixed(1)}% is promising but not yet a promotion-level result.`,
      metrics,
    }
  }

  return {
    status: 'cooling',
    priorityScore: clamp(input.currentPriorityScore - 5, -100, 100),
    nextRunAt: futureIso(now, 14),
    action: 'cool',
    reason: `No reliable positive outcome emerged from ${sent} attributed send${sent === 1 ? '' : 's'}; reduce near-term allocation.`,
    metrics,
  }
}
