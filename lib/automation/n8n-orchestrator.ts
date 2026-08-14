import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'

export const N8N_CHANNELS = [
  'resend_email',
  'outlook_graph',
  'buffer_vestblock',
  'operator_task',
  'manual_phone_task',
  'website_notification',
  'no_outreach',
] as const

export type N8nChannel = (typeof N8N_CHANNELS)[number]
export type OrchestrationMode = 'no_send' | 'internal_test' | 'approved_live'

function configuration() {
  const url = process.env.N8N_WEBHOOK_URL?.trim()
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim()
  if (!url || !secret) throw new Error('n8n webhook configuration is incomplete.')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('n8n webhook must use HTTPS.')
  const approvedHost = process.env.N8N_ALLOWED_HOST?.trim().toLowerCase()
  const hostname = parsed.hostname.toLowerCase()
  if (!(hostname.endsWith('.n8n.cloud') || (approvedHost && hostname === approvedHost))) {
    throw new Error('n8n webhook host is not allowlisted.')
  }
  return { url, secret }
}

function sign(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

export function verifyN8nSignature(input: { body: string; timestamp: string; signature: string; secret: string; now?: number }) {
  const signedAt = Date.parse(input.timestamp)
  if (!Number.isFinite(signedAt) || Math.abs((input.now ?? Date.now()) - signedAt) > 5 * 60_000) return false
  const expected = sign(input.secret, input.timestamp, input.body)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(input.signature)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

export async function dispatchN8nWorkflow(input: {
  eventType: 'workflow_contract_test' | 'approved_outreach_requested' | 'match_reviewed' | 'strategy_version_activated'
  strategyLaneKey?: string | null
  strategyVersionId?: string | null
  matchId?: string | null
  crmLeadId?: string | null
  idempotencyKey: string
  mode: OrchestrationMode
  channel: N8nChannel
  templateKey?: string | null
  templateVersion?: number | null
  operatorUserId: string
}) {
  const admin = createAdminClient()
  const existing = await admin.from('orchestration_runs').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return { run: existing.data, replayed: true }

  const controls = await admin.from('orchestration_controls').select('*').eq('integration_key', 'n8n').single()
  if (controls.error) throw controls.error
  const control = controls.data
  if (control.kill_switch) throw new Error('The n8n production kill switch is engaged.')
  const approvedChannels = new Set<string>(Array.isArray(control.approved_channels_json) ? control.approved_channels_json : [])
  if (!approvedChannels.has(input.channel)) throw new Error('This outreach channel is not approved for n8n.')
  if (input.mode === 'approved_live') {
    if (!control.live_send_enabled || process.env.OUTREACH_LIVE_SEND_ENABLED !== 'true') {
      throw new Error('Live external outreach is disabled. Use no-send or internal-test mode.')
    }
    if (!input.matchId || !input.strategyVersionId) throw new Error('Live execution requires an approved match and strategy version.')
    const match = await admin.from('participant_opportunity_matches')
      .select('id,status,outreach_eligible,participant_profiles!inner(status,outreach_consent,outreach_consent_at)')
      .eq('id', input.matchId).single()
    if (match.error) throw match.error
    const profile = Array.isArray(match.data.participant_profiles) ? match.data.participant_profiles[0] : match.data.participant_profiles
    if (match.data.status !== 'approved' || !match.data.outreach_eligible || profile?.status !== 'active' || !profile?.outreach_consent) {
      throw new Error('The match and outreach permission are not approved for live execution.')
    }
  }

  const task = await createAdminTask({
    title: input.mode === 'approved_live' ? 'Review live n8n orchestration' : 'Review n8n no-send test',
    description: 'Confirm the signed orchestration event, idempotency result, and workflow acknowledgement. No-send tests cannot contact an external recipient.',
    taskType: 'n8n_orchestration_review',
    priority: input.mode === 'approved_live' ? 'high' : 'low',
    entityType: input.matchId ? 'opportunity_match' : 'orchestration',
    entityId: input.matchId || input.idempotencyKey,
    dueAt: adminTaskDueDates.days(1),
    metadata: { eventType: input.eventType, mode: input.mode, channel: input.channel, idempotencyKey: input.idempotencyKey },
    createdBy: 'gate-4e3-n8n',
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'The orchestration review task could not be created.')

  const payload = {
    contract: 'vestblock.n8n.v1',
    eventType: input.eventType,
    idempotencyKey: input.idempotencyKey,
    mode: input.mode,
    channel: input.channel,
    strategy: input.strategyLaneKey && input.strategyVersionId
      ? { laneKey: input.strategyLaneKey, versionId: input.strategyVersionId }
      : null,
    references: { matchId: input.matchId || null, crmLeadId: input.crmLeadId || null, operatorTaskId: task.task.id },
    template: input.templateKey ? { key: input.templateKey, version: input.templateVersion || 1 } : null,
    policy: {
      externalSendAllowed: input.mode === 'approved_live',
      requireSuppressionCheck: true,
      requireConsentOrLawfulBasis: true,
      retryCreatesDuplicate: false,
    },
    requestedAt: new Date().toISOString(),
  }
  const body = JSON.stringify(payload)
  const digest = createHash('sha256').update(body).digest('hex')
  const created = await admin.from('orchestration_runs').insert({
    integration_key: 'n8n', event_type: input.eventType, strategy_lane_key: input.strategyLaneKey || null,
    strategy_version_id: input.strategyVersionId || null, match_id: input.matchId || null, crm_lead_id: input.crmLeadId || null,
    idempotency_key: input.idempotencyKey, mode: input.mode, channel: input.channel, status: 'queued', request_digest: digest,
    template_key: input.templateKey || null, template_version: input.templateVersion || null, operator_task_id: task.task.id,
  }).select('*').single()
  if (created.error) throw created.error

  const { url, secret } = configuration()
  const timestamp = new Date().toISOString()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-vestblock-secret': secret,
        'content-type': 'application/json',
        'x-vestblock-timestamp': timestamp,
        'x-vestblock-signature': sign(secret, timestamp, body),
        'x-vestblock-idempotency-key': input.idempotencyKey,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    const status = response.ok ? 'dispatched' : 'failed'
    const updated = await admin.from('orchestration_runs').update({
      status, response_status: response.status, attempt_count: 1,
      failure_code: response.ok ? null : `n8n_http_${response.status}`,
      dispatched_at: response.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', created.data.id).select('*').single()
    if (updated.error) throw updated.error
    if (!response.ok) {
      const rejection = new Error(`n8n rejected the orchestration request with HTTP ${response.status}.`)
      rejection.name = `n8n_http_${response.status}`
      throw rejection
    }
    return { run: updated.data, replayed: false }
  } catch (error) {
    await admin.from('orchestration_runs').update({
      status: 'failed', attempt_count: 1, failure_code: error instanceof Error ? error.name : 'network_error', updated_at: new Date().toISOString(),
    }).eq('id', created.data.id)
    throw error
  }
}

export async function acknowledgeN8nWorkflow(input: {
  rawBody: string
  timestamp: string
  signature: string
}) {
  const { secret } = configuration()
  if (!verifyN8nSignature({ body: input.rawBody, timestamp: input.timestamp, signature: input.signature, secret })) {
    throw new Error('Invalid or expired n8n signature.')
  }
  const body = JSON.parse(input.rawBody) as Record<string, unknown>
  const idempotencyKey = String(body.idempotencyKey || '')
  const eventType = String(body.eventType || '')
  if (!idempotencyKey || !eventType) throw new Error('n8n acknowledgement is missing required identifiers.')
  const admin = createAdminClient()
  const run = await admin.from('orchestration_runs').select('*').eq('idempotency_key', idempotencyKey).single()
  if (run.error) throw run.error
  const receipt = await admin.from('orchestration_webhook_receipts').insert({
    integration_key: 'n8n', idempotency_key: idempotencyKey, signature_timestamp: input.timestamp,
    body_digest: createHash('sha256').update(input.rawBody).digest('hex'), event_type: eventType, run_id: run.data.id,
  }).select('id').maybeSingle()
  if (receipt.error?.code === '23505') return { run: run.data, replayed: true }
  if (receipt.error) throw receipt.error
  const status = body.status === 'failed' ? 'failed' : body.status === 'suppressed' ? 'suppressed' : 'acknowledged'
  const updated = await admin.from('orchestration_runs').update({
    status, acknowledged_at: new Date().toISOString(), failure_code: status === 'failed' ? String(body.failureCode || 'workflow_failed') : null,
    updated_at: new Date().toISOString(),
  }).eq('id', run.data.id).select('*').single()
  if (updated.error) throw updated.error
  return { run: updated.data, replayed: false }
}
