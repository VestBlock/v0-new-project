import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  DEALMACHINE_STRATEGIES,
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  compileStrategyFilters,
  hydrateStrategyPlan,
  mergeDealMachineCatalogMetadata,
  selectDailyStrategyMarket,
} from '../lib/dealmachine/v2-strategy-catalog.mjs'

const expectedKeys = [
  'preforeclosure-equity',
  'tax-code-stack',
  'tax-remote-equity-rotation',
  'lien-equity',
  'probate-vacant-equity',
  'portfolio-landlord',
  'small-multifamily-portfolio',
  'builder-infill-teardown',
  'land-wholesale',
  'vacant-equity',
  'seller-finance-free-clear',
  'subject-to-low-equity',
  'hybrid-equity-bridge',
  'novation-retail-equity',
  'absentee-equity-creative',
  'active-stale-creative',
  'active-stale-lowball',
]

assert.deepEqual(DEALMACHINE_STRATEGIES.map((strategy) => strategy.key), expectedKeys)
assert.equal(new Set(DEALMACHINE_STRATEGY_FIELDS).size, DEALMACHINE_STRATEGY_FIELDS.length)

const defaultPlans = buildDailyStrategyPlans({ date: '2026-08-01' })
assert.equal(defaultPlans.length, 16)
assert.equal(defaultPlans.some((plan) => plan.lowball), false, 'Lowball must be disabled by default')
const allPlans = buildDailyStrategyPlans({ date: '2026-08-01', includeDisabled: true, includeLowball: true })
assert.equal(allPlans.length, 17)
assert.equal(allPlans.filter((plan) => plan.lowball).length, 1)

const lowball = DEALMACHINE_STRATEGIES.find((strategy) => strategy.key === 'active-stale-lowball')
assert.equal(lowball.enabled, false)
assert.ok(lowball.budgetWeight <= 0.05)

const taxCode = DEALMACHINE_STRATEGIES.find((strategy) => strategy.key === 'tax-code-stack')
assert.equal(taxCode.candidateOnly, true)
assert.equal(taxCode.variants[0].signals.includes('code_violation'), false, 'DealMachine cannot prove code violations')

for (const strategy of DEALMACHINE_STRATEGIES) {
  assert.notEqual(
    selectDailyStrategyMarket(strategy, '2026-08-01'),
    selectDailyStrategyMarket(strategy, '2026-08-02'),
    `${strategy.key} should rotate to a new daily market`
  )
  for (const variant of strategy.variants) {
    const metadata = variant.filters.map((spec) => ({
      filter_id: spec.filterId,
      type: spec.optionLabels ? 'MULTI_SELECT' : typeof spec.value === 'boolean' ? 'BOOLEAN' : 'NUMBER',
      options: (spec.optionLabels || []).map((label, index) => ({ option_id: index + 1, label })),
      allowed_operators: spec.operator ? [spec.operator] : [],
    }))
    const compiled = compileStrategyFilters(variant.filters, metadata)
    assert.equal(compiled.filters.length, variant.filters.length)
  }
}

const booleanFilter = (filterId, sourceType) => ({
  filter_id: filterId,
  type: 'BOOLEAN',
  source_type: sourceType,
  options: [],
  allowed_operators: [],
})
const numberFilter = (filterId, sourceType, allowedOperators = ['range']) => ({
  filter_id: filterId,
  type: 'NUMBER',
  source_type: sourceType,
  options: [],
  allowed_operators: allowedOperators,
})
const multiSelectFilter = (filterId, sourceType, labels) => ({
  filter_id: filterId,
  type: 'MULTI_SELECT',
  source_type: sourceType,
  options: labels.map((label, index) => ({ option_id: index + 1, label })),
  allowed_operators: ['contains_any', 'contains_none', 'contains_all'],
})
const routingClient = {
  resolveCity: async () => ({ location_id: 'loc_city_123', type: 'city', code: '123', name: 'Tulsa', state: 'OK' }),
}
const catalogMetadata = mergeDealMachineCatalogMetadata(
  [
    booleanFilter('has_absentee_owners'),
    numberFilter('estimated_value'),
    numberFilter('num_units'),
    multiSelectFilter('property_type', 'properties', ['Multi Family', 'Apartment']),
    booleanFilter('property_only_filter'),
  ],
  [booleanFilter('has_investment_property_additional_investment_flag')]
)

assert.deepEqual(
  catalogMetadata.map((row) => row.source_type),
  ['properties', 'properties', 'properties', 'properties', 'properties', 'people'],
  'Catalog merge must retain endpoint provenance.'
)

const forcedPeoplePlan = {
  key: 'people-filter-regression',
  label: 'People-only routing regression',
  market: 'Tulsa, OK',
  anchor: 'properties',
  variant: {
    key: 'mixed-catalog',
    signals: ['portfolio_owner'],
    filters: [
      { filterId: 'has_investment_property_additional_investment_flag', operator: null, value: true },
      { filterId: 'estimated_value', operator: 'range', value: { min: 50_000, max: 1_000_000 } },
    ],
  },
}
const forcedPeople = await hydrateStrategyPlan(routingClient, forcedPeoplePlan, catalogMetadata)
assert.equal(forcedPeople.searchSourceType, 'people')
assert.deepEqual(forcedPeople.peopleOnlyFilterIds, ['has_investment_property_additional_investment_flag'])
assert.equal(forcedPeople.searchBody.property_match, 'owner')
assert.equal('anchor' in forcedPeople.searchBody, false, 'People search must not receive property-search anchor.')
assert.equal('contact_audience' in forcedPeople.searchBody, false, 'People search must not receive property contact audience.')
assert.equal(
  forcedPeople.searchBody.filters.some((entry) => 'source_type' in entry),
  false,
  'Catalog provenance is routing metadata and must not leak into the provider payload.'
)

const propertyPlan = {
  ...forcedPeoplePlan,
  key: 'property-filter-regression',
  variant: {
    ...forcedPeoplePlan.variant,
    key: 'property-catalog',
    filters: [{ filterId: 'property_only_filter', operator: null, value: true }],
  },
}
const propertyOnly = await hydrateStrategyPlan(routingClient, propertyPlan, catalogMetadata)
assert.equal(propertyOnly.searchSourceType, 'properties')
assert.equal(propertyOnly.searchBody.anchor, 'properties')
assert.equal(propertyOnly.searchBody.contact_audience, 'owners')
assert.equal('property_match' in propertyOnly.searchBody, false)
assert.deepEqual(propertyOnly.searchBody.filters, [{ filter_id: 'property_only_filter', value: true }])

const portfolioPlan = buildDailyStrategyPlans({
  date: '2026-08-01',
  strategyKeys: ['portfolio-landlord'],
})[0]
const portfolio = await hydrateStrategyPlan(routingClient, portfolioPlan, catalogMetadata)
assert.equal(portfolio.searchSourceType, 'properties')
assert.equal(portfolio.searchBody.anchor, 'properties')
assert.equal(portfolio.searchBody.contact_audience, 'owners')
assert.equal('property_match' in portfolio.searchBody, false)
assert.deepEqual(portfolio.peopleOnlyFilterIds, [])
assert.deepEqual(portfolio.propertyFilterIds, ['has_absentee_owners', 'estimated_value'])
assert.equal(portfolio.reviewOnly, true)
assert.equal(portfolio.candidateOnly, true)
assert.deepEqual(portfolio.variant.signals, ['absentee_owner'])

const smallMultifamilyPlan = buildDailyStrategyPlans({
  date: '2026-08-01',
  strategyKeys: ['small-multifamily-portfolio'],
})[0]
const smallMultifamily = await hydrateStrategyPlan(routingClient, smallMultifamilyPlan, catalogMetadata)
assert.equal(smallMultifamily.searchSourceType, 'properties')
assert.equal(smallMultifamily.searchBody.anchor, 'properties')
assert.equal(smallMultifamily.searchBody.contact_audience, 'owners')
assert.equal('property_match' in smallMultifamily.searchBody, false)
assert.deepEqual(smallMultifamily.peopleOnlyFilterIds, [])
assert.deepEqual(smallMultifamily.propertyFilterIds, ['property_type', 'num_units', 'estimated_value'])
assert.deepEqual(smallMultifamily.variant.signals, ['multifamily'])
assert.equal(smallMultifamily.reviewOnly, true)
assert.equal(smallMultifamily.candidateOnly, true)

const activeFilterSpecs = allPlans.flatMap((plan) => plan.variant.filters)
const knownPeopleOnlyFilterIds = new Set(['has_investment_property_additional_investment_flag'])
const activeFilterMetadata = Array.from(
  activeFilterSpecs.reduce((byId, spec) => {
    const current = byId.get(spec.filterId) || {
      filterId: spec.filterId,
      optionLabels: new Set(),
      operators: new Set(),
      isBoolean: typeof spec.value === 'boolean',
    }
    for (const label of spec.optionLabels || []) current.optionLabels.add(label)
    if (spec.operator) current.operators.add(spec.operator)
    byId.set(spec.filterId, current)
    return byId
  }, new Map()).values()
).map((entry) => ({
  filter_id: entry.filterId,
  type: entry.optionLabels.size ? 'MULTI_SELECT' : entry.isBoolean ? 'BOOLEAN' : 'NUMBER',
  options: Array.from(entry.optionLabels).map((label, index) => ({ option_id: index + 1, label })),
  allowed_operators: Array.from(entry.operators),
}))
const activeCatalogMetadata = mergeDealMachineCatalogMetadata(
  activeFilterMetadata.filter((entry) => !knownPeopleOnlyFilterIds.has(entry.filter_id)),
  activeFilterMetadata.filter((entry) => knownPeopleOnlyFilterIds.has(entry.filter_id))
)
for (const plan of allPlans) {
  const hydrated = await hydrateStrategyPlan(routingClient, plan, activeCatalogMetadata)
  assert.equal(
    hydrated.peopleOnlyFilterIds.length > 0 && hydrated.propertyFilterIds.length > 0,
    false,
    `${plan.key} must not mix people-only and property-only filters in one provider request`
  )
}

const activeSources = [
  fs.readFileSync(new URL('../lib/dealmachine/v2-client.mjs', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../lib/dealmachine/v2-strategy-catalog.mjs', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../lib/dealmachine/api.ts', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('./dealmachine-v2-strategy-run.mjs', import.meta.url), 'utf8'),
].join('\n')
assert.equal(activeSources.includes('api.dealmachine.com/public'), false)
assert.equal(activeSources.includes('next.v3.dealmachine.com'), false)
assert.match(activeSources, /api\.v2\.dealmachine\.com/)
assert.match(activeSources, /estimateRecordSearch\(hydrated\.searchSourceType/)
assert.match(activeSources, /searchRecords\(hydrated\.searchSourceType/)
assert.doesNotMatch(activeSources, /estimatePropertySearch\(\{\s*\.\.\.hydrated\.searchBody/)
assert.doesNotMatch(activeSources, /searchProperties\(\{\s*\.\.\.hydrated\.searchBody/)

const productionSource = fs.readFileSync(new URL('../lib/dealmachine/api.ts', import.meta.url), 'utf8')
assert.match(
  productionSource,
  /envInt\('DEALMACHINE_SYNC_MAX_CREDITS', 75\)/,
  'The production source-acquisition fail-closed 75-credit default must remain intact.'
)
const autonomousAcquisitionSource = fs.readFileSync(
  new URL('../lib/n8n/dealMachineSourceAcquisition.ts', import.meta.url),
  'utf8'
)
assert.match(
  autonomousAcquisitionSource,
  /includeLowball:\s*false/,
  'Autonomous DealMachine acquisition must not spend credits on the disabled lowball lane.'
)
assert.match(autonomousAcquisitionSource, /maxLowballShare:\s*0/)

console.log('DealMachine v2 strategy tests passed.')
