export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { commandCenterDataIntegrityHoldResponse, isCommandCenterDataIntegrityHold } from '@/lib/admin/command-center-data-integrity'
import { updateLenderOutreachMessageSchema } from '@/lib/lenders/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimLenderOutreachMessageForSend, getLenderById, insertLenderRelationshipEvent, restoreLenderOutreachMessageAfterQuotaDenial, updateLenderOutreachMessage, updateLenderPerformance, updateLenderRecord } from '@/lib/lenders/repository'
import { sendLenderOutreachEmail } from '@/lib/lenders/outbound'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { logEvent } from '@/lib/system/logEvent'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import { canApproveOutreachMessage } from '@/lib/outreach/messageState'
import { hashHunterVerificationEmail } from '@/lib/outreach/hunterSendVerificationCore'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = updateLenderOutreachMessageSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (parsed.data.sendNow && await isCommandCenterDataIntegrityHold()) {
      return commandCenterDataIntegrityHoldResponse()
    }

    const { id } = await params
    const admin = createAdminClient()
    const { data: message, error } = await admin
      .from('lender_outreach_messages')
      .select('*')
      .eq('lender_id', id)
      .eq('id', parsed.data.messageId)
      .single()

    if (error || !message) {
      return NextResponse.json({ error: 'Lender outreach message not found.' }, { status: 404 })
    }
    if (parsed.data.sendNow && parsed.data.status && parsed.data.status !== 'approved') {
      return NextResponse.json({ error: 'sendNow can only be combined with approved status.' }, { status: 400 })
    }
    if (parsed.data.sendNow && (message.sent_at || ['queued', 'sent'].includes(String(message.status || '')))) {
      return NextResponse.json({ error: 'This lender outreach message has already been claimed or sent.' }, { status: 409 })
    }

    const nextStatus = parsed.data.status || (parsed.data.sendNow ? 'approved' : null)
    if (nextStatus === 'approved' && !canApproveOutreachMessage(message)) {
      return NextResponse.json(
        { error: 'Queued or sent outreach cannot be moved back to approved.' },
        { status: 409 }
      )
    }
    if (nextStatus) {
      await updateLenderOutreachMessage(message.id, {
        status: nextStatus,
        approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
        approved_by_user_id: nextStatus === 'approved' ? user?.id || null : null,
      })
      await updateLenderRecord(id, {
        outreach_status: nextStatus === 'approved' ? 'approved' : nextStatus === 'archived' ? 'not_started' : 'needs_review',
      })
      await insertLenderRelationshipEvent({
        lenderId: id,
        eventType: nextStatus === 'approved' ? 'outreach_approved' : 'outreach_archived',
        actorUserId: user?.id || null,
        metadata: { channel: message.channel },
      })
      await logEvent({
        eventType: 'admin_action',
        actorUserId: user?.id,
        entityType: 'lender',
        entityId: id,
        metadata: { action: nextStatus === 'approved' ? 'lender_outreach_approved' : 'lender_outreach_archived' },
      })
    }

    if (parsed.data.sendNow) {
      const detail = await getLenderById(id)
      const lender = detail.lender
      const updatedMessage = detail.outreach.find((item) => item.id === parsed.data.messageId) || message

      if (updatedMessage.status !== 'approved') {
        return NextResponse.json({ error: 'Outreach must be approved before sending.' }, { status: 400 })
      }
      if (!isUsableContactEmail(lender.contact_email)) {
        return NextResponse.json({ error: 'This lender does not have a usable contact email yet.' }, { status: 400 })
      }

      const finalRecipientGuard = await getOutreachRecipientGuard({
        scope: 'lender',
        entityId: id,
        email: lender.contact_email,
      })
      if (!finalRecipientGuard.allowed) {
        return NextResponse.json(
          { error: `Recipient safety check blocked this send: ${finalRecipientGuard.reason}.` },
          { status: 409 }
        )
      }

      const claimed = await claimLenderOutreachMessageForSend(message.id)
      if (!claimed) {
        return NextResponse.json({ error: 'Another worker already claimed or completed this message.' }, { status: 409 })
      }
      const sendResult = await sendLenderOutreachEmail({
        lender,
        message: claimed,
      })

      if (!sendResult.ok) {
        if (sendResult.deferred) {
          const restored = await restoreLenderOutreachMessageAfterQuotaDenial(
            message.id,
            claimed.updated_at
          )
          if (restored) await updateLenderRecord(id, { outreach_status: 'approved' })
          return NextResponse.json(
            {
              error: restored
                ? sendResult.error || 'Delivery is temporarily deferred.'
                : 'Delivery was deferred, but the claimed message changed before it could be restored.',
            },
            { status: 409 }
          )
        }
        await updateLenderOutreachMessage(message.id, {
          status: 'failed',
          send_provider: sendResult.provider,
          send_error: sendResult.error || 'Send failed.',
          metadata_json: {
            ...(claimed.metadata_json || {}),
            idempotencyKey: sendResult.idempotencyKey || null,
            correlationId: sendResult.correlationId || null,
          },
        })
        await updateLenderRecord(id, { outreach_status: 'failed' })
        return NextResponse.json({ error: sendResult.error || 'Send failed.' }, { status: 500 })
      }

      await updateLenderOutreachMessage(message.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        send_provider: sendResult.provider,
        send_error: null,
        metadata_json: {
          ...(claimed.metadata_json || {}),
          providerMessageId: sendResult.providerMessageId || null,
          idempotencyKey: sendResult.idempotencyKey || null,
          correlationId: sendResult.correlationId || null,
          acceptedRecipientHash: hashHunterVerificationEmail(lender.contact_email || ''),
        },
      })
      await updateLenderRecord(id, {
        relationship_stage: 'contacted',
        outreach_status: 'sent',
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      })
      await updateLenderPerformance(id, {
        outreach_sent_count: detail.performance ? detail.performance.outreach_sent_count + 1 : 1,
        last_contacted_at: new Date().toISOString(),
      })
      await insertLenderRelationshipEvent({
        lenderId: id,
        eventType: 'outreach_sent',
        actorUserId: user?.id || null,
        metadata: {
          channel: message.channel,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId || null,
          idempotencyKey: sendResult.idempotencyKey || null,
          correlationId: sendResult.correlationId || null,
        },
      })
      await logEvent({
        eventType: 'lender_outreach_sent',
        actorUserId: user?.id,
        entityType: 'lender',
        entityId: id,
        metadata: { provider: sendResult.provider },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lender outreach update failed.' }, { status: 500 })
  }
}
