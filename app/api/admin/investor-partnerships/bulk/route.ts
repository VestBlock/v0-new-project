export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { investorBulkSchema } from '@/lib/investors/schemas'
import { bulkUpdateInvestors } from '@/lib/investors/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = investorBulkSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await bulkUpdateInvestors({
      investorIds: parsed.data.investorIds,
      action: parsed.data.action,
      actorUserId: user?.id,
    })

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'investor_profile',
      metadata: { action: `investor_bulk_${parsed.data.action}`, count: parsed.data.investorIds.length },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor bulk action failed.' }, { status: 500 })
  }
}
