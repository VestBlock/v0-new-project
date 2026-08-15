import 'server-only'

import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { sendBuyerPacketEmail } from '@/lib/buyers/outbound'
import { getOutboundProviderReadiness } from '@/lib/leads/outbound'
import {
  getBuyerPacketById,
  insertBuyerRelationshipEvent,
  updateBuyerMatchStatus,
  updateBuyerPacket,
  updateBuyerRecord,
  upsertBuyerPacketSend,
  upsertDealPipelineItem,
} from '@/lib/buyers/repository'
import type { BuyerPacketRecord, BuyerRecord } from '@/lib/buyers/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { buildBuyerPacketFileName, buildPremiumBuyerPacketPdf } from '@/lib/property/buyerPacketPdf'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
} from '@/lib/strategy/runtime-governance'
import { logEvent } from '@/lib/system/logEvent'

const GOVERNED_BUYER_PACKET_NAMESPACE = 'legacy_runtime'
const GOVERNED_BUYER_PACKET_SOURCE_IDENTIFIER = 'buyer-packet-routing'

function selectEmailDispatchAdapter(
  readiness: ReturnType<typeof getOutboundProviderReadiness>
) {
  if (readiness.resend) return { provider: 'resend' as const, channel: 'resend_email' }
  if (readiness.gmail) return { provider: 'gmail' as const, channel: 'gmail_email' }
  throw new Error('Buyer-packet dispatch requires a configured outbound email provider.')
}

async function authorizeBuyerPacketDispatch() {
  const readiness = getOutboundProviderReadiness()
  const adapter = selectEmailDispatchAdapter(readiness)
  const binding = await authorizeOperatingStrategyDispatch({
    namespace: GOVERNED_BUYER_PACKET_NAMESPACE,
    sourceIdentifier: GOVERNED_BUYER_PACKET_SOURCE_IDENTIFIER,
    channel: adapter.channel,
    requestedExternalSends: 1,
    requiredDispatchAuthority: 'vestblock_application',
  })
  return { binding, adapter, readiness }
}

async function buyerPacketConsentSnapshot(buyerId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('id,role,status,communication_preferences_json,matching_consent,matching_consent_at,outreach_consent,outreach_consent_at,consent_version,consent_recorded_at,operator_verified_at,legacy_claim_status')
    .eq('legacy_entity_type', 'buyers')
    .eq('legacy_entity_id', buyerId)
    .limit(2)
  if (error) throw error
  if ((data || []).length !== 1) {
    throw new Error('Buyer-packet dispatch requires exactly one operator-verified participant-profile link with first-class matching and outreach consent.')
  }
  const profile = data![0]
  const preferences = (profile.communication_preferences_json || {}) as Record<string, unknown>
  if (
    profile.role !== 'buyer' ||
    profile.status !== 'active' ||
    profile.legacy_claim_status !== 'verified' ||
    !profile.operator_verified_at ||
    profile.matching_consent !== true ||
    !profile.matching_consent_at ||
    profile.outreach_consent !== true ||
    !profile.outreach_consent_at ||
    preferences.email !== true
  ) {
    throw new Error('Buyer-packet dispatch is blocked until the linked active profile has verified ownership, matching consent, and email outreach consent.')
  }
  return {
    basis: 'participant_profile_matching_and_outreach_consent',
    dispatchAuthorized: true,
    evidenceKey: `participant-profile:${profile.id}:matching:${profile.matching_consent_at}:outreach:${profile.outreach_consent_at}`,
    provenance: {
      sourceTable: 'participant_profiles',
      participantProfileId: profile.id,
      legacyEntityType: 'buyers',
      legacyEntityId: buyerId,
      consentVersion: profile.consent_version,
      consentRecordedAt: profile.consent_recorded_at,
      matchingConsentAt: profile.matching_consent_at,
      outreachConsentAt: profile.outreach_consent_at,
      operatorVerifiedAt: profile.operator_verified_at,
    },
  }
}

async function packetSuppressionSnapshot(packetId: string, buyerId: string, email: string) {
  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await admin
    .from('lead_suppressions')
    .select('id,reason')
    .eq('email', normalizedEmail)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data?.id) throw new Error(`Buyer-packet recipient is suppressed: ${data.reason || 'active suppression'}.`)
  const checkedAt = new Date().toISOString()
  return {
    checkedAt,
    suppressionCleared: true,
    evidenceKey: `buyer-packet-suppression-preflight:${packetId}:${buyerId}:${checkedAt}`,
    provenance: { sourceTable: 'lead_suppressions', matchField: 'email', packetId, buyerId },
    activeSuppression: false,
    usableEmail: true,
  }
}

type DeliveryOptions = {
  buyerIds?: string[]
  matchIds?: string[]
  sendAllMatches?: boolean
  actorUserId?: string | null
  dryRun?: boolean
  requireConfirmedBuyer?: boolean
  maxRecipients?: number
}

type DeliveryResult = {
  buyerId: string
  matchId: string
  ok: boolean
  status: string
  provider?: string
  error?: string
}

const ACCEPTED_OR_FURTHER = new Set([
  'accepted',
  'sent',
  'delivered',
  'opened',
  'replied',
  'interested',
])

const CONFIRMED_BUYER_STAGES = new Set(['responded', 'reviewing', 'active_buyer'])

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
    'acquisitions@vestblock.io',
    '',
    'If you do not want property opportunities from VestBlock, reply opt out and we will stop.',
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

function preserveRelationshipStage(stage: BuyerRecord['relationship_stage']) {
  return CONFIRMED_BUYER_STAGES.has(stage) ? stage : 'contacted'
}

async function loadMatches(packet: BuyerPacketRecord, options: DeliveryOptions) {
  const admin = createAdminClient()
  const packetMatchIds = metadataMatchIds(packet.metadata_json)
  const requestedMatchIds = options.matchIds || []
  const requestedBuyerIds = options.buyerIds || []
  const matchIds = options.sendAllMatches && packetMatchIds.length ? packetMatchIds : requestedMatchIds
  const limit = Math.min(Math.max(options.maxRecipients || 40, 1), 40)

  let query = admin
    .from('buyer_matches')
    .select('*, buyers(*)')
    .order('confidence_score', { ascending: false })
    .limit(limit)

  if (matchIds.length) query = query.in('id', matchIds)
  else if (requestedBuyerIds.length) query = query.in('buyer_id', requestedBuyerIds)
  else if (packetMatchIds.length) query = query.in('id', packetMatchIds)
  else query = query.eq('property_address', packet.property_address)

  const { data, error } = await query
  if (error) throw error
  return (data || []).filter((match: any) => match.buyers)
}

async function confirmedBuyerIds(rows: any[]) {
  const ids = Array.from(new Set(rows.map((row) => String(row.buyer_id || '')).filter(Boolean)))
  if (!ids.length) return new Set<string>()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_buy_boxes')
    .select('buyer_id')
    .in('buyer_id', ids)
    .eq('active', true)
  if (error) throw error
  return new Set((data || []).map((row) => String(row.buyer_id)))
}

export async function deliverBuyerPacket(packetId: string, options: DeliveryOptions = {}) {
  const admin = createAdminClient()
  const packet = await getBuyerPacketById(packetId)
  const allRows = await loadMatches(packet, options)
  const activeBuyBoxBuyerIds = options.requireConfirmedBuyer ? await confirmedBuyerIds(allRows) : new Set<string>()
  const buyerIds = allRows.map((row: any) => String(row.buyer_id || '')).filter(Boolean)
  const { data: existingSends, error: existingError } = buyerIds.length
    ? await admin
        .from('property_buyer_packet_sends')
        .select('buyer_id,status')
        .eq('buyer_packet_id', packet.id)
        .in('buyer_id', buyerIds)
    : { data: [], error: null }
  if (existingError) throw existingError
  const existingByBuyer = new Map((existingSends || []).map((row) => [String(row.buyer_id), String(row.status)]))

  const selectedBuyerIds = new Set<string>()
  const rows = allRows.filter((match: any) => {
    const buyer = match.buyers as BuyerRecord
    if (!buyer || buyer.outreach_status === 'do_not_contact') return false
    if (ACCEPTED_OR_FURTHER.has(existingByBuyer.get(String(buyer.id)) || '')) return false
    if (
      options.requireConfirmedBuyer &&
      (!CONFIRMED_BUYER_STAGES.has(buyer.relationship_stage) || !activeBuyBoxBuyerIds.has(buyer.id))
    ) {
      return false
    }
    if (selectedBuyerIds.has(buyer.id)) return false
    selectedBuyerIds.add(buyer.id)
    return true
  })

  if (!rows.length) {
    return {
      packet,
      recipientCount: 0,
      acceptedCount: 0,
      failedCount: 0,
      skippedCount: allRows.length,
      results: [] as DeliveryResult[],
    }
  }

  const subject = packetEmailSubject(packet.property_address)
  if (options.dryRun) {
    return {
      packet,
      recipientCount: rows.length,
      acceptedCount: 0,
      failedCount: 0,
      skippedCount: allRows.length - rows.length,
      results: rows.map((match: any) => ({
        buyerId: match.buyers.id,
        matchId: match.id,
        ok: true,
        status: 'would_send',
      })) as DeliveryResult[],
    }
  }

  const consentSnapshots = new Map<string, Awaited<ReturnType<typeof buyerPacketConsentSnapshot>>>()
  const suppressionSnapshots = new Map<string, Awaited<ReturnType<typeof packetSuppressionSnapshot>>>()
  let governedSendCount = 0
  for (const match of rows as any[]) {
    const buyer = match.buyers as BuyerRecord
    const email = buyer.contact_email?.trim() || ''
    if (!isUsableContactEmail(email)) continue
    governedSendCount += 1
    if (!consentSnapshots.has(buyer.id)) {
      consentSnapshots.set(buyer.id, await buyerPacketConsentSnapshot(buyer.id))
    }
    if (!suppressionSnapshots.has(buyer.id)) {
      suppressionSnapshots.set(buyer.id, await packetSuppressionSnapshot(packet.id, buyer.id, email))
    }
  }
  if (governedSendCount) {
    const replyCapture = getReplyCaptureReadiness()
    if (!replyCapture.ready) {
      throw new Error(replyCapture.reason || 'Buyer-packet dispatch is blocked because reply capture is disconnected.')
    }
  }
  const authorization = governedSendCount ? await authorizeBuyerPacketDispatch() : null

  await updateBuyerPacket(packet.id, { status: 'sending' })
  const pdf = await buildPremiumBuyerPacketPdf({
    reportType: 'buyer',
    address: packet.property_address,
    form: packet.input_json,
    estimate: packet.estimate_json,
    opportunity: packet.opportunity_json,
  })
  const filename = packet.file_name || buildBuyerPacketFileName(packet.property_address)
  const results: DeliveryResult[] = []
  let acceptedCount = 0

  for (const match of rows as any[]) {
    const buyer = match.buyers as BuyerRecord
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
      results.push({ buyerId: buyer.id, matchId: match.id, ok: false, status: 'failed', error: 'Buyer does not have a usable email.' })
      continue
    }

    const body = packetEmailBody({
      address: packet.property_address,
      buyerName: buyer.contact_name || buyer.name,
      summary: packet.summary,
    })
    if (!authorization) {
      throw new Error('Buyer-packet dispatch authorization is missing for an eligible external recipient.')
    }
    const nextActionAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const messageId = `buyer-packet:${packet.id}:${buyer.id}`
    const messageVersionKey = `${messageId}:${packet.updated_at}`
    const reservation = await reserveOperatingStrategyDispatch({
      binding: authorization.binding,
      channel: authorization.adapter.channel,
      requestedCount: 1,
      idempotencyKey: `buyer-packet:${authorization.binding.operatingStrategyVersionId}:${messageVersionKey}`,
    })
    const dispatchIntentAt = new Date().toISOString()
    const enrollmentBase = {
      strategyKey: authorization.binding.sourceIdentifier,
      channel: 'email' as const,
      messageId,
      recipient: email,
      leadId: String((packet.metadata_json as Record<string, unknown>)?.leadId || '') || null,
      market: [packet.city, packet.state].filter(Boolean).join(', ') || null,
      propertyAddress: packet.property_address,
      binding: authorization.binding,
      governedStage: 'dispatch_intent' as const,
      subjectNamespace: 'buyer_packet',
      subjectKey: packet.id,
      dispatchIntentAt,
      dispatchReservationId: reservation.reservationId,
      dispatchChannel: authorization.adapter.channel,
      provider: authorization.adapter.provider,
      outreachPurpose: 'operator_reviewed_buyer_packet',
      consentBasisSnapshot: {
        ...consentSnapshots.get(buyer.id)!,
        actorUserId: options.actorUserId || null,
        buyerMatchId: match.id,
        matchStatus: match.status || null,
        requireConfirmedBuyer: Boolean(options.requireConfirmedBuyer),
        capturedAt: dispatchIntentAt,
      },
      suppressionSnapshot: suppressionSnapshots.get(buyer.id)!,
      messageVersionKey,
    }
    const dispatchIntent = await recordOutboundEnrollment({
      ...enrollmentBase,
      status: 'queued',
      nextActionAt,
      metadata: {
        packetId: packet.id,
        matchId: match.id,
        authorizedChannels: [authorization.adapter.channel],
      },
    })
    const sendResult = await sendBuyerPacketEmail({
      buyer,
      subject,
      body,
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
      provider: authorization.adapter.provider,
      disableFallback: true,
    })
    const providerResultAt = new Date().toISOString()
    const acceptedAt = sendResult.ok ? providerResultAt : null

    await recordOutboundEnrollment({
      ...enrollmentBase,
      enrollmentId: dispatchIntent.id,
      status: sendResult.ok ? 'accepted' : 'failed',
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      suppressionReason: sendResult.ok ? null : sendResult.error || 'send_failed',
      nextActionAt: sendResult.ok ? nextActionAt : null,
      metadata: {
        packetId: packet.id,
        matchId: match.id,
        authorizedChannels: [authorization.adapter.channel],
        error: sendResult.ok ? null : sendResult.error || 'send_failed',
        providerResultAt,
      },
    })
    const deliveryOutcome = await recordStrategyDeliveryOutcome({
      leadId: String((packet.metadata_json as Record<string, unknown>)?.leadId || '') || null,
      subjectNamespace: 'buyer_packet',
      subjectKey: packet.id,
      messageId,
      enrollmentId: dispatchIntent.id,
      operatingStrategyVersionId: authorization.binding.operatingStrategyVersionId,
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      evidenceId: sendResult.ok
        ? `buyer-packet:${packet.id}:${buyer.id}:${sendResult.provider}:${sendResult.providerMessageId || 'accepted'}`
        : `buyer-packet:${packet.id}:${buyer.id}:${sendResult.provider}:failed`,
      status: sendResult.ok ? 'accepted' : 'failed',
      occurredAt: providerResultAt,
    })
    if (!deliveryOutcome.updated) {
      throw new Error(`Buyer-packet delivery outcome attribution failed: ${deliveryOutcome.reason}.`)
    }

    await upsertBuyerPacketSend({
      buyerPacketId: packet.id,
      buyerId: buyer.id,
      buyerMatchId: match.id,
      buyerEmail: email,
      subject,
      status: sendResult.ok ? 'accepted' : 'failed',
      sendProvider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      sentAt: acceptedAt,
      sendError: sendResult.error || null,
      metadata: {
        confidenceScore: match.confidence_score,
        providerMessageId: sendResult.providerMessageId || null,
        providerAcceptedAt: acceptedAt,
        providerResultAt,
      },
    })

    if (!sendResult.ok) {
      results.push({
        buyerId: buyer.id,
        matchId: match.id,
        ok: false,
        status: 'failed',
        provider: sendResult.provider,
        error: sendResult.error,
      })
      continue
    }

    acceptedCount += 1
    await updateBuyerMatchStatus(match.id, {
      status: 'shared',
      metadata_json: {
        ...(match.metadata_json || {}),
        lastPacketId: packet.id,
        providerAcceptedAt: acceptedAt,
        lastPacketSubject: subject,
      },
    })
    await updateBuyerRecord(buyer.id, {
      relationship_stage: preserveRelationshipStage(buyer.relationship_stage),
      outreach_status: 'sent',
      last_contacted_at: acceptedAt,
      next_follow_up_at: nextActionAt,
    })
    await insertBuyerRelationshipEvent({
      buyerId: buyer.id,
      eventType: 'buyer_packet_accepted',
      actorUserId: options.actorUserId || null,
      metadata: {
        packetId: packet.id,
        matchId: match.id,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        propertyAddress: packet.property_address,
      },
    })
    results.push({
      buyerId: buyer.id,
      matchId: match.id,
      ok: true,
      status: 'accepted',
      provider: sendResult.provider,
    })
  }

  const failedCount = results.filter((item) => !item.ok).length
  const nextStatus = acceptedCount === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'accepted'
  const updatedPacket = await updateBuyerPacket(packet.id, {
    status: nextStatus,
    selected_buyer_count: rows.length,
    sent_count: acceptedCount,
    last_sent_at: acceptedCount > 0 ? new Date().toISOString() : packet.last_sent_at,
  })

  await upsertDealPipelineItem({
    propertyAnalysisRunId: packet.property_analysis_run_id,
    buyerPacketId: packet.id,
    leadId: String((packet.metadata_json as Record<string, unknown>)?.leadId || '') || null,
    propertyAddress: packet.property_address,
    city: packet.city,
    state: packet.state,
    zipCode: packet.zip_code,
    currentStage: acceptedCount > 0 ? 'buyer_packet_sent' : 'analyzed',
    priority: acceptedCount > 0 ? 'high' : 'normal',
    dealGrade: String((packet.opportunity_json as any)?.dealMath?.grade || ''),
    dealStrengthScore: numberOrNull((packet.opportunity_json as any)?.dealStrength?.score),
    buyerPacketSentCount: acceptedCount,
    estimatedAssignmentFee: numberOrNull((packet.opportunity_json as any)?.dealMath?.assignmentFee),
    expectedProfit: numberOrNull((packet.opportunity_json as any)?.dealMath?.endBuyerProfit),
    nextAction:
      acceptedCount > 0
        ? 'Confirm provider delivery, watch buyer replies, and move interested buyers into assignment terms.'
        : 'Fix buyer email coverage or reply capture, then retry this packet.',
    nextActionAt: acceptedCount > 0 ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() : null,
    metadata: { packetStatus: nextStatus, sendResults: results },
  })

  await logEvent({
    eventType: 'buyer_packet_provider_accepted',
    actorUserId: options.actorUserId || undefined,
    entityType: 'buyer_packet',
    entityId: packet.id,
    metadata: { acceptedCount, failedCount, propertyAddress: packet.property_address },
  })

  return {
    packet: updatedPacket,
    recipientCount: rows.length,
    acceptedCount,
    failedCount,
    skippedCount: allRows.length - rows.length,
    results,
  }
}
