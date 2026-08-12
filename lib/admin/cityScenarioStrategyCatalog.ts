export type CityScenarioStrategy = {
  key: string
  label: string
  scenario: 'preforeclosure' | 'landlord' | 'probate' | 'tax' | 'code' | 'listing' | 'builder' | 'transition' | 'partnership'
  archetype: 'rust_belt_tax_code' | 'cashflow_landlord' | 'sunbelt_equity' | 'infill_redevelopment' | 'hybrid'
  cityHints: string[]
  summary: string
}

const STRATEGIES: CityScenarioStrategy[] = [
  {
    key: 'divorce-separation-quiet-exit',
    label: 'Divorce separation quiet exit',
    scenario: 'transition',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Tulsa, OK', 'Indianapolis, IN', 'Louisville, KY'],
    summary: 'Discreet seller lane for properties wrapped in active separation pressure where speed and privacy matter more than squeezing retail.',
  },
  {
    key: 'relocation-job-transfer',
    label: 'Relocation / job transfer timing',
    scenario: 'transition',
    archetype: 'sunbelt_equity',
    cityHints: ['Atlanta, GA', 'Phoenix, AZ', 'Charlotte, NC', 'Kansas City, MO'],
    summary: 'Use when move timing, employer transfer, or military-style relocation creates a clean sell-versus-rent decision point.',
  },
  {
    key: 'out-of-state-heir-remote-relief',
    label: 'Out-of-state heir remote relief',
    scenario: 'probate',
    archetype: 'cashflow_landlord',
    cityHints: ['Little Rock, AR', 'Tulsa, OK', 'Memphis, TN', 'Kansas City, MO'],
    summary: 'Inherited properties held from a distance often convert when the message centers on remote simplicity and no local cleanup burden.',
  },
  {
    key: 'senior-downsizing-medical-soft-touch',
    label: 'Senior downsizing / medical soft touch',
    scenario: 'transition',
    archetype: 'sunbelt_equity',
    cityHints: ['Phoenix, AZ', 'San Antonio, TX', 'Jacksonville, FL', 'Kansas City, MO'],
    summary: 'Soft-touch downsizing lane where move-out flexibility and no-showing simplicity matter more than aggressive investor language.',
  },
  {
    key: 'fire-storm-insurance-damage',
    label: 'Fire / storm / insurance damage',
    scenario: 'code',
    archetype: 'hybrid',
    cityHints: ['Tulsa, OK', 'Little Rock, AR', 'Kansas City, MO', 'Memphis, TN'],
    summary: 'Condition-heavy seller lane for owners stuck between repair timelines, insurance friction, and rising carrying costs.',
  },
  {
    key: 'problem-tenant-eviction-relief',
    label: 'Problem tenant / eviction relief',
    scenario: 'landlord',
    archetype: 'cashflow_landlord',
    cityHints: ['Memphis, TN', 'Kansas City, MO', 'Cleveland, OH', 'Toledo, OH'],
    summary: 'Landlord-pain lane aimed at owners who would rather exit than absorb another eviction, turnover, or occupancy fight.',
  },
  {
    key: 'fsbo-conversion-real-buyer',
    label: 'FSBO conversion real buyer',
    scenario: 'listing',
    archetype: 'sunbelt_equity',
    cityHints: ['Atlanta, GA', 'Phoenix, AZ', 'Kansas City, MO', 'Indianapolis, IN'],
    summary: 'Pre-qualified seller lane for owners already trying to move a property themselves and tired of non-serious buyers.',
  },
  {
    key: 'failed-flipper-stuck-rehab',
    label: 'Failed flipper / stuck rehab',
    scenario: 'builder',
    archetype: 'infill_redevelopment',
    cityHints: ['Detroit, MI', 'Cleveland, OH', 'Kansas City, MO', 'Indianapolis, IN'],
    summary: 'Investor-to-investor lane for projects where rehab drag, permit delays, or hard-money pressure is eating the spread.',
  },
  {
    key: 'hoa-delinquent-association-pressure',
    label: 'HOA delinquent / association pressure',
    scenario: 'tax',
    archetype: 'sunbelt_equity',
    cityHints: ['Phoenix, AZ', 'Atlanta, GA', 'Jacksonville, FL', 'Charlotte, NC'],
    summary: 'Specific pressure lane for dues, liens, and association enforcement where owners often need a clean resolution path fast.',
  },
  {
    key: 'reverse-mortgage-exit',
    label: 'Reverse mortgage exit',
    scenario: 'probate',
    archetype: 'sunbelt_equity',
    cityHints: ['Phoenix, AZ', 'San Antonio, TX', 'Jacksonville, FL', 'Little Rock, AR'],
    summary: 'Heir and senior lane for HECM or reverse-mortgage timing where equity preservation depends on moving before the lender does.',
  },
  {
    key: 'title-issue-cloud-on-title',
    label: 'Title issue / cloud on title',
    scenario: 'tax',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Cleveland, OH', 'Detroit, MI', 'Memphis, TN'],
    summary: 'Moat lane for houses other buyers reject because of deed, heirship, or quiet-title friction.',
  },
  {
    key: 'post-auction-backup-buyer',
    label: 'Post-auction / backup buyer',
    scenario: 'preforeclosure',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Tulsa, OK', 'Memphis, TN', 'Little Rock, AR'],
    summary: 'Tight-window rescue lane for cancelled auctions, redemption periods, and fallback buyer structures.',
  },
  {
    key: 'attorney-partnership-referral',
    label: 'Attorney partnership referral lane',
    scenario: 'partnership',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Tulsa, OK', 'Memphis, TN', 'Indianapolis, IN'],
    summary: 'Compounding referral lane for divorce, probate, and bankruptcy attorneys who can send deal flow repeatedly.',
  },
  {
    key: 'neighbor-referral-bird-dog',
    label: 'Neighbor referral / bird-dog lane',
    scenario: 'partnership',
    archetype: 'rust_belt_tax_code',
    cityHints: ['Cleveland, OH', 'Detroit, MI', 'Kansas City, MO', 'Memphis, TN'],
    summary: 'Referral loop that turns neighbors into hyperlocal signal sources for vacant, nuisance, and distress properties.',
  },
  {
    key: 'preforeclosure-subto-absentee-rental',
    label: 'Preforeclosure subject-to absentee rental',
    scenario: 'preforeclosure',
    archetype: 'cashflow_landlord',
    cityHints: ['Kansas City, MO', 'Memphis, TN', 'Tulsa, OK', 'Little Rock, AR', 'Indianapolis, IN'],
    summary: 'Use for investor-style or absentee owners under foreclosure pressure where a creative takeover angle is more realistic than a retail save.',
  },
  {
    key: 'auction-postponed-distress',
    label: 'Auction-postponed distress',
    scenario: 'preforeclosure',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Tulsa, OK', 'Cleveland, OH', 'Memphis, TN'],
    summary: 'Use when a sale date keeps moving and the owner likely still has unresolved timing pressure.',
  },
  {
    key: 'bankruptcy-dismissed-foreclosure-restart',
    label: 'Bankruptcy dismissed foreclosure restart',
    scenario: 'preforeclosure',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Detroit, MI', 'Cleveland, OH'],
    summary: 'Legal-sensitivity lane for owners whose protection window likely narrowed and who need manual review before outreach.',
  },
  {
    key: 'eviction-landlord-fatigue',
    label: 'Eviction landlord fatigue',
    scenario: 'landlord',
    archetype: 'cashflow_landlord',
    cityHints: ['Memphis, TN', 'Toledo, OH', 'Cleveland, OH', 'Kansas City, MO'],
    summary: 'Rental owners with turnover or court friction who may prefer a clean exit over another cycle.',
  },
  {
    key: 'utility-shutoff-absentee-landlord',
    label: 'Utility shutoff absentee landlord',
    scenario: 'landlord',
    archetype: 'rust_belt_tax_code',
    cityHints: ['Milwaukee, WI', 'Detroit, MI', 'Cleveland, OH', 'Buffalo, NY'],
    summary: 'Absentee-owner lane where utility, occupancy, or property neglect signals point to fatigue rather than long-term hold intent.',
  },
  {
    key: 'small-multifamily-breakup',
    label: 'Small multifamily breakup',
    scenario: 'landlord',
    archetype: 'cashflow_landlord',
    cityHints: ['Kansas City, MO', 'Memphis, TN', 'Indianapolis, IN', 'Louisville, KY'],
    summary: 'Use for 2-20 unit owners who may sell one tougher asset or a small cluster instead of the whole portfolio.',
  },
  {
    key: 'probate-vacant-equity',
    label: 'Probate vacant equity',
    scenario: 'probate',
    archetype: 'rust_belt_tax_code',
    cityHints: ['Milwaukee, WI', 'Detroit, MI', 'Cleveland, OH', 'Buffalo, NY'],
    summary: 'Best for inherited houses sitting vacant where heirs want simplicity more than maximized retail execution.',
  },
  {
    key: 'estate-deferred-maintenance',
    label: 'Estate deferred-maintenance',
    scenario: 'probate',
    archetype: 'hybrid',
    cityHints: ['Kansas City, MO', 'Louisville, KY', 'Indianapolis, IN'],
    summary: 'Soft-touch lane for estate-held properties needing repairs, cleanout, or family coordination.',
  },
  {
    key: 'tax-delinquent-vacant-improvement',
    label: 'Tax delinquent vacant improvement',
    scenario: 'tax',
    archetype: 'rust_belt_tax_code',
    cityHints: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Toledo, OH'],
    summary: 'Stack taxes with vacancy and physical-condition signals to reach owners most likely to need an as-is solution.',
  },
  {
    key: 'tax-delinquent-senior-owner-soft-touch',
    label: 'Tax delinquent senior-owner soft touch',
    scenario: 'tax',
    archetype: 'sunbelt_equity',
    cityHints: ['Phoenix, AZ', 'Jacksonville, FL', 'San Antonio, TX', 'Atlanta, GA'],
    summary: 'Softer copy for likely older owners where pressure exists but aggressive investor language would miss the mark.',
  },
  {
    key: 'multiple-liens-equity',
    label: 'Multiple liens equity',
    scenario: 'tax',
    archetype: 'sunbelt_equity',
    cityHints: ['Atlanta, GA', 'Phoenix, AZ', 'Jacksonville, FL', 'Kansas City, MO'],
    summary: 'High-friction title lane for owners with enough equity to solve the problem if a clean path is offered.',
  },
  {
    key: 'water-lien-absentee-stack',
    label: 'Water lien absentee stack',
    scenario: 'tax',
    archetype: 'rust_belt_tax_code',
    cityHints: ['Cleveland, OH', 'Detroit, MI', 'Milwaukee, WI', 'Buffalo, NY'],
    summary: 'Municipal-utility pressure on absentee owners is often a better seller signal than generic delinquency alone.',
  },
  {
    key: 'code-boarded-fire-damage',
    label: 'Code boarded fire-damage',
    scenario: 'code',
    archetype: 'infill_redevelopment',
    cityHints: ['Detroit, MI', 'Cleveland, OH', 'Kansas City, MO', 'Memphis, TN'],
    summary: 'Builder/rehab crossover lane where owner pain is high and buyer demand may still exist.',
  },
  {
    key: 'active-dom90-condition-problem',
    label: 'Active DOM90 condition problem',
    scenario: 'listing',
    archetype: 'hybrid',
    cityHints: ['Milwaukee, WI', 'Toledo, OH', 'Cincinnati, OH', 'Kansas City, MO'],
    summary: 'Use for stale on-market listings where condition likely matters more than seller motivation alone.',
  },
  {
    key: 'back-on-market-fatigue',
    label: 'Back on market fatigue',
    scenario: 'listing',
    archetype: 'sunbelt_equity',
    cityHints: ['Atlanta, GA', 'Jacksonville, FL', 'Phoenix, AZ', 'Charlotte, NC'],
    summary: 'Sellers relisting or falling out of contract often become more flexible without being fully distressed.',
  },
  {
    key: 'price-cut-3x-distress',
    label: 'Three-price-cut distress',
    scenario: 'listing',
    archetype: 'hybrid',
    cityHints: ['Atlanta, GA', 'Phoenix, AZ', 'Kansas City, MO', 'Indianapolis, IN'],
    summary: 'Retail-friction lane for listings where multiple reductions signal timing or condition pressure.',
  },
  {
    key: 'teardown-near-infill-demand',
    label: 'Teardown near infill demand',
    scenario: 'builder',
    archetype: 'infill_redevelopment',
    cityHints: ['Kansas City, MO', 'Detroit, MI', 'Cleveland, OH', 'Indianapolis, IN'],
    summary: 'Use where lot value and small-builder demand can beat a generic seller cash lane.',
  },
  {
    key: 'vacant-lot-tax-lien-builder',
    label: 'Vacant lot tax-lien builder',
    scenario: 'builder',
    archetype: 'infill_redevelopment',
    cityHints: ['Kansas City, MO', 'Memphis, TN', 'Cleveland, OH', 'Detroit, MI'],
    summary: 'Strong fit for buildable lots with municipal pressure and realistic local developer activity.',
  },
  {
    key: 'corner-lot-small-builder',
    label: 'Corner-lot small-builder',
    scenario: 'builder',
    archetype: 'infill_redevelopment',
    cityHints: ['Kansas City, MO', 'Indianapolis, IN', 'Memphis, TN'],
    summary: 'Hyperlocal infill lane for smaller builders who can act faster than institutional buyers.',
  },
]

const ARCHETYPE_MARKETS: Record<CityScenarioStrategy['archetype'], string[]> = {
  rust_belt_tax_code: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Toledo, OH', 'Buffalo, NY'],
  cashflow_landlord: ['Kansas City, MO', 'Memphis, TN', 'Tulsa, OK', 'Little Rock, AR', 'Indianapolis, IN', 'Louisville, KY'],
  sunbelt_equity: ['Atlanta, GA', 'Phoenix, AZ', 'Jacksonville, FL', 'San Antonio, TX', 'Charlotte, NC'],
  infill_redevelopment: ['Kansas City, MO', 'Detroit, MI', 'Cleveland, OH', 'Indianapolis, IN', 'Memphis, TN'],
  hybrid: ['Milwaukee, WI', 'Kansas City, MO', 'Cleveland, OH', 'Atlanta, GA', 'Phoenix, AZ'],
}

export function recommendCityScenarioStrategies(markets: string[], limit = 6) {
  const marketSet = new Set(markets.map((market) => String(market || '').trim()))
  const scored = STRATEGIES.map((strategy) => {
    const directHits = strategy.cityHints.filter((market) => marketSet.has(market)).length
    const archetypeHits = ARCHETYPE_MARKETS[strategy.archetype].filter((market) => marketSet.has(market)).length
    return {
      ...strategy,
      score: directHits * 3 + archetypeHits * 2 + (strategy.scenario === 'preforeclosure' ? 1 : 0),
    }
  })

  return scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export function getCityScenarioStrategyCatalog() {
  return STRATEGIES
}
