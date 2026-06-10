export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import {
  researchChecklistListSchema,
  researchChecklistPatchSchema,
  researchChecklistUpsertSchema,
} from '@/lib/osint/schemas'
import { listResearchChecklists, upsertResearchChecklist } from '@/lib/osint/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const parsed = researchChecklistListSchema.safeParse({
    search: searchParams.get('search'),
    entityType: searchParams.get('entity_type') || 'all',
    city: searchParams.get('city'),
    state: searchParams.get('state'),
    recommendedLane: searchParams.get('recommended_lane') || 'all',
    outreachStatus: searchParams.get('outreach_status') || 'all',
    minConfidence: searchParams.get('min_confidence') || undefined,
    page: searchParams.get('page') || '1',
    limit: searchParams.get('limit') || '100',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await listResearchChecklists(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch research checklists.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = researchChecklistUpsertSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const checklist = await upsertResearchChecklist(parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'osint_research_checklist',
      entityId: checklist.id,
      metadata: { action: 'research_checklist_created', entityType: checklist.entity_type },
    })
    return NextResponse.json({ success: true, checklist })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save research checklist.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = researchChecklistPatchSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const checklist = await upsertResearchChecklist(parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'osint_research_checklist',
      entityId: checklist.id,
      metadata: { action: 'research_checklist_updated', outreachStatus: checklist.outreach_status },
    })
    return NextResponse.json({ success: true, checklist })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update research checklist.' }, { status: 500 })
  }
}
