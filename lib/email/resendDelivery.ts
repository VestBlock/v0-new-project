import 'server-only'

import type { WebhookEventPayload } from 'resend'

import { createAdminClient } from '@/lib/supabase/admin'

export type ProviderDeliveryStatus =
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'
  | 'opened'
  | 'clicked'

const EMAIL_EVENT_STATUS: Record<ProviderDeliveryStatus, string> = {
  queued: 'queued',
  accepted: 'accepted',
  delivered: 'delivered',
  delivery_delayed: 'delivery_delayed',
  bounced: 'bounced',
  complained: 'complained',
  suppressed: 'suppressed',
  failed: 'failed',
  opened: 'delivered',
  clicked: 'delivered',
}

const LEAD_DELIVERY_STATUS: Record<ProviderDeliveryStatus, string> = {
  queued: 'queued',
  accepted: 'accepted',
  delivered: 'delivered',
  delivery_delayed: 'delivery_delayed',
  bounced: 'bounced',
  complained: 'complained',
  suppressed: 'suppressed',
  failed: 'failed',
  opened: 'delivered',
  clicked: 'delivered',
}

function mapEventStatus(type: WebhookEventPayload['type']): ProviderDeliveryStatus | null {
  switch (type) {
    case 'email.scheduled':
      return 'queued'
    case 'email.sent':
      return 'accepted'
    case 'email.delivered':
      return 'delivered'
    case 'email.delivery_delayed':
      return 'delivery_delayed'
    case 'email.bounced':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.suppressed':
      return 'suppressed'
    case 'email.failed':
      return 'failed'
    case 'email.opened':
      return 'opened'
    case 'email.clicked':
      return 'clicked'
    default:
      return null
  }
}

function getFailureReason(event: WebhookEventPayload) {
  if (event.type === 'email.bounced') return event.data.bounce?.message || 'Recipient server rejected the email.'
  if (event.type === 'email.failed') return event.data.failed?.reason || 'Provider failed to send the email.'
  if (event.type === 'email.suppressed') return event.data.suppressed?.message || 'Provider suppressed the recipient.'
  if (event.type === 'email.complained') return 'Recipient reported the email as spam.'
  return null
}

async function findOutreachEvent(providerMessageId: string) {
  const admin = createAdminClient()
  const candidates = [
    { resendId: providerMessageId },
    { providerMessageId },
  ]

  for (const metadata of candidates) {
    const { data, error } = await admin
      .from('outreach_send_events')
      .select('id,lead_id,outreach_message_id,recipient,subject')
      .eq('provider', 'resend')
      .contains('metadata_json', metadata)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (data) return data
  }

  return null
}

async function findBuyerPacketSend(providerMessageId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('property_buyer_packet_sends')
    .select('id,buyer_packet_id,buyer_id,buyer_email,status,metadata_json')
    .eq('provider_message_id', providerMessageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

function buyerPacketDeliveryStatus(status: ProviderDeliveryStatus) {
  if (status === 'opened' || status === 'clicked') return 'opened'
  return status
}

async function recordBuyerPacketDelivery(input: {
  packetSend: NonNullable<Awaited<ReturnType<typeof findBuyerPacketSend>>>
  status: ProviderDeliveryStatus
  reason: string | null
  occurredAt: string
  providerEventId: string
  providerMessageId: string
}) {
  const admin = createAdminClient()
  const nextStatus = buyerPacketDeliveryStatus(input.status)
  const updates: Record<string, unknown> = {
    status: nextStatus,
    send_error: input.reason,
    updated_at: new Date().toISOString(),
    metadata_json: {
      ...(input.packetSend.metadata_json || {}),
      lastProviderEventId: input.providerEventId,
      lastProviderEventType: input.status,
      lastProviderEventAt: input.occurredAt,
    },
  }
  if (input.status === 'opened' || input.status === 'clicked') updates.opened_at = input.occurredAt

  const { error: sendError } = await admin
    .from('property_buyer_packet_sends')
    .update(updates)
    .eq('id', input.packetSend.id)
  if (sendError) throw sendError

  const { data: packetSends, error: sendsError } = await admin
    .from('property_buyer_packet_sends')
    .select('status')
    .eq('buyer_packet_id', input.packetSend.buyer_packet_id)
  if (sendsError) throw sendsError
  const statuses = (packetSends || []).map((row) => String(row.status || ''))
  const acceptedCount = statuses.filter((value) => ['accepted', 'sent', 'delivered', 'opened', 'replied', 'interested'].includes(value)).length
  const deliveredCount = statuses.filter((value) => ['delivered', 'opened', 'replied', 'interested'].includes(value)).length
  const openedCount = statuses.filter((value) => ['opened', 'replied', 'interested'].includes(value)).length
  const repliedCount = statuses.filter((value) => ['replied', 'interested'].includes(value)).length
  const failedCount = statuses.filter((value) => ['bounced', 'complained', 'suppressed', 'failed'].includes(value)).length
  const packetStatus =
    acceptedCount === 0 && failedCount > 0
      ? 'failed'
      : failedCount > 0 && acceptedCount > 0
        ? 'partial'
        : deliveredCount > 0
          ? 'sent'
          : acceptedCount > 0
            ? 'accepted'
            : 'ready'

  const { error: packetError } = await admin
    .from('property_buyer_packets')
    .update({
      status: packetStatus,
      sent_count: acceptedCount,
      opened_count: openedCount,
      replied_count: repliedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.packetSend.buyer_packet_id)
  if (packetError) throw packetError

  if (input.packetSend.buyer_id) {
    const buyerUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (['bounced', 'failed'].includes(input.status)) buyerUpdates.outreach_status = 'failed'
    if (['complained', 'suppressed'].includes(input.status)) {
      buyerUpdates.outreach_status = 'do_not_contact'
      buyerUpdates.next_follow_up_at = null
    }
    if (Object.keys(buyerUpdates).length > 1) {
      const { error: buyerError } = await admin
        .from('buyers')
        .update(buyerUpdates)
        .eq('id', input.packetSend.buyer_id)
      if (buyerError) throw buyerError
    }
  }

  await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: input.status === 'delivery_delayed' ? 'accepted' : input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('last_message_id', `buyer-packet:${input.packetSend.buyer_packet_id}:${input.packetSend.buyer_id}`)

  return {
    packetId: input.packetSend.buyer_packet_id,
    packetSendId: input.packetSend.id,
    status: nextStatus,
  }
}

async function suppressLeadEmail(email: string | null, reason: string) {
  if (!email) return
  const admin = createAdminClient()
  const normalized = email.trim().toLowerCase()
  if (!normalized) return

  const { data: existing } = await admin
    .from('lead_suppressions')
    .select('id')
    .eq('email', normalized)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!existing?.id) {
    const { error } = await admin.from('lead_suppressions').insert({
      email: normalized,
      reason,
    })
    if (error) throw error
  }
}

export async function recordResendDeliveryEvent(input: {
  providerEventId: string
  event: WebhookEventPayload
}) {
  const { event, providerEventId } = input
  if (!event.type.startsWith('email.')) {
    return { recorded: false, reason: 'unsupported_event_type' as const }
  }

  const status = mapEventStatus(event.type)
  if (!status || !('email_id' in event.data)) {
    return { recorded: false, reason: 'unsupported_email_event' as const }
  }

  const admin = createAdminClient()
  const providerMessageId = event.data.email_id
  const recipient = event.data.to?.[0]?.trim().toLowerCase() || null
  const subject = event.data.subject || null
  const reason = getFailureReason(event)
  const metadata = {
    eventType: event.type,
    recipientCount: event.data.to?.length || 0,
    bounce: event.type === 'email.bounced' ? event.data.bounce : null,
    failed: event.type === 'email.failed' ? event.data.failed : null,
    suppressed: event.type === 'email.suppressed' ? event.data.suppressed : null,
  }

  const { data: inserted, error: insertError } = await admin
    .from('provider_delivery_events')
    .upsert(
      {
        provider: 'resend',
        provider_event_id: providerEventId,
        provider_message_id: providerMessageId,
        event_type: event.type,
        delivery_status: status,
        recipient,
        subject,
        reason,
        metadata_json: metadata,
        occurred_at: event.created_at,
      },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()

  if (insertError) throw insertError
  if (!inserted?.id) return { recorded: false, reason: 'duplicate' as const }

  const [outreachEvent, buyerPacketSend] = await Promise.all([
    findOutreachEvent(providerMessageId),
    findBuyerPacketSend(providerMessageId),
  ])
  await admin
    .from('email_events')
    .update({
      status: EMAIL_EVENT_STATUS[status],
      error_message: reason,
    })
    .eq('provider_message_id', providerMessageId)

  const buyerPacket = buyerPacketSend
    ? await recordBuyerPacketDelivery({
        packetSend: buyerPacketSend,
        status,
        reason,
        occurredAt: event.created_at,
        providerEventId,
        providerMessageId,
      })
    : null

  if (!outreachEvent?.lead_id) {
    return {
      recorded: true,
      matched: Boolean(buyerPacket),
      status,
      providerMessageId,
      buyerPacket,
    }
  }

  const { error: eventError } = await admin.from('outreach_send_events').insert({
    lead_id: outreachEvent.lead_id,
    outreach_message_id: outreachEvent.outreach_message_id || null,
    channel: 'email',
    provider: 'resend',
    status,
    recipient: recipient || outreachEvent.recipient || null,
    subject: subject || outreachEvent.subject || null,
    error_message: reason,
    metadata_json: {
      providerEventId,
      providerMessageId,
      eventType: event.type,
      occurredAt: event.created_at,
    },
  })
  if (eventError) throw eventError

  const leadUpdates: Record<string, unknown> = {
    delivery_status: LEAD_DELIVERY_STATUS[status],
  }

  if (['bounced', 'complained', 'suppressed', 'failed'].includes(status)) {
    leadUpdates.email_valid = false
    leadUpdates.suppression_reason = reason || `Resend reported ${status}.`
    leadUpdates.outreach_status = status === 'complained' ? 'do_not_contact' : 'failed'
    await suppressLeadEmail(recipient || outreachEvent.recipient || null, String(leadUpdates.suppression_reason))
  }

  const { error: leadError } = await admin
    .from('leads')
    .update(leadUpdates)
    .eq('id', outreachEvent.lead_id)
  if (leadError) throw leadError

  const membershipStatus = status === 'delivery_delayed' ? 'accepted' : status
  const { data: memberships, error: membershipError } = await admin
    .from('strategy_lead_memberships')
    .update({
      status: membershipStatus,
      last_outcome_at: event.created_at,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', outreachEvent.lead_id)
    .select('campaign_run_id')
  if (membershipError) throw membershipError

  const { error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: membershipStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', outreachEvent.lead_id)
    .eq('channel', 'email')
  if (enrollmentError) throw enrollmentError

  const campaignRunIds = Array.from(
    new Set(
      (memberships || [])
        .map((membership) => membership.campaign_run_id)
        .filter((campaignRunId): campaignRunId is string => Boolean(campaignRunId))
    )
  )

  for (const campaignRunId of campaignRunIds) {
    const { data: runMemberships, error: runMembershipError } = await admin
      .from('strategy_lead_memberships')
      .select('status')
      .eq('campaign_run_id', campaignRunId)
    if (runMembershipError) throw runMembershipError
    const statuses = (runMemberships || []).map((row) => String(row.status || ''))
    const accepted = statuses.filter((value) => ['accepted', 'delivered', 'opened', 'clicked', 'replied'].includes(value)).length
    const delivered = statuses.filter((value) => ['delivered', 'opened', 'clicked', 'replied'].includes(value)).length
    const replies = statuses.filter((value) => value === 'replied').length
    const bounces = statuses.filter((value) => ['bounced', 'complained', 'suppressed', 'failed'].includes(value)).length
    const { error: runError } = await admin
      .from('command_center_strategy_runs')
      .update({
        accepted_count: accepted,
        delivered_count: delivered,
        reply_count: replies,
        bounce_count: bounces,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignRunId)
    if (runError) throw runError
  }

  return {
    recorded: true,
    matched: true,
    status,
    providerMessageId,
    leadId: outreachEvent.lead_id,
    buyerPacket,
  }
}
