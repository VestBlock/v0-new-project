export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { capitalCaseInputSchema } from '@/lib/capital/schemas'
import { capitalCasePayload, recordCapitalCaseEvent, submitCapitalCase } from '@/lib/capital/service'
import { capitalDedupeKey, capitalTokenMatches, createCapitalAccessToken, hashCapitalToken } from '@/lib/capital/security'
import type { CapitalCaseRecord } from '@/lib/capital/types'
import { getServerUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardPublicMutation } from '@/lib/security/public-mutation'

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function publicCase(record: CapitalCaseRecord & Record<string, unknown>) {
  const {
    public_token_hash: _publicTokenHash,
    dedupe_key: _dedupeKey,
    idempotency_key: _idempotencyKey,
    user_id: _userId,
    lead_id: _leadId,
    lender_id: _lenderId,
    assigned_to: _assignedTo,
    operator_task_id: _operatorTaskId,
    ...customerRecord
  } = record
  return customerRecord
}

function publicEvent(event: Record<string, unknown>) {
  const { actor_user_id: _actorUserId, metadata_json: _metadata, ...customerEvent } = event
  return customerEvent
}

async function ownedCase(input: { id: string; userId?: string | null; accessToken?: string | null }) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('capital_cases').select('*').eq('id', input.id).maybeSingle()
  if (error) throw error
  if (!data) return null
  if (input.userId && data.user_id === input.userId) return data as CapitalCaseRecord
  if (!data.user_id && capitalTokenMatches(input.accessToken, data.public_token_hash)) return data as CapitalCaseRecord
  return null
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const accessToken = searchParams.get('token')
  const admin = createAdminClient()

  if (id) {
    const record = await ownedCase({ id, userId: user?.id, accessToken })
    if (!record) return privateJson({ error: 'Capital case not found.' }, { status: 404 })
    const { data: events, error } = await admin.from('capital_case_events').select('*').eq('capital_case_id', record.id).order('created_at', { ascending: true })
    if (error) return privateJson({ error: 'Unable to load case history.' }, { status: 500 })
    return privateJson({ case: publicCase(record), events: (events || []).map(publicEvent) })
  }

  if (!user) return privateJson({ cases: [] })
  const { data, error } = await admin.from('capital_cases').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
  if (error) return privateJson({ error: 'Unable to load Capital cases.' }, { status: 500 })
  return privateJson({ cases: (data || []).map((record) => publicCase(record as CapitalCaseRecord)) })
}

export async function POST(request: NextRequest) {
  const guard = guardPublicMutation(request, { scope: 'capital-case', maxRequests: 12 })
  if (guard) return guard
  const parsed = capitalCaseInputSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the Capital intake and try again.', details: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const user = await getServerUser()
  const admin = createAdminClient()
  const email = (input.email || user?.email || '').trim().toLowerCase()
  if (!user && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required to save a guest case.' }, { status: 400 })
  }
  const dedupeKey = capitalDedupeKey({ caseType: input.caseType, userId: user?.id, email })
  const accessToken = input.accessToken || createCapitalAccessToken()
  const { readiness, payload } = capitalCasePayload({
    caseType: input.caseType,
    fullName: input.fullName,
    email,
    phone: input.phone,
    organizationName: input.organizationName,
    amountRequested: input.amountRequested,
    purpose: input.purpose,
    timing: input.timing,
    geography: input.geography,
    communicationPreference: input.communicationPreference,
    analysisConsent: input.analysisConsent,
    providerSharingConsent: input.providerSharingConsent,
    marketingConsent: input.marketingConsent,
    intakeData: input.intakeData,
    availableDocuments: input.availableDocuments,
  })

  if (input.action === 'submit') {
    const errors: string[] = []
    if (!input.fullName.trim()) errors.push('Full name is required.')
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('A valid email is required.')
    if (!input.analysisConsent) errors.push('Analysis consent is required.')
    if (readiness.gaps.length) errors.push(`Complete: ${readiness.gaps.join(', ')}.`)
    if (errors.length) return NextResponse.json({ error: errors[0], errors, readiness }, { status: 422 })
  }

  let existing: CapitalCaseRecord | null = null
  if (input.id) {
    existing = await ownedCase({ id: input.id, userId: user?.id, accessToken: input.accessToken })
    if (!existing) return NextResponse.json({ error: 'Capital case not found.' }, { status: 404 })
    if (existing.case_type !== input.caseType) return NextResponse.json({ error: 'A saved case cannot change Capital paths.' }, { status: 409 })
  } else {
    const result = await admin.from('capital_cases').select('*').eq('dedupe_key', dedupeKey).maybeSingle()
    if (result.error) return NextResponse.json({ error: 'Unable to check for an existing case.' }, { status: 500 })
    existing = result.data as CapitalCaseRecord | null
    if (existing && !user && !capitalTokenMatches(input.accessToken, (result.data as any).public_token_hash)) {
      return NextResponse.json({
        error: 'A Capital case already exists for this email and path. Use its private resume link or sign in to continue.',
        code: 'existing_case_requires_access',
      }, { status: 409 })
    }
    if (existing && user && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'This Capital case belongs to another account.' }, { status: 403 })
    }
  }

  const routingComplete = existing?.case_type === 'capital_provider'
    ? Boolean(existing.lender_id && existing.operator_task_id)
    : Boolean(existing?.lead_id && existing.operator_task_id)
  if (existing && input.idempotencyKey && (existing as CapitalCaseRecord & { idempotency_key?: string }).idempotency_key === input.idempotencyKey && (input.action !== 'submit' || routingComplete)) {
    return NextResponse.json({
      case: publicCase(existing),
      accessToken: user ? null : input.accessToken || null,
      readiness,
      duplicate: true,
    })
  }

  const nextStatus = input.action === 'submit' ? 'submitted' : (existing?.status === 'draft' || !existing ? 'draft' : existing.status)
  const now = new Date().toISOString()
  const recordPayload = {
    ...payload,
    user_id: user?.id || existing?.user_id || null,
    public_token_hash: user ? null : (existing ? undefined : hashCapitalToken(accessToken)),
    dedupe_key: dedupeKey,
    idempotency_key: input.idempotencyKey || undefined,
    status: nextStatus,
    submitted_at: input.action === 'submit' ? existing?.submitted_at || now : existing?.submitted_at || null,
    last_status_changed_at: nextStatus !== existing?.status ? now : existing?.last_status_changed_at || now,
  }

  const result = existing
    ? await admin.from('capital_cases').update(recordPayload).eq('id', existing.id).select('*').single()
    : await admin.from('capital_cases').insert(recordPayload).select('*').single()
  if (result.error || !result.data) {
    if (result.error?.code === '23505' && input.idempotencyKey) {
      const retry = await admin.from('capital_cases').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
      const retryOwnedByUser = Boolean(user && retry.data?.user_id === user.id)
      const retryOwnedByGuest = Boolean(!user && retry.data && capitalTokenMatches(input.accessToken, retry.data.public_token_hash))
      if (retry.data && (retryOwnedByUser || retryOwnedByGuest)) {
        return NextResponse.json({ case: publicCase(retry.data as CapitalCaseRecord), accessToken: user ? null : input.accessToken, duplicate: true })
      }
    }
    console.error('[capital-case] save failed:', result.error)
    return NextResponse.json({ error: 'Unable to save the Capital case right now.' }, { status: 500 })
  }

  let saved = result.data as CapitalCaseRecord
  const eventType = input.action === 'submit'
    ? existing?.status === 'submitted' ? 'operator_routing_retried' : 'case_submitted'
    : existing ? 'draft_updated' : 'draft_created'
  try {
    await recordCapitalCaseEvent({
      caseId: saved.id,
      actorUserId: user?.id,
      eventType,
      fromStatus: existing?.status || null,
      toStatus: saved.status,
      note: input.action === 'submit' ? 'Submitted for VestBlock operator review.' : 'Capital intake saved for continuation.',
      metadata: { readinessScore: saved.readiness_score, readinessTier: saved.readiness_tier },
    })
    if (input.action === 'submit') {
      saved = await submitCapitalCase(saved, {
        caseType: input.caseType,
        fullName: input.fullName,
        email,
        phone: input.phone,
        organizationName: input.organizationName,
        amountRequested: input.amountRequested,
        purpose: input.purpose,
        timing: input.timing,
        geography: input.geography,
        communicationPreference: input.communicationPreference,
        analysisConsent: input.analysisConsent,
        providerSharingConsent: input.providerSharingConsent,
        marketingConsent: input.marketingConsent,
        intakeData: input.intakeData,
        availableDocuments: input.availableDocuments,
      }, user)
    }
  } catch (error) {
    console.error('[capital-case] lifecycle follow-up pending:', error)
    await recordCapitalCaseEvent({
      caseId: saved.id,
      actorUserId: user?.id,
      eventType: input.action === 'submit' ? 'operator_routing_pending' : 'case_history_pending',
      fromStatus: saved.status,
      toStatus: saved.status,
      note: input.action === 'submit'
        ? 'The case is safely submitted. Internal routing needs operator attention; no provider application was sent.'
        : 'The draft is safely saved. Its activity history needs internal attention.',
    }).catch(() => null)
    return NextResponse.json({
      case: publicCase(saved),
      accessToken: user ? null : accessToken,
      readiness,
      duplicate: Boolean(existing),
      operationPending: true,
      routingPending: input.action === 'submit',
      message: input.action === 'submit'
        ? 'Your case is saved and submitted. VestBlock is resolving an internal routing delay; no provider application was sent.'
        : 'Your draft is safely saved. VestBlock is resolving an internal history delay.',
    }, { status: 202 })
  }

  return NextResponse.json({
    case: publicCase(saved),
    accessToken: user ? null : accessToken,
    readiness,
    duplicate: Boolean(existing),
  })
}
