import assert from 'node:assert/strict'

import {
  buildStrategyMarketStatePersistencePlan,
  STRATEGY_MARKET_STATE_SEED_OPTIONS,
} from '../lib/admin/strategyExecutionCore'
import { formatStructuredError } from '../lib/system/errorMessage'

const sourceRow = {
  strategy_key: 'land-wholesale',
  market: 'Cleveland, OH',
  source_provider: 'property_intelligence',
  status: 'active',
  priority_score: 62,
  consecutive_empty_runs: 0,
  last_source_at: '2026-09-15T18:00:00.000Z',
  last_source_success_at: '2026-09-15T18:00:00.000Z',
  last_contact_ready_at: null,
  next_run_at: '2026-09-15T19:00:00.000Z',
  metrics_json: { sourceContractVersion: 'strategy-source-v2', propertyCandidates: 22 },
  updated_at: '2026-09-15T19:00:00.000Z',
  operating_strategy_id: '00000000-0000-4000-8000-000000000001',
  strategy_identifier_namespace: 'seller_execution',
  strategy_binding_mode: 'governed_v1',
  strategy_writer_release: 'must-not-be-forwarded',
}

const plan = buildStrategyMarketStatePersistencePlan([sourceRow])

assert.deepEqual(
  plan.seedOptions,
  STRATEGY_MARKET_STATE_SEED_OPTIONS,
  'source-market inserts must ignore conflicts so immutable bindings are not rewritten'
)
assert.deepEqual(plan.seedRows, [
  {
    strategy_key: sourceRow.strategy_key,
    market: sourceRow.market,
    source_provider: sourceRow.source_provider,
    status: sourceRow.status,
    priority_score: sourceRow.priority_score,
    consecutive_empty_runs: sourceRow.consecutive_empty_runs,
    last_source_at: sourceRow.last_source_at,
    last_source_success_at: sourceRow.last_source_success_at,
    last_contact_ready_at: sourceRow.last_contact_ready_at,
    next_run_at: sourceRow.next_run_at,
    metrics_json: sourceRow.metrics_json,
    updated_at: sourceRow.updated_at,
  },
])
assert.deepEqual(plan.mutableUpdates, [
  {
    identity: {
      strategy_key: sourceRow.strategy_key,
      market: sourceRow.market,
      source_provider: sourceRow.source_provider,
    },
    patch: {
      last_source_at: sourceRow.last_source_at,
      last_source_success_at: sourceRow.last_source_success_at,
      updated_at: sourceRow.updated_at,
    },
  },
])

const mutablePatch = plan.mutableUpdates[0].patch as Record<string, unknown>
for (const immutableColumn of [
  'strategy_key',
  'market',
  'source_provider',
  'operating_strategy_id',
  'operating_strategy_version_id',
  'strategy_identifier_namespace',
  'strategy_binding_mode',
  'strategy_binding_recorded_at',
  'strategy_writer_release',
  'operating_contract_fingerprint',
  'status',
  'priority_score',
  'consecutive_empty_runs',
  'next_run_at',
  'metrics_json',
]) {
  assert.equal(
    Object.hasOwn(mutablePatch, immutableColumn),
    false,
    `mutable market refresh must not write ${immutableColumn}`
  )
}

const contactReadyPlan = buildStrategyMarketStatePersistencePlan([
  { ...sourceRow, last_contact_ready_at: '2026-09-15T19:00:00.000Z' },
])
assert.equal(
  contactReadyPlan.mutableUpdates[0].patch.last_contact_ready_at,
  '2026-09-15T19:00:00.000Z',
  'a positive contact-ready observation must advance its dedicated timestamp'
)
assert.equal(
  Object.hasOwn(plan.mutableUpdates[0].patch, 'last_contact_ready_at'),
  false,
  'an empty source run must not erase the last known contact-ready timestamp'
)

assert.equal(
  formatStructuredError({
    message: 'Historical binding is immutable.',
    details: 'A conflict update attempted to rewrite canonical identity.',
    hint: 'Update mutable fields only.',
    code: '23514',
  }),
  'Historical binding is immutable. (code: 23514)'
)
assert.equal(
  formatStructuredError({}, 'Strategy source orchestration failed.'),
  'Strategy source orchestration failed.',
  'an empty object must use the provided fallback instead of [object Object]'
)
assert.equal(
  formatStructuredError({ message: { nested: 'database error' } }),
  'Unexpected error.',
  'an unexpected object shape must use a safe fallback instead of leaking arbitrary fields'
)
assert.equal(formatStructuredError(new Error('Network unavailable.')), 'Network unavailable.')

console.log('Strategy source persistence regression checks passed.')
