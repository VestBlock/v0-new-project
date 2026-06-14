export const BUILDER_PARTNER_DISCOVERY_NICHES = [
  'residential construction company',
  'real estate developer',
  'general contractor investment properties',
  'home builder',
  'spec home builder',
  'build on your lot builder',
  'development company',
  'lot developer',
  'infill builder',
  'rehab contractor investor',
] as const

export const BUILDER_PARTNER_MARKETS = [
  { city: 'Milwaukee', state: 'WI', metroArea: 'Milwaukee, WI' },
  { city: 'Toledo', state: 'OH', metroArea: 'Toledo, OH' },
  { city: 'Columbus', state: 'OH', metroArea: 'Columbus, OH' },
  { city: 'Memphis', state: 'TN', metroArea: 'Memphis, TN' },
] as const

export const BUILDER_LANE_TAGS = ['builder_partner', 'developer_partner', 'construction_company'] as const

const BUILDER_SIGNAL_REGEX =
  /builder|homebuilder|developer|development|construction|general contractor|gc\b|design build|infill|spec home|ground up|teardown|lot/i

export function isBuilderPartnerLike(input: {
  displayName?: string | null
  primaryInvestorType?: string | null
  classificationTags?: string[] | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const haystack = [
    input.displayName || '',
    input.primaryInvestorType || '',
    ...(input.classificationTags || []),
    input.notes || '',
    typeof input.metadata?.partnerLane === 'string' ? input.metadata.partnerLane : '',
  ]
    .join(' ')
    .toLowerCase()

  return BUILDER_SIGNAL_REGEX.test(haystack)
}

export function deriveBuilderClassificationTags(niche: string, displayName: string, existing: string[] = []) {
  const tags = new Set(existing)
  const haystack = `${niche} ${displayName}`.toLowerCase()

  if (/developer|development|infill|lot/.test(haystack)) tags.add('developer_partner')
  if (/construction|contractor|design build|builder/.test(haystack)) tags.add('construction_company')
  if (isBuilderPartnerLike({ displayName, classificationTags: [niche, ...existing] })) tags.add('builder_partner')
  if (/lot|land|teardown|infill/.test(haystack)) tags.add('land_or_teardown_buyer')
  if (/ground up|spec|home builder|builder/.test(haystack)) tags.add('ground_up_builder')
  if (/rehab|renovation|flip/.test(haystack)) tags.add('renovation_buyer')

  return [...tags]
}

export function builderBuyBoxQuestions(marketLabel?: string | null) {
  const marketHint = marketLabel ? ` in ${marketLabel}` : ''
  return [
    `Which neighborhoods${marketHint} are active for you right now?`,
    'Do you prefer teardown, infill lot, heavy rehab, or light-to-moderate value-add deals?',
    'What is your max all-in basis and your usual rehab or build budget range?',
    'What lot size, frontage, zoning, or square-foot minimums matter most?',
    'What close speed, inspection window, and title conditions are hard no-go items?',
  ]
}

export function builderOutreachAngle(markets: string[] = []) {
  const primaryMarket = markets[0] || null
  const questions = builderBuyBoxQuestions(primaryMarket)

  return {
    subject: primaryMarket
      ? `Builder buy box for ${primaryMarket}`
      : 'Builder and construction buy box',
    cta: 'Open to sharing your current build criteria, neighborhoods, and no-go items so we can route only builder-fit opportunities?',
    questions,
  }
}
