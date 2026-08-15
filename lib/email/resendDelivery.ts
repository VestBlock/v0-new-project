import 'server-only'

import type { WebhookEventPayload } from 'resend'

import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
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

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalJson(child)])
  )
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
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

async function findGenericEmailEvent(providerMessageId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_events')
    .select('id')
    .eq('provider_message_id', providerMessageId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function findGovernedEnrollmentForDelivery(input: {
  providerMessageId: string
  localMessageId?: string | null
}) {
  const admin = createAdminClient()
  const select = 'id,operating_strategy_version_id,dispatch_channel,provider,provider_message_id'
  const byProvider = await admin
    .from('command_center_outbound_enrollments')
    .select(select)
    .eq('strategy_binding_mode', 'governed_v1')
    .eq('provider', 'resend')
    .eq('provider_message_id', input.providerMessageId)
    .limit(2)
  if (byProvider.error) throw byProvider.error
  if ((byProvider.data || []).length > 1) {
    throw new Error('Resend callback matched more than one governed outbound enrollment.')
  }
  if (byProvider.data?.[0]) {
    if (byProvider.data[0].dispatch_channel !== 'resend_email') {
      throw new Error('Resend callback conflicts with the governed enrollment dispatch adapter.')
    }
    return byProvider.data[0]
  }

  const localMessageId = String(input.localMessageId || '').trim()
  if (!localMessageId) return null
  const byLocalMessage = await admin
    .from('command_center_outbound_enrollments')
    .select(select)
    .eq('strategy_binding_mode', 'governed_v1')
    .eq('channel', 'email')
    .eq('last_message_id', localMessageId)
    .limit(2)
  if (byLocalMessage.error) throw byLocalMessage.error
  if ((byLocalMessage.data || []).length > 1) {
    throw new Error('Resend callback local message identity matched more than one governed enrollment.')
  }
  const matched = byLocalMessage.data?.[0]
  if (
    matched &&
    (matched.dispatch_channel !== 'resend_email' ||
      (matched.provider && matched.provider !== 'resend') ||
      (matched.provider_message_id && matched.provider_message_id !== input.providerMessageId))
  ) {
    throw new Error('Resend callback provider identity conflicts with the governed local-message enrollment.')
  }
  return matched || null
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
    .is('operating_strategy_version_id', null)

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
  const duplicate = !inserted?.id
  let occurredAt = event.created_at
  if (duplicate) {
    const existingEvent = await admin
      .from('provider_delivery_events')
      .select('id,provider_message_id,event_type,delivery_status,recipient,subject,reason,metadata_json,occurred_at')
      .eq('provider', 'resend')
      .eq('provider_event_id', providerEventId)
      .single()
    if (existingEvent.error) throw existingEvent.error
    if (
      existingEvent.data.provider_message_id !== providerMessageId ||
      existingEvent.data.event_type !== event.type ||
      existingEvent.data.delivery_status !== status ||
      existingEvent.data.recipient !== recipient ||
      existingEvent.data.subject !== subject ||
      existingEvent.data.reason !== reason ||
      !sameJson(existingEvent.data.metadata_json, metadata) ||
      Date.parse(existingEvent.data.occurred_at) !== Date.parse(event.created_at)
    ) {
      throw new Error('Resend provider-event replay conflicts with immutable delivery evidence.')
    }
    occurredAt = existingEvent.data.occurred_at
  }

  const [outreachEvent, buyerPacketSend, genericEmailEvent] = await Promise.all([
    findOutreachEvent(providerMessageId),
    findBuyerPacketSend(providerMessageId),
    findGenericEmailEvent(providerMessageId),
  ])
  const localMessageId =
    outreachEvent?.outreach_message_id ||
    (buyerPacketSend
      ? `buyer-packet:${buyerPacketSend.buyer_packet_id}:${buyerPacketSend.buyer_id}`
      : null)
  const governedEnrollment = await findGovernedEnrollmentForDelivery({
    providerMessageId,
    localMessageId,
  })
  const governedStatus = status === 'delivery_delayed' ? 'accepted' : status
  const governedAttribution = governedEnrollment && governedStatus !== 'queued'
    ? await recordStrategyDeliveryOutcome({
        messageId: localMessageId || `resend:${providerMessageId}`,
        enrollmentId: governedEnrollment.id,
        operatingStrategyVersionId: governedEnrollment.operating_strategy_version_id,
        status: governedStatus,
        occurredAt,
        provider: 'resend',
        providerMessageId,
        providerEventId,
      })
    : null
  if (governedAttribution && !governedAttribution.updated) {
    throw new Error(
      `Resend governed delivery attribution failed closed: ${governedAttribution.reason}.`
    )
  }
  if (!governedEnrollment && !outreachEvent && !buyerPacketSend && !genericEmailEvent) {
    throw new Error(
      'Resend delivery event has no durable local message identity yet; retry attribution before acknowledging it.'
    )
  }

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
        occurredAt,
        providerEventId,
        providerMessageId,
      })
    : null

  if (!outreachEvent?.lead_id) {
    return {
      recorded: !duplicate,
      ...(duplicate ? { reason: 'duplicate' as const } : {}),
      matched: Boolean(buyerPacket || governedAttribution?.updated),
      status,
      providerMessageId,
      buyerPacket,
      governedAttribution,
    }
  }

  let outreachDeliveryEventExists = false
  if (duplicate) {
    const existingOutreachDeliveryEvent = await admin
      .from('outreach_send_events')
      .select('id')
      .eq('provider', 'resend')
      .contains('metadata_json', { providerEventId })
      .limit(1)
      .maybeSingle()
    if (existingOutreachDeliveryEvent.error) throw existingOutreachDeliveryEvent.error
    outreachDeliveryEventExists = Boolean(existingOutreachDeliveryEvent.data?.id)
  }
  if (!outreachDeliveryEventExists) {
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
        occurredAt,
      },
    })
    if (eventError) throw eventError
  }

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
      last_outcome_at: occurredAt,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', outreachEvent.lead_id)
    .is('operating_strategy_version_id', null)
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
    .is('operating_strategy_version_id', null)
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
      .is('operating_strategy_version_id', null)
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
      .is('operating_strategy_version_id', null)
    if (runError) throw runError
  }

  return {
    recorded: !duplicate,
    ...(duplicate ? { reason: 'duplicate' as const } : {}),
    matched: true,
    status,
    providerMessageId,
    leadId: outreachEvent.lead_id,
    buyerPacket,
    governedAttribution,
  }
}
