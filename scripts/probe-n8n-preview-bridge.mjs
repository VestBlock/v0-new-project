import { createHmac } from 'node:crypto'

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

const endpoint = new URL(requiredEnv('N8N_WEBHOOK_URL'))
if (endpoint.protocol !== 'https:') throw new Error('N8N_WEBHOOK_URL must use HTTPS.')
if (endpoint.username || endpoint.password) throw new Error('N8N_WEBHOOK_URL cannot contain embedded credentials.')

const secret = requiredEnv('N8N_WEBHOOK_SECRET')
const requestId = `n8n-proof-${Date.now()}`
const envelope = {
  id: requestId,
  event: 'system.connection_proof',
  occurredAt: new Date().toISOString(),
  approvedByUserId: 'founder-confirmed-2026-08-10',
  payload: {
    noExternalWrites: true,
    purpose: 'credential_and_preview_verification',
  },
}
const body = JSON.stringify(envelope)
const signature = createHmac('sha256', secret).update(body).digest('hex')

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 12_000)
let response
try {
  response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: controller.signal,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': requestId,
      'x-vestblock-secret': secret,
      'x-vestblock-signature': `sha256=${signature}`,
    },
    body,
  })
} finally {
  clearTimeout(timeout)
}

if (response.status !== 202) {
  throw new Error(`n8n preview bridge returned HTTP ${response.status}; expected 202.`)
}

const result = await response.json()
if (result?.accepted !== true || result?.mode !== 'preview' || result?.requestId !== requestId) {
  throw new Error('n8n preview bridge returned an unexpected response contract.')
}

console.log(JSON.stringify({
  ok: true,
  status: response.status,
  mode: result.mode,
  requestIdMatched: true,
  externalWrites: false,
  secretExposed: false,
}))
