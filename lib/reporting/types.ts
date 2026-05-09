export type DailyGrowthReportRecord = {
  id: string
  report_date: string
  leads_summary: Record<string, unknown>
  lenders_summary: Record<string, unknown>
  buyers_summary: Record<string, unknown>
  users_summary: Record<string, unknown>
  seo_summary: Record<string, unknown>
  top_cities: Array<Record<string, unknown>>
  top_niches: Array<Record<string, unknown>>
  top_offers: Array<Record<string, unknown>>
  recommended_actions: string[]
  summary_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DailyGrowthReportSectionRecord = {
  id: string
  report_id: string
  section_key: string
  section_title: string
  summary_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type EntitySeoRunRecord = {
  id: string
  run_type: 'daily_scan' | 'manual_publish' | 'manual_refresh' | 'performance_snapshot'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial'
  result_count: number
  auto_published_count: number
  request_params: Record<string, unknown>
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export type EntitySeoOpportunityRecord = {
  id: string
  entity_type: 'lead_segment' | 'lender_segment' | 'buyer_segment' | 'city' | 'niche' | 'service'
  entity_name: string
  city: string | null
  state: string | null
  cluster_type: string
  opportunity_score: number
  suggested_title: string
  suggested_slug: string
  suggested_keywords: string[]
  suggested_service_focus: string | null
  source_reason: string
  approval_status: 'draft' | 'suggested' | 'ready' | 'needs_review' | 'approved' | 'published' | 'rejected'
  publish_status: 'not_started' | 'queued' | 'published' | 'failed' | 'skipped'
  content_asset_id: string | null
  created_by_run_id: string | null
  source_signals_json: Record<string, unknown>
  performance_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type EntitySeoPerformanceSnapshotRecord = {
  id: string
  opportunity_id: string
  content_asset_id: string | null
  snapshot_date: string
  indexed_status: string | null
  publish_status: string | null
  performance_json: Record<string, unknown>
  created_at: string
}

export type DailyIntelligenceSummary = {
  reportDate: string
  leads: Record<string, unknown>
  lenders: Record<string, unknown>
  buyers: Record<string, unknown>
  users: Record<string, unknown>
  seo: Record<string, unknown>
  topCities: Array<Record<string, unknown>>
  topNiches: Array<Record<string, unknown>>
  topOffers: Array<Record<string, unknown>>
  bestCity: string | null
  bestNiche: string | null
  bestLeadCategory: string | null
  bestLenderSegment: string | null
  bestBuyerSegment: string | null
  bestSeoOpportunity: string | null
  recommendedActions: string[]
}
