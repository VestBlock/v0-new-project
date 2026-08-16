import 'server-only'

import {
  DealMachineApiError,
  DealMachinePolicyError,
  createDealMachineV2Client,
  createDealMachineV2PaidSearchClient,
  dealMachineApiKey,
  hasDealMachineCredentials,
  isDealMachineDiscoveryEnabled,
  isDealMachinePaidSearchEnabled,
} from '@/lib/dealmachine/v2-client.mjs'
import {
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  hydrateStrategyPlan,
} from '@/lib/dealmachine/v2-strategy-catalog.mjs'
import {
  DEALMACHINE_V2_WRITER_RELEASE,
  appendDealMachineObservation,
  appendDealMachineRequestEvidence,
  assertPropertyOnlyDealMachinePayload,
  beginDealMachineRequest,
  fingerprintDealMachineJson,
  getDealMachineRuntimeControl,
  linkDealMachineObservationEntity,
  settleDealMachineCreditReservation,
  type DealMachineV2Operation,
} from '@/lib/dealmachine/observation-authority'
import { resolveRegisteredStrategyIdentifier } from '@/lib/strategy/registry'

type JsonRecord = Record<string, any>

export type DealMachineDiscoveryMode = 'count_only' | 'property_sample'

export type DealMachineStrategyDiscoveryRun = {
  strategyKey: string
  operatingStrategy: string
  market: string
  mode: DealMachineDiscoveryMode
  requestedRows: number
  matchingProperties: number
  estimatedCredits: number
  actualCredits: number
  observationsAppended: number
  requestId: string | null
  status: 'counted' | 'observed' | 'blocked' | 'failed'
  error: string | null
}

export type DealMachineDiscoveryResult = {
  configured: boolean
  discoveryEnabled: boolean
  paidSearchEnabled: boolean
  ok: boolean
  mode: DealMachineDiscoveryMode
  blockedReason: string | null
  matchingProperties: number
  observationsAppended: number
  creditsReserved: number
  creditsConsumed: number
  startAfter: number
  nextAfter: number
  wrapped: boolean
  strategyRuns: DealMachineStrategyDiscoveryRun[]
}

// Type-compatible fail-closed boundary for historical callers. Strategy
// execution must never invoke the provider or create leads.
export type DealMachineSyncResult = {
  configured: boolean
  ok: boolean
  blockedReason: string | null
  fetched: number
  contactable: number
  contactless: number
  mailReady: number
  ingested: number
  startAfter: number
  nextAfter: number
  wrapped: boolean
  creditsReserved: number
  strategyRuns: Array<{
    strategyKey: string
    market: string
    lowball: boolean
    requestedRows: number
    page: number
    hasNextPage: boolean
    nextPage: number | null
    estimatedCredits: number
    fetched: number
    status: string
    error: string | null
  }>
  leads: []
}

const PROPERTY_ID_FIELDS = ['dm_property_id', 'property_id', 'id'] as const
const PROPERTY_ADDRESS_FIELDS = ['full_address', 'property_address_full', 'city', 'state', 'zip', 'zip_code'] as const
const PROPERTY_PROVIDER_TIME_FIELDS = ['updated_at', 'last_updated'] as const
const PROPERTY_PHASE_ONE_FIELDS = new Set([
  ...PROPERTY_ID_FIELDS,
  ...PROPERTY_ADDRESS_FIELDS,
  ...PROPERTY_PROVIDER_TIME_FIELDS,
  ...DEALMACHINE_STRATEGY_FIELDS,
])

function safeMessage(error: unknown) {
  if (error instanceof DealMachineApiError) {
    return `${error.code || 'provider_error'}${error.status ? ` (${error.status})` : ''}`
  }
  return error instanceof Error ? error.message.slice(0, 300) : 'unknown_error'
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function operationRank(value: string) {
  return ['disabled', 'schema_read', 'count_only', 'property_sample'].indexOf(value)
}

class DealMachineSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DealMachineSchemaError'
  }
}

function nonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DealMachineSchemaError(`DealMachine ${label} must be a nonnegative integer.`)
  }
  return value
}

function propertyCount(payload: JsonRecord) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new DealMachineSchemaError('DealMachine property-count response must be an object.')
  }
  const allowed = new Set(['total_properties', 'total_people', 'total_results'])
  if (Object.keys(payload).some((key) => !allowed.has(key))) {
    throw new DealMachineSchemaError('DealMachine property-count response contains an unexpected field.')
  }
  const properties = nonNegativeInteger(payload.total_properties, 'total_properties')
  const people = nonNegativeInteger(payload.total_people, 'total_people')
  const results = nonNegativeInteger(payload.total_results, 'total_results')
  if (people !== 0 || results !== properties) {
    throw new DealMachineSchemaError('DealMachine property-only count returned people or inconsistent totals.')
  }
  return properties
}

function estimatedCredits(payload: JsonRecord) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Array.isArray(payload.data)) {
    throw new DealMachineSchemaError('DealMachine cost estimate must not return property rows.')
  }
  const estimate = nonNegativeInteger(payload?.estimated_credits?.this_page, 'estimated_credits.this_page')
  const estimatedPeople = nonNegativeInteger(
    payload?.estimated_credits?.breakdown?.people,
    'estimated_credits.breakdown.people'
  )
  if (estimatedPeople !== 0) {
    throw new DealMachineSchemaError('DealMachine property-only estimate included people credits.')
  }
  return estimate
}

function paidPropertySample(payload: JsonRecord, estimate: number, requestedRows: number) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
    throw new DealMachineSchemaError('DealMachine paid search response must contain a data array.')
  }
  if (payload.data.length > requestedRows) {
    throw new DealMachineSchemaError('DealMachine paid search returned more rows than requested.')
  }
  const used = nonNegativeInteger(payload?.credits?.used, 'credits.used')
  const properties = nonNegativeInteger(payload?.credits?.properties, 'credits.properties')
  const people = nonNegativeInteger(payload?.credits?.people, 'credits.people')
  nonNegativeInteger(payload?.credits?.deduplicated, 'credits.deduplicated')
  if (people !== 0) {
    throw new DealMachineSchemaError('DealMachine property-only paid search included people credits.')
  }
  if (properties < payload.data.length || used > properties || used > estimate) {
    throw new DealMachineSchemaError('DealMachine paid-search credit evidence is inconsistent with its reservation.')
  }
  return { rawRows: payload.data as JsonRecord[], used }
}

function schemaDrift(error: unknown) {
  return error instanceof DealMachineSchemaError || error instanceof DealMachinePolicyError
}

function responseRequestId(payload: JsonRecord, metadata?: { requestId?: string | null } | null) {
  const headerValue = String(metadata?.requestId || '').trim()
  if (headerValue) return headerValue
  const value = String(payload?.request_id || payload?.data?.request_id || '').trim()
  return value || null
}

function propertyId(raw: JsonRecord) {
  for (const field of PROPERTY_ID_FIELDS) {
    const value = String(raw?.[field] || '').trim()
    if (value) return value
  }
  return ''
}

function providerUpdatedAt(raw: JsonRecord) {
  for (const field of PROPERTY_PROVIDER_TIME_FIELDS) {
    const value = String(raw?.[field] || '').trim()
    if (value && Number.isFinite(Date.parse(value))) return new Date(value).toISOString()
  }
  return null
}

function projectPropertyObservation(raw: JsonRecord) {
  const projected = Object.fromEntries(
    Object.entries(raw || {}).filter(([key, value]) => PROPERTY_PHASE_ONE_FIELDS.has(key) && value !== undefined)
  )
  assertPropertyOnlyDealMachinePayload(projected)
  return projected
}

function addDays(timestamp: string, days: number) {
  return new Date(Date.parse(timestamp) + days * 86_400_000).toISOString()
}

function fieldFreshness(payload: JsonRecord, observedAt: string) {
  return Object.fromEntries(Object.keys(payload).sort().map((field) => {
    const ttlDays = /^(?:market_status|mls_|foreclosure_)/.test(field)
      ? 1
      : /(?:estimated_value|equity|loan_to_value)/.test(field)
        ? 14
        : /(?:owner|lien|tax|assessor|mortgage)/.test(field)
          ? 30
          : 180
    return [field, { observedAt, expiresAt: addDays(observedAt, ttlDays), ttlDays }]
  }))
}

function canonicalPropertyKey(providerPropertyId: string) {
  return `dealmachine:property:${providerPropertyId}`
}

function requestIdentity(parts: Record<string, unknown>) {
  return fingerprintDealMachineJson(parts)
}

function freeCountBody(searchBody: JsonRecord) {
  const { fields: _fields, page: _page, per_page: _perPage, estimate_cost: _estimate, ...countBody } = searchBody
  return countBody
}

function emptyDiscoveryResult(
  mode: DealMachineDiscoveryMode,
  blockedReason: string,
  configured = hasDealMachineCredentials()
): DealMachineDiscoveryResult {
  return {
    configured,
    discoveryEnabled: isDealMachineDiscoveryEnabled(),
    paidSearchEnabled: isDealMachinePaidSearchEnabled(),
    ok: false,
    mode,
    blockedReason,
    matchingProperties: 0,
    observationsAppended: 0,
    creditsReserved: 0,
    creditsConsumed: 0,
    startAfter: 0,
    nextAfter: 0,
    wrapped: false,
    strategyRuns: [],
  }
}

export async function runDealMachinePropertyDiscovery(options: {
  mode?: DealMachineDiscoveryMode
  strategyKeys?: string[]
  maxStrategies?: number
  sampleSize?: number
  startAfter?: number
  date?: string
  approvalReference?: string
} = {}): Promise<DealMachineDiscoveryResult> {
  const mode = options.mode || 'count_only'
  const operation = mode satisfies DealMachineV2Operation
  const approvalReference = String(options.approvalReference || '').trim()
  if (!hasDealMachineCredentials()) {
    return emptyDiscoveryResult(mode, 'DEALMACHINE_API_KEY is not configured with a current official v2 credential.', false)
  }
  if (!isDealMachineDiscoveryEnabled()) {
    return emptyDiscoveryResult(mode, 'DEALMACHINE_DISCOVERY_ENABLED is disabled; no provider request was made.')
  }
  if (mode === 'property_sample' && !isDealMachinePaidSearchEnabled()) {
    return emptyDiscoveryResult(mode, 'DEALMACHINE_PAID_SEARCH_ENABLED is disabled; no billable provider request was made.')
  }
  if (mode === 'property_sample' && !/^[a-z0-9][a-z0-9_.:/-]{7,127}$/i.test(approvalReference)) {
    return emptyDiscoveryResult(mode, 'A reviewed opaque approvalReference is required for a billable property sample.')
  }

  let control
  try {
    control = await getDealMachineRuntimeControl()
  } catch (error) {
    return emptyDiscoveryResult(mode, safeMessage(error))
  }
  if (!control.integrationEnabled || operationRank(control.maximumOperation) < operationRank(operation)) {
    return emptyDiscoveryResult(
      mode,
      `Database DealMachine control permits ${control.maximumOperation}; ${operation} is not authorized.`
    )
  }
  if (control.requiredWriterRelease !== DEALMACHINE_V2_WRITER_RELEASE) {
    return emptyDiscoveryResult(
      mode,
      `Database DealMachine control requires writer ${control.requiredWriterRelease}; this release is ${DEALMACHINE_V2_WRITER_RELEASE}.`
    )
  }

  const date = String(options.date || new Date().toISOString().slice(0, 10))
  const plans = buildDailyStrategyPlans({
    date,
    strategyKeys: options.strategyKeys,
    includeDisabled: false,
    includeLowball: false,
  })
  const maxStrategies = integer(options.maxStrategies, 3, 1, 16)
  const startAfter = integer(options.startAfter, 0, 0, Math.max(0, plans.length - 1))
  const selectedPlans = Array.from({ length: Math.min(maxStrategies, plans.length) }, (_, offset) =>
    plans[(startAfter + offset) % plans.length]
  )
  const wrapped = startAfter + selectedPlans.length >= plans.length
  const nextAfter = plans.length ? (startAfter + selectedPlans.length) % plans.length : 0
  const sampleSize = integer(options.sampleSize, 5, 1, 10)
  const key = dealMachineApiKey()
  const discoveryClient = createDealMachineV2Client({ apiKey: key })
  const paidClient = mode === 'property_sample' ? createDealMachineV2PaidSearchClient({ apiKey: key }) : null
  const strategyRuns: DealMachineStrategyDiscoveryRun[] = []
  let matchingProperties = 0
  let observationsAppended = 0
  let creditsReserved = 0
  let creditsConsumed = 0

  try {
    const [propertyFilters, propertyFields] = await Promise.all([
      discoveryClient.listFilters('properties'),
      discoveryClient.listFields('properties'),
    ])
    const availableFields = new Set(propertyFields.map((row: JsonRecord) => String(row.field_id || '')))

    for (const plan of selectedPlans) {
      const mapping = resolveRegisteredStrategyIdentifier('seller_execution', plan.key)
      const run: DealMachineStrategyDiscoveryRun = {
        strategyKey: plan.key,
        operatingStrategy: mapping.operatingStrategy,
        market: plan.market,
        mode,
        requestedRows: mode === 'property_sample' ? sampleSize : 0,
        matchingProperties: 0,
        estimatedCredits: 0,
        actualCredits: 0,
        observationsAppended: 0,
        requestId: null,
        status: 'blocked',
        error: null,
      }
      strategyRuns.push(run)

      try {
        const hydrated = await hydrateStrategyPlan(discoveryClient, plan, propertyFilters)
        hydrated.searchBody.fields = DEALMACHINE_STRATEGY_FIELDS.filter((field: string) => availableFields.has(field))
        const countBody = freeCountBody(hydrated.searchBody)
        const countRunKey = `count:${date}:${plan.key}`
        const countHash = requestIdentity({ operation: 'count_only', strategyKey: plan.key, market: plan.market, body: countBody })
        const countIdempotencyKey = requestIdentity({ runKey: countRunKey, requestHash: countHash })
        const countRequestedAt = new Date().toISOString()
        const countAuthority = await beginDealMachineRequest({
          runKey: countRunKey,
          idempotencyKey: countIdempotencyKey,
          operation: 'count_only',
          httpMethod: 'POST',
          endpointPath: '/properties/search/count',
          requestHash: countHash,
          estimatedCredits: 0,
          requestedAt: countRequestedAt,
        })
        if (!countAuthority.shouldExecute) {
          throw new Error('DealMachine count request was already claimed; provider replay was blocked.')
        }
        let countPayload: JsonRecord
        let countedProperties = 0
        try {
          countPayload = await discoveryClient.countProperties(countBody)
          countedProperties = propertyCount(countPayload)
          const countedAt = new Date().toISOString()
          await appendDealMachineRequestEvidence({
            requestId: countAuthority.requestId,
            idempotencyKey: requestIdentity({ requestId: countAuthority.requestId, event: 'count_response' }),
            eventType: 'provider_response',
            providerRequestId: responseRequestId(countPayload, discoveryClient.getLastResponseMetadata()),
            responseHash: fingerprintDealMachineJson(countPayload),
            actualCredits: 0,
            rateLimit: discoveryClient.getRateLimit() || {},
            evidence: {
              strategyKey: plan.key,
              resultKind: 'property_count',
              providerCallClaimId: countAuthority.providerCallClaimId,
            },
            recordedAt: countedAt,
          })
        } catch (error) {
          const failedAt = new Date().toISOString()
          const deterministicRejection = error instanceof DealMachineApiError &&
            typeof error.status === 'number' && error.status >= 400 && error.status < 500 &&
            error.status !== 408 && error.status !== 425 && error.status !== 429
          await appendDealMachineRequestEvidence({
            requestId: countAuthority.requestId,
            idempotencyKey: requestIdentity({ requestId: countAuthority.requestId, event: 'count_failure' }),
            eventType: schemaDrift(error)
              ? 'schema_drift_blocked'
              : deterministicRejection
                ? 'provider_rejected'
                : 'provider_ambiguous',
            providerRequestId:
              (error instanceof DealMachineApiError ? error.requestId : null) ||
              discoveryClient.getLastResponseMetadata()?.requestId ||
              null,
            rateLimit: discoveryClient.getRateLimit() || {},
            evidence: {
              strategyKey: plan.key,
              providerCallClaimId: countAuthority.providerCallClaimId,
              errorCode: error instanceof DealMachineApiError ? error.code : 'local_failure',
            },
            recordedAt: failedAt,
          })
          throw error
        }
        run.matchingProperties = countedProperties
        matchingProperties += run.matchingProperties
        run.requestId = countAuthority.requestId
        run.status = 'counted'
        if (mode === 'count_only') continue

        const searchBody = { ...hydrated.searchBody, page: 1, per_page: sampleSize }
        const estimatePayload = await discoveryClient.estimatePropertySearch(searchBody)
        const estimate = estimatedCredits(estimatePayload)
        run.estimatedCredits = estimate
        if (estimate === 0) {
          run.status = 'counted'
          continue
        }
        const approvalReferenceHash = fingerprintDealMachineJson(approvalReference)
        const searchHash = requestIdentity({
          operation: 'property_sample',
          strategyKey: plan.key,
          market: plan.market,
          body: searchBody,
          approvalReferenceHash,
        })
        const sampleRunKey = `sample:${date}:${plan.key}`
        const sampleIdempotencyKey = requestIdentity({ runKey: sampleRunKey, requestHash: searchHash })
        const requestedAt = new Date().toISOString()
        const authority = await beginDealMachineRequest({
          runKey: sampleRunKey,
          idempotencyKey: sampleIdempotencyKey,
          operation: 'property_sample',
          httpMethod: 'POST',
          endpointPath: '/properties/search',
          requestHash: searchHash,
          estimatedCredits: estimate,
          requestedAt,
        })
        run.requestId = authority.requestId
        creditsReserved += authority.reservedCredits
        if (!authority.shouldExecute) {
          throw new Error('DealMachine paid request was already claimed; billable provider replay was blocked.')
        }

        let payload: JsonRecord
        try {
          payload = await paidClient!.searchProperties(searchBody)
        } catch (error) {
          const failedAt = new Date().toISOString()
          const drift = schemaDrift(error)
          const responseMetadata = paidClient!.getLastResponseMetadata()
          const preCallDrift = drift && !responseMetadata
          const deterministicRejection = !drift && error instanceof DealMachineApiError &&
            typeof error.status === 'number' && error.status >= 400 && error.status < 500 &&
            error.status !== 408 && error.status !== 425 && error.status !== 429
          const releaseReservation = preCallDrift || deterministicRejection
          await appendDealMachineRequestEvidence({
            requestId: authority.requestId,
            idempotencyKey: requestIdentity({ requestId: authority.requestId, event: 'provider_failure' }),
            eventType: preCallDrift
              ? 'schema_drift_blocked'
              : deterministicRejection
                ? 'provider_rejected'
                : 'provider_ambiguous',
            providerRequestId:
              (error instanceof DealMachineApiError ? error.requestId : null) ||
              responseMetadata?.requestId ||
              null,
            rateLimit: paidClient!.getRateLimit() || {},
            evidence: {
              strategyKey: plan.key,
              providerCallClaimId: authority.providerCallClaimId,
              errorCode: error instanceof DealMachineApiError ? error.code : 'local_failure',
              ...(drift ? { reason: preCallDrift ? 'pre_call_schema_drift' : 'provider_response_schema_drift' } : {}),
            },
            recordedAt: failedAt,
          })
          await settleDealMachineCreditReservation({
            requestId: authority.requestId,
            idempotencyKey: requestIdentity({ requestId: authority.requestId, settlement: releaseReservation ? 'released' : 'ambiguous' }),
            disposition: releaseReservation ? 'released' : 'ambiguous',
            actualCredits: releaseReservation ? 0 : null,
            evidence: { strategyKey: plan.key, errorCode: error instanceof DealMachineApiError ? error.code : 'local_failure' },
            settledAt: failedAt,
          })
          throw error
        }

        const observedAt = new Date().toISOString()
        let sample
        try {
          sample = paidPropertySample(payload, estimate, sampleSize)
        } catch (error) {
          const failedAt = new Date().toISOString()
          await appendDealMachineRequestEvidence({
            requestId: authority.requestId,
            idempotencyKey: requestIdentity({ requestId: authority.requestId, event: 'schema_drift' }),
            eventType: 'provider_ambiguous',
            providerRequestId: responseRequestId(payload, paidClient!.getLastResponseMetadata()),
            responseHash: fingerprintDealMachineJson(payload),
            rateLimit: paidClient!.getRateLimit() || {},
            evidence: {
              strategyKey: plan.key,
              providerCallClaimId: authority.providerCallClaimId,
              errorCode: 'paid_response_schema_drift',
              reason: 'provider_response_schema_drift',
            },
            recordedAt: failedAt,
          })
          await settleDealMachineCreditReservation({
            requestId: authority.requestId,
            idempotencyKey: requestIdentity({ requestId: authority.requestId, settlement: 'ambiguous' }),
            disposition: 'ambiguous',
            actualCredits: null,
            evidence: { strategyKey: plan.key, reason: 'paid_response_schema_drift' },
            settledAt: failedAt,
          })
          throw error
        }
        const used = sample.used
        const responseHash = fingerprintDealMachineJson(payload)
        const rawRows = sample.rawRows
        const responseEvidence = {
          requestId: authority.requestId,
          idempotencyKey: requestIdentity({ requestId: authority.requestId, event: 'sample_response' }),
          eventType: 'provider_response' as const,
          providerRequestId: responseRequestId(payload, paidClient!.getLastResponseMetadata()),
          responseHash,
          actualCredits: used,
          rateLimit: paidClient!.getRateLimit() || {},
          evidence: {
            strategyKey: plan.key,
            propertiesReturned: rawRows.length,
            approvalReferenceHash,
            providerCallClaimId: authority.providerCallClaimId,
          },
          recordedAt: observedAt,
        }
        const consumedSettlement = {
          requestId: authority.requestId,
          idempotencyKey: requestIdentity({ requestId: authority.requestId, settlement: 'consumed' }),
          disposition: 'consumed' as const,
          actualCredits: used,
          evidence: {
            propertiesReturned: rawRows.length,
            responseHash,
            approvalReferenceHash,
          },
          settledAt: observedAt,
        }
        let responseEvidenceRecorded = false
        try {
          await appendDealMachineRequestEvidence(responseEvidence)
          responseEvidenceRecorded = true
          for (const raw of rawRows) {
            const id = propertyId(raw)
            if (!id) throw new Error('DealMachine property sample omitted its stable provider property ID.')
            const projected = projectPropertyObservation(raw)
            const observation = await appendDealMachineObservation({
              requestId: authority.requestId,
              providerEntityType: 'property',
              providerEntityId: id,
              rawPayload: projected,
              schemaVersion: 'dealmachine_v2_property_phase1',
              providerUpdatedAt: providerUpdatedAt(projected),
              observedAt,
              fieldFreshness: fieldFreshness(projected, observedAt),
              confidence: 0.8,
              retentionExpiresAt: addDays(observedAt, control.retentionDays),
              idempotencyKey: requestIdentity({ requestId: authority.requestId, propertyId: id, payload: projected }),
            })
            await linkDealMachineObservationEntity({
              observationId: observation.observationId,
              entityNamespace: 'property',
              entityKey: canonicalPropertyKey(id),
              linkType: 'provider_property_id',
              confidence: 1,
              evidence: {
                provider: 'dealmachine',
                providerEntityIdHash: fingerprintDealMachineJson(id),
                addressHash: fingerprintDealMachineJson({
                  fullAddress: projected.full_address || projected.property_address_full || null,
                  city: projected.city || null,
                  state: projected.state || null,
                  zip: projected.zip || projected.zip_code || null,
                }),
              },
              idempotencyKey: requestIdentity({ observationId: observation.observationId, entityKey: canonicalPropertyKey(id) }),
              linkedAt: observedAt,
            })
            run.observationsAppended += 1
            observationsAppended += 1
          }
          await settleDealMachineCreditReservation(consumedSettlement)
          run.actualCredits = used
          creditsConsumed += used
          run.status = 'observed'
        } catch (error) {
          if (!responseEvidenceRecorded) {
            // Exact retry heals an unknown database acknowledgement without
            // touching the provider. The append RPC validates immutable replay.
            await appendDealMachineRequestEvidence(responseEvidence)
          }
          await settleDealMachineCreditReservation(consumedSettlement)
          throw error
        }
      } catch (error) {
        run.status = 'failed'
        run.error = safeMessage(error)
      }
    }
  } catch (error) {
    return {
      configured: true,
      discoveryEnabled: true,
      paidSearchEnabled: isDealMachinePaidSearchEnabled(),
      ok: false,
      mode,
      blockedReason: safeMessage(error),
      matchingProperties,
      observationsAppended,
      creditsReserved,
      creditsConsumed,
      startAfter,
      nextAfter: startAfter,
      wrapped: false,
      strategyRuns,
    }
  }

  const failures = strategyRuns.filter((run) => run.status === 'failed')
  return {
    configured: true,
    discoveryEnabled: true,
    paidSearchEnabled: isDealMachinePaidSearchEnabled(),
    ok: failures.length === 0,
    mode,
    blockedReason: failures.length ? failures.map((run) => `${run.strategyKey}: ${run.error}`).join(' ') : null,
    matchingProperties,
    observationsAppended,
    creditsReserved,
    creditsConsumed,
    startAfter,
    nextAfter,
    wrapped,
    strategyRuns,
  }
}

export async function syncDealMachineLeadSource(_options: Record<string, unknown> = {}): Promise<DealMachineSyncResult> {
  return {
    configured: hasDealMachineCredentials(),
    ok: false,
    blockedReason: 'Legacy DealMachine lead synchronization is retired. Use the governed property-observation pipeline.',
    fetched: 0,
    contactable: 0,
    contactless: 0,
    mailReady: 0,
    ingested: 0,
    startAfter: 0,
    nextAfter: 0,
    wrapped: false,
    creditsReserved: 0,
    strategyRuns: [],
    leads: [],
  }
}
