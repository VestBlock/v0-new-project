import { safeUrl, normalizePhone } from '@/lib/leads/utils'
import { BUYER_CATEGORY_TO_TYPE, DEFAULT_BUYER_DISCOVERY_NICHES } from '@/lib/buyers/constants'
import type { BuyerCategory, BuyerDiscoveryInput, NormalizedBuyerInput } from '@/lib/buyers/types'

function classifyCategoryFromNiche(niche: string): BuyerCategory {
  const lower = niche.toLowerCase()
  if (/hedge fund|institutional/.test(lower)) return 'hedge_fund_buyer'
  if (/sfr|single family rental|aggregator/.test(lower)) return 'sfr_aggregator'
  if (/build to rent/.test(lower)) return 'build_to_rent_buyer'
  if (/landlord|rental property/.test(lower)) return 'landlord_buyer'
  if (/brrrr/.test(lower)) return 'brrrr_buyer'
  if (/fix and flip|house flipper|flip/.test(lower)) return 'fix_and_flip_buyer'
  if (/multifamily|apartment/.test(lower)) return 'small_multifamily_buyer'
  if (/wholesale|wholesaler/.test(lower)) return 'wholesaler_buyer'
  if (/note/.test(lower)) return 'note_buyer'
  if (/creative finance|subject to|seller finance/.test(lower)) return 'creative_finance_buyer'
  if (/land buyer|vacant land|lot buyer/.test(lower)) return 'land_buyer'
  if (/commercial/.test(lower)) return 'commercial_buyer'
  if (/mobile home park/.test(lower)) return 'mobile_home_park_buyer'
  if (/self storage/.test(lower)) return 'self_storage_buyer'
  if (/mixed use/.test(lower)) return 'mixed_use_buyer'
  return 'local_cash_buyer'
}

export async function discoverBuyersForMarket(input: BuyerDiscoveryInput) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required for buyer discovery.')
  }

  const normalizedBuyers: NormalizedBuyerInput[] = []
  const niches = input.niches.length ? input.niches : [...DEFAULT_BUYER_DISCOVERY_NICHES]

  for (const niche of niches) {
    const query = `${niche} in ${input.city}, ${input.state}`
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: input.limitPerNiche,
        regionCode: 'US',
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Buyer discovery failed for ${query}: ${message}`)
    }

    const data = await response.json()
    for (const place of data.places || []) {
      const category = classifyCategoryFromNiche(niche)
      const buyerType = BUYER_CATEGORY_TO_TYPE[category]
      const website = safeUrl(place.websiteUri)
      const lowerName = String(place.displayName?.text || '').toLowerCase()
      const spanishSupport = /hispanic|latino|espanol|español|bilingual/.test(`${niche.toLowerCase()} ${lowerName}`)
      normalizedBuyers.push({
        name: place.displayName?.text || query,
        website,
        buyerType,
        category,
        headquartersCity: input.city,
        headquartersState: input.state,
        marketsServed: [input.city, input.state],
        nationalOrRegional: buyerType === 'institutional' ? 'national' : 'regional',
        contactEmail: null,
        contactPhone: normalizePhone(place.nationalPhoneNumber || ''),
        source: 'google_places_buyers',
        sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
        externalId: place.id,
        fitSummary: `${place.displayName?.text || 'Buyer'} surfaced from ${niche} search in ${input.city}, ${input.state}.`,
        bilingualSupport: spanishSupport,
        spanishSupport,
        proofOfFundsStatus: buyerType === 'institutional' ? 'likely_institutional' : null,
        closingSpeed:
          category === 'local_cash_buyer' || category === 'fix_and_flip_buyer' || category === 'wholesaler_buyer'
            ? 'fast'
            : null,
        contactInfo: {
          googleTypes: place.types || [],
          primaryType: place.primaryType || null,
        },
        metadata: {
          discoveryQuery: query,
          niche,
          formattedAddress: place.formattedAddress || null,
        },
      })
    }
  }

  return normalizedBuyers
}
