export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { commandCenterDataIntegrityHoldResponse, isCommandCenterDataIntegrityHold } from '@/lib/admin/command-center-data-integrity'
import { updateBuyerOutreachMessageSchema } from '@/lib/buyers/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBuyerById, insertBuyerRelationshipEvent, updateBuyerOutreachMessage, updateBuyerPerformance, updateBuyerRecord } from '@/lib/buyers/repository'
import { sendBuyerOutreachEmail } from '@/lib/buyers/outbound'
import { getOutboundProviderReadiness } from '@/lib/leads/outbound'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
} from '@/lib/strategy/runtime-governance'
import { logEvent } from '@/lib/system/logEvent'

const GOVERNED_BUYER_NAMESPACE = 'legacy_runtime'
const GOVERNED_BUYER_SOURCE_IDENTIFIER = 'buyer-network'

function selectEmailDispatchAdapter(
  readiness: ReturnType<typeof getOutboundProviderReadiness>
) {
  if (readiness.resend) return { provider: 'resend' as const, channel: 'resend_email' }
  if (readiness.gmail) return { provider: 'gmail' as const, channel: 'gmail_email' }
  throw new Error('Buyer dispatch requires a configured outbound email provider.')
}

async function authorizeBuyerEmailDispatch() {
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    throw new Error(replyCapture.reason || 'Buyer dispatch is blocked because reply capture is disconnected.')
  }
  const readiness = getOutboundProviderReadiness()
  const adapter = selectEmailDispatchAdapter(readiness)
  const binding = await authorizeOperatingStrategyDispatch({
    namespace: GOVERNED_BUYER_NAMESPACE,
    sourceIdentifier: GOVERNED_BUYER_SOURCE_IDENTIFIER,
    channel: adapter.channel,
    requestedExternalSends: 1,
    requiredDispatchAuthority: 'vestblock_application',
  })
  return { binding, adapter, readiness }
}

async function buyerConsentSnapshot(buyerId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('id,role,status,communication_preferences_json,outreach_consent,outreach_consent_at,consent_version,consent_recorded_at,operator_verified_at,legacy_claim_status')
    .eq('legacy_entity_type', 'buyers')
    .eq('legacy_entity_id', buyerId)
    .limit(2)
  if (error) throw error
  if ((data || []).length !== 1) {
    throw new Error('Buyer dispatch requires exactly one operator-verified participant-profile link with first-class outreach consent.')
  }
  const profile = data![0]
  const preferences = (profile.communication_preferences_json || {}) as Record<string, unknown>
  if (
    profile.role !== 'buyer' ||
    profile.status !== 'active' ||
    profile.legacy_claim_status !== 'verified' ||
    !profile.operator_verified_at ||
    profile.outreach_consent !== true ||
    !profile.outreach_consent_at ||
    preferences.email !== true
  ) {
    throw new Error('Buyer dispatch is blocked until the linked active profile has verified ownership, email permission, and recorded outreach consent.')
  }
  return {
    basis: 'participant_profile_outreach_consent',
    dispatchAuthorized: true,
    evidenceKey: `participant-profile:${profile.id}:outreach-consent:${profile.outreach_consent_at}`,
    provenance: {
      sourceTable: 'participant_profiles',
      participantProfileId: profile.id,
      legacyEntityType: 'buyers',
      legacyEntityId: buyerId,
      consentVersion: profile.consent_version,
      consentRecordedAt: profile.consent_recorded_at,
      outreachConsentAt: profile.outreach_consent_at,
      operatorVerifiedAt: profile.operator_verified_at,
    },
  }
}

async function buyerSuppressionSnapshot(buyerId: string, email: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_suppressions')
    .select('id,reason')
    .eq('email', email.trim().toLowerCase())
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data?.id) throw new Error(`Buyer recipient is suppressed: ${data.reason || 'active suppression'}.`)
  const checkedAt = new Date().toISOString()
  return {
    checkedAt,
    suppressionCleared: true,
    evidenceKey: `buyer-suppression-preflight:${buyerId}:${checkedAt}`,
    provenance: { sourceTable: 'lead_suppressions', matchField: 'email', subjectId: buyerId },
    activeSuppression: false,
    usableEmail: true,
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = updateBuyerOutreachMessageSchema.safeParse(await request.json().catch(() => ({})))
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

      const authorization = await authorizeBuyerEmailDispatch()
      if (buyer.outreach_status === 'do_not_contact') {
        throw new Error('Buyer dispatch is blocked because the buyer is marked do not contact.')
      }
      const consentBasisSnapshot = await buyerConsentSnapshot(buyer.id)
      const suppressionSnapshot = await buyerSuppressionSnapshot(buyer.id, buyer.contact_email!)
      const nextActionAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
      const messageVersionKey = `${updatedMessage.id}:approved:${updatedMessage.approved_at || updatedMessage.updated_at}`
      const reservation = await reserveOperatingStrategyDispatch({
        binding: authorization.binding,
        channel: authorization.adapter.channel,
        requestedCount: 1,
        idempotencyKey: `buyer-admin-outreach:${authorization.binding.operatingStrategyVersionId}:${messageVersionKey}`,
      })
      const dispatchIntentAt = new Date().toISOString()
      const enrollmentBase = {
        strategyKey: authorization.binding.sourceIdentifier,
        channel: 'email' as const,
        messageId: updatedMessage.id,
        recipient: buyer.contact_email,
        market: [buyer.headquarters_city, buyer.headquarters_state].filter(Boolean).join(', '),
        binding: authorization.binding,
        governedStage: 'dispatch_intent' as const,
        subjectNamespace: 'buyer',
        subjectKey: buyer.id,
        dispatchIntentAt,
        dispatchReservationId: reservation.reservationId,
        dispatchChannel: authorization.adapter.channel,
        provider: authorization.adapter.provider,
        outreachPurpose: 'operator_initiated_buyer_outreach',
        consentBasisSnapshot: {
          ...consentBasisSnapshot,
          actorUserId: user?.id || null,
          messageStatus: updatedMessage.status,
          approvedAt: updatedMessage.approved_at,
          approvedByUserId: updatedMessage.approved_by_user_id,
          capturedAt: dispatchIntentAt,
        },
        suppressionSnapshot,
        messageVersionKey,
      }
      const dispatchIntent = await recordOutboundEnrollment({
        ...enrollmentBase,
        status: 'queued',
        nextActionAt,
        metadata: {
          buyerId: buyer.id,
          buyerCategory: buyer.category,
          authorizedChannels: [authorization.adapter.channel],
          deliveryMode: 'manual_admin',
        },
      })

      const sendResult = await sendBuyerOutreachEmail({
        buyer,
        message: updatedMessage as any,
        provider: authorization.adapter.provider,
        disableFallback: true,
      })

      if (!sendResult.ok) {
        const failedAt = new Date().toISOString()
        await recordOutboundEnrollment({
          ...enrollmentBase,
          enrollmentId: dispatchIntent.id,
          status: 'failed',
          provider: sendResult.provider,
          suppressionReason: sendResult.error || 'send_failed',
          nextActionAt: null,
          metadata: {
            buyerId: buyer.id,
            buyerCategory: buyer.category,
            authorizedChannels: [authorization.adapter.channel],
            deliveryMode: 'manual_admin',
            error: sendResult.error || 'send_failed',
            providerResultAt: failedAt,
          },
        })
        const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
          subjectNamespace: 'buyer',
          subjectKey: buyer.id,
          messageId: updatedMessage.id,
          enrollmentId: dispatchIntent.id,
          operatingStrategyVersionId: authorization.binding.operatingStrategyVersionId,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId || null,
          evidenceId: `buyer-admin-outreach:${updatedMessage.id}:${sendResult.provider}:failed`,
          status: 'failed',
          occurredAt: failedAt,
        })
        if (!failedDeliveryOutcome.updated) {
          throw new Error(`Buyer delivery outcome attribution failed: ${failedDeliveryOutcome.reason}.`)
        }
        await updateBuyerOutreachMessage(message.id, {
          status: 'failed',
          send_provider: sendResult.provider,
          send_error: sendResult.error || 'Send failed.',
          metadata_json: {
            ...(updatedMessage.metadata_json || {}),
            providerResultAt: failedAt,
          },
        })
        await updateBuyerRecord(id, { outreach_status: 'failed' })
        return NextResponse.json({ error: sendResult.error || 'Send failed.' }, { status: 500 })
      }

      const acceptedAt = new Date().toISOString()
      await recordOutboundEnrollment({
        ...enrollmentBase,
        enrollmentId: dispatchIntent.id,
        status: 'accepted',
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        nextActionAt,
        metadata: {
          buyerId: buyer.id,
          buyerCategory: buyer.category,
          authorizedChannels: [authorization.adapter.channel],
          deliveryMode: 'manual_admin',
          providerResultAt: acceptedAt,
        },
      })
      const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
        subjectNamespace: 'buyer',
        subjectKey: buyer.id,
        messageId: updatedMessage.id,
        enrollmentId: dispatchIntent.id,
        operatingStrategyVersionId: authorization.binding.operatingStrategyVersionId,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        evidenceId: `buyer-admin-outreach:${updatedMessage.id}:${sendResult.provider}:${sendResult.providerMessageId || 'accepted'}`,
        status: 'accepted',
        occurredAt: acceptedAt,
      })
      if (!acceptedDeliveryOutcome.updated) {
        throw new Error(`Buyer delivery outcome attribution failed: ${acceptedDeliveryOutcome.reason}.`)
      }
      await updateBuyerOutreachMessage(message.id, {
        status: 'sent',
        sent_at: acceptedAt,
        send_provider: sendResult.provider,
        send_error: null,
        metadata_json: {
          ...(updatedMessage.metadata_json || {}),
          providerMessageId: sendResult.providerMessageId || null,
          providerResultAt: acceptedAt,
        },
      })
      await updateBuyerRecord(id, {
        relationship_stage: 'contacted',
        outreach_status: 'sent',
        last_contacted_at: acceptedAt,
        next_follow_up_at: nextActionAt,
      })
      await updateBuyerPerformance(id, {
        outreach_sent_count: detail.performance ? detail.performance.outreach_sent_count + 1 : 1,
        last_contacted_at: acceptedAt,
      })
      await insertBuyerRelationshipEvent({
        buyerId: id,
        eventType: 'outreach_sent',
        actorUserId: user?.id || null,
        metadata: { channel: message.channel, provider: sendResult.provider, providerMessageId: sendResult.providerMessageId || null, providerResultAt: acceptedAt },
      })
      await logEvent({
        eventType: 'buyer_outreach_sent',
        actorUserId: user?.id,
        entityType: 'buyer',
        entityId: id,
        metadata: { provider: sendResult.provider, providerResultAt: acceptedAt },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Buyer outreach update failed.' }, { status: 500 })
  }
}
