export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buyerMatchRequestSchema } from '@/lib/buyers/schemas'
import { persistPropertyBuyerMatches } from '@/lib/buyers/service'
import { createBuyerPacket, upsertDealPipelineItem } from '@/lib/buyers/repository'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { buildBuyerPacketFileName } from '@/lib/property/buyerPacketPdf'
import { logEvent } from '@/lib/system/logEvent'

const packetSchema = z.object({
  propertyAnalysisRunId: z.string().uuid().nullable().optional(),
  address: z.string().trim().min(3).max(260),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(2).nullable().optional(),
  zipCode: z.string().trim().max(20).nullable().optional(),
  form: z.record(z.string(), z.unknown()).default({}),
  estimate: z.record(z.string(), z.unknown()).default({}),
  opportunity: z.record(z.string(), z.unknown()).default({}),
  matchInput: buyerMatchRequestSchema.partial().optional(),
})

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = packetSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const payload = parsed.data
    const opportunity = payload.opportunity as any
    const estimate = payload.estimate as any
    const form = payload.form as Record<string, unknown>
    const matchInput = {
      ...(payload.matchInput || {}),
      propertyAddress: payload.address,
      city: payload.city || payload.matchInput?.city || '',
      state: payload.state || payload.matchInput?.state || '',
      zipCode: payload.zipCode || payload.matchInput?.zipCode || '',
      assetType: String(form.propertyType || payload.matchInput?.assetType || ''),
      occupancy: String(form.occupancyStatus || payload.matchInput?.occupancy || ''),
      askingPrice: numberOrNull(estimate.askingPrice ?? opportunity?.dealMath?.sellerAsk ?? payload.matchInput?.askingPrice) ?? undefined,
      estimatedValue: numberOrNull(opportunity?.metrics?.arv ?? estimate.estimateValue ?? payload.matchInput?.estimatedValue) ?? undefined,
      rehabLevel: numberOrNull(opportunity?.metrics?.repairBudget) ? Math.min(10, Math.max(1, Math.round(Number(opportunity.metrics.repairBudget) / 15000))) : undefined,
      creativeFinanceOpen:
        /creative|seller_finance|subject/i.test(String(form.exitStrategy || form.preferredSalePath || '')) ||
        payload.matchInput?.creativeFinanceOpen,
      marketTag: payload.city || payload.matchInput?.marketTag || undefined,
    }

    const matches = await persistPropertyBuyerMatches(matchInput)
    const matchIds = matches.map((match) => match.id)
    const { data: enrichedMatches } = matchIds.length
      ? await admin.from('buyer_matches').select('*, buyers(id,name,category,contact_email,relationship_stage,confidence_score)').in('id', matchIds)
      : { data: [] as any[] }

    const packet = await createBuyerPacket({
      propertyAnalysisRunId: payload.propertyAnalysisRunId || null,
      propertyAddress: payload.address,
      city: payload.city || null,
      state: payload.state || null,
      zipCode: payload.zipCode || null,
      title: `VestBlock Buyer Packet - ${payload.address}`,
      summary: opportunity?.buyerInterest?.summary || opportunity?.dealStrength?.summary || null,
      fileName: buildBuyerPacketFileName(payload.address),
      selectedBuyerCount: matches.length,
      createdByUserId: user?.id || null,
      form,
      estimate: payload.estimate,
      opportunity: payload.opportunity,
      metadata: {
        matchIds,
        generatedFrom: 'command_center',
      },
    })

    await upsertDealPipelineItem({
      propertyAnalysisRunId: payload.propertyAnalysisRunId || null,
      buyerPacketId: packet.id,
      propertyAddress: payload.address,
      city: payload.city || null,
      state: payload.state || null,
      zipCode: payload.zipCode || null,
      currentStage: 'analyzed',
      priority: opportunity?.dealMath?.grade === 'GOOD' || Number(opportunity?.buyerInterest?.score || 0) >= 70 ? 'high' : 'normal',
      dealGrade: opportunity?.dealMath?.grade || null,
      dealStrengthScore: numberOrNull(opportunity?.dealStrength?.score),
      estimatedAssignmentFee: numberOrNull(opportunity?.dealMath?.assignmentFee),
      expectedProfit: numberOrNull(opportunity?.dealMath?.endBuyerProfit),
      nextAction: matches.length
        ? 'Send the premium buyer packet to the strongest matched buyers.'
        : 'Confirm buy boxes or add more buyer records before sending this packet.',
      metadata: {
        buyerInterest: opportunity?.buyerInterest || null,
        matchCount: matches.length,
      },
    })

    await logEvent({
      eventType: 'buyer_packet_generated',
      actorUserId: user?.id,
      entityType: 'buyer_packet',
      entityId: packet.id,
      metadata: { matchCount: matches.length, propertyAddress: payload.address },
    })

    return NextResponse.json({
      packet,
      matches: enrichedMatches || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create buyer packet.' },
      { status: 500 }
    )
  }
}
