export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/admin'
import { assessSellerCompleteness } from '@/lib/seller/readiness'
import { sellerCaseInputSchema } from '@/lib/seller/schemas'
import { createSellerAccessToken, hashSellerToken, sellerDedupeKey, sellerTokenMatches } from '@/lib/seller/security'
import { recordSellerCaseEvent, routeSubmittedSellerCase, sellerCasePayload } from '@/lib/seller/service'
import type { SellerCaseRecord } from '@/lib/seller/types'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import { createAdminClient } from '@/lib/supabase/admin'

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

function customerCase(record: SellerCaseRecord & Record<string, unknown>) {
  const {
    public_token_hash: _publicTokenHash,
    dedupe_key: _dedupeKey,
    idempotency_key: _idempotencyKey,
    user_id: _userId,
    lead_id: _leadId,
    operator_task_id: _operatorTaskId,
    assigned_to: _assignedTo,
    ...safeRecord
  } = record
  return safeRecord
}

function customerEvent(event: Record<string, unknown>) {
  const { actor_user_id: _actorUserId, metadata_json: _metadata, ...safeEvent } = event
  return safeEvent
}

async function ownedCase(input: { id: string; userId?: string | null; accessToken?: string | null }) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('seller_cases').select('*').eq('id', input.id).maybeSingle()
  if (error) throw error
  if (!data) return null
  if (input.userId && data.user_id === input.userId) return data as SellerCaseRecord
  if (!data.user_id && sellerTokenMatches(input.accessToken, data.public_token_hash)) return data as SellerCaseRecord
  return null
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const accessToken = searchParams.get('token')
  const admin = createAdminClient()
  try {
    if (id) {
      const record = await ownedCase({ id, userId: user?.id, accessToken })
      if (!record) return privateJson({ error: 'Seller case not found.' }, { status: 404 })
      const { data: events, error } = await admin.from('seller_case_events').select('*').eq('seller_case_id', id).order('created_at', { ascending: true })
      if (error) throw error
      return privateJson({ case: customerCase(record), events: (events || []).map(customerEvent) })
    }
    if (!user) return privateJson({ cases: [] })
    const { data, error } = await admin.from('seller_cases').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    return privateJson({ cases: (data || []).map((record) => customerCase(record as SellerCaseRecord)) })
  } catch (error) {
    console.error('[seller-case] read failed:', error)
    return privateJson({ error: 'Unable to load seller cases right now.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = guardPublicMutation(request, { scope: 'seller-case', maxRequests: 30 })
  if (guard) {
    guard.headers.set('Cache-Control', 'private, no-store, max-age=0')
    return guard
  }
  const parsed = sellerCaseInputSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Check the seller intake and try again.', details: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data
  const user = await getServerUser()
  const admin = createAdminClient()
  const email = (input.email || user?.email || '').trim().toLowerCase()
  if (!user && !/^\S+@\S+\.\S+$/.test(email)) {
    return privateJson({ error: 'A valid email is required to save a private guest draft.' }, { status: 400 })
  }
  const completeness = assessSellerCompleteness({ ...input, email })
  if (input.action === 'submit' && !completeness.complete) {
    return privateJson({ error: `Complete: ${completeness.gaps.join(', ')}.`, completeness }, { status: 422 })
  }
  try {
    let existing: SellerCaseRecord | null = null
    if (input.id) {
      existing = await ownedCase({ id: input.id, userId: user?.id, accessToken: input.accessToken })
      if (!existing) return privateJson({ error: 'Seller case not found.' }, { status: 404 })
    } else {
      const dedupe = sellerDedupeKey({
        propertyAddress: input.propertyAddress,
        city: input.city,
        state: input.state,
        userId: user?.id,
        email,
      })
      const result = await admin.from('seller_cases').select('*').eq('dedupe_key', dedupe).maybeSingle()
      if (result.error) throw result.error
      existing = result.data as SellerCaseRecord | null
      if (existing && user && existing.user_id !== user.id) return privateJson({ error: 'This seller case belongs to another account.' }, { status: 403 })
      if (existing && !user && !sellerTokenMatches(input.accessToken, (result.data as Record<string, unknown>)?.public_token_hash as string | null)) {
        return privateJson({ error: 'A seller case already exists for this property and email. Use its private resume link or sign in to continue.', code: 'existing_case_requires_access' }, { status: 409 })
      }
    }

    if (input.action === 'withdraw') {
      if (!existing) return privateJson({ error: 'Seller case not found.' }, { status: 404 })
      if (!['draft', 'submitted', 'needs_information', 'under_review', 'options_review'].includes(existing.status)) {
        return privateJson({ error: `This case cannot be withdrawn from ${existing.status}.` }, { status: 409 })
      }
      const now = new Date().toISOString()
      const { data, error } = await admin.from('seller_cases').update({ status: 'withdrawn', last_status_note: 'Withdrawn by the seller.', last_status_changed_at: now }).eq('id', existing.id).select('*').single()
      if (error) throw error
      await recordSellerCaseEvent({ caseId: existing.id, actorUserId: user?.id, eventType: 'case_withdrawn', fromStatus: existing.status, toStatus: 'withdrawn', note: 'Withdrawn by the seller.' })
      if (existing.operator_task_id) await admin.from('admin_tasks').update({ status: 'completed', completed_at: now }).eq('id', existing.operator_task_id)
      if (existing.lead_id) await admin.from('leads').update({ status: 'do_not_contact', outreach_status: 'do_not_contact' }).eq('id', existing.lead_id)
      return privateJson({ case: customerCase(data as SellerCaseRecord) })
    }

    const dedupeKey = sellerDedupeKey({
      propertyAddress: input.propertyAddress,
      city: input.city,
      state: input.state,
      userId: user?.id,
      email,
    })
    const accessToken = input.accessToken || createSellerAccessToken()
    const routingComplete = Boolean(existing?.lead_id && existing?.operator_task_id)
    if (existing && input.idempotencyKey && (existing as SellerCaseRecord & { idempotency_key?: string }).idempotency_key === input.idempotencyKey && (input.action !== 'submit' || routingComplete)) {
      return privateJson({ case: customerCase(existing), accessToken: user ? null : input.accessToken || null, completeness, duplicate: true })
    }
    const { payload } = sellerCasePayload({ ...input, email })
    const now = new Date().toISOString()
    const canMoveToSubmitted = !existing || ['draft', 'needs_information', 'submitted'].includes(existing.status)
    const nextStatus = input.action === 'submit' && canMoveToSubmitted ? 'submitted' : existing?.status || 'draft'
    const recordPayload = {
      ...payload,
      source_path: existing?.source_path || payload.source_path,
      source: existing?.source || payload.source,
      attribution: { ...(existing?.attribution || {}), ...payload.attribution },
      user_id: user?.id || existing?.user_id || null,
      public_token_hash: user ? null : existing ? undefined : hashSellerToken(accessToken),
      dedupe_key: dedupeKey,
      idempotency_key: input.idempotencyKey || undefined,
      status: nextStatus,
      submitted_at: input.action === 'submit' ? existing?.submitted_at || now : existing?.submitted_at || null,
      last_status_changed_at: nextStatus !== existing?.status ? now : existing?.last_status_changed_at || now,
    }
    const result = existing
      ? await admin.from('seller_cases').update(recordPayload).eq('id', existing.id).select('*').single()
      : await admin.from('seller_cases').insert(recordPayload).select('*').single()
    if (result.error || !result.data) {
      if (result.error?.code === '23505' && input.idempotencyKey) {
        const retry = await admin.from('seller_cases').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
        const retryOwned = Boolean(retry.data && ((user && retry.data.user_id === user.id) || (!user && sellerTokenMatches(input.accessToken, retry.data.public_token_hash))))
        if (retryOwned) return privateJson({ case: customerCase(retry.data as SellerCaseRecord), accessToken: user ? null : input.accessToken, completeness, duplicate: true })
      }
      throw result.error || new Error('Seller case was not saved.')
    }

    let saved = result.data as SellerCaseRecord
    const eventType = input.action === 'submit'
      ? existing?.status === 'submitted' ? 'operator_routing_retried' : 'case_submitted'
      : existing ? 'draft_updated' : 'draft_created'
    try {
      if (input.action === 'submit' && routingComplete) {
        if (saved.operator_task_id) await admin.from('admin_tasks').update({ status: 'in_progress', completed_at: null }).eq('id', saved.operator_task_id)
        if (saved.lead_id) await admin.from('leads').update({ status: 'new', outreach_status: 'needs_review' }).eq('id', saved.lead_id)
      }
      if (existing && !existing.user_id && user) {
        await recordSellerCaseEvent({ caseId: saved.id, actorUserId: user.id, eventType: 'guest_case_claimed', fromStatus: saved.status, toStatus: saved.status, note: 'Private guest case claimed by the signed-in owner.' })
      }
      await recordSellerCaseEvent({
        caseId: saved.id,
        actorUserId: user?.id,
        eventType,
        fromStatus: existing?.status || null,
        toStatus: saved.status,
        note: input.action === 'submit' ? 'Submitted for VestBlock review.' : 'Seller intake saved for continuation.',
        metadata: { completenessScore: saved.completeness_score },
      })
      if (input.action === 'submit') {
        const qaToken = process.env.SELLER_QA_ROUTING_FAILURE_TOKEN
        if (!routingComplete && qaToken && request.headers.get('x-vestblock-qa-routing-failure') === qaToken) throw new Error('Controlled seller routing failure.')
        saved = await routeSubmittedSellerCase(saved, { ...input, email, sourcePath: saved.source_path }, user)
      }
    } catch (error) {
      console.error('[seller-case] lifecycle follow-up pending:', error)
      await recordSellerCaseEvent({ caseId: saved.id, actorUserId: user?.id, eventType: 'operator_routing_pending', fromStatus: saved.status, toStatus: saved.status, note: 'The seller case is safely submitted. Internal CRM or task routing needs operator attention; no offer or outreach was sent.' }).catch(() => null)
      return privateJson({
        case: customerCase(saved),
        accessToken: user ? null : accessToken,
        completeness,
        duplicate: Boolean(existing),
        operationPending: true,
        routingPending: input.action === 'submit',
        message: 'Your case is saved. VestBlock is resolving an internal routing delay; no offer or outreach was sent.',
      }, { status: 202 })
    }
    return privateJson({ case: customerCase(saved), accessToken: user ? null : accessToken, completeness, duplicate: Boolean(existing) })
  } catch (error) {
    console.error('[seller-case] save failed:', error)
    return privateJson({ error: 'Unable to save the seller case right now.' }, { status: 500 })
  }
}
