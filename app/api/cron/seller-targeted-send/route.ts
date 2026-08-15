export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { getOutboundProviderReadiness, sendLeadOutreachEmail } from '@/lib/leads/outbound'
import {
  getLeadById,
  insertOutreachSendEvent,
  updateLeadRecord,
  updateOutreachMessage,
} from '@/lib/leads/repository'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
  resolveOperatingStrategyLeadMembership,
} from '@/lib/strategy/runtime-governance'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import { logEvent } from '@/lib/system/logEvent'

const SUCCESSFUL_SEND_STATUSES = new Set(['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
const GOVERNED_SELLER_STRATEGY_KEY = 'seller-outreach'
const GOVERNED_SELLER_NAMESPACE = 'legacy_runtime'

function configuredEmailDispatchChannels() {
  const readiness = getOutboundProviderReadiness()
  if (readiness.resend) return ['resend_email']
  if (readiness.gmail) return ['gmail_email']
  return ['no_outreach']
}

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
    const [{ data: suppression }, { data: reply }, { data: priorEvents }] = await Promise.all([
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

    const strategyKey = GOVERNED_SELLER_STRATEGY_KEY
    const marketSegment = lead.market_segment || null

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldSend: true,
        leadId,
        recipient: normalizedEmail,
        subject: message.subject,
        strategyKey,
        marketSegment,
      })
    }

    const dispatchChannels = configuredEmailDispatchChannels()
    if (dispatchChannels.length !== 1 || dispatchChannels[0] === 'no_outreach') {
      throw new Error('Governed dispatch requires exactly one configured external email provider path.')
    }
    const selectedProvider = dispatchChannels[0] === 'resend_email' ? 'resend' as const : 'gmail' as const
    const bindings = await Promise.all(
      dispatchChannels.map((channel) =>
        authorizeOperatingStrategyDispatch({
          namespace: GOVERNED_SELLER_NAMESPACE,
          sourceIdentifier: strategyKey,
          channel,
          requestedExternalSends: 1,
          requiredDispatchAuthority: 'vestblock_application',
        })
      )
    )
    const binding = bindings[0]
    if (
      bindings.some(
        (candidate) =>
          candidate.operatingStrategyVersionId !== binding.operatingStrategyVersionId ||
          candidate.contractFingerprint !== binding.contractFingerprint
      )
    ) {
      throw new Error('Configured provider paths did not resolve to one canonical operating strategy version.')
    }
    const strategyLeadMembershipId = await resolveOperatingStrategyLeadMembership({ binding, leadId })
    const dispatchChannel = dispatchChannels[0]
    const dispatchReservation = await reserveOperatingStrategyDispatch({
      binding,
      channel: dispatchChannel,
      requestedCount: 1,
      idempotencyKey: `seller-targeted:${binding.operatingStrategyVersionId}:${message.id}`,
    })

    const dispatchIntentAt = new Date().toISOString()
    const consentBasisSnapshot = {
      basis: 'operator_approved_business_outreach',
      dispatchAuthorized: true,
      evidenceKey: `approved-outreach-message:${message.id}`,
      provenance: {
        messageId: message.id,
        messageStatus: message.status,
        approvalRecordedAt: message.approved_at || null,
      },
      messageStatus: message.status,
      approvedAt: message.approved_at || null,
      capturedAt: dispatchIntentAt,
    }
    const suppressionSnapshot = {
      checkedAt: dispatchIntentAt,
      suppressionCleared: true,
      evidenceKey: `seller-targeted-preflight:${leadId}:${dispatchIntentAt}`,
      activeSuppression: false,
      priorReply: false,
      priorSuccessfulSend: false,
      usableEmail: true,
      qualityApproved: true,
    }
    const enrollmentBase = {
      strategyKey,
      channel: 'email' as const,
      messageId: message.id,
      recipient: normalizedEmail,
      leadId,
      subjectNamespace: 'lead',
      subjectKey: leadId,
      market: [lead.city, lead.state].filter(Boolean).join(', '),
      propertyAddress: lead.property_address,
      binding,
      governedStage: 'dispatch_intent' as const,
      strategyLeadMembershipId,
      dispatchReservationId: dispatchReservation.reservationId,
      dispatchChannel,
      dispatchIntentAt,
      provider: selectedProvider,
      outreachPurpose: 'seller_acquisition_first_touch',
      consentBasisSnapshot,
      suppressionSnapshot,
      messageVersionKey: `${message.id}:approved:${message.approved_at || message.updated_at}`,
    }
    const dispatchIntent = await recordOutboundEnrollment({
      ...enrollmentBase,
      status: 'queued',
      nextActionAt: null,
      metadata: {
        action: 'seller_targeted_send',
        sequenceStep: 1,
        marketSegment,
        source: lead.source,
        authorizedChannels: dispatchChannels,
      },
    })

    const sendResult = await sendLeadOutreachEmail({
      lead,
      message,
      provider: selectedProvider,
      disableFallback: true,
    })
    if (!sendResult.ok) {
      await recordOutboundEnrollment({
        ...enrollmentBase,
        enrollmentId: dispatchIntent.id,
        status: 'failed',
        provider: sendResult.provider,
        suppressionReason: sendResult.error || 'send_failed',
        metadata: {
          action: 'seller_targeted_send',
          sequenceStep: 1,
          marketSegment,
          source: lead.source,
          authorizedChannels: dispatchChannels,
          error: sendResult.error || 'send_failed',
        },
      })
      const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
        leadId,
        subjectNamespace: 'lead',
        subjectKey: leadId,
        messageId: message.id,
        enrollmentId: dispatchIntent.id,
        operatingStrategyVersionId: binding.operatingStrategyVersionId,
        occurredAt: dispatchIntentAt,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        status: 'failed',
      })
      if (!failedDeliveryOutcome.updated) {
        throw new Error(`Governed delivery attribution failed closed: ${failedDeliveryOutcome.reason}.`)
      }
      await insertOutreachSendEvent({
        leadId,
        outreachMessageId: message.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'failed',
        recipient: normalizedEmail,
        subject: message.subject,
        errorMessage: sendResult.error || 'Targeted seller send failed.',
        metadata: { action: 'seller_targeted_send' },
      })
      return NextResponse.json({ error: sendResult.error || 'Send failed.' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    await recordOutboundEnrollment({
      ...enrollmentBase,
      enrollmentId: dispatchIntent.id,
      status: 'accepted',
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      nextActionAt: nextFollowUpAt,
      metadata: {
        action: 'seller_targeted_send',
        sequenceStep: 1,
        marketSegment,
        source: lead.source,
        authorizedChannels: dispatchChannels,
      },
    })
    const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
      leadId,
      subjectNamespace: 'lead',
      subjectKey: leadId,
      messageId: message.id,
      enrollmentId: dispatchIntent.id,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      occurredAt: dispatchIntentAt,
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      status: 'accepted',
    })
    if (!acceptedDeliveryOutcome.updated) {
      throw new Error(`Governed delivery attribution failed closed: ${acceptedDeliveryOutcome.reason}.`)
    }
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
        metadata: {
          action: 'seller_targeted_send',
          sequenceStep: 1,
          strategyKey,
          marketSegment,
          providerMessageId: sendResult.providerMessageId || null,
        },
      }),
      logEvent({
        eventType: 'email_sent',
        entityType: 'lead',
        entityId: leadId,
        metadata: { action: 'seller_targeted_send', provider: sendResult.provider, strategyKey, marketSegment },
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
