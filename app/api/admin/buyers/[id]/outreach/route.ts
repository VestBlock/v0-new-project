export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { updateBuyerOutreachMessageSchema } from '@/lib/buyers/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBuyerById, insertBuyerRelationshipEvent, updateBuyerOutreachMessage, updateBuyerPerformance, updateBuyerRecord } from '@/lib/buyers/repository'
import { sendBuyerOutreachEmail } from '@/lib/buyers/outbound'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { logEvent } from '@/lib/system/logEvent'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = updateBuyerOutreachMessageSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const admin = createAdminClient()
    const { data: message, error } = await admin
      .from('buyer_outreach_messages')
      .select('*')
      .eq('buyer_id', id)
      .eq('id', parsed.data.messageId)
      .single()

    if (error || !message) {
      return NextResponse.json({ error: 'Buyer outreach message not found.' }, { status: 404 })
    }

    const nextStatus = parsed.data.status || (parsed.data.sendNow ? 'approved' : null)
    if (nextStatus) {
      await updateBuyerOutreachMessage(message.id, {
        status: nextStatus,
        approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
        approved_by_user_id: nextStatus === 'approved' ? user?.id || null : null,
      })
      await updateBuyerRecord(id, {
        outreach_status: nextStatus === 'approved' ? 'approved' : nextStatus === 'archived' ? 'not_started' : 'needs_review',
      })
      await insertBuyerRelationshipEvent({
        buyerId: id,
        eventType: nextStatus === 'approved' ? 'outreach_approved' : 'outreach_archived',
        actorUserId: user?.id || null,
        metadata: { channel: message.channel },
      })
      await logEvent({
        eventType: 'admin_action',
        actorUserId: user?.id,
        entityType: 'buyer',
        entityId: id,
        metadata: { action: nextStatus === 'approved' ? 'buyer_outreach_approved' : 'buyer_outreach_archived' },
      })
    }

    if (parsed.data.sendNow) {
      const detail = await getBuyerById(id)
      const buyer = detail.buyer
      const updatedMessage = detail.outreach.find((item) => item.id === parsed.data.messageId) || message

      if (updatedMessage.status !== 'approved') {
        return NextResponse.json({ error: 'Outreach must be approved before sending.' }, { status: 400 })
      }
      if (!isUsableContactEmail(buyer.contact_email)) {
        return NextResponse.json({ error: 'This buyer does not have a usable contact email yet.' }, { status: 400 })
      }

      const sendResult = await sendBuyerOutreachEmail({
        buyer,
        message: updatedMessage as any,
      })

      if (!sendResult.ok) {
        await updateBuyerOutreachMessage(message.id, {
          status: 'failed',
          send_provider: sendResult.provider,
          send_error: sendResult.error || 'Send failed.',
        })
        await updateBuyerRecord(id, { outreach_status: 'failed' })
        return NextResponse.json({ error: sendResult.error || 'Send failed.' }, { status: 500 })
      }

      await updateBuyerOutreachMessage(message.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        send_provider: sendResult.provider,
        send_error: null,
      })
      await updateBuyerRecord(id, {
        relationship_stage: 'contacted',
        outreach_status: 'sent',
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      })
      await updateBuyerPerformance(id, {
        outreach_sent_count: detail.performance ? detail.performance.outreach_sent_count + 1 : 1,
        last_contacted_at: new Date().toISOString(),
      })
      await insertBuyerRelationshipEvent({
        buyerId: id,
        eventType: 'outreach_sent',
        actorUserId: user?.id || null,
        metadata: { channel: message.channel, provider: sendResult.provider, providerMessageId: sendResult.providerMessageId || null },
      })
      await logEvent({
        eventType: 'buyer_outreach_sent',
        actorUserId: user?.id,
        entityType: 'buyer',
        entityId: id,
        metadata: { provider: sendResult.provider },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Buyer outreach update failed.' }, { status: 500 })
  }
}
