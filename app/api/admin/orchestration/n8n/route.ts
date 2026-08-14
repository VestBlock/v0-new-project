export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { dispatchN8nWorkflow, N8N_CHANNELS } from '@/lib/automation/n8n-orchestrator'
import { checkAdminAccess } from '@/lib/auth/admin'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  eventType: z.enum(['workflow_contract_test', 'approved_outreach_requested', 'match_reviewed', 'strategy_version_activated']),
  strategyLaneKey: z.string().trim().max(100).nullable().optional(),
  strategyVersionId: z.string().uuid().nullable().optional(),
  matchId: z.string().uuid().nullable().optional(),
  crmLeadId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(200).regex(/^[a-zA-Z0-9._:-]+$/),
  mode: z.enum(['no_send', 'internal_test', 'approved_live']).default('no_send'),
  channel: z.enum(N8N_CHANNELS).default('no_outreach'),
  templateKey: z.string().trim().max(120).nullable().optional(),
  templateVersion: z.number().int().positive().max(10000).nullable().optional(),
})

function json(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init)
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return result
}
export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) return json({ error: 'Admin access required.' }, { status: adminCheck.user ? 403 : 401 })
  const admin = createAdminClient()
  const [control, runs] = await Promise.all([
    admin.from('orchestration_controls').select('integration_key,live_send_enabled,kill_switch,approved_channels_json,updated_at').eq('integration_key', 'n8n').single(),
    admin.from('orchestration_runs').select('*').eq('integration_key', 'n8n').order('created_at', { ascending: false }).limit(50),
  ])
  if (control.error || runs.error) return json({ error: 'n8n orchestration status is temporarily unavailable.' }, { status: 500 })
  return json({ control: control.data, runs: runs.data || [] })
}

export async function POST(request: Request) {
  const guard = guardPublicMutation(request, { scope: 'n8n-orchestration', maxRequests: 30 })
  if (guard) return guard
  const admin = await checkAdminAccess()
  if (!admin.isAdmin || !admin.user) return json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Check the orchestration request.', details: parsed.error.flatten() }, { status: 400 })
  try {
    return json(await dispatchN8nWorkflow({ ...parsed.data, operatorUserId: admin.user.id }))
  } catch (error) {
    console.error('[n8n-orchestration] dispatch failed', error)
    return json({ error: error instanceof Error ? error.message : 'n8n orchestration failed safely.' }, { status: 422 })
  }
}
