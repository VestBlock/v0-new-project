export const sellerCaseStatuses = [
  'draft',
  'submitted',
  'needs_information',
  'under_review',
  'options_review',
  'declined',
  'withdrawn',
  'closed',
] as const

export type SellerCaseStatus = (typeof sellerCaseStatuses)[number]

export const sellerCaseTransitions: Record<SellerCaseStatus, SellerCaseStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['needs_information', 'under_review', 'withdrawn'],
  needs_information: ['submitted', 'under_review', 'withdrawn'],
  under_review: ['needs_information', 'options_review', 'declined', 'withdrawn'],
  options_review: ['needs_information', 'under_review', 'declined', 'withdrawn', 'closed'],
  declined: ['closed'],
  withdrawn: ['closed'],
  closed: [],
}

export type SellerCaseRecord = {
  id: string
  user_id: string | null
  status: SellerCaseStatus
  seller_name: string
  email: string
  phone: string
  property_address: string
  city: string
  state: string
  postal_code: string
  property_type: string
  bedrooms: number | null
  bathrooms: number | null
  property_condition: string
  occupancy_status: string
  timeline_to_sell: string
  reason_for_selling: string
  preferred_sale_path: string
  estimated_value: number | null
  asking_price: number | null
  mortgage_balance: number | null
  liens_or_taxes: string
  best_time_to_contact: string
  communication_preference: 'email' | 'phone' | 'either'
  analysis_consent: boolean
  contact_consent: boolean
  marketing_consent: boolean
  seller_notes: string
  source_path: string
  source: string
  attribution: Record<string, string>
  completeness_score: number
  completeness_gaps: string[]
  lead_id: string | null
  operator_task_id: string | null
  assigned_to: string | null
  last_status_note: string | null
  submitted_at: string | null
  last_status_changed_at: string
  created_at: string
  updated_at: string
}

export type SellerCaseEvent = {
  id: string
  seller_case_id: string
  actor_user_id: string | null
  event_type: string
  from_status: SellerCaseStatus | null
  to_status: SellerCaseStatus | null
  note: string | null
  metadata_json: Record<string, unknown>
  created_at: string
}
