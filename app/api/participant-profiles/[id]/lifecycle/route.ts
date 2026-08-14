export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/admin'
import { participantLifecycleSchema, validateCompleteProfile } from '@/lib/participant-profiles/schemas'
import {
  customerLifecycleTarget,
  customerParticipantProfile,
  ensureParticipantReviewTask,
  getOwnedParticipantProfile,
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'participant-profile-lifecycle', maxRequests: 30 })
  if (guard) return guard
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const parsed = participantLifecycleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Choose a valid profile action.' }, { status: 400 })
  const { id } = await context.params
  try {
    const profile = await getOwnedParticipantProfile(id, user.id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    if (profile.profile_version !== parsed.data.expectedVersion) {
      return privateJson({ error: 'This profile changed in another session. Reload before continuing.', code: 'stale_version' }, { status: 409 })
    }
    if (parsed.data.action === 'submit') {
      const readiness = validateCompleteProfile({
        role: profile.role,
        displayName: profile.display_name,
        contactEmail: profile.contact_email,
        criteria: profile.criteria_json,
      })
      if (!readiness.complete) {
        return privateJson({ error: 'Complete these required fields before review: ' + readiness.missing.join(', ') + '.', missing: readiness.missing }, { status: 422 })
      }
    }
    const target = customerLifecycleTarget(profile, parsed.data.action)
    if (!target) {
      return privateJson({ error: 'This action is not available while the profile is ' + profile.status.replaceAll('_', ' ') + '.' }, { status: 409 })
    }
    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      status: target,
      profile_version: profile.profile_version + 1,
      last_review_reason: null,
      safe_failure_state: null,
      safe_failure_message: null,
    }
    if (parsed.data.action === 'submit') update.submitted_at = profile.submitted_at || now
    if (parsed.data.action === 'pause') update.paused_at = now
    if (parsed.data.action === 'reactivate') update.paused_at = null
    if (parsed.data.action === 'withdraw') {
      update.withdrawn_at = now
      update.public_visibility_consent = false
      update.public_visibility_consented_at = null
      update.public_visibility_consent_version = null
      update.public_slug = null
    }
    const admin = createAdminClient()
    const { data, error } = await admin.from('participant_profiles')
      .update(update)
      .eq('id', profile.id)
      .eq('owner_user_id', user.id)
      .eq('profile_version', profile.profile_version)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return privateJson({ error: 'This profile changed in another session. Reload before continuing.', code: 'stale_version' }, { status: 409 })

    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: user.id,
      actorKind: 'customer',
      eventType: 'profile_' + parsed.data.action,
      fromStatus: profile.status,
      toStatus: target,
      note: parsed.data.action === 'submit'
        ? 'Submitted for VestBlock review.'
        : parsed.data.action === 'pause'
          ? 'Profile paused by the customer.'
          : parsed.data.action === 'reactivate'
            ? 'Profile reactivated by the customer.'
            : 'Profile withdrawn by the customer.',
    })

    if (parsed.data.action === 'withdraw' && profile.operator_task_id) {
      await admin.from('admin_tasks').update({ status: 'completed', completed_at: now }).eq('id', profile.operator_task_id)
    }
    if (parsed.data.action === 'pause' && profile.operator_task_id) {
      await admin.from('admin_tasks').update({ status: 'waiting' }).eq('id', profile.operator_task_id)
    }

    let saved = data as ParticipantProfileRecord
    if (target === 'pending_review') {
      try {
        const qaFailureToken = process.env.PARTICIPANT_PROFILE_QA_ROUTING_FAILURE_TOKEN
        if (qaFailureToken && request.headers.get('x-vestblock-qa-routing-failure') === qaFailureToken) {
          throw new Error('Gate 4E.2 controlled operator-routing failure.')
        }
        await ensureParticipantReviewTask(saved)
        const refreshed = await getOwnedParticipantProfile(profile.id, user.id)
        if (refreshed) saved = refreshed
      } catch (routingError) {
        console.error('[participant-profile] operator routing pending', routingError)
        await admin.from('participant_profiles').update({
          safe_failure_state: 'operator_routing_pending',
          safe_failure_message: 'The profile is saved. Operator routing needs a retry.',
        }).eq('id', profile.id)
        await recordParticipantEvent({
          profileId: profile.id,
          actorUserId: user.id,
          actorKind: 'system',
          eventType: 'operator_routing_pending',
          fromStatus: target,
          toStatus: target,
          note: 'The profile is saved and operator routing is pending. No matching or outreach started.',
          customerVisible: true,
        })
        const recoverable = await getOwnedParticipantProfile(profile.id, user.id)
        return privateJson({
          profile: customerParticipantProfile(recoverable || saved),
          warning: 'Your profile is saved. VestBlock operator routing is pending and can be retried safely.',
        }, { status: 202 })
      }
    }
    return privateJson({ profile: customerParticipantProfile(saved) })
  } catch (error) {
    console.error('[participant-profile] lifecycle failed', error)
    return privateJson({ error: 'The profile action could not be completed. Please try again.' }, { status: 500 })
  }
}
