import {
  DAILY_STRATEGY_OUTPUT_LANES,
  totalDailyStrategyOutputByGroup,
  type DailyStrategyOutputPlan,
} from '@/lib/outreach/dailyStrategyOutputCore'
import {
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  allocateOutlookColdLaneCaps,
  type OutlookColdBudgetInspection,
} from '@/lib/outreach/outlookColdBudgetCore'
import type { OutreachThroughputGovernorDecision } from '@/lib/outreach/throughputGovernorCore'

export type OutreachDispatchCapacity = {
  globalAttemptCount: number
  globalRemaining: number
  remainingByLane: Record<string, number>
  leadLaneRemaining: number
  partnerLaneRemaining: number
}

const LEAD_OUTLOOK_LANE_KEYS = new Set<string>(
  DAILY_STRATEGY_OUTPUT_LANES
    .filter((lane) => lane.group === 'business' || lane.key === 'listing_agents')
    .map((lane) => lane.key)
)

function count(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/** Builds a canonical plan whose lane allocations exactly equal the guarded Outlook cap. */
export function buildOutlookDispatchAllocationPlan(
  now = new Date(),
  enabled = true
): DailyStrategyOutputPlan {
  const outlookAllocation = allocateOutlookColdLaneCaps(now)
  const target = enabled ? OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP : 0
  const allocations = DAILY_STRATEGY_OUTPUT_LANES.map((lane) => ({
    ...lane,
    target: enabled
      ? count(outlookAllocation.laneCaps[lane.key as keyof typeof outlookAllocation.laneCaps] || 0)
      : 0,
  }))
  const byKey = Object.fromEntries(
    allocations.map((allocation) => [allocation.key, allocation.target])
  ) as DailyStrategyOutputPlan['byKey']

  return {
    businessDate: outlookAllocation.businessDate,
    target,
    laneCount: DAILY_STRATEGY_OUTPUT_LANES.length,
    baseAllocation: Math.floor(target / DAILY_STRATEGY_OUTPUT_LANES.length),
    remainder: target % DAILY_STRATEGY_OUTPUT_LANES.length,
    rotationOffset: outlookAllocation.rotationOffset,
    allocations,
    byKey,
    groupTotals: totalDailyStrategyOutputByGroup(allocations),
  }
}

/**
 * Converts the authoritative Outlook rolling budget into cron health capacity,
 * intersected with the active throughput decision when one is supplied.
 */
export function deriveOutreachDispatchCapacity(
  inspection: OutlookColdBudgetInspection,
  decision?: Pick<OutreachThroughputGovernorDecision, 'effectiveDailyCap' | 'allocationPlan'> | null
): OutreachDispatchCapacity {
  const remainingByLane: Record<string, number> = {}
  let leadLaneRemaining = 0
  let partnerLaneRemaining = 0
  const decisionMatchesBusinessDate =
    !decision || decision.allocationPlan.businessDate === inspection.businessDate

  for (const [strategyKey, laneCap] of Object.entries(inspection.laneCaps)) {
    const laneAttemptCount = count(
      inspection.laneAttemptCounts[strategyKey as keyof typeof inspection.laneAttemptCounts]
    )
    const authoritativeRemaining = Math.max(0, count(laneCap) - laneAttemptCount)
    const decisionRemaining = decision && decisionMatchesBusinessDate
      ? Math.max(
          0,
          count(
            decision.allocationPlan.byKey[
              strategyKey as keyof typeof decision.allocationPlan.byKey
            ]
          ) - laneAttemptCount
        )
      : decision
        ? 0
        : authoritativeRemaining
    const remaining = inspection.valid
      ? Math.min(authoritativeRemaining, decisionRemaining)
      : 0
    remainingByLane[strategyKey] = remaining
    if (LEAD_OUTLOOK_LANE_KEYS.has(strategyKey)) leadLaneRemaining += remaining
    else partnerLaneRemaining += remaining
  }

  const authoritativeGlobalRemaining = inspection.valid ? count(inspection.remaining) : 0
  const decisionGlobalRemaining = decision && decisionMatchesBusinessDate
    ? Math.max(0, count(decision.effectiveDailyCap) - count(inspection.attemptCount))
    : decision
      ? 0
      : authoritativeGlobalRemaining

  return {
    globalAttemptCount: count(inspection.attemptCount),
    globalRemaining: Math.min(authoritativeGlobalRemaining, decisionGlobalRemaining),
    remainingByLane,
    leadLaneRemaining,
    partnerLaneRemaining,
  }
}

/**
 * Bounds one lead-provider invocation without redefining the rolling daily
 * budget. The later database reservation remains authoritative under races.
 */
export function resolveLeadOutlookSendLimit(input: {
  requestedSendLimit: number
  capacity: Pick<OutreachDispatchCapacity, 'globalRemaining' | 'leadLaneRemaining'>
}) {
  return Math.min(
    count(input.requestedSendLimit),
    OUTLOOK_COLD_B2B_INVOCATION_CAP,
    count(input.capacity.globalRemaining),
    count(input.capacity.leadLaneRemaining)
  )
}
