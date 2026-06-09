export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { investorImportListSchema, investorImportSchema, investorUpdateSchema } from '@/lib/investors/schemas'
import { listInvestorProfiles, updateInvestorProfile, upsertInvestorProfile } from '@/lib/investors/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireLeadAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const result = await listInvestorProfiles({
      search: searchParams.get('search'),
      market: searchParams.get('market'),
      investorType: searchParams.get('investor_type'),
      relationshipStage: searchParams.get('relationship_stage'),
      outreachStatus: searchParams.get('outreach_status'),
      sequence: searchParams.get('sequence'),
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '100', 10),
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch investors.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = Array.isArray(payload)
    ? investorImportListSchema.safeParse(payload)
    : investorImportSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const rows = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
    const investors = await Promise.all(rows.map((row) => upsertInvestorProfile(row)))

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'investor_profile',
      metadata: { action: 'investor_profiles_imported', count: investors.length },
    })

    return NextResponse.json({ success: true, investors })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to import investor profile.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = investorUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const investor = await updateInvestorProfile(parsed.data.id, parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'investor_profile',
      entityId: parsed.data.id,
      metadata: { action: 'investor_profile_updated' },
    })
    return NextResponse.json({ success: true, investor })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update investor.' }, { status: 500 })
  }
}
