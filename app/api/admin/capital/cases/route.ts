export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { capitalAdminUpdateSchema } from '@/lib/capital/schemas'
import { recordCapitalCaseEvent } from '@/lib/capital/service'
import { capitalCaseStatuses, capitalCaseTransitions, capitalCaseTypes } from '@/lib/capital/types'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { logEvent } from '@/lib/system/logEvent'

function operatorCase(record: Record<string, unknown>) {
  const {
    public_token_hash: _publicTokenHash,
    dedupe_key: _dedupeKey,
    idempotency_key: _idempotencyKey,
    ...operatorRecord
  } = record
  return operatorRecord
}

export async function GET(request: NextRequest) {
  const { admin, response } = await requireLeadAdmin(request)
  if (response) return response
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const caseType = searchParams.get('case_type')
  const id = searchParams.get('id')

  if (id) {
    const [record, events, task] = await Promise.all([
      admin.from('capital_cases').select('*').eq('id', id).maybeSingle(),
      admin.from('capital_case_events').select('*').eq('capital_case_id', id).order('created_at', { ascending: false }),
      admin.from('admin_tasks').select('*').eq('entity_type', 'capital_case').eq('entity_id', id).order('created_at', { ascending: false }),
    ])
    if (record.error) return NextResponse.json({ error: record.error.message }, { status: 500 })
    if (!record.data) return NextResponse.json({ error: 'Capital case not found.' }, { status: 404 })
    return NextResponse.json({ case: operatorCase(record.data), events: events.data || [], tasks: task.data || [] })
  }

  let query = admin.from('capital_cases').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).limit(250)
  if (status && capitalCaseStatuses.includes(status as any)) query = query.eq('status', status)
  if (caseType && capitalCaseTypes.includes(caseType as any)) query = query.eq('case_type', caseType)
  const result = await query
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ cases: (result.data || []).map(operatorCase), count: result.count || 0 })
}

export async function PATCH(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response
  const parsed = capitalAdminUpdateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Capital case update.', details: parsed.error.flatten() }, { status: 400 })
  const { data: existing, error: existingError } = await admin.from('capital_cases').select('*').eq('id', parsed.data.id).maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Capital case not found.' }, { status: 404 })
  if (parsed.data.status && !capitalCaseTransitions[existing.status as keyof typeof capitalCaseTransitions]?.includes(parsed.data.status)) {
    return NextResponse.json({ error: `Status cannot move from ${existing.status} to ${parsed.data.status}.` }, { status: 409 })
  }
  if (parsed.data.status && ['needs_information', 'declined'].includes(parsed.data.status) && !String(parsed.data.note || '').trim()) {
    return NextResponse.json({ error: 'Record what is missing or why the case was declined.' }, { status: 422 })
  }
  if (parsed.data.status === 'approved' && !String(parsed.data.note || '').trim()) {
    return NextResponse.json({ error: 'Record the provider decision or evidence before marking a case approved.' }, { status: 422 })
  }
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {}
  if (parsed.data.status) {
    payload.status = parsed.data.status
    payload.last_status_changed_at = now
  }
  if (parsed.data.assignedTo !== undefined) payload.assigned_to = parsed.data.assignedTo
  if (parsed.data.note) payload.last_status_note = parsed.data.note
  const result = await admin.from('capital_cases').update(payload).eq('id', parsed.data.id).select('*').single()
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  await recordCapitalCaseEvent({
    caseId: existing.id,
    actorUserId: user?.id,
    eventType: parsed.data.status ? 'status_changed' : 'operator_update',
    fromStatus: existing.status,
    toStatus: parsed.data.status || existing.status,
    note: parsed.data.note || null,
    metadata: { assignedTo: parsed.data.assignedTo },
  })
  if (existing.operator_task_id && parsed.data.status) {
    const taskStatus = ['approved', 'declined', 'withdrawn', 'closed'].includes(parsed.data.status) ? 'completed' : parsed.data.status === 'needs_information' ? 'waiting' : 'in_progress'
    await admin.from('admin_tasks').update({ status: taskStatus, completed_at: taskStatus === 'completed' ? now : null }).eq('id', existing.operator_task_id)
  }
  await logEvent({ eventType: 'admin_action', actorUserId: user?.id, entityType: 'capital_case', entityId: existing.id, metadata: { action: 'capital_case_updated', fromStatus: existing.status, toStatus: parsed.data.status || existing.status } })
  return NextResponse.json({ case: operatorCase(result.data) })
}
