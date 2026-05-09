import type { NormalizedLeadInput } from '@/lib/leads/types'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { normalizePhone, safeUrl } from '@/lib/leads/utils'

type SearchGooglePlacesInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  language?: string
  region?: string
  includeWebsiteAnalysis?: boolean
}

export async function searchGooglePlaces(input: SearchGooglePlacesInput) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required.')
  }

  const normalizedLeads: NormalizedLeadInput[] = []
  const includeWebsiteAnalysis = input.includeWebsiteAnalysis !== false

  for (const niche of input.niches) {
    const query = `${niche} in ${input.city}${input.state ? `, ${input.state}` : ''}`
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'Accept-Language': input.language || 'en',
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: input.limitPerNiche,
        languageCode: input.language || 'en',
        regionCode: input.region || undefined,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      if (/API_KEY_INVALID|API key not valid/i.test(message)) {
        throw new Error(
          'Google Places API key is invalid or not activated for Places API. Regenerate the key or re-enable Places API in Google Cloud before retrying maps scraping.'
        )
      }
      throw new Error(`Google Places request failed: ${message}`)
    }

    const data = await response.json()
    for (const place of data.places || []) {
      const website = safeUrl(place.websiteUri)
      const websiteReport = includeWebsiteAnalysis
        ? await analyzeWebsiteWeakness(website)
        : {
            websiteExists: Boolean(website),
            responseTimeMs: null,
            hasViewportMeta: false,
            hasChat: false,
            hasOnlineBooking: false,
            hasClearCta: false,
            hasTrustSignals: false,
            hasContactSignals: false,
            isLikelyOutdated: false,
            estimatedSpeed: 'unknown' as const,
            weakSignals: website
              ? ['Website audit deferred for daily ingestion']
              : ['No working website detected'],
          }
      const painSignals = includeWebsiteAnalysis
        ? [...websiteReport.weakSignals]
        : website
          ? [`Potential ${niche} lead in ${input.city}`, 'Website audit deferred for scoring queue']
          : ['No working website detected']
      const lowerNiche = niche.toLowerCase()
      const needsBooking = /barber|salon|daycare|tax|immigration|auto repair|restaurant|food truck/.test(lowerNiche)
      const category = /spanish|immigration/.test(lowerNiche)
        ? 'spanish_business'
        : !websiteReport.websiteExists || (includeWebsiteAnalysis && websiteReport.weakSignals.length >= 4)
          ? 'website_upgrade'
          : needsBooking && (!includeWebsiteAnalysis || !websiteReport.hasOnlineBooking)
            ? 'appointment_booking'
            : !includeWebsiteAnalysis || !websiteReport.hasChat
              ? 'ai_receptionist'
              : 'small_business'
      const languageSignal =
        /spanish|immigration/.test(lowerNiche) ||
        /hispan|latino|espanol/i.test(String(place.displayName?.text || ''))
          ? 'spanish'
          : 'english'

      normalizedLeads.push({
        leadType: 'google_places',
        source: 'google_places_businesses',
        sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
        category,
        externalId: place.id,
        name: place.displayName?.text || null,
        businessName: place.displayName?.text || null,
        propertyAddress: place.formattedAddress || null,
        phone: normalizePhone(place.nationalPhoneNumber),
        website,
        city: input.city,
        state: input.state || null,
        languageSignal,
        painSignal:
          painSignals.length > 0
            ? painSignals.join('; ')
            : `Potential ${niche} lead in ${input.city}`,
        contactInfo: {
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          businessType: place.primaryType || null,
        },
        formData: {
          googlePlaceId: place.id,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          types: place.types || [],
        },
        metadata: {
          googlePlaceId: place.id,
          query,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          primaryType: place.primaryType || null,
          websiteAnalysis: websiteReport,
          needsBooking,
          urbanMarket: true,
        },
      })
    }
  }

  return normalizedLeads
}
