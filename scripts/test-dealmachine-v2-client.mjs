import assert from 'node:assert/strict'

import {
  DEALMACHINE_V2_BASE_URL,
  DealMachineApiError,
  DealMachinePolicyError,
  assertPropertyOnlyResponsePayload,
  createDealMachineV2Client,
  createDealMachineV2PaidSearchClient,
  dealMachineApiKey,
  getDealMachineConnectionHealth,
  hasDealMachineCredentials,
  isDealMachineCredentialFormat,
  isDealMachineDiscoveryEnabled,
  isDealMachinePaidSearchEnabled,
  isDealMachineSourceEnabled,
  validatePropertyOnlySearchBody,
} from '../lib/dealmachine/v2-client.mjs'

const DISCOVERY_ENV = {
  DEALMACHINE_DISCOVERY_ENABLED: 'true',
}
const PAID_SEARCH_ENV = {
  ...DISCOVERY_ENV,
  DEALMACHINE_PAID_SEARCH_ENABLED: 'true',
}
const SAFE_SEARCH_BODY = {
  locations: [{ type: 'city', code: 'loc_test' }],
  filters: [{ filter_id: 'estimated_value', operator: 'range', value: { min: 50_000, max: 500_000 } }],
  fields: ['estimated_value', 'property_type'],
  anchor: 'properties',
  contact_audience: 'none',
}

assert.equal(isDealMachineCredentialFormat('dm_sk_live_'), false)
assert.equal(isDealMachineCredentialFormat('dm_sk_live_test_only'), true)
assert.equal(isDealMachineCredentialFormat('dm_at_live_test_only'), true)
assert.equal(hasDealMachineCredentials({ DEALMACHINE_API_KEY: 'legacy-token' }), false)
assert.equal(dealMachineApiKey({ DEALMACHINE_API_TOKEN: 'dm_sk_live_legacy_alias' }), '')
assert.equal(hasDealMachineCredentials({ DEALMACHINE_API_TOKEN: 'dm_sk_live_legacy_alias' }), false)

assert.equal(isDealMachineSourceEnabled({}), false)
assert.equal(isDealMachineSourceEnabled({ DEALMACHINE_SYNC_ENABLED: 'true' }), false)
assert.equal(isDealMachineSourceEnabled({ DEALMACHINE_SOURCE_ENABLED: 'true' }), true)
assert.equal(isDealMachineDiscoveryEnabled({ DEALMACHINE_DISCOVERY_ENABLED: 'true' }), true)
assert.equal(isDealMachineDiscoveryEnabled({ DEALMACHINE_SOURCE_ENABLED: 'true' }), false)
assert.equal(isDealMachineDiscoveryEnabled(DISCOVERY_ENV), true)
assert.equal(isDealMachinePaidSearchEnabled(DISCOVERY_ENV), false)
assert.equal(isDealMachinePaidSearchEnabled(PAID_SEARCH_ENV), true)

assert.deepEqual(validatePropertyOnlySearchBody(SAFE_SEARCH_BODY), { ok: true, violations: [] })
assert.equal(validatePropertyOnlySearchBody({ ...SAFE_SEARCH_BODY, fields: [] }, { requireFields: true }).ok, false)
assert.equal(validatePropertyOnlySearchBody({ ...SAFE_SEARCH_BODY, anchor: 'people' }).ok, false)
assert.equal(validatePropertyOnlySearchBody({ ...SAFE_SEARCH_BODY, contact_audience: 'owners' }).ok, false)
assert.equal(validatePropertyOnlySearchBody({ ...SAFE_SEARCH_BODY, fields: ['owner_1_full_name'] }).ok, false)
assert.equal(validatePropertyOnlySearchBody({ ...SAFE_SEARCH_BODY, contacts: [] }).ok, false)

assert.equal(assertPropertyOnlyResponsePayload({ data: [{ id: 'property_1', estimated_value: 150_000 }] }).data.length, 1)
assert.equal(assertPropertyOnlyResponsePayload({ credits: { people: 0, properties: 1 } }).credits.people, 0)
assert.throws(
  () => assertPropertyOnlyResponsePayload({ data: [{ contacts: [{ email: 'blocked@example.com' }] }] }),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unsafe_property_response_payload'
)
assert.throws(
  () => assertPropertyOnlyResponsePayload({ data: [{ owner_1_full_name: 'Blocked', credit_score: 700 }] }),
  DealMachinePolicyError
)
assert.throws(
  () => assertPropertyOnlyResponsePayload({ data: [{ ownerFullName: 'Blocked', politicalAffiliation: 'Blocked' }] }),
  DealMachinePolicyError
)

const calls = []
let accountAttempts = 0
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  if (String(url).endsWith('/account')) {
    accountAttempts += 1
    if (accountAttempts === 1) {
      return new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down' } }), {
        status: 429,
        headers: { 'retry-after': '0', 'content-type': 'application/json' },
      })
    }
  }
  if (String(url).includes('/locations')) {
    return new Response(JSON.stringify({
      data: [{ location_id: 'loc_city_123', type: 'city', code: '123', name: 'Tulsa', state: 'OK' }],
      pagination: { total_pages: 1, has_next_page: false },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (String(url).endsWith('/properties/search/count')) {
    return new Response(JSON.stringify({
      total_properties: 12,
      total_people: 0,
      total_results: 12,
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req_count_123' } })
  }
  if (String(url).endsWith('/properties/search')) {
    return new Response(JSON.stringify({
      totals: { properties: 12, people: 0 },
      pagination: {
        page: 1,
        per_page: 25,
        total_results: 12,
        total_pages: 1,
        has_next_page: false,
        has_previous_page: false,
      },
      estimated_credits: {
        this_page: 12,
        total_all_pages: 12,
        breakdown: { properties: 12, people: 0, already_accessed: 0 },
      },
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req_estimate_123' } })
  }
  return new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_free_123',
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '59',
      'x-ratelimit-day-limit': '5000',
      'x-ratelimit-day-remaining': '4999',
    },
  })
}

const client = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  fetchImpl,
  maxRetries: 1,
  minRequestIntervalMs: 0,
})

await client.account()
assert.equal(calls.length, 2, 'safe read-only responses should retry a 429 once')
assert.equal(calls[0].url, `${DEALMACHINE_V2_BASE_URL}/account`)
assert.equal(calls[0].options.headers.authorization, 'Bearer dm_sk_live_test_only')
assert.equal(client.getLastResponseMetadata().requestId, 'req_free_123')
assert.deepEqual(client.getRateLimit(), {
  limit: 60,
  remaining: 59,
  reset: null,
  dayLimit: 5000,
  dayRemaining: 4999,
  retryAfterSeconds: null,
})

let metadataIsolationAttempt = 0
const metadataIsolationClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  maxRetries: 0,
  minRequestIntervalMs: 0,
  fetchImpl: async () => {
    metadataIsolationAttempt += 1
    if (metadataIsolationAttempt === 1) {
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_prior_success',
          'x-ratelimit-remaining': '58',
        },
      })
    }
    throw new TypeError('simulated network failure before response')
  },
})
await metadataIsolationClient.account()
assert.equal(metadataIsolationClient.getLastResponseMetadata().requestId, 'req_prior_success')
await assert.rejects(
  metadataIsolationClient.account(),
  (error) => error instanceof DealMachineApiError && error.code === 'network_error'
)
assert.equal(
  metadataIsolationClient.getLastResponseMetadata(),
  null,
  'a pre-response failure must not inherit a prior provider request ID'
)
assert.equal(
  metadataIsolationClient.getRateLimit(),
  null,
  'a pre-response failure must not inherit prior rate-limit evidence'
)

const location = await client.resolveCity('Tulsa', 'OK')
assert.equal(location.code, '123')
assert.match(calls.at(-1).url, /\/locations\?q=Tulsa&type=city&state=OK/)

const beforeBlockedSchema = calls.length
assert.throws(() => client.listFields('people'), DealMachinePolicyError)
assert.equal(calls.length, beforeBlockedSchema, 'people schema requests must fail before fetch')

await client.countProperties(SAFE_SEARCH_BODY)
assert.match(calls.at(-1).url, /\/properties\/search\/count$/)
assert.deepEqual(JSON.parse(calls.at(-1).options.body), SAFE_SEARCH_BODY)

await client.estimatePropertySearch(SAFE_SEARCH_BODY)
assert.match(calls.at(-1).url, /\/properties\/search$/)
assert.equal(JSON.parse(calls.at(-1).options.body).estimate_cost, true)

const beforeEmptyFields = calls.length
await assert.rejects(
  client.estimatePropertySearch({ ...SAFE_SEARCH_BODY, fields: [] }),
  DealMachinePolicyError
)
assert.equal(calls.length, beforeEmptyFields, 'empty field projections must fail before fetch')
assert.equal(client.getLastResponseMetadata(), null, 'pre-call discovery policy failures must clear prior metadata')
assert.equal(client.getRateLimit(), null, 'pre-call discovery policy failures must clear prior rate-limit evidence')

const beforeUnsafeRequest = calls.length
await assert.rejects(
  client.countProperties({ ...SAFE_SEARCH_BODY, contact_audience: 'owners' }),
  DealMachinePolicyError
)
assert.equal(calls.length, beforeUnsafeRequest, 'unsafe contact requests must fail before fetch')
assert.equal('request' in client, false)
assert.equal('searchProperties' in client, false)
assert.equal('createList' in client, false)
assert.equal('listLists' in client, false)

const badCountClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify({
    total_properties: 5,
    total_people: 1,
    total_results: 5,
  }), { status: 200, headers: { 'content-type': 'application/json' } }),
})
await assert.rejects(
  badCountClient.countProperties(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unexpected_property_count_response'
)

const badEstimateClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify({ estimated_credits: {} }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
})
await assert.rejects(
  badEstimateClient.estimatePropertySearch(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unexpected_property_estimate_response'
)

let unsafeEstimateCalls = 0
const unsafeEstimateClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => {
    unsafeEstimateCalls += 1
    return new Response(JSON.stringify({
      estimated_credits: {
        this_page: 1,
        breakdown: { properties: 1, people: 0, already_accessed: 0 },
      },
      contacts: [{ email: 'blocked@example.com' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  },
})
await assert.rejects(
  unsafeEstimateClient.estimatePropertySearch(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unsafe_property_response_payload'
)
assert.equal(unsafeEstimateCalls, 1, 'unsafe estimate responses must be rejected before cost authority')

const unknownEstimateFieldClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify({
    totals: { properties: 1, people: 0 },
    pagination: {
      page: 1,
      per_page: 25,
      total_results: 1,
      total_pages: 1,
      has_next_page: false,
      has_previous_page: false,
    },
    estimated_credits: {
      this_page: 1,
      total_all_pages: 1,
      breakdown: { properties: 1, people: 0, already_accessed: 0 },
    },
    veteran_status: 'blocked',
  }), { status: 200, headers: { 'content-type': 'application/json' } }),
})
await assert.rejects(
  unknownEstimateFieldClient.estimatePropertySearch(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError &&
    error.code === 'unexpected_property_estimate_response' &&
    error.violations.includes('payload.veteran_status')
)

let disabledCalls = 0
const disabledClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  env: {},
  fetchImpl: async () => {
    disabledCalls += 1
    return new Response('{}')
  },
})
await assert.rejects(disabledClient.account(), DealMachinePolicyError)
assert.equal(disabledCalls, 0, 'default-off discovery must make zero requests')

let paidCalls = 0
const paidClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: PAID_SEARCH_ENV,
  maxRetries: 6,
  minRequestIntervalMs: 0,
  fetchImpl: async () => {
    paidCalls += 1
    return new Response(JSON.stringify({
      error: { code: 'rate_limited', message: 'Do not replay', request_id: 'req_paid_429' },
    }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30' } })
  },
})
await assert.rejects(
  paidClient.searchProperties(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachineApiError && error.requestId === 'req_paid_429'
)
assert.equal(paidCalls, 1, 'billable POST must never retry automatically')

let successfulPaidCalls = 0
const successfulPaidClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: PAID_SEARCH_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => {
    successfulPaidCalls += 1
    return new Response(JSON.stringify({
      data: [{ dm_property_id: 'property_1', estimated_value: 150_000 }],
      credits: { used: 1, people: 0, properties: 1, deduplicated: 0 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req_paid_success' },
    })
  },
})
assert.equal((await successfulPaidClient.searchProperties(SAFE_SEARCH_BODY)).data.length, 1)
assert.equal(successfulPaidClient.getLastResponseMetadata().requestId, 'req_paid_success')
await assert.rejects(
  successfulPaidClient.searchProperties({ ...SAFE_SEARCH_BODY, fields: [] }),
  DealMachinePolicyError
)
assert.equal(successfulPaidCalls, 1, 'pre-call paid policy failures must not fetch')
assert.equal(successfulPaidClient.getLastResponseMetadata(), null, 'pre-call paid failures must clear prior metadata')
assert.equal(successfulPaidClient.getRateLimit(), null, 'pre-call paid failures must clear prior rate-limit evidence')

const malformedPaidClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: PAID_SEARCH_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_paid_malformed' },
  }),
})
await assert.rejects(
  malformedPaidClient.searchProperties(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unexpected_property_response_schema'
)

let paidDisabledCalls = 0
const paidDisabledClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: DISCOVERY_ENV,
  fetchImpl: async () => {
    paidDisabledCalls += 1
    return new Response('{}')
  },
})
await assert.rejects(paidDisabledClient.searchProperties(SAFE_SEARCH_BODY), DealMachinePolicyError)
assert.equal(paidDisabledCalls, 0, 'default-off paid search must make zero requests')

let unsafePaidResponseCalls = 0
const unsafePaidResponseClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: PAID_SEARCH_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => {
    unsafePaidResponseCalls += 1
    return new Response(JSON.stringify({ data: [{ id: 'property_1', people: [{ email: 'blocked@example.com' }] }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  },
})
await assert.rejects(
  unsafePaidResponseClient.searchProperties(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError && error.code === 'unsafe_property_response_payload'
)
assert.equal(unsafePaidResponseCalls, 1, 'unsafe paid responses must be rejected before a consumer can persist them')

const unknownSensitiveFieldClient = createDealMachineV2PaidSearchClient({
  apiKey: 'dm_sk_live_test_only',
  env: PAID_SEARCH_ENV,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify({
    data: [{ dm_property_id: 'property_1', estimated_value: 150_000, veteran_status: 'blocked' }],
    credits: { used: 1, people: 0, properties: 1, deduplicated: 0 },
  }), { status: 200, headers: { 'content-type': 'application/json' } }),
})
await assert.rejects(
  unknownSensitiveFieldClient.searchProperties(SAFE_SEARCH_BODY),
  (error) => error instanceof DealMachinePolicyError &&
    error.code === 'unexpected_paid_property_response' &&
    error.violations.includes('data[0].veteran_status')
)

const missing = await getDealMachineConnectionHealth({ env: {}, verify: true })
assert.equal(missing.state, 'not_configured')
assert.equal(missing.configured, false)

const unverified = await getDealMachineConnectionHealth({
  env: { DEALMACHINE_API_KEY: 'dm_sk_live_test_only' },
})
assert.equal(unverified.state, 'configured_unverified')
assert.equal(unverified.enabled, false)

let gatedHealthCalls = 0
const gatedHealth = await getDealMachineConnectionHealth({
  env: { DEALMACHINE_API_KEY: 'dm_sk_live_test_only' },
  verify: true,
  fetchImpl: async () => {
    gatedHealthCalls += 1
    return new Response('{}')
  },
})
assert.equal(gatedHealth.state, 'configured_unverified')
assert.equal(gatedHealthCalls, 0, 'health verification must honor the discovery flag')

async function healthForStatus(status, options = {}) {
  return getDealMachineConnectionHealth({
    apiKey: 'dm_sk_live_test_only',
    env: options.env || DISCOVERY_ENV,
    verify: true,
    fetchImpl: async () => new Response(
      JSON.stringify(status === 200 ? { data: { organization: 'test' }, request_id: 'req_health' } : {
        error: { code: status === 429 ? 'rate_limit_exceeded' : 'test_error', message: 'test failure' },
      }),
      {
        status,
        headers: {
          'content-type': 'application/json',
          'retry-after': status === 429 ? '12' : '',
        },
      }
    ),
  })
}

assert.equal((await healthForStatus(200)).state, 'working')
assert.equal((await healthForStatus(200)).requestId, 'req_health')
assert.equal((await healthForStatus(401)).state, 'unauthorized')
assert.equal((await healthForStatus(429)).state, 'rate_limited')
assert.equal((await healthForStatus(503)).state, 'provider_unavailable')
assert.equal((await healthForStatus(200, { env: {} })).state, 'configured_unverified')

console.log('DealMachine v2 client tests passed.')
