export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { publicSlugSchema } from '@/lib/participant-profiles/schemas'
import { publicParticipantProfile, type ParticipantProfileRecord } from '@/lib/participant-profiles/server'
import { createAdminClient } from '@/lib/supabase/admin'

function publicResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!publicSlugSchema.safeParse(slug).success) {
    return publicResponse({ error: 'Profile not found.' }, { status: 404 })
  }
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('participant_profiles')
      .select('*')
      .eq('public_slug', slug)
      .eq('origin', 'customer')
      .eq('status', 'active')
      .eq('public_visibility_consent', true)
      .not('public_visibility_consented_at', 'is', null)
      .maybeSingle()
    if (error) throw error
    if (!data) return publicResponse({ error: 'Profile not found.' }, { status: 404 })
    return publicResponse({ profile: publicParticipantProfile(data as ParticipantProfileRecord) })
  } catch (error) {
    console.error('[participant-profile] public lookup failed', error)
    return publicResponse({ error: 'Profile not found.' }, { status: 404 })
  }
}
