import { normalizePhone, safeUrl } from '@/lib/leads/utils'
import {
  phaseOneMarkets,
  type InvestorSourceType,
  type InvestorType,
  type NormalizedInvestorInput,
} from '@/lib/investors/types'

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
  { city: 'Cleveland', state: 'OH', metroArea: 'Cleveland, OH' },
  { city: 'Milwaukee', state: 'WI', metroArea: 'Milwaukee, WI' },
  { city: 'Racine', state: 'WI', metroArea: 'Racine, WI' },
  { city: 'Kenosha', state: 'WI', metroArea: 'Kenosha, WI' },
]

function classifyInvestorType(niche: string, name: string): InvestorType {
  const value = `${niche} ${name}`.toLowerCase()
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
  return [...tags].filter(Boolean)
}

function financingIndicators(type: InvestorType, niche: string) {
  const value = `${type} ${niche}`.toLowerCase()
  const indicators = new Set<string>()
  if (/fix|flip|rehab/.test(value)) indicators.add('fix_and_flip_capital')
  if (/rental|landlord|dscr/.test(value)) indicators.add('dscr_or_rental_loan_fit')
  if (/hard money|private lender|lender|capital/.test(value)) indicators.add('capital_relationship')
  if (/wholesale|assignment/.test(value)) indicators.add('transactional_funding_or_dispo_need')
  return [...indicators]
}

function propertyTypesFor(type: InvestorType, niche: string) {
  const value = `${type} ${niche}`.toLowerCase()
  const types = new Set<string>(['single_family'])
  if (/multi|apartment|property management|rental/.test(value)) types.add('small_multifamily')
  if (/commercial|mixed use/.test(value)) types.add('commercial')
  if (/land|lot/.test(value)) types.add('land')
  return [...types]
}

function marketLabel(city: string, state: string) {
  return `${city}, ${state}`
}

export async function discoverInvestorsForMarket(input: {
  city: string
  state: string
  metroArea?: string | null
  niches?: string[]
  limitPerNiche?: number
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required for investor discovery.')
  }

  const normalized: NormalizedInvestorInput[] = []
  const niches = input.niches?.length ? input.niches : DEFAULT_INVESTOR_DISCOVERY_NICHES
  const limitPerNiche = input.limitPerNiche || 3

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
        pageSize: limitPerNiche,
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
      const sourceType: InvestorSourceType =
        /foreclosure|auction/.test(niche) ? 'public_foreclosure_buyer' : /reia/i.test(niche) ? 'local_reia_directory' : 'public_property_sales'
      const markets = Array.from(new Set([marketLabel(input.city, input.state), input.metroArea || '', ...phaseOneMarkets.filter((market) => market === marketLabel(input.city, input.state))].filter(Boolean)))

      normalized.push({
        displayName,
        companyName: displayName,
        primaryInvestorType: investorType,
        classificationTags: classificationTags(investorType, niche, place.types || []),
        contactPhone: normalizePhone(place.nationalPhoneNumber || ''),
        website,
        markets,
        propertyTypes: propertyTypesFor(investorType, niche),
        estimatedBuyBox: {
          cities: [input.city],
          states: [input.state],
          propertyTypes: propertyTypesFor(investorType, niche),
          dealTypes: investorType === 'wholesaler' ? ['assignment', 'cash_purchase'] : ['cash_purchase'],
          notes: `Inferred from ${niche} discovery in ${input.city}, ${input.state}. Confirm by outreach.`,
        },
        financingIndicators: financingIndicators(investorType, niche),
        sourceNames: ['google_places_investor_discovery', sourceType],
        sourceIdentity: place.id ? `google-place:${place.id}` : website ? `website:${website}` : `name-market:${displayName.toLowerCase()}:${input.city}:${input.state}`,
        notes: `${displayName} surfaced from ${niche} search in ${input.city}, ${input.state}.`,
        metadata: {
          discoveryQuery: query,
          googlePlaceId: place.id || null,
          formattedAddress: place.formattedAddress || null,
          primaryType: place.primaryType || null,
          placeTypes: place.types || [],
          discoverySourceCoverage: [
            'recent_flip_transaction',
            'county_deed_record',
            'llc_ownership_record',
            'dealmachine_export',
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
