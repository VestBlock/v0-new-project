export const buyerTypes = ['local_operator', 'institutional', 'specialty'] as const

export const buyerCategories = [
  'local_cash_buyer',
  'hedge_fund_buyer',
  'sfr_aggregator',
  'build_to_rent_buyer',
  'landlord_buyer',
  'brrrr_buyer',
  'fix_and_flip_buyer',
  'small_multifamily_buyer',
  'wholesaler_buyer',
  'note_buyer',
  'creative_finance_buyer',
  'land_buyer',
  'commercial_buyer',
  'mobile_home_park_buyer',
  'self_storage_buyer',
  'mixed_use_buyer',
] as const

export const buyerRelationshipStages = [
  'discovered',
  'researched',
  'outreach_ready',
  'contacted',
  'followup_due',
  'responded',
  'reviewing',
  'active_buyer',
  'dormant',
  'paused',
  'not_a_fit',
] as const

export const buyerOutreachStatuses = [
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

export const buyerOutreachChannels = [
  'email_intro',
  'email_followup',
  'linkedin_dm',
  'phone_script',
  'spanish_email',
] as const

export type BuyerType = (typeof buyerTypes)[number]
export type BuyerCategory = (typeof buyerCategories)[number]
export type BuyerRelationshipStage = (typeof buyerRelationshipStages)[number]
export type BuyerOutreachStatus = (typeof buyerOutreachStatuses)[number]
export type BuyerOutreachChannel = (typeof buyerOutreachChannels)[number]

export type BuyerRecord = {
  id: string
  name: string
  website: string | null
  buyer_type: BuyerType
  category: BuyerCategory | string
  buyer_size: string | null
  headquarters_city: string | null
  headquarters_state: string | null
  markets_served: string[]
  national_or_regional: 'local' | 'regional' | 'national' | 'multi_state'
  contact_email: string | null
  contact_phone: string | null
  contact_name: string | null
  source: string | null
  source_url: string | null
  external_id: string | null
  outreach_status: BuyerOutreachStatus
  relationship_stage: BuyerRelationshipStage
  confidence_score: number
  fit_summary: string | null
  notes: string | null
  distress_utility_score: number
  code_violation_utility_score: number
  seller_lead_utility_score: number
  market_expansion_value_score: number
  institutional_fit_value_score: number
  referral_value_score: number
  bilingual_support: boolean
  spanish_support: boolean
  proof_of_funds_status: string | null
  closing_speed: string | null
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

export type BuyerBuyBoxRecord = {
  id: string
  buyer_id: string
  buy_box_name: string
  asset_types: string[]
  states: string[]
  cities: string[]
  zip_codes: string[]
  metros: string[]
  occupancy_preference: string | null
  distressed_tolerance: number
  code_violation_tolerance: number
  tenant_occupied_allowed: boolean
  section8_allowed: boolean
  price_min: number | null
  price_max: number | null
  arv_min: number | null
  arv_max: number | null
  rehab_budget_max: number | null
  minimum_equity_percent: number | null
  minimum_discount_percent: number | null
  preferred_deal_types: string[]
  closing_speed: string | null
  proof_of_funds_status: string | null
  creative_finance_open: boolean
  portfolio_size_preference: string | null
  institutional_criteria: string | null
  bilingual_support: boolean
  spanish_support: boolean
  active: boolean
  notes: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BuyerMarketRecord = {
  id: string
  buyer_id: string
  city: string | null
  state: string | null
  metro_area: string | null
  market_type: string
  active: boolean
  notes: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BuyerContactRecord = {
  id: string
  buyer_id: string
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

export type BuyerOutreachMessageRecord = {
  id: string
  buyer_id: string
  buyer_contact_id: string | null
  channel: BuyerOutreachChannel
  subject: string | null
  body: string
  cta: string | null
  partnership_angle: string | null
  property_referral_angle: string | null
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

export type BuyerOutreachRunRecord = {
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

export type BuyerNoteRecord = {
  id: string
  buyer_id: string
  author_user_id: string | null
  note: string
  is_internal: boolean
  created_at: string
}

export type BuyerPerformanceRecord = {
  id: string
  buyer_id: string
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

export type BuyerRelationshipEventRecord = {
  id: string
  buyer_id: string
  event_type: string
  actor_user_id: string | null
  metadata_json: Record<string, unknown>
  created_at: string
}

export type BuyerMatchRecord = {
  id: string
  buyer_id: string
  lead_id: string | null
  property_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  asset_type: string | null
  occupancy: string | null
  deal_type: string | null
  confidence_score: number
  fit_summary: string | null
  fit_explanation: string | null
  next_info_needed: string[]
  fallback_buyer_categories: string[]
  status: 'matched' | 'reviewed' | 'shared' | 'active' | 'rejected' | 'archived'
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PropertyBuyerMatchInput = {
  leadId?: string | null
  serviceType?: string | null
  propertyAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  assetType?: string | null
  occupancy?: string | null
  distressLevel?: number | null
  codeViolationLevel?: number | null
  rehabLevel?: number | null
  askingPrice?: number | null
  estimatedValue?: number | null
  landlordSignal?: boolean | null
  absenteeOwner?: boolean | null
  sellerMotivation?: string | null
  timelineDays?: number | null
  creativeFinanceOpen?: boolean | null
  languagePreference?: 'en' | 'es' | 'bilingual' | null
  marketTag?: string | null
}

export type BuyerScoreBreakdown = {
  confidenceScore: number
  seriousnessScore: number
  buyBoxClarityScore: number
  marketCoverageScore: number
  distressedPropertyUtilityScore: number
  codeViolationUtilityScore: number
  sellerLeadUtilityScore: number
  closingSpeedUtilityScore: number
  responsivenessScore: number
  institutionalFitValueScore: number
  referralMonetizationValueScore: number
  fitSummary: string
  notes: string[]
}

export type GeneratedBuyerOutreachBundle = {
  generatedWith: 'template'
  emailIntro: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    propertyReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  emailFollowup: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    propertyReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  linkedInDm: {
    body: string
    cta: string
    partnershipAngle: string
    propertyReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  phoneScript: {
    body: string
    cta: string
    partnershipAngle: string
    propertyReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
  spanishEmail: {
    subject: string
    body: string
    cta: string
    partnershipAngle: string
    propertyReferralAngle: string
    complianceNote: string
    qualificationQuestions: string[]
    economicsPrompt: string | null
  }
}

export type BuyerDiscoveryInput = {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
  provider: 'google'
}

export type NormalizedBuyerInput = {
  name: string
  website?: string | null
  buyerType: BuyerType
  category: BuyerCategory | string
  buyerSize?: string | null
  headquartersCity?: string | null
  headquartersState?: string | null
  marketsServed?: string[]
  nationalOrRegional?: 'local' | 'regional' | 'national' | 'multi_state'
  contactEmail?: string | null
  contactPhone?: string | null
  contactName?: string | null
  source?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  fitSummary?: string | null
  notes?: string | null
  bilingualSupport?: boolean
  spanishSupport?: boolean
  proofOfFundsStatus?: string | null
  closingSpeed?: string | null
  contactInfo?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
