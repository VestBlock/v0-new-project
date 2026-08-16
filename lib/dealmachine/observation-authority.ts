import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'

export const DEALMACHINE_V2_WRITER_RELEASE = 'dealmachine_v2_observation_v1'

export type DealMachineV2Operation = 'schema_read' | 'count_only' | 'property_sample'

export type DealMachineRuntimeControl = {
  controlVersion: number
  requiredWriterRelease: string
  integrationEnabled: boolean
  maximumOperation: DealMachineV2Operation | 'disabled'
  maxCreditsPerRun: number
  maxCreditsPerDay: number
  maxCreditsPerMonth: number
  reservationTtlMinutes: number
  retentionDays: number
  allowedOperations: string[]
  allowedFieldGroups: string[]
  deniedFieldGroups: string[]
}

export type DealMachineRequestAuthority = {
  requestId: string
  reservationId: string | null
  controlVersion: number
  reservedCredits: number
  providerCallClaimId: string
  shouldExecute: boolean
}

export type DealMachineObservationInput = {
  requestId: string
  providerEntityType: 'property'
  providerEntityId: string
  rawPayload: Record<string, unknown>
  schemaVersion: string
  providerUpdatedAt: string | null
  observedAt: string
  fieldFreshness: Record<string, unknown>
  confidence: number
  retentionExpiresAt: string
  idempotencyKey: string
  writerRelease?: string
}

const IDENTIFIER = /^[a-z0-9][a-z0-9_.:/-]{0,199}$/i
const SHA256 = /^[a-f0-9]{64}$/
const FORBIDDEN_PAYLOAD_KEY = /(?:^|_)(?:contacts?|people|persons?|emails?|phones?|mobile|gender|race|ethnicity|religion|politic(?:s|al)?|health|medical|credit(?:_behavior|_products?|_score)?|income|wealth|insurance|language|marital|household|occupation|birth|owner_(?:1|2)_full_name|owner_name|mailing_address)(?:$|_)/i

function requiredIdentifier(value: string, label: string) {
  const normalized = String(value || '').trim()
  if (!IDENTIFIER.test(normalized)) throw new Error(`${label} is missing or invalid.`)
  return normalized
}

function requiredUuid(value: string, label: string) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(normalized)) {
    throw new Error(`${label} must be a UUID.`)
  }
  return normalized
}

function requiredSha256(value: string, label: string) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!SHA256.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`)
  return normalized
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => [key, canonicalJson(child)])
    )
  }
  return value
}

export function fingerprintDealMachineJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex')
}

export function assertPropertyOnlyDealMachinePayload(value: unknown, path = 'payload', seen = new Set<object>()) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return
  if (typeof value !== 'object') throw new Error(`DealMachine ${path} contains a non-JSON value.`)
  if (seen.has(value)) throw new Error(`DealMachine ${path} contains a circular value.`)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertPropertyOnlyDealMachinePayload(child, `${path}[${index}]`, seen))
  } else {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
      if (FORBIDDEN_PAYLOAD_KEY.test(normalizedKey)) {
        throw new Error(`DealMachine ${path}.${key} is outside the property-only allowlist.`)
      }
      assertPropertyOnlyDealMachinePayload(child, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

function rows<T>(data: T | T[] | null): T[] {
  return Array.isArray(data) ? data : data ? [data] : []
}

function rpcError(operation: string, error: { message?: string } | null) {
  return new Error(`DealMachine ${operation} authority failed: ${error?.message || 'unknown database error'}`)
}

export async function getDealMachineRuntimeControl(): Promise<DealMachineRuntimeControl> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_dealmachine_v2_runtime_control')
  if (error) throw rpcError('runtime control', error)
  const result = rows(data as Record<string, unknown> | Record<string, unknown>[] | null)
  if (result.length !== 1) throw new Error(`DealMachine runtime control returned ${result.length} rows; exactly one is required.`)
  const row = result[0]
  const maximumOperation = String(row.maximum_operation || 'disabled') as DealMachineRuntimeControl['maximumOperation']
  if (!['disabled', 'schema_read', 'count_only', 'property_sample'].includes(maximumOperation)) {
    throw new Error(`DealMachine runtime control returned unsupported maximum operation ${maximumOperation}.`)
  }
  return {
    controlVersion: Number(row.control_version),
    requiredWriterRelease: requiredIdentifier(String(row.required_writer_release || ''), 'DealMachine required writer release'),
    integrationEnabled: row.integration_enabled === true,
    maximumOperation,
    maxCreditsPerRun: Number(row.max_credits_per_run || 0),
    maxCreditsPerDay: Number(row.max_credits_per_day || 0),
    maxCreditsPerMonth: Number(row.max_credits_per_month || 0),
    reservationTtlMinutes: Number(row.reservation_ttl_minutes || 0),
    retentionDays: Number(row.retention_days || 0),
    allowedOperations: Array.isArray(row.allowed_operations_json) ? row.allowed_operations_json.map(String) : [],
    allowedFieldGroups: Array.isArray(row.allowed_field_groups_json) ? row.allowed_field_groups_json.map(String) : [],
    deniedFieldGroups: Array.isArray(row.denied_field_groups_json) ? row.denied_field_groups_json.map(String) : [],
  }
}

export async function beginDealMachineRequest(input: {
  runKey: string
  idempotencyKey: string
  operation: DealMachineV2Operation
  httpMethod: 'GET' | 'POST'
  endpointPath: string
  requestHash: string
  estimatedCredits: number
  requestedAt: string
  writerRelease?: string
}): Promise<DealMachineRequestAuthority> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('begin_dealmachine_v2_request', {
    p_run_key: requiredIdentifier(input.runKey, 'DealMachine run key'),
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine request idempotency key'),
    p_operation: input.operation,
    p_http_method: input.httpMethod,
    p_endpoint_path: String(input.endpointPath || '').trim(),
    p_request_hash: requiredSha256(input.requestHash, 'DealMachine request hash'),
    p_estimated_credits: Math.max(0, Math.floor(input.estimatedCredits)),
    p_writer_release: requiredIdentifier(input.writerRelease || DEALMACHINE_V2_WRITER_RELEASE, 'DealMachine writer release'),
    p_requested_at: input.requestedAt,
  })
  if (error) throw rpcError('request reservation', error)
  const result = rows(data as Record<string, unknown> | Record<string, unknown>[] | null)
  if (result.length !== 1) throw new Error(`DealMachine request reservation returned ${result.length} rows; exactly one is required.`)
  return {
    requestId: requiredUuid(String(result[0].request_id || ''), 'DealMachine request ID'),
    reservationId: result[0].reservation_id
      ? requiredUuid(String(result[0].reservation_id), 'DealMachine reservation ID')
      : null,
    controlVersion: Number(result[0].control_version),
    reservedCredits: Number(result[0].reserved_credits || 0),
    providerCallClaimId: requiredUuid(
      String(result[0].provider_call_claim_id || ''),
      'DealMachine provider-call claim ID'
    ),
    shouldExecute: result[0].should_execute === true,
  }
}

export async function appendDealMachineRequestEvidence(input: {
  requestId: string
  idempotencyKey: string
  eventType:
    | 'provider_response'
    | 'provider_rejected'
    | 'provider_ambiguous'
    | 'call_abandoned'
    | 'schema_drift_blocked'
    | 'policy_blocked'
    | 'reconciled'
  providerRequestId?: string | null
  responseHash?: string | null
  actualCredits?: number | null
  rateLimit?: Record<string, unknown>
  evidence?: Record<string, unknown>
  recordedAt: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('append_dealmachine_v2_request_evidence', {
    p_request_id: requiredUuid(input.requestId, 'DealMachine request ID'),
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine evidence idempotency key'),
    p_event_type: requiredIdentifier(input.eventType, 'DealMachine evidence event type'),
    p_provider_request_id: input.providerRequestId || null,
    p_response_hash: input.responseHash ? requiredSha256(input.responseHash, 'DealMachine response hash') : null,
    p_actual_credits: input.actualCredits === null || input.actualCredits === undefined
      ? null
      : Math.max(0, Math.floor(input.actualCredits)),
    p_rate_limit_json: input.rateLimit || {},
    p_evidence_json: input.evidence || {},
    p_recorded_at: input.recordedAt,
  })
  if (error) throw rpcError('request evidence', error)
  return requiredUuid(String(data || ''), 'DealMachine request evidence ID')
}

export async function settleDealMachineCreditReservation(input: {
  requestId: string
  idempotencyKey: string
  disposition: 'consumed' | 'released' | 'ambiguous'
  actualCredits?: number | null
  evidence?: Record<string, unknown>
  settledAt: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('settle_dealmachine_v2_credit_reservation', {
    p_request_id: requiredUuid(input.requestId, 'DealMachine request ID'),
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine settlement idempotency key'),
    p_disposition: input.disposition,
    p_actual_credits: input.actualCredits === null || input.actualCredits === undefined
      ? null
      : Math.max(0, Math.floor(input.actualCredits)),
    p_evidence_json: input.evidence || {},
    p_settled_at: input.settledAt,
  })
  if (error) throw rpcError('credit settlement', error)
  return requiredUuid(String(data || ''), 'DealMachine settlement ID')
}

export async function appendDealMachineObservation(input: DealMachineObservationInput) {
  assertPropertyOnlyDealMachinePayload(input.rawPayload)
  const payloadHash = fingerprintDealMachineJson(input.rawPayload)
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('append_dealmachine_v2_observation', {
    p_request_id: requiredUuid(input.requestId, 'DealMachine request ID'),
    p_provider_entity_type: input.providerEntityType,
    p_provider_entity_id: requiredIdentifier(input.providerEntityId, 'DealMachine provider entity ID'),
    p_payload_hash: payloadHash,
    p_raw_payload_json: input.rawPayload,
    p_schema_version: requiredIdentifier(input.schemaVersion, 'DealMachine schema version'),
    p_provider_updated_at: input.providerUpdatedAt,
    p_observed_at: input.observedAt,
    p_field_freshness_json: input.fieldFreshness,
    p_confidence: Math.max(0, Math.min(1, input.confidence)),
    p_retention_expires_at: input.retentionExpiresAt,
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine observation idempotency key'),
    p_writer_release: requiredIdentifier(input.writerRelease || DEALMACHINE_V2_WRITER_RELEASE, 'DealMachine writer release'),
  })
  if (error) throw rpcError('observation append', error)
  return {
    observationId: requiredUuid(String(data || ''), 'DealMachine observation ID'),
    payloadHash,
  }
}

export async function linkDealMachineObservationEntity(input: {
  observationId: string
  entityNamespace: 'property'
  entityKey: string
  linkType: 'provider_property_id' | 'parcel' | 'normalized_address'
  confidence: number
  evidence?: Record<string, unknown>
  idempotencyKey: string
  linkedAt: string
  writerRelease?: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('link_dealmachine_v2_observation_entity', {
    p_observation_id: requiredUuid(input.observationId, 'DealMachine observation ID'),
    p_entity_namespace: input.entityNamespace,
    p_entity_key: requiredIdentifier(input.entityKey, 'DealMachine canonical entity key'),
    p_link_type: input.linkType,
    p_confidence: Math.max(0, Math.min(1, input.confidence)),
    p_evidence_json: input.evidence || {},
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine entity-link idempotency key'),
    p_writer_release: requiredIdentifier(input.writerRelease || DEALMACHINE_V2_WRITER_RELEASE, 'DealMachine writer release'),
    p_linked_at: input.linkedAt,
  })
  if (error) throw rpcError('observation entity link', error)
  return requiredUuid(String(data || ''), 'DealMachine observation entity link ID')
}

export async function recordDealMachineOperatorReview(input: {
  observationEntityLinkId: string
  decision: 'needs_review' | 'accepted_for_attribution' | 'rejected' | 'duplicate' | 'stale' | 'conflict'
  reasonCode: string
  notes?: string | null
  reviewerUserId: string
  idempotencyKey: string
  reviewedAt: string
  evidence?: Record<string, unknown>
  writerRelease?: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_dealmachine_v2_operator_review', {
    p_observation_entity_link_id: requiredUuid(input.observationEntityLinkId, 'DealMachine observation entity link ID'),
    p_decision: input.decision,
    p_reason_code: requiredIdentifier(input.reasonCode, 'DealMachine review reason code'),
    p_notes: input.notes || null,
    p_reviewer_user_id: requiredUuid(input.reviewerUserId, 'DealMachine reviewer user ID'),
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine review idempotency key'),
    p_writer_release: requiredIdentifier(input.writerRelease || DEALMACHINE_V2_WRITER_RELEASE, 'DealMachine writer release'),
    p_reviewed_at: input.reviewedAt,
    p_evidence_json: input.evidence || {},
  })
  if (error) throw rpcError('operator review', error)
  return requiredUuid(String(data || ''), 'DealMachine operator review ID')
}

export async function recordDealMachineSourceAttribution(input: {
  observationEntityLinkId: string
  sourceNamespace: 'seller_execution'
  sourceIdentifier: string
  idempotencyKey: string
  occurredAt: string
  metadata?: Record<string, unknown>
  writerRelease?: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_dealmachine_v2_source_attribution', {
    p_observation_entity_link_id: requiredUuid(input.observationEntityLinkId, 'DealMachine observation entity link ID'),
    p_source_namespace: input.sourceNamespace,
    p_source_identifier: requiredIdentifier(input.sourceIdentifier, 'DealMachine source tactic'),
    p_idempotency_key: requiredIdentifier(input.idempotencyKey, 'DealMachine attribution idempotency key'),
    p_writer_release: requiredIdentifier(input.writerRelease || DEALMACHINE_V2_WRITER_RELEASE, 'DealMachine writer release'),
    p_occurred_at: input.occurredAt,
    p_metadata_json: input.metadata || {},
  })
  if (error) throw rpcError('source attribution', error)
  const result = rows(data as Record<string, unknown> | Record<string, unknown>[] | null)
  if (result.length !== 1) throw new Error(`DealMachine source attribution returned ${result.length} rows; exactly one is required.`)
  return {
    attributionId: requiredUuid(String(result[0].attribution_id || ''), 'DealMachine attribution ID'),
    operatingStrategyVersionId: requiredUuid(
      String(result[0].operating_strategy_version_id || ''),
      'DealMachine operating strategy version ID'
    ),
    canonicalActivityId: requiredUuid(String(result[0].canonical_activity_id || ''), 'DealMachine canonical activity ID'),
  }
}
