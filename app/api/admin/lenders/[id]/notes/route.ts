export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { addLenderNoteSchema } from '@/lib/lenders/schemas'
import { addLenderNoteAndLog } from '@/lib/lenders/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = addLenderNoteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const note = await addLenderNoteAndLog(id, user?.id || null, parsed.data.note)
    return NextResponse.json({ success: true, note })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add lender note.' }, { status: 500 })
  }
}
