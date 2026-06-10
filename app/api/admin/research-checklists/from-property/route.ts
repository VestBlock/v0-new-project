export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { researchChecklistFromPropertySchema } from '@/lib/osint/schemas'
import { createResearchChecklistFromProperty } from '@/lib/osint/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = researchChecklistFromPropertySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const checklist = await createResearchChecklistFromProperty(parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'osint_research_checklist',
      entityId: checklist.id,
      metadata: { action: 'research_checklist_created_from_property', sourceType: parsed.data.sourceType },
    })
    return NextResponse.json({ success: true, checklist })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create property research checklist.' }, { status: 500 })
  }
}
