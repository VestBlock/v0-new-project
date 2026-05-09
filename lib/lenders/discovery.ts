import { safeUrl, normalizePhone } from '@/lib/leads/utils'
import { DEFAULT_LENDER_DISCOVERY_NICHES } from '@/lib/lenders/constants'
import type { LenderCategory, LenderDiscoveryInput, NormalizedLenderInput } from '@/lib/lenders/types'

function classifyCategoryFromNiche(niche: string, detected: LenderCategory[]): LenderCategory {
  const lower = niche.toLowerCase()
  if (detected.length) return detected[0]
  if (/credit union/.test(lower)) return 'credit_union_business'
  if (/community bank/.test(lower)) return 'community_bank'
  if (/mortgage/.test(lower)) return 'conventional_mortgage'
  if (/commercial/.test(lower)) return 'commercial'
  if (/hard money/.test(lower)) return 'hard_money'
  if (/fix and flip/.test(lower)) return 'fix_and_flip'
  if (/dscr/.test(lower)) return 'dscr'
  if (/equipment/.test(lower)) return 'equipment_finance'
  if (/sba/.test(lower)) return 'sba_7a'
  if (/truck/.test(lower)) return 'trucking_finance'
  if (/restaurant/.test(lower)) return 'restaurant_finance'
  if (/contractor/.test(lower)) return 'contractor_finance'
  if (/community development financial institution/.test(lower)) return 'cdfi'
  return 'term_loan'
}

function classifyLenderType(category: LenderCategory) {
  if (['conventional_mortgage', 'dscr', 'fix_and_flip', 'bridge', 'hard_money', 'refinance', 'brrrr_friendly', 'portfolio_bank', 'construction', 'commercial', 'sba_504_real_estate', 'heloc', 'private_lender', 'creative_finance_partner'].includes(category)) {
    return 'real_estate' as const
  }
  if (['personal_loan', 'debt_consolidation', 'credit_union_personal', 'secured_share_loan', 'heloc_personal', 'relationship_bank_line', 'credit_builder_partner'].includes(category)) {
    return 'personal' as const
  }
  if (['spanish_market', 'minority_business_program', 'women_business_program', 'immigrant_business_program', 'economic_development', 'grant_support_partner', 'nonprofit_microloan', 'medical_practice_finance', 'auto_repair_finance', 'logistics_finance'].includes(category)) {
    return 'specialty' as const
  }
  return 'business' as const
}

export async function discoverLendersForMarket(input: LenderDiscoveryInput) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is required for lender discovery.')
  }

  const normalizedLenders: NormalizedLenderInput[] = []
  const niches = input.niches.length ? input.niches : [...DEFAULT_LENDER_DISCOVERY_NICHES]

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
      throw new Error(`Lender discovery failed for ${query}: ${message}`)
    }

    const data = await response.json()
    for (const place of data.places || []) {
      const website = safeUrl(place.websiteUri)
      const category = classifyCategoryFromNiche(niche, [])
      const lenderType = classifyLenderType(category)
      const lowerName = String(place.displayName?.text || '').toLowerCase()
      const spanishSupport = /hispanic|latino|espanol|español|bilingual/.test(`${niche.toLowerCase()} ${lowerName}`)
      normalizedLenders.push({
        name: place.displayName?.text || query,
        website,
        lenderType,
        category,
        headquartersCity: input.city,
        headquartersState: input.state,
        statesServed: [input.state],
        nationalOrRegional: 'regional',
        contactEmail: null,
        contactPhone: normalizePhone(place.nationalPhoneNumber || ''),
        source: 'google_places_lenders',
        sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
        externalId: place.id,
        fitSummary: `${place.displayName?.text || 'Lender'} surfaced from ${niche} search in ${input.city}, ${input.state}.`,
        minCreditScore: category === 'credit_union_personal' ? 620 : null,
        startupAllowed: /startup|new business|microloan|cdfi|community/.test(niche.toLowerCase()),
        collateralRequired: ['hard_money', 'fix_and_flip', 'bridge', 'commercial', 'construction'].includes(category),
        ownerOccupiedAllowed: ['conventional_mortgage', 'heloc', 'heloc_personal', 'credit_union_personal'].includes(category),
        investorAllowed: ['dscr', 'fix_and_flip', 'bridge', 'hard_money', 'private_lender', 'commercial', 'portfolio_bank'].includes(category),
        rehabTolerance: ['fix_and_flip', 'hard_money', 'bridge'].includes(category) ? 7 : 2,
        firstTimeInvestorAllowed: ['dscr', 'fix_and_flip', 'portfolio_bank', 'community_bank'].includes(category),
        lowDoc: /hard money|bridge|bank statement/.test(niche.toLowerCase()),
        speedToClose: ['hard_money', 'bridge', 'fix_and_flip'].includes(category) ? 'fast' : 'standard',
        loanAmountMin: null,
        loanAmountMax: null,
        dscrMin: category === 'dscr' ? 1.0 : null,
        cashOutAllowed: ['refinance', 'heloc', 'heloc_personal', 'dscr'].includes(category),
        bilingualSupport: spanishSupport,
        spanishSupport,
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

  return normalizedLenders
}
