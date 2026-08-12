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

const OSM_ENDPOINTS = Array.from(new Set([
  process.env.OPENSTREETMAP_OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
].filter((value): value is string => Boolean(value))))
const OSM_USER_AGENT = 'VestBlock/1.0 (acquisitions@vestblock.io)'

type OsmElement = {
  id: number
  type: 'node' | 'way' | 'relation'
  tags?: Record<string, string>
}

function escapeOverpassValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function discoverWithOpenStreetMap(input: BuyerDiscoveryInput) {
  const city = escapeOverpassValue(input.city)
  const query = `[out:json][timeout:25];
area["name"="${city}"]["boundary"="administrative"]->.market;
(
  nwr(area.market)["name"~"investment|investor|home buyer|cash buyer|property|realty|capital|development",i]["website"];
  nwr(area.market)["name"~"investment|investor|home buyer|cash buyer|property|realty|capital|development",i]["contact:website"];
  nwr(area.market)["office"~"estate_agent|property_management|financial"];
);
out tags center ${Math.max(10, input.limitPerNiche * Math.max(1, input.niches.length))};`

  let data: { elements?: OsmElement[] } | null = null
  let lastError: unknown = null
  for (const endpoint of OSM_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': OSM_USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`)
      data = (await response.json()) as { elements?: OsmElement[] }
      break
    } catch (error) {
      lastError = error
      console.warn(`[buyers] OpenStreetMap endpoint unavailable (${endpoint}):`, error)
    }
  }
  if (!data) {
    throw new Error(
      `OpenStreetMap buyer discovery failed across ${OSM_ENDPOINTS.length} endpoint(s): ${lastError instanceof Error ? lastError.message : String(lastError || 'unknown error')}`
    )
  }

  const seen = new Set<string>()
  return (data.elements || []).flatMap((element): NormalizedBuyerInput[] => {
    const tags = element.tags || {}
    const name = String(tags.name || '').trim()
    const website = safeUrl(tags['contact:website'] || tags.website || '')
    const phone = normalizePhone(tags['contact:phone'] || tags.phone || '')
    const fingerprint = `${name.toLowerCase()}|${website || ''}`
    if (!name || seen.has(fingerprint)) return []
    seen.add(fingerprint)

    const niche = input.niches.find((term) => name.toLowerCase().includes(term.toLowerCase())) || input.niches[0] || 'real estate buyer'
    const category = classifyCategoryFromNiche(niche)
    const buyerType = BUYER_CATEGORY_TO_TYPE[category]
    return [{
      name,
      website,
      buyerType,
      category,
      headquartersCity: input.city,
      headquartersState: input.state,
      marketsServed: [input.city, input.state],
      nationalOrRegional: 'regional',
      contactEmail: tags['contact:email'] || tags.email || null,
      contactPhone: phone,
      source: 'openstreetmap_buyers',
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      externalId: `osm:${element.type}:${element.id}`,
      fitSummary: `${name} was found in public OpenStreetMap business data for ${input.city}, ${input.state}; acquisition fit still needs verification.`,
      bilingualSupport: false,
      spanishSupport: false,
      contactInfo: { osmTags: tags },
      metadata: {
        discoveryProvider: 'openstreetmap',
        niche,
        publicDataNeedsVerification: true,
      },
    }]
  })
}

async function discoverWithGoogle(input: BuyerDiscoveryInput) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured.')

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

export async function discoverBuyersForMarket(input: BuyerDiscoveryInput) {
  if (input.provider === 'openstreetmap') return discoverWithOpenStreetMap(input)
  if (input.provider === 'google') return discoverWithGoogle(input)

  const googleConfigured = Boolean(process.env.GOOGLE_PLACES_API_KEY)
  const preferFree = process.env.BUYER_DISCOVERY_PREFER_FREE === 'true'

  if (preferFree) {
    try {
      const publicResults = await discoverWithOpenStreetMap(input)
      if (publicResults.length || !googleConfigured) return publicResults
      console.warn('[buyers] OpenStreetMap returned no buyers; using configured Google fallback.')
    } catch (error) {
      if (!googleConfigured) throw error
      console.warn('[buyers] OpenStreetMap discovery unavailable; using configured Google fallback:', error)
    }
    return discoverWithGoogle(input)
  }

  if (googleConfigured) {
    try {
      return await discoverWithGoogle(input)
    } catch (error) {
      console.warn('[buyers] Google discovery unavailable; using public OpenStreetMap fallback:', error)
    }
  }

  return discoverWithOpenStreetMap(input)
}
