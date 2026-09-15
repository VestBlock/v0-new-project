export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { getStrategyDeliveryAttribution } from '@/lib/admin/strategyDelivery'
import { sendLeadOutreachEmail } from '@/lib/leads/outbound'
import {
  getLeadById,
  claimOutreachMessageForSend,
  insertOutreachSendEvent,
  restoreOutreachMessageAfterDeliveryDeferral,
  updateLeadRecord,
  updateOutreachMessage,
} from '@/lib/leads/repository'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import { logEvent } from '@/lib/system/logEvent'
import { buildOutboundSendIdentity, outboundIdentityMetadata } from '@/lib/outreach/deliveryIdentity'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'

const SUCCESSFUL_SEND_STATUSES = new Set(['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])

function flag(value: string | null, fallback: boolean) {
  if (value === null) return fallback
  return /^(1|true|yes|on)$/i.test(value)
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const leadId = String(url.searchParams.get('leadId') || '').trim()
    const dryRun = flag(url.searchParams.get('dryRun'), true)
    if (!leadId) return NextResponse.json({ error: 'leadId is required.' }, { status: 400 })

    const admin = createAdminClient()
    const detail = await getLeadById(leadId)
    const lead = detail.lead
    const source = String(lead.source || '').toLowerCase()
    if (source.includes('dealmachine')) {
      return NextResponse.json({ error: 'DealMachine leads are disabled for this targeted lane.' }, { status: 400 })
    }
    if (lead.category !== 'seller_lead' && lead.lead_type !== 'sell_house') {
      return NextResponse.json({ error: 'This route only sends seller outreach.' }, { status: 400 })
    }
    if (!isUsableContactEmail(lead.email)) {
      return NextResponse.json({ error: 'Lead does not have a usable email.' }, { status: 400 })
    }

    const normalizedEmail = String(lead.email).trim().toLowerCase()
    const [suppressionResult, replyResult, priorEventsResult] = await Promise.all([
      admin
        .from('lead_suppressions')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
      admin
        .from('command_center_reply_memory')
        .select('id,classification')
        .eq('from_email', normalizedEmail)
        .neq('classification', 'spam_noise')
        .limit(1)
        .maybeSingle(),
      admin
        .from('outreach_send_events')
        .select('id,status')
        .eq('lead_id', leadId)
        .in('status', Array.from(SUCCESSFUL_SEND_STATUSES))
        .limit(1),
    ])
    if (suppressionResult.error) throw suppressionResult.error
    if (replyResult.error) throw replyResult.error
    if (priorEventsResult.error) throw priorEventsResult.error
    const suppression = suppressionResult.data
    const reply = replyResult.data
    const priorEvents = priorEventsResult.data
    if (suppression?.id) return NextResponse.json({ error: 'Recipient is suppressed.' }, { status: 409 })
    if (reply?.id) return NextResponse.json({ error: 'Recipient has already replied.' }, { status: 409 })
    if ((priorEvents || []).length) return NextResponse.json({ error: 'Lead already has a successful send.' }, { status: 409 })

    const message = [...detail.outreach]
      .filter((item) => item.channel === 'email' && item.status === 'approved')
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0]
    if (!message) {
      return NextResponse.json({ error: 'No approved email draft exists for this lead.' }, { status: 409 })
    }

    const qualityIssue = validateOutreachMessageQuality({ lead, message })
    if (qualityIssue) {
      return NextResponse.json({ error: `Message quality blocked: ${qualityIssue}.` }, { status: 400 })
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldSend: true,
        leadId,
        recipient: normalizedEmail,
        subject: message.subject,
        strategyKey: lead.market_segment || 'seller-outreach',
      })
    }

    const finalRecipientGuard = await getOutreachRecipientGuard({
      scope: 'lead',
      entityId: leadId,
      email: normalizedEmail,
    })
    if (!finalRecipientGuard.allowed) {
      return NextResponse.json(
        { error: `Recipient safety check blocked this send: ${finalRecipientGuard.reason}.` },
        { status: 409 }
      )
    }

    const claimed = await claimOutreachMessageForSend(message.id)
    if (!claimed) {
      return NextResponse.json({ error: 'Another worker already claimed or completed this message.' }, { status: 409 })
    }
    const identity = buildOutboundSendIdentity({ scope: 'lead', entityId: leadId, messageId: claimed.id, sequenceStep: 1 })
    const attribution = await getStrategyDeliveryAttribution(leadId).catch(() => null)
    const sendResult = await sendLeadOutreachEmail({ lead, message: claimed, sequenceStep: 1 })
    if (!sendResult.ok) {
      if (sendResult.deferred) {
        const restored = await restoreOutreachMessageAfterDeliveryDeferral(
          message.id,
          claimed.updated_at,
          sendResult.error || 'Delivery deferred by the outreach governor.'
        )
        await Promise.all([
          restored ? updateLeadRecord(leadId, { outreach_status: 'approved' }) : Promise.resolve(),
        ])
        return NextResponse.json(
          {
            success: false,
            deferred: true,
            restored: Boolean(restored),
            error: restored
              ? sendResult.error || 'Delivery is temporarily deferred.'
              : 'Delivery was deferred, but the claimed message changed before it could be restored.',
          },
          { status: 409 }
        )
      }
      await updateOutreachMessage(message.id, {
        status: 'failed',
        send_provider: sendResult.provider,
        send_error: sendResult.error || 'Targeted seller send failed.',
      })
      await insertOutreachSendEvent({
        leadId,
        outreachMessageId: message.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'failed',
        recipient: normalizedEmail,
        subject: message.subject,
        errorMessage: sendResult.error || 'Targeted seller send failed.',
        idempotencyKey: `${identity.idempotencyKey}:failed`,
        correlationId: identity.correlationId,
        metadata: {
          action: 'seller_targeted_send',
          ...outboundIdentityMetadata(identity),
          campaignRunId: attribution?.campaign_run_id || null,
        },
      })
      return NextResponse.json({ error: sendResult.error || 'Send failed.' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const strategyKey = attribution?.strategy_key || lead.market_segment || 'seller-outreach'
    const auditWrites = await Promise.allSettled([
      updateOutreachMessage(message.id, {
        status: 'sent',
        sent_at: now,
        send_provider: sendResult.provider,
        send_error: null,
      }),
      updateLeadRecord(leadId, {
        status: 'contacted',
        outreach_status: 'sent',
        delivery_status: 'accepted',
        last_contacted_at: now,
        next_follow_up_at: nextFollowUpAt,
      }),
      insertOutreachSendEvent({
        leadId,
        outreachMessageId: message.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'accepted',
        recipient: normalizedEmail,
        subject: message.subject,
        idempotencyKey: `${identity.idempotencyKey}:accepted`,
        correlationId: identity.correlationId,
        metadata: {
          ...outboundIdentityMetadata(identity),
          action: 'seller_targeted_send',
          strategyKey,
          providerMessageId: sendResult.providerMessageId || null,
          campaignRunId: attribution?.campaign_run_id || null,
        },
      }),
      recordOutboundEnrollment({
        campaignRunId: attribution?.campaign_run_id || null,
        strategyKey,
        channel: 'email',
        status: 'accepted',
        messageId: message.id,
        recipient: normalizedEmail,
        leadId,
        market: [lead.city, lead.state].filter(Boolean).join(', '),
        propertyAddress: lead.property_address,
        nextActionAt: nextFollowUpAt,
        metadata: {
          ...outboundIdentityMetadata(identity),
          source: lead.source,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId || null,
        },
      }),
      logEvent({
        eventType: 'email_sent',
        entityType: 'lead',
        entityId: leadId,
        metadata: { action: 'seller_targeted_send', provider: sendResult.provider, strategyKey },
      }),
    ])
    const auditWarnings = auditWrites.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`write_${index + 1}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
        : []
    )

    return NextResponse.json({
      success: true,
      dryRun: false,
      accepted: true,
      leadId,
      recipient: normalizedEmail,
      subject: message.subject,
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      nextFollowUpAt,
      auditComplete: auditWarnings.length === 0,
      auditWarnings,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Targeted seller send failed.' },
      { status: 500 }
    )
  }
}
