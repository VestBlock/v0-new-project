export const researchEntityTypes = [
  'property',
  'seller',
  'buyer',
  'lender',
  'investor',
  'contractor',
  'developer',
  'land_bank',
  'bank_owned_asset',
  'partner_prospect',
  'lead',
  'other',
] as const

export const researchRecommendedLanes = [
  'seller_fast_cash',
  'seller_creative',
  'seller_novation',
  'buyer_buy_box',
  'lender_criteria',
  'contractor_partner',
  'developer_partner',
  'land_bank_relationship',
  'bank_owned_assets',
  'investor_partnership',
  'no_outreach',
] as const

export const researchOutreachStatuses = [
  'not_ready',
  'needs_review',
  'ready',
  'approved',
  'sent',
  'responded',
  'do_not_contact',
] as const

export const researchChecklistKeys = [
  'propertyVerified',
  'ownerEntityVerified',
  'contactQualityReviewed',
  'sourceLinksAttached',
  'fitCriteriaReviewed',
  'mapConditionReviewed',
  'riskReviewed',
  'nextActionSelected',
] as const

export type ResearchEntityType = (typeof researchEntityTypes)[number]
export type ResearchRecommendedLane = (typeof researchRecommendedLanes)[number]
export type ResearchOutreachStatus = (typeof researchOutreachStatuses)[number]
export type ResearchChecklistKey = (typeof researchChecklistKeys)[number]

export type ResearchChecklistJson = Partial<Record<ResearchChecklistKey, boolean>> & Record<string, unknown>

export type ResearchSourceLink = {
  label?: string | null
  url: string
  sourceType?: string | null
  notes?: string | null
}

export type ResearchFlag = {
  label: string
  severity?: 'low' | 'medium' | 'high' | 'info'
  notes?: string | null
}

export type ResearchChecklistRecord = {
  id: string
  entity_type: ResearchEntityType
  entity_id: string | null
  source_type: string | null
  source_id: string | null
  property_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  owner_name: string | null
  company_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  checklist_json: ResearchChecklistJson
  source_links_json: ResearchSourceLink[]
  risk_flags_json: ResearchFlag[]
  opportunity_flags_json: ResearchFlag[]
  recommended_lane: ResearchRecommendedLane | null
  outreach_status: ResearchOutreachStatus
  confidence_score: number
  research_summary: string | null
  next_action: string | null
  assigned_owner: string | null
  follow_up_at: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type ResearchChecklistSummary = {
  total: number
  readyForOutreach: number
  needsReview: number
  doNotContact: number
  averageConfidence: number
  followUpsDue: number
}

export type NormalizedResearchChecklistInput = {
  id?: string
  entityType: ResearchEntityType
  entityId?: string | null
  sourceType?: string | null
  sourceId?: string | null
  propertyAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  ownerName?: string | null
  companyName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  checklist?: ResearchChecklistJson
  sourceLinks?: ResearchSourceLink[]
  riskFlags?: ResearchFlag[]
  opportunityFlags?: ResearchFlag[]
  recommendedLane?: ResearchRecommendedLane | null
  outreachStatus?: ResearchOutreachStatus
  confidenceScore?: number | null
  researchSummary?: string | null
  nextAction?: string | null
  assignedOwner?: string | null
  followUpAt?: string | null
  reviewedAt?: string | null
}
