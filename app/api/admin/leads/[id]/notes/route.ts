export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { addLeadNoteSchema } from '@/lib/leads/schemas'
import { addLeadNoteAndLog } from '@/lib/leads/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = addLeadNoteSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const saved = await addLeadNoteAndLog(id, user?.id || null, parsed.data.note)
    return NextResponse.json({ success: true, note: saved })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add note.' },
      { status: 500 }
    )
  }
}
