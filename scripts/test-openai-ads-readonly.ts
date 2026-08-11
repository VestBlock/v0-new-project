import assert from 'node:assert/strict'

import { getOpenAiAdsOverview } from '../lib/autopilot/openAiAds'

async function main() {
  const previous = process.env.OPENAI_ADS_API_KEY
  const calls: Array<{ url: string; method: string }> = []
  process.env.OPENAI_ADS_API_KEY = 'test-account-key'

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, method: String(init?.method || 'GET').toUpperCase() })
    if (url.endsWith('/ad_account')) {
      return new Response(JSON.stringify({ status: 'active', review: { status: 'approved' }, currency_code: 'USD' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.includes('/ad_account/insights?')) {
      return new Response(JSON.stringify({ data: [
        { impressions: 1000, clicks: 25, spend: 50 },
        { impressions: 500, clicks: 5, spend: 10 },
      ] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('{}', { status: 404 })
  }

  try {
    const result = await getOpenAiAdsOverview({ fetchImpl, now: new Date('2026-08-10T12:00:00Z') })
    assert.equal(result.configured, true)
    assert.equal(result.accountStatus, 'active')
    assert.equal(result.reviewStatus, 'approved')
    assert.equal(result.impressions, 1500)
    assert.equal(result.clicks, 30)
    assert.equal(result.spend, 60)
    assert.equal(result.ctr, 2)
    assert.equal(calls.length, 2)
    assert.ok(calls.every((call) => call.method === 'GET'))
    assert.ok(calls.every((call) => call.url.startsWith('https://api.ads.openai.com/v1/')))
    console.log('PASS OpenAI Ads adapter is read-only and aggregates campaign insights.')
  } finally {
    if (previous === undefined) delete process.env.OPENAI_ADS_API_KEY
    else process.env.OPENAI_ADS_API_KEY = previous
  }
}

void main()
