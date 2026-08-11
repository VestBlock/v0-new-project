import 'server-only'

import { createHmac } from 'node:crypto'

export type ProviderDispatchResult = {
  provider: 'n8n'
  mode: 'preview' | 'dispatched'
  requestId: string
  status: number | null
}

function requiredEnv(name: string) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function approvedHttpsUrl(raw: string, label: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`${label} must use HTTPS.`)
  }
  if (url.username || url.password) throw new Error(`${label} cannot contain embedded credentials.`)
  return url
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, redirect: 'error', signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function emitApprovedN8nEvent(input: {
  requestId: string
  event: string
  payload: Record<string, unknown>
  approvedByUserId: string
  dryRun?: boolean
}): Promise<ProviderDispatchResult> {
  if (!input.approvedByUserId) throw new Error('A founder approval is required before n8n dispatch.')
  const endpoint = approvedHttpsUrl(requiredEnv('N8N_WEBHOOK_URL'), 'N8N_WEBHOOK_URL')
  const secret = requiredEnv('N8N_WEBHOOK_SECRET')
  const body = JSON.stringify({
    id: input.requestId,
    event: input.event,
    occurredAt: new Date().toISOString(),
    approvedByUserId: input.approvedByUserId,
    payload: input.payload,
  })
  const signature = createHmac('sha256', secret).update(body).digest('hex')

  if (input.dryRun !== false) {
    return { provider: 'n8n', mode: 'preview', requestId: input.requestId, status: null }
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': input.requestId,
      'x-vestblock-secret': secret,
      'x-vestblock-signature': `sha256=${signature}`,
    },
    body,
  })
  if (!response.ok) throw new Error(`n8n rejected the approved event (${response.status}).`)
  return { provider: 'n8n', mode: 'dispatched', requestId: input.requestId, status: response.status }
}
