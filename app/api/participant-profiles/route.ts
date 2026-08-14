export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/admin'
import { participantProfileCreateSchema } from '@/lib/participant-profiles/schemas'
import {
  consentUpdate,
  customerParticipantProfile,
  findAccountProfile,
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

export async function GET() {
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('participant_profiles')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('origin', 'customer')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return privateJson({ profiles: (data || []).map((profile) => customerParticipantProfile(profile as ParticipantProfileRecord)) })
  } catch (error) {
    console.error('[participant-profile] list failed', error)
    return privateJson({ error: 'Your participant profiles are temporarily unavailable.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = guardPublicMutation(request, { scope: 'participant-profile-create', maxRequests: 20 })
  if (guard) return guard
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const parsed = participantProfileCreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return privateJson({ error: 'Check the highlighted profile fields and try again.', details: parsed.error.flatten() }, { status: 400 })
  }
  const input = parsed.data
  const admin = createAdminClient()
  try {
    const { data: existing, error: lookupError } = await admin
      .from('participant_profiles')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('role', input.role)
      .eq('origin', 'customer')
      .maybeSingle()
    if (lookupError) throw lookupError
    if (existing) {
      if (existing.idempotency_key === input.idempotencyKey) {
        return privateJson({ profile: customerParticipantProfile(existing as ParticipantProfileRecord), duplicate: true })
      }
      return privateJson({
        error: 'This account already has a ' + input.role.replaceAll('_', ' ') + ' profile. Open it from your workspace instead of creating a duplicate.',
        profileId: existing.id,
      }, { status: 409 })
    }

    const accountProfileId = await findAccountProfile(user.id)
    const consents = consentUpdate({
      previous: null,
      marketingConsent: input.marketingConsent,
      matchingConsent: input.matchingConsent,
      outreachConsent: input.outreachConsent,
      publicVisibilityConsent: input.publicVisibilityConsent,
    })
    const { data, error } = await admin.from('participant_profiles').insert({
      owner_user_id: user.id,
      role: input.role,
      origin: 'customer',
      status: 'draft',
      identity_type: input.identityType,
      display_name: input.displayName,
      organization_name: input.organizationName,
      contact_email: input.contactEmail.toLowerCase(),
      contact_phone: input.contactPhone,
      summary: input.summary,
      criteria_json: input.criteria,
      communication_preferences_json: input.communicationPreferences,
      public_slug: input.publicVisibilityConsent ? makePublicSlug(input.role) : null,
      public_field_keys: input.publicFieldKeys,
      account_profile_id: accountProfileId,
      idempotency_key: input.idempotencyKey,
      ...consents,
    }).select('*').single()
    if (error || !data) {
      if (error?.code === '23505') {
        return privateJson({ error: 'A profile for this role already exists or this request was already processed.' }, { status: 409 })
      }
      throw error || new Error('Participant profile was not saved.')
    }
    await recordParticipantEvent({
      profileId: data.id,
      actorUserId: user.id,
      actorKind: 'customer',
      eventType: 'profile_created',
      fromStatus: null,
      toStatus: 'draft',
      note: 'Profile draft created.',
      metadata: { role: input.role, origin: 'customer' },
    })
    return privateJson({ profile: customerParticipantProfile(data as ParticipantProfileRecord) }, { status: 201 })
  } catch (error) {
    console.error('[participant-profile] create failed', error)
    return privateJson({ error: 'Your profile could not be saved. Please try again.' }, { status: 500 })
  }
}
