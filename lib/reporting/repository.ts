import { createAdminClient } from '@/lib/supabase/admin'
import type {
  DailyGrowthReportRecord,
  DailyGrowthReportSectionRecord,
  EntitySeoOpportunityRecord,
  EntitySeoPerformanceSnapshotRecord,
  EntitySeoRunRecord,
} from '@/lib/reporting/types'

export async function upsertDailyGrowthReport(input: {
  reportDate: string
  leadsSummary: Record<string, unknown>
  lendersSummary: Record<string, unknown>
  buyersSummary: Record<string, unknown>
  usersSummary: Record<string, unknown>
  seoSummary: Record<string, unknown>
  topCities: Array<Record<string, unknown>>
  topNiches: Array<Record<string, unknown>>
  topOffers: Array<Record<string, unknown>>
  recommendedActions: string[]
  summary: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_growth_reports')
    .upsert(
      {
        report_date: input.reportDate,
        leads_summary: input.leadsSummary,
        lenders_summary: input.lendersSummary,
        buyers_summary: input.buyersSummary,
        users_summary: input.usersSummary,
        seo_summary: input.seoSummary,
        top_cities: input.topCities,
        top_niches: input.topNiches,
        top_offers: input.topOffers,
        recommended_actions: input.recommendedActions,
        summary_json: input.summary,
      },
      { onConflict: 'report_date' }
    )
    .select('*')
    .single()

  if (error) throw error
  return data as DailyGrowthReportRecord
}

export async function replaceDailyGrowthReportSections(
  reportId: string,
  sections: Array<{ sectionKey: string; sectionTitle: string; summary: Record<string, unknown> }>
) {
  const admin = createAdminClient()
  await admin.from('daily_growth_report_sections').delete().eq('report_id', reportId)
  if (!sections.length) return [] as DailyGrowthReportSectionRecord[]

  const { data, error } = await admin
    .from('daily_growth_report_sections')
    .insert(
      sections.map((section) => ({
        report_id: reportId,
        section_key: section.sectionKey,
        section_title: section.sectionTitle,
        summary_json: section.summary,
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as DailyGrowthReportSectionRecord[]
}

export async function listDailyGrowthReports(limit = 30) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_growth_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as DailyGrowthReportRecord[]
}

export async function getDailyGrowthReportByDate(reportDate: string) {
  const admin = createAdminClient()
  const { data: report, error: reportError } = await admin
    .from('daily_growth_reports')
    .select('*')
    .eq('report_date', reportDate)
    .single()

  if (reportError) throw reportError
  const { data: sections, error: sectionsError } = await admin
    .from('daily_growth_report_sections')
    .select('*')
    .eq('report_id', report.id)
    .order('section_key', { ascending: true })

  if (sectionsError) throw sectionsError
  return {
    report: report as DailyGrowthReportRecord,
    sections: (sections || []) as DailyGrowthReportSectionRecord[],
  }
}

export async function createEntitySeoRun(input: {
  runType: EntitySeoRunRecord['run_type']
  requestParams?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entity_seo_runs')
    .insert({
      run_type: input.runType,
      status: 'running',
      request_params: input.requestParams || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as EntitySeoRunRecord
}

export async function finishEntitySeoRun(
  runId: string,
  input: {
    status: EntitySeoRunRecord['status']
    resultCount?: number
    autoPublishedCount?: number
    errorMessage?: string | null
  }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entity_seo_runs')
    .update({
      status: input.status,
      result_count: input.resultCount ?? 0,
      auto_published_count: input.autoPublishedCount ?? 0,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) throw error
  return data as EntitySeoRunRecord
}

export async function upsertEntitySeoOpportunities(
  rows: Array<{
    entityType: EntitySeoOpportunityRecord['entity_type']
    entityName: string
    city?: string | null
    state?: string | null
    clusterType: string
    opportunityScore: number
    suggestedTitle: string
    suggestedSlug: string
    suggestedKeywords: string[]
    suggestedServiceFocus?: string | null
    sourceReason: string
    approvalStatus: EntitySeoOpportunityRecord['approval_status']
    publishStatus: EntitySeoOpportunityRecord['publish_status']
    contentAssetId?: string | null
    createdByRunId?: string | null
    sourceSignals?: Record<string, unknown>
    performance?: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as EntitySeoOpportunityRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entity_seo_opportunities')
    .upsert(
      rows.map((row) => ({
        entity_type: row.entityType,
        entity_name: row.entityName,
        city: row.city ?? null,
        state: row.state ?? null,
        cluster_type: row.clusterType,
        opportunity_score: row.opportunityScore,
        suggested_title: row.suggestedTitle,
        suggested_slug: row.suggestedSlug,
        suggested_keywords: row.suggestedKeywords,
        suggested_service_focus: row.suggestedServiceFocus ?? null,
        source_reason: row.sourceReason,
        approval_status: row.approvalStatus,
        publish_status: row.publishStatus,
        content_asset_id: row.contentAssetId ?? null,
        created_by_run_id: row.createdByRunId ?? null,
        source_signals_json: row.sourceSignals || {},
        performance_json: row.performance || {},
      })),
      { onConflict: 'suggested_slug' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as EntitySeoOpportunityRecord[]
}

export async function listEntitySeoOpportunities(filters: {
  city?: string | null
  state?: string | null
  entityType?: string | null
  serviceFocus?: string | null
  publishStatus?: string | null
  approvalStatus?: string | null
  limit?: number
}) {
  const admin = createAdminClient()
  let query = admin.from('entity_seo_opportunities').select('*').order('opportunity_score', { ascending: false }).order('updated_at', { ascending: false })
  if (filters.city && filters.city !== 'all') query = query.eq('city', filters.city)
  if (filters.state && filters.state !== 'all') query = query.eq('state', filters.state)
  if (filters.entityType && filters.entityType !== 'all') query = query.eq('entity_type', filters.entityType)
  if (filters.serviceFocus && filters.serviceFocus !== 'all') query = query.eq('suggested_service_focus', filters.serviceFocus)
  if (filters.publishStatus && filters.publishStatus !== 'all') query = query.eq('publish_status', filters.publishStatus)
  if (filters.approvalStatus && filters.approvalStatus !== 'all') query = query.eq('approval_status', filters.approvalStatus)
  if (filters.limit) query = query.limit(filters.limit)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as EntitySeoOpportunityRecord[]
}

export async function getEntitySeoOpportunity(id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('entity_seo_opportunities').select('*').eq('id', id).single()
  if (error) throw error
  return data as EntitySeoOpportunityRecord
}

export async function updateEntitySeoOpportunity(
  id: string,
  updates: Partial<{
    approval_status: EntitySeoOpportunityRecord['approval_status']
    publish_status: EntitySeoOpportunityRecord['publish_status']
    content_asset_id: string | null
    suggested_title: string
    suggested_slug: string
    suggested_keywords: string[]
    suggested_service_focus: string | null
    source_reason: string
    source_signals_json: Record<string, unknown>
    performance_json: Record<string, unknown>
    opportunity_score: number
  }>
) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('entity_seo_opportunities').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data as EntitySeoOpportunityRecord
}

export async function insertEntitySeoPerformanceSnapshots(
  rows: Array<{
    opportunityId: string
    contentAssetId?: string | null
    snapshotDate: string
    indexedStatus?: string | null
    publishStatus?: string | null
    performance: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as EntitySeoPerformanceSnapshotRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entity_seo_performance_snapshots')
    .upsert(
      rows.map((row) => ({
        opportunity_id: row.opportunityId,
        content_asset_id: row.contentAssetId ?? null,
        snapshot_date: row.snapshotDate,
        indexed_status: row.indexedStatus ?? null,
        publish_status: row.publishStatus ?? null,
        performance_json: row.performance,
      })),
      { onConflict: 'opportunity_id,snapshot_date' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as EntitySeoPerformanceSnapshotRecord[]
}
