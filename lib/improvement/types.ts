export type ImprovementRunType =
  | 'daily_review'
  | 'research_digest'
  | 'outreach_optimization'
  | 'market_optimization'
  | 'content_optimization'
  | 'credit_funding_optimization'

export type ImprovementSeverity = 'info' | 'watch' | 'action'
export type ImprovementRunStatus = 'running' | 'completed' | 'failed'
export type StrategyRiskLevel = 'low' | 'medium' | 'high'
export type StrategyApprovalStatus = 'queued' | 'approved' | 'rejected' | 'auto_applied'
export type ImprovementPriority = 'low' | 'medium' | 'high'

export type ImprovementRunRecord = {
  id: string
  run_type: ImprovementRunType
  status: ImprovementRunStatus
  window_started_at: string | null
  window_ended_at: string | null
  summary_json: Record<string, unknown>
  data_sources_json: Array<Record<string, unknown>>
  auto_applied_count: number
  queued_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export type ImprovementInsightRecord = {
  id: string
  run_id: string
  category: string
  severity: ImprovementSeverity
  title: string
  summary: string
  supporting_data: Record<string, unknown>
  recommendation: string | null
  confidence: number
  auto_applied: boolean
  created_at: string
  updated_at: string
}

export type ResearchBriefRecord = {
  id: string
  theme: string
  source_type: string
  source_url: string | null
  source_title: string | null
  brief_title: string
  summary: string
  recommendations_json: string[]
  priority: ImprovementPriority
  status: 'new' | 'reviewed' | 'archived'
  created_by_run_id: string | null
  created_at: string
  updated_at: string
}

export type StrategyUpdateRecord = {
  id: string
  run_id: string | null
  category: string
  target_type: string
  target_key: string
  risk_level: StrategyRiskLevel
  approval_status: StrategyApprovalStatus
  title: string
  rationale: string
  proposed_change_json: Record<string, unknown>
  applied_change_json: Record<string, unknown>
  requires_admin_review: boolean
  approved_by_user_id: string | null
  approved_at: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
}

export type ExperimentResultRecord = {
  id: string
  run_id: string | null
  experiment_key: string
  category: string
  variant_key: string
  baseline_key: string | null
  metrics_json: Record<string, unknown>
  winner: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type PromptVersionRecord = {
  id: string
  surface: string
  segment_key: string
  version_label: string
  prompt_text: string
  status: 'draft' | 'active' | 'archived'
  created_by_run_id: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ScoreAdjustmentRecord = {
  id: string
  scope_type: 'global' | 'city_state' | 'niche' | 'category' | 'best_offer' | 'language_segment'
  scope_key: string
  score_delta: number
  reason: string
  confidence: number
  status: 'proposed' | 'active' | 'archived'
  source_run_id: string | null
  created_at: string
  updated_at: string
}

export type OutreachVariantRecord = {
  id: string
  segment_type: 'city_state' | 'niche' | 'best_offer' | 'language' | 'category'
  segment_key: string
  channel: 'sms' | 'email' | 'facebook_dm' | 'instagram_dm' | 'phone_script'
  language: 'en' | 'es'
  opener: string | null
  body_guidance: string | null
  cta: string | null
  performance_json: Record<string, unknown>
  status: 'proposed' | 'active' | 'archived'
  source_run_id: string | null
  created_at: string
  updated_at: string
}

export type MarketPerformanceSnapshotRecord = {
  id: string
  run_id: string | null
  target_market_id: string | null
  city: string
  state: string
  niche: string | null
  leads_found: number
  sent_count: number
  reply_count: number
  booked_count: number
  bounce_count: number
  quality_score: number
  snapshot_date: string
  metrics_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type MethodPerformanceSnapshotRecord = {
  id: string
  run_id: string | null
  method_type: string
  method_key: string
  assigned_count: number
  completed_count: number
  stalled_count: number
  response_count: number
  snapshot_date: string
  metrics_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DailyOperatorReportRecord = {
  id: string
  run_id: string | null
  report_date: string
  summary_json: Record<string, unknown>
  html_digest: string | null
  created_at: string
  updated_at: string
}

export type ContinuousImprovementSummary = {
  bestCity: string | null
  bestNiche: string | null
  bestOffer: string | null
  bestOutreachAngle: string | null
  topSeoOpportunity: string | null
  topSpanishOpportunity: string | null
  topCreditFundingOpportunity: string | null
  leadsCreated: number
  outreachApproved: number
  outreachSent: number
  outreachReplied: number
  outreachBounced: number
  contentPublished: number
  disputeLettersGenerated: number
  disputeLettersMailed: number
  fundingProfilesSaved: number
  fundingRecommendationsGenerated: number
  serviceDeliverablesSent: number
  overdueTasks: number
  topWins: string[]
  biggestLosses: string[]
  recommendedActions: string[]
}

export type ImprovementDashboardSnapshot = {
  latestRun: ImprovementRunRecord | null
  report: DailyOperatorReportRecord | null
  queuedUpdates: StrategyUpdateRecord[]
  recentResearch: ResearchBriefRecord[]
  recentExperiments: ExperimentResultRecord[]
  activeAdjustments: ScoreAdjustmentRecord[]
  activeVariants: OutreachVariantRecord[]
  recentInsights: ImprovementInsightRecord[]
}
