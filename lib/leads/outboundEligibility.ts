import { getSourceFamily, isSourceInFamily } from '@/lib/leads/source-keys'

type LeadOutboundShape = {
  source?: string | null
  lead_type?: string | null
  category?: string | null
  market_segment?: string | null
}

const LEGACY_SMALL_BUSINESS_LEAD_TYPES = new Set([
  'ai_assistant',
  'business_funding',
  'google_places',
  'new_business_filing',
  'spanish_business_funding',
  'visibility_expansion',
  'website_upgrade',
])

const LEGACY_SMALL_BUSINESS_SOURCE_FAMILIES = new Set([
  'account_signup_growth_system',
  'apify_yelp_businesses',
  'funding_lead',
  'google_places_businesses',
  'outscraper_google_maps_businesses',
  'sam_contract_opportunities',
  'service_interest',
  'site_preview',
  'visibility_expansion_request',
  'weak_web_presence_businesses',
  'wisconsin_dfi_new_businesses',
])

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function normalized(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export function isLegacySmallBusinessOutboundPaused() {
  return !envBool('LEADS_ALLOW_LEGACY_SMALL_BUSINESS_OUTBOUND', false)
}

export function getLeadOutboundPauseReason(lead: LeadOutboundShape | null | undefined) {
  if (!lead) return 'missing_lead'

  // DealMachine is a discovery source only. Provider observations and legacy
  // imports must pass through canonical attribution, operator review, consent,
  // and suppression controls before a receiving customer strategy can create
  // its own outreach enrollment. A source flag must never bypass that boundary.
  if (normalized(lead.source).includes('dealmachine')) {
    return 'dealmachine_discovery_outbound_prohibited'
  }

  if (!envBool('LEADS_ALLOW_LEGACY_GOOGLE_PLACES', false) && isSourceInFamily(lead.source, 'google_places_businesses')) {
    return 'legacy_google_places_paused'
  }

  if (!isLegacySmallBusinessOutboundPaused()) return null

  const sourceFamily = getSourceFamily(lead.source)
  if (LEGACY_SMALL_BUSINESS_SOURCE_FAMILIES.has(sourceFamily)) {
    return 'legacy_small_business_source_paused'
  }

  const leadType = normalized(lead.lead_type)
  const category = normalized(lead.category)
  const marketSegment = normalized(lead.market_segment)
  if ([leadType, category, marketSegment].some((value) => LEGACY_SMALL_BUSINESS_LEAD_TYPES.has(value))) {
    return 'legacy_small_business_lane_paused'
  }

  return null
}

export function isCurrentVestblockOutboundLead(lead: LeadOutboundShape | null | undefined) {
  return !getLeadOutboundPauseReason(lead)
}
