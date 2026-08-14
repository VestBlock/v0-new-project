export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { reviewOpportunityMatch } from '@/lib/matching/opportunity-matches'
import { guardPublicMutation } from '@/lib/security/public-mutation'

const schema = z.object({
  status: z.enum(['approved', 'dismissed', 'deferred', 'needs_information']),
  note: z.string().trim().max(2000).optional(),
  correction: z.record(z.string(), z.unknown()).optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'opportunity-match-review', maxRequests: 80 })
  if (guard) return guard
  const admin = await checkAdminAccess()
  if (!admin.isAdmin || !admin.user) return NextResponse.json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid review decision.' }, { status: 400 })
  if (parsed.data.status === 'needs_information' && (!parsed.data.note || parsed.data.note.trim().length < 10)) {
    return NextResponse.json({ error: 'Write a clear customer-facing question before requesting information.' }, { status: 400 })
  }
  const { id } = await context.params
  try {
    return NextResponse.json({ match: await reviewOpportunityMatch({ matchId: id, actorUserId: admin.user.id, ...parsed.data }) }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    console.error('[opportunity-matches] review failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the match decision.' }, { status: 422 })
  }
}
