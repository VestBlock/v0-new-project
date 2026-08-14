export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/admin'
import { participantNormalizationDecisionSchema, participantProfileCreateSchema } from '@/lib/participant-profiles/schemas'
import {
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; normalizationId: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'participant-normalization-decision', maxRequests: 30 })
  if (guard) return guard
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const parsed = participantNormalizationDecisionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Choose approve or reject and check any corrections.' }, { status: 400 })
  const { id, normalizationId } = await context.params
  try {
    const profile = await getOwnedParticipantProfile(id, user.id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    if (profile.profile_version !== parsed.data.expectedVersion) {
      return privateJson({ error: 'This profile changed in another session. Reload before reviewing the proposal.', code: 'stale_version' }, { status: 409 })
    }
    const admin = createAdminClient()
    const { data: normalization, error } = await admin
      .from('participant_profile_normalizations')
      .select('*')
      .eq('id', normalizationId)
      .eq('participant_profile_id', profile.id)
      .eq('owner_user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!normalization) return privateJson({ error: 'AI proposal not found.' }, { status: 404 })
    if (normalization.status !== 'proposed') {
      return privateJson({ error: 'This proposal has already been decided.' }, { status: 409 })
    }

    if (parsed.data.action === 'reject') {
      const { error: rejectError } = await admin.from('participant_profile_normalizations').update({
        status: 'rejected',
        user_corrections_json: parsed.data.corrections,
        rejected_at: new Date().toISOString(),
      }).eq('id', normalization.id).eq('status', 'proposed')
      if (rejectError) throw rejectError
      await recordParticipantEvent({
        profileId: profile.id,
        actorUserId: user.id,
        actorKind: 'customer',
        eventType: 'normalization_rejected',
        fromStatus: profile.status,
        toStatus: profile.status,
        note: 'The AI proposal was rejected. No profile fields changed.',
      })
      return privateJson({ rejected: true })
    }

    const proposal = normalization.proposed_json as { criteria?: Record<string, unknown>; summary?: string } | null
    const criteria = {
      ...profile.criteria_json,
      ...(proposal?.criteria || {}),
      ...parsed.data.corrections,
    }
    const validation = participantProfileCreateSchema.safeParse({
      role: profile.role,
      identityType: profile.identity_type,
      displayName: profile.display_name,
      organizationName: profile.organization_name,
      contactEmail: profile.contact_email,
      contactPhone: profile.contact_phone,
      summary: profile.summary,
      criteria,
      communicationPreferences: profile.communication_preferences_json,
      marketingConsent: profile.marketing_consent,
      matchingConsent: profile.matching_consent,
      outreachConsent: profile.outreach_consent,
      publicVisibilityConsent: profile.public_visibility_consent,
      publicFieldKeys: profile.public_field_keys,
      idempotencyKey: profile.id,
    })
    if (!validation.success) {
      return privateJson({ error: 'The proposal contains fields that do not fit this role. Edit or reject it.', details: validation.error.flatten() }, { status: 422 })
    }
    const { data: approved, error: approvalError } = await admin.rpc('approve_participant_normalization', {
      p_normalization_id: normalization.id,
      p_profile_id: profile.id,
      p_owner_user_id: user.id,
      p_expected_version: profile.profile_version,
      p_approved_json: validation.data.criteria,
      p_corrections_json: parsed.data.corrections,
    })
    if (approvalError) {
      if (approvalError.message.includes('stale_version')) {
        return privateJson({ error: 'This profile changed in another session. Reload before approving the proposal.', code: 'stale_version' }, { status: 409 })
      }
      throw approvalError
    }
    const refreshed = await getOwnedParticipantProfile(profile.id, user.id)
    if (!refreshed) throw new Error('Approved profile could not be reloaded.')
    let saved = refreshed
    if (refreshed.status === 'pending_review') {
      try {
        await ensureParticipantReviewTask(refreshed)
        saved = await getOwnedParticipantProfile(profile.id, user.id) || refreshed
      } catch (routingError) {
        console.error('[participant-profile] normalized profile operator routing pending', routingError)
        await admin.from('participant_profiles').update({
          safe_failure_state: 'operator_routing_pending',
          safe_failure_message: 'The approved criteria are saved. Operator routing needs a retry.',
        }).eq('id', profile.id)
        saved = await getOwnedParticipantProfile(profile.id, user.id) || refreshed
      }
    }
    return privateJson({
      profile: customerParticipantProfile(saved as ParticipantProfileRecord),
      normalization: approved,
      approved: true,
    })
  } catch (error) {
    console.error('[participant-profile] normalization decision failed', error)
    return privateJson({ error: 'The proposal decision could not be saved. Please try again.' }, { status: 500 })
  }
}
