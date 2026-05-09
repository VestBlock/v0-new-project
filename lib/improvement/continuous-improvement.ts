import { addDays, formatISO } from 'date-fns'

import { sendEmail } from '@/lib/email/sendEmail'
import {
  createImprovementRun,
  finishImprovementRun,
  getStrategyUpdate,
  insertImprovementInsights,
  insertMarketSnapshots,
  insertMethodSnapshots,
  insertResearchBriefs,
  insertStrategyUpdates,
  listActiveOutreachVariants,
  listActiveScoreAdjustments,
  updateStrategyUpdate,
  upsertDailyOperatorReport,
  upsertExperimentResults,
  upsertOutreachVariants,
  upsertPromptVersions,
  upsertScoreAdjustments,
} from '@/lib/improvement/repository'
import { buildResearchBriefsFromSources } from '@/lib/improvement/research'
import type {
  ContinuousImprovementSummary,
  ImprovementRunRecord,
  ImprovementRunType,
  StrategyUpdateRecord,
} from '@/lib/improvement/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

type DailyWindow = {
  startedAt: string
  endedAt: string
}

type DailyReviewResult = {
  run: ImprovementRunRecord
  summary: ContinuousImprovementSummary
  autoAppliedCount: number
  queuedCount: number
}

type OptimizationResult = {
  run: ImprovementRunRecord
  created: number
  autoApplied: number
}

type DailySnapshot = {
  window: DailyWindow
  signals: Awaited<ReturnType<typeof fetchDailySignals>>
  summary: ContinuousImprovementSummary
}

function makeWindow(daysBack = 1): DailyWindow {
  const endedAt = new Date()
  const startedAt = addDays(endedAt, -daysBack)
  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  }
}

function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0
  return numerator / denominator
}

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[]
}

function asDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function htmlList(items: string[]) {
  return items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
}

function buildDailyReportHtml(summary: ContinuousImprovementSummary) {
  return `
    <div style="font-family:Arial,sans-serif;background:#071018;color:#eef7fb;padding:24px;">
      <h2 style="margin:0 0 12px;color:#fff;">VestBlock daily improvement report</h2>
      <p style="margin:0 0 18px;color:#a7c0c7;">
        Best city: <strong>${summary.bestCity || 'n/a'}</strong> ·
        Best niche: <strong>${summary.bestNiche || 'n/a'}</strong> ·
        Best offer: <strong>${summary.bestOffer || 'n/a'}</strong>
      </p>
      <h3 style="margin:18px 0 8px;color:#fff;">Top wins</h3>
      <ul>${htmlList(summary.topWins)}</ul>
      <h3 style="margin:18px 0 8px;color:#fff;">Biggest losses</h3>
      <ul>${htmlList(summary.biggestLosses)}</ul>
      <h3 style="margin:18px 0 8px;color:#fff;">Recommended operator actions</h3>
      <ul>${htmlList(summary.recommendedActions)}</ul>
    </div>
  `
}

async function sendImprovementDigest(summary: ContinuousImprovementSummary) {
  if (!process.env.ADMIN_ALERT_EMAIL) return
  await sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL,
    subject: `VestBlock daily improvement report: ${summary.bestCity || 'operations'} lead`,
    html: buildDailyReportHtml(summary),
    eventType: 'admin_lead_run_daily_report',
  }).catch(() => null)
}

async function fetchDailySignals(window: DailyWindow) {
  const admin = createAdminClient()

  const [
    leadsResult,
    sendEventsResult,
    contentResult,
    marketsResult,
    tasksResult,
    disputeLettersResult,
    fundingProfilesResult,
    fundingRecommendationsResult,
    fundingSequenceResult,
    serviceDeliverablesResult,
    researchBriefsResult,
    outreachMessagesResult,
  ] = await Promise.all([
    admin
      .from('leads')
      .select(
        'id,city,state,niche,best_offer,outreach_angle,lead_score,status,delivery_status,language_segment,category,target_market_id,created_at,updated_at'
      )
      .gte('created_at', window.startedAt),
    admin
      .from('outreach_send_events')
      .select('id,lead_id,channel,status,created_at,metadata_json')
      .gte('created_at', window.startedAt),
    admin
      .from('content_assets')
      .select('id,slug,title,status,service_key,language,publish_path,published_at,indexed_status,priority_score')
      .or(`published_at.gte.${window.startedAt},updated_at.gte.${window.startedAt}`),
    admin
      .from('target_markets')
      .select('id,city,state,niche_focus,status,final_score,performance_json,last_scraped_at')
      .limit(200),
    admin
      .from('admin_tasks')
      .select('id,task_type,status,priority,due_at,created_at')
      .limit(500),
    admin
      .from('dispute_letters')
      .select('id,letter_type,status,created_at,mailed_at,response_received_at,secondary_bureau_reminder_sent_at')
      .or(`created_at.gte.${window.startedAt},updated_at.gte.${window.startedAt}`),
    admin.from('funding_profiles').select('id,mode,readiness_score,created_at').gte('created_at', window.startedAt),
    admin
      .from('funding_recommendations')
      .select('id,mode,recommended_path,readiness_score,created_at')
      .gte('created_at', window.startedAt),
    admin
      .from('funding_sequence_items')
      .select('id,status,recommendation_id,user_id,approved_limit,updated_at,created_at')
      .gte('updated_at', window.startedAt),
    admin
      .from('service_deliverables')
      .select('id,package_key,status,generated_at,customer_sent_at,customer_viewed_at,customer_response_status,customer_upgraded_at')
      .limit(500),
    admin.from('research_briefs').select('id,theme,status,priority,created_at').gte('created_at', window.startedAt),
    admin
      .from('outreach_messages')
      .select('id,lead_id,channel,status,language,variant_key,subject,last_generated_at,updated_at')
      .gte('updated_at', window.startedAt),
  ])

  return {
    leads: leadsResult.data || [],
    sendEvents: sendEventsResult.data || [],
    contentAssets: contentResult.data || [],
    markets: marketsResult.data || [],
    tasks: tasksResult.data || [],
    disputeLetters: disputeLettersResult.data || [],
    fundingProfiles: fundingProfilesResult.data || [],
    fundingRecommendations: fundingRecommendationsResult.data || [],
    fundingSequenceItems: fundingSequenceResult.data || [],
    serviceDeliverables: serviceDeliverablesResult.data || [],
    researchBriefs: researchBriefsResult.data || [],
    outreachMessages: outreachMessagesResult.data || [],
  }
}

function summarizeSignals(signals: Awaited<ReturnType<typeof fetchDailySignals>>): ContinuousImprovementSummary {
  const cityScores = new Map<string, { sent: number; replied: number; booked: number; bounces: number; leads: number }>()
  const nicheScores = new Map<string, { sent: number; replied: number; leads: number }>()
  const offerCounts = new Map<string, number>()
  const outreachAngles = new Map<string, number>()

  const leadById = new Map(signals.leads.map((lead) => [lead.id, lead]))
  for (const lead of signals.leads) {
    const cityKey = [lead.city, lead.state].filter(Boolean).join(', ')
    if (cityKey) {
      const current = cityScores.get(cityKey) || { sent: 0, replied: 0, booked: 0, bounces: 0, leads: 0 }
      current.leads += 1
      if (lead.delivery_status === 'replied') current.replied += 1
      if (lead.delivery_status === 'booked' || lead.status === 'closed_won') current.booked += 1
      if (lead.delivery_status === 'bounced') current.bounces += 1
      cityScores.set(cityKey, current)
    }

    if (lead.niche) {
      const current = nicheScores.get(lead.niche) || { sent: 0, replied: 0, leads: 0 }
      current.leads += 1
      if (lead.delivery_status === 'replied') current.replied += 1
      nicheScores.set(lead.niche, current)
    }

    if (lead.best_offer) offerCounts.set(lead.best_offer, (offerCounts.get(lead.best_offer) || 0) + 1)
    if (lead.outreach_angle) outreachAngles.set(lead.outreach_angle, (outreachAngles.get(lead.outreach_angle) || 0) + 1)
  }

  for (const event of signals.sendEvents) {
    const lead = leadById.get(event.lead_id)
    if (!lead) continue
    const cityKey = [lead.city, lead.state].filter(Boolean).join(', ')
    if (cityKey) {
      const current = cityScores.get(cityKey) || { sent: 0, replied: 0, booked: 0, bounces: 0, leads: 0 }
      if (event.status === 'sent') current.sent += 1
      if (event.status === 'failed') current.bounces += 1
      cityScores.set(cityKey, current)
    }
    if (lead.niche) {
      const current = nicheScores.get(lead.niche) || { sent: 0, replied: 0, leads: 0 }
      if (event.status === 'sent') current.sent += 1
      nicheScores.set(lead.niche, current)
    }
  }

  const cityWinners = Array.from(cityScores.entries())
    .map(([city, stats]) => ({
      city,
      stats,
      score: stats.booked * 10 + stats.replied * 6 + stats.sent + stats.leads - stats.bounces * 4,
    }))
    .sort((a, b) => b.score - a.score)

  const nicheWinners = Array.from(nicheScores.entries())
    .map(([niche, stats]) => ({
      niche,
      stats,
      score: stats.replied * 6 + stats.sent + stats.leads,
    }))
    .sort((a, b) => b.score - a.score)

  const bestCity = cityWinners[0]?.city || null
  const bestNiche = nicheWinners[0]?.niche || null
  const bestOffer =
    Array.from(offerCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const bestOutreachAngle =
    Array.from(outreachAngles.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const contentPublished = signals.contentAssets.filter((asset) => asset.status === 'published').length
  const spanishContentWins = signals.contentAssets.filter(
    (asset) => asset.language === 'es' && asset.status === 'published'
  ).length

  const disputeLettersGenerated = signals.disputeLetters.length
  const disputeLettersMailed = signals.disputeLetters.filter((letter) => Boolean(letter.mailed_at)).length
  const fundingProfilesSaved = signals.fundingProfiles.length
  const fundingRecommendationsGenerated = signals.fundingRecommendations.length
  const serviceDeliverablesSent = signals.serviceDeliverables.filter(
    (deliverable) => deliverable.status === 'sent_to_client'
  ).length

  const overdueTasks = signals.tasks.filter(
    (task) =>
      task.status !== 'completed' &&
      task.due_at &&
      asDate(task.due_at) &&
      (asDate(task.due_at)?.getTime() || 0) < Date.now()
  ).length

  const outreachSent = signals.sendEvents.filter((event) => event.status === 'sent').length
  const outreachReplied = signals.leads.filter(
    (lead) => ['replied', 'interested', 'qualified', 'closed_won'].includes(String(lead.status || ''))
  ).length
  const outreachBounced = signals.leads.filter((lead) => lead.delivery_status === 'bounced').length
  const outreachApproved = signals.outreachMessages.filter((message) => message.status === 'approved').length

  const fundingStalls = signals.fundingSequenceItems.filter((item) => item.status === 'pending').length
  const contentNeedsRefresh = signals.contentAssets.filter((asset) => asset.indexed_status === 'refresh_needed').length
  const lowConfidenceResearch = signals.researchBriefs.filter((brief) => brief.status === 'new').length

  const topWins = compact<string>([
    bestCity ? `${bestCity} produced the strongest lead-and-reply mix.` : null,
    bestNiche ? `${bestNiche} is the strongest current niche cluster.` : null,
    bestOffer ? `${bestOffer} is the most common high-fit offer path.` : null,
    contentPublished ? `${contentPublished} content assets were active in the last window.` : null,
    serviceDeliverablesSent ? `${serviceDeliverablesSent} service deliverables were sent to clients.` : null,
  ])

  const biggestLosses = compact<string>([
    outreachBounced ? `${outreachBounced} leads show bounce or send failure risk.` : null,
    overdueTasks ? `${overdueTasks} admin tasks are overdue.` : null,
    fundingStalls ? `${fundingStalls} funding sequence items are still pending.` : null,
    contentNeedsRefresh ? `${contentNeedsRefresh} content assets are marked for refresh.` : null,
    lowConfidenceResearch ? `${lowConfidenceResearch} research briefs still need operator review.` : null,
  ])

  const topSeoOpportunity = bestNiche
    ? `Expand ${bestNiche} pages with service, FAQ, and city-intent variations.`
    : 'Expand winning service clusters with more high-intent pages.'
  const topSpanishOpportunity = spanishContentWins
    ? 'Extend Spanish content into the best-performing city and funding clusters.'
    : 'Start with Spanish funding and automation content in top bilingual markets.'
  const topCreditFundingOpportunity =
    disputeLettersMailed < Math.max(1, Math.round(disputeLettersGenerated * 0.35))
      ? 'Improve post-letter follow-up and mailing completion.'
      : fundingStalls > 0
        ? 'Reduce funding-sequence stall points with tighter follow-up.'
        : 'Refine readiness guidance using the strongest recent funding paths.'

  const recommendedActions = compact<string>([
    bestCity ? `Queue more market coverage around ${bestCity}.` : null,
    bestNiche ? `Generate stronger outreach and content for ${bestNiche}.` : null,
    outreachBounced ? 'Review high-bounce outreach and tighten approval thresholds.' : null,
    overdueTasks ? 'Clear overdue admin tasks before adding more manual follow-ups.' : null,
    disputeLettersMailed < Math.max(1, Math.round(disputeLettersGenerated * 0.35))
      ? 'Strengthen dispute-mail reminders and customer completion prompts.'
      : null,
    fundingStalls ? 'Escalate stalled funding users into a targeted follow-up queue.' : null,
  ])

  return {
    bestCity,
    bestNiche,
    bestOffer,
    bestOutreachAngle,
    topSeoOpportunity,
    topSpanishOpportunity,
    topCreditFundingOpportunity,
    leadsCreated: signals.leads.length,
    outreachApproved,
    outreachSent,
    outreachReplied,
    outreachBounced,
    contentPublished,
    disputeLettersGenerated,
    disputeLettersMailed,
    fundingProfilesSaved,
    fundingRecommendationsGenerated,
    serviceDeliverablesSent,
    overdueTasks,
    topWins,
    biggestLosses,
    recommendedActions,
  }
}

async function autoApplyStrategyUpdates(rows: StrategyUpdateRecord[]) {
  const admin = createAdminClient()
  let applied = 0

  for (const row of rows) {
    if (row.risk_level !== 'low' || row.requires_admin_review) continue

    let appliedChange: Record<string, unknown> = {}
    if (row.target_type === 'target_market' && row.proposed_change_json.marketId) {
      const { error } = await admin
        .from('target_markets')
        .update({
          status: row.proposed_change_json.status || 'queued',
          niche_focus: row.proposed_change_json.nicheFocus || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(row.proposed_change_json.marketId))
      if (error) continue
      appliedChange = {
        status: row.proposed_change_json.status || 'queued',
        nicheFocus: row.proposed_change_json.nicheFocus || [],
      }
    }

    if (row.target_type === 'score_adjustment') {
      await upsertScoreAdjustments([
        {
          scopeType: String(row.proposed_change_json.scopeType || 'global') as any,
          scopeKey: String(row.proposed_change_json.scopeKey || 'global'),
          scoreDelta: Number(row.proposed_change_json.scoreDelta || 0),
          reason: row.rationale,
          confidence: Number(row.proposed_change_json.confidence || 0.7),
          status: 'active',
          sourceRunId: row.run_id,
        },
      ])
      appliedChange = row.proposed_change_json
    }

    if (row.target_type === 'outreach_variant') {
      await upsertOutreachVariants([
        {
          segmentType: String(row.proposed_change_json.segmentType || 'best_offer') as any,
          segmentKey: String(row.proposed_change_json.segmentKey || 'default'),
          channel: String(row.proposed_change_json.channel || 'email') as any,
          language: String(row.proposed_change_json.language || 'en') as any,
          opener: String(row.proposed_change_json.opener || ''),
          bodyGuidance: String(row.proposed_change_json.bodyGuidance || ''),
          cta: String(row.proposed_change_json.cta || ''),
          performance: row.proposed_change_json.performance as Record<string, unknown>,
          status: 'active',
          sourceRunId: row.run_id,
        },
      ])
      appliedChange = row.proposed_change_json
    }

    if (!Object.keys(appliedChange).length) continue

    await updateStrategyUpdate(row.id, {
      approval_status: 'auto_applied',
      applied_change_json: appliedChange,
      applied_at: new Date().toISOString(),
    })

    await logEvent({
      eventType: 'admin_action',
      entityType: 'strategy_update',
      entityId: row.id,
      metadata: { action: 'auto_applied_strategy_update', targetType: row.target_type },
    })
    applied += 1
  }

  return applied
}

async function buildStrategyUpdates(
  runId: string,
  summary: ContinuousImprovementSummary,
  signals: Awaited<ReturnType<typeof fetchDailySignals>>
) {
  const marketMap = new Map(
    signals.markets.map((market) => [[market.city, market.state].filter(Boolean).join(', '), market])
  )
  const rows: Parameters<typeof insertStrategyUpdates>[0] = []

  if (summary.bestCity) {
    const market = marketMap.get(summary.bestCity)
    rows.push({
      runId,
      category: 'market_expansion',
      targetType: market?.id ? 'target_market' : 'market',
      targetKey: summary.bestCity,
      riskLevel: 'low',
      title: `Re-queue ${summary.bestCity} sooner`,
      rationale: `${summary.bestCity} led the strongest lead and reply mix in the latest window.`,
      proposedChange: {
        marketId: market?.id || null,
        status: 'queued',
        nicheFocus: summary.bestNiche ? [summary.bestNiche, ...(market?.niche_focus || [])].slice(0, 4) : market?.niche_focus || [],
      },
      requiresAdminReview: false,
    })
  }

  if (summary.bestOffer) {
    rows.push({
      runId,
      category: 'score_tuning',
      targetType: 'score_adjustment',
      targetKey: summary.bestOffer,
      riskLevel: 'low',
      title: `Slightly favor ${summary.bestOffer} in scoring`,
      rationale: `${summary.bestOffer} is the strongest current offer path and can be emphasized carefully.`,
      proposedChange: {
        scopeType: 'best_offer',
        scopeKey: summary.bestOffer,
        scoreDelta: 3,
        confidence: 0.71,
      },
      requiresAdminReview: false,
    })
  }

  if (summary.bestOutreachAngle && summary.bestOffer) {
    rows.push({
      runId,
      category: 'outreach_optimization',
      targetType: 'outreach_variant',
      targetKey: `${summary.bestOffer}|email`,
      riskLevel: 'low',
      title: `Promote stronger ${summary.bestOffer} outreach guidance`,
      rationale: `${summary.bestOutreachAngle} is the clearest current outreach angle tied to winning leads.`,
      proposedChange: {
        segmentType: 'best_offer',
        segmentKey: summary.bestOffer,
        channel: 'email',
        language: 'en',
        opener: `Lead with ${summary.bestOutreachAngle.toLowerCase()} instead of a generic intro.`,
        bodyGuidance: `Use ${summary.bestOutreachAngle.toLowerCase()} and a practical next-step framing tied to ${summary.bestOffer}.`,
        cta: 'Reply if you want a practical next-step review.',
        performance: {
          bestOutreachAngle: summary.bestOutreachAngle,
          source: 'daily_review',
        },
      },
      requiresAdminReview: false,
    })
  }

  if (summary.topSpanishOpportunity) {
    rows.push({
      runId,
      category: 'seo_expansion',
      targetType: 'content',
      targetKey: 'spanish_cluster',
      riskLevel: 'medium',
      title: 'Expand Spanish content in winning markets',
      rationale: summary.topSpanishOpportunity,
      proposedChange: {
        cluster: 'spanish',
        recommendation: summary.topSpanishOpportunity,
      },
      requiresAdminReview: true,
    })
  }

  if (summary.topCreditFundingOpportunity) {
    rows.push({
      runId,
      category: 'credit_funding_refinement',
      targetType: 'workflow',
      targetKey: 'credit_funding',
      riskLevel: 'medium',
      title: 'Refine credit and funding follow-up logic',
      rationale: summary.topCreditFundingOpportunity,
      proposedChange: {
        recommendation: summary.topCreditFundingOpportunity,
      },
      requiresAdminReview: true,
    })
  }

  return insertStrategyUpdates(rows)
}

function deriveInsights(runId: string, summary: ContinuousImprovementSummary) {
  return compact([
    summary.bestCity
      ? {
          runId,
          category: 'market_expansion',
          severity: 'info' as const,
          title: `${summary.bestCity} is leading right now`,
          summary: `${summary.bestCity} produced the strongest current blend of lead volume and response quality.`,
          supportingData: { bestCity: summary.bestCity },
          recommendation: `Queue more coverage and stronger niche rotation around ${summary.bestCity}.`,
          confidence: 0.74,
        }
      : null,
    summary.outreachBounced
      ? {
          runId,
          category: 'outreach_optimization',
          severity: 'watch' as const,
          title: 'Bounce risk needs tighter review',
          summary: `${summary.outreachBounced} leads now show bounce or delivery-failure risk.`,
          supportingData: { outreachBounced: summary.outreachBounced },
          recommendation: 'Tighten approval thresholds and review weak contact data before sending.',
          confidence: 0.8,
        }
      : null,
    summary.overdueTasks
      ? {
          runId,
          category: 'admin_workflow',
          severity: 'action' as const,
          title: 'Operator queue is backing up',
          summary: `${summary.overdueTasks} admin tasks are overdue, which can slow follow-up quality.`,
          supportingData: { overdueTasks: summary.overdueTasks },
          recommendation: 'Clear overdue tasks before expanding manual campaigns.',
          confidence: 0.82,
        }
      : null,
    summary.topSeoOpportunity
      ? {
          runId,
          category: 'seo_expansion',
          severity: 'info' as const,
          title: 'Next SEO opportunity identified',
          summary: summary.topSeoOpportunity,
          supportingData: { topSeoOpportunity: summary.topSeoOpportunity },
          recommendation: 'Queue content expansion around the strongest winning niche or service cluster.',
          confidence: 0.69,
        }
      : null,
    summary.topCreditFundingOpportunity
      ? {
          runId,
          category: 'credit_funding_refinement',
          severity: 'watch' as const,
          title: 'Credit or funding workflow has a clear next improvement',
          summary: summary.topCreditFundingOpportunity,
          supportingData: { topCreditFundingOpportunity: summary.topCreditFundingOpportunity },
          recommendation: 'Route this into the approval queue before changing customer-facing timing or copy.',
          confidence: 0.73,
        }
      : null,
  ])
}

async function buildDailySnapshot(daysBack = 1): Promise<DailySnapshot> {
  const window = makeWindow(daysBack)
  const signals = await fetchDailySignals(window)
  const summary = summarizeSignals(signals)
  return { window, signals, summary }
}

export async function runDailyImprovementReview(options: { dryRun?: boolean } = {}): Promise<DailyReviewResult> {
  const snapshot = await buildDailySnapshot(1)
  const run = await createImprovementRun({
    runType: 'daily_review',
    windowStartedAt: snapshot.window.startedAt,
    windowEndedAt: snapshot.window.endedAt,
    dataSources: [{ source: 'operational_tables', window: snapshot.window }],
  })

  try {
    const insights = deriveInsights(run.id, snapshot.summary)

    if (options.dryRun) {
      const finishedRun = await finishImprovementRun(run.id, {
        status: 'completed',
        summary: { ...snapshot.summary, dryRun: true },
        autoAppliedCount: 0,
        queuedCount: 0,
      })
      return { run: finishedRun, summary: snapshot.summary, autoAppliedCount: 0, queuedCount: 0 }
    }

    await insertImprovementInsights(insights)

    const strategyUpdates = await buildStrategyUpdates(run.id, snapshot.summary, snapshot.signals)
    const autoAppliedCount = await autoApplyStrategyUpdates(strategyUpdates)
    const queuedCount = strategyUpdates.filter((row) => row.approval_status === 'queued').length

    await insertMarketSnapshots(
      snapshot.signals.markets.slice(0, 20).map((market) => ({
        runId: run.id,
        targetMarketId: market.id,
        city: market.city,
        state: market.state,
        niche: market.niche_focus?.[0] || null,
        leadsFound: Number(market.performance_json?.lastLeadCount || 0),
        sentCount: Number(market.performance_json?.sentCount || 0),
        replyCount: Math.round(Number(market.performance_json?.replyRate || 0) * 100),
        bookedCount: Math.round(Number(market.performance_json?.bookedRate || 0) * 100),
        bounceCount: Math.round(Number(market.performance_json?.bounceRate || 0) * 100),
        qualityScore: Number(market.performance_json?.performanceScore || 0),
        metrics: market.performance_json || {},
      }))
    )

    const disputeByMethod = new Map<string, { assigned: number; completed: number; stalled: number; response: number }>()
    for (const letter of snapshot.signals.disputeLetters) {
      const key = letter.letter_type || 'Dispute letter'
      const current = disputeByMethod.get(key) || { assigned: 0, completed: 0, stalled: 0, response: 0 }
      current.assigned += 1
      if (letter.mailed_at) current.completed += 1
      if (!letter.mailed_at) current.stalled += 1
      if (letter.response_received_at) current.response += 1
      disputeByMethod.set(key, current)
    }

    const fundingStatus = {
      assigned: snapshot.signals.fundingRecommendations.length,
      completed: snapshot.signals.fundingSequenceItems.filter((item) => item.status === 'approved').length,
      stalled: snapshot.signals.fundingSequenceItems.filter((item) => item.status === 'pending').length,
      response: snapshot.signals.fundingSequenceItems.filter((item) => item.status === 'approved').length,
    }

    await insertMethodSnapshots([
      ...Array.from(disputeByMethod.entries()).map(([methodKey, metrics]) => ({
        runId: run.id,
        methodType: 'credit_repair',
        methodKey,
        assignedCount: metrics.assigned,
        completedCount: metrics.completed,
        stalledCount: metrics.stalled,
        responseCount: metrics.response,
        metrics,
      })),
      {
        runId: run.id,
        methodType: 'funding_strategy',
        methodKey: 'funding_assistant',
        assignedCount: fundingStatus.assigned,
        completedCount: fundingStatus.completed,
        stalledCount: fundingStatus.stalled,
        responseCount: fundingStatus.response,
        metrics: fundingStatus,
      },
    ])

    const reportDate = formatISO(new Date(), { representation: 'date' })
    await upsertDailyOperatorReport({
      runId: run.id,
      reportDate,
      summary: snapshot.summary as ContinuousImprovementSummary & Record<string, unknown>,
      htmlDigest: buildDailyReportHtml(snapshot.summary),
    })

    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: snapshot.summary,
      autoAppliedCount,
      queuedCount,
    })

    await sendImprovementDigest(snapshot.summary)
    await logEvent({
      eventType: 'admin_action',
      entityType: 'improvement_run',
      entityId: run.id,
      metadata: { action: 'daily_improvement_review_completed', autoAppliedCount, queuedCount },
    })

    return { run: finishedRun, summary: snapshot.summary, autoAppliedCount, queuedCount }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runResearchDigest(options: { dryRun?: boolean } = {}): Promise<OptimizationResult> {
  const run = await createImprovementRun({
    runType: 'research_digest',
    windowStartedAt: makeWindow(7).startedAt,
    windowEndedAt: new Date().toISOString(),
    dataSources: [{ source: 'curated_research_sources' }],
  })

  try {
    const latest = await buildDailySnapshot(1)
    const rows = buildResearchBriefsFromSources({
      weakSpots: latest.summary.biggestLosses,
      topWins: latest.summary.topWins,
      createdByRunId: run.id,
    })

    if (!options.dryRun) {
      await insertResearchBriefs(rows)
    }

    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: { createdBriefs: rows.length, themes: Array.from(new Set(rows.map((row) => row.theme))) },
      queuedCount: rows.length,
    })

    return { run: finishedRun, created: rows.length, autoApplied: 0 }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runOutreachOptimization(options: { dryRun?: boolean } = {}): Promise<OptimizationResult> {
  const window = makeWindow(14)
  const run = await createImprovementRun({
    runType: 'outreach_optimization',
    windowStartedAt: window.startedAt,
    windowEndedAt: window.endedAt,
    dataSources: [{ source: 'leads_outreach_send_events', window }],
  })

  try {
    const admin = createAdminClient()
    const [{ data: leads }, { data: sendEvents }] = await Promise.all([
      admin.from('leads').select('id,best_offer,language_segment,city,state,niche,status,delivery_status').gte('updated_at', window.startedAt),
      admin.from('outreach_send_events').select('lead_id,channel,status').gte('created_at', window.startedAt),
    ])

    const leadMap = new Map((leads || []).map((lead) => [lead.id, lead]))
    const grouped = new Map<string, { channel: string; offer: string; language: string; sent: number; replied: number; bounced: number }>()

    for (const event of sendEvents || []) {
      const lead = leadMap.get(event.lead_id)
      if (!lead?.best_offer) continue
      const language = lead.language_segment === 'spanish' ? 'es' : 'en'
      const key = `${lead.best_offer}|${event.channel}|${language}`
      const current = grouped.get(key) || {
        channel: event.channel,
        offer: lead.best_offer,
        language,
        sent: 0,
        replied: 0,
        bounced: 0,
      }
      if (event.status === 'sent') current.sent += 1
      if (lead.status === 'replied' || lead.status === 'interested' || lead.status === 'qualified' || lead.status === 'closed_won') {
        current.replied += 1
      }
      if (lead.delivery_status === 'bounced') current.bounced += 1
      grouped.set(key, current)
    }

    const winners = Array.from(grouped.values())
      .map((row) => ({
        ...row,
        replyRate: safeDivide(row.replied, row.sent),
        bounceRate: safeDivide(row.bounced, row.sent),
      }))
      .filter((row) => row.sent >= 3)
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 8)

    const variants = winners.map((winner) => ({
      segmentType: 'best_offer' as const,
      segmentKey: winner.offer,
      channel: winner.channel as any,
      language: winner.language as 'en' | 'es',
      opener:
        winner.language === 'es'
          ? `Comienza con una observación breve y útil sobre ${winner.offer.toLowerCase()}.`
          : `Lead with a short practical observation tied to ${winner.offer.toLowerCase()}.`,
      bodyGuidance:
        winner.language === 'es'
          ? `Mantén el mensaje corto, específico y orientado a un siguiente paso claro para ${winner.offer.toLowerCase()}.`
          : `Keep the message short, specific, and grounded in a clear next step for ${winner.offer.toLowerCase()}.`,
      cta:
        winner.language === 'es'
          ? 'Responde si quieres una revisión rápida.'
          : 'Reply if you want a quick practical review.',
      performance: {
        sent: winner.sent,
        replied: winner.replied,
        replyRate: winner.replyRate,
        bounceRate: winner.bounceRate,
      },
      status: winner.replyRate >= 0.08 && winner.bounceRate < 0.2 ? 'active' as const : 'proposed' as const,
      sourceRunId: run.id,
    }))

    if (!options.dryRun) {
      await upsertOutreachVariants(variants)
      await upsertExperimentResults(
        winners.map((winner) => ({
          runId: run.id,
          experimentKey: `outreach-${winner.offer}-${winner.channel}-${winner.language}`,
          category: 'outreach_optimization',
          variantKey: `${winner.offer}|${winner.channel}|${winner.language}`,
          baselineKey: `${winner.offer}|baseline`,
          metrics: {
            sent: winner.sent,
            replied: winner.replied,
            replyRate: winner.replyRate,
            bounceRate: winner.bounceRate,
          },
          winner: winner.replyRate >= 0.08 && winner.bounceRate < 0.2,
          notes: 'Promoted from continuous improvement outreach review.',
        }))
      )
    }

    const autoApplied = variants.filter((variant) => variant.status === 'active').length
    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: { createdVariants: variants.length, autoApplied },
      autoAppliedCount: autoApplied,
      queuedCount: variants.length - autoApplied,
    })

    return { run: finishedRun, created: variants.length, autoApplied }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runMarketOptimization(options: { dryRun?: boolean } = {}): Promise<OptimizationResult> {
  const run = await createImprovementRun({
    runType: 'market_optimization',
    windowStartedAt: makeWindow(14).startedAt,
    windowEndedAt: new Date().toISOString(),
    dataSources: [{ source: 'target_markets_and_leads' }],
  })

  try {
    const latest = await buildDailySnapshot(1)
    const rows = latest.summary.bestCity
      ? [
          {
            runId: run.id,
            category: 'market_expansion',
            targetType: 'market',
            targetKey: latest.summary.bestCity,
            riskLevel: 'low' as const,
            title: `Keep ${latest.summary.bestCity} in active rotation`,
            rationale: `${latest.summary.bestCity} is still the strongest current market and should not be deprioritized.`,
            proposedChange: {
              market: latest.summary.bestCity,
              recommendation: 'Increase revisit priority',
            },
            requiresAdminReview: false,
          },
        ]
      : []

    if (!options.dryRun && rows.length) {
      const inserted = await insertStrategyUpdates(rows)
      await autoApplyStrategyUpdates(inserted)
    }

    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: { createdStrategies: rows.length },
      autoAppliedCount: rows.length,
    })

    return { run: finishedRun, created: rows.length, autoApplied: rows.length }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runContentOptimization(options: { dryRun?: boolean } = {}): Promise<OptimizationResult> {
  const run = await createImprovementRun({
    runType: 'content_optimization',
    windowStartedAt: makeWindow(14).startedAt,
    windowEndedAt: new Date().toISOString(),
    dataSources: [{ source: 'content_assets' }],
  })

  try {
    const latest = await buildDailySnapshot(1)
    const rows = compact([
      latest.summary.topSeoOpportunity
        ? {
            runId: run.id,
            category: 'seo_expansion',
            targetType: 'content',
            targetKey: 'seo',
            riskLevel: 'medium' as const,
            title: 'Queue next SEO page batch',
            rationale: latest.summary.topSeoOpportunity,
            proposedChange: { recommendation: latest.summary.topSeoOpportunity },
            requiresAdminReview: true,
          }
        : null,
      latest.summary.topSpanishOpportunity
        ? {
            runId: run.id,
            category: 'spanish_expansion',
            targetType: 'content',
            targetKey: 'spanish',
            riskLevel: 'medium' as const,
            title: 'Queue next Spanish page batch',
            rationale: latest.summary.topSpanishOpportunity,
            proposedChange: { recommendation: latest.summary.topSpanishOpportunity },
            requiresAdminReview: true,
          }
        : null,
    ])

    if (!options.dryRun && rows.length) {
      await insertStrategyUpdates(rows)
    }

    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: { createdStrategies: rows.length },
      queuedCount: rows.length,
    })
    return { run: finishedRun, created: rows.length, autoApplied: 0 }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runCreditFundingOptimization(options: { dryRun?: boolean } = {}): Promise<OptimizationResult> {
  const run = await createImprovementRun({
    runType: 'credit_funding_optimization',
    windowStartedAt: makeWindow(14).startedAt,
    windowEndedAt: new Date().toISOString(),
    dataSources: [{ source: 'dispute_letters_funding_sequences' }],
  })

  try {
    const latest = await buildDailySnapshot(1)
    const rows = latest.summary.topCreditFundingOpportunity
      ? [
          {
            runId: run.id,
            category: 'credit_funding_refinement',
            targetType: 'workflow',
            targetKey: 'credit_funding',
            riskLevel: 'medium' as const,
            title: 'Review credit and funding workflow bottleneck',
            rationale: latest.summary.topCreditFundingOpportunity,
            proposedChange: { recommendation: latest.summary.topCreditFundingOpportunity },
            requiresAdminReview: true,
          },
        ]
      : []

    if (!options.dryRun && rows.length) {
      await insertStrategyUpdates(rows)
    }

    const finishedRun = await finishImprovementRun(run.id, {
      status: 'completed',
      summary: { createdStrategies: rows.length },
      queuedCount: rows.length,
    })
    return { run: finishedRun, created: rows.length, autoApplied: 0 }
  } catch (error) {
    await finishImprovementRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function applyStrategyUpdateById(id: string, actorUserId: string, action: 'approve' | 'reject' | 'apply') {
  const update = await getStrategyUpdate(id)
  if (action === 'reject') {
    return updateStrategyUpdate(id, {
      approval_status: 'rejected',
      approved_by_user_id: actorUserId,
      approved_at: new Date().toISOString(),
    })
  }

  if (action === 'approve') {
    return updateStrategyUpdate(id, {
      approval_status: 'approved',
      approved_by_user_id: actorUserId,
      approved_at: new Date().toISOString(),
    })
  }

  await updateStrategyUpdate(id, {
    approval_status: 'approved',
    approved_by_user_id: actorUserId,
    approved_at: new Date().toISOString(),
  })

  const appliedCount = await autoApplyStrategyUpdates([{ ...update, approval_status: 'approved', approved_by_user_id: actorUserId }])
  if (!appliedCount) {
    await updateStrategyUpdate(id, {
      applied_at: new Date().toISOString(),
      applied_change_json: update.proposed_change_json,
    })
  }

  return getStrategyUpdate(id)
}

export async function getActiveImprovementContext() {
  const [adjustments, variants] = await Promise.all([
    listActiveScoreAdjustments(),
    listActiveOutreachVariants(),
  ])
  return { adjustments, variants }
}
