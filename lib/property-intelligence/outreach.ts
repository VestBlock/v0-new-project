import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

function publicSignals(property: PropertyIntelligenceRecord) {
  return (property.property_signals || []).map((signal) => signal.signal_label).slice(0, 5)
}

export function generateSafeOutreachSummary(property: PropertyIntelligenceRecord) {
  const score = property.deal_scores?.[0]
  const owner = property.owner_entities?.owner_name || 'Owner'
  const address = [property.property_address, property.city, property.state].filter(Boolean).join(', ')
  const signals = publicSignals(property)
  const fitReason = signals.length
    ? `Public records reviewed by VestBlock show: ${signals.join(', ')}.`
    : 'This property may be worth a public-record review based on location and property details.'
  const angle = property.is_vacant_lot
    ? 'Vacant or land-focused review with builder, infill, and land-buyer routing.'
    : score && score.score >= 70
      ? 'Owner-options review with cash, creative, novation, or buyer-routing paths.'
      : 'Low-pressure property review to see whether any VestBlock route fits.'

  return {
    propertyAddress: address || 'Property address unavailable',
    ownerName: owner,
    publicSignals: signals,
    reasonThisMayFit: fitReason,
    suggestedOutreachAngle: angle,
    suggestedSms: `Hi ${owner}, this is VestBlock. We are reviewing ${address || 'your property'} using public records and wanted to see if you would be open to a quick options review. If not, no worries.`,
    suggestedEmail: `Subject: Quick question about ${address || 'your property'}\n\nHi ${owner},\n\nThis is VestBlock. We review public-record property situations and route owners to the cleanest option when there is a fit, including cash review, creative terms, land/builder buyers, or a referral path.\n\n${fitReason}\n\nWould you be open to a short conversation about whether any option is worth reviewing?\n\nBest,\nVestBlock`,
    suggestedCallOpener: `Hi ${owner}, this is VestBlock. I am calling about ${address || 'a property record we reviewed'}. We use public records to see whether a property might fit one of our buyer or owner-option lanes. Did I catch you at an okay time?`,
  }
}
