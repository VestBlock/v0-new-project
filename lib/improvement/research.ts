export type ResearchSource = {
  theme: string
  title: string
  url: string
  sourceType: 'official' | 'industry' | 'public-data'
  focus: string
}

const RESEARCH_SOURCES: ResearchSource[] = [
  {
    theme: 'credit_repair',
    title: 'CFPB Credit Reports and Scores',
    url: 'https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/',
    sourceType: 'official',
    focus: 'Track dispute rights, bureau guidance, and consumer-protection framing for credit repair workflows.',
  },
  {
    theme: 'credit_repair',
    title: 'IdentityTheft.gov',
    url: 'https://www.identitytheft.gov/',
    sourceType: 'official',
    focus: 'Track identity-theft documentation steps and recovery workflow guidance.',
  },
  {
    theme: 'funding_readiness',
    title: 'SBA Funding Programs',
    url: 'https://www.sba.gov/funding-programs',
    sourceType: 'official',
    focus: 'Track official small-business funding language, readiness signals, and program framing.',
  },
  {
    theme: 'seo_aeo',
    title: 'Google Search Central',
    url: 'https://developers.google.com/search',
    sourceType: 'official',
    focus: 'Track indexing, content quality, crawl, and structured-data guidance for SEO/AEO workflows.',
  },
  {
    theme: 'local_leadgen',
    title: 'Census Annual Business Survey',
    url: 'https://www.census.gov/programs-surveys/abs.html',
    sourceType: 'public-data',
    focus: 'Monitor business density and segment patterns for new market expansion opportunities.',
  },
  {
    theme: 'small_business_automation',
    title: 'Google Business Profile Help',
    url: 'https://support.google.com/business/',
    sourceType: 'official',
    focus: 'Track local business presence, booking, messaging, and trust-signal guidance that informs automation offers.',
  },
  {
    theme: 'real_estate_distress',
    title: 'HUD Housing Counseling Resources',
    url: 'https://www.hud.gov/housing',
    sourceType: 'official',
    focus: 'Track compliant housing/seller support framing and distress-resource language.',
  },
  {
    theme: 'spanish_growth',
    title: 'U.S. Census Hispanic-Owned Businesses',
    url: 'https://www.census.gov/library/stories/2021/10/hispanic-owned-businesses-add-diversity-to-economy.html',
    sourceType: 'public-data',
    focus: 'Track Hispanic small-business patterns that can inform Spanish funding and support offers.',
  },
]

export function listResearchSources(themes?: string[]) {
  if (!themes?.length) return RESEARCH_SOURCES
  return RESEARCH_SOURCES.filter((source) => themes.includes(source.theme))
}

export function buildResearchBriefsFromSources(input: {
  weakSpots: string[]
  topWins: string[]
  createdByRunId?: string | null
}) {
  const themes = new Set<string>()

  for (const item of input.weakSpots) {
    const normalized = item.toLowerCase()
    if (normalized.includes('dispute') || normalized.includes('credit')) themes.add('credit_repair')
    if (normalized.includes('funding')) themes.add('funding_readiness')
    if (normalized.includes('seo') || normalized.includes('content')) themes.add('seo_aeo')
    if (normalized.includes('city') || normalized.includes('market') || normalized.includes('lead')) themes.add('local_leadgen')
    if (normalized.includes('spanish')) themes.add('spanish_growth')
    if (normalized.includes('seller') || normalized.includes('property')) themes.add('real_estate_distress')
    if (normalized.includes('automation') || normalized.includes('booking') || normalized.includes('website')) {
      themes.add('small_business_automation')
    }
  }

  if (!themes.size) {
    themes.add('credit_repair')
    themes.add('funding_readiness')
    themes.add('seo_aeo')
  }

  const sources = listResearchSources(Array.from(themes))
  return sources.map((source) => ({
    theme: source.theme,
    sourceType: source.sourceType,
    sourceUrl: source.url,
    sourceTitle: source.title,
    briefTitle: `${source.title}: next VestBlock review`,
    summary: `${source.focus} Use this source to compare VestBlock's current workflows against a higher-confidence public baseline, then feed any changes into the approval queue instead of changing customer-facing logic blindly.`,
    recommendations: [
      `Review ${source.title} for ${source.focus.toLowerCase()}`,
      input.weakSpots[0]
        ? `Cross-check it against this current weak spot: ${input.weakSpots[0]}`
        : 'Map any useful findings into a concrete strategy update for VestBlock.',
      input.topWins[0]
        ? `Protect what is already working well: ${input.topWins[0]}`
        : 'Record any winning patterns that should be protected before making changes.',
    ],
    priority: source.sourceType === 'official' ? 'high' as const : 'medium' as const,
    createdByRunId: input.createdByRunId ?? null,
  }))
}
