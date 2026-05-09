export const prTargetTypes = [
  'newsletter',
  'directory',
  'journalist',
  'podcast',
  'community',
  'partner',
  'award',
  'expert_source',
  'chamber',
  'group',
] as const

export const prTargetCategories = [
  'minority_business',
  'hispanic_business',
  'black_business',
  'women_owned_business',
  'immigrant_business',
  'local_small_business',
  'chamber',
  'startup',
  'fintech',
  'automation',
  'government_contracting',
] as const

export const prDiscoverySources = [
  'manual',
  'city_expansion_seed',
  'category_seed',
  'weekly_learning',
  'operator_research',
] as const

export const prRunTypes = [
  'target_discovery',
  'city_expansion',
  'pitch_generation',
  'follow_up_enforcement',
  'weekly_learning',
] as const

export const prTargetStatuses = [
  'new',
  'researching',
  'ready',
  'pitched',
  'submitted',
  'follow_up_due',
  'won',
  'not_a_fit',
  'archived',
] as const

export const prPriorities = ['low', 'normal', 'high', 'urgent'] as const

export const prPitchChannels = ['email', 'form', 'dm', 'application', 'quote'] as const

export const prDraftStatuses = ['draft', 'approved', 'sent', 'archived'] as const

export const prActivityTypes = [
  'submission',
  'follow_up',
  'reply',
  'feature',
  'rejection',
  'note',
] as const

export const prActivityStatuses = [
  'queued',
  'sent',
  'waiting',
  'won',
  'lost',
  'archived',
] as const

export type PrTargetType = (typeof prTargetTypes)[number]
export type PrTargetCategory = (typeof prTargetCategories)[number]
export type PrDiscoverySource = (typeof prDiscoverySources)[number]
export type PrTargetStatus = (typeof prTargetStatuses)[number]
export type PrPriority = (typeof prPriorities)[number]
export type PrPitchChannel = (typeof prPitchChannels)[number]
export type PrDraftStatus = (typeof prDraftStatuses)[number]
export type PrActivityType = (typeof prActivityTypes)[number]
export type PrActivityStatus = (typeof prActivityStatuses)[number]
export type PrRunType = (typeof prRunTypes)[number]

export type PrTargetRecord = {
  id: string
  dedupe_key: string
  label: string
  organization_name: string | null
  contact_name: string | null
  contact_email: string | null
  target_type: PrTargetType
  target_category: PrTargetCategory
  audience_type: string | null
  audience_url: string | null
  submission_url: string | null
  city: string | null
  state: string | null
  metro_area: string | null
  discovery_source: PrDiscoverySource
  source_query: string | null
  status: PrTargetStatus
  priority: PrPriority
  fit_score: number
  revenue_score: number
  authority_score: number
  response_probability_score: number
  business_audience_score: number
  backlink_score: number
  funding_angle_score: number
  city_priority_score: number
  owner_user_id: string | null
  geography: string[]
  angle_tags: string[]
  notes: string | null
  metadata_json: Record<string, unknown>
  last_contacted_at: string | null
  next_follow_up_at: string | null
  last_result: string | null
  created_at: string
  updated_at: string
}

export type PrPitchDraftRecord = {
  id: string
  target_id: string
  title: string
  pitch_channel: PrPitchChannel
  subject_line: string | null
  preview_text: string | null
  body_markdown: string
  founder_bio: string | null
  key_points: string[]
  call_to_action: string | null
  status: PrDraftStatus
  source_prompt: string | null
  model: string | null
  metadata_json: Record<string, unknown>
  generated_at: string
  approved_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type PrOutreachRecord = {
  id: string
  target_id: string
  draft_id: string | null
  activity_type: PrActivityType
  channel: PrPitchChannel | 'other'
  status: PrActivityStatus
  subject: string | null
  message_excerpt: string | null
  destination: string | null
  sent_at: string | null
  responded_at: string | null
  next_follow_up_at: string | null
  outcome: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PrAngleTemplate = {
  id: string
  label: string
  description: string
  use_case: string
  ideal_targets: string[]
  sample_hooks: string[]
  target_categories?: PrTargetCategory[]
}

export type PrDashboardSummary = {
  totalTargets: number
  readyToPitch: number
  approvedDrafts: number
  followUpDue: number
  wins: number
  urgentTargets: number
  targetsByType: Array<{ type: string; count: number }>
  targetsByCategory: Array<{ category: string; count: number }>
  topCities: Array<{ city: string; count: number; wins: number }>
  bestImmediateMove: string
}

export type PrRunRecord = {
  id: string
  run_type: PrRunType
  status: 'running' | 'completed' | 'partial' | 'failed'
  city: string | null
  state: string | null
  target_category: PrTargetCategory | null
  summary_json: Record<string, unknown>
  created_target_count: number
  created_draft_count: number
  created_task_count: number
  started_at: string
  completed_at: string | null
}

export type PrLearningSnapshotRecord = {
  id: string
  run_id: string | null
  snapshot_type: 'angle' | 'category' | 'city' | 'operator'
  angle_key: string | null
  target_category: PrTargetCategory | null
  city: string | null
  state: string | null
  metrics_json: Record<string, unknown>
  recommendation: string | null
  created_at: string
}

export type PrEngineDashboard = {
  summary: PrDashboardSummary
  targets: PrTargetRecord[]
  drafts: Array<PrPitchDraftRecord & { target?: Pick<PrTargetRecord, 'id' | 'label' | 'status'> | null }>
  outreach: Array<PrOutreachRecord & { target?: Pick<PrTargetRecord, 'id' | 'label' | 'status'> | null }>
  followUpQueue: Array<PrTargetRecord>
  angleLibrary: PrAngleTemplate[]
  recentRuns: PrRunRecord[]
  learningSnapshots: PrLearningSnapshotRecord[]
}
