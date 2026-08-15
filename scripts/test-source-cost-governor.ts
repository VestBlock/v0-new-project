import assert from 'node:assert/strict'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const {
  buildSourceGovernorSnapshot,
  evaluateSourceCost,
  isOutscraperApproved,
} = require('../lib/leads/sourceCostGovernor') as typeof import('../lib/leads/sourceCostGovernor')

const now = new Date('2026-06-14T12:00:00.000Z')

assert.equal(
  isOutscraperApproved({
    ALLOW_PAID_SCRAPING: 'false',
    LEADS_ENABLE_OUTSCRAPER: 'true',
    OUTSCRAPER_API_KEY: 'key',
  }),
  false
)

assert.equal(
  isOutscraperApproved({
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_OUTSCRAPER: 'true',
    OUTSCRAPER_API_KEY: 'key',
  }),
  true
)

const blockedOutscraper = evaluateSourceCost('outscraper', {
  now,
  env: {
    LEADS_ENABLE_OUTSCRAPER: 'false',
    OUTSCRAPER_API_KEY: 'key',
  },
})
assert.equal(blockedOutscraper.canRun, false)
assert.equal(blockedOutscraper.status, 'blocked')

const cooldown = evaluateSourceCost('dealmachine', {
  now,
  lastRunAt: '2026-06-14T06:00:00.000Z',
  env: {
    DEALMACHINE_API_KEY: 'dm_sk_live_test_only',
    DEALMACHINE_SOURCE_ENABLED: 'true',
  },
})
assert.equal(cooldown.status, 'cooldown')
assert.equal(cooldown.canRun, false)

const snapshot = buildSourceGovernorSnapshot({
  now,
  env: {},
  scrapeRuns: [{ source_key: 'outscraper_google_maps_businesses', started_at: '2026-06-14T11:00:00.000Z' }],
  dealMachineExports: [],
})

assert.equal(snapshot.status, 'red')
assert.equal(snapshot.lanes.some((lane) => lane.provider === 'dealmachine' && lane.status === 'blocked'), true)
assert.equal(snapshot.paidSourcesBlocked >= 1, true)
assert.equal(snapshot.lanes.some((lane) => lane.provider === 'outscraper' && lane.status === 'blocked'), true)

console.log('source-cost-governor: ok')
