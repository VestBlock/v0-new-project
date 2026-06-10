export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { researchChecklistFromInvestorSchema } from '@/lib/osint/schemas'
import { createResearchChecklistFromInvestor } from '@/lib/osint/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = researchChecklistFromInvestorSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const checklist = await createResearchChecklistFromInvestor(parsed.data.investorId)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'osint_research_checklist',
      entityId: checklist.id,
      metadata: { action: 'research_checklist_created_from_investor', investorId: parsed.data.investorId },
    })
    return NextResponse.json({ success: true, checklist })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create investor research checklist.' }, { status: 500 })
  }
}
