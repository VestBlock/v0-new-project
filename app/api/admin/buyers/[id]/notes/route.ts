export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { addBuyerNoteSchema } from '@/lib/buyers/schemas'
import { addBuyerNoteAndLog } from '@/lib/buyers/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = addBuyerNoteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const note = await addBuyerNoteAndLog(id, user?.id || null, parsed.data.note)
    return NextResponse.json({ success: true, note })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add buyer note.' }, { status: 500 })
  }
}
