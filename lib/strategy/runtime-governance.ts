import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'

export type OperatingStrategyBinding = {
  namespace: string
  sourceIdentifier: string
  portfolioKey: string
  strategyKey: string
  operatingStrategyId: string
  operatingStrategyVersionId: string
  version: number
  executionMode: string
  externalSendCap: number
  destinationMode: string
  destinationPath: string | null
  ctaLabel: string | null
  contractFingerprint: string
  crmOwnerKey: string
  automationOwnerKey: string
  dispatchAuthority: string
}

export type ResolveOperatingStrategyBindingInput = {
  namespace: string
  sourceIdentifier: string
  asOf?: string
}

export type AuthorizeOperatingStrategyDispatchInput = ResolveOperatingStrategyBindingInput & {
  channel: string
  requestedExternalSends?: number
  requiredDispatchAuthority?: string
}

export type OperatingStrategyDispatchReservation = {
  reservationId: string
  reservedCount: number
  remainingDailyCapacity: number
  expiresAt: string
  capacityWindowEndsAt: string
}

export type ReserveOperatingStrategyDispatchInput = {
  binding: OperatingStrategyBinding
  channel: string
  fallbackChannels?: string[]
  requestedCount?: number
  idempotencyKey: string
  ttlSeconds?: number
}

export type OperatingStrategyActivityType =
  | 'source'
  | 'enrollment'
  | 'orchestration'
  | 'message'
  | 'delivery'
  | 'reply'
  | 'domain_event'
  | 'handoff'
  | 'suppression'
  | 'operator_review'

export type OperatingStrategyAttributionQuarantineReason =
  | 'no_governed_enrollment'
  | 'ambiguous_governed_enrollment'
  | 'binding_mismatch'
  | 'unknown_source_mapping'
  | 'callback_identity_conflict'
  | 'provider_identity_missing'
  | 'attribution_not_found'

export type RecordOperatingStrategyAttributionQuarantineInput = {
  sourceDomain: string
  sourceEventKey: string
  reasonCode: OperatingStrategyAttributionQuarantineReason
  identifiers: Record<string, unknown>
  candidateBindings?: Array<Record<string, unknown>>
  payloadHash: string
  occurredAt: string
}

export type RecordOperatingStrategyActivityInput = {
  binding: OperatingStrategyBinding
  activityType: OperatingStrategyActivityType
  activityNamespace: string
  activityKey: string
  subjectNamespace: string
  subjectKey: string
  idempotencyKey: string
  occurredAt: string
  parentActivityId?: string | null
  strategyLeadMembershipId?: string | null
  outboundEnrollmentId?: string | null
  dispatchReservationId?: string | null
  dispatchChannel?: string | null
  dispatchIntentAt?: string | null
  provider?: string | null
  providerMessageId?: string | null
  outreachPurpose?: string | null
  consentBasisSnapshot?: Record<string, unknown>
  suppressionSnapshot?: Record<string, unknown>
  messageVersionKey?: string | null
  provenance?: Array<Record<string, unknown>>
  metadata?: Record<string, unknown>
}

export function fingerprintGovernedOutreachMessage(message: {
  id: string
  subject?: string | null
  body: string
  cta?: string | null
  compliance_note?: string | null
  generated_with?: string | null
  created_at: string
}) {
  return createHash('sha256').update(JSON.stringify({
    id: message.id,
    subject: message.subject || null,
    body: message.body,
    cta: message.cta || null,
    complianceNote: message.compliance_note || null,
    generatedWith: message.generated_with || null,
    createdAt: message.created_at,
  })).digest('hex')
}

type RuntimeResolverRow = {
  portfolio_key: string
  strategy_key: string
  operating_strategy_id: string
  operating_strategy_version_id: string
  operating_strategy_version: number
  version_status: string
  operating_contract_fingerprint: string
  execution_mode: string
  external_send_cap: number
  destination_mode: string
  destination_path: string | null
  cta_label: string | null
  crm_owner_key: string
  automation_owner_key: string
  dispatch_authority: string
  primary_channels_json: unknown
  secondary_channels_json: unknown
  owner_contract_json: unknown
}

type ResolvedRuntime = {
  binding: OperatingStrategyBinding
  primaryChannels: string[]
  secondaryChannels: string[]
}

function requireIdentifier(value: string, label: string) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required for governed strategy activity.`)
  return normalized
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

const QUARANTINE_REASON_CODES = new Set<OperatingStrategyAttributionQuarantineReason>([
  'no_governed_enrollment',
  'ambiguous_governed_enrollment',
  'binding_mismatch',
  'unknown_source_mapping',
  'callback_identity_conflict',
  'provider_identity_missing',
  'attribution_not_found',
])

const QUARANTINE_FORBIDDEN_KEY = /(?:^|_)(?:raw|payload|body|content|message_body|html|text|subject)(?:$|_)/i
const QUARANTINE_PII_KEY = /(?:email|recipient|phone|address|person_name|full_name|(?:^|_)(?:from|to|sender)(?:$|_))/i

function assertRedactedQuarantineValue(value: unknown, path: string, seen: Set<object>) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return
  if (typeof value === 'string') {
    if (value.length > 512 || /[\r\n]/.test(value)) {
      throw new Error(`Quarantine ${path} may contain only compact identifiers, not raw content.`)
    }
    return
  }
  if (typeof value !== 'object') {
    throw new Error(`Quarantine ${path} contains a non-JSON value.`)
  }
  if (seen.has(value)) throw new Error(`Quarantine ${path} contains a circular value.`)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertRedactedQuarantineValue(item, `${path}[${index}]`, seen))
  } else {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
      const isOpaqueIdentifierKey = /(?:_hash|_id|_key|_count|_domain|_namespace)$/.test(normalizedKey)
      if (QUARANTINE_FORBIDDEN_KEY.test(normalizedKey) && !isOpaqueIdentifierKey) {
        throw new Error(`Quarantine ${path}.${key} cannot contain raw message or callback content.`)
      }
      if (
        QUARANTINE_PII_KEY.test(normalizedKey) &&
        !isOpaqueIdentifierKey
      ) {
        throw new Error(`Quarantine ${path}.${key} must be replaced with a hash or opaque identifier.`)
      }
      assertRedactedQuarantineValue(child, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

function isMissingRuntimeResolver(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase()
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (message.includes('resolve_operating_strategy_runtime') &&
      (message.includes('not find') || message.includes('does not exist') || message.includes('schema cache')))
  )
}

async function resolveRuntime(input: ResolveOperatingStrategyBindingInput): Promise<ResolvedRuntime> {
  const namespace = requireIdentifier(input.namespace, 'Strategy namespace')
  const sourceIdentifier = requireIdentifier(input.sourceIdentifier, 'Strategy source identifier')
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('resolve_operating_strategy_runtime', {
    p_source_namespace: namespace,
    p_source_identifier: sourceIdentifier,
    p_as_of: input.asOf || new Date().toISOString(),
  })

  if (error) {
    if (isMissingRuntimeResolver(error)) {
      throw new Error(
        'Gate 3C runtime resolver is unavailable. Apply the Gate 3C database migration before governed activity can run.'
      )
    }
    throw new Error(
      `Canonical operating strategy resolution failed for ${namespace}:${sourceIdentifier}: ${error.message}`
    )
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as RuntimeResolverRow[]
  if (rows.length !== 1) {
    throw new Error(
      `Canonical operating strategy resolution for ${namespace}:${sourceIdentifier} returned ${rows.length} active versions; exactly one is required.`
    )
  }

  const row = rows[0]
  if (row.version_status !== 'active') {
    throw new Error(
      `Canonical operating strategy resolution for ${namespace}:${sourceIdentifier} did not return an active version.`
    )
  }
  if (
    !row.portfolio_key ||
    !row.strategy_key ||
    !row.operating_strategy_id ||
    !row.operating_strategy_version_id ||
    !Number.isInteger(row.operating_strategy_version) ||
    !row.operating_contract_fingerprint ||
    !row.execution_mode ||
    !Number.isInteger(row.external_send_cap) ||
    !row.destination_mode ||
    !row.crm_owner_key ||
    !row.automation_owner_key ||
    !row.dispatch_authority
  ) {
    throw new Error(
      `Canonical operating strategy resolution for ${namespace}:${sourceIdentifier} returned an incomplete runtime binding.`
    )
  }
  if (row.destination_mode === 'public_route' && (!row.destination_path || !row.cta_label)) {
    throw new Error(
      `Canonical operating strategy resolution for ${namespace}:${sourceIdentifier} is missing its public destination or CTA.`
    )
  }

  return {
    binding: {
      namespace,
      sourceIdentifier,
      portfolioKey: row.portfolio_key,
      strategyKey: row.strategy_key,
      operatingStrategyId: row.operating_strategy_id,
      operatingStrategyVersionId: row.operating_strategy_version_id,
      version: row.operating_strategy_version,
      executionMode: row.execution_mode,
      externalSendCap: row.external_send_cap,
      destinationMode: row.destination_mode,
      destinationPath: row.destination_path,
      ctaLabel: row.cta_label,
      contractFingerprint: row.operating_contract_fingerprint,
      crmOwnerKey: row.crm_owner_key,
      automationOwnerKey: row.automation_owner_key,
      dispatchAuthority: row.dispatch_authority,
    },
    primaryChannels: stringArray(row.primary_channels_json),
    secondaryChannels: stringArray(row.secondary_channels_json),
  }
}

export async function resolveOperatingStrategyBinding(
  input: ResolveOperatingStrategyBindingInput
): Promise<OperatingStrategyBinding> {
  return (await resolveRuntime(input)).binding
}

export async function authorizeOperatingStrategyDispatch(
  input: AuthorizeOperatingStrategyDispatchInput
): Promise<OperatingStrategyBinding> {
  const channel = requireIdentifier(input.channel, 'Dispatch channel')
  const requestedExternalSends = input.requestedExternalSends ?? 1
  if (!Number.isInteger(requestedExternalSends) || requestedExternalSends < 1) {
    throw new Error('A governed dispatch must request a positive integer number of external sends.')
  }

  const runtime = await resolveRuntime(input)
  const { binding } = runtime
  if (binding.executionMode !== 'approved_live') {
    throw new Error(
      `Operating strategy ${binding.strategyKey} version ${binding.version} is ${binding.executionMode}; approved_live is required for external dispatch.`
    )
  }
  if (binding.externalSendCap < requestedExternalSends) {
    throw new Error(
      `Operating strategy ${binding.strategyKey} version ${binding.version} allows ${binding.externalSendCap} external sends, below the requested ${requestedExternalSends}.`
    )
  }

  const deniedDispatchAuthorities = new Set(['none', 'blocked', 'manual_only'])
  if (
    deniedDispatchAuthorities.has(binding.dispatchAuthority) ||
    binding.dispatchAuthority.startsWith('none_')
  ) {
    throw new Error(
      `Operating strategy ${binding.strategyKey} version ${binding.version} does not delegate external dispatch authority.`
    )
  }
  if (
    input.requiredDispatchAuthority &&
    binding.dispatchAuthority !== input.requiredDispatchAuthority
  ) {
    throw new Error(
      `Operating strategy ${binding.strategyKey} version ${binding.version} delegates dispatch to ${binding.dispatchAuthority}, not ${input.requiredDispatchAuthority}.`
    )
  }

  const allowedChannels = new Set([...runtime.primaryChannels, ...runtime.secondaryChannels])
  if (!allowedChannels.has(channel)) {
    throw new Error(
      `Channel ${channel} is not allowed by operating strategy ${binding.strategyKey} version ${binding.version}.`
    )
  }
  if (process.env.OUTREACH_LIVE_SEND_ENABLED !== 'true') {
    throw new Error('Live external outreach is disabled by OUTREACH_LIVE_SEND_ENABLED.')
  }

  return binding
}

export async function reserveOperatingStrategyDispatch(
  input: ReserveOperatingStrategyDispatchInput
): Promise<OperatingStrategyDispatchReservation> {
  const channel = requireIdentifier(input.channel, 'Dispatch reservation channel')
  const fallbackChannels = Array.from(
    new Set(
      (input.fallbackChannels || [])
        .map((candidate) => requireIdentifier(candidate, 'Fallback dispatch channel'))
        .filter((candidate) => candidate !== channel)
    )
  )
  const idempotencyKey = requireIdentifier(input.idempotencyKey, 'Dispatch reservation idempotency key')
  const requestedCount = input.requestedCount ?? 1
  const ttlSeconds = input.ttlSeconds ?? 300
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error('Dispatch reservation count must be a positive integer.')
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) {
    throw new Error('Dispatch reservation TTL must be between 30 and 900 seconds.')
  }
  if (
    input.binding.executionMode !== 'approved_live' ||
    input.binding.externalSendCap < requestedCount ||
    input.binding.dispatchAuthority === 'none' ||
    input.binding.dispatchAuthority.startsWith('none_') ||
    process.env.OUTREACH_LIVE_SEND_ENABLED !== 'true'
  ) {
    throw new Error('The operating strategy binding is not authorized to reserve external dispatch capacity.')
  }

  for (const candidate of [channel, ...fallbackChannels]) {
    if (candidate === 'no_outreach' || candidate === 'operator_task') {
      throw new Error(`Channel ${candidate} cannot reserve external dispatch capacity.`)
    }
    const authorized = await authorizeOperatingStrategyDispatch({
      namespace: input.binding.namespace,
      sourceIdentifier: input.binding.sourceIdentifier,
      channel: candidate,
      requestedExternalSends: requestedCount,
      requiredDispatchAuthority: input.binding.dispatchAuthority,
    })
    if (
      authorized.operatingStrategyVersionId !== input.binding.operatingStrategyVersionId ||
      authorized.contractFingerprint !== input.binding.contractFingerprint
    ) {
      throw new Error(`Dispatch reservation candidate ${candidate} resolved to a different operating version.`)
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('reserve_operating_strategy_dispatch', {
    p_operating_strategy_version_id: input.binding.operatingStrategyVersionId,
    p_operating_contract_fingerprint: input.binding.contractFingerprint,
    p_channel: channel,
    p_requested_count: requestedCount,
    p_idempotency_key: idempotencyKey,
    p_writer_release: 'gate_3c',
    p_ttl_seconds: ttlSeconds,
    p_fallback_channels: fallbackChannels,
  })
  if (error) {
    const message = `${error.message || ''} ${error.details || ''}`.toLowerCase()
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      (message.includes('reserve_operating_strategy_dispatch') &&
        (message.includes('not find') || message.includes('does not exist') || message.includes('schema cache')))
    ) {
      throw new Error(
        'Gate 3C dispatch reservation is unavailable. Apply the Gate 3C database migration before external dispatch can run.'
      )
    }
    throw new Error(`Canonical dispatch capacity could not be reserved: ${error.message}`)
  }
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as Array<{
    reservation_id: string
    reserved_count: number
    remaining_daily_capacity: number
    expires_at: string
    capacity_window_ends_at: string
  }>
  if (rows.length !== 1) {
    throw new Error(`Dispatch capacity reservation returned ${rows.length} rows; exactly one is required.`)
  }
  const row = rows[0]
  if (
    !row.reservation_id ||
    row.reserved_count !== requestedCount ||
    !Number.isInteger(row.remaining_daily_capacity) ||
    !Number.isFinite(Date.parse(row.expires_at)) ||
    !Number.isFinite(Date.parse(row.capacity_window_ends_at))
  ) {
    throw new Error('Dispatch capacity reservation returned an incomplete or inconsistent result.')
  }
  return {
    reservationId: row.reservation_id,
    reservedCount: row.reserved_count,
    remainingDailyCapacity: row.remaining_daily_capacity,
    expiresAt: row.expires_at,
    capacityWindowEndsAt: row.capacity_window_ends_at,
  }
}

export async function resolveOperatingStrategyLeadMembership(input: {
  binding: OperatingStrategyBinding
  leadId: string
  campaignRunId?: string | null
}) {
  const leadId = requireIdentifier(input.leadId, 'Lead ID')
  const admin = createAdminClient()
  let query = admin
    .from('strategy_lead_memberships')
    .select('id')
    .eq('lead_id', leadId)
    .eq('operating_strategy_version_id', input.binding.operatingStrategyVersionId)
  if (input.campaignRunId) query = query.eq('campaign_run_id', input.campaignRunId)
  const { data, error } = await query.limit(2)
  if (error) throw error
  if ((data || []).length > 1) {
    throw new Error(
      `Lead ${leadId} has ${(data || []).length} memberships for operating strategy ${input.binding.strategyKey} version ${input.binding.version}; attribution is ambiguous.`
    )
  }
  return (data?.[0]?.id as string | undefined) || null
}

export async function recordOperatingStrategyAttributionQuarantine(
  input: RecordOperatingStrategyAttributionQuarantineInput
) {
  const sourceDomain = requireIdentifier(input.sourceDomain, 'Quarantine source domain')
  const sourceEventKey = requireIdentifier(input.sourceEventKey, 'Quarantine source event key')
  if (!/^[a-z0-9_]+$/.test(sourceDomain)) {
    throw new Error('Quarantine sourceDomain must use lowercase letters, numbers, or underscores.')
  }
  if (sourceEventKey.length > 512 || /[\r\n]/.test(sourceEventKey)) {
    throw new Error('Quarantine sourceEventKey must be a compact opaque identifier.')
  }
  if (!QUARANTINE_REASON_CODES.has(input.reasonCode)) {
    throw new Error(`Unsupported operating-strategy quarantine reason: ${input.reasonCode}.`)
  }
  if (!/^[0-9a-f]{64}$/.test(input.payloadHash)) {
    throw new Error('Quarantine payloadHash must be a lowercase SHA-256 hex digest.')
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error('Quarantine occurredAt must be a valid, stable timestamp.')
  }
  if (
    !input.identifiers ||
    typeof input.identifiers !== 'object' ||
    Array.isArray(input.identifiers)
  ) {
    throw new Error('Quarantine identifiers must be a redacted JSON object.')
  }
  const candidateBindings = input.candidateBindings || []
  if (
    !Array.isArray(candidateBindings) ||
    candidateBindings.some(
      (candidate) => !candidate || typeof candidate !== 'object' || Array.isArray(candidate)
    )
  ) {
    throw new Error('Quarantine candidateBindings must be an array of redacted JSON objects.')
  }
  assertRedactedQuarantineValue(input.identifiers, 'identifiers', new Set())
  assertRedactedQuarantineValue(candidateBindings, 'candidateBindings', new Set())

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_operating_strategy_attribution_quarantine', {
    p_source_domain: sourceDomain,
    p_source_event_key: sourceEventKey,
    p_reason_code: input.reasonCode,
    p_identifiers_json: input.identifiers,
    p_candidate_bindings_json: candidateBindings,
    p_payload_hash: input.payloadHash,
    p_occurred_at: input.occurredAt,
    p_writer_release: 'gate_3c',
  })
  if (error) {
    const message = `${error.message || ''} ${error.details || ''}`.toLowerCase()
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      (message.includes('record_operating_strategy_attribution_quarantine') &&
        (message.includes('not find') || message.includes('does not exist') || message.includes('schema cache')))
    ) {
      throw new Error(
        'Gate 3C attribution quarantine is unavailable. Apply the Gate 3C database migration before governed callbacks can run.'
      )
    }
    throw new Error(`Operating-strategy attribution could not be quarantined: ${error.message}`)
  }
  if (typeof data !== 'string' || !data) {
    throw new Error('Operating-strategy attribution quarantine did not return a quarantine ID.')
  }
  return data
}

export async function recordOperatingStrategyActivity(
  input: RecordOperatingStrategyActivityInput
) {
  const activityType = requireIdentifier(input.activityType, 'Activity type')
  const activityNamespace = requireIdentifier(input.activityNamespace, 'Activity namespace')
  const activityKey = requireIdentifier(input.activityKey, 'Activity key')
  const subjectNamespace = requireIdentifier(input.subjectNamespace, 'Subject namespace')
  const subjectKey = requireIdentifier(input.subjectKey, 'Subject key')
  const idempotencyKey = requireIdentifier(input.idempotencyKey, 'Activity idempotency key')
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error('Activity occurredAt must be a valid, stable timestamp for exact retries.')
  }
  if (input.activityType === 'enrollment') {
    const consent = input.consentBasisSnapshot || {}
    const suppression = input.suppressionSnapshot || {}
    const provenance = consent.provenance
    const hasProvenance =
      (typeof provenance === 'string' && Boolean(provenance.trim())) ||
      (Array.isArray(provenance) && provenance.length > 0) ||
      (Boolean(provenance) &&
        typeof provenance === 'object' &&
        !Array.isArray(provenance) &&
        Object.keys(provenance as Record<string, unknown>).length > 0)
    if (
      !input.outboundEnrollmentId ||
      !input.dispatchReservationId ||
      !String(input.dispatchChannel || '').trim() ||
      !input.dispatchIntentAt ||
      !String(input.outreachPurpose || '').trim() ||
      !String(input.messageVersionKey || '').trim() ||
      consent.dispatchAuthorized !== true ||
      !String(consent.basis || '').trim() ||
      !String(consent.evidenceKey || '').trim() ||
      !hasProvenance ||
      suppression.suppressionCleared !== true ||
      !String(suppression.checkedAt || '').trim() ||
      !String(suppression.evidenceKey || '').trim()
    ) {
      throw new Error('Canonical enrollment activity is missing explicit dispatch or suppression evidence.')
    }
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_operating_strategy_activity', {
    p_operating_strategy_version_id: input.binding.operatingStrategyVersionId,
    p_activity_type: activityType,
    p_activity_namespace: activityNamespace,
    p_activity_key: activityKey,
    p_subject_namespace: subjectNamespace,
    p_subject_key: subjectKey,
    p_idempotency_key: idempotencyKey,
    p_writer_release: 'gate_3c',
    p_occurred_at: input.occurredAt,
    p_parent_activity_id: input.parentActivityId || null,
    p_source_namespace: input.binding.namespace,
    p_source_identifier: input.binding.sourceIdentifier,
    p_strategy_lead_membership_id: input.strategyLeadMembershipId || null,
    p_outbound_enrollment_id: input.outboundEnrollmentId || null,
    p_dispatch_reservation_id: input.dispatchReservationId || null,
    p_dispatch_channel: input.dispatchChannel || null,
    p_dispatch_intent_at: input.dispatchIntentAt || null,
    p_provider: input.provider || null,
    p_provider_message_id: input.providerMessageId || null,
    p_outreach_purpose: input.outreachPurpose || null,
    p_consent_basis_snapshot_json: input.consentBasisSnapshot || {},
    p_suppression_snapshot_json: input.suppressionSnapshot || {},
    p_message_version_key: input.messageVersionKey || null,
    p_provenance_json: input.provenance || [],
    p_metadata_json: {
      ...(input.metadata || {}),
      operatingStrategy: {
        portfolioKey: input.binding.portfolioKey,
        strategyKey: input.binding.strategyKey,
        version: input.binding.version,
        executionMode: input.binding.executionMode,
        destinationMode: input.binding.destinationMode,
        destinationPath: input.binding.destinationPath,
        ctaLabel: input.binding.ctaLabel,
        contractFingerprint: input.binding.contractFingerprint,
        crmOwnerKey: input.binding.crmOwnerKey,
        automationOwnerKey: input.binding.automationOwnerKey,
        dispatchAuthority: input.binding.dispatchAuthority,
      },
    },
  })
  if (error) {
    const message = `${error.message || ''} ${error.details || ''}`.toLowerCase()
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      (message.includes('record_operating_strategy_activity') &&
        (message.includes('not find') || message.includes('does not exist') || message.includes('schema cache')))
    ) {
      throw new Error(
        'Gate 3C activity recorder is unavailable. Apply the Gate 3C database migration before governed activity can run.'
      )
    }
    throw new Error(`Canonical operating strategy activity could not be recorded: ${error.message}`)
  }
  if (typeof data !== 'string' || !data) {
    throw new Error('Canonical operating strategy activity recorder did not return an activity ID.')
  }
  return data
}
