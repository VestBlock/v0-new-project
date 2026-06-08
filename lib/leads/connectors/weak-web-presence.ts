import { searchOutscraperGoogleMaps } from '@/lib/leads/connectors/outscraper-google-maps'
import type { NormalizedLeadInput, WebsiteWeaknessReport } from '@/lib/leads/types'

type SearchWeakWebPresenceInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  language?: string
  region?: string
  requestTimeoutMs?: number
}

function getWebsiteAudit(lead: NormalizedLeadInput): Partial<WebsiteWeaknessReport> {
  const direct = lead.websiteAudit || {}
  const metadata = lead.metadata || {}
  const nested = metadata.websiteAnalysis && typeof metadata.websiteAnalysis === 'object'
    ? metadata.websiteAnalysis
    : {}

  return {
    ...nested,
    ...direct,
  } as Partial<WebsiteWeaknessReport>
}

function weakPresenceReasons(lead: NormalizedLeadInput) {
  const audit = getWebsiteAudit(lead)
  const weakSignals = Array.isArray(audit.weakSignals) ? audit.weakSignals : []
  const reasons = [
    !lead.website ? 'no_website_listed' : null,
    audit.websiteExists === false ? 'website_unreachable' : null,
    audit.estimatedSpeed === 'slow' || audit.estimatedSpeed === 'unreachable' ? `site_${audit.estimatedSpeed}` : null,
    audit.hasClearCta === false ? 'missing_clear_cta' : null,
    audit.hasOnlineBooking === false ? 'missing_online_booking' : null,
    audit.hasChat === false ? 'missing_chat_or_receptionist' : null,
    audit.hasContactSignals === false ? 'weak_contact_path' : null,
    audit.hasTrustSignals === false ? 'weak_trust_signals' : null,
    weakSignals.length >= 3 ? 'multiple_website_weaknesses' : null,
  ].filter(Boolean) as string[]

  return Array.from(new Set([...reasons, ...weakSignals.slice(0, 4)]))
}

function isWeakWebPresenceLead(lead: NormalizedLeadInput) {
  return weakPresenceReasons(lead).length > 0
}

function pickBestOffer(lead: NormalizedLeadInput, reasons: string[]) {
  const haystack = `${lead.niche || ''} ${lead.category || ''} ${lead.painSignal || ''}`.toLowerCase()
  if (/appointment|booking|salon|barber|med spa|clinic|dental|chiropractor|auto repair/.test(haystack)) {
    return 'AI Appointment Booking System' as const
  }

  if (reasons.includes('missing_chat_or_receptionist') || reasons.includes('weak_contact_path')) {
    return 'AI Receptionist Launch' as const
  }

  return 'Website Upgrade Sprint' as const
}

export async function searchWeakWebPresenceBusinesses(input: SearchWeakWebPresenceInput) {
  const leads = await searchOutscraperGoogleMaps({
    city: input.city,
    state: input.state,
    niches: input.niches,
    limitPerNiche: input.limitPerNiche,
    language: input.language || 'en',
    region: input.region || 'US',
    includeWebsiteAnalysis: true,
    requestTimeoutMs: input.requestTimeoutMs || 25000,
  })

  return leads.filter(isWeakWebPresenceLead).map((lead) => {
    const reasons = weakPresenceReasons(lead)
    const audit = getWebsiteAudit(lead)
    const reasonText = reasons.slice(0, 4).join('; ')
    return {
      ...lead,
      source: 'weak_web_presence_businesses',
      category: lead.category === 'appointment_booking' ? 'appointment_booking' : 'website_upgrade',
      bestOffer: pickBestOffer(lead, reasons),
      marketSegment: 'weak_web_presence',
      campaignName: 'weak_web_presence_services',
      painSignal: reasonText || lead.painSignal || 'Weak website or missing website signals',
      outreachAngle:
        lead.website
          ? 'Website appears to have conversion, booking, speed, or trust gaps.'
          : 'Business appears to have no website listed, which creates a visibility and lead-capture gap.',
      websiteAudit: audit,
      contactInfo: {
        ...(lead.contactInfo || {}),
        weakWebPresence: true,
        weakPresenceReasons: reasons,
        recommendedOffer: pickBestOffer(lead, reasons),
      },
      metadata: {
        ...(lead.metadata || {}),
        weakWebPresence: true,
        weakPresenceReasons: reasons,
        sourceProvider: lead.source,
        originalSource: lead.source,
        originalExternalId: lead.externalId || null,
      },
    } satisfies NormalizedLeadInput
  })
}
