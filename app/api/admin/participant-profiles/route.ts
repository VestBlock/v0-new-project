export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAccess } from '@/lib/auth/admin'
import { PARTICIPANT_ROLES, PARTICIPANT_STATUSES } from '@/lib/participant-profiles/config'
import { listOperatorDirectory, type ParticipantProfileRecord } from '@/lib/participant-profiles/server'
import { createAdminClient } from '@/lib/supabase/admin'

const querySchema = z.object({
  search: z.string().trim().max(120).default(''),
  role: z.enum(['all', ...PARTICIPANT_ROLES]).default('all'),
  status: z.enum(['all', ...PARTICIPANT_STATUSES]).default('all'),
  origin: z.enum(['all', 'customer', 'operator', 'imported', 'discovered', 'legacy']).default('all'),
}).strict()

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export async function GET(request: NextRequest) {
  const access = await checkAdminAccess()
  if (!access.isAdmin) return privateJson({ error: access.user ? 'Admin access required.' : 'Authentication required.' }, { status: access.user ? 403 : 401 })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return privateJson({ error: 'Check the profile filters.' }, { status: 400 })
  try {
    const admin = createAdminClient()
    let query = admin.from('participant_profiles').select('*').order('updated_at', { ascending: false }).limit(500)
    if (parsed.data.role !== 'all') query = query.eq('role', parsed.data.role)
    if (parsed.data.status !== 'all') query = query.eq('status', parsed.data.status)
    if (parsed.data.origin !== 'all') query = query.eq('origin', parsed.data.origin)
    const [{ data, error }, operators, usersResult] = await Promise.all([
      query,
      listOperatorDirectory(),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    if (error) throw error
    if (usersResult.error) throw usersResult.error
    const users = new Map(usersResult.data.users.map((user) => [user.id, { email: user.email || '', name: user.user_metadata?.full_name || user.email || 'VestBlock member' }]))
    const search = parsed.data.search.toLowerCase()
    const profiles = (data || []).map((profile) => {
      const record = profile as ParticipantProfileRecord
      return {
        ...record,
        owner: users.get(record.owner_user_id) || { email: record.contact_email, name: record.display_name },
        assignedOperator: record.assigned_to ? users.get(record.assigned_to) || null : null,
      }
    }).filter((profile) => {
      if (!search) return true
      return [
        profile.display_name,
        profile.organization_name,
        profile.contact_email,
        profile.role,
        profile.status,
        profile.owner.name,
        profile.owner.email,
      ].some((value) => String(value || '').toLowerCase().includes(search))
    })
    return privateJson({ profiles, operators })
  } catch (error) {
    console.error('[participant-profile-admin] list failed', error)
    return privateJson({ error: 'Participant profiles are temporarily unavailable.' }, { status: 500 })
  }
}
