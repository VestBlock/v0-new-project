import 'server-only'

import type { WebhookEventPayload } from 'resend'

import {
  buildResendDeliveryIdentityMetadata,
  deliveryProjectionAllowedCurrentStatuses,
  parseResendOutreachIdentityTags,
  selectResendDeliveryProjection,
  type ResendOutreachIdentityTags,
  type ResendProjectionStatus,
} from '@/lib/email/resendDeliveryCore'
import { createAdminClient } from '@/lib/supabase/admin'
import { suppressAndCancelPendingOutreach } from '@/lib/outreach/suppression'
import {
  recordOutreachThroughputOutcome,
  recordOutreachThroughputProviderOutcome,
  type OutreachThroughputOutcome,
} from '@/lib/outreach/throughputGovernor'

export type ProviderDeliveryStatus = ResendProjectionStatus

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

function throughputOutcome(status: ProviderDeliveryStatus): OutreachThroughputOutcome {
  if (status === 'queued') return 'reserved'
  if (status === 'accepted' || status === 'delivery_delayed') return 'accepted'
  if (status === 'delivered' || status === 'opened' || status === 'clicked') return 'delivered'
  return status
}

async function findOutreachEvent(
  providerMessageId: string,
  webhookTags?: ResendOutreachIdentityTags | null
) {
  const admin = createAdminClient()
  const candidates = [
    { resendId: providerMessageId },
    { providerMessageId },
  ]

  for (const metadata of candidates) {
    const { data, error } = await admin
      .from('outreach_send_events')
      .select('id,lead_id,outreach_message_id,recipient,subject,metadata_json')
      .eq('provider', 'resend')
      .contains('metadata_json', metadata)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (data) return data
  }

  if (webhookTags?.recordType === 'lead_outreach') {
    const { data, error } = await admin
      .from('outreach_messages')
      .select('id,lead_id,subject,metadata_json')
      .eq('id', webhookTags.messageId)
      .eq('lead_id', webhookTags.entityId)
      .maybeSingle()
    if (error) throw error
    if (data) {
      return {
        id: data.id,
        lead_id: data.lead_id,
        outreach_message_id: data.id,
        recipient: null,
        subject: data.subject,
        metadata_json: {
          ...(data.metadata_json || {}),
          idempotencyKey: webhookTags.idempotencyKey,
          correlationId: webhookTags.correlationId,
        },
      }
    }
  }

  return null
}

async function findPartnerOutreachRecord(
  providerMessageId: string,
  webhookTags?: ResendOutreachIdentityTags | null
) {
  const admin = createAdminClient()
  const sources = [
    {
      table: 'buyer_outreach_messages',
      recordType: 'buyer_outreach',
      entityTable: 'buyers',
      entityIdColumn: 'buyer_id',
    },
    {
      table: 'lender_outreach_messages',
      recordType: 'lender_outreach',
      entityTable: 'lenders',
      entityIdColumn: 'lender_id',
    },
    {
      table: 'investor_outreach_messages',
      recordType: 'investor_outreach',
      entityTable: 'investor_profiles',
      entityIdColumn: 'investor_profile_id',
    },
  ]
  for (const source of sources) {
    const { data, error } = await admin
      .from(source.table)
      .select(`id,${source.entityIdColumn},metadata_json`)
      .contains('metadata_json', { providerMessageId })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const row = data as unknown as Record<string, unknown>
      return {
        id: String(row.id || ''),
        recordType: source.recordType,
        messageTable: source.table,
        entityTable: source.entityTable,
        entityId: String(row[source.entityIdColumn] || ''),
        metadata_json: (row.metadata_json || {}) as Record<string, unknown>,
      }
    }
  }

  const taggedSource = sources.find((source) => source.recordType === webhookTags?.recordType)
  if (taggedSource && webhookTags) {
    const { data, error } = await admin
      .from(taggedSource.table)
      .select(`id,${taggedSource.entityIdColumn},metadata_json`)
      .eq('id', webhookTags.messageId)
      .eq(taggedSource.entityIdColumn, webhookTags.entityId)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const row = data as unknown as Record<string, unknown>
      return {
        id: String(row.id || ''),
        recordType: taggedSource.recordType,
        messageTable: taggedSource.table,
        entityTable: taggedSource.entityTable,
        entityId: String(row[taggedSource.entityIdColumn] || ''),
        metadata_json: {
          ...((row.metadata_json || {}) as Record<string, unknown>),
          idempotencyKey: webhookTags.idempotencyKey,
          correlationId: webhookTags.correlationId,
        },
      }
    }
  }
  return null
}

async function findBuyerPacketSend(
  providerMessageId: string,
  webhookTags?: ResendOutreachIdentityTags | null
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('property_buyer_packet_sends')
    .select('id,buyer_packet_id,buyer_id,buyer_email,status,metadata_json')
    .eq('provider_message_id', providerMessageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data || webhookTags?.recordType !== 'buyer_packet_outreach') return data

  const [prefix, packetId, buyerId] = webhookTags.messageId.split(':')
  if (prefix !== 'buyer-packet' || !packetId || !buyerId) return null
  const { data: taggedPacketSend, error: taggedPacketError } = await admin
    .from('property_buyer_packet_sends')
    .select('id,buyer_packet_id,buyer_id,buyer_email,status,metadata_json')
    .eq('buyer_packet_id', packetId)
    .eq('buyer_id', buyerId)
    .limit(1)
    .maybeSingle()
  if (taggedPacketError) throw taggedPacketError
  return taggedPacketSend
}

async function findThroughputAttemptSender(
  providerMessageId: string,
  webhookTags?: ResendOutreachIdentityTags | null
) {
  const admin = createAdminClient()
  const query = admin
    .from('outreach_attempt_reservations')
    .select('sender_email')
    .eq('provider', 'resend')
    .eq('provider_message_id', providerMessageId)
    .limit(1)
    .maybeSingle()
  const { data: initialData, error } = await query
  let data = initialData
  if (error) throw error
  if (!data?.sender_email && webhookTags?.idempotencyKey) {
    const fallback = await admin
      .from('outreach_attempt_reservations')
      .select('sender_email')
      .eq('provider', 'resend')
      .eq('idempotency_key', webhookTags.idempotencyKey)
      .limit(1)
      .maybeSingle()
    if (fallback.error) throw fallback.error
    data = fallback.data
  }
  return typeof data?.sender_email === 'string'
    ? data.sender_email.trim().toLowerCase() || null
    : null
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
  const allowedCurrentStatuses = deliveryProjectionAllowedCurrentStatuses(input.status)
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
    .in('status', allowedCurrentStatuses)
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
        .or(`outreach_status.is.null,outreach_status.in.(${allowedCurrentStatuses.join(',')})`)
      if (buyerError) throw buyerError
    }
  }

  const { error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: input.status === 'delivery_delayed' ? 'accepted' : input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('last_message_id', `buyer-packet:${input.packetSend.buyer_packet_id}:${input.packetSend.buyer_id}`)
    .in('status', allowedCurrentStatuses)
  if (enrollmentError) throw enrollmentError

  return {
    packetId: input.packetSend.buyer_packet_id,
    packetSendId: input.packetSend.id,
    status: nextStatus,
  }
}

async function recordPartnerOutreachDelivery(input: {
  match: NonNullable<Awaited<ReturnType<typeof findPartnerOutreachRecord>>>
  status: ProviderDeliveryStatus
  reason: string | null
  occurredAt: string
  providerEventId: string
}) {
  const admin = createAdminClient()
  const failureStatus = ['bounced', 'complained', 'suppressed', 'failed'].includes(input.status)
  const allowedCurrentStatuses = deliveryProjectionAllowedCurrentStatuses(input.status)
  const { error: messageError } = await admin
    .from(input.match.messageTable)
    .update({
      ...(failureStatus ? { status: 'failed' } : {}),
      send_error: failureStatus ? input.reason || `Resend reported ${input.status}.` : null,
      metadata_json: {
        ...(input.match.metadata_json || {}),
        deliveryStatus: input.status,
        lastProviderEventId: input.providerEventId,
        lastProviderEventAt: input.occurredAt,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.match.id)
    .in('status', allowedCurrentStatuses)
  if (messageError) throw messageError

  if (failureStatus && input.match.entityId) {
    const doNotContact = ['complained', 'suppressed'].includes(input.status)
    const { error: entityError } = await admin
      .from(input.match.entityTable)
      .update({
        outreach_status: doNotContact ? 'do_not_contact' : 'failed',
        next_follow_up_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.match.entityId)
      .or(`outreach_status.is.null,outreach_status.in.(${allowedCurrentStatuses.join(',')})`)
    if (entityError) throw entityError
  }

  return { recordType: input.match.recordType, recordId: input.match.id, status: input.status }
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
  const rawWebhookTags = 'tags' in event.data ? event.data.tags : undefined
  const webhookTags = parseResendOutreachIdentityTags(rawWebhookTags)
  const recipient = event.data.to?.[0]?.trim().toLowerCase() || null
  const subject = event.data.subject || null
  const reason = getFailureReason(event)
  const metadata = {
    eventType: event.type,
    recipientCount: event.data.to?.length || 0,
    bounce: event.type === 'email.bounced' ? event.data.bounce : null,
    failed: event.type === 'email.failed' ? event.data.failed : null,
    suppressed: event.type === 'email.suppressed' ? event.data.suppressed : null,
    webhookTags: rawWebhookTags || null,
  }

  const [outreachEvent, buyerPacketSend, partnerOutreach, senderEmail] = await Promise.all([
    findOutreachEvent(providerMessageId, webhookTags),
    findBuyerPacketSend(providerMessageId, webhookTags),
    findPartnerOutreachRecord(providerMessageId, webhookTags),
    findThroughputAttemptSender(providerMessageId, webhookTags),
  ])
  const outboundIdentity = buildResendDeliveryIdentityMetadata({
    leadOutreach: outreachEvent,
    partnerOutreach,
    buyerPacketSend,
    webhookTags,
  })

  const { data: inserted, error: insertError } = await admin
    .from('provider_delivery_events')
    .upsert(
      {
        provider: 'resend',
        provider_event_id: providerEventId,
        provider_message_id: providerMessageId,
        sender_email: senderEmail,
        event_type: event.type,
        delivery_status: status,
        recipient,
        subject,
        reason,
        metadata_json: {
          ...metadata,
          ...outboundIdentity,
          ...(senderEmail ? { outboundSenderEmail: senderEmail } : {}),
        },
        occurred_at: event.created_at,
      },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()

  if (insertError) throw insertError
  const duplicateEvent = !inserted?.id
  const { data: providerEvents, error: providerEventsError } = await admin
    .from('provider_delivery_events')
    .select('provider_event_id,delivery_status,reason,occurred_at,created_at')
    .eq('provider', 'resend')
    .eq('provider_message_id', providerMessageId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (providerEventsError) throw providerEventsError
  const latestProviderEvent = selectResendDeliveryProjection(
    (providerEvents || []) as Array<{
      provider_event_id: string
      delivery_status: ProviderDeliveryStatus
      reason?: string | null
      occurred_at: string
      created_at?: string | null
    }>
  )
  if (!latestProviderEvent) throw new Error('Resend delivery projection evidence was not found after insert.')
  const projectedStatus = latestProviderEvent.delivery_status
  const projectedReason = latestProviderEvent.reason || null
  const projectedOccurredAt = latestProviderEvent.occurred_at
  const projectedProviderEventId = latestProviderEvent.provider_event_id
  const allowedCurrentStatuses = deliveryProjectionAllowedCurrentStatuses(projectedStatus)
  const recordThroughputBestEffort = async () => {
    try {
      const providerResult = await recordOutreachThroughputProviderOutcome({
        provider: 'resend',
        providerMessageId,
        state: throughputOutcome(status),
        metadata: {
          providerEventId,
          providerEventType: event.type,
          occurredAt: event.created_at,
        },
      })
      if (
        providerResult &&
        typeof providerResult === 'object' &&
        'updated' in providerResult &&
        providerResult.updated === true
      ) return providerResult
      if (!webhookTags?.idempotencyKey) return providerResult

      const { data: taggedReservation, error: taggedReservationError } = await admin
        .from('outreach_attempt_reservations')
        .select('id')
        .eq('provider', 'resend')
        .eq('idempotency_key', webhookTags.idempotencyKey)
        .maybeSingle()
      if (taggedReservationError) throw taggedReservationError
      if (!taggedReservation?.id) return providerResult
      return await recordOutreachThroughputOutcome({
        reservationId: taggedReservation.id,
        state: throughputOutcome(status),
        providerMessageId,
        metadata: {
          providerEventId,
          providerEventType: event.type,
          occurredAt: event.created_at,
          matchedBy: 'resend_webhook_idempotency_tag',
        },
      })
    } catch (error) {
      console.error('[resend-webhook] throughput outcome reconciliation failed', error)
      return { updated: false, reason: 'throughput_outcome_reconciliation_failed' }
    }
  }

  const effectiveRecipient = recipient || outreachEvent?.recipient || buyerPacketSend?.buyer_email || null
  if (['bounced', 'complained', 'suppressed', 'failed'].includes(status)) {
    await suppressAndCancelPendingOutreach({
      email: effectiveRecipient,
      reason: reason || `Resend reported ${status}.`,
    })
  }

  const { error: emailEventError } = await admin
    .from('email_events')
    .update({
      status: EMAIL_EVENT_STATUS[projectedStatus],
      error_message: projectedReason,
    })
    .eq('provider_message_id', providerMessageId)
    .in('status', allowedCurrentStatuses)
  if (emailEventError) throw emailEventError

  const buyerPacket = buyerPacketSend
      ? await recordBuyerPacketDelivery({
        packetSend: buyerPacketSend,
        status: projectedStatus,
        reason: projectedReason,
        occurredAt: projectedOccurredAt,
        providerEventId: projectedProviderEventId,
        providerMessageId,
      })
    : null

  const partnerDelivery = partnerOutreach
      ? await recordPartnerOutreachDelivery({
        match: partnerOutreach,
        status: projectedStatus,
        reason: projectedReason,
        occurredAt: projectedOccurredAt,
        providerEventId: projectedProviderEventId,
      })
    : null

  if (!outreachEvent?.lead_id) {
    const throughputTracking = await recordThroughputBestEffort()
    return {
      recorded: true,
      duplicateEvent,
      matched: Boolean(buyerPacket || partnerDelivery),
      status,
      projectedStatus,
      providerMessageId,
      buyerPacket,
      partnerDelivery,
      throughputTracking,
    }
  }

  const { error: eventError } = await admin.from('outreach_send_events').upsert({
      lead_id: outreachEvent.lead_id,
      outreach_message_id: outreachEvent.outreach_message_id || null,
      channel: 'email',
      provider: 'resend',
      provider_event_id: providerEventId,
      status,
      recipient: recipient || outreachEvent.recipient || null,
      subject: subject || outreachEvent.subject || null,
      error_message: reason,
      metadata_json: {
        ...outboundIdentity,
        providerEventId,
        providerMessageId,
        eventType: event.type,
        occurredAt: event.created_at,
      },
    }, { onConflict: 'provider,provider_event_id', ignoreDuplicates: true })
  if (eventError) throw eventError

  const leadUpdates: Record<string, unknown> = {
    delivery_status: LEAD_DELIVERY_STATUS[projectedStatus],
  }

  if (['bounced', 'complained', 'suppressed', 'failed'].includes(projectedStatus)) {
    leadUpdates.email_valid = false
    leadUpdates.suppression_reason = projectedReason || `Resend reported ${projectedStatus}.`
    leadUpdates.outreach_status = projectedStatus === 'complained' ? 'do_not_contact' : 'failed'
  }

  const { error: leadError } = await admin
    .from('leads')
    .update(leadUpdates)
    .eq('id', outreachEvent.lead_id)
    .or(`delivery_status.is.null,delivery_status.in.(${allowedCurrentStatuses.join(',')})`)
  if (leadError) throw leadError

  const membershipStatus = projectedStatus === 'delivery_delayed' ? 'accepted' : projectedStatus
  const { data: memberships, error: membershipError } = await admin
    .from('strategy_lead_memberships')
    .update({
      status: membershipStatus,
      last_outcome_at: projectedOccurredAt,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', outreachEvent.lead_id)
    .in('status', allowedCurrentStatuses)
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
    .in('status', allowedCurrentStatuses)
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

  const throughputTracking = await recordThroughputBestEffort()

  return {
    recorded: true,
    duplicateEvent,
    matched: true,
    status,
    projectedStatus,
    providerMessageId,
    leadId: outreachEvent.lead_id,
    buyerPacket,
    partnerDelivery,
    throughputTracking,
  }
}
