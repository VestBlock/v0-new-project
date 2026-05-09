import Outscraper from 'outscraper'
import type { NormalizedLeadInput } from '@/lib/leads/types'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { normalizePhone, safeUrl } from '@/lib/leads/utils'

type SearchOutscraperGoogleMapsInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  language?: string
  region?: string
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export async function searchOutscraperGoogleMaps(input: SearchOutscraperGoogleMapsInput) {
  const apiKey = process.env.OUTSCRAPER_API_KEY
  if (!apiKey) {
    throw new Error('OUTSCRAPER_API_KEY is required.')
  }

  const client = new Outscraper(apiKey)
  const normalizedLeads: NormalizedLeadInput[] = []
  const region = input.region || (input.state?.length === 2 ? 'us' : null)

  for (const niche of input.niches) {
    const query = `${niche} ${input.city}${input.state ? ` ${input.state}` : ''} usa`
    const response = await client.googleMapsSearch(
      [query],
      input.limitPerNiche,
      input.language || 'en',
      region,
      0,
      true,
      null,
      false
    )

    const rows = Array.isArray(response) ? response : response?.data
    if (!Array.isArray(rows)) {
      throw new Error('Outscraper returned an unexpected response shape.')
    }

    for (const row of rows) {
      const record = row as Record<string, unknown>
      const website = safeUrl(
        pickString(record, ['website', 'site', 'domain']) ||
          pickString(record, ['booking_appointment_link'])
      )
      const websiteReport = await analyzeWebsiteWeakness(website)
      const lowerNiche = niche.toLowerCase()
      const displayName =
        pickString(record, ['name', 'name_for_emails']) ||
        pickString(record, ['owner_title']) ||
        null
      const languageSignal =
        /spanish|immigration/.test(lowerNiche) ||
        /hispan|latino|espanol/i.test(
          `${displayName || ''} ${pickString(record, ['category', 'type']) || ''}`
        )
          ? 'spanish'
          : 'english'
      const websiteWeakness = websiteReport.weakSignals
      const needsBooking =
        /barber|salon|daycare|tax|immigration|auto repair|restaurant|food truck/.test(lowerNiche)
      const category =
        /spanish|immigration/.test(lowerNiche)
          ? 'spanish_business'
          : !websiteReport.websiteExists || websiteWeakness.length >= 4
            ? 'website_upgrade'
            : needsBooking && !websiteReport.hasOnlineBooking
              ? 'appointment_booking'
              : !websiteReport.hasChat
                ? 'ai_receptionist'
                : 'small_business'

      const rating = pickNumber(record, ['rating'])
      const reviewCount = pickNumber(record, ['reviews', 'reviews_count'])
      const address =
        pickString(record, ['full_address', 'address']) ||
        [pickString(record, ['street']), pickString(record, ['city']), pickString(record, ['state'])]
          .filter(Boolean)
          .join(', ') ||
        null

      normalizedLeads.push({
        leadType: 'google_places',
        source: 'outscraper_google_maps_businesses',
        sourceUrl:
          pickString(record, ['location_link']) ||
          (pickString(record, ['place_id']) ? `https://www.google.com/maps/place/?q=place_id:${pickString(record, ['place_id'])}` : null),
        category,
        externalId: pickString(record, ['place_id', 'google_id', 'cid']),
        name: displayName,
        businessName: displayName,
        propertyAddress: address,
        mailingAddress: address,
        phone: normalizePhone(pickString(record, ['phone', 'phone_1', 'phone_2'])),
        email: pickString(record, ['email_1', 'email_2', 'email_3']),
        website,
        city: pickString(record, ['city']) || input.city,
        state: pickString(record, ['state_code', 'state']) || input.state || null,
        zip: pickString(record, ['postal_code']),
        languageSignal,
        painSignal:
          websiteWeakness.length > 0
            ? websiteWeakness.join('; ')
            : `Potential ${niche} lead in ${input.city}`,
        contactInfo: {
          rating,
          reviewCount,
          businessType: pickString(record, ['type', 'category']),
        },
        formData: {
          placeId: pickString(record, ['place_id']),
          googleId: pickString(record, ['google_id']),
          cid: pickString(record, ['cid']),
          rating,
          reviewCount,
          category: pickString(record, ['category']),
          type: pickString(record, ['type']),
        },
        metadata: {
          provider: 'outscraper',
          query,
          locationLink: pickString(record, ['location_link']),
          reviewsLink: pickString(record, ['reviews_link', 'location_reviews_link']),
          category: pickString(record, ['category']),
          type: pickString(record, ['type']),
          subtypes: record.subtypes || [],
          rating,
          reviewCount,
          verified: record.verified || null,
          websiteAnalysis: websiteReport,
          needsBooking,
          urbanMarket: true,
        },
      })
    }
  }

  return normalizedLeads
}
