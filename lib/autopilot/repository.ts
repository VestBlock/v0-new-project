import 'server-only'

import type { CommandCenterData } from '@/lib/admin/commandCenter'
import {
  getStrategyUpdate,
  insertStrategyUpdates,
  updateStrategyUpdate,
  upsertExperimentResults,
} from '@/lib/improvement/repository'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AutopilotCockpitSnapshot } from './cockpit'
import {
  createStrategyObject,
  strategyTargetKey,
  type StrategyCandidateInput,
  type VestBlockStrategy,
} from './strategyEngine'

function weekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function buildWeeklyStrategyCandidates(
  data: CommandCenterData,
  cockpit: AutopilotCockpitSnapshot,
  now = new Date().toISOString()
) {
  const hotReplies =
    data.inbox.sections.find((section) => section.key === 'hot_replies')?.items.length || 0
  const buyerMatches =
    data.routingQueue.find((item) => item.label === 'Buyer matches open')?.count || 0
  const lenderMatches =
    data.routingQueue.find((item) => item.label === 'Lender matches open')?.count || 0

  const inputs: StrategyCandidateInput[] = [
    {
      name: 'Work active replies before adding outreach volume',
      vertical: 'email_outreach',
      hypothesis:
        'Routing current reply signals and overdue follow-ups before increasing send volume will improve opportunity quality and reduce avoidable follow-up loss.',
      targetAudience: 'Current seller, buyer, lender, and partner conversations',
      problem: `${hotReplies} hot replies and ${data.summary.replySignals7d} reply signals are visible while ${data.overdueTasks.length} operator tasks are overdue.`,
      tactic: 'Prioritize correlated positive replies, assign a human next step, and clear due follow-ups before starting a new volume batch.',
      channel: 'email and Command Center inbox',
      expectedOutcome: 'More qualified conversations move into Deals, Capital, or Partners without increasing send risk.',
      primaryKpi: 'qualified replies moved to an opportunity',
      secondaryKpis: ['reply-to-task time', 'follow-ups completed', 'suppression compliance'],
      cost: 'Existing team time; no new media spend',
      risk: 'low',
      confidence: 78,
      evidence: [
        `${data.summary.replySignals7d} reply signals in the current seven-day window`,
        `${hotReplies} hot replies visible now`,
        `${data.overdueTasks.length} overdue operator tasks`,
      ],
      score: {
        expectedImpact: 82,
        confidence: 78,
        cost: 12,
        timeToResult: 92,
        executionDifficulty: 22,
        risk: 14,
      },
    },
    {
      name: 'Convert ready deal evidence into matched conversations',
      vertical: 'real_estate_buyers',
      hypothesis:
        'Working packet-ready deals and open buyer/lender matches before sourcing more properties will move money closer with less operational waste.',
      targetAudience: 'Confirmed buyers, lenders, and active property opportunities',
      problem: `${data.dealPipeline.totals.packetReady} packets are ready with ${buyerMatches} buyer matches and ${lenderMatches} lender matches open.`,
      tactic: 'Complete missing evidence, approve the strongest matches, and record every introduction against the source opportunity.',
      channel: 'Deal pipeline and partner outreach',
      expectedOutcome: 'More packet-ready opportunities reach engaged, underwriting, contract, or funded stages.',
      primaryKpi: 'matched opportunities reaching engaged status',
      secondaryKpis: ['packets sent', 'buyer replies', 'lender replies', 'attributed revenue'],
      cost: 'Existing data and operator time',
      risk: 'medium',
      confidence: 70,
      evidence: [
        `${data.dealPipeline.totals.activeDeals} active deals`,
        `${data.dealPipeline.totals.packetReady} packet-ready deals`,
        `${buyerMatches} open buyer matches and ${lenderMatches} open lender matches`,
      ],
      score: {
        expectedImpact: 88,
        confidence: 70,
        cost: 18,
        timeToResult: 78,
        executionDifficulty: 42,
        risk: 35,
      },
    },
    {
      name: 'Refresh measurable content before creating another page family',
      vertical: 'seo',
      hypothesis:
        'Refreshing existing assets with known indexing or conversion gaps will produce better evidence than adding another large unmeasured page family.',
      targetAudience: 'Searchers evaluating VestBlock funding, deal, and partner resources',
      problem: `${cockpit.content.published} assets are published and ${cockpit.content.refreshNeeded} are explicitly marked for refresh.`,
      tactic: 'Prioritize refresh-needed assets, improve one title/meta/internal-link package, and measure impressions, clicks, CTR, and qualified actions.',
      channel: 'SEO and AEO',
      expectedOutcome: 'Higher qualified discovery from existing useful pages without thin programmatic expansion.',
      primaryKpi: 'qualified organic actions per refreshed page',
      secondaryKpis: ['indexed pages', 'impressions', 'CTR', 'internal-link coverage'],
      cost: 'Existing content and Codex review time',
      risk: 'low',
      confidence: cockpit.growth.seo.searchConsole === 'ready' ? 76 : 58,
      evidence: [
        `${cockpit.content.published} published content assets`,
        `${cockpit.content.refreshNeeded} assets marked refresh needed`,
        `Search Console connection is ${cockpit.growth.seo.searchConsole}`,
      ],
      score: {
        expectedImpact: 68,
        confidence: cockpit.growth.seo.searchConsole === 'ready' ? 76 : 58,
        cost: 20,
        timeToResult: 55,
        executionDifficulty: 32,
        risk: 18,
      },
    },
  ]

  return inputs.map((input) => createStrategyObject(input, now))
}

export async function createVestBlockStrategies(
  strategies: VestBlockStrategy[],
  options: { actorUserId?: string | null; dedupeWeek?: string } = {}
) {
  const key = options.dedupeWeek || weekKey()
  const admin = createAdminClient()
  const targets = strategies.map((strategy) => strategyTargetKey(strategy, key))
  const { data: existing, error } = await admin
    .from('strategy_updates')
    .select('target_key')
    .eq('target_type', 'vestblock_strategy')
    .in('target_key', targets)
  if (error) throw error

  const existingKeys = new Set((existing || []).map((row) => String(row.target_key)))
  const fresh = strategies
    .map((strategy) => ({ strategy, targetKey: strategyTargetKey(strategy, key) }))
    .filter((item) => !existingKeys.has(item.targetKey))

  return insertStrategyUpdates(
    fresh.map(({ strategy, targetKey }) => ({
      category: 'autopilot_strategy',
      targetType: 'vestblock_strategy',
      targetKey,
      riskLevel: strategy.risk,
      approvalStatus: 'queued',
      title: strategy.name,
      rationale: strategy.hypothesis,
      proposedChange: strategy as unknown as Record<string, unknown>,
      requiresAdminReview: true,
      approvedByUserId: options.actorUserId || null,
    }))
  )
}

export async function createCampaignFromStrategy(strategyId: string, actorUserId: string) {
  const update = await getStrategyUpdate(strategyId)
  if (update.target_type !== 'vestblock_strategy') throw new Error('Strategy is not an Autopilot strategy.')
  if (!['approved', 'auto_applied'].includes(update.approval_status)) {
    throw new Error('Approve the strategy before building a campaign.')
  }

  const strategy = update.proposed_change_json as unknown as VestBlockStrategy
  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('command_center_strategy_runs')
    .select('*')
    .eq('strategy_key', update.target_key)
    .eq('status', 'planned')
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing

  const { data, error } = await admin
    .from('command_center_strategy_runs')
    .insert({
      strategy_key: update.target_key,
      strategy_name: strategy.name || update.title,
      status: 'planned',
      source_provider: 'vestblock',
      cost_guardrail_status: strategy.risk === 'high' ? 'approval_required' : 'allowed',
      metadata_json: {
        strategyUpdateId: update.id,
        vertical: strategy.vertical,
        channel: strategy.channel,
        primaryKpi: strategy.primaryKpi,
        expectedOutcome: strategy.expectedOutcome,
        actorUserId,
        launchAuthority: 'not_granted',
      },
    })
    .select('*')
    .single()
  if (error) throw error

  await updateStrategyUpdate(strategyId, {
    applied_change_json: {
      campaignRunId: data.id,
      campaignStatus: 'planned',
      launchAuthority: 'not_granted',
    },
    applied_at: new Date().toISOString(),
  })
  return data
}

export async function recordStrategyResult(input: {
  strategyId: string
  campaignRunId?: string | null
  leads: number
  replies: number
  opportunities: number
  conversions: number
  revenue: number
  lesson: string
  nextIteration: string
}) {
  const update = await getStrategyUpdate(input.strategyId)
  if (update.target_type !== 'vestblock_strategy') throw new Error('Strategy is not an Autopilot strategy.')
  const strategy = update.proposed_change_json as unknown as VestBlockStrategy
  const now = new Date().toISOString()
  const result = `${input.leads} leads, ${input.replies} replies, ${input.opportunities} opportunities, ${input.conversions} conversions, $${input.revenue.toFixed(2)} revenue.`
  const measured: VestBlockStrategy = {
    ...strategy,
    status: 'measured',
    result,
    lesson: input.lesson,
    nextIteration: input.nextIteration,
  }

  const [experiment] = await upsertExperimentResults([
    {
      experimentKey: `strategy-${update.target_key}-${Date.now()}`,
      category: 'strategy_revenue_attribution',
      variantKey: update.target_key,
      metrics: {
        strategyId: update.id,
        campaignRunId: input.campaignRunId || null,
        leads: input.leads,
        replies: input.replies,
        opportunities: input.opportunities,
        conversions: input.conversions,
        revenue: input.revenue,
        measuredAt: now,
      },
      winner: input.conversions > 0 || input.revenue > 0,
      notes: input.lesson,
    },
  ])

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_updates')
    .update({
      proposed_change_json: measured,
      applied_change_json: {
        ...(update.applied_change_json || {}),
        experimentResultId: experiment.id,
        campaignRunId: input.campaignRunId || update.applied_change_json?.campaignRunId || null,
        result,
        lesson: input.lesson,
        nextIteration: input.nextIteration,
      },
      updated_at: now,
    })
    .eq('id', update.id)
    .select('*')
    .single()
  if (error) throw error
  return { strategy: data, experiment }
}
