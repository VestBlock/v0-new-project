export type LeadSourceKey =
  | 'wisconsin_dfi_new_businesses'
  | 'cincinnati_code_enforcement'
  | 'milwaukee_accela_enforcement'
  | 'google_places_businesses'
  | 'outscraper_google_maps_businesses'
  | 'apify_yelp_businesses'
  | 'sam_contract_opportunities'
  | 'zillow_stale_listing_import'
  | 'failed_listing_import'
  | 'real_estate_listing_import'
  | 'absentee_owner_import'
  | 'tired_landlord_import'
  | 'tax_delinquent_import'
  | 'probate_inherited_import'
  | 'vacant_distress_import'
  | 'preforeclosure_import'
  | 'csv_import'

export type LeadCategory =
  | 'new_business_formation'
  | 'code_violation'
  | 'small_business'
  | 'government_contracts'
  | 'real_estate'
  | 'website_upgrade'
  | 'spanish_business'
  | 'business_funding'
  | 'business_credit'
  | 'ai_receptionist'
  | 'appointment_booking'
  | 'business_setup'
  | 'seller_lead'

export type LeadOffer =
  | 'DealVault / Operator Accountability'
  | 'Business Funding'
  | 'Business Credit Builder'
  | 'AI Receptionist'
  | 'AI Receptionist Launch'
  | 'AI Appointment Booking System'
  | 'Website Upgrade'
  | 'Website Upgrade Sprint'
  | 'Gov Contract Readiness'
  | 'Real Estate Seller Lead'
  | 'Credit Repair'
  | 'Spanish Funding Assistance'
  | 'Grant/Funding Roadmap'
  | 'New Business Formation'
  | 'Business Setup / Compliance Help'

export type LeadStatus =
  | 'new'
  | 'scored'
  | 'outreach_ready'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'qualified'
  | 'nurturing'
  | 'closed'
  | 'closed_won'
  | 'closed_lost'
  | 'disqualified'
  | 'do_not_contact'

export type LeadOutreachStatus =
  | 'not_started'
  | 'draft_ready'
  | 'needs_review'
  | 'approved'
  | 'queued'
  | 'sent'
  | 'followup_due'
  | 'failed'
  | 'do_not_contact'

export type OutreachChannel =
  | 'sms'
  | 'email'
  | 'facebook_dm'
  | 'instagram_dm'
  | 'phone_script'

export type ScrapeRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial'

export type WebsiteWeaknessReport = {
  websiteExists: boolean
  responseTimeMs: number | null
  hasViewportMeta: boolean
  hasChat: boolean
  hasOnlineBooking: boolean
  hasClearCta: boolean
  hasTrustSignals: boolean
  hasContactSignals: boolean
  isLikelyOutdated: boolean
  estimatedSpeed: 'fast' | 'moderate' | 'slow' | 'unreachable' | 'unknown'
  weakSignals: string[]
}

export type LeadRecord = {
  id: string
  lead_type: string
  status: LeadStatus
  source: string | null
  source_url: string | null
  category: string | null
  external_id: string | null
  name: string | null
  business_name: string | null
  property_address: string | null
  mailing_address: string | null
  phone: string | null
  email: string | null
  website: string | null
  city: string | null
  state: string | null
  zip: string | null
  language_signal: string | null
  pain_signal: string | null
  best_offer: LeadOffer | string | null
  lead_score: number | null
  urgency_level?: string | null
  contactability_level?: string | null
  language_segment?: string | null
  outreach_angle?: string | null
  estimated_value_label?: string | null
  market_segment?: string | null
  owner_user_id?: string | null
  next_follow_up_at?: string | null
  outreach_status?: LeadOutreachStatus | null
  niche?: string | null
  target_market_id?: string | null
  expansion_batch_id?: string | null
  campaign_name?: string | null
  email_valid?: boolean | null
  bounce_risk_score?: number | null
  delivery_status?: 'not_sent' | 'queued' | 'sent' | 'bounced' | 'replied' | 'booked' | 'suppressed' | 'failed' | null
  suppression_reason?: string | null
  imported_at?: string | null
  last_outreach_generated_at?: string | null
  last_scored_at?: string | null
  website_audit_json?: Record<string, unknown>
  automation_flags_json?: Record<string, unknown>
  best_offer_reason?: string | null
  mailing_matches_property?: boolean | null
  notes: string | null
  status_detail?: string | null
  contact_info: Record<string, unknown>
  form_data: Record<string, unknown>
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LeadSourceRecord = {
  id: string
  source_key: LeadSourceKey | string
  name: string
  category: string
  source_type: string
  base_url: string | null
  city: string | null
  state: string | null
  config_json: Record<string, unknown>
  is_active: boolean
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export type TargetMarketStatus = 'queued' | 'active' | 'scraped' | 'paused' | 'exhausted'

export type TargetMarketRecord = {
  id: string
  city: string
  state: string
  metro_area: string | null
  population: number | null
  business_density_score: number
  new_llc_score: number
  funding_need_score: number
  real_estate_activity_score: number
  spanish_business_score: number
  ai_receptionist_opportunity_score: number
  final_score: number
  niche_focus: string[]
  status: TargetMarketStatus
  last_scraped_at: string | null
  performance_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LeadSuppressionRecord = {
  id: string
  email: string | null
  phone: string | null
  website: string | null
  business_name: string | null
  city: string | null
  state: string | null
  reason: string
  status: 'active' | 'released'
  created_at: string
  updated_at: string
}

export type LeadScoreRecord = {
  id: string
  lead_id: string
  score: number
  urgency_score: number
  business_age_score: number
  funding_need_score: number
  website_weakness_score: number
  language_niche_score: number
  distress_signal_score: number
  contract_fit_score: number
  contactability_score: number
  estimated_value_score: number
  best_offer: LeadOffer | string | null
  reasoning: string | null
  urgency_level?: string | null
  contactability_level?: string | null
  language_segment?: string | null
  outreach_angle?: string | null
  estimated_value_label?: string | null
  breakdown_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type OutreachMessageRecord = {
  id: string
  lead_id: string
  channel: OutreachChannel
  subject: string | null
  body: string
  cta?: string | null
  language?: string | null
  variant_key?: string | null
  compliance_note: string | null
  generated_with: string | null
  status: 'draft' | 'needs_review' | 'approved' | 'queued' | 'sent' | 'failed' | 'archived'
  approved_at?: string | null
  approved_by_user_id?: string | null
  sent_at?: string | null
  send_provider?: string | null
  send_error?: string | null
  last_generated_at?: string | null
  created_at: string
  updated_at: string
}

export type ScrapeRunRecord = {
  id: string
  source_id: string | null
  source_key: string
  run_type: string
  status: ScrapeRunStatus
  request_params: Record<string, unknown>
  result_count: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export type LeadNoteRecord = {
  id: string
  lead_id: string
  author_user_id: string | null
  note: string
  is_internal: boolean
  created_at: string
}

export type LeadScoreBreakdown = {
  score: number
  urgencyScore: number
  businessAgeScore: number
  fundingNeedScore: number
  websiteWeaknessScore: number
  languageNicheScore: number
  distressSignalScore: number
  contractFitScore: number
  contactabilityScore: number
  estimatedValueScore: number
  bestOffer: LeadOffer
  reasoning: string
  urgencyLevel: 'low' | 'medium' | 'high'
  contactabilityLevel: 'low' | 'medium' | 'high'
  languageSegment: 'english' | 'spanish' | 'bilingual'
  outreachAngle: string
  estimatedValueLabel: 'low' | 'medium' | 'high' | 'premium'
  marketSegment?: string | null
  niche?: string | null
  breakdown: Record<string, unknown>
}

export type NormalizedLeadInput = {
  leadType: string
  source: string
  ownerUserId?: string | null
  sourceUrl?: string | null
  category?: string | null
  externalId?: string | null
  name?: string | null
  businessName?: string | null
  propertyAddress?: string | null
  mailingAddress?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  languageSignal?: string | null
  painSignal?: string | null
  notes?: string | null
  status?: LeadStatus
  bestOffer?: LeadOffer | null
  marketSegment?: string | null
  niche?: string | null
  targetMarketId?: string | null
  expansionBatchId?: string | null
  campaignName?: string | null
  emailValid?: boolean | null
  bounceRiskScore?: number | null
  deliveryStatus?: LeadRecord['delivery_status']
  suppressionReason?: string | null
  importedAt?: string | null
  outreachAngle?: string | null
  nextFollowUpAt?: string | null
  websiteAudit?: Record<string, unknown>
  mailingMatchesProperty?: boolean | null
  contactInfo?: Record<string, unknown>
  formData?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type GeneratedOutreachBundle = {
  sms: { body: string; complianceNote: string; cta: string; language: 'en' | 'es' }
  email: { subject: string; body: string; complianceNote: string; cta: string; language: 'en' | 'es' }
  facebook_dm: { body: string; complianceNote: string; cta: string; language: 'en' | 'es' }
  instagram_dm: { body: string; complianceNote: string; cta: string; language: 'en' | 'es' }
  phone_script: { body: string; complianceNote: string; cta: string; language: 'en' | 'es' }
  generatedWith: 'openai' | 'template'
}

export type OutreachSendEventRecord = {
  id: string
  lead_id: string
  outreach_message_id: string | null
  channel: OutreachChannel
  provider: string | null
  status: 'approved' | 'queued' | 'sent' | 'failed' | 'skipped'
  recipient: string | null
  subject: string | null
  error_message: string | null
  metadata_json: Record<string, unknown>
  created_at: string
}

export type MarketSeed = {
  city: string
  state: string
  metroArea: string
  population: number
  primaryNiches?: string[]
}

export type MarketDiscoverySummary = {
  discovered: number
  activated: number
  largeMetros: TargetMarketRecord[]
  midMarkets: TargetMarketRecord[]
  smallMarkets: TargetMarketRecord[]
}

export type CsvLeadImportRow = {
  business_name: string
  contact_name?: string
  email?: string
  phone?: string
  website?: string
  city?: string
  state?: string
  zip?: string
  niche?: string
  source?: string
  owner_name?: string
  owner_occupied?: string
  owner_state?: string
  years_owned?: string
  equity_estimate?: string
  tax_delinquent_amount?: string
  lien_amount?: string
  vacant_flag?: string
  absentee_owner?: string
  probate_flag?: string
  deceased_owner?: string
  preforeclosure_flag?: string
  property_address?: string
  mailing_address?: string
  property_type?: string
  bedrooms?: string
  bathrooms?: string
  square_feet?: string
  year_built?: string
  list_price?: string
  estimated_value?: string
  rent_estimate?: string
  days_on_market?: string
  price_reduced?: string
  occupancy_status?: string
  listing_status?: string
  listing_url?: string
  reason_for_selling?: string
  notes?: string
}
