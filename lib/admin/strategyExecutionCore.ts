export const STRATEGY_MARKET_STATE_SEED_OPTIONS = {
  onConflict: 'strategy_key,market,source_provider',
  ignoreDuplicates: true,
} as const

export type StrategyMarketStatePersistenceRow = {
  strategy_key: string
  market: string
  source_provider: string
  status: string
  priority_score: number
  consecutive_empty_runs: number
  last_source_at: string | null
  last_source_success_at: string | null
  last_contact_ready_at: string | null
  next_run_at: string | null
  metrics_json: Record<string, unknown>
  updated_at: string
}

export type StrategyMarketStateIdentity = Pick<
  StrategyMarketStatePersistenceRow,
  'strategy_key' | 'market' | 'source_provider'
>

export type StrategyMarketStateSourceRefreshPatch = Pick<
  StrategyMarketStatePersistenceRow,
  'last_source_at' | 'last_source_success_at' | 'updated_at'
> & Partial<Pick<StrategyMarketStatePersistenceRow, 'last_contact_ready_at'>>

function identityForStrategyMarketState(row: StrategyMarketStatePersistenceRow): StrategyMarketStateIdentity {
  return {
    strategy_key: row.strategy_key,
    market: row.market,
    source_provider: row.source_provider,
  }
}

function seedRowForStrategyMarketState(
  row: StrategyMarketStatePersistenceRow
): StrategyMarketStatePersistenceRow {
  return {
    ...identityForStrategyMarketState(row),
    status: row.status,
    priority_score: row.priority_score,
    consecutive_empty_runs: row.consecutive_empty_runs,
    last_source_at: row.last_source_at,
    last_source_success_at: row.last_source_success_at,
    last_contact_ready_at: row.last_contact_ready_at,
    next_run_at: row.next_run_at,
    metrics_json: row.metrics_json,
    updated_at: row.updated_at,
  }
}

function sourceRefreshPatchForStrategyMarketState(
  row: StrategyMarketStatePersistenceRow
): StrategyMarketStateSourceRefreshPatch {
  return {
    last_source_at: row.last_source_at,
    last_source_success_at: row.last_source_success_at,
    ...(row.last_contact_ready_at
      ? { last_contact_ready_at: row.last_contact_ready_at }
      : {}),
    updated_at: row.updated_at,
  }
}

/**
 * Creates an immutable-safe write plan for strategy-market state.
 *
 * Conflict inserts must be ignored because PostgREST merge-upserts include the
 * conflict identity columns in the generated UPDATE. That fires canonical
 * assignment on historical rows, which the binding guard correctly rejects as
 * an identity change. Existing rows receive only dedicated source-observation
 * timestamps. Runtime governance (status, priority, schedule, empty-run count)
 * belongs to the execution and learning loops, while accumulated metrics_json
 * must not be replaced by a source refresh. Per-run source metrics remain on
 * the immutable strategy_source_events record written by the orchestrator.
 */
export function buildStrategyMarketStatePersistencePlan(rows: StrategyMarketStatePersistenceRow[]) {
  return {
    seedOptions: STRATEGY_MARKET_STATE_SEED_OPTIONS,
    seedRows: rows.map(seedRowForStrategyMarketState),
    mutableUpdates: rows.map((row) => ({
      identity: identityForStrategyMarketState(row),
      patch: sourceRefreshPatchForStrategyMarketState(row),
    })),
  }
}

export function isStrategyMarketDue(input: {
  nextRunAt: string | null
  availableCandidates: number
  nowMs?: number
}) {
  if (input.availableCandidates > 0) return true
  if (!input.nextRunAt) return true
  return Date.parse(input.nextRunAt) <= (input.nowMs ?? Date.now())
}
