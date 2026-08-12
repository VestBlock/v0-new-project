export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { deliverBuyerPacket } from '@/lib/buyers/packetDelivery'
import { commandCenterDataIntegrityHoldResponse, isCommandCenterDataIntegrityHold } from '@/lib/admin/command-center-data-integrity'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'

const sendSchema = z.object({
  buyerIds: z.array(z.string().uuid()).min(1).max(40).optional(),
  matchIds: z.array(z.string().uuid()).min(1).max(40).optional(),
  sendAllMatches: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = sendSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (!parsed.data.dryRun && await isCommandCenterDataIntegrityHold()) {
      return commandCenterDataIntegrityHoldResponse()
    }

    const { id } = await params
    const result = await deliverBuyerPacket(id, {
      buyerIds: parsed.data.buyerIds,
      matchIds: parsed.data.matchIds,
      sendAllMatches: parsed.data.sendAllMatches,
      actorUserId: user?.id || null,
      dryRun: parsed.data.dryRun,
    })

    if (result.recipientCount === 0) {
      return NextResponse.json(
        { error: 'No unsent matched buyers were eligible for this packet.', ...result },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send buyer packet.' },
      { status: 500 }
    )
  }
}
