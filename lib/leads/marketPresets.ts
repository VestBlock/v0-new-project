export type MarketVerticalPreset = {
  id: string
  label: string
  description: string
  niches: string[]
}

export const marketVerticalPresets: MarketVerticalPreset[] = [
  {
    id: 'local_services',
    label: 'Local Services',
    description: 'High-intent local operators that often need funding, SEO, or automation help.',
    niches: ['contractors', 'roofers', 'cleaning companies', 'auto repair'],
  },
  {
    id: 'real_estate_money',
    label: 'Real Estate Money',
    description: 'Investor-adjacent businesses that fit funding, seller, and lender angles well.',
    niches: ['real estate investors', 'property managers', 'contractors', 'roofers'],
  },
  {
    id: 'minority_growth',
    label: 'Minority Growth',
    description: 'Minority and underserved business angles with strong funding-readiness fit.',
    niches: ['Spanish-speaking businesses', 'barbershops', 'salons', 'restaurants'],
  },
  {
    id: 'professional_services',
    label: 'Professional Services',
    description: 'Cash-flowing service businesses that can convert into funding or automation clients.',
    niches: ['law firms', 'insurance agencies', 'tax preparers', 'clinics'],
  },
  {
    id: 'health_beauty',
    label: 'Health + Beauty',
    description: 'Operators with strong monetization potential and recurring demand.',
    niches: ['clinics', 'med spas', 'salons', 'restaurants'],
  },
  {
    id: 'new_market_mix',
    label: 'New Market Mix',
    description: 'Balanced preset for testing a new city without overcommitting to one vertical.',
    niches: ['contractors', 'cleaning companies', 'insurance agencies', 'Spanish-speaking businesses'],
  },
]

export function findMarketPreset(id: string | null | undefined) {
  return marketVerticalPresets.find((preset) => preset.id === id) || null
}
