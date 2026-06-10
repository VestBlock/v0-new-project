export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { researchChecklistBulkSchema } from '@/lib/osint/schemas'
import { bulkUpdateResearchChecklists } from '@/lib/osint/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = researchChecklistBulkSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await bulkUpdateResearchChecklists(parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'osint_research_checklist',
      metadata: { action: `research_checklist_bulk_${parsed.data.action}`, count: result.count },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Research checklist bulk action failed.' }, { status: 500 })
  }
}
