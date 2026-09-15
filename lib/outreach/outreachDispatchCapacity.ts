import 'server-only'

import type { OutreachThroughputGovernorDecision } from '@/lib/outreach/throughputGovernorCore'
import { createAdminClient } from '@/lib/supabase/admin'

export type OutreachDispatchCapacity = {
  globalAttemptCount: number
  globalRemaining: number
  remainingByLane: Record<string, number>
  leadLaneRemaining: number
  partnerLaneRemaining: number
}

/** Reads the post-run truth used by cron health evaluation. */
export async function readOutreachDispatchCapacity(
  decision: OutreachThroughputGovernorDecision,
  now = new Date()
): Promise<OutreachDispatchCapacity> {
  const admin = createAdminClient()
  const rollingCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString()
  const [{ count: globalCount, error: globalError }, { data: laneRows, error: laneError }] =
    await Promise.all([
      admin
        .from('outreach_attempt_reservations')
        .select('id', { count: 'exact', head: true })
        .neq('state', 'cancelled')
        .gte('reserved_at', rollingCutoff),
      admin
        .from('outreach_attempt_reservations')
        .select('strategy_key')
        .eq('business_date', decision.allocationPlan.businessDate)
        .neq('state', 'cancelled')
        .limit(1_000),
    ])
  if (globalError) throw globalError
  if (laneError) throw laneError

  const usedByLane = new Map<string, number>()
  for (const row of laneRows || []) {
    const key = String(row.strategy_key || '')
    usedByLane.set(key, (usedByLane.get(key) || 0) + 1)
  }

  const remainingByLane: Record<string, number> = {}
  let leadLaneRemaining = 0
  let partnerLaneRemaining = 0
  for (const lane of decision.allocationPlan.allocations) {
    const remaining = Math.max(0, lane.target - (usedByLane.get(lane.key) || 0))
    remainingByLane[lane.key] = remaining
    if (lane.group === 'partner') partnerLaneRemaining += remaining
    else leadLaneRemaining += remaining
  }

  const globalAttemptCount = Math.max(0, globalCount || 0)
  return {
    globalAttemptCount,
    globalRemaining: Math.max(0, decision.effectiveDailyCap - globalAttemptCount),
    remainingByLane,
    leadLaneRemaining,
    partnerLaneRemaining,
  }
}
