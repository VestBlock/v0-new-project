export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/admin'
import { participantProfileCreateSchema, participantProfilePatchSchema } from '@/lib/participant-profiles/schemas'
import {
  canCustomerEdit,
  consentUpdate,
  customerParticipantEvent,
  customerParticipantProfile,
  ensureParticipantReviewTask,
  getOwnedParticipantProfile,
  loadParticipantEvents,
  makePublicSlug,
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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await context.params
  try {
    const profile = await getOwnedParticipantProfile(id, user.id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    const events = await loadParticipantEvents(profile.id, true)
    const admin = createAdminClient()
    const { data: normalizations, error } = await admin
      .from('participant_profile_normalizations')
      .select('id,original_text,proposed_json,provider_model,status,user_corrections_json,approved_json,failure_code,failure_message,proposed_at,approved_at,rejected_at')
      .eq('participant_profile_id', profile.id)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return privateJson({
      profile: customerParticipantProfile(profile),
      events: events.map(customerParticipantEvent),
      normalizations: normalizations || [],
    })
  } catch (error) {
    console.error('[participant-profile] detail failed', error)
    return privateJson({ error: 'This participant profile is temporarily unavailable.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'participant-profile-update', maxRequests: 60 })
  if (guard) return guard
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const parsed = participantProfilePatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return privateJson({ error: 'Check the highlighted profile fields and try again.', details: parsed.error.flatten() }, { status: 400 })
  }
  const { id } = await context.params
  try {
    const profile = await getOwnedParticipantProfile(id, user.id)
    if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
    if (!canCustomerEdit(profile.status)) {
      return privateJson({ error: 'This profile is no longer editable. Contact VestBlock if the status needs review.' }, { status: 409 })
    }
    if (profile.profile_version !== parsed.data.expectedVersion) {
      return privateJson({ error: 'This profile changed in another session. Reload before saving again.', code: 'stale_version' }, { status: 409 })
    }

    const input = parsed.data
    const merged = {
      role: profile.role,
      identityType: input.identityType ?? profile.identity_type,
      displayName: input.displayName ?? profile.display_name,
      organizationName: input.organizationName ?? profile.organization_name,
      contactEmail: input.contactEmail ?? profile.contact_email,
      contactPhone: input.contactPhone ?? profile.contact_phone,
      summary: input.summary ?? profile.summary,
      criteria: input.criteria ?? profile.criteria_json,
      communicationPreferences: input.communicationPreferences ?? profile.communication_preferences_json,
      marketingConsent: input.marketingConsent ?? profile.marketing_consent,
      matchingConsent: input.matchingConsent ?? profile.matching_consent,
      outreachConsent: input.outreachConsent ?? profile.outreach_consent,
      publicVisibilityConsent: input.publicVisibilityConsent ?? profile.public_visibility_consent,
      publicFieldKeys: input.publicFieldKeys ?? profile.public_field_keys,
      idempotencyKey: profile.idempotency_key,
    }
    const fullValidation = participantProfileCreateSchema.safeParse(merged)
    if (!fullValidation.success) {
      return privateJson({ error: 'One or more fields are not valid for this role.', details: fullValidation.error.flatten() }, { status: 400 })
    }
    const valid = fullValidation.data
    const publicVisible = valid.publicVisibilityConsent
    const materialChange = Boolean(
      input.criteria
      || input.summary !== undefined
      || input.displayName !== undefined
      || input.organizationName !== undefined
      || input.publicFieldKeys !== undefined
    )
    const needsReview = profile.status === 'active' && materialChange
    const update = {
      identity_type: valid.identityType,
      display_name: valid.displayName,
      organization_name: valid.organizationName,
      contact_email: valid.contactEmail.toLowerCase(),
      contact_phone: valid.contactPhone,
      summary: valid.summary,
      criteria_json: valid.criteria,
      communication_preferences_json: valid.communicationPreferences,
      public_field_keys: valid.publicFieldKeys,
      public_slug: publicVisible ? profile.public_slug || makePublicSlug(profile.role) : null,
      status: needsReview ? 'pending_review' : profile.status,
      submitted_at: needsReview ? new Date().toISOString() : profile.submitted_at,
      last_verified_at: materialChange ? null : profile.last_verified_at,
      profile_version: profile.profile_version + 1,
      ...consentUpdate({
        previous: profile,
        marketingConsent: input.marketingConsent,
        matchingConsent: input.matchingConsent,
        outreachConsent: input.outreachConsent,
        publicVisibilityConsent: input.publicVisibilityConsent,
      }),
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
    if (!data) return privateJson({ error: 'This profile changed in another session. Reload before saving again.', code: 'stale_version' }, { status: 409 })
    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: user.id,
      actorKind: 'customer',
      eventType: 'profile_updated',
      fromStatus: profile.status,
      toStatus: data.status,
      note: 'Profile details and permissions updated.',
      metadata: {
        visibilityChanged: profile.public_visibility_consent !== data.public_visibility_consent,
        criteriaChanged: Boolean(input.criteria),
      },
    })
    let saved = data as ParticipantProfileRecord
    if (needsReview) {
      try {
        await ensureParticipantReviewTask(saved)
        const refreshed = await getOwnedParticipantProfile(profile.id, user.id)
        if (refreshed) saved = refreshed
      } catch (routingError) {
        console.error('[participant-profile] edited profile operator routing pending', routingError)
        await admin.from('participant_profiles').update({
          safe_failure_state: 'operator_routing_pending',
          safe_failure_message: 'The profile changes are saved. Operator routing needs a retry.',
        }).eq('id', profile.id)
        const recoverable = await getOwnedParticipantProfile(profile.id, user.id)
        return privateJson({
          profile: customerParticipantProfile(recoverable || saved),
          warning: 'Your changes are saved. VestBlock operator routing is pending and can be retried safely.',
        }, { status: 202 })
      }
    }
    return privateJson({ profile: customerParticipantProfile(saved) })
  } catch (error) {
    console.error('[participant-profile] update failed', error)
    return privateJson({ error: 'Your profile changes could not be saved. Please try again.' }, { status: 500 })
  }
}
