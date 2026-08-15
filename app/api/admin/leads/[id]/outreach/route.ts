export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { commandCenterDataIntegrityHoldResponse, isCommandCenterDataIntegrityHold } from '@/lib/admin/command-center-data-integrity'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { sendLeadOutreachSentAlertEmail } from '@/lib/email/sendEmail'
import { classifyLeadRevenueCampaign, validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { updateOutreachMessageSchema } from '@/lib/leads/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLeadById, insertOutreachSendEvent, listSuppressions, updateLeadRecord, updateOutreachMessage } from '@/lib/leads/repository'
import { getOutboundProviderReadiness, sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
} from '@/lib/strategy/runtime-governance'
import { logEvent } from '@/lib/system/logEvent'

function selectEmailDispatchAdapter(
  readiness: ReturnType<typeof getOutboundProviderReadiness>
) {
  if (readiness.resend) return { provider: 'resend' as const, channel: 'resend_email' }
  if (readiness.gmail) return { provider: 'gmail' as const, channel: 'gmail_email' }
  throw new Error('Lead dispatch requires a configured outbound email provider.')
}

async function authorizeRevenueCampaignDispatch(sourceIdentifier: string) {
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    throw new Error(replyCapture.reason || 'Lead dispatch is blocked because reply capture is disconnected.')
  }
  const readiness = getOutboundProviderReadiness()
  if (!readiness.mailingAddressConfigured) {
    throw new Error('Lead dispatch requires a configured outreach mailing address.')
  }
  const adapter = selectEmailDispatchAdapter(readiness)
  const binding = await authorizeOperatingStrategyDispatch({
    namespace: 'revenue_campaign',
    sourceIdentifier,
    channel: adapter.channel,
    requestedExternalSends: 1,
    requiredDispatchAuthority: 'vestblock_application',
  })
  return { binding, adapter, readiness }
}

async function leadConsentSnapshot(leadId: string, recipient: string | null) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('id,role,status,origin,contact_email,communication_preferences_json,outreach_consent,outreach_consent_at,consent_version,consent_recorded_at,operator_verified_at')
    .eq('crm_lead_id', leadId)
    .limit(2)
  if (error) throw error
  if ((data || []).length !== 1) {
    throw new Error('Lead dispatch requires exactly one active participant profile with first-class outreach consent; operator approval alone is not authorization.')
  }
  const profile = data![0]
  const preferences = (profile.communication_preferences_json || {}) as Record<string, unknown>
  if (
    profile.status !== 'active' ||
    !profile.operator_verified_at ||
    profile.outreach_consent !== true ||
    !profile.outreach_consent_at ||
    preferences.email !== true ||
    String(profile.contact_email || '').trim().toLowerCase() !== String(recipient || '').trim().toLowerCase()
  ) {
    throw new Error('Lead dispatch is blocked until the linked active profile has verified identity, matching recipient email, email permission, and recorded outreach consent.')
  }
  return {
    basis: 'participant_profile_outreach_consent',
    dispatchAuthorized: true,
    evidenceKey: `participant-profile:${profile.id}:outreach-consent:${profile.outreach_consent_at}`,
    provenance: {
      sourceTable: 'participant_profiles',
      participantProfileId: profile.id,
      crmLeadId: leadId,
      role: profile.role,
      origin: profile.origin,
      consentVersion: profile.consent_version,
      consentRecordedAt: profile.consent_recorded_at,
      outreachConsentAt: profile.outreach_consent_at,
      operatorVerifiedAt: profile.operator_verified_at,
    },
  }
}

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
    if (parsed.data.sendNow && await isCommandCenterDataIntegrityHold()) {
      return commandCenterDataIntegrityHoldResponse()
    }

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
      const suppressions = await listSuppressions()
      const decision = getLeadEmailAutopilotDecision(lead, suppressions)
      const qualityIssue = validateOutreachMessageQuality({ lead, message: updatedMessage })
      let effectiveApprovedAt = updatedMessage.approved_at || null
      let effectiveApprovedByUserId = updatedMessage.approved_by_user_id || null

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
        effectiveApprovedAt = new Date().toISOString()
        effectiveApprovedByUserId = null
        await updateOutreachMessage(message.id, {
          status: 'approved',
          approved_at: effectiveApprovedAt,
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
      if (!decision.eligible) {
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

      const revenueCampaign = classifyLeadRevenueCampaign(lead, updatedMessage.subject || '')
      const authorization = await authorizeRevenueCampaignDispatch(revenueCampaign.key)
      const consentBasisSnapshot = await leadConsentSnapshot(id, lead.email)
      const nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      const messageVersionKey = `${updatedMessage.id}:approved:${effectiveApprovedAt || updatedMessage.updated_at}`
      const reservation = await reserveOperatingStrategyDispatch({
        binding: authorization.binding,
        channel: authorization.adapter.channel,
        requestedCount: 1,
        idempotencyKey: `lead-admin-outreach:${authorization.binding.operatingStrategyVersionId}:${messageVersionKey}`,
      })
      const dispatchIntentAt = new Date().toISOString()
      const enrollmentBase = {
        strategyKey: authorization.binding.sourceIdentifier,
        channel: 'email' as const,
        messageId: updatedMessage.id,
        recipient: lead.email,
        leadId: id,
        market: [lead.city, lead.state].filter(Boolean).join(', '),
        propertyAddress: lead.property_address,
        binding: authorization.binding,
        governedStage: 'dispatch_intent' as const,
        subjectNamespace: 'lead',
        subjectKey: id,
        dispatchIntentAt,
        dispatchReservationId: reservation.reservationId,
        dispatchChannel: authorization.adapter.channel,
        provider: authorization.adapter.provider,
        outreachPurpose: `revenue_campaign:${revenueCampaign.key}`,
        consentBasisSnapshot: {
          ...consentBasisSnapshot,
          actorUserId: user?.id || null,
          messageStatus: 'approved',
          approvedAt: effectiveApprovedAt,
          approvedByUserId: effectiveApprovedByUserId,
          capturedAt: dispatchIntentAt,
        },
        suppressionSnapshot: {
          checkedAt: dispatchIntentAt,
          suppressionCleared: true,
          evidenceKey: `lead-suppression-preflight:${id}:${dispatchIntentAt}`,
          provenance: { sourceTable: 'lead_suppressions', subjectId: id, decision: decision.reason },
          suppressionListLoaded: true,
          activeSuppression: decision.reason === 'suppressed',
          decisionEligible: decision.eligible,
          decisionReason: decision.reason,
          usableEmail: true,
          qualityApproved: true,
        },
        messageVersionKey,
      }
      const dispatchIntent = await recordOutboundEnrollment({
        ...enrollmentBase,
        status: 'queued',
        nextActionAt: nextFollowUpAt,
        metadata: {
          campaignLabel: revenueCampaign.label,
          authorizedChannels: [authorization.adapter.channel],
          deliveryMode: 'manual_admin',
        },
      })

      const sendResult = await sendLeadOutreachEmail({
        lead,
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
            campaignLabel: revenueCampaign.label,
            authorizedChannels: [authorization.adapter.channel],
            deliveryMode: 'manual_admin',
            error: sendResult.error || 'send_failed',
            providerResultAt: failedAt,
          },
        })
        const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
          leadId: id,
          subjectNamespace: 'lead',
          subjectKey: id,
          messageId: updatedMessage.id,
          enrollmentId: dispatchIntent.id,
          operatingStrategyVersionId: authorization.binding.operatingStrategyVersionId,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId || null,
          evidenceId: `lead-admin-outreach:${updatedMessage.id}:${sendResult.provider}:failed`,
          status: 'failed',
          occurredAt: failedAt,
        })
        if (!failedDeliveryOutcome.updated) {
          throw new Error(`Lead delivery outcome attribution failed: ${failedDeliveryOutcome.reason}.`)
        }
        await Promise.all([
          updateOutreachMessage(message.id, {
            status: 'failed',
            send_provider: sendResult.provider,
            send_error: sendResult.error || 'Send failed.',
            metadata_json: {
              ...(updatedMessage.metadata_json || {}),
              providerResultAt: failedAt,
            },
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
            metadata: { providerResultAt: failedAt },
          }),
        ])
        return NextResponse.json(
          { error: sendResult.error || 'Send failed.' },
          { status: 500 }
        )
      }

      const acceptedAt = new Date().toISOString()
      await recordOutboundEnrollment({
        ...enrollmentBase,
        enrollmentId: dispatchIntent.id,
        status: 'accepted',
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        nextActionAt: nextFollowUpAt,
        metadata: {
          campaignLabel: revenueCampaign.label,
          authorizedChannels: [authorization.adapter.channel],
          deliveryMode: 'manual_admin',
          providerResultAt: acceptedAt,
        },
      })
      const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
        leadId: id,
        subjectNamespace: 'lead',
        subjectKey: id,
        messageId: updatedMessage.id,
        enrollmentId: dispatchIntent.id,
        operatingStrategyVersionId: authorization.binding.operatingStrategyVersionId,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId || null,
        evidenceId: `lead-admin-outreach:${updatedMessage.id}:${sendResult.provider}:${sendResult.providerMessageId || 'accepted'}`,
        status: 'accepted',
        occurredAt: acceptedAt,
      })
      if (!acceptedDeliveryOutcome.updated) {
        throw new Error(`Lead delivery outcome attribution failed: ${acceptedDeliveryOutcome.reason}.`)
      }
      await Promise.all([
        updateOutreachMessage(message.id, {
          status: 'accepted',
          sent_at: acceptedAt,
          send_provider: sendResult.provider,
          send_error: null,
          metadata_json: {
            ...(updatedMessage.metadata_json || {}),
            providerMessageId: sendResult.providerMessageId || null,
            providerResultAt: acceptedAt,
          },
        }),
        updateLeadRecord(id, {
          status: 'contacted',
          outreach_status: 'sent',
          delivery_status: 'accepted',
          last_contacted_at: acceptedAt,
          next_follow_up_at: nextFollowUpAt,
        }),
        insertOutreachSendEvent({
          leadId: id,
          outreachMessageId: message.id,
          channel: message.channel,
          provider: sendResult.provider,
          status: 'sent',
          recipient: lead.email,
          subject: updatedMessage.subject,
          metadata: { providerMessageId: sendResult.providerMessageId || null, providerResultAt: acceptedAt },
        }),
        logEvent({
          eventType: 'outreach_sent',
          actorUserId: user?.id,
          entityType: 'lead',
          entityId: id,
          metadata: { outreachMessageId: message.id, provider: sendResult.provider, providerResultAt: acceptedAt },
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
