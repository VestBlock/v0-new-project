export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/auth/admin'
import { participantAdminActionSchema } from '@/lib/participant-profiles/schemas'
import {
  getParticipantProfile,
  listOperatorDirectory,
  loadParticipantEvents,
  recordParticipantEvent,
  type ParticipantProfileRecord,
} from '@/lib/participant-profiles/server'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import { createAdminClient } from '@/lib/supabase/admin'

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

async function requireAdmin() {
  const access = await checkAdminAccess()
  if (!access.isAdmin) {
    return {
      access,
      response: privateJson({ error: access.user ? 'Admin access required.' : 'Authentication required.' }, { status: access.user ? 403 : 401 }),
    }
  }
  return { access, response: null }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { access, response } = await requireAdmin()
  if (response) return response
  const { id } = await context.params
  try {
    const profile = await getParticipantProfile(id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    const admin = createAdminClient()
    const [events, operators, userResult] = await Promise.all([
      loadParticipantEvents(profile.id, false),
      listOperatorDirectory(),
      admin.auth.admin.getUserById(profile.owner_user_id),
    ])
    return privateJson({
      profile,
      events,
      operators,
      owner: {
        id: profile.owner_user_id,
        email: userResult.data.user?.email || profile.contact_email,
        name: userResult.data.user?.user_metadata?.full_name || profile.display_name,
        accountHref: '/admin-panel/users/' + profile.owner_user_id,
      },
      requestedBy: access.user?.email || null,
    })
  } catch (error) {
    console.error('[participant-profile-admin] detail failed', error)
    return privateJson({ error: 'This participant profile is temporarily unavailable.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'admin-participant-profile-action', maxRequests: 120 })
  if (guard) return guard
  const { access, response } = await requireAdmin()
  if (response) return response
  const parsed = participantAdminActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Check the operator action and try again.', details: parsed.error.flatten() }, { status: 400 })
  const { id } = await context.params
  try {
    const profile = await getParticipantProfile(id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    if (profile.profile_version !== parsed.data.expectedVersion) {
      return privateJson({ error: 'This profile changed in another session. Reload before continuing.', code: 'stale_version' }, { status: 409 })
    }
    const input = parsed.data
    const reasonRequired = ['request_information', 'decline', 'pause', 'archive', 'link_legacy'].includes(input.action)
    if (reasonRequired && input.reason.length < 5) {
      return privateJson({ error: 'Add a clear reason before completing this operator action.' }, { status: 422 })
    }
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      profile_version: profile.profile_version + 1,
      safe_failure_state: null,
      safe_failure_message: null,
    }
    let targetStatus = profile.status
    let customerNote = input.reason
    let customerVisible = true

    if (input.action === 'assign') {
      if (!input.assignedOperatorEmail) return privateJson({ error: 'Choose an operator by name or email.' }, { status: 422 })
      const operators = await listOperatorDirectory()
      const operator = operators.find((item) => item.email === input.assignedOperatorEmail?.toLowerCase())
      if (!operator) return privateJson({ error: 'Choose an authorized operator from the directory.' }, { status: 422 })
      update.assigned_to = operator.id
      customerNote = 'A VestBlock operator has been assigned to review this profile.'
      if (profile.operator_task_id) await admin.from('admin_tasks').update({ assigned_to: operator.id }).eq('id', profile.operator_task_id)
    }
    if (input.action === 'request_information') {
      if (!['pending_review', 'active', 'needs_information'].includes(profile.status)) {
        return privateJson({ error: 'Information can be requested only during review or from an active profile.' }, { status: 409 })
      }
      targetStatus = 'needs_information'
      update.status = targetStatus
      update.last_review_reason = input.reason
    }
    if (input.action === 'approve') {
      if (!['pending_review', 'needs_information', 'paused'].includes(profile.status)) {
        return privateJson({ error: 'Only a review, information, or paused profile can be approved.' }, { status: 409 })
      }
      targetStatus = 'active'
      update.status = targetStatus
      update.activated_at = profile.activated_at || now
      update.last_verified_at = now
      update.operator_verified_at = now
      update.operator_verification_note = input.reason || 'Criteria reviewed for profile activation. This does not verify proof of funds, licensing, insurance, pricing, or availability.'
      update.last_review_reason = input.reason || null
      customerNote = input.reason || 'VestBlock completed the profile review and activated the profile.'
    }
    if (input.action === 'decline') {
      if (!['pending_review', 'needs_information'].includes(profile.status)) {
        return privateJson({ error: 'Only a profile under review can be declined.' }, { status: 409 })
      }
      targetStatus = 'declined'
      update.status = targetStatus
      update.last_review_reason = input.reason
    }
    if (input.action === 'pause') {
      if (!['active', 'pending_review', 'needs_information'].includes(profile.status)) {
        return privateJson({ error: 'This profile cannot be paused from its current status.' }, { status: 409 })
      }
      targetStatus = 'paused'
      update.status = targetStatus
      update.paused_at = now
      update.last_review_reason = input.reason
    }
    if (input.action === 'archive') {
      if (profile.status === 'archived') return privateJson({ error: 'This profile is already archived.' }, { status: 409 })
      targetStatus = 'archived'
      update.status = targetStatus
      update.archived_at = now
      update.last_review_reason = input.reason
      update.public_visibility_consent = false
      update.public_visibility_consented_at = null
      update.public_visibility_consent_version = null
      update.public_slug = null
    }
    if (input.action === 'link_legacy') {
      if (!input.legacyEntityType || !input.legacyEntityId) {
        return privateJson({ error: 'Choose the verified legacy record type and ID.' }, { status: 422 })
      }
      const { data: legacy, error: legacyError } = await admin
        .from(input.legacyEntityType)
        .select('id')
        .eq('id', input.legacyEntityId)
        .maybeSingle()
      if (legacyError) throw legacyError
      if (!legacy) return privateJson({ error: 'The verified legacy record was not found.' }, { status: 404 })
      const { data: duplicate } = await admin.from('participant_profiles')
        .select('id')
        .eq('legacy_entity_type', input.legacyEntityType)
        .eq('legacy_entity_id', input.legacyEntityId)
        .neq('id', profile.id)
        .maybeSingle()
      if (duplicate) return privateJson({ error: 'That legacy record is already linked to another participant profile.' }, { status: 409 })
      update.legacy_entity_type = input.legacyEntityType
      update.legacy_entity_id = input.legacyEntityId
      update.legacy_claim_status = 'verified'
      update.operator_verification_note = input.reason
      customerVisible = false
      customerNote = 'Legacy record linkage verified by an operator.'
    }

    const { data, error } = await admin.from('participant_profiles')
      .update(update)
      .eq('id', profile.id)
      .eq('profile_version', profile.profile_version)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return privateJson({ error: 'This profile changed in another session. Reload before continuing.', code: 'stale_version' }, { status: 409 })

    if (profile.operator_task_id) {
      if (['approve', 'decline', 'archive'].includes(input.action)) {
        await admin.from('admin_tasks').update({ status: 'completed', completed_at: now }).eq('id', profile.operator_task_id)
      } else if (['request_information', 'pause'].includes(input.action)) {
        await admin.from('admin_tasks').update({ status: 'waiting' }).eq('id', profile.operator_task_id)
      }
    }
    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: access.user?.id,
      actorKind: 'operator',
      eventType: 'operator_' + input.action,
      fromStatus: profile.status,
      toStatus: targetStatus,
      note: customerNote || null,
      customerVisible,
      metadata: input.action === 'link_legacy'
        ? { legacyEntityType: input.legacyEntityType, legacyEntityId: input.legacyEntityId }
        : {},
    })
    return privateJson({ profile: data as ParticipantProfileRecord })
  } catch (error) {
    console.error('[participant-profile-admin] action failed', error)
    return privateJson({ error: 'The operator action could not be completed. Please try again.' }, { status: 500 })
  }
}
