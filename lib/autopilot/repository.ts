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
  normalizeStoredStrategy,
  selectStrategyPortfolio,
  strategyTargetKey,
  type StrategyCandidateInput,
  type StrategyEvidence,
  type VestBlockStrategy,
} from './strategyEngine'
import {
  BUSINESS_VERTICALS,
  VERTICAL_REGISTRY,
  type BusinessVertical,
} from './verticalRegistry'

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
  const observedAt = data.generatedAt || now
  const liveQuality = data.liveDataReachable ? 'verified' : 'missing'
  const evidenceByVertical: Record<BusinessVertical, StrategyEvidence[]> = {
    business_capital: [
      { source: 'funding_profiles', metric: 'qualified funding profiles', value: null, observedAt, quality: 'missing', caveat: 'No vertical-specific funding profile aggregate is present in the current Command Center snapshot.' },
    ],
    real_estate_capital: [
      { source: 'funding_recommendations', metric: 'qualified real-estate capital requests', value: null, observedAt, quality: 'missing', caveat: 'No real-estate funding recommendation aggregate is present in the current snapshot.' },
    ],
    capital_partners: [
      { source: 'command_center.summary', metric: 'active capital and opportunity partners', value: data.summary.activePartners, observedAt, quality: liveQuality, caveat: 'The aggregate includes more than lender partners; confirm the capital-partner subset.' },
      { source: 'command_center.routingQueue', metric: 'open lender matches', value: lenderMatches, observedAt, quality: liveQuality, caveat: null },
    ],
    seller_opportunities: [
      { source: 'command_center.summary', metric: 'seller and network reply signals, 7d', value: data.summary.replySignals7d, observedAt, quality: liveQuality, caveat: 'Confirm seller attribution before claiming this entire count.' },
      { source: 'command_center.inbox', metric: 'hot replies', value: hotReplies, observedAt, quality: liveQuality, caveat: null },
    ],
    buyers_investors: [
      { source: 'command_center.routingQueue', metric: 'open buyer matches', value: buyerMatches, observedAt, quality: liveQuality, caveat: null },
      { source: 'command_center.dealPipeline', metric: 'packet-ready opportunities', value: data.dealPipeline.totals.packetReady, observedAt, quality: liveQuality, caveat: null },
    ],
    development_partners: [
      { source: 'command_center.summary', metric: 'builder and development partners', value: data.summary.builderPartners, observedAt, quality: liveQuality, caveat: 'Verify current capacity and credentials before an introduction.' },
    ],
    opportunity_service_partners: [
      { source: 'command_center.summary', metric: 'partner records ready for research', value: data.summary.partnerResearchReady, observedAt, quality: liveQuality, caveat: 'Research-ready does not mean approved or contactable.' },
    ],
    dealvault: [
      { source: 'command_center.dealPipeline', metric: 'active deals that may need records', value: data.dealPipeline.totals.activeDeals, observedAt, quality: data.liveDataReachable ? 'partial' : 'missing', caveat: 'This is a deal-pipeline proxy, not active DealVault usage.' },
    ],
    growth_visibility_services: [
      { source: 'content_assets', metric: 'published assets', value: cockpit.content.published, observedAt, quality: liveQuality, caveat: 'Published does not establish indexation or conversion.' },
      { source: 'search_console', metric: 'measurement readiness', value: cockpit.growth.seo.searchConsole, observedAt, quality: cockpit.growth.seo.searchConsole === 'ready' ? 'verified' : 'partial', caveat: cockpit.growth.seo.searchConsole === 'ready' ? null : 'Search Console is not fully ready.' },
    ],
  }

  const inputs: StrategyCandidateInput[] = BUSINESS_VERTICALS.map((vertical, index) => {
    const definition = VERTICAL_REGISTRY[vertical]
    const evidence = evidenceByVertical[vertical]
    const researchRequired = evidence.every((item) => item.quality === 'missing')
      ? [`Connect a reliable ${definition.kpis[0]} aggregate with source lineage.`, 'Record the current baseline and one attributable outcome before promotion.']
      : evidence.some((item) => item.quality !== 'verified')
        ? ['Verify proxy metrics against the vertical-specific source before launch.']
        : []
    const signalTotal = evidence.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0)
    const confidence = researchRequired ? 28 : evidence.some((item) => item.quality === 'verified') ? 72 : 54

    return {
      name: researchRequired
        ? `Research the ${definition.label.toLowerCase()} baseline`
        : `Advance one measured ${definition.label.toLowerCase()} opportunity`,
      vertical,
      strategyType: researchRequired ? 'research' : vertical.includes('partner') ? 'partner_development' : 'conversion',
      channels: definition.channelMix,
      hypothesis: researchRequired
        ? `A trustworthy baseline is required before VestBlock can choose a ${definition.label.toLowerCase()} growth strategy.`
        : `Working the strongest current ${definition.label.toLowerCase()} signal with a human-reviewed next step will create better evidence than increasing unqualified volume.`,
      targetAudience: definition.icp,
      problem: researchRequired
        ? `The current operating snapshot does not contain a reliable vertical-specific baseline for ${definition.label.toLowerCase()}.`
        : `${evidence.map((item) => `${item.metric}: ${String(item.value)}`).join('; ')}.`,
      tactic: researchRequired
        ? 'Create a read-only research task that identifies the system of record, metric owner, source lineage, baseline, and evaluation window.'
        : `Review the strongest evidence, apply the vertical qualifications and disqualifiers, then prepare one operator-approved ${definition.primaryCta.toLowerCase()} action.`,
      channel: definition.channelMix.join(', '),
      expectedOutcome: researchRequired
        ? 'A verified baseline and a decision about whether this vertical should enter the active portfolio.'
        : `One attributable ${definition.kpis[0]} outcome without granting launch authority.`,
      primaryKpi: definition.kpis[0],
      secondaryKpis: definition.kpis.slice(1),
      cost: 'Operator review using existing data; $0 media spend',
      risk: vertical === 'seller_opportunities' || vertical.includes('capital') ? 'medium' : 'low',
      confidence,
      evidence,
      evidenceState: researchRequired ? 'research_required' : evidence.some((item) => item.quality === 'verified') ? 'sufficient' : 'partial',
      researchRequired,
      outreachAngles: definition.outreachAngles,
      implementationActions: researchRequired
        ? researchRequired
        : ['Verify evidence and source lineage.', 'Select one qualified record for human review.', 'Prepare the next action as a draft.', 'Record disposition and attributable outcome.'],
      costBoundary: definition.costBoundaries.join(' '),
      attributionKeys: ['strategy_id', 'vertical', 'source_record_id', 'campaign_run_id', 'outcome_id'],
      evaluationWindowDays: vertical === 'growth_visibility_services' ? 30 : 14,
      killCriteria: definition.killCriteria,
      score: {
        expectedImpact: Math.min(88, 58 + Math.min(20, signalTotal) + (index % 3)),
        confidence,
        cost: researchRequired ? 8 : 15,
        timeToResult: researchRequired ? 72 : 70,
        executionDifficulty: researchRequired ? 25 : 38,
        risk: vertical === 'seller_opportunities' || vertical.includes('capital') ? 42 : 24,
      },
    }
  })

  return selectStrategyPortfolio(inputs.map((input) => createStrategyObject(input, now)))
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

  const strategy = normalizeStoredStrategy(update.proposed_change_json)
  if (!strategy) throw new Error('Strategy schema is invalid.')
  if (strategy.evidenceState === 'research_required') {
    throw new Error('Complete the research task before building a campaign.')
  }
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
      cost_guardrail_status: 'approval_required',
      metadata_json: {
        strategyUpdateId: update.id,
        vertical: strategy.vertical,
        channel: strategy.channel,
        channels: strategy.channels,
        strategyType: strategy.strategyType,
        portfolioRole: strategy.portfolioRole,
        evidenceState: strategy.evidenceState,
        primaryKpi: strategy.primaryKpi,
        expectedOutcome: strategy.expectedOutcome,
        actorUserId,
        approval: strategy.approval,
        costBoundary: strategy.implementation.costBoundary,
        attributionKeys: strategy.measurement.attributionKeys,
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
  const strategy = normalizeStoredStrategy(update.proposed_change_json)
  if (!strategy) throw new Error('Strategy schema is invalid.')
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
