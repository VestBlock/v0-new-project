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
  isApifyApproved,
  isGooglePlacesApproved,
  isOutscraperApproved,
} = require('../lib/leads/sourceCostGovernor') as typeof import('../lib/leads/sourceCostGovernor')

const now = new Date('2026-06-14T12:00:00.000Z')

assert.equal(
  isGooglePlacesApproved({
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_GOOGLE_PLACES: 'true',
    GOOGLE_PLACES_API_KEY: 'key',
  }),
  true
)

assert.equal(
  isGooglePlacesApproved({
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_GOOGLE_PLACES: 'false',
    GOOGLE_PLACES_API_KEY: 'key',
  }),
  false
)

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

assert.equal(
  isApifyApproved({
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_APIFY_YELP: 'true',
    APIFY_TOKEN: 'token',
  }),
  true
)

assert.equal(
  isApifyApproved({
    ALLOW_PAID_SCRAPING: 'false',
    LEADS_ENABLE_APIFY_YELP: 'true',
    APIFY_TOKEN: 'token',
  }),
  false
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

const cappedGooglePlaces = evaluateSourceCost('google_places', {
  now,
  env: {
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_GOOGLE_PLACES: 'true',
    GOOGLE_PLACES_API_KEY: 'key',
    SOURCE_LIMIT_GOOGLE_PLACES_DAILY: '999',
  },
})
assert.equal(cappedGooglePlaces.canRun, true)
assert.equal(cappedGooglePlaces.dailyLimit, 24)

const cappedApify = evaluateSourceCost('apify', {
  now,
  env: {
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_APIFY_YELP: 'true',
    APIFY_TOKEN: 'token',
    SOURCE_LIMIT_APIFY_DAILY: '999',
  },
})
assert.equal(cappedApify.canRun, true)
assert.equal(cappedApify.dailyLimit, 24)

const disabledApifyBudget = evaluateSourceCost('apify', {
  now,
  env: {
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_APIFY_YELP: 'true',
    APIFY_TOKEN: 'token',
    SOURCE_LIMIT_APIFY_DAILY: 'invalid',
  },
})
assert.equal(disabledApifyBudget.canRun, false)
assert.equal(disabledApifyBudget.status, 'blocked')
assert.equal(disabledApifyBudget.dailyLimit, 0)

const cooldown = evaluateSourceCost('dealmachine', {
  now,
  lastRunAt: '2026-06-14T06:00:00.000Z',
  env: {},
})
assert.equal(cooldown.status, 'cooldown')
assert.equal(cooldown.canRun, false)

const snapshot = buildSourceGovernorSnapshot({
  now,
  env: {},
  scrapeRuns: [{ source_key: 'outscraper_google_maps_businesses', started_at: '2026-06-14T11:00:00.000Z' }],
  dealMachineExports: [],
})

assert.equal(snapshot.status, 'yellow')
assert.equal(snapshot.paidSourcesBlocked >= 1, true)
assert.equal(snapshot.lanes.some((lane) => lane.provider === 'outscraper' && lane.status === 'blocked'), true)
assert.equal(snapshot.lanes.some((lane) => lane.provider === 'apify' && lane.status === 'blocked'), true)

console.log('source-cost-governor: ok')
