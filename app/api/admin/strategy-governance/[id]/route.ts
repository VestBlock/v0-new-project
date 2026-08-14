export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import { decideStrategyProposal } from '@/lib/strategy/governance'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'strategy-governance-decision', maxRequests: 40 })
  if (guard) return guard
  const admin = await checkAdminAccess()
  if (!admin.isAdmin || !admin.user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  }
  const parsed = z.object({ action: z.enum(['approve', 'reject', 'apply']) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose approve, reject, or apply.' }, { status: 400 })
  const { id } = await context.params
  try {
    const result = await decideStrategyProposal({ id, action: parsed.data.action, actorUserId: admin.user.id })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('[strategy-governance] decision failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record the decision.' }, { status: 500 })
  }
}
