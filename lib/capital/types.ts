export const capitalCaseTypes = [
  'business_funding',
  'real_estate_funding',
  'business_acquisition',
  'business_credit',
  'grants_programs',
  'capital_provider',
] as const

export const capitalCaseStatuses = [
  'draft',
  'submitted',
  'needs_information',
  'under_review',
  'readiness_plan',
  'ready_for_provider_review',
  'provider_review',
  'approved',
  'declined',
  'withdrawn',
  'closed',
] as const

export type CapitalCaseType = (typeof capitalCaseTypes)[number]
export type CapitalCaseStatus = (typeof capitalCaseStatuses)[number]

export const capitalCaseTransitions: Record<CapitalCaseStatus, CapitalCaseStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['needs_information', 'under_review', 'withdrawn'],
  needs_information: ['submitted', 'under_review', 'withdrawn'],
  under_review: ['needs_information', 'readiness_plan', 'ready_for_provider_review', 'declined', 'withdrawn'],
  readiness_plan: ['needs_information', 'under_review', 'ready_for_provider_review', 'closed', 'withdrawn'],
  ready_for_provider_review: ['provider_review', 'readiness_plan', 'declined', 'withdrawn'],
  provider_review: ['approved', 'declined', 'needs_information', 'withdrawn'],
  approved: ['closed'],
  declined: ['readiness_plan', 'closed'],
  withdrawn: ['closed'],
  closed: [],
}

export type CapitalCaseRecord = {
  id: string
  user_id: string | null
  case_type: CapitalCaseType
  status: CapitalCaseStatus
  full_name: string
  email: string
  phone: string | null
  organization_name: string | null
  amount_requested: number | null
  purpose: string | null
  timing: string | null
  geography: string | null
  communication_preference: 'email' | 'phone' | 'either'
  analysis_consent: boolean
  provider_sharing_consent: boolean
  marketing_consent: boolean
  intake_data: Record<string, unknown>
  readiness_score: number
  readiness_tier: 'incomplete' | 'preparing' | 'developing' | 'review_ready' | 'strong_file'
  readiness_feedback: {
    strengths?: string[]
    gaps?: string[]
    nextSteps?: string[]
    summary?: string
  }
  required_documents: string[]
  available_documents: string[]
  missing_documents: string[]
  provider_criteria: Record<string, unknown>
  lead_id: string | null
  lender_id: string | null
  operator_task_id: string | null
  assigned_to: string | null
  last_status_note: string | null
  submitted_at: string | null
  last_status_changed_at: string
  created_at: string
  updated_at: string
}

export type CapitalCaseEvent = {
  id: string
  capital_case_id: string
  actor_user_id: string | null
  event_type: string
  from_status: CapitalCaseStatus | null
  to_status: CapitalCaseStatus | null
  note: string | null
  metadata_json: Record<string, unknown>
  created_at: string
}
