export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { checkAdminAccess } from '@/lib/auth/admin'
import { applyStrategyUpdateById } from '@/lib/improvement/continuous-improvement'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin || !adminCheck.user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: adminCheck.user ? 403 : 401 })
  }

  const { id } = await context.params

  try {
    const body = await request.json()
    const action = String(body?.action || '')
    if (!['approve', 'reject', 'apply'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
    }

    const update = await applyStrategyUpdateById(id, adminCheck.user.id, action as 'approve' | 'reject' | 'apply')
    return NextResponse.json({ success: true, update })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update strategy item.' },
      { status: 500 }
    )
  }
}
