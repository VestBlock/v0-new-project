import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  DEALMACHINE_STRATEGIES,
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  compileStrategyFilters,
  hydrateStrategyPlan,
  selectDailyStrategyMarket,
} from '../lib/dealmachine/v2-strategy-catalog.mjs'
import { validatePropertyOnlySearchBody } from '../lib/dealmachine/v2-policy.mjs'

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
assert.equal(
  DEALMACHINE_STRATEGY_FIELDS.some((field) => /(?:contact|email|phone|people|person|owner.*name|lender.*name)/i.test(field)),
  false,
  'Phase-one fields must not request people, contact, or name data'
)

const defaultPlans = buildDailyStrategyPlans({ date: '2026-08-01' })
assert.equal(defaultPlans.length, 16)
assert.equal(defaultPlans.some((plan) => plan.lowball), false, 'Lowball must be disabled by default')
const allPlans = buildDailyStrategyPlans({ date: '2026-08-01', includeDisabled: true, includeLowball: true })
assert.equal(allPlans.length, 16)
assert.equal(allPlans.filter((plan) => plan.lowball).length, 0)
assert.deepEqual(
  buildDailyStrategyPlans({
    date: '2026-08-01',
    strategyKeys: ['active-stale-lowball'],
    includeDisabled: true,
    includeLowball: true,
  }),
  [],
  'Lowball cannot be re-enabled through plan-building options'
)

const lowball = DEALMACHINE_STRATEGIES.find((strategy) => strategy.key === 'active-stale-lowball')
assert.equal(lowball.enabled, false)
assert.ok(lowball.budgetWeight <= 0.05)

const taxCode = DEALMACHINE_STRATEGIES.find((strategy) => strategy.key === 'tax-code-stack')
assert.equal(taxCode.candidateOnly, true)
assert.equal(taxCode.variants[0].signals.includes('code_violation'), false, 'DealMachine cannot prove code violations')

for (const strategy of DEALMACHINE_STRATEGIES) {
  assert.notEqual(strategy.anchor, 'people', `${strategy.key} must be property-anchored`)
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

assert.throws(
  () => compileStrategyFilters(
    [{ filterId: 'person_income', operator: 'greater_than', value: 100_000 }],
    [{ filter_id: 'person_income', type: 'NUMBER', allowed_operators: ['greater_than'] }]
  ),
  /not approved for property-only discovery/
)

const activeSources = [
  fs.readFileSync(new URL('../lib/dealmachine/v2-client.mjs', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../lib/dealmachine/v2-strategy-catalog.mjs', import.meta.url), 'utf8'),
].join('\n')
assert.equal(activeSources.includes('api.dealmachine.com/public'), false)
assert.equal(activeSources.includes('next.v3.dealmachine.com'), false)
assert.match(activeSources, /api\.v2\.dealmachine\.com/)
assert.equal(activeSources.includes('/properties/export'), false)
assert.equal(activeSources.includes('/exports'), false)
assert.equal(activeSources.includes('exclude_previously_exported'), false)

const samplePlan = buildDailyStrategyPlans({
  date: '2026-08-01',
  strategyKeys: ['tax-code-stack'],
})[0]
const sampleMetadata = samplePlan.variant.filters.map((spec) => ({
  filter_id: spec.filterId,
  type: typeof spec.value === 'boolean' ? 'BOOLEAN' : 'NUMBER',
  allowed_operators: spec.operator ? [spec.operator] : [],
}))
const hydrated = await hydrateStrategyPlan(
  { resolveCity: async () => ({ code: 'loc_test' }) },
  samplePlan,
  sampleMetadata
)
assert.equal('exportBody' in hydrated, false)
assert.equal('exclude_previously_exported' in hydrated.searchBody, false)
assert.equal(hydrated.searchBody.anchor, 'properties')
assert.equal(hydrated.searchBody.contact_audience, 'none')
assert.deepEqual(validatePropertyOnlySearchBody(hydrated.searchBody, { requireFields: true }), {
  ok: true,
  violations: [],
})

console.log('DealMachine v2 strategy tests passed.')
