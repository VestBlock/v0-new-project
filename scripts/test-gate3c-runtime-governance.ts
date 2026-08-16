import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

type RpcResult = { data: unknown; error: null | { code?: string; message: string; details?: string } }
type RpcHandler = (name: string, args: Record<string, unknown>) => Promise<RpcResult>
let rpcHandler: RpcHandler = async () => ({ data: null, error: null })
type FromHandler = (
  table: string,
  filters: Array<[string, unknown]>
) => Promise<RpcResult>
let fromHandler: FromHandler = async () => ({ data: [], error: null })

function queryBuilder(table: string) {
  const filters: Array<[string, unknown]> = []
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return builder
    },
    limit: () => fromHandler(table, filters),
  }
  return builder
}

const adminModule = require.resolve('../lib/supabase/admin')
require.cache[adminModule] = {
  id: adminModule,
  filename: adminModule,
  loaded: true,
  exports: {
    createAdminClient: () => ({
      rpc: (name: string, args: Record<string, unknown>) => rpcHandler(name, args),
      from: (table: string) => queryBuilder(table),
    }),
  },
} as NodeModule

const {
  authorizeGate3d1CanaryDispatch,
  authorizeOperatingStrategyDispatch,
  recordOperatingStrategyActivity,
  recordOperatingStrategyAttributionQuarantine,
  reserveOperatingStrategyDispatch,
  reserveGate3d1CanaryDispatch,
  resolveOperatingStrategyBinding,
} = require('../lib/strategy/runtime-governance') as typeof import('../lib/strategy/runtime-governance')

const resolverRow = {
  portfolio_key: 'opportunity',
  strategy_key: 'seller_options_intake',
  operating_strategy_id: '10000000-0000-4000-8000-000000000001',
  operating_strategy_version_id: '20000000-0000-4000-8000-000000000001',
  operating_strategy_version: 2,
  version_status: 'active',
  operating_contract_fingerprint: '0123456789abcdef0123456789abcdef',
  execution_mode: 'approved_live',
  external_send_cap: 5,
  destination_mode: 'public_route',
  destination_path: '/sell',
  cta_label: 'Review seller options',
  crm_owner_key: 'vestblock_crm',
  automation_owner_key: 'vestblock_application',
  dispatch_authority: 'vestblock_application',
  primary_channels_json: ['resend_email'],
  secondary_channels_json: ['operator_task'],
  owner_contract_json: {},
}

async function main() {
  rpcHandler = async (name) => {
    assert.equal(name, 'resolve_operating_strategy_runtime')
    return { data: [resolverRow], error: null }
  }
  const binding = await resolveOperatingStrategyBinding({
    namespace: 'legacy_runtime',
    sourceIdentifier: 'seller-outreach',
  })
  assert.equal(binding.strategyKey, 'seller_options_intake')
  assert.equal(binding.sourceIdentifier, 'seller-outreach')
  assert.equal(binding.contractFingerprint, resolverRow.operating_contract_fingerprint)

  process.env.OUTREACH_LIVE_SEND_ENABLED = 'true'
  assert.equal(
    (
      await authorizeOperatingStrategyDispatch({
        namespace: 'legacy_runtime',
        sourceIdentifier: 'seller-outreach',
        channel: 'resend_email',
        requiredDispatchAuthority: 'vestblock_application',
      })
    ).operatingStrategyVersionId,
    binding.operatingStrategyVersionId
  )
  process.env.OUTREACH_LIVE_SEND_ENABLED = 'false'
  await assert.rejects(
    authorizeOperatingStrategyDispatch({
      namespace: 'legacy_runtime',
      sourceIdentifier: 'seller-outreach',
      channel: 'resend_email',
      requiredDispatchAuthority: 'vestblock_application',
    }),
    /disabled by OUTREACH_LIVE_SEND_ENABLED/
  )
  process.env.OUTREACH_LIVE_SEND_ENABLED = 'true'
  await assert.rejects(
    authorizeOperatingStrategyDispatch({
      namespace: 'legacy_runtime',
      sourceIdentifier: 'seller-outreach',
      channel: 'gmail_email',
    }),
    /not allowed/
  )

  const gate3d1ResolverRow = {
    ...resolverRow,
    operating_strategy_version: 1,
    operating_contract_fingerprint: 'fedcba9876543210fedcba9876543210',
    external_send_cap: 1,
    primary_channels_json: ['operator_task'],
    secondary_channels_json: ['outlook_graph', 'no_outreach'],
  }
  process.env.OUTREACH_LIVE_SEND_ENABLED = 'false'
  process.env.GATE3D1_GRAPH_REPLY_CANARY_ENABLED = 'true'
  process.env.GATE3D1_GRAPH_REPLY_CANARY_MAX_SENDS = '1'
  process.env.GATE3D1_GRAPH_REPLY_CANARY_APPROVAL_MANIFEST_KEY =
    'gate3d1-seller-positive-inbound-reply-v1'
  let stagedControlVersionId = gate3d1ResolverRow.operating_strategy_version_id
  fromHandler = async (table) => {
    if (table === 'operating_strategy_runtime_controls') {
      return {
        data: [{
          canary_enforcement_status: 'reviewed_cap_one',
          canary_operating_strategy_version_id: stagedControlVersionId,
          canary_required_writer_release: 'gate3d1_graph_reply_v1',
          outbound_kill_switch: false,
        }],
        error: null,
      }
    }
    assert.equal(table, 'operating_strategy_outbound_controls')
    return {
      data: [{
        operating_strategy_id: gate3d1ResolverRow.operating_strategy_id,
        paused: false,
        writer_release: 'gate3d1_graph_reply_v1',
      }],
      error: null,
    }
  }
  rpcHandler = async (name, args) => {
    if (name === 'resolve_operating_strategy_runtime') {
      assert.equal(args.p_source_namespace, 'operating_strategy')
      assert.equal(args.p_source_identifier, 'seller_options_intake')
      return { data: [gate3d1ResolverRow], error: null }
    }
    assert.equal(name, 'reserve_operating_strategy_dispatch')
    assert.equal(
      args.p_operating_contract_fingerprint,
      gate3d1ResolverRow.operating_contract_fingerprint,
      'The active post-activation fingerprint, not the prepared draft fingerprint, must be reserved.'
    )
    assert.deepEqual(args.p_fallback_channels, [])
    return {
      data: [{
        reservation_id: '50000000-0000-4000-8000-000000000003',
        reserved_count: 1,
        remaining_daily_capacity: 0,
        expires_at: '2026-08-15T20:05:00.000Z',
        capacity_window_ends_at: '2026-08-16T00:00:00.000Z',
      }],
      error: null,
    }
  }
  const gate3d1Binding = await authorizeGate3d1CanaryDispatch()
  assert.equal(
    gate3d1Binding.contractFingerprint,
    gate3d1ResolverRow.operating_contract_fingerprint
  )
  assert.notEqual(gate3d1Binding.contractFingerprint, 'b321ad591bffc099f3197a84c5c38028')
  const gate3d1Reservation = await reserveGate3d1CanaryDispatch({
    binding: gate3d1Binding,
    idempotencyKey: 'gate3d1-runtime-active-fingerprint-v1',
  })
  assert.equal(gate3d1Reservation.reservationId, '50000000-0000-4000-8000-000000000003')

  stagedControlVersionId = '29999999-9999-4999-8999-999999999999'
  await assert.rejects(
    authorizeGate3d1CanaryDispatch(),
    /exact founder-released cap-one database controls/
  )
  stagedControlVersionId = gate3d1ResolverRow.operating_strategy_version_id
  process.env.OUTREACH_LIVE_SEND_ENABLED = 'true'

  rpcHandler = async (name, args) => {
    if (name === 'resolve_operating_strategy_runtime') return { data: [resolverRow], error: null }
    assert.equal(name, 'reserve_operating_strategy_dispatch')
    assert.equal(args.p_operating_contract_fingerprint, resolverRow.operating_contract_fingerprint)
    assert.deepEqual(args.p_fallback_channels, [])
    return {
      data: [
        {
          reservation_id: '50000000-0000-4000-8000-000000000001',
          reserved_count: 1,
          remaining_daily_capacity: 4,
          expires_at: '2026-08-15T20:05:00.000Z',
          capacity_window_ends_at: '2026-08-16T00:00:00.000Z',
        },
      ],
      error: null,
    }
  }
  const reservation = await reserveOperatingStrategyDispatch({
    binding,
    channel: 'resend_email',
    idempotencyKey: 'dispatch-reservation:message-1',
  })
  assert.equal(reservation.reservationId, '50000000-0000-4000-8000-000000000001')
  assert.equal(reservation.remainingDailyCapacity, 4)

  const resolverRowWithFallback = {
    ...resolverRow,
    secondary_channels_json: ['gmail_email'],
  }
  rpcHandler = async (name, args) => {
    if (name === 'resolve_operating_strategy_runtime') {
      return { data: [resolverRowWithFallback], error: null }
    }
    assert.equal(name, 'reserve_operating_strategy_dispatch')
    assert.deepEqual(args.p_fallback_channels, ['gmail_email'])
    return {
      data: [
        {
          reservation_id: '50000000-0000-4000-8000-000000000002',
          reserved_count: 1,
          remaining_daily_capacity: 3,
          expires_at: '2026-08-15T20:05:00.000Z',
          capacity_window_ends_at: '2026-08-16T00:00:00.000Z',
        },
      ],
      error: null,
    }
  }
  const fallbackReservation = await reserveOperatingStrategyDispatch({
    binding,
    channel: 'resend_email',
    fallbackChannels: ['gmail_email', 'gmail_email'],
    idempotencyKey: 'dispatch-reservation:message-2',
  })
  assert.equal(fallbackReservation.reservationId, '50000000-0000-4000-8000-000000000002')

  const occurredAt = '2026-08-15T20:00:00.000Z'
  rpcHandler = async (name, args) => {
    assert.equal(name, 'record_operating_strategy_activity')
    assert.equal(args.p_occurred_at, occurredAt)
    assert.equal(args.p_source_namespace, 'legacy_runtime')
    assert.equal(args.p_source_identifier, 'seller-outreach')
    assert.equal(args.p_dispatch_reservation_id, reservation.reservationId)
    assert.equal(args.p_dispatch_channel, 'resend_email')
    return { data: '30000000-0000-4000-8000-000000000001', error: null }
  }
  assert.equal(
    await recordOperatingStrategyActivity({
      binding,
      activityType: 'enrollment',
      activityNamespace: 'command_center_outbound_enrollment',
      activityKey: 'enrollment-1',
      subjectNamespace: 'lead',
      subjectKey: 'lead-1',
      idempotencyKey: 'intent-1',
      occurredAt,
      outboundEnrollmentId: '40000000-0000-4000-8000-000000000001',
      dispatchReservationId: reservation.reservationId,
      dispatchChannel: 'resend_email',
      dispatchIntentAt: occurredAt,
      outreachPurpose: 'seller_acquisition_first_touch',
      consentBasisSnapshot: {
        dispatchAuthorized: true,
        basis: 'operator_approved_business_outreach',
        evidenceKey: 'approved-message:message-1',
        provenance: { messageId: 'message-1' },
      },
      suppressionSnapshot: {
        suppressionCleared: true,
        checkedAt: occurredAt,
        evidenceKey: 'suppression-check:lead-1',
      },
      messageVersionKey: 'message-1:v1',
    }),
    '30000000-0000-4000-8000-000000000001'
  )

  rpcHandler = async (name, args) => {
    assert.equal(name, 'record_operating_strategy_attribution_quarantine')
    assert.equal(args.p_reason_code, 'ambiguous_governed_enrollment')
    assert.equal(args.p_writer_release, 'gate_3c')
    assert.deepEqual(args.p_identifiers_json, {
      provider: 'outlook',
      providerMessageId: 'opaque-message-id',
      recipientHash: '0123456789abcdef',
      subjectKey: 'opaque-subject-id',
    })
    return { data: '60000000-0000-4000-8000-000000000001', error: null }
  }
  const payloadHash = 'a'.repeat(64)
  assert.equal(
    await recordOperatingStrategyAttributionQuarantine({
      sourceDomain: 'outlook_reply',
      sourceEventKey: 'opaque-event-id',
      reasonCode: 'ambiguous_governed_enrollment',
      identifiers: {
        provider: 'outlook',
        providerMessageId: 'opaque-message-id',
        recipientHash: '0123456789abcdef',
        subjectKey: 'opaque-subject-id',
      },
      candidateBindings: [
        { operatingStrategyVersionId: binding.operatingStrategyVersionId },
      ],
      payloadHash,
      occurredAt,
    }),
    '60000000-0000-4000-8000-000000000001'
  )
  await assert.rejects(
    recordOperatingStrategyAttributionQuarantine({
      sourceDomain: 'outlook_reply',
      sourceEventKey: 'unsafe-event',
      reasonCode: 'attribution_not_found',
      identifiers: { recipientEmail: 'person@example.com' },
      payloadHash,
      occurredAt,
    }),
    /hash or opaque identifier/
  )
  await assert.rejects(
    recordOperatingStrategyAttributionQuarantine({
      sourceDomain: 'outlook_reply',
      sourceEventKey: 'bad-hash',
      reasonCode: 'attribution_not_found',
      identifiers: {},
      payloadHash: 'not-sha-256',
      occurredAt,
    }),
    /lowercase SHA-256/
  )

  rpcHandler = async () => ({
    data: null,
    error: {
      code: 'PGRST202',
      message: 'record_operating_strategy_attribution_quarantine was not found in the schema cache.',
    },
  })
  await assert.rejects(
    recordOperatingStrategyAttributionQuarantine({
      sourceDomain: 'outlook_reply',
      sourceEventKey: 'missing-rpc',
      reasonCode: 'attribution_not_found',
      identifiers: {},
      payloadHash,
      occurredAt,
    }),
    /Gate 3C attribution quarantine is unavailable/
  )

  rpcHandler = async () => ({ data: [], error: null })
  await assert.rejects(
    resolveOperatingStrategyBinding({
      namespace: 'legacy_runtime',
      sourceIdentifier: 'seller-outreach',
    }),
    /returned 0 active versions/
  )

  rpcHandler = async () => ({
    data: null,
    error: { code: 'PGRST202', message: 'Function was not found in the schema cache.' },
  })
  await assert.rejects(
    resolveOperatingStrategyBinding({
      namespace: 'legacy_runtime',
      sourceIdentifier: 'seller-outreach',
    }),
    /Gate 3C runtime resolver is unavailable/
  )

  console.log('gate3c-runtime-governance: ok')
}

void main()
