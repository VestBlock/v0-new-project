import { createAdminClient } from '@/lib/supabase/admin'
import type {
  SamAlertRunRecord,
  SamAssistanceListingRecord,
  SamAwardIntelligenceRecord,
  SamDashboardSummary,
  SamEntityProfileRecord,
  SamExclusionCheckRecord,
  SamOpportunityDocumentRecord,
  SamOpportunityRecord,
  SamWatchlistMutationInput,
  SamWatchlistRecord,
} from '@/lib/sam/types'

export async function listActiveSamWatchlists() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_watchlists')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as SamWatchlistRecord[]
}

export async function listSamWatchlists(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_watchlists')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as SamWatchlistRecord[]
}

function normalizeWatchlistMutationInput(input: SamWatchlistMutationInput) {
  return {
    label: input.label,
    status: input.status || 'active',
    watch_type: input.watch_type || 'opportunity',
    owner_user_id: input.owner_user_id ?? null,
    lead_id: input.lead_id ?? null,
    user_email: input.user_email ?? null,
    company_name: input.company_name ?? null,
    keywords: input.keywords || [],
    naics_codes: input.naics_codes || [],
    solicitation_types: input.solicitation_types || [],
    set_asides: input.set_asides || [],
    agency_codes: input.agency_codes || [],
    organization_codes: input.organization_codes || [],
    applicant_types: input.applicant_types || [],
    beneficiary_types: input.beneficiary_types || [],
    assistance_types: input.assistance_types || [],
    states: input.states || [],
    zip_codes: input.zip_codes || [],
    response_deadline_days: input.response_deadline_days ?? null,
    notes: input.notes ?? null,
    metadata_json: input.metadata_json || {},
  }
}

export async function createSamWatchlist(input: SamWatchlistMutationInput) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_watchlists')
    .insert(normalizeWatchlistMutationInput(input))
    .select('*')
    .single()

  if (error) throw error
  return data as SamWatchlistRecord
}

export async function updateSamWatchlist(id: string, input: Partial<SamWatchlistMutationInput>) {
  const admin = createAdminClient()
  const currentMetadata =
    input.metadata_json !== undefined
      ? input.metadata_json
      : undefined

  const { data, error } = await admin
    .from('sam_watchlists')
    .update({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.watch_type !== undefined ? { watch_type: input.watch_type } : {}),
      ...(input.owner_user_id !== undefined ? { owner_user_id: input.owner_user_id } : {}),
      ...(input.lead_id !== undefined ? { lead_id: input.lead_id } : {}),
      ...(input.user_email !== undefined ? { user_email: input.user_email } : {}),
      ...(input.company_name !== undefined ? { company_name: input.company_name } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
      ...(input.naics_codes !== undefined ? { naics_codes: input.naics_codes } : {}),
      ...(input.solicitation_types !== undefined ? { solicitation_types: input.solicitation_types } : {}),
      ...(input.set_asides !== undefined ? { set_asides: input.set_asides } : {}),
      ...(input.agency_codes !== undefined ? { agency_codes: input.agency_codes } : {}),
      ...(input.organization_codes !== undefined ? { organization_codes: input.organization_codes } : {}),
      ...(input.applicant_types !== undefined ? { applicant_types: input.applicant_types } : {}),
      ...(input.beneficiary_types !== undefined ? { beneficiary_types: input.beneficiary_types } : {}),
      ...(input.assistance_types !== undefined ? { assistance_types: input.assistance_types } : {}),
      ...(input.states !== undefined ? { states: input.states } : {}),
      ...(input.zip_codes !== undefined ? { zip_codes: input.zip_codes } : {}),
      ...(input.response_deadline_days !== undefined
        ? { response_deadline_days: input.response_deadline_days }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(currentMetadata !== undefined ? { metadata_json: currentMetadata } : {}),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as SamWatchlistRecord
}

export async function deleteSamWatchlist(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('sam_watchlists').delete().eq('id', id)
  if (error) throw error
}

export async function ensureDefaultSamWatchlists() {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('sam_watchlists')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  if ((count || 0) > 0) {
    return listActiveSamWatchlists()
  }

  const defaults = [
    {
      label: 'Construction and facilities',
      company_name: 'VestBlock default',
      keywords: ['construction', 'facility', 'roofing', 'repair'],
      naics_codes: ['236220', '238160', '561210'],
      solicitation_types: ['o', 'k', 'p'],
      set_asides: ['SBA', '8A', 'HZC'],
      states: ['WI', 'IL', 'OH'],
      response_deadline_days: 21,
      metadata_json: { seeded: true, surface: 'sam-intelligence' },
    },
    {
      label: 'Janitorial and operations',
      company_name: 'VestBlock default',
      keywords: ['janitorial', 'custodial', 'cleaning'],
      naics_codes: ['561720'],
      solicitation_types: ['o', 'k', 'r'],
      set_asides: ['SBA', 'WOSB', 'SDVOSBC'],
      states: ['WI', 'IL', 'OH'],
      response_deadline_days: 14,
      metadata_json: { seeded: true, surface: 'sam-intelligence' },
    },
    {
      label: 'Technology and AI services',
      company_name: 'VestBlock default',
      keywords: ['software', 'digital', 'technology', 'AI'],
      naics_codes: ['541511', '541512', '518210'],
      solicitation_types: ['o', 'k', 'r'],
      set_asides: ['SBA', '8A', 'WOSB'],
      states: ['WI', 'IL', 'OH', 'TX'],
      response_deadline_days: 30,
      metadata_json: { seeded: true, surface: 'sam-intelligence' },
    },
  ]

  const { error: insertError } = await admin.from('sam_watchlists').insert(defaults)
  if (insertError) throw insertError
  return listActiveSamWatchlists()
}

export async function upsertSamOpportunities(
  rows: Array<{
    dedupe_key: string
    notice_id?: string | null
    solicitation_number?: string | null
    source_key?: string
    title: string
    opportunity_type?: string | null
    base_type?: string | null
    active_status?: string | null
    posted_date?: string | null
    response_deadline?: string | null
    naics_code?: string | null
    classification_code?: string | null
    set_aside_code?: string | null
    set_aside_description?: string | null
    department_name?: string | null
    agency_name?: string | null
    office_name?: string | null
    organization_path_name?: string | null
    organization_path_code?: string | null
    organization_type?: string | null
    state?: string | null
    city?: string | null
    zip?: string | null
    place_of_performance_json?: Record<string, unknown>
    office_address_json?: Record<string, unknown>
    point_of_contact_json?: Array<Record<string, unknown>>
    award_json?: Record<string, unknown>
    resource_links?: string[]
    description_url?: string | null
    additional_info_link?: string | null
    ui_link?: string | null
    description_excerpt?: string | null
    watchlist_match_count?: number
    lead_match_count?: number
    urgency_score?: number
    best_offer?: string | null
    bid_recommendation_json?: Record<string, unknown>
    summary_json?: Record<string, unknown>
    status?: SamOpportunityRecord['status']
    first_seen_at?: string
    last_seen_at?: string
    raw_json?: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as SamOpportunityRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_opportunities')
    .upsert(
      rows.map((row) => ({
        ...row,
        source_key: row.source_key || 'sam_opportunities_api',
        place_of_performance_json: row.place_of_performance_json || {},
        office_address_json: row.office_address_json || {},
        point_of_contact_json: row.point_of_contact_json || [],
        award_json: row.award_json || {},
        resource_links: row.resource_links || [],
        bid_recommendation_json: row.bid_recommendation_json || {},
        summary_json: row.summary_json || {},
        raw_json: row.raw_json || {},
        first_seen_at: row.first_seen_at || new Date().toISOString(),
        last_seen_at: row.last_seen_at || new Date().toISOString(),
        status: row.status || 'active',
      })),
      { onConflict: 'dedupe_key' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamOpportunityRecord[]
}

export async function listSamOpportunitiesForMatching(limit = 150) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_opportunities')
    .select('*')
    .in('status', ['active', 'matched'])
    .order('response_deadline', { ascending: true, nullsFirst: false })
    .order('posted_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as SamOpportunityRecord[]
}

export async function upsertSamOpportunityDocuments(
  rows: Array<{
    opportunity_id: string
    document_type: SamOpportunityDocumentRecord['document_type']
    title?: string | null
    source_url: string
    fetch_status: SamOpportunityDocumentRecord['fetch_status']
    content_text?: string | null
    content_json?: Record<string, unknown>
    content_sha256?: string | null
    error_message?: string | null
    fetched_at?: string | null
  }>
) {
  if (!rows.length) return [] as SamOpportunityDocumentRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_opportunity_documents')
    .upsert(
      rows.map((row) => ({
        ...row,
        content_json: row.content_json || {},
      })),
      { onConflict: 'opportunity_id,source_url' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamOpportunityDocumentRecord[]
}

export async function upsertSamEntityProfiles(
  rows: Array<{
    uei_sam: string
    legal_business_name?: string | null
    dba_name?: string | null
    sam_registered?: string | null
    registration_status?: string | null
    purpose_of_registration?: string | null
    exclusion_status_flag?: string | null
    entity_structure?: string | null
    business_types?: string[]
    naics_codes?: string[]
    psc_codes?: string[]
    address_json?: Record<string, unknown>
    points_of_contact_json?: Array<Record<string, unknown>>
    integrity_json?: Record<string, unknown>
    responsibility_information_count?: number
    latest_exclusion_url?: string | null
    source_version?: string | null
    raw_json?: Record<string, unknown>
    last_synced_at?: string
  }>
) {
  if (!rows.length) return [] as SamEntityProfileRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_entity_profiles')
    .upsert(
      rows.map((row) => ({
        ...row,
        business_types: row.business_types || [],
        naics_codes: row.naics_codes || [],
        psc_codes: row.psc_codes || [],
        address_json: row.address_json || {},
        points_of_contact_json: row.points_of_contact_json || [],
        integrity_json: row.integrity_json || {},
        raw_json: row.raw_json || {},
        last_synced_at: row.last_synced_at || new Date().toISOString(),
      })),
      { onConflict: 'uei_sam' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamEntityProfileRecord[]
}

export async function insertSamExclusionChecks(
  rows: Array<{
    subject_type: SamExclusionCheckRecord['subject_type']
    subject_id?: string | null
    subject_label?: string | null
    uei_sam?: string | null
    legal_business_name?: string | null
    exclusion_name?: string | null
    exclusion_type?: string | null
    classification?: string | null
    exclusion_record_id?: string | null
    excluding_agency_name?: string | null
    excluding_agency_code?: string | null
    active_exclusion?: boolean
    match_status: SamExclusionCheckRecord['match_status']
    exclusion_url?: string | null
    checked_at?: string
    raw_json?: Record<string, unknown>
    metadata_json?: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as SamExclusionCheckRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_exclusion_checks')
    .insert(
      rows.map((row) => ({
        ...row,
        active_exclusion: row.active_exclusion ?? false,
        checked_at: row.checked_at || new Date().toISOString(),
        raw_json: row.raw_json || {},
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamExclusionCheckRecord[]
}

export async function startSamAlertRun(input: {
  run_type: SamAlertRunRecord['run_type']
  watchlist_id?: string | null
  request_params?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_alert_runs')
    .insert({
      run_type: input.run_type,
      watchlist_id: input.watchlist_id ?? null,
      request_params: input.request_params || {},
      status: 'running',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as SamAlertRunRecord
}

export async function finishSamAlertRun(
  runId: string,
  input: {
    status: SamAlertRunRecord['status']
    result_summary?: Record<string, unknown>
    sent_count?: number
    matched_count?: number
    skipped_count?: number
    error_message?: string | null
  }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_alert_runs')
    .update({
      status: input.status,
      result_summary: input.result_summary || {},
      sent_count: input.sent_count ?? 0,
      matched_count: input.matched_count ?? 0,
      skipped_count: input.skipped_count ?? 0,
      error_message: input.error_message ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) throw error
  return data as SamAlertRunRecord
}

export async function upsertSamAwardIntelligence(
  rows: Array<{
    opportunity_id?: string | null
    dedupe_key: string
    notice_id?: string | null
    award_number?: string | null
    awardee_name?: string | null
    awardee_uei_sam?: string | null
    award_amount?: number | null
    award_date?: string | null
    department_name?: string | null
    agency_name?: string | null
    office_name?: string | null
    naics_code?: string | null
    set_aside_code?: string | null
    title?: string | null
    place_of_performance_json?: Record<string, unknown>
    raw_json?: Record<string, unknown>
    tracked_competitor?: boolean
    watchlist_match_count?: number
  }>
) {
  if (!rows.length) return [] as SamAwardIntelligenceRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_award_intelligence')
    .upsert(
      rows.map((row) => ({
        ...row,
        place_of_performance_json: row.place_of_performance_json || {},
        raw_json: row.raw_json || {},
        tracked_competitor: row.tracked_competitor ?? false,
        watchlist_match_count: row.watchlist_match_count ?? 0,
      })),
      { onConflict: 'dedupe_key' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamAwardIntelligenceRecord[]
}

export async function upsertSamAssistanceListings(
  rows: Array<{
    assistance_listing_id: string
    title: string
    status?: string | null
    agency_name?: string | null
    department_name?: string | null
    office_name?: string | null
    assistance_types?: string[]
    applicant_types?: string[]
    beneficiary_types?: string[]
    published_date?: string | null
    program_url?: string | null
    summary_text?: string | null
    raw_json?: Record<string, unknown>
  }>
) {
  if (!rows.length) return [] as SamAssistanceListingRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_assistance_listings')
    .upsert(
      rows.map((row) => ({
        ...row,
        assistance_types: row.assistance_types || [],
        applicant_types: row.applicant_types || [],
        beneficiary_types: row.beneficiary_types || [],
        raw_json: row.raw_json || {},
      })),
      { onConflict: 'assistance_listing_id' }
    )
    .select('*')

  if (error) throw error
  return (data || []) as SamAssistanceListingRecord[]
}

export async function updateSamOpportunityInsight(input: {
  opportunityId: string
  watchlistMatchCount?: number
  leadMatchCount?: number
  urgencyScore?: number
  bestOffer?: string | null
  bidRecommendationJson?: Record<string, unknown>
  summaryJson?: Record<string, unknown>
  status?: SamOpportunityRecord['status']
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_opportunities')
    .update({
      watchlist_match_count: input.watchlistMatchCount,
      lead_match_count: input.leadMatchCount,
      urgency_score: input.urgencyScore,
      best_offer: input.bestOffer ?? null,
      bid_recommendation_json: input.bidRecommendationJson || {},
      summary_json: input.summaryJson || {},
      status: input.status,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', input.opportunityId)
    .select('*')
    .single()

  if (error) throw error
  return data as SamOpportunityRecord
}

export async function listRecentSamAlertRuns(limit = 10) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sam_alert_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as SamAlertRunRecord[]
}

export async function getSamDashboardSummary(): Promise<SamDashboardSummary> {
  const admin = createAdminClient()
  const [
    watchlistsResult,
    opportunitiesResult,
    documentsResult,
    exclusionsResult,
    awardsResult,
    assistanceResult,
    runsResult,
  ] = await Promise.all([
    admin.from('sam_watchlists').select('*').order('created_at', { ascending: true }).limit(50),
    admin
      .from('sam_opportunities')
      .select('*')
      .order('response_deadline', { ascending: true, nullsFirst: false })
      .order('posted_date', { ascending: false })
      .limit(50),
    admin
      .from('sam_opportunity_documents')
      .select('*')
      .order('fetched_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(30),
    admin.from('sam_exclusion_checks').select('*').order('checked_at', { ascending: false }).limit(20),
    admin.from('sam_award_intelligence').select('*').order('award_date', { ascending: false }).limit(30),
    admin.from('sam_assistance_listings').select('*').order('published_date', { ascending: false }).limit(30),
    admin.from('sam_alert_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ])

  if (watchlistsResult.error) throw watchlistsResult.error
  if (opportunitiesResult.error) throw opportunitiesResult.error
  if (documentsResult.error) throw documentsResult.error
  if (exclusionsResult.error) throw exclusionsResult.error
  if (awardsResult.error) throw awardsResult.error
  if (assistanceResult.error) throw assistanceResult.error
  if (runsResult.error) throw runsResult.error

  const opportunities = (opportunitiesResult.data || []) as SamOpportunityRecord[]
  const recentDocuments = (documentsResult.data || []) as SamOpportunityDocumentRecord[]
  const awards = (awardsResult.data || []) as SamAwardIntelligenceRecord[]
  const hotOpportunities = opportunities
    .filter((row) => row.status !== 'dismissed')
    .sort((a, b) => (Number(b.urgency_score || 0) - Number(a.urgency_score || 0)))
    .slice(0, 12)

  const agencyMap = new Map<string, { opportunityCount: number; awardCount: number; naicsCodes: Set<string> }>()
  for (const opportunity of opportunities) {
    const key = opportunity.agency_name || 'Unknown agency'
    const current = agencyMap.get(key) || { opportunityCount: 0, awardCount: 0, naicsCodes: new Set<string>() }
    current.opportunityCount += 1
    if (opportunity.naics_code) current.naicsCodes.add(opportunity.naics_code)
    agencyMap.set(key, current)
  }
  for (const award of awards) {
    const key = award.agency_name || 'Unknown agency'
    const current = agencyMap.get(key) || { opportunityCount: 0, awardCount: 0, naicsCodes: new Set<string>() }
    current.awardCount += 1
    if (award.naics_code) current.naicsCodes.add(award.naics_code)
    agencyMap.set(key, current)
  }

  const naicsMap = new Map<string, { opportunityCount: number; awardCount: number }>()
  for (const opportunity of opportunities) {
    const key = opportunity.naics_code || 'Unknown'
    const current = naicsMap.get(key) || { opportunityCount: 0, awardCount: 0 }
    current.opportunityCount += 1
    naicsMap.set(key, current)
  }
  for (const award of awards) {
    const key = award.naics_code || 'Unknown'
    const current = naicsMap.get(key) || { opportunityCount: 0, awardCount: 0 }
    current.awardCount += 1
    naicsMap.set(key, current)
  }

  return {
    watchlists: (watchlistsResult.data || []) as SamWatchlistRecord[],
    opportunities,
    hotOpportunities,
    recentDocuments,
    exclusionChecks: (exclusionsResult.data || []) as SamExclusionCheckRecord[],
    awards,
    assistanceListings: (assistanceResult.data || []) as SamAssistanceListingRecord[],
    recentRuns: (runsResult.data || []) as SamAlertRunRecord[],
    documentSummary: {
      fetched: recentDocuments.filter((row) => row.fetch_status === 'fetched').length,
      queued: recentDocuments.filter((row) => row.fetch_status === 'queued').length,
      failed: recentDocuments.filter((row) => row.fetch_status === 'failed').length,
      skipped: recentDocuments.filter((row) => row.fetch_status === 'skipped').length,
    },
    agencyPerformance: Array.from(agencyMap.entries())
      .map(([agencyName, value]) => ({
        agencyName,
        opportunityCount: value.opportunityCount,
        awardCount: value.awardCount,
        topNaicsCodes: Array.from(value.naicsCodes).slice(0, 4),
      }))
      .sort((a, b) => b.opportunityCount - a.opportunityCount)
      .slice(0, 12),
    naicsPerformance: Array.from(naicsMap.entries())
      .map(([naicsCode, value]) => ({
        naicsCode,
        opportunityCount: value.opportunityCount,
        awardCount: value.awardCount,
      }))
      .sort((a, b) => b.opportunityCount - a.opportunityCount)
      .slice(0, 12),
  }
}
