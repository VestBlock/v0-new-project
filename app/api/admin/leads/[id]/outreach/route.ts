export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { sendLeadOutreachSentAlertEmail } from '@/lib/email/sendEmail'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { updateOutreachMessageSchema } from '@/lib/leads/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLeadById, insertOutreachSendEvent, listSuppressions, updateLeadRecord, updateOutreachMessage } from '@/lib/leads/repository'
import { sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { logEvent } from '@/lib/system/logEvent'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = updateOutreachMessageSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const admin = createAdminClient()
    const { data: message, error } = await admin
      .from('outreach_messages')
      .select('*')
      .eq('lead_id', id)
      .eq('id', parsed.data.messageId)
      .single()

    if (error || !message) {
      return NextResponse.json({ error: 'Outreach message not found.' }, { status: 404 })
    }

    const nextStatus = parsed.data.status || (parsed.data.sendNow ? 'approved' : null)
    if (nextStatus) {
      await updateOutreachMessage(message.id, {
        status: nextStatus,
        approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
        approved_by_user_id: nextStatus === 'approved' ? user?.id || null : null,
      })
      await updateLeadRecord(id, {
        outreach_status: nextStatus === 'approved' ? 'approved' : nextStatus === 'archived' ? 'not_started' : 'needs_review',
      })
      await insertOutreachSendEvent({
        leadId: id,
        outreachMessageId: message.id,
        channel: message.channel,
        status: nextStatus === 'approved' ? 'approved' : 'skipped',
        recipient: null,
        subject: message.subject,
        metadata: { actorUserId: user?.id || null, action: nextStatus },
      })
      await logEvent({
        eventType: 'outreach_approved',
        actorUserId: user?.id,
        entityType: 'lead',
        entityId: id,
        metadata: { outreachMessageId: message.id, status: nextStatus },
      })
    }

    if (parsed.data.sendNow) {
      const detail = await getLeadById(id)
      const lead = detail.lead
      const updatedMessage =
        detail.outreach.find((item) => item.id === parsed.data.messageId) || message
      const suppressions = await listSuppressions().catch(() => [])
      const decision = getLeadEmailAutopilotDecision(lead, suppressions)
      const qualityIssue = validateOutreachMessageQuality({ lead, message: updatedMessage })

      if (qualityIssue) {
        await insertOutreachSendEvent({
          leadId: id,
          outreachMessageId: message.id,
          channel: message.channel,
          status: 'skipped',
          recipient: lead.email,
          subject: updatedMessage.subject,
          metadata: {
            actorUserId: user?.id || null,
            action: 'send_now_blocked',
            guardrail: 'message_quality',
            reason: qualityIssue,
            skippedReason: qualityIssue,
          },
        })
        return NextResponse.json(
          { error: `This draft needs cleanup before sending: ${qualityIssue.replaceAll('_', ' ')}.` },
          { status: 400 }
        )
      }

      if (updatedMessage.status !== 'approved' && decision.eligible) {
        await updateOutreachMessage(message.id, {
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_user_id: null,
        })
        await updateLeadRecord(id, { outreach_status: 'approved' })
        await insertOutreachSendEvent({
          leadId: id,
          outreachMessageId: message.id,
          channel: message.channel,
          status: 'approved',
          recipient: lead.email,
          subject: updatedMessage.subject,
          metadata: { actorUserId: user?.id || null, action: 'auto_approved_for_send_now' },
        })
      }
      if (updatedMessage.status !== 'approved' && !decision.eligible) {
        const errorMessage =
          decision.reason === 'missing_email'
            ? 'This lead has no usable email address. Use phone, SMS, or DM outreach instead.'
            : decision.reason === 'invalid_email'
              ? 'This lead email does not look safe enough to send.'
              : decision.reason === 'suppressed'
                ? 'Lead is on the suppression list.'
                : decision.reason === 'below_min_score'
                  ? 'Lead score is below the auto-send threshold.'
                  : decision.reason === 'high_bounce_risk'
                    ? 'Lead bounce risk is too high to send.'
                    : decision.reason === 'do_not_contact'
                      ? 'Lead is marked do not contact.'
                      : 'Outreach is not auto-send eligible yet.'
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      const sendResult = await sendLeadOutreachEmail({
        lead,
        message: updatedMessage as any,
      })

      if (!sendResult.ok) {
        await Promise.all([
          updateOutreachMessage(message.id, {
            status: 'failed',
            send_provider: sendResult.provider,
            send_error: sendResult.error || 'Send failed.',
          }),
          updateLeadRecord(id, {
            outreach_status: 'failed',
            delivery_status: /bounce/i.test(sendResult.error || '') ? 'bounced' : 'failed',
          }),
          insertOutreachSendEvent({
            leadId: id,
            outreachMessageId: message.id,
            channel: message.channel,
            provider: sendResult.provider,
            status: 'failed',
            recipient: lead.email,
            subject: updatedMessage.subject,
            errorMessage: sendResult.error,
          }),
        ])
        return NextResponse.json(
          { error: sendResult.error || 'Send failed.' },
          { status: 500 }
        )
      }

      await Promise.all([
        updateOutreachMessage(message.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          send_provider: sendResult.provider,
          send_error: null,
        }),
        updateLeadRecord(id, {
          status: 'contacted',
          outreach_status: 'sent',
          delivery_status: 'sent',
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        insertOutreachSendEvent({
          leadId: id,
          outreachMessageId: message.id,
          channel: message.channel,
          provider: sendResult.provider,
          status: 'sent',
          recipient: lead.email,
          subject: updatedMessage.subject,
          metadata: { providerMessageId: sendResult.providerMessageId || null },
        }),
        logEvent({
          eventType: 'outreach_sent',
          actorUserId: user?.id,
          entityType: 'lead',
          entityId: id,
          metadata: { outreachMessageId: message.id, provider: sendResult.provider },
        }),
        sendLeadOutreachSentAlertEmail({
          leadId: id,
          leadType: lead.lead_type,
          name: lead.name || lead.business_name || null,
          email: lead.email,
          provider: sendResult.provider,
          subject: updatedMessage.subject,
          sourcePath: lead.source_url || lead.source || null,
          deliveryMode: 'manual',
        }),
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Outreach update failed.' },
      { status: 500 }
    )
  }
}
