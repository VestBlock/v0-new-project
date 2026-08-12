const CORE_MARKETS = [
  'Milwaukee, WI',
  'Detroit, MI',
  'Cleveland, OH',
  'Toledo, OH',
  'Buffalo, NY',
  'Kansas City, MO',
  'Memphis, TN',
  'Tulsa, OK',
  'Little Rock, AR',
  'Indianapolis, IN',
  'Louisville, KY',
  'Cincinnati, OH',
  'Columbus, OH',
  'Pittsburgh, PA',
  'Atlanta, GA',
  'Charlotte, NC',
  'Jacksonville, FL',
  'Phoenix, AZ',
  'San Antonio, TX',
]

export const DEALMACHINE_STRATEGY_FIELDS = [
  'estimated_value',
  'estimated_equity_amount',
  'estimated_equity_percentage',
  'property_type',
  'num_units',
  'year_built',
  'living_area_sqft',
  'owner_1_full_name',
  'owner_2_full_name',
  'num_mortgages',
  'estimated_loan_to_value_percentage',
  'total_estimated_loan_balance',
  'total_estimated_loan_payment_monthly',
  'mortgage_1_loan_balance',
  'mortgage_1_loan_interest_rate',
  'mortgage_1_loan_type',
  'mortgage_1_lender_name',
  'mortgage_1_estimated_payment_amount',
  'mortgage_1_loan_due_date',
  'market_status',
  'mls_current_listing_price',
  'mls_days_on_market',
  'mls_last_initial_listing_date',
  'foreclosure_auction_date',
  'foreclosure_default_date',
  'foreclosure_doc_type',
  'foreclosure_status',
  'property_preforeclosure_status',
  'tax_delinquent_year',
  'num_total_active_liens',
  'lot_size_acres',
  'zoning',
  'parcel_number_raw',
  'legal_description',
  'building_condition',
]

function filter(filterId, operator, value, options = {}) {
  return { filterId, operator, value, ...options }
}

function options(filterId, optionLabels, operator = 'contains_any', config = {}) {
  return { filterId, operator, optionLabels, ...config }
}

function variant(key, signals, filters, config = {}) {
  return { key, signals, filters, ...config }
}

export const DEALMACHINE_STRATEGIES = [
  {
    key: 'preforeclosure-equity',
    label: 'Preforeclosure creative options',
    markets: ['Kansas City, MO', 'Tulsa, OK', 'Memphis, TN', 'Little Rock, AR', 'Indianapolis, IN'],
    reviewOnly: true,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.08,
    variants: [variant('active-mortgage', ['preforeclosure', 'active_mortgage'], [
      filter('is_preforeclosure', null, true),
      filter('num_mortgages', 'greater_than_or_equal', 1),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'tax-code-stack',
    label: 'Tax delinquent code-stack candidates',
    markets: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Toledo, OH', 'Kansas City, MO', 'Wichita, KS'],
    reviewOnly: true,
    candidateOnly: true,
    candidateReason: 'DealMachine verifies tax delinquency; county code-enforcement evidence is still required.',
    enabled: true,
    lowball: false,
    budgetWeight: 0.04,
    variants: [variant('tax-candidate', ['tax_delinquent'], [
      filter('is_tax_delinquent', null, true),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'tax-remote-equity-rotation',
    label: 'Tax delinquent remote owner',
    markets: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Buffalo, NY', 'Kansas City, MO'],
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('remote-equity', ['tax_delinquent', 'absentee_owner', 'equity'], [
      filter('is_tax_delinquent', null, true),
      filter('has_out_of_state_owners', null, true),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 15),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'lien-equity',
    label: 'Lien with equity',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('active-lien', ['lien', 'equity'], [
      filter('has_active_lien', null, true),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 15),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'probate-vacant-equity',
    label: 'Probate or inherited vacant property',
    markets: ['Milwaukee, WI', 'Detroit, MI', 'Cleveland, OH', 'Buffalo, NY', 'Kansas City, MO', 'Louisville, KY'],
    reviewOnly: true,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.04,
    variants: [variant('probate-vacant', ['probate', 'vacant', 'equity'], [
      filter('is_pre_probate', null, true),
      filter('is_vacant_home', null, true),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 15),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'portfolio-landlord',
    label: 'Portfolio landlord',
    markets: ['Memphis, TN', 'Kansas City, MO', 'Cleveland, OH', 'Toledo, OH', 'Indianapolis, IN', 'Louisville, KY'],
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.08,
    anchor: 'people',
    variants: [variant('multiple-investments', ['portfolio_owner', 'absentee_owner'], [
      filter('has_investment_property_additional_investment_flag', null, true),
      filter('has_absentee_owners', null, true),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'small-multifamily-portfolio',
    label: 'Small multifamily portfolio',
    markets: ['Kansas City, MO', 'Memphis, TN', 'Indianapolis, IN', 'Louisville, KY', 'Cleveland, OH', 'Toledo, OH'],
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.08,
    anchor: 'people',
    variants: [variant('two-to-twenty-units', ['multifamily', 'portfolio_owner'], [
      options('property_type', ['Multi Family', 'Apartment']),
      filter('num_units', 'range', { min: 2, max: 20 }),
      filter('has_investment_property_additional_investment_flag', null, true),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'builder-infill-teardown',
    label: 'Builder infill and teardown',
    markets: ['Kansas City, MO', 'Detroit, MI', 'Cleveland, OH', 'Indianapolis, IN', 'Memphis, TN'],
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.06,
    variants: [
      variant('infill-land', ['land', 'vacant'], [
        options('property_type', ['Vacant Land', 'Development Site']),
        filter('lot_size_acres', 'greater_than_or_equal', 0.08),
        filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
      ]),
      variant('vacant-teardown', ['teardown', 'vacant'], [
        options('property_type', ['Single Family']),
        filter('is_vacant_home', null, true),
        options('building_condition', ['Poor', 'Unsound']),
        filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
      ]),
    ],
  },
  {
    key: 'land-wholesale',
    label: 'Land and buildable lot',
    markets: ['Kansas City, MO', 'Memphis, TN', 'Cleveland, OH', 'Detroit, MI', 'Indianapolis, IN', 'Louisville, KY'],
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.06,
    variants: [variant('vacant-land', ['land'], [
      options('property_type', ['Vacant Land', 'Development Site']),
      filter('lot_size_acres', 'greater_than_or_equal', 0.08),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'vacant-equity',
    label: 'Vacant property with equity',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('vacant-equity', ['vacant', 'equity'], [
      filter('is_vacant_home', null, true),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 15),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'seller-finance-free-clear',
    label: 'Free-and-clear seller finance',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.08,
    variants: [variant('free-clear', ['free_and_clear'], [
      filter('is_free_and_clear', null, true),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'subject-to-low-equity',
    label: 'Subject-to low-equity review',
    markets: CORE_MARKETS,
    reviewOnly: true,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.06,
    variants: [variant('mortgage-low-equity', ['active_mortgage', 'low_equity'], [
      filter('num_mortgages', 'greater_than_or_equal', 1),
      filter('estimated_equity_percentage', 'less_than_or_equal', 25),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'hybrid-equity-bridge',
    label: 'Hybrid cash and terms',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('mortgage-mid-equity', ['active_mortgage', 'equity'], [
      filter('num_mortgages', 'greater_than_or_equal', 1),
      filter('estimated_equity_percentage', 'range', { min: 25, max: 65 }),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'novation-retail-equity',
    label: 'Novation retail-equity review',
    markets: CORE_MARKETS,
    reviewOnly: true,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.05,
    variants: [variant('stale-retail-equity', ['retail_equity', 'stale_listing', 'equity'], [
      filter('is_mls_active', null, true),
      filter('mls_days_on_market', 'greater_than_or_equal', 45),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 25),
      filter('mls_current_listing_price', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'absentee-equity-creative',
    label: 'Absentee-owner creative options',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('absentee-equity', ['absentee_owner', 'equity'], [
      filter('has_absentee_owners', null, true),
      filter('estimated_equity_percentage', 'greater_than_or_equal', 20),
      filter('estimated_value', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'active-stale-creative',
    label: 'On-market creative finance',
    markets: CORE_MARKETS,
    reviewOnly: false,
    candidateOnly: false,
    enabled: true,
    lowball: false,
    budgetWeight: 0.07,
    variants: [variant('stale-terms', ['stale_listing', 'price_fit'], [
      filter('is_mls_active', null, true),
      filter('mls_days_on_market', 'greater_than_or_equal', 45),
      filter('mls_current_listing_price', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
  {
    key: 'active-stale-lowball',
    label: 'On-market conditional cash review',
    markets: CORE_MARKETS,
    reviewOnly: true,
    candidateOnly: false,
    enabled: false,
    lowball: true,
    budgetWeight: 0.03,
    variants: [variant('distressed-cash-review', ['stale_listing', 'distressed_condition'], [
      filter('is_mls_active', null, true),
      filter('mls_days_on_market', 'greater_than_or_equal', 120),
      options('building_condition', ['Poor', 'Unsound']),
      filter('mls_current_listing_price', 'range', { min: 50_000, max: 1_000_000 }),
    ])],
  },
]

export const DEALMACHINE_STRATEGY_BY_KEY = new Map(
  DEALMACHINE_STRATEGIES.map((strategy) => [strategy.key, strategy])
)

function normalizedLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function dayNumber(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000)
}

function stringHash(value) {
  let hash = 0
  for (const char of String(value || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

export function splitMarket(market) {
  const match = String(market || '').trim().match(/^(.+),\s*([A-Z]{2})$/i)
  if (!match) throw new Error(`Invalid strategy market: ${market}`)
  return { city: match[1].trim(), state: match[2].toUpperCase() }
}

export function selectDailyStrategyMarket(strategy, date = new Date().toISOString().slice(0, 10)) {
  const index = (dayNumber(date) + stringHash(strategy.key)) % strategy.markets.length
  return strategy.markets[index]
}

export function selectDailyStrategyVariant(strategy, date = new Date().toISOString().slice(0, 10)) {
  const index = (dayNumber(date) + stringHash(`${strategy.key}:variant`)) % strategy.variants.length
  return strategy.variants[index]
}

export function compileStrategyFilters(filterSpecs, filterMetadata) {
  const metadataById = new Map(filterMetadata.map((row) => [String(row.filter_id), row]))
  const warnings = []
  const filters = []

  for (const spec of filterSpecs) {
    const metadata = metadataById.get(spec.filterId)
    if (!metadata) {
      if (spec.optional) {
        warnings.push(`Optional DealMachine filter is unavailable: ${spec.filterId}`)
        continue
      }
      throw new Error(`Required DealMachine filter is unavailable: ${spec.filterId}`)
    }

    let value = spec.value
    if (spec.optionLabels) {
      const optionByLabel = new Map(
        (Array.isArray(metadata.options) ? metadata.options : []).map((entry) => [
          normalizedLabel(entry.label),
          entry.option_id,
        ])
      )
      value = spec.optionLabels.map((label) => optionByLabel.get(normalizedLabel(label))).filter((entry) => entry !== undefined)
      if (!value.length) throw new Error(`DealMachine filter ${spec.filterId} has none of the requested options.`)
      const missing = spec.optionLabels.filter((label) => !optionByLabel.has(normalizedLabel(label)))
      if (missing.length) warnings.push(`${spec.filterId} did not expose options: ${missing.join(', ')}`)
    }

    if (spec.operator && Array.isArray(metadata.allowed_operators) && !metadata.allowed_operators.includes(spec.operator)) {
      throw new Error(`DealMachine filter ${spec.filterId} does not allow operator ${spec.operator}.`)
    }
    const compiled = { filter_id: spec.filterId, value }
    if (spec.operator && String(metadata.type || '').toUpperCase() !== 'BOOLEAN') compiled.operator = spec.operator
    filters.push(compiled)
  }

  return { filters, warnings }
}

export function buildDailyStrategyPlans(options = {}) {
  const date = String(options.date || new Date().toISOString().slice(0, 10))
  const requested = Array.isArray(options.strategyKeys) && options.strategyKeys.length
    ? new Set(options.strategyKeys)
    : null
  const includeDisabled = Boolean(options.includeDisabled)
  const includeLowball = Boolean(options.includeLowball)
  return DEALMACHINE_STRATEGIES
    .filter((strategy) => (!requested || requested.has(strategy.key)))
    .filter((strategy) => strategy.enabled || includeDisabled)
    .filter((strategy) => !strategy.lowball || includeLowball)
    .map((strategy) => ({
      ...strategy,
      date,
      market: selectDailyStrategyMarket(strategy, date),
      variant: selectDailyStrategyVariant(strategy, date),
    }))
}

export async function hydrateStrategyPlan(client, plan, filterMetadata) {
  const { city, state } = splitMarket(plan.market)
  const [location, compiled] = await Promise.all([
    client.resolveCity(city, state),
    Promise.resolve(compileStrategyFilters(plan.variant.filters, filterMetadata)),
  ])
  const anchor = plan.anchor || 'properties'
  return {
    ...plan,
    location: { type: 'city', code: String(location.code) },
    locationRecord: location,
    filters: compiled.filters,
    warnings: compiled.warnings,
    searchBody: {
      locations: [{ type: 'city', code: String(location.code) }],
      filters: compiled.filters,
      fields: DEALMACHINE_STRATEGY_FIELDS,
      anchor,
      contact_audience: 'owners',
      exclude_previously_exported: true,
    },
    exportBody: {
      locations: [{ type: 'city', code: String(location.code) }],
      filters: compiled.filters,
      fields: DEALMACHINE_STRATEGY_FIELDS,
      anchor: anchor === 'people' ? 'person' : 'property',
      contact_audience: 'owners',
      exclude_previously_exported: true,
      scrub_dnc: true,
    },
  }
}
