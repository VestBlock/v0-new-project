import assert from 'node:assert/strict'

import {
  DEALMACHINE_V2_BASE_URL,
  createDealMachineV2Client,
  formatDealMachineErrorDetail,
  formatDealMachineThrownError,
  hasDealMachineCredentials,
  isDealMachineCredentialFormat,
} from '../lib/dealmachine/v2-client.mjs'

assert.equal(isDealMachineCredentialFormat('dm_sk_live_'), false)
assert.equal(isDealMachineCredentialFormat('dm_sk_live_test_only'), true)
assert.equal(isDealMachineCredentialFormat('dm_at_live_test_only'), true)
assert.equal(hasDealMachineCredentials({ DEALMACHINE_API_KEY: 'legacy-token' }), false)

const calls = []
let attempts = 0
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  attempts += 1
  if (String(url).includes('/account') && attempts === 1) {
    return new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down' } }), {
      status: 429,
      headers: { 'retry-after': '0', 'content-type': 'application/json' },
    })
  }
  if (String(url).includes('/locations')) {
    return new Response(JSON.stringify({
      data: [{ location_id: 'loc_city_123', type: 'city', code: '123', name: 'Tulsa', state: 'OK' }],
      pagination: { total_pages: 1, has_next_page: false },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '59',
    },
  })
}

const client = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  fetchImpl,
  maxRetries: 1,
  minRequestIntervalMs: 0,
})

await client.account()
assert.equal(calls.length, 2, '429 responses should be retried once')
assert.equal(calls[0].url, `${DEALMACHINE_V2_BASE_URL}/account`)
assert.equal(calls[0].options.headers.authorization, 'Bearer dm_sk_live_test_only')
assert.deepEqual(client.getRateLimit(), { limit: 60, remaining: 59, reset: null })

const location = await client.resolveCity('Tulsa', 'OK')
assert.equal(location.code, '123')
assert.match(calls.at(-1).url, /\/locations\?q=Tulsa&type=city&state=OK/)

await client.countRecords('people', {
  locations: [{ type: 'city', code: '123' }],
  filters: [{ filter_id: 'people_only_filter', value: true }],
})
assert.equal(calls.at(-1).url, `${DEALMACHINE_V2_BASE_URL}/people/search/count`)

await client.estimateRecordSearch('people', {
  locations: [{ type: 'city', code: '123' }],
  filters: [{ filter_id: 'people_only_filter', value: true }],
})
assert.equal(calls.at(-1).url, `${DEALMACHINE_V2_BASE_URL}/people/search`)
assert.equal(JSON.parse(calls.at(-1).options.body).estimate_cost, true)

await client.searchRecords('properties', {
  locations: [{ type: 'city', code: '123' }],
  filters: [{ filter_id: 'property_filter', value: true }],
})
assert.equal(calls.at(-1).url, `${DEALMACHINE_V2_BASE_URL}/properties/search`)

assert.throws(
  () => client.searchRecords('contacts', {}),
  /Unsupported DealMachine search source type: contacts/
)

const objectError = {
  error: {
    code: 'invalid_filter',
    message: 'Filter is not valid for this catalog.',
    details: { filter_id: 'people_only_filter', allowed_source: 'people' },
  },
}
const objectErrorText = formatDealMachineErrorDetail(objectError)
assert.match(objectErrorText, /code=invalid_filter/)
assert.match(objectErrorText, /people_only_filter/)
assert.match(objectErrorText, /allowed_source/)
assert.doesNotMatch(objectErrorText, /\[object Object\]/)
assert.ok(objectErrorText.length <= 500)

const thrownObjectText = formatDealMachineThrownError(objectError)
assert.match(thrownObjectText, /code=invalid_filter/)
assert.doesNotMatch(thrownObjectText, /\[object Object\]/)
assert.ok(thrownObjectText.length <= 500)

const failingClient = createDealMachineV2Client({
  apiKey: 'dm_sk_live_test_only',
  maxRetries: 0,
  minRequestIntervalMs: 0,
  fetchImpl: async () => new Response(JSON.stringify(objectError), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  }),
})
await assert.rejects(
  failingClient.searchRecords('people', {
    filters: [{ filter_id: 'people_only_filter', value: true }],
  }),
  (error) => {
    assert.match(error.message, /DealMachine v2 HTTP 400/)
    assert.match(error.message, /code=invalid_filter/)
    assert.match(error.message, /people_only_filter/)
    assert.doesNotMatch(error.message, /\[object Object\]/)
    assert.ok(error.message.length <= 500)
    return true
  }
)

const longErrorText = formatDealMachineErrorDetail({
  error: { code: 'validation_error', details: { reason: 'x'.repeat(2_000) } },
})
assert.ok(longErrorText.length <= 500)
assert.doesNotMatch(longErrorText, /\[object Object\]/)

assert.deepEqual(client.downloadUrls({
  download_urls: [{ filename: 'owners.csv.gz', url: 'https://example.test/owners.csv.gz', size: 42 }],
}), [{ filename: 'owners.csv.gz', url: 'https://example.test/owners.csv.gz', size: 42 }])

console.log('DealMachine v2 client tests passed.')
