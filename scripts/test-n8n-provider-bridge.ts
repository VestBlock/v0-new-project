import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import { emitApprovedN8nEvent } from '../lib/autopilot/providerAdapters'

async function main() {
  const previousUrl = process.env.N8N_WEBHOOK_URL
  const previousSecret = process.env.N8N_WEBHOOK_SECRET
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; init: RequestInit }> = []

  process.env.N8N_WEBHOOK_URL = 'https://vestblock.app.n8n.cloud/webhook/vestblock-signed-command-bridge'
  process.env.N8N_WEBHOOK_SECRET = 'test-bridge-secret'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init || {} })
    return new Response(JSON.stringify({ accepted: true, mode: 'preview', requestId: 'req_123' }), { status: 202 })
  }) as typeof fetch

  try {
    const preview = await emitApprovedN8nEvent({
      requestId: 'req_preview',
      event: 'strategy.preview',
      approvedByUserId: 'founder_1',
      payload: { lane: 'growth' },
    })
    assert.equal(preview.mode, 'preview')
    assert.equal(calls.length, 0)

    const dispatched = await emitApprovedN8nEvent({
      requestId: 'req_123',
      event: 'strategy.preview',
      approvedByUserId: 'founder_1',
      payload: { lane: 'growth' },
      dryRun: false,
    })
    assert.equal(dispatched.mode, 'dispatched')
    assert.equal(dispatched.status, 202)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, process.env.N8N_WEBHOOK_URL)

    const headers = new Headers(calls[0].init.headers)
    const body = String(calls[0].init.body)
    const expectedSignature = createHmac('sha256', 'test-bridge-secret').update(body).digest('hex')
    assert.equal(headers.get('idempotency-key'), 'req_123')
    assert.equal(headers.get('x-vestblock-secret'), 'test-bridge-secret')
    assert.equal(headers.get('x-vestblock-signature'), `sha256=${expectedSignature}`)
    assert.equal(calls[0].init.redirect, 'error')
    assert.equal(JSON.parse(body).approvedByUserId, 'founder_1')
    console.log('PASS n8n bridge defaults to preview and sends authenticated HMAC envelopes only after approval.')
  } finally {
    globalThis.fetch = originalFetch
    if (previousUrl === undefined) delete process.env.N8N_WEBHOOK_URL
    else process.env.N8N_WEBHOOK_URL = previousUrl
    if (previousSecret === undefined) delete process.env.N8N_WEBHOOK_SECRET
    else process.env.N8N_WEBHOOK_SECRET = previousSecret
  }
}

void main()
