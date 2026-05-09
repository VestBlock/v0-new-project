import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ContinuousImprovementSummary,
  DailyOperatorReportRecord,
  ExperimentResultRecord,
  ImprovementDashboardSnapshot,
  ImprovementInsightRecord,
  ImprovementRunRecord,
  ImprovementRunType,
  MarketPerformanceSnapshotRecord,
  MethodPerformanceSnapshotRecord,
  OutreachVariantRecord,
  PromptVersionRecord,
  ResearchBriefRecord,
  ScoreAdjustmentRecord,
  StrategyUpdateRecord,
} from '@/lib/improvement/types'

const adjustmentCache = new Map<string, { expiresAt: number; rows: ScoreAdjustmentRecord[] }>()
const variantCache = new Map<string, { expiresAt: number; rows: OutreachVariantRecord[] }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function cacheKey(scope = 'all') {
  return scope
}

function isFresh(expiresAt: number) {
  return expiresAt > Date.now()
}

export async function createImprovementRun(input: {
  runType: ImprovementRunType
  windowStartedAt?: string | null
  windowEndedAt?: string | null
  dataSources?: Array<Record<string, unknown>>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('improvement_runs')
    .insert({
      run_type: input.runType,
      status: 'running',
      window_started_at: input.windowStartedAt ?? null,
      window_ended_at: input.windowEndedAt ?? null,
      data_sources_json: input.dataSources || [],
    })
    .select('*')
    .single()

  if (error) throw error
  return data as ImprovementRunRecord
}

export async function finishImprovementRun(
  runId: string,
  input: {
    status: 'completed' | 'failed'
    summary: Record<string, unknown>
    autoAppliedCount?: number
    queuedCount?: number
    errorMessage?: string | null
  }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('improvement_runs')
    .update({
      status: input.status,
      summary_json: input.summary,
      auto_applied_count: input.autoAppliedCount ?? 0,
      queued_count: input.queuedCount ?? 0,
      error_message: input.errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) throw error
  return data as ImprovementRunRecord
}

export async function insertImprovementInsights(
  rows: Array<{
    runId: string
    category: string
    severity: 'info' | 'watch' | 'action'
    title: string
    summary: string
    supportingData?: Record<string, unknown>
    recommendation?: string | null
    confidence?: number
    autoApplied?: boolean
  }>
) {
  if (!rows.length) return [] as ImprovementInsightRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('improvement_insights')
    .insert(
      rows.map((row) => ({
        run_id: row.runId,
        category: row.category,
        severity: row.severity,
        title: row.title,
        summary: row.summary,
        supporting_data: row.supportingData || {},
        recommendation: row.recommendation ?? null,
        confidence: row.confidence ?? 0.5,
        auto_applied: row.autoApplied ?? false,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as ImprovementInsightRecord[]
}

export async function insertResearchBriefs(
  rows: Array<{
    theme: string
    sourceType?: string
    sourceUrl?: string | null
    sourceTitle?: string | null
    briefTitle: string
    summary: string
    recommendations?: string[]
    priority?: 'low' | 'medium' | 'high'
    createdByRunId?: string | null
  }>
) {
  if (!rows.length) return [] as ResearchBriefRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('research_briefs')
    .insert(
      rows.map((row) => ({
        theme: row.theme,
        source_type: row.sourceType || 'curated',
        source_url: row.sourceUrl ?? null,
        source_title: row.sourceTitle ?? null,
        brief_title: row.briefTitle,
        summary: row.summary,
        recommendations_json: row.recommendations || [],
        priority: row.priority || 'medium',
        created_by_run_id: row.createdByRunId ?? null,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as ResearchBriefRecord[]
}

export async function insertStrategyUpdates(
  rows: Array<{
    runId?: string | null
    category: string
    targetType: string
    targetKey: string
    riskLevel: 'low' | 'medium' | 'high'
    approvalStatus?: 'queued' | 'approved' | 'rejected' | 'auto_applied'
    title: string
    rationale: string
    proposedChange: Record<string, unknown>
    requiresAdminReview?: boolean
    appliedChange?: Record<string, unknown>
    approvedByUserId?: string | null
    approvedAt?: string | null
    appliedAt?: string | null
  }>
) {
  if (!rows.length) return [] as StrategyUpdateRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_updates')
    .insert(
      rows.map((row) => ({
        run_id: row.runId ?? null,
        category: row.category,
        target_type: row.targetType,
        target_key: row.targetKey,
        risk_level: row.riskLevel,
        approval_status: row.approvalStatus || 'queued',
        title: row.title,
        rationale: row.rationale,
        proposed_change_json: row.proposedChange,
        requires_admin_review: row.requiresAdminReview ?? row.riskLevel !== 'low',
        applied_change_json: row.appliedChange || {},
        approved_by_user_id: row.approvedByUserId ?? null,
        approved_at: row.approvedAt ?? null,
        applied_at: row.appliedAt ?? null,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as StrategyUpdateRecord[]
}

export async function upsertExperimentResults(
  rows: Array<{
    runId?: string | null
    experimentKey: string
    category: string
    variantKey: string
    baselineKey?: string | null
    metrics: Record<string, unknown>
    winner?: boolean
    notes?: string | null
  }>
) {
  if (!rows.length) return [] as ExperimentResultRecord[]
  const admin = createAdminClient()
  const payload = rows.map((row) => ({
    run_id: row.runId ?? null,
    experiment_key: row.experimentKey,
    category: row.category,
    variant_key: row.variantKey,
    baseline_key: row.baselineKey ?? null,
    metrics_json: row.metrics,
    winner: row.winner ?? false,
    notes: row.notes ?? null,
  }))
  const { data, error } = await admin.from('experiment_results').insert(payload).select('*')
  if (error) throw error
  return (data || []) as ExperimentResultRecord[]
}

export async function upsertPromptVersions(
  rows: Array<{
    surface: string
    segmentKey: string
    versionLabel: string
    promptText: string
    status?: 'draft' | 'active' | 'archived'
    createdByRunId?: string | null
    metadata?: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as PromptVersionRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('prompt_versions')
    .insert(
      rows.map((row) => ({
        surface: row.surface,
        segment_key: row.segmentKey,
        version_label: row.versionLabel,
        prompt_text: row.promptText,
        status: row.status || 'draft',
        created_by_run_id: row.createdByRunId ?? null,
        metadata_json: row.metadata || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as PromptVersionRecord[]
}

export async function upsertScoreAdjustments(
  rows: Array<{
    scopeType: ScoreAdjustmentRecord['scope_type']
    scopeKey: string
    scoreDelta: number
    reason: string
    confidence?: number
    status?: ScoreAdjustmentRecord['status']
    sourceRunId?: string | null
  }>
) {
  if (!rows.length) return [] as ScoreAdjustmentRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('score_adjustments')
    .insert(
      rows.map((row) => ({
        scope_type: row.scopeType,
        scope_key: row.scopeKey,
        score_delta: row.scoreDelta,
        reason: row.reason,
        confidence: row.confidence ?? 0.5,
        status: row.status || 'proposed',
        source_run_id: row.sourceRunId ?? null,
      }))
    )
    .select('*')

  if (error) throw error
  adjustmentCache.delete(cacheKey())
  return (data || []) as ScoreAdjustmentRecord[]
}

export async function upsertOutreachVariants(
  rows: Array<{
    segmentType: OutreachVariantRecord['segment_type']
    segmentKey: string
    channel: OutreachVariantRecord['channel']
    language?: OutreachVariantRecord['language']
    opener?: string | null
    bodyGuidance?: string | null
    cta?: string | null
    performance?: Record<string, unknown>
    status?: OutreachVariantRecord['status']
    sourceRunId?: string | null
  }>
) {
  if (!rows.length) return [] as OutreachVariantRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_variants')
    .insert(
      rows.map((row) => ({
        segment_type: row.segmentType,
        segment_key: row.segmentKey,
        channel: row.channel,
        language: row.language || 'en',
        opener: row.opener ?? null,
        body_guidance: row.bodyGuidance ?? null,
        cta: row.cta ?? null,
        performance_json: row.performance || {},
        status: row.status || 'proposed',
        source_run_id: row.sourceRunId ?? null,
      }))
    )
    .select('*')

  if (error) throw error
  variantCache.delete(cacheKey())
  return (data || []) as OutreachVariantRecord[]
}

export async function insertMarketSnapshots(
  rows: Array<{
    runId?: string | null
    targetMarketId?: string | null
    city: string
    state: string
    niche?: string | null
    leadsFound: number
    sentCount: number
    replyCount: number
    bookedCount: number
    bounceCount: number
    qualityScore: number
    metrics: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as MarketPerformanceSnapshotRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('market_performance_snapshots')
    .insert(
      rows.map((row) => ({
        run_id: row.runId ?? null,
        target_market_id: row.targetMarketId ?? null,
        city: row.city,
        state: row.state,
        niche: row.niche ?? null,
        leads_found: row.leadsFound,
        sent_count: row.sentCount,
        reply_count: row.replyCount,
        booked_count: row.bookedCount,
        bounce_count: row.bounceCount,
        quality_score: row.qualityScore,
        metrics_json: row.metrics,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as MarketPerformanceSnapshotRecord[]
}

export async function insertMethodSnapshots(
  rows: Array<{
    runId?: string | null
    methodType: string
    methodKey: string
    assignedCount: number
    completedCount: number
    stalledCount: number
    responseCount: number
    metrics: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as MethodPerformanceSnapshotRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('method_performance_snapshots')
    .insert(
      rows.map((row) => ({
        run_id: row.runId ?? null,
        method_type: row.methodType,
        method_key: row.methodKey,
        assigned_count: row.assignedCount,
        completed_count: row.completedCount,
        stalled_count: row.stalledCount,
        response_count: row.responseCount,
        metrics_json: row.metrics,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as MethodPerformanceSnapshotRecord[]
}

export async function upsertDailyOperatorReport(input: {
  runId?: string | null
  reportDate: string
  summary: ContinuousImprovementSummary & Record<string, unknown>
  htmlDigest?: string | null
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_operator_reports')
    .upsert(
      {
        run_id: input.runId ?? null,
        report_date: input.reportDate,
        summary_json: input.summary,
        html_digest: input.htmlDigest ?? null,
      },
      { onConflict: 'report_date' }
    )
    .select('*')
    .single()

  if (error) throw error
  return data as DailyOperatorReportRecord
}

export async function listActiveScoreAdjustments(force = false) {
  const key = cacheKey()
  const cached = adjustmentCache.get(key)
  if (!force && cached && isFresh(cached.expiresAt)) return cached.rows

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('score_adjustments')
    .select('*')
    .eq('status', 'active')
    .order('confidence', { ascending: false })

  if (error) throw error
  const rows = (data || []) as ScoreAdjustmentRecord[]
  adjustmentCache.set(key, { rows, expiresAt: Date.now() + CACHE_TTL_MS })
  return rows
}

export async function listActiveOutreachVariants(force = false) {
  const key = cacheKey()
  const cached = variantCache.get(key)
  if (!force && cached && isFresh(cached.expiresAt)) return cached.rows

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_variants')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data || []) as OutreachVariantRecord[]
  variantCache.set(key, { rows, expiresAt: Date.now() + CACHE_TTL_MS })
  return rows
}

export async function updateStrategyUpdate(
  id: string,
  updates: Partial<{
    approval_status: StrategyUpdateRecord['approval_status']
    applied_change_json: Record<string, unknown>
    approved_by_user_id: string | null
    approved_at: string | null
    applied_at: string | null
  }>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_updates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as StrategyUpdateRecord
}

export async function getStrategyUpdate(id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('strategy_updates').select('*').eq('id', id).single()
  if (error) throw error
  return data as StrategyUpdateRecord
}

export async function getImprovementDashboardSnapshot() {
  const admin = createAdminClient()
  const [
    latestRun,
    report,
    queuedUpdates,
    recentResearch,
    recentExperiments,
    activeAdjustments,
    activeVariants,
    recentInsights,
  ] = await Promise.all([
    admin.from('improvement_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('daily_operator_reports').select('*').order('report_date', { ascending: false }).limit(1).maybeSingle(),
    admin
      .from('strategy_updates')
      .select('*')
      .in('approval_status', ['queued', 'approved'])
      .order('created_at', { ascending: false })
      .limit(25),
    admin.from('research_briefs').select('*').order('created_at', { ascending: false }).limit(20),
    admin.from('experiment_results').select('*').order('created_at', { ascending: false }).limit(20),
    admin.from('score_adjustments').select('*').eq('status', 'active').order('confidence', { ascending: false }).limit(20),
    admin.from('outreach_variants').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(20),
    admin.from('improvement_insights').select('*').order('created_at', { ascending: false }).limit(25),
  ])

  return {
    latestRun: (latestRun.data || null) as ImprovementRunRecord | null,
    report: (report.data || null) as DailyOperatorReportRecord | null,
    queuedUpdates: (queuedUpdates.data || []) as StrategyUpdateRecord[],
    recentResearch: (recentResearch.data || []) as ResearchBriefRecord[],
    recentExperiments: (recentExperiments.data || []) as ExperimentResultRecord[],
    activeAdjustments: (activeAdjustments.data || []) as ScoreAdjustmentRecord[],
    activeVariants: (activeVariants.data || []) as OutreachVariantRecord[],
    recentInsights: (recentInsights.data || []) as ImprovementInsightRecord[],
  } satisfies ImprovementDashboardSnapshot
}
