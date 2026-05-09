export type SamOpportunitySearchInput = {
  keywords?: string[]
  naicsCodes?: string[]
  solicitationTypes?: string[]
  setAsideCodes?: string[]
  agencyCodes?: string[]
  organizationCodes?: string[]
  state?: string
  zip?: string
  postedFrom: string
  postedTo: string
  responseDeadlineFrom?: string
  responseDeadlineTo?: string
  limit?: number
}

export type SamWatchlistRecord = {
  id: string
  label: string
  status: 'active' | 'paused' | 'archived'
  watch_type: 'opportunity' | 'competitor' | 'assistance'
  owner_user_id?: string | null
  lead_id?: string | null
  user_email?: string | null
  company_name?: string | null
  keywords: string[]
  naics_codes: string[]
  solicitation_types: string[]
  set_asides: string[]
  agency_codes: string[]
  organization_codes: string[]
  applicant_types: string[]
  beneficiary_types: string[]
  assistance_types: string[]
  states: string[]
  zip_codes: string[]
  response_deadline_days?: number | null
  notes?: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SamWatchlistMutationInput = {
  label: string
  status?: SamWatchlistRecord['status']
  watch_type?: SamWatchlistRecord['watch_type']
  owner_user_id?: string | null
  lead_id?: string | null
  user_email?: string | null
  company_name?: string | null
  keywords?: string[]
  naics_codes?: string[]
  solicitation_types?: string[]
  set_asides?: string[]
  agency_codes?: string[]
  organization_codes?: string[]
  applicant_types?: string[]
  beneficiary_types?: string[]
  assistance_types?: string[]
  states?: string[]
  zip_codes?: string[]
  response_deadline_days?: number | null
  notes?: string | null
  metadata_json?: Record<string, unknown>
}

export type SamOpportunityRecord = {
  id: string
  dedupe_key: string
  notice_id?: string | null
  solicitation_number?: string | null
  source_key: string
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
  place_of_performance_json: Record<string, unknown>
  office_address_json: Record<string, unknown>
  point_of_contact_json: Array<Record<string, unknown>>
  award_json: Record<string, unknown>
  resource_links: string[]
  description_url?: string | null
  additional_info_link?: string | null
  ui_link?: string | null
  description_excerpt?: string | null
  watchlist_match_count: number
  lead_match_count: number
  urgency_score: number
  best_offer?: string | null
  bid_recommendation_json: Record<string, unknown>
  summary_json: Record<string, unknown>
  status: 'active' | 'archived' | 'matched' | 'dismissed'
  first_seen_at: string
  last_seen_at: string
  raw_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SamOpportunityDocumentRecord = {
  id: string
  opportunity_id: string
  document_type: 'description' | 'attachment' | 'additional_info'
  title?: string | null
  source_url: string
  fetch_status: 'queued' | 'fetched' | 'skipped' | 'failed'
  content_text?: string | null
  content_json: Record<string, unknown>
  content_sha256?: string | null
  error_message?: string | null
  fetched_at?: string | null
  created_at: string
  updated_at: string
}

export type SamEntityProfileRecord = {
  id: string
  uei_sam: string
  legal_business_name?: string | null
  dba_name?: string | null
  sam_registered?: string | null
  registration_status?: string | null
  purpose_of_registration?: string | null
  exclusion_status_flag?: string | null
  entity_structure?: string | null
  business_types: string[]
  naics_codes: string[]
  psc_codes: string[]
  address_json: Record<string, unknown>
  points_of_contact_json: Array<Record<string, unknown>>
  integrity_json: Record<string, unknown>
  responsibility_information_count: number
  latest_exclusion_url?: string | null
  source_version?: string | null
  raw_json: Record<string, unknown>
  last_synced_at: string
  created_at: string
  updated_at: string
}

export type SamExclusionCheckRecord = {
  id: string
  subject_type: 'lead' | 'watchlist' | 'entity' | 'partner' | 'manual'
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
  active_exclusion: boolean
  match_status: 'no_match' | 'possible_match' | 'confirmed_match' | 'error'
  exclusion_url?: string | null
  checked_at: string
  raw_json: Record<string, unknown>
  metadata_json: Record<string, unknown>
  created_at: string
}

export type SamAlertRunRecord = {
  id: string
  run_type:
    | 'opportunity_ingest'
    | 'match_scoring'
    | 'exclusion_recheck'
    | 'award_monitor'
    | 'assistance_refresh'
    | 'alert_delivery'
  status: 'running' | 'completed' | 'partial' | 'failed'
  watchlist_id?: string | null
  request_params: Record<string, unknown>
  result_summary: Record<string, unknown>
  sent_count: number
  matched_count: number
  skipped_count: number
  error_message?: string | null
  started_at: string
  completed_at?: string | null
}

export type SamAwardIntelligenceRecord = {
  id: string
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
  place_of_performance_json: Record<string, unknown>
  raw_json: Record<string, unknown>
  tracked_competitor: boolean
  watchlist_match_count: number
  created_at: string
  updated_at: string
}

export type SamAssistanceListingRecord = {
  id: string
  assistance_listing_id: string
  title: string
  status?: string | null
  agency_name?: string | null
  department_name?: string | null
  office_name?: string | null
  assistance_types: string[]
  applicant_types: string[]
  beneficiary_types: string[]
  published_date?: string | null
  program_url?: string | null
  summary_text?: string | null
  raw_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SamDashboardSummary = {
  watchlists: SamWatchlistRecord[]
  opportunities: SamOpportunityRecord[]
  hotOpportunities: SamOpportunityRecord[]
  recentDocuments: SamOpportunityDocumentRecord[]
  exclusionChecks: SamExclusionCheckRecord[]
  awards: SamAwardIntelligenceRecord[]
  assistanceListings: SamAssistanceListingRecord[]
  recentRuns: SamAlertRunRecord[]
  documentSummary: {
    fetched: number
    queued: number
    failed: number
    skipped: number
  }
  agencyPerformance: Array<{
    agencyName: string
    opportunityCount: number
    awardCount: number
    topNaicsCodes: string[]
  }>
  naicsPerformance: Array<{
    naicsCode: string
    opportunityCount: number
    awardCount: number
  }>
}
