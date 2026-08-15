import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  recordOperatingStrategyActivity,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'

type EnrollmentStatus =
  | 'queued'
  | 'needs_review'
  | 'approved'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

export async function recordOutboundEnrollment(input: {
  strategyKey: string
  channel: 'email' | 'sms' | 'task'
  status: EnrollmentStatus
  messageId: string
  enrollmentId?: string | null
  campaignRunId?: string | null
  recipient?: string | null
  leadId?: string | null
  market?: string | null
  propertyAddress?: string | null
  suppressionReason?: string | null
  nextActionAt?: string | null
  metadata?: Record<string, unknown>
  binding?: OperatingStrategyBinding | null
  governedStage?: 'draft' | 'dispatch_intent'
  strategyLeadMembershipId?: string | null
  dispatchIntentAt?: string | null
  dispatchReservationId?: string | null
  dispatchChannel?: string | null
  provider?: string | null
  providerMessageId?: string | null
  outreachPurpose?: string | null
  consentBasisSnapshot?: Record<string, unknown> | null
  suppressionSnapshot?: Record<string, unknown> | null
  messageVersionKey?: string | null
  subjectNamespace?: string | null
  subjectKey?: string | null
  parentActivityId?: string | null
}) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const recipient = String(input.recipient || '').trim().toLowerCase() || null
  const recipientHash = recipient ? createHash('sha256').update(recipient).digest('hex') : null
  const binding = input.binding || null
  const governedStage = input.governedStage || (input.dispatchIntentAt ? 'dispatch_intent' : 'draft')
  const subjectNamespace = String(input.subjectNamespace || '').trim()
  const subjectKey = String(input.subjectKey || '').trim()
  if (
    !binding &&
    (input.governedStage ||
      input.dispatchIntentAt ||
      input.dispatchReservationId ||
      input.dispatchChannel ||
      input.consentBasisSnapshot ||
      input.suppressionSnapshot ||
      input.messageVersionKey)
  ) {
    throw new Error('Governed outbound evidence cannot be recorded without an operating-strategy binding.')
  }
  if (binding && binding.sourceIdentifier !== input.strategyKey) {
    throw new Error(
      `Outbound strategy identifier ${input.strategyKey} does not match governed source ${binding.namespace}:${binding.sourceIdentifier}.`
    )
  }
  if (binding && governedStage === 'draft') {
    if (!['needs_review', 'approved'].includes(input.status)) {
      throw new Error('A governed draft enrollment must remain in needs_review or approved status.')
    }
    if (
      input.dispatchIntentAt ||
      input.dispatchReservationId ||
      input.dispatchChannel ||
      input.provider ||
      input.providerMessageId ||
      input.outreachPurpose ||
      input.consentBasisSnapshot ||
      input.suppressionSnapshot ||
      input.messageVersionKey
    ) {
      throw new Error('A governed draft cannot carry dispatch intent or provider evidence.')
    }
  }
  if (binding && governedStage === 'dispatch_intent') {
    if (
      !input.dispatchIntentAt ||
      !input.dispatchReservationId ||
      !String(input.dispatchChannel || '').trim() ||
      !input.outreachPurpose ||
      !input.messageVersionKey ||
      !subjectNamespace ||
      !subjectKey
    ) {
      throw new Error(
        'Governed dispatch intent requires an exact subject, dispatch reservation/channel, dispatchIntentAt, outreachPurpose, and messageVersionKey.'
      )
    }
    if (!/^[a-z0-9_]+$/.test(subjectNamespace)) {
      throw new Error('Governed dispatch subjectNamespace must use lowercase letters, numbers, or underscores.')
    }
    if (
      !input.consentBasisSnapshot ||
      !Object.keys(input.consentBasisSnapshot).length ||
      !input.suppressionSnapshot ||
      !Object.keys(input.suppressionSnapshot).length
    ) {
      throw new Error(
        'Governed outbound enrollment requires non-empty consent and suppression snapshots before provider dispatch.'
      )
    }
    const consentBasis = String(input.consentBasisSnapshot.basis || '').trim()
    const consentEvidenceKey = String(input.consentBasisSnapshot.evidenceKey || '').trim()
    const suppressionEvidenceKey = String(input.suppressionSnapshot.evidenceKey || '').trim()
    const consentProvenance = input.consentBasisSnapshot.provenance
    const hasConsentProvenance =
      (typeof consentProvenance === 'string' && Boolean(consentProvenance.trim())) ||
      (Array.isArray(consentProvenance) && consentProvenance.length > 0) ||
      (Boolean(consentProvenance) &&
        typeof consentProvenance === 'object' &&
        !Array.isArray(consentProvenance) &&
        Object.keys(consentProvenance as Record<string, unknown>).length > 0)
    if (
      input.consentBasisSnapshot.dispatchAuthorized !== true ||
      !consentBasis ||
      !consentEvidenceKey ||
      !hasConsentProvenance
    ) {
      throw new Error(
        'Governed dispatch requires explicit authorization, a nonblank basis, and authorization provenance.'
      )
    }
    if (
      input.suppressionSnapshot.suppressionCleared !== true ||
      !String(input.suppressionSnapshot.checkedAt || '').trim() ||
      !suppressionEvidenceKey
    ) {
      throw new Error(
        'Governed dispatch requires a cleared suppression snapshot with checkedAt and evidenceKey.'
      )
    }
  }

  const strategyMetadata = binding
    ? {
        namespace: binding.namespace,
        sourceIdentifier: binding.sourceIdentifier,
        portfolioKey: binding.portfolioKey,
        strategyKey: binding.strategyKey,
        operatingStrategyId: binding.operatingStrategyId,
        operatingStrategyVersionId: binding.operatingStrategyVersionId,
        version: binding.version,
        executionMode: binding.executionMode,
        externalSendCap: binding.externalSendCap,
        destinationMode: binding.destinationMode,
        destinationPath: binding.destinationPath,
        ctaLabel: binding.ctaLabel,
        contractFingerprint: binding.contractFingerprint,
        crmOwnerKey: binding.crmOwnerKey,
        automationOwnerKey: binding.automationOwnerKey,
        dispatchAuthority: binding.dispatchAuthority,
        governedStage,
      }
    : null
  const payload = {
    campaign_run_id: input.campaignRunId || null,
    lead_id: input.leadId || null,
    strategy_key: input.strategyKey,
    channel: input.channel,
    recipient,
    recipient_hash: recipientHash,
    market: input.market || null,
    property_address: input.propertyAddress || null,
    status: input.status,
    suppression_reason: input.suppressionReason || null,
    next_action_at: input.nextActionAt || null,
    last_message_id: input.messageId,
    metadata_json: {
      ...(input.metadata || {}),
      ...(strategyMetadata ? { operatingStrategy: strategyMetadata } : {}),
      ...(binding ? { governedSubject: { namespace: subjectNamespace, key: subjectKey } } : {}),
    },
    ...(binding
      ? {
          operating_strategy_version_id: binding.operatingStrategyVersionId,
          operating_strategy_id: binding.operatingStrategyId,
          strategy_identifier_namespace: binding.namespace,
          strategy_binding_mode: 'governed_v1',
          governed_stage: governedStage,
          strategy_binding_recorded_at: now,
          strategy_writer_release: 'gate_3c',
          destination_mode_snapshot: binding.destinationMode,
          destination_path_snapshot: binding.destinationPath,
          cta_label_snapshot: binding.ctaLabel,
          operating_contract_fingerprint: binding.contractFingerprint,
          strategy_lead_membership_id: input.strategyLeadMembershipId || null,
          dispatch_intent_at: input.dispatchIntentAt,
          dispatch_reservation_id: input.dispatchReservationId,
          dispatch_channel: input.dispatchChannel,
          provider: input.provider && input.providerMessageId ? input.provider : null,
          provider_message_id: input.provider && input.providerMessageId ? input.providerMessageId : null,
          outreach_purpose: input.outreachPurpose,
          consent_basis_snapshot_json: input.consentBasisSnapshot,
          suppression_snapshot_json: input.suppressionSnapshot,
          message_version_key: input.messageVersionKey,
        }
      : {}),
    updated_at: now,
  }

  let lookup = admin
    .from('command_center_outbound_enrollments')
    .select('id,strategy_binding_mode,strategy_binding_recorded_at,operating_strategy_version_id,operating_contract_fingerprint,canonical_activity_id,governed_stage')
  lookup = input.enrollmentId
    ? lookup.eq('id', input.enrollmentId)
    : lookup.eq('channel', input.channel).eq('last_message_id', input.messageId)
  const { data: existingRows, error: lookupError } = await lookup.limit(2)
  if (lookupError) throw lookupError
  if ((existingRows || []).length > 1) {
    throw new Error('Outbound enrollment attribution is ambiguous; refusing to update more than one record.')
  }
  const existing = existingRows?.[0]

  if (
    existing?.id &&
    existing.governed_stage === 'dispatch_intent' &&
    binding &&
    governedStage === 'dispatch_intent' &&
    !input.enrollmentId
  ) {
    throw new Error(
      'A governed dispatch intent already exists for this message. Automatic provider retry is blocked; reconcile the existing intent before another send.'
    )
  }

  let enrollment: {
    id: string
    status: string
    operating_strategy_version_id?: string | null
    strategy_binding_mode?: string | null
    canonical_activity_id?: string | null
  }
  if (existing?.id) {
    if (
      binding &&
      (existing.strategy_binding_mode !== 'governed_v1' ||
        existing.operating_strategy_version_id !== binding.operatingStrategyVersionId ||
        existing.operating_contract_fingerprint !== binding.contractFingerprint)
    ) {
      throw new Error('An existing outbound enrollment cannot be rebound to a different governed strategy version.')
    }
    const { data, error } = await admin
      .from('command_center_outbound_enrollments')
      .update(
        binding
          ? { ...payload, strategy_binding_recorded_at: existing.strategy_binding_recorded_at }
          : payload
      )
      .eq('id', existing.id)
      .select('id,status,operating_strategy_version_id,strategy_binding_mode,canonical_activity_id')
      .single()
    if (error) throw error
    enrollment = data
  } else {
    const { data, error } = await admin
      .from('command_center_outbound_enrollments')
      .insert(payload)
      .select('id,status,operating_strategy_version_id,strategy_binding_mode,canonical_activity_id')
      .single()
    if (error) throw error
    enrollment = data
  }

  if (binding && governedStage === 'dispatch_intent') {
    if (enrollment.canonical_activity_id) return enrollment

    const activityId = await recordOperatingStrategyActivity({
      binding,
      activityType: 'enrollment',
      activityNamespace: 'command_center_outbound_enrollment',
      activityKey: enrollment.id,
      subjectNamespace,
      subjectKey,
      parentActivityId: input.parentActivityId || null,
      idempotencyKey: `outbound-enrollment:${binding.operatingStrategyVersionId}:${input.channel}:${input.messageId}`,
      occurredAt: input.dispatchIntentAt!,
      strategyLeadMembershipId: input.strategyLeadMembershipId || null,
      outboundEnrollmentId: enrollment.id,
      dispatchReservationId: input.dispatchReservationId!,
      dispatchChannel: input.dispatchChannel!,
      dispatchIntentAt: input.dispatchIntentAt!,
      outreachPurpose: input.outreachPurpose!,
      consentBasisSnapshot: input.consentBasisSnapshot!,
      suppressionSnapshot: input.suppressionSnapshot!,
      messageVersionKey: input.messageVersionKey!,
      provenance: [
        {
          kind: 'canonical_runtime_resolver',
          sourceNamespace: binding.namespace,
          sourceIdentifier: binding.sourceIdentifier,
          contractFingerprint: binding.contractFingerprint,
        },
      ],
      metadata: {
        channel: input.channel,
        recipientHash,
        campaignRunId: input.campaignRunId || null,
        dispatchReservationId: input.dispatchReservationId,
        dispatchChannel: input.dispatchChannel,
      },
    })
    const { data: linkedRows, error: linkError } = await admin
      .from('command_center_outbound_enrollments')
      .update({ canonical_activity_id: activityId, updated_at: new Date().toISOString() })
      .eq('id', enrollment.id)
      .eq('operating_strategy_version_id', binding.operatingStrategyVersionId)
      .select('id')
    if (linkError) throw linkError
    if ((linkedRows || []).length !== 1) {
      throw new Error('Canonical activity did not link to exactly one governed outbound enrollment.')
    }
    return { ...enrollment, canonical_activity_id: activityId }
  }

  return enrollment
}
