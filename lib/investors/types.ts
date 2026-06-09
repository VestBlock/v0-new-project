export const phaseOneMarkets = [
  'Toledo, OH',
  'Cleveland, OH',
  'Milwaukee, WI',
  'Racine, WI',
  'Kenosha, WI',
] as const

export const investorTypes = [
  'fix_and_flip',
  'buy_and_hold',
  'dscr_investor',
  'wholesaler',
  'acquisition_manager',
  'institutional_buyer',
  'private_lender',
  'hard_money_borrower',
] as const

export const investorSourceTypes = [
  'recent_flip_transaction',
  'county_deed_record',
  'llc_ownership_record',
  'dealmachine_export',
  'public_property_sales',
  'linkedin',
  'facebook_investor_group',
  'local_reia_directory',
  'public_foreclosure_buyer',
  'manual_research',
  'partner_referral',
] as const

export const investorRelationshipStages = [
  'discovered',
  'researched',
  'outreach_ready',
  'contacted',
  'followup_due',
  'responded',
  'qualified',
  'active_buyer',
  'active_borrower',
  'active_seller',
  'active_partner',
  'revenue_opportunity',
  'dormant',
  'paused',
  'not_a_fit',
] as const

export const investorOutreachStatuses = [
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

export type InvestorType = (typeof investorTypes)[number]
export type InvestorSourceType = (typeof investorSourceTypes)[number]
export type InvestorRelationshipStage = (typeof investorRelationshipStages)[number]
export type InvestorOutreachStatus = (typeof investorOutreachStatuses)[number]
export type InvestorSequenceCode = 'A' | 'B' | 'C' | 'D'

export type InvestorBuyBox = {
  cities?: string[]
  states?: string[]
  zipCodes?: string[]
  propertyTypes?: string[]
  priceMin?: number | null
  priceMax?: number | null
  arvMin?: number | null
  arvMax?: number | null
  rehabBudgetMax?: number | null
  holdPeriod?: string | null
  dealTypes?: string[]
  notes?: string | null
}

export type InvestorProfileRecord = {
  id: string
  display_name: string
  person_name: string | null
  llc_name: string | null
  company_name: string | null
  primary_investor_type: InvestorType
  classification_tags: string[]
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  linkedin_url: string | null
  facebook_url: string | null
  markets: string[]
  property_types: string[]
  estimated_buy_box: InvestorBuyBox
  financing_indicators: string[]
  source_names: string[]
  source_confidence_score: number
  recent_activity_score: number
  transaction_volume_score: number
  geographic_fit_score: number
  financing_need_score: number
  disposition_need_score: number
  partnership_potential_score: number
  partnership_score: number
  deal_flow_fit: boolean
  disposition_fit: boolean
  financing_fit: boolean
  partnership_fit: boolean
  assigned_sequence: InvestorSequenceCode
  outreach_status: InvestorOutreachStatus
  relationship_stage: InvestorRelationshipStage
  owner_user_id: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  last_scored_at: string | null
  last_outreach_generated_at: string | null
  ai_follow_up_summary: string | null
  routing_owner: string | null
  notes: string | null
  metadata_json: Record<string, unknown>
  automation_flags_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type InvestorTransactionInput = {
  propertyAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  propertyType?: string | null
  transactionType?: string | null
  transactionDate?: string | null
  purchasePrice?: number | null
  salePrice?: number | null
  estimatedRehab?: number | null
  estimatedProfit?: number | null
  financingType?: string | null
  sourceType?: string | null
  sourceUrl?: string | null
  metadata?: Record<string, unknown>
}

export type InvestorEvidenceInput = {
  sourceType: InvestorSourceType
  sourceName?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  recordDate?: string | null
  confidenceScore?: number | null
  evidenceSummary?: string | null
  rawPayload?: Record<string, unknown>
}

export type NormalizedInvestorInput = {
  displayName: string
  personName?: string | null
  llcName?: string | null
  companyName?: string | null
  primaryInvestorType?: InvestorType
  classificationTags?: string[]
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  linkedinUrl?: string | null
  facebookUrl?: string | null
  markets?: string[]
  propertyTypes?: string[]
  estimatedBuyBox?: InvestorBuyBox
  financingIndicators?: string[]
  sourceNames?: string[]
  sourceIdentity?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
  transactions?: InvestorTransactionInput[]
  evidence?: InvestorEvidenceInput[]
}

export type InvestorScoreBreakdown = {
  recentActivity: number
  transactionVolume: number
  geographicFit: number
  financingNeed: number
  dispositionNeed: number
  partnershipPotential: number
  partnershipScore: number
  assignedSequence: InvestorSequenceCode
  dealFlowFit: boolean
  dispositionFit: boolean
  financingFit: boolean
  partnershipFit: boolean
  fitSummary: string
}

export type InvestorDashboardSummary = {
  total: number
  averageScore: number
  activeBuyers: number
  activeBorrowers: number
  activeSellers: number
  lendingOpportunities: number
  partnershipOpportunities: number
  revenueOpportunities: number
  outreachReady: number
  replies: number
  callsBooked: number
  fundingClosed: number
  markets: Array<{ label: string; value: number }>
  classifications: Array<{ label: string; value: number }>
}
