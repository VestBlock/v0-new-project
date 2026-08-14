export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { sellerAdminUpdateSchema } from '@/lib/seller/schemas'
import { recordSellerCaseEvent } from '@/lib/seller/service'
import { sellerCaseStatuses, sellerCaseTransitions, type SellerCaseStatus } from '@/lib/seller/types'
import { logEvent } from '@/lib/system/logEvent'

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function operatorCase(record: Record<string, unknown>) {
  const { public_token_hash: _token, dedupe_key: _dedupe, idempotency_key: _idempotency, ...safeRecord } = record
  return safeRecord
}

export async function GET(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  if (id) {
    const [record, events, tasks] = await Promise.all([
      admin.from('seller_cases').select('*').eq('id', id).maybeSingle(),
      admin.from('seller_case_events').select('*').eq('seller_case_id', id).order('created_at', { ascending: false }),
      admin.from('admin_tasks').select('*').eq('entity_type', 'seller_case').eq('entity_id', id).order('created_at', { ascending: false }),
    ])
    if (record.error) return privateJson({ error: record.error.message }, { status: 500 })
    if (!record.data) return privateJson({ error: 'Seller case not found.' }, { status: 404 })
    if (events.error || tasks.error) return privateJson({ error: events.error?.message || tasks.error?.message }, { status: 500 })
    return privateJson({ case: operatorCase(record.data), events: events.data || [], tasks: tasks.data || [] })
  }
  let query = admin.from('seller_cases').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).limit(250)
  if (status && sellerCaseStatuses.includes(status as SellerCaseStatus)) query = query.eq('status', status)
  const [result, profiles] = await Promise.all([
    query,
    admin.from('user_profiles').select('id,user_id,full_name,email').eq('role', 'admin').order('full_name', { ascending: true }),
  ])
  if (result.error || profiles.error) return privateJson({ error: result.error?.message || profiles.error?.message }, { status: 500 })
  const operators = (profiles.data || []).map((profile) => ({
    id: profile.user_id || profile.id,
    name: profile.full_name || 'VestBlock operator',
    email: profile.email,
  }))
  if (user && !operators.some((operator) => operator.id === user.id)) {
    operators.unshift({ id: user.id, name: user.user_metadata?.full_name || 'Current operator', email: user.email || null })
  }
  return privateJson({ cases: (result.data || []).map(operatorCase), count: result.count || 0, operators, currentOperatorId: user?.id || null })
}

export async function PATCH(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response
  const parsed = sellerAdminUpdateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Invalid seller case update.', details: parsed.error.flatten() }, { status: 400 })
  const { data: existing, error: existingError } = await admin.from('seller_cases').select('*').eq('id', parsed.data.id).maybeSingle()
  if (existingError) return privateJson({ error: existingError.message }, { status: 500 })
  if (!existing) return privateJson({ error: 'Seller case not found.' }, { status: 404 })
  const nextStatus = parsed.data.status
  if (nextStatus && !sellerCaseTransitions[existing.status as SellerCaseStatus]?.includes(nextStatus)) {
    return privateJson({ error: `Status cannot move from ${existing.status} to ${nextStatus}.` }, { status: 409 })
  }
  if (nextStatus && ['needs_information', 'declined'].includes(nextStatus) && !parsed.data.note) {
    return privateJson({ error: 'Record what is missing or why the case was declined.' }, { status: 422 })
  }
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {}
  if (nextStatus) {
    payload.status = nextStatus
    payload.last_status_changed_at = now
  }
  if (parsed.data.assignedTo !== undefined) payload.assigned_to = parsed.data.assignedTo
  if (parsed.data.note) payload.last_status_note = parsed.data.note
  const result = await admin.from('seller_cases').update(payload).eq('id', existing.id).select('*').single()
  if (result.error) return privateJson({ error: result.error.message }, { status: 500 })
  try {
    await recordSellerCaseEvent({
      caseId: existing.id,
      actorUserId: user?.id,
      eventType: nextStatus ? 'status_changed' : 'operator_update',
      fromStatus: existing.status,
      toStatus: nextStatus || existing.status,
      note: parsed.data.note || null,
      metadata: { assignedTo: parsed.data.assignedTo },
    })
    if (existing.operator_task_id) {
      const terminal = nextStatus && ['declined', 'withdrawn', 'closed'].includes(nextStatus)
      const taskStatus = terminal ? 'completed' : nextStatus === 'needs_information' ? 'waiting' : nextStatus ? 'in_progress' : undefined
      if (taskStatus) await admin.from('admin_tasks').update({ status: taskStatus, assigned_to: parsed.data.assignedTo ?? existing.assigned_to, completed_at: taskStatus === 'completed' ? now : null }).eq('id', existing.operator_task_id)
      else if (parsed.data.assignedTo !== undefined) await admin.from('admin_tasks').update({ assigned_to: parsed.data.assignedTo }).eq('id', existing.operator_task_id)
    }
    if (existing.lead_id) {
      const leadStatus: Partial<Record<SellerCaseStatus, string>> = {
        submitted: 'new',
        needs_information: 'nurturing',
        under_review: 'qualified',
        options_review: 'interested',
        declined: 'disqualified',
        withdrawn: 'do_not_contact',
        closed: 'closed',
      }
      const leadPayload: Record<string, unknown> = {}
      if (nextStatus && leadStatus[nextStatus]) leadPayload.status = leadStatus[nextStatus]
      if (parsed.data.assignedTo !== undefined) leadPayload.owner_user_id = parsed.data.assignedTo
      if (Object.keys(leadPayload).length) await admin.from('leads').update(leadPayload).eq('id', existing.lead_id)
    }
    await logEvent({ eventType: 'seller_case_status_updated', actorUserId: user?.id, entityType: 'seller_case', entityId: existing.id, metadata: { fromStatus: existing.status, toStatus: nextStatus || existing.status } })
  } catch (error) {
    console.error('[seller-case] operator follow-up pending:', error)
    return privateJson({ case: operatorCase(result.data), operationPending: true, message: 'The case update was saved, but an internal history or CRM update needs attention.' }, { status: 202 })
  }
  return privateJson({ case: operatorCase(result.data) })
}
