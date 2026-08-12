import assert from 'node:assert/strict'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const { buildDealMemorySnapshot } = require('../lib/admin/dealMemory') as typeof import('../lib/admin/dealMemory')

const snapshot = buildDealMemorySnapshot([
  {
    id: 'db-1',
    property_address: '965 North Ave, Macon, GA',
    city: 'Macon',
    state: 'GA',
    estimate_value: 89000,
    arv: 95000,
    repair_budget: 25000,
    assignment_fee: 10000,
    mao: 31500,
    seller_ask: 60000,
    spread: -28500,
    end_buyer_profit: 0,
    grade: 'RISKY',
    deal_strength_score: 38,
    deal_strength_label: 'Weak',
    primary_route_label: 'Novation path',
    next_action: 'Ask for better photos and terms flexibility.',
    created_at: '2026-06-14T12:00:00.000Z',
  },
])

assert.equal(snapshot.totalAnalyses >= 1, true)
assert.equal(snapshot.riskyCount >= 1, true)
assert.equal(snapshot.goodCount, 0)
assert.equal(snapshot.recentAnalyses[0]?.propertyAddress, '965 North Ave, Macon, GA')
assert.equal(snapshot.recentAnalyses[0]?.grade, 'RISKY')

console.log('deal-memory: ok')
