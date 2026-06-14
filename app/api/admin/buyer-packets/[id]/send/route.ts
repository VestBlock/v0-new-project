export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendBuyerPacketEmail } from '@/lib/buyers/outbound'
import {
  getBuyerPacketById,
  insertBuyerRelationshipEvent,
  updateBuyerPacket,
  updateBuyerRecord,
  updateBuyerMatchStatus,
  upsertBuyerPacketSend,
  upsertDealPipelineItem,
} from '@/lib/buyers/repository'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { buildBuyerPacketFileName, buildPremiumBuyerPacketPdf } from '@/lib/property/buyerPacketPdf'
import { logEvent } from '@/lib/system/logEvent'

const sendSchema = z.object({
  buyerIds: z.array(z.string().uuid()).min(1).max(40).optional(),
  matchIds: z.array(z.string().uuid()).min(1).max(40).optional(),
  sendAllMatches: z.boolean().optional().default(false),
})

function packetEmailSubject(address: string) {
  return `VestBlock buyer packet: ${address}`
}

function packetEmailBody(input: { address: string; buyerName?: string | null; summary?: string | null }) {
  const greeting = input.buyerName ? `Hi ${input.buyerName},` : 'Hi,'
  return [
    greeting,
    '',
    `I attached the VestBlock buyer packet for ${input.address}.`,
    '',
    input.summary ||
      'It includes the current screening numbers, route notes, comp/listing context, risk flags, and the next diligence items we need confirmed.',
    '',
    'There may be room in the economics depending on condition, access, title, occupancy, and timeline. If this fits your box, reply with your interest level, rough price range, close timeline, and any diligence questions you want answered first.',
    '',
    'Best,',
    'VestBlock Acquisitions',
  ].join('\n')
}

function metadataMatchIds(value: unknown) {
  const raw = (value as Record<string, unknown> | null | undefined)?.matchIds
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = sendSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const packet = await getBuyerPacketById(id)
    const requestedMatchIds = parsed.data.matchIds || []
    const requestedBuyerIds = parsed.data.buyerIds || []
    const packetMatchIds = metadataMatchIds(packet.metadata_json)
    const matchIds = parsed.data.sendAllMatches && packetMatchIds.length ? packetMatchIds : requestedMatchIds

    let query = admin
      .from('buyer_matches')
      .select('*, buyers(*)')
      .order('confidence_score', { ascending: false })
      .limit(40)

    if (matchIds.length) query = query.in('id', matchIds)
    else if (requestedBuyerIds.length) query = query.in('buyer_id', requestedBuyerIds)
    else if (packetMatchIds.length) query = query.in('id', packetMatchIds)
    else query = query.eq('property_address', packet.property_address)

    const { data: matches, error: matchError } = await query
    if (matchError) throw matchError

    const rows = (matches || []).filter((match: any) => match.buyers)
    if (!rows.length) {
      return NextResponse.json({ error: 'No matched buyers were found for this packet.' }, { status: 404 })
    }

    await updateBuyerPacket(packet.id, { status: 'sending' })
    const pdf = await buildPremiumBuyerPacketPdf({
      reportType: 'buyer',
      address: packet.property_address,
      form: packet.input_json,
      estimate: packet.estimate_json,
      opportunity: packet.opportunity_json,
    })
    const filename = packet.file_name || buildBuyerPacketFileName(packet.property_address)
    const subject = packetEmailSubject(packet.property_address)
    const results: Array<{ buyerId: string; matchId: string; ok: boolean; provider?: string; error?: string }> = []
    let sentCount = 0

    for (const match of rows as any[]) {
      const buyer = match.buyers
      const email = buyer.contact_email?.trim() || ''

      if (!isUsableContactEmail(email)) {
        await upsertBuyerPacketSend({
          buyerPacketId: packet.id,
          buyerId: buyer.id,
          buyerMatchId: match.id,
          buyerEmail: email || null,
          subject,
          status: 'failed',
          sendError: 'Buyer does not have a usable email.',
          metadata: { confidenceScore: match.confidence_score },
        })
        results.push({ buyerId: buyer.id, matchId: match.id, ok: false, error: 'Buyer does not have a usable email.' })
        continue
      }

      const body = packetEmailBody({
        address: packet.property_address,
        buyerName: buyer.contact_name || buyer.name,
        summary: packet.summary,
      })
      const sendResult = await sendBuyerPacketEmail({
        buyer,
        subject,
        body,
        attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
      })

      await upsertBuyerPacketSend({
        buyerPacketId: packet.id,
        buyerId: buyer.id,
        buyerMatchId: match.id,
        buyerEmail: email,
        subject,
        status: sendResult.ok ? 'sent' : 'failed',
        sendProvider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        sentAt: sendResult.ok ? new Date().toISOString() : null,
        sendError: sendResult.error || null,
        metadata: {
          confidenceScore: match.confidence_score,
          providerMessageId: sendResult.providerMessageId || null,
        },
      })

      if (!sendResult.ok) {
        results.push({ buyerId: buyer.id, matchId: match.id, ok: false, provider: sendResult.provider, error: sendResult.error })
        continue
      }

      sentCount += 1
      await updateBuyerMatchStatus(match.id, {
        status: 'shared',
        metadata_json: {
          ...(match.metadata_json || {}),
          lastPacketId: packet.id,
          lastPacketSentAt: new Date().toISOString(),
          lastPacketSubject: subject,
        },
      })
      await updateBuyerRecord(buyer.id, {
        relationship_stage: buyer.relationship_stage === 'active_buyer' ? 'active_buyer' : 'contacted',
        outreach_status: buyer.outreach_status === 'do_not_contact' ? buyer.outreach_status : 'sent',
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      })
      await insertBuyerRelationshipEvent({
        buyerId: buyer.id,
        eventType: 'buyer_packet_sent',
        actorUserId: user?.id || null,
        metadata: {
          packetId: packet.id,
          matchId: match.id,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId || null,
          propertyAddress: packet.property_address,
        },
      })
      results.push({ buyerId: buyer.id, matchId: match.id, ok: true, provider: sendResult.provider })
    }

    const failedCount = results.filter((item) => !item.ok).length
    const nextStatus = sentCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'sent'
    const updatedPacket = await updateBuyerPacket(packet.id, {
      status: nextStatus,
      selected_buyer_count: rows.length,
      sent_count: sentCount,
      last_sent_at: sentCount > 0 ? new Date().toISOString() : packet.last_sent_at,
    })

    await upsertDealPipelineItem({
      propertyAnalysisRunId: packet.property_analysis_run_id,
      buyerPacketId: packet.id,
      propertyAddress: packet.property_address,
      city: packet.city,
      state: packet.state,
      zipCode: packet.zip_code,
      currentStage: sentCount > 0 ? 'buyer_packet_sent' : 'analyzed',
      priority: sentCount > 0 ? 'high' : 'normal',
      dealGrade: String((packet.opportunity_json as any)?.dealMath?.grade || ''),
      dealStrengthScore: numberOrNull((packet.opportunity_json as any)?.dealStrength?.score),
      buyerPacketSentCount: sentCount,
      estimatedAssignmentFee: numberOrNull((packet.opportunity_json as any)?.dealMath?.assignmentFee),
      expectedProfit: numberOrNull((packet.opportunity_json as any)?.dealMath?.endBuyerProfit),
      nextAction:
        sentCount > 0
          ? 'Watch buyer replies and move interested buyers into assignment terms.'
          : 'Fix buyer email coverage, then resend this packet.',
      nextActionAt: sentCount > 0 ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() : null,
      metadata: {
        packetStatus: nextStatus,
        sendResults: results,
      },
    })

    await logEvent({
      eventType: 'buyer_packet_sent',
      actorUserId: user?.id,
      entityType: 'buyer_packet',
      entityId: packet.id,
      metadata: { sentCount, failedCount, propertyAddress: packet.property_address },
    })

    return NextResponse.json({
      packet: updatedPacket,
      sentCount,
      failedCount,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send buyer packet.' },
      { status: 500 }
    )
  }
}
