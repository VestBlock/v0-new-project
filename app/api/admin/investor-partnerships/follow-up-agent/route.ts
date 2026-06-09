export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { investorFollowUpAgentSchema } from '@/lib/investors/schemas'
import { runInvestorFollowUpAgent } from '@/lib/investors/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = investorFollowUpAgentSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await runInvestorFollowUpAgent({
      investorId: parsed.data.investorId,
      inboundMessage: parsed.data.inboundMessage,
      actorUserId: user?.id,
    })

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'investor_profile',
      entityId: parsed.data.investorId,
      metadata: { action: 'investor_follow_up_agent_routed', tasksCreated: result.tasksCreated },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor follow-up agent failed.' }, { status: 500 })
  }
}
