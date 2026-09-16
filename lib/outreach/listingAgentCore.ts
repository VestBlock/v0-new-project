export type ListingAgentIntermediaryRecord = {
  source?: string | null
  contact_info?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
}

/**
 * Classifies only the server-produced HomeHarvest listing-agent shape. The
 * downstream Outlook adapter independently checks evidence freshness, exact
 * recipient binding, and Hunter verification before admitting a cold email.
 */
export function isListingAgentIntermediaryLead(lead: ListingAgentIntermediaryRecord) {
  const contactInfo = lead.contact_info || {}
  const metadata = lead.metadata_json || {}
  const sourceFamilies = Array.isArray(metadata.strategySourceFamilies)
    ? metadata.strategySourceFamilies.map((value) => String(value || '').trim().toLowerCase())
    : []
  return (
    String(lead.source || '').trim().toLowerCase() === 'homeharvest_stale_listing' &&
    String(contactInfo.contactRole || '').trim().toLowerCase() === 'listing_agent' &&
    contactInfo.publicBusinessContact === true &&
    sourceFamilies.includes('homeharvest') &&
    String(metadata.strategyPrimary || '').trim() === 'active-stale-creative' &&
    Boolean(String(metadata.listingUrl || '').trim()) &&
    /^[0-9a-f]{64}$/.test(String(metadata.listingAgentEmailHash || '').trim().toLowerCase())
  )
}
