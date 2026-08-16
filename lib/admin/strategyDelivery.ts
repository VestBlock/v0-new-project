import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  recordOperatingStrategyActivity,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'

type StrategyDeliveryStatus =
  | 'accepted'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

const POSITIVE_OUTCOMES = new Set(['accepted', 'delivered', 'opened', 'clicked', 'replied'])

function shouldAdvanceMembership(currentStatus: string | null | undefined, nextStatus: StrategyDeliveryStatus) {
  const current = String(currentStatus || '')
  if (nextStatus === 'accepted' && ['delivered', 'opened', 'clicked', 'replied'].includes(current)) return false
  if (['failed', 'bounced', 'complained', 'suppressed'].includes(nextStatus) && POSITIVE_OUTCOMES.has(current)) {
    return nextStatus !== 'failed'
  }
  return current !== nextStatus
}

function bindingFromEnrollment(enrollment: Record<string, unknown>): OperatingStrategyBinding | null {
  const metadata = enrollment.metadata_json as Record<string, unknown> | null
  const snapshot = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata.operatingStrategy
    : null
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  const values = snapshot as Record<string, unknown>
  const binding: OperatingStrategyBinding = {
    namespace: String(enrollment.strategy_identifier_namespace || values.namespace || ''),
    sourceIdentifier: String(enrollment.strategy_key || values.sourceIdentifier || ''),
    portfolioKey: String(values.portfolioKey || ''),
    strategyKey: String(values.strategyKey || ''),
    operatingStrategyId: String(enrollment.operating_strategy_id || values.operatingStrategyId || ''),
    operatingStrategyVersionId: String(enrollment.operating_strategy_version_id || values.operatingStrategyVersionId || ''),
    version: Number(values.version),
    executionMode: String(values.executionMode || ''),
    externalSendCap: Number(values.externalSendCap),
    destinationMode: String(enrollment.destination_mode_snapshot || values.destinationMode || ''),
    destinationPath: (enrollment.destination_path_snapshot ?? values.destinationPath ?? null) as string | null,
    ctaLabel: (enrollment.cta_label_snapshot ?? values.ctaLabel ?? null) as string | null,
    contractFingerprint: String(enrollment.operating_contract_fingerprint || values.contractFingerprint || ''),
    crmOwnerKey: String(values.crmOwnerKey || ''),
    automationOwnerKey: String(values.automationOwnerKey || ''),
    dispatchAuthority: String(values.dispatchAuthority || ''),
  }
  if (
    !binding.namespace ||
    !binding.sourceIdentifier ||
    !binding.portfolioKey ||
    !binding.strategyKey ||
    !binding.operatingStrategyId ||
    !binding.operatingStrategyVersionId ||
    !Number.isInteger(binding.version) ||
    !binding.executionMode ||
    !Number.isInteger(binding.externalSendCap) ||
    !binding.destinationMode ||
    !binding.contractFingerprint ||
    !binding.crmOwnerKey ||
    !binding.automationOwnerKey ||
    !binding.dispatchAuthority
  ) {
    return null
  }
  return binding
}

function subjectFromEnrollment(enrollment: Record<string, unknown>) {
  const metadata = enrollment.metadata_json as Record<string, unknown> | null
  const raw = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata.governedSubject
    : null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const subject = raw as Record<string, unknown>
  const namespace = String(subject.namespace || '').trim()
  const key = String(subject.key || '').trim()
  if (!namespace || !key || !/^[a-z0-9_]+$/.test(namespace)) return null
  return { namespace, key }
}

export async function recordStrategyDeliveryOutcome(input: {
  leadId?: string | null
  messageId: string
  status: StrategyDeliveryStatus
  occurredAt: string
  enrollmentId?: string | null
  operatingStrategyVersionId?: string | null
  provider?: string | null
  providerMessageId?: string | null
  providerEventId?: string | null
  evidenceId?: string | null
  channel?: 'email' | 'sms' | 'task'
  subjectNamespace?: string | null
  subjectKey?: string | null
}) {
  const admin = createAdminClient()
  const occurredAt = input.occurredAt
  const channel = input.channel || 'email'
  let enrollmentLookup = admin
    .from('command_center_outbound_enrollments')
    .select('id,lead_id,status,campaign_run_id,strategy_key,strategy_identifier_namespace,strategy_writer_release,operating_strategy_id,strategy_lead_membership_id,operating_strategy_version_id,operating_contract_fingerprint,strategy_binding_mode,destination_mode_snapshot,destination_path_snapshot,cta_label_snapshot,canonical_activity_id,dispatch_channel,provider,provider_message_id,metadata_json')
    .eq('strategy_binding_mode', 'governed_v1')
  if (input.enrollmentId) {
    enrollmentLookup = enrollmentLookup.eq('id', input.enrollmentId)
  } else if (input.provider && input.providerMessageId) {
    enrollmentLookup = enrollmentLookup
      .eq('provider', input.provider)
      .eq('provider_message_id', input.providerMessageId)
  } else {
    enrollmentLookup = enrollmentLookup.eq('channel', channel).eq('last_message_id', input.messageId)
  }
  if (input.operatingStrategyVersionId) {
    enrollmentLookup = enrollmentLookup.eq(
      'operating_strategy_version_id',
      input.operatingStrategyVersionId
    )
  }
  const { data: enrollmentRows, error: enrollmentLookupError } = await enrollmentLookup.limit(2)
  if (enrollmentLookupError) throw enrollmentLookupError
  if ((enrollmentRows || []).length !== 1) {
    const reason = (enrollmentRows || []).length ? 'ambiguous_governed_enrollment' : 'no_governed_enrollment'
    console.warn('Governed delivery outcome was not attributed.', {
      reason,
      enrollmentId: input.enrollmentId || null,
      messageId: input.messageId,
      operatingStrategyVersionId: input.operatingStrategyVersionId || null,
    })
    return { updated: false, reason }
  }
  const enrollment = enrollmentRows![0]
  if (
    !enrollment.operating_strategy_version_id ||
    !enrollment.operating_contract_fingerprint ||
    (input.leadId && enrollment.lead_id !== input.leadId)
  ) {
    console.warn('Governed delivery outcome has an incomplete or conflicting attribution.', {
      enrollmentId: enrollment.id,
      leadId: input.leadId,
    })
    return { updated: false, reason: 'invalid_governed_enrollment_attribution' }
  }
  const binding = bindingFromEnrollment(enrollment)
  if (!binding || binding.operatingStrategyVersionId !== enrollment.operating_strategy_version_id) {
    console.warn('Governed delivery outcome is missing its immutable runtime snapshot.', {
      enrollmentId: enrollment.id,
    })
    return { updated: false, reason: 'missing_governed_runtime_snapshot' }
  }
  if (!enrollment.canonical_activity_id) {
    console.warn('Governed delivery outcome is missing its canonical enrollment activity.', {
      enrollmentId: enrollment.id,
    })
    return { updated: false, reason: 'missing_canonical_enrollment_activity' }
  }
  const writerRelease = String(enrollment.strategy_writer_release || '').trim()
  if (!writerRelease) {
    return { updated: false, reason: 'missing_governed_writer_release' }
  }
  const subject = subjectFromEnrollment(enrollment)
  if (
    !subject ||
    (input.subjectNamespace && input.subjectNamespace !== subject.namespace) ||
    (input.subjectKey && input.subjectKey !== subject.key)
  ) {
    console.warn('Governed delivery outcome has no exact subject attribution.', {
      enrollmentId: enrollment.id,
    })
    return { updated: false, reason: 'invalid_governed_subject_attribution' }
  }

  let membership: {
    id: string
    campaign_run_id: string | null
    status: string | null
    strategy_key: string | null
    market: string | null
    source_provider: string | null
    operating_strategy_version_id: string
  } | null = null
  if (enrollment.strategy_lead_membership_id || enrollment.lead_id) {
    let membershipLookup = admin
      .from('strategy_lead_memberships')
      .select('id,campaign_run_id,status,strategy_key,market,source_provider,operating_strategy_version_id')
      .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
    membershipLookup = enrollment.strategy_lead_membership_id
      ? membershipLookup.eq('id', enrollment.strategy_lead_membership_id)
      : membershipLookup.eq('lead_id', enrollment.lead_id)
    const { data: membershipRows, error: membershipLookupError } = await membershipLookup.limit(2)
    if (membershipLookupError) throw membershipLookupError
    if ((membershipRows || []).length > 1) {
      console.warn('Governed delivery outcome membership attribution is ambiguous.', {
        enrollmentId: enrollment.id,
        operatingStrategyVersionId: enrollment.operating_strategy_version_id,
      })
      return { updated: false, reason: 'ambiguous_governed_membership' }
    }
    if (enrollment.strategy_lead_membership_id && !(membershipRows || []).length) {
      console.warn('Governed delivery outcome conflicts with its recorded membership.', {
        enrollmentId: enrollment.id,
        strategyLeadMembershipId: enrollment.strategy_lead_membership_id,
      })
      return { updated: false, reason: 'governed_membership_conflict' }
    }
    membership = membershipRows?.[0] || null
  }

  const inputProvider = String(input.provider || '').trim()
  const provider = String(inputProvider === 'none' ? enrollment.provider || '' : inputProvider || enrollment.provider || '').trim()
  const providerMessageId = String(input.providerMessageId || enrollment.provider_message_id || '').trim()
  if (provider) {
    const expectedDispatchChannel = provider === 'resend'
      ? 'resend_email'
      : provider === 'gmail'
        ? 'gmail_email'
        : provider === 'outlook_graph'
          ? 'outlook_graph'
          : null
    if (
      !expectedDispatchChannel ||
      enrollment.dispatch_channel !== expectedDispatchChannel ||
      (enrollment.provider && enrollment.provider !== provider) ||
      (enrollment.provider_message_id && enrollment.provider_message_id !== providerMessageId)
    ) {
      console.warn('Governed callback provider identity conflicts with the frozen dispatch adapter.', {
        enrollmentId: enrollment.id,
        provider,
        dispatchChannel: enrollment.dispatch_channel,
      })
      return { updated: false, reason: 'governed_provider_identity_conflict' }
    }
  }
  const localImmediateResult = input.status === 'accepted' || input.status === 'failed'
  const evidenceId = String(
    input.providerEventId ||
      input.evidenceId ||
      (localImmediateResult ? providerMessageId || input.messageId : '')
  ).trim()
  if (!evidenceId) {
    console.warn('Governed callback is missing a unique provider event or evidence ID.', {
      enrollmentId: enrollment.id,
      status: input.status,
    })
    return { updated: false, reason: 'missing_governed_callback_evidence_id' }
  }
  const hasProviderEvidence = Boolean(provider && providerMessageId)
  const activityType = input.status === 'replied'
    ? 'reply'
    : input.status === 'suppressed'
      ? 'suppression'
      : hasProviderEvidence
        ? 'delivery'
        : 'orchestration'
  await recordOperatingStrategyActivity({
    binding,
    activityType,
    activityNamespace: activityType === 'reply'
      ? 'inbound_reply'
      : activityType === 'suppression'
        ? 'outbound_suppression'
        : hasProviderEvidence
          ? 'provider_delivery'
          : 'dispatch_orchestration',
    activityKey: `${enrollment.id}:${input.status}:${evidenceId}`,
    subjectNamespace: subject.namespace,
    subjectKey: subject.key,
    idempotencyKey: `${activityType}:${enrollment.id}:${input.status}:${evidenceId}`,
    occurredAt,
    parentActivityId: enrollment.canonical_activity_id,
    strategyLeadMembershipId: membership?.id || null,
    outboundEnrollmentId: enrollment.id,
    provider: hasProviderEvidence ? provider : null,
    providerMessageId: hasProviderEvidence ? providerMessageId : null,
    provenance: [
      {
        kind: activityType === 'reply'
          ? 'provider_reply_callback'
          : hasProviderEvidence
            ? 'provider_delivery_callback'
            : 'local_dispatch_result',
        messageId: input.messageId,
      },
    ],
    metadata: {
      status: input.status,
      channel,
      provider: provider || null,
      providerMessageId: providerMessageId || null,
      providerEventId: input.providerEventId || null,
      evidenceId,
    },
    writerRelease,
  })

  const { data: updatedEnrollments, error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: input.status,
      ...(provider && providerMessageId ? { provider, provider_message_id: providerMessageId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollment.id)
    .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
    .eq('operating_contract_fingerprint', enrollment.operating_contract_fingerprint)
    .select('id')
  if (enrollmentError) throw enrollmentError
  if ((updatedEnrollments || []).length !== 1) {
    throw new Error('Governed delivery outcome did not update exactly one outbound enrollment.')
  }

  if (!membership) return { updated: true, runId: null, membershipId: null }

  if (shouldAdvanceMembership(membership.status, input.status)) {
    const { error: membershipError } = await admin
      .from('strategy_lead_memberships')
      .update({
        status: input.status,
        last_outcome_at: occurredAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id)
      .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
    if (membershipError) throw membershipError
  }

  if (!membership.campaign_run_id) return { updated: true, runId: null }

  const { data: runMemberships, error: countError } = await admin
    .from('strategy_lead_memberships')
    .select('status')
    .eq('campaign_run_id', membership.campaign_run_id)
    .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
  if (countError) throw countError

  const statuses = (runMemberships || []).map((row) => String(row.status || ''))
  const acceptedCount = statuses.filter((status) => POSITIVE_OUTCOMES.has(status)).length
  const deliveredCount = statuses.filter((status) => ['delivered', 'opened', 'clicked', 'replied'].includes(status)).length
  const replyCount = statuses.filter((status) => status === 'replied').length
  const bounceCount = statuses.filter((status) => ['bounced', 'complained'].includes(status)).length
  const lifecycleStatus = replyCount
    ? 'replied'
    : deliveredCount
      ? 'delivered'
      : acceptedCount
        ? 'provider_accepted'
        : bounceCount === statuses.length && statuses.length
          ? 'failed'
          : 'drafted'
  const { error: runError } = await admin
    .from('command_center_strategy_runs')
    .update({
      status: lifecycleStatus,
      sent_count: acceptedCount,
      accepted_count: acceptedCount,
      delivered_count: deliveredCount,
      reply_count: replyCount,
      bounce_count: bounceCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.campaign_run_id)
    .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
  if (runError) throw runError

  if (membership.strategy_key && membership.market && membership.source_provider) {
    const timestamps: Record<string, string> = { updated_at: new Date().toISOString() }
    if (POSITIVE_OUTCOMES.has(input.status)) timestamps.last_provider_accept_at = occurredAt
    if (input.status === 'replied') timestamps.last_reply_at = occurredAt
    const { error: stateError } = await admin
      .from('strategy_market_state')
      .update(timestamps)
      .eq('strategy_key', membership.strategy_key)
      .eq('market', membership.market)
      .eq('source_provider', membership.source_provider)
      .eq('operating_strategy_version_id', enrollment.operating_strategy_version_id)
    if (stateError) throw stateError
  }

  return { updated: true, runId: membership.campaign_run_id }
}
