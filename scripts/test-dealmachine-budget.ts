import assert from 'node:assert/strict'

import {
  addDealMachineCreditBreakdowns,
  advanceDealMachineCursor,
  dealMachineContactRevealLimit,
  decideDealMachineSearchBudget,
  emptyDealMachineCreditBreakdown,
  readDealMachineCreditBreakdown,
} from '../lib/dealmachine/budget'

assert.deepEqual(readDealMachineCreditBreakdown({
  credits: { used: 7, properties: 5, people: 2, deduplicated: 3 },
}), { used: 7, properties: 5, people: 2, deduplicated: 3 })

assert.deepEqual(
  readDealMachineCreditBreakdown({}, 11),
  { used: 11, properties: 0, people: 0, deduplicated: 0 },
  'Missing legacy credit ledgers must fail closed to the estimate.'
)
assert.deepEqual(
  readDealMachineCreditBreakdown({ credits: { properties: 4 } }, 9),
  { used: 9, properties: 4, people: 0, deduplicated: 0 },
  'A partial provider ledger must not erase the fail-closed estimated reservation.'
)

assert.deepEqual(
  addDealMachineCreditBreakdowns(
    { used: 5, properties: 5, people: 0, deduplicated: 1 },
    { used: 2, properties: 3, people: 2, deduplicated: 3 }
  ),
  { used: 7, properties: 8, people: 2, deduplicated: 4 }
)
assert.deepEqual(emptyDealMachineCreditBreakdown(), { used: 0, properties: 0, people: 0, deduplicated: 0 })

assert.equal(dealMachineContactRevealLimit({
  requestedRows: 10,
  configuredRows: 3,
  candidateOnly: false,
  sourceType: 'properties',
}), 3)
assert.equal(dealMachineContactRevealLimit({
  requestedRows: 10,
  configuredRows: 3,
  candidateOnly: true,
  sourceType: 'properties',
}), 0)
assert.equal(dealMachineContactRevealLimit({
  requestedRows: 10,
  configuredRows: 3,
  candidateOnly: false,
  sourceType: 'people',
}), 0)

assert.equal(decideDealMachineSearchBudget({
  estimatedCost: 60,
  creditsReserved: 0,
  maxCredits: 100,
  creditBalance: 250,
}), 'search')

assert.equal(decideDealMachineSearchBudget({
  estimatedCost: 60,
  creditsReserved: 60,
  maxCredits: 100,
  creditBalance: 250,
}), 'defer_run_cap')

assert.equal(decideDealMachineSearchBudget({
  estimatedCost: 120,
  creditsReserved: 0,
  maxCredits: 100,
  creditBalance: 250,
}), 'block_run_cap')

assert.equal(decideDealMachineSearchBudget({
  estimatedCost: 60,
  creditsReserved: 0,
  maxCredits: 100,
  creditBalance: 40,
}), 'block_balance')

assert.deepEqual(advanceDealMachineCursor({
  startAfter: 4,
  advancedPlanCount: 1,
  planCount: 17,
}), { nextAfter: 5, wrapped: false })

assert.deepEqual(advanceDealMachineCursor({
  startAfter: 16,
  advancedPlanCount: 1,
  planCount: 17,
}), { nextAfter: 0, wrapped: true })

assert.deepEqual(advanceDealMachineCursor({
  startAfter: 4,
  advancedPlanCount: 0,
  planCount: 17,
}), { nextAfter: 4, wrapped: false })

console.log('DealMachine budget and cursor tests passed.')
