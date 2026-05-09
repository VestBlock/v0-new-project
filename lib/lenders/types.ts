export const lenderTypes = ['real_estate', 'business', 'personal', 'specialty'] as const

export const lenderCategories = [
  'conventional_mortgage',
  'dscr',
  'fix_and_flip',
  'bridge',
  'hard_money',
  'refinance',
  'brrrr_friendly',
  'portfolio_bank',
  'construction',
  'commercial',
  'sba_504_real_estate',
  'heloc',
  'private_lender',
  'creative_finance_partner',
  'startup_friendly',
  'term_loan',
  'line_of_credit',
  'sba_7a',
  'sba_microloan',
  'revenue_based',
  'invoice_factoring',
  'equipment_finance',
  'franchise_finance',
  'trucking_finance',
  'restaurant_finance',
  'contractor_finance',
  'cdfi',
  'community_bank',
  'credit_union_business',
  'personal_loan',
  'debt_consolidation',
  'credit_union_personal',
  'secured_share_loan',
  'heloc_personal',
  'relationship_bank_line',
  'credit_builder_partner',
  'spanish_market',
  'minority_business_program',
  'women_business_program',
  'immigrant_business_program',
  'economic_development',
  'grant_support_partner',
  'nonprofit_microloan',
  'medical_practice_finance',
  'auto_repair_finance',
  'logistics_finance',
] as const

export const lenderRelationshipStages = [
  'discovered',
  'researched',
  'outreach_ready',
  'contacted',
  'followup_due',
  'responded',
  'reviewing',
  'active_partner',
  'dormant',
  'paused',
  'not_a_fit',
] as const

export const lenderOutreachStatuses = [
  'not_started',
  'draft_ready',
  'needs_review',
  'approved',
  'queued',
  'sent',
  'responded',
  'followup_due',
  'failed',
  'do_not_contact',
] as const

export const lenderOutreachChannels = [
  'email_intro',
  'email_followup',
  'linkedin_dm',
  'phone_script',
  'spanish_email',
] as const

export type LenderType = (typeof lenderTypes)[number]
export type LenderCategory = (typeof lenderCategories)[number]
export type LenderRelationshipStage = (typeof lenderRelationshipStages)[number]
export type LenderOutreachStatus = (typeof lenderOutreachStatuses)[number]
export type LenderOutreachChannel = (typeof lenderOutreachChannels)[number]

export type LenderRecord = {
  id: string
  name: string
  website: string | null
  lender_type: LenderType
  category: LenderCategory | string
  lender_size: string | null
  headquarters_city: string | null
  headquarters_state: string | null
  states_served: string[]
  national_or_regional: 'local' | 'regional' | 'national' | 'multi_state'
  contact_email: string | null
  contact_phone: string | null
  contact_name: string | null
  source: string | null
  source_url: string | null
  external_id: string | null
  outreach_status: LenderOutreachStatus
  relationship_stage: LenderRelationshipStage
  confidence_score: number
  fit_summary: string | null
  notes: string | null
  min_credit_score: number | null
  min_revenue: number | null
  min_time_in_business: number | null
  startup_allowed: boolean
  collateral_required: boolean
  owner_occupied_allowed: boolean
  investor_allowed: boolean
  rehab_tolerance: number
  first_time_investor_allowed: boolean
  bankruptcy_tolerance: string | null
  tax_lien_tolerance: string | null
  low_doc: boolean
  speed_to_close: string | null
  industries_preferred: string[]
  industries_excluded: string[]
  loan_amount_min: number | null
  loan_amount_max: number | null
  dscr_min: number | null
  seasoning_requirement: string | null
  cash_out_allowed: boolean
  bilingual_support: boolean
  spanish_support: boolean
  startup_friendliness_score: number
  real_estate_utility_score: number
  business_funding_utility_score: number
  spanish_market_value_score: number
  market_expansion_value_score: number
  referral_value_score: number
  owner_user_id: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  last_scored_at: string | null
  last_outreach_generated_at: string | null
  contact_info: Record<string, unknown>
  metadata_json: Record<string, unknown>
  automation_flags_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderProductRecord = {
  id: string
  lender_id: string
  category: string
  product_name: string
  description: string | null
  active: boolean
  min_credit_score: number | null
  min_revenue: number | null
  min_time_in_business: number | null
  startup_allowed: boolean
  owner_occupied_allowed: boolean
  investor_allowed: boolean
  collateral_required: boolean
  loan_amount_min: number | null
  loan_amount_max: number | null
  dscr_min: number | null
  speed_to_close: string | null
  truthful_notes: string | null
  tags: string[]
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderProgramRecord = {
  id: string
  lender_id: string
  program_name: string
  program_type: string
  description: string | null
  startup_allowed: boolean
  low_doc: boolean
  bilingual_support: boolean
  spanish_support: boolean
  loan_amount_min: number | null
  loan_amount_max: number | null
  min_credit_score: number | null
  min_revenue: number | null
  min_time_in_business: number | null
  dscr_min: number | null
  seasoning_requirement: string | null
  truthful_notes: string | null
  active: boolean
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderContactRecord = {
  id: string
  lender_id: string
  name: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  preferred_channel: string
  is_primary: boolean
  confidence_score: number
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderOutreachMessageRecord = {
  id: string
  lender_id: string
  lender_contact_id: string | null
  channel: LenderOutreachChannel
  subject: string | null
  body: string
  cta: string | null
  partnership_angle: string | null
  borrower_referral_angle: string | null
  compliance_note: string | null
  status: 'draft' | 'needs_review' | 'approved' | 'queued' | 'sent' | 'failed' | 'archived'
  language: string
  generated_with: string | null
  approved_at: string | null
  approved_by_user_id: string | null
  sent_at: string | null
  send_provider: string | null
  send_error: string | null
  last_generated_at: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderOutreachRunRecord = {
  id: string
  run_type: string
  source_key: string | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial'
  result_count: number
  request_params: Record<string, unknown>
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export type LenderNoteRecord = {
  id: string
  lender_id: string
  author_user_id: string | null
  note: string
  is_internal: boolean
  created_at: string
}

export type LenderPerformanceRecord = {
  id: string
  lender_id: string
  outreach_sent_count: number
  outreach_failed_count: number
  response_count: number
  active_match_count: number
  closed_referral_count: number
  average_match_score: number
  last_contacted_at: string | null
  last_responded_at: string | null
  notes: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LenderRelationshipEventRecord = {
  id: string
  lender_id: string
  event_type: string
  actor_user_id: string | null
  metadata_json: Record<string, unknown>
  created_at: string
}

export type LenderMatchRecord = {
  id: string
  lender_id: string
  user_id: string | null
  lead_id: string | null
  funding_profile_id: string | null
  funding_recommendation_id: string | null
  service_type: string | null
  borrower_state: string | null
  borrower_industry: string | null
  deal_type: string | null
  confidence_score: number
  fit_summary: string | null
  fit_explanation: string | null
  next_docs_needed: string[]
  fallback_options: string[]
  status: 'matched' | 'reviewed' | 'shared' | 'active' | 'rejected' | 'archived'
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BorrowerMatchInput = {
  userId?: string | null
  leadId?: string | null
  fundingProfileId?: string | null
  fundingRecommendationId?: string | null
  serviceType?: string | null
  mode?: 'business' | 'personal' | 'hybrid' | null
  borrowerState?: string | null
  businessIndustry?: string | null
  businessRevenue?: number | null
  timeInBusinessMonths?: number | null
  ficoEstimate?: number | null
  fundingGoalAmount?: number | null
  dealType?: string | null
  languagePreference?: 'en' | 'es' | 'bilingual' | null
  investorExperience?: 'none' | 'beginner' | 'experienced' | null
  dscr?: number | null
  ownerOccupied?: boolean | null
  wantsCashOut?: boolean | null
  urgencyDays?: number | null
  docsReady?: boolean | null
}

export type LenderScoreBreakdown = {
  confidenceScore: number
  categoryCoverageScore: number
  nicheFitScore: number
  responsivenessScore: number
  qualityTrustScore: number
  documentationClarityScore: number
  startupFriendlinessScore: number
  realEstateUtilityScore: number
  businessFundingUtilityScore: number
  spanishMarketValueScore: number
  marketExpansionValueScore: number
  referralMonetizationValueScore: number
  fitSummary: string
  notes: string[]
}

export type GeneratedLenderOutreachBundle = {
  generatedWith: 'template'
  emailIntro: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    borrowerReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  emailFollowup: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    borrowerReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  linkedInDm: {
    body: string
    cta: string
    partnershipAngle: string
    borrowerReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  phoneScript: {
    body: string
    cta: string
    partnershipAngle: string
    borrowerReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  spanishEmail: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    borrowerReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
}

export type LenderDiscoveryInput = {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
  provider: 'google'
}

export type NormalizedLenderInput = {
  name: string
  website?: string | null
  lenderType: LenderType
  category: LenderCategory | string
  lenderSize?: string | null
  headquartersCity?: string | null
  headquartersState?: string | null
  statesServed?: string[]
  nationalOrRegional?: 'local' | 'regional' | 'national' | 'multi_state'
  contactEmail?: string | null
  contactPhone?: string | null
  contactName?: string | null
  source?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  fitSummary?: string | null
  notes?: string | null
  minCreditScore?: number | null
  minRevenue?: number | null
  minTimeInBusiness?: number | null
  startupAllowed?: boolean
  collateralRequired?: boolean
  ownerOccupiedAllowed?: boolean
  investorAllowed?: boolean
  rehabTolerance?: number
  firstTimeInvestorAllowed?: boolean
  bankruptcyTolerance?: string | null
  taxLienTolerance?: string | null
  lowDoc?: boolean
  speedToClose?: string | null
  industriesPreferred?: string[]
  industriesExcluded?: string[]
  loanAmountMin?: number | null
  loanAmountMax?: number | null
  dscrMin?: number | null
  seasoningRequirement?: string | null
  cashOutAllowed?: boolean
  bilingualSupport?: boolean
  spanishSupport?: boolean
  contactInfo?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
