import { normalizePhone, safeUrl } from '@/lib/leads/utils'
import { searchOutscraperGoogleMaps } from '@/lib/leads/connectors/outscraper-google-maps'
import { searchApifyYelp } from '@/lib/leads/connectors/apify-yelp'
import {
  phaseOneMarkets,
  type InvestorSourceType,
  type InvestorType,
  type NormalizedInvestorInput,
} from '@/lib/investors/types'
import {
  BUILDER_PARTNER_DISCOVERY_NICHES,
  deriveBuilderClassificationTags,
  isBuilderPartnerLike,
} from '@/lib/investors/builderStrategy'

export const DEFAULT_INVESTOR_DISCOVERY_NICHES = [
  'real estate investor',
  'we buy houses',
  'cash home buyer',
  'house flipper',
  'real estate wholesaler',
  'rental property investor',
  'property management company',
  'hard money lender',
  'private money lender',
  'real estate acquisitions',
  'foreclosure auction buyer',
  'REIA real estate investor',
]

export const DEFAULT_INVESTOR_DISCOVERY_MARKETS = [
  { city: 'Toledo', state: 'OH', metroArea: 'Toledo, OH' },
  { city: 'Columbus', state: 'OH', metroArea: 'Columbus, OH' },
  { city: 'Cleveland', state: 'OH', metroArea: 'Cleveland, OH' },
  { city: 'Milwaukee', state: 'WI', metroArea: 'Milwaukee, WI' },
  { city: 'Memphis', state: 'TN', metroArea: 'Memphis, TN' },
  { city: 'Chicago', state: 'IL', metroArea: 'Chicago, IL' },
]

function classifyInvestorType(niche: string, name: string): InvestorType {
  const value = `${niche} ${name}`.toLowerCase()
  if (isBuilderPartnerLike({ displayName: name, classificationTags: [niche] })) return 'acquisition_manager'
  if (/hard money|private money|lender|funding|capital/.test(value)) return 'private_lender'
  if (/wholesale|wholesaler/.test(value)) return 'wholesaler'
  if (/acquisition/.test(value)) return 'acquisition_manager'
  if (/institutional|reit|fund|asset management/.test(value)) return 'institutional_buyer'
  if (/dscr|rental|landlord|property management/.test(value)) return 'dscr_investor'
  if (/hold|rental/.test(value)) return 'buy_and_hold'
  if (/flip|rehab|we buy houses|cash home buyer/.test(value)) return 'fix_and_flip'
  return 'fix_and_flip'
}

function classificationTags(type: InvestorType, niche: string, placeTypes: string[] = []) {
  const tags = new Set<string>([type, niche.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')])
  const joined = `${niche} ${placeTypes.join(' ')}`.toLowerCase()
  if (/lender|funding|capital|loan/.test(joined)) tags.add('capital_provider')
  if (/property management|rental|landlord|dscr/.test(joined)) tags.add('rental_operator')
  if (/flip|rehab|cash home buyer|we buy houses/.test(joined)) tags.add('renovation_buyer')
  if (/wholesale|assignment/.test(joined)) tags.add('disposition_partner')
  for (const tag of deriveBuilderClassificationTags(niche, joined, [...tags])) tags.add(tag)
  return [...tags].filter(Boolean)
}

function financingIndicators(type: InvestorType, niche: string) {
  const value = `${type} ${niche}`.toLowerCase()
  const indicators = new Set<string>()
  if (/fix|flip|rehab/.test(value)) indicators.add('fix_and_flip_capital')
  if (/rental|landlord|dscr/.test(value)) indicators.add('dscr_or_rental_loan_fit')
  if (/hard money|private lender|lender|capital/.test(value)) indicators.add('capital_relationship')
  if (/wholesale|assignment/.test(value)) indicators.add('transactional_funding_or_dispo_need')
  if (/builder|construction|developer|development|ground up|spec home|infill/.test(value)) {
    indicators.add('ground_up_or_renovation_acquisition_fit')
    indicators.add('builder_buy_box_needed')
  }
  return [...indicators]
}

function propertyTypesFor(type: InvestorType, niche: string) {
  const value = `${type} ${niche}`.toLowerCase()
  const types = new Set<string>(['single_family'])
  if (/multi|apartment|property management|rental/.test(value)) types.add('small_multifamily')
  if (/commercial|mixed use/.test(value)) types.add('commercial')
  if (/land|lot/.test(value)) types.add('land')
  if (/builder|construction|developer|development|spec|infill/.test(value)) {
    types.add('single_family')
    types.add('land')
  }
  return [...types]
}

function marketLabel(city: string, state: string) {
  return `${city}, ${state}`
}

function normalizeMarketSet(input: { city: string; state: string; metroArea?: string | null }) {
  return Array.from(
    new Set(
      [
        marketLabel(input.city, input.state),
        input.metroArea || '',
        ...phaseOneMarkets.filter((market) => market === marketLabel(input.city, input.state)),
      ].filter(Boolean)
    )
  )
}

function isGooglePlacesPermissionIssue(error: unknown) {
  if (!(error instanceof Error)) return false
  const value = error.message.toLowerCase()
  return value.includes('permission_denied') || value.includes('does not have permission') || value.includes('403')
}

function shouldTryDirectoryFallback(error: unknown) {
  if (!(error instanceof Error)) return false
  const value = error.message.toLowerCase()
  return (
    value.includes('402') ||
    value.includes('payment required') ||
    value.includes('verify your credit card') ||
    value.includes('outscraper maps request failed')
  )
}

async function discoverInvestorsViaGooglePlaces(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required for investor discovery.')
  }

  const normalized: NormalizedInvestorInput[] = []
  const markets = normalizeMarketSet(input)

  for (const niche of input.niches) {
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
      throw new Error(`Investor discovery failed for ${query}: ${message}`)
    }

    const data = await response.json()
    for (const place of data.places || []) {
      const displayName = String(place.displayName?.text || query).trim()
      const website = safeUrl(place.websiteUri)
      const investorType = classifyInvestorType(niche, displayName)
      const isBuilderLane = isBuilderPartnerLike({
        displayName,
        classificationTags: [niche, ...(place.types || [])],
      })
      const sourceType: InvestorSourceType =
        /foreclosure|auction/.test(niche) ? 'public_foreclosure_buyer' : /reia/i.test(niche) ? 'local_reia_directory' : 'public_property_sales'
      const propertyTypes = propertyTypesFor(investorType, niche)

      normalized.push({
        displayName,
        companyName: displayName,
        primaryInvestorType: investorType,
        classificationTags: classificationTags(investorType, niche, place.types || []),
        contactPhone: normalizePhone(place.nationalPhoneNumber || ''),
        website,
        markets,
        propertyTypes,
        estimatedBuyBox: {
          cities: [input.city],
          states: [input.state],
          propertyTypes,
          dealTypes: isBuilderLane
            ? ['assignment', 'cash_purchase', 'ground_up', 'heavy_rehab', 'lot_acquisition']
            : investorType === 'wholesaler'
              ? ['assignment', 'cash_purchase']
              : ['cash_purchase'],
          notes: isBuilderLane
            ? `Builder or construction buy box inferred from ${niche} discovery in ${input.city}, ${input.state}. Confirm neighborhoods, lot rules, rehab tolerance, close speed, and max all-in basis by outreach.`
            : `Inferred from ${niche} discovery in ${input.city}, ${input.state}. Confirm by outreach.`,
        },
        financingIndicators: financingIndicators(investorType, niche),
        sourceNames: ['google_places_investor_discovery', sourceType],
        sourceIdentity: place.id ? `google-place:${place.id}` : website ? `website:${website}` : `name-market:${displayName.toLowerCase()}:${input.city}:${input.state}`,
        notes: `${displayName} surfaced from ${niche} search in ${input.city}, ${input.state}.`,
        metadata: {
          discoveryQuery: query,
          discoveryProvider: 'google_places',
          partnerLane: isBuilderLane ? 'builder_disposition' : 'investor_partnership',
          googlePlaceId: place.id || null,
          formattedAddress: place.formattedAddress || null,
          primaryType: place.primaryType || null,
          placeTypes: place.types || [],
          discoverySourceCoverage: [
            'recent_flip_transaction',
            'county_deed_record',
            'llc_ownership_record',
            'dealmachine_native_api',
            'public_property_sales',
            'linkedin',
            'facebook_investor_group',
            'local_reia_directory',
            'public_foreclosure_buyer',
          ],
        },
        evidence: [
          {
            sourceType,
            sourceName: 'Google Places investor discovery',
            sourceUrl: place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null,
            externalId: place.id || null,
            recordDate: new Date().toISOString().slice(0, 10),
            confidenceScore: website || place.nationalPhoneNumber ? 72 : 58,
            evidenceSummary: `${niche} result in ${input.city}, ${input.state}.`,
            rawPayload: {
              placeId: place.id || null,
              query,
              formattedAddress: place.formattedAddress || null,
              types: place.types || [],
            },
          },
        ],
      })
    }
  }

  return normalized
}

async function discoverInvestorsViaOutscraper(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const leads = await searchOutscraperGoogleMaps({
    city: input.city,
    state: input.state,
    niches: input.niches,
    limitPerNiche: input.limitPerNiche,
    includeWebsiteAnalysis: false,
    requestTimeoutMs: 30000,
  })

  const markets = normalizeMarketSet(input)
  const normalized: NormalizedInvestorInput[] = []

  for (const lead of leads) {
      const niche = String(lead.metadata?.niche || '').trim() || input.niches[0] || 'real estate investor'
      const displayName = String(lead.businessName || lead.name || '').trim()
      if (!displayName) continue

      const investorType = classifyInvestorType(niche, displayName)
      const sourceType: InvestorSourceType =
        /foreclosure|auction/.test(niche) ? 'public_foreclosure_buyer' : /reia/i.test(niche) ? 'local_reia_directory' : 'public_property_sales'
      const combinedTags = [niche, String(lead.contactInfo?.businessType || ''), ...(Array.isArray(lead.metadata?.subtypes) ? lead.metadata.subtypes.map(String) : [])]
      const isBuilderLane = isBuilderPartnerLike({
        displayName,
        classificationTags: combinedTags,
      })
      const propertyTypes = propertyTypesFor(investorType, niche)
      const locationLink =
        typeof lead.metadata?.locationLink === 'string'
          ? safeUrl(lead.metadata.locationLink)
          : safeUrl(lead.sourceUrl)

      normalized.push({
        displayName,
        companyName: displayName,
        primaryInvestorType: investorType,
        classificationTags: classificationTags(investorType, niche, combinedTags),
        contactEmail: lead.email || null,
        contactPhone: normalizePhone(lead.phone || ''),
        website: safeUrl(lead.website),
        markets,
        propertyTypes,
        estimatedBuyBox: {
          cities: [input.city],
          states: [input.state],
          propertyTypes,
          dealTypes: isBuilderLane
            ? ['assignment', 'cash_purchase', 'ground_up', 'heavy_rehab', 'lot_acquisition']
            : investorType === 'wholesaler'
              ? ['assignment', 'cash_purchase']
              : ['cash_purchase'],
          notes: isBuilderLane
            ? `Builder or construction buy box inferred from ${niche} directory discovery in ${input.city}, ${input.state}. Confirm neighborhoods, teardown vs rehab preference, max all-in basis, and close speed by outreach.`
            : `Inferred from ${niche} directory discovery in ${input.city}, ${input.state}. Confirm by outreach.`,
        },
        financingIndicators: financingIndicators(investorType, niche),
        sourceNames: ['outscraper_google_maps_businesses', sourceType],
        sourceIdentity:
          lead.externalId
            ? `outscraper-place:${lead.externalId}`
            : lead.website
              ? `website:${lead.website}`
              : `name-market:${displayName.toLowerCase()}:${input.city}:${input.state}`,
        notes: `${displayName} surfaced from ${niche} directory discovery in ${input.city}, ${input.state}.`,
        metadata: {
          discoveryQuery: String(lead.metadata?.query || `${niche} ${input.city} ${input.state}`),
          discoveryProvider: 'outscraper_google_maps',
          partnerLane: isBuilderLane ? 'builder_disposition' : 'investor_partnership',
          formattedAddress: lead.propertyAddress || null,
          placeTypes: Array.isArray(lead.metadata?.subtypes) ? lead.metadata.subtypes : [],
          contactInfo: lead.contactInfo || {},
          discoverySourceCoverage: [
            'recent_flip_transaction',
            'county_deed_record',
            'llc_ownership_record',
            'dealmachine_native_api',
            'public_property_sales',
            'linkedin',
            'facebook_investor_group',
            'local_reia_directory',
            'public_foreclosure_buyer',
          ],
        },
        evidence: [
          {
            sourceType,
            sourceName: 'Outscraper Maps investor discovery',
            sourceUrl: locationLink,
            externalId: lead.externalId || null,
            recordDate: new Date().toISOString().slice(0, 10),
            confidenceScore: lead.email ? 84 : lead.phone || lead.website ? 72 : 60,
            evidenceSummary: `${niche} directory result in ${input.city}, ${input.state}.`,
            rawPayload: {
              source: lead.source,
              query: lead.metadata?.query || null,
              category: lead.contactInfo?.businessType || null,
              address: lead.propertyAddress || null,
            },
          },
        ],
      } satisfies NormalizedInvestorInput)
  }

  return normalized
}

async function discoverInvestorsViaApifyYelp(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const leads = await searchApifyYelp({
    city: input.city,
    state: input.state,
    niches: input.niches,
    limitPerNiche: input.limitPerNiche,
    proxyCountry: process.env.APIFY_PROXY_COUNTRY || 'US',
    maxWaitMs: Number.parseInt(process.env.INVESTOR_APIFY_MAX_WAIT_MS || '', 10) || 120000,
    timeoutSecs: Number.parseInt(process.env.INVESTOR_APIFY_TIMEOUT_SECS || '', 10) || 240,
  })

  const markets = normalizeMarketSet(input)
  const normalized: NormalizedInvestorInput[] = []

  for (const lead of leads) {
    const niche = String(lead.metadata?.niche || '').trim() || input.niches[0] || 'real estate investor'
    const displayName = String(lead.businessName || lead.name || '').trim()
    if (!displayName) continue

    const investorType = classifyInvestorType(niche, displayName)
    const sourceType: InvestorSourceType = 'manual_research'
    const combinedTags = [niche, String(lead.contactInfo?.businessType || '')]
    const isBuilderLane = isBuilderPartnerLike({
      displayName,
      classificationTags: combinedTags,
    })
    const propertyTypes = propertyTypesFor(investorType, niche)

    normalized.push({
      displayName,
      companyName: displayName,
      primaryInvestorType: investorType,
      classificationTags: classificationTags(investorType, niche, combinedTags),
      contactPhone: normalizePhone(lead.phone || ''),
      website: safeUrl(lead.website),
      markets,
      propertyTypes,
      estimatedBuyBox: {
        cities: [input.city],
        states: [input.state],
        propertyTypes,
        dealTypes: isBuilderLane
          ? ['assignment', 'cash_purchase', 'ground_up', 'heavy_rehab', 'lot_acquisition']
          : investorType === 'wholesaler'
            ? ['assignment', 'cash_purchase']
            : ['cash_purchase'],
        notes: isBuilderLane
          ? `Builder or construction buy box inferred from ${niche} directory discovery in ${input.city}, ${input.state}. Confirm neighborhoods, teardown vs rehab preference, max all-in basis, and close speed by outreach.`
          : `Inferred from ${niche} directory discovery in ${input.city}, ${input.state}. Confirm by outreach.`,
      },
      financingIndicators: financingIndicators(investorType, niche),
      sourceNames: ['apify_yelp_businesses', sourceType],
      sourceIdentity:
        lead.externalId
          ? `apify-yelp:${lead.externalId}`
          : lead.website
            ? `website:${lead.website}`
            : `name-market:${displayName.toLowerCase()}:${input.city}:${input.state}`,
      notes: `${displayName} surfaced from ${niche} directory discovery in ${input.city}, ${input.state}.`,
      metadata: {
        discoveryQuery: String(lead.metadata?.searchString || `${niche} ${input.city} ${input.state}`),
        discoveryProvider: 'apify_yelp',
        partnerLane: isBuilderLane ? 'builder_disposition' : 'investor_partnership',
        formattedAddress: lead.propertyAddress || null,
        directory: 'yelp',
        contactInfo: lead.contactInfo || {},
        discoverySourceCoverage: [
          'manual_research',
          'linkedin',
          'facebook_investor_group',
          'local_reia_directory',
          'public_property_sales',
        ],
      },
      evidence: [
        {
          sourceType,
          sourceName: 'Apify Yelp investor discovery',
          sourceUrl: safeUrl(lead.sourceUrl),
          externalId: lead.externalId || null,
          recordDate: new Date().toISOString().slice(0, 10),
          confidenceScore: lead.phone || lead.website ? 68 : 55,
          evidenceSummary: `${niche} Yelp result in ${input.city}, ${input.state}.`,
          rawPayload: {
            source: lead.source,
            searchString: lead.metadata?.searchString || null,
            category: lead.contactInfo?.businessType || null,
            address: lead.propertyAddress || null,
          },
        },
      ],
    })
  }

  return normalized
}

export async function discoverInvestorsForMarket(input: {
  city: string
  state: string
  metroArea?: string | null
  niches?: string[]
  limitPerNiche?: number
}) {
  const niches = input.niches?.length ? input.niches : DEFAULT_INVESTOR_DISCOVERY_NICHES
  const limitPerNiche = input.limitPerNiche || 3
  const request = {
    city: input.city,
    state: input.state,
    metroArea: input.metroArea,
    niches,
    limitPerNiche,
  }

  try {
    return await discoverInvestorsViaGooglePlaces(request)
  } catch (error) {
    const canFallback = Boolean(process.env.OUTSCRAPER_API_KEY || process.env.APIFY_TOKEN)
    if (!canFallback || !isGooglePlacesPermissionIssue(error)) {
      throw error
    }
  }

  try {
    if (process.env.OUTSCRAPER_API_KEY) {
      return await discoverInvestorsViaOutscraper(request)
    }
  } catch (error) {
    if (!process.env.APIFY_TOKEN || !shouldTryDirectoryFallback(error)) {
      throw error
    }
  }

  if (process.env.APIFY_TOKEN) {
    if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
      throw new Error(
        'Builder directory fallback is blocked in production: Google Places text search lacks permission, Outscraper credits are unavailable, and the Apify fallback is too slow for the current function timeout. Restore Google Places access or Outscraper credits, or run a manual builder discovery session.'
      )
    }
    return discoverInvestorsViaApifyYelp(request)
  }

  throw new Error('Investor discovery fallback requires either OUTSCRAPER_API_KEY credits or APIFY_TOKEN.')
}

export const DEFAULT_BUILDER_DISCOVERY_NICHES = [...BUILDER_PARTNER_DISCOVERY_NICHES]
