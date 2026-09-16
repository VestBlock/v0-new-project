import assert from 'node:assert/strict'

import {
  advanceDealMachineCursor,
  decideDealMachineSearchBudget,
} from '../lib/dealmachine/budget'

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
