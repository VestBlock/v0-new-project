import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { decideStrategyOutcome, type StrategyOutcomeMetrics, type StrategyOutcomeState } from './strategyOutcomePolicy'

type Window = {
  startedAt: string
  endedAt: string
}

type MembershipRow = {
  lead_id: string
  strategy_key: string
  market: string | null
  source_provider: string
  status: string
  last_outcome_at: string | null
}

type SendEventRow = {
  lead_id: string | null
  status: string
  created_at: string
}

type MarketStateRow = {
  id: string
  strategy_key: string
  market: string
  source_provider: string
  status: StrategyOutcomeState
  priority_score: number | string
  next_run_at: string | null
  metrics_json: Record<string, unknown> | null
}

type OutcomeAccumulator = StrategyOutcomeMetrics & {
  latestProviderAcceptAt: string | null
  latestReplyAt: string | null
}

type LeadEventOutcome = {
  sent: boolean
  delivered: boolean
  replied: boolean
  bounced: boolean
  latestProviderAcceptAt: string | null
  latestReplyAt: string | null
}

export type StrategyOutcomeLearningResult = {
  window: Window
  reviewedLanes: number
  learnedLanes: number
  promoted: number
  cooled: number
  held: number
  totals: StrategyOutcomeMetrics
  decisions: Array<{
    strategyKey: string
    market: string
    sourceProvider: string
    action: 'hold' | 'promote' | 'maintain' | 'cool'
    reason: string
    sent: number
    replied: number
    bounced: number
  }>
}

const SEND_EVIDENCE_STATUSES = new Set(['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
const DELIVERED_STATUSES = new Set(['delivered', 'opened', 'clicked', 'replied'])
const BOUNCE_STATUSES = new Set(['bounced', 'complained', 'failed'])

function stateKey(strategyKey: string, market: string, provider: string) {
  return `${strategyKey}::${market.trim().toLowerCase()}::${provider.trim().toLowerCase()}`
}

function latest(previous: string | null, candidate: string | null) {
  if (!candidate) return previous
  if (!previous) return candidate
  return Date.parse(candidate) > Date.parse(previous) ? candidate : previous
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

async function loadMembershipsForLeads(leadIds: string[]) {
  if (!leadIds.length) return [] as MembershipRow[]
  const admin = createAdminClient()
  const rows: MembershipRow[] = []
  for (const ids of chunk(leadIds, 500)) {
    const { data, error } = await admin
      .from('strategy_lead_memberships')
      .select('lead_id,strategy_key,market,source_provider,status,last_outcome_at')
      .in('lead_id', ids)
    if (error) throw error
    rows.push(...((data || []) as MembershipRow[]))
  }
  return rows
}

async function loadRecentReplyMemberships(window: Window) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_lead_memberships')
    .select('lead_id,strategy_key,market,source_provider,status,last_outcome_at')
    .eq('status', 'replied')
    .gte('last_outcome_at', window.startedAt)
    .lte('last_outcome_at', window.endedAt)
    .limit(5_000)
  if (error) throw error
  return (data || []) as MembershipRow[]
}

/**
 * Reallocates only lane scheduling priority from attributed outcomes. It never
 * sends outreach, changes an approval state, or reactivates paused/blocked
 * lanes. The daily improvement review calls this after reply sync has had time
 * to persist its delivery evidence.
 */
export async function runStrategyOutcomeLearning(input: { window: Window; dryRun?: boolean }) {
  const admin = createAdminClient()
  const [{ data: sendEvents, error: sendError }, { data: states, error: stateError }] = await Promise.all([
    admin
      .from('outreach_send_events')
      .select('lead_id,status,created_at')
      .gte('created_at', input.window.startedAt)
      .lte('created_at', input.window.endedAt)
      .not('lead_id', 'is', null),
    admin
      .from('strategy_market_state')
      .select('id,strategy_key,market,source_provider,status,priority_score,next_run_at,metrics_json')
      .limit(5_000),
  ])
  if (sendError) throw sendError
  if (stateError) throw stateError

  const events = (sendEvents || []) as SendEventRow[]
  const marketStates = (states || []) as MarketStateRow[]
  const [membershipsForEvents, recentReplyMemberships] = await Promise.all([
    loadMembershipsForLeads(Array.from(new Set(events.map((event) => event.lead_id).filter((id): id is string => Boolean(id))))),
    loadRecentReplyMemberships(input.window),
  ])
  const membershipsByLeadId = new Map<string, MembershipRow>()
  for (const membership of [...membershipsForEvents, ...recentReplyMemberships]) {
    membershipsByLeadId.set(membership.lead_id, membership)
  }
  const memberships = Array.from(membershipsByLeadId.values())
  const stateByKey = new Map(marketStates.map((state) => [stateKey(state.strategy_key, state.market, state.source_provider), state]))
  const outcomes = new Map<string, OutcomeAccumulator>()
  const leadEventOutcomes = new Map<string, LeadEventOutcome>()

  for (const event of events) {
    if (!event.lead_id) continue
    const status = String(event.status || '').toLowerCase()
    const current = leadEventOutcomes.get(event.lead_id) || {
      sent: false,
      delivered: false,
      replied: false,
      bounced: false,
      latestProviderAcceptAt: null,
      latestReplyAt: null,
    }
    if (SEND_EVIDENCE_STATUSES.has(status)) {
      current.sent = true
      current.latestProviderAcceptAt = latest(current.latestProviderAcceptAt, event.created_at)
    }
    if (DELIVERED_STATUSES.has(status)) current.delivered = true
    if (status === 'replied') {
      current.replied = true
      current.latestReplyAt = latest(current.latestReplyAt, event.created_at)
    }
    if (BOUNCE_STATUSES.has(status)) current.bounced = true
    leadEventOutcomes.set(event.lead_id, current)
  }

  // Count provider status changes once per recipient, not once per event. This
  // keeps accepted -> delivered -> opened updates from inflating a lane's
  // sample size. Mailbox capture writes the current membership outcome, so it
  // is also applied once when a reply's original send is outside this window.
  for (const membership of memberships) {
    if (!membership.market) continue
    const key = stateKey(membership.strategy_key, membership.market, membership.source_provider)
    if (!stateByKey.has(key)) continue
    const current = outcomes.get(key) || { sent: 0, delivered: 0, replied: 0, bounced: 0, latestProviderAcceptAt: null, latestReplyAt: null }
    const providerOutcome = leadEventOutcomes.get(membership.lead_id)
    if (providerOutcome?.sent) current.sent += 1
    if (providerOutcome?.delivered) current.delivered += 1
    if (providerOutcome?.replied) current.replied += 1
    if (providerOutcome?.bounced) current.bounced += 1
    current.latestProviderAcceptAt = latest(current.latestProviderAcceptAt, providerOutcome?.latestProviderAcceptAt || null)
    current.latestReplyAt = latest(current.latestReplyAt, providerOutcome?.latestReplyAt || null)
    if (String(membership.status).toLowerCase() === 'replied' && !providerOutcome?.replied) {
      current.replied += 1
      current.latestReplyAt = latest(current.latestReplyAt, membership.last_outcome_at)
    }
    outcomes.set(key, current)
  }

  const now = new Date()
  const result: StrategyOutcomeLearningResult = {
    window: input.window,
    reviewedLanes: 0,
    learnedLanes: 0,
    promoted: 0,
    cooled: 0,
    held: 0,
    totals: { sent: 0, delivered: 0, replied: 0, bounced: 0 },
    decisions: [],
  }

  for (const [key, outcome] of outcomes) {
    const state = stateByKey.get(key)
    if (!state) continue
    const decision = decideStrategyOutcome({
      currentStatus: state.status,
      currentPriorityScore: Number(state.priority_score || 0),
      currentNextRunAt: state.next_run_at,
      metrics: outcome,
      now,
    })
    result.reviewedLanes += 1
    result.totals.sent += outcome.sent
    result.totals.delivered += outcome.delivered
    result.totals.replied += outcome.replied
    result.totals.bounced += outcome.bounced
    result.decisions.push({
      strategyKey: state.strategy_key,
      market: state.market,
      sourceProvider: state.source_provider,
      action: decision.action,
      reason: decision.reason,
      sent: outcome.sent,
      replied: outcome.replied,
      bounced: outcome.bounced,
    })
    if (decision.action === 'promote') result.promoted += 1
    if (decision.action === 'cool') result.cooled += 1
    if (decision.action === 'hold') result.held += 1
    if (decision.metrics.sampleSize >= 3) result.learnedLanes += 1

    if (input.dryRun) continue
    const { error } = await admin
      .from('strategy_market_state')
      .update({
        status: decision.status,
        priority_score: decision.priorityScore,
        next_run_at: decision.nextRunAt,
        last_provider_accept_at: outcome.latestProviderAcceptAt || undefined,
        last_reply_at: outcome.latestReplyAt || undefined,
        metrics_json: {
          ...(state.metrics_json || {}),
          outcomeLearning: {
            ...decision.metrics,
            action: decision.action,
            reason: decision.reason,
            window: input.window,
          },
        },
        updated_at: now.toISOString(),
      })
      .eq('id', state.id)
    if (error) throw error
  }

  return result
}
