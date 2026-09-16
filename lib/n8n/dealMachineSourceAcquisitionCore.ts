export type DealMachineAcquisitionOutcome = 'completed' | 'partial' | 'blocked' | 'deferred'

type StrategyRunLike = { status?: string | null }

type SourceEventLike = {
  payload_json?: Record<string, unknown> | null
}

function positiveCreditValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Completed acquisition events persist the authoritative charge inside
 * payload.result. Legacy events used a top-level field, so both shapes must be
 * counted before another paid slot is admitted.
 */
export function dealMachineSourceEventCredits(row: SourceEventLike) {
  const payload = row.payload_json || {}
  const nestedResult = payload.result && typeof payload.result === 'object'
    ? payload.result as Record<string, unknown>
    : {}
  return positiveCreditValue(
    nestedResult.creditsReserved ??
      nestedResult.creditsUsed ??
      nestedResult.credits_used ??
      payload.creditsReserved ??
      payload.creditsUsed ??
      payload.credits_used
  )
}

export function dealMachineCreditsUsedByEvents(rows: readonly SourceEventLike[]) {
  return rows.reduce((sum, row) => sum + dealMachineSourceEventCredits(row), 0)
}

export function dealMachineRunCreditCap(input: {
  dailyCap: number
  configuredRunCap: number
  usedBeforeRun: number
}) {
  return Math.min(
    Math.max(0, input.configuredRunCap),
    Math.max(0, input.dailyCap - input.usedBeforeRun)
  )
}

export function classifyDealMachineAcquisitionOutcome(result: {
  ok: boolean
  fetched?: number | null
  ingested?: number | null
  creditsReserved?: number | null
  strategyRuns?: StrategyRunLike[] | null
}): Exclude<DealMachineAcquisitionOutcome, 'deferred'> {
  if (result.ok) return 'completed'
  const completedStrategies = (result.strategyRuns || []).filter((run) => run.status === 'searched').length
  const madeProgress =
    completedStrategies > 0 ||
    Number(result.fetched || 0) > 0 ||
    Number(result.ingested || 0) > 0 ||
    Number(result.creditsReserved || 0) > 0
  return madeProgress ? 'partial' : 'blocked'
}

export function dealMachineAcquisitionHttpStatus(result: {
  ok: boolean
  deferred: boolean
  outcome: DealMachineAcquisitionOutcome
}) {
  if (result.ok || result.deferred) return 200
  return result.outcome === 'partial' ? 502 : 503
}

export function dealMachineAcquisitionPersistenceStatus(
  outcome: Exclude<DealMachineAcquisitionOutcome, 'deferred'>
) {
  if (outcome === 'completed') return 'completed' as const
  if (outcome === 'partial') return 'failed' as const
  return 'blocked' as const
}

export function shouldPersistDealMachineCursor(input: {
  cursorBefore: number
  nextAfter: number
  creditsReserved?: number | null
  fetched?: number | null
}) {
  return (
    input.nextAfter !== input.cursorBefore ||
    Number(input.creditsReserved || 0) > 0 ||
    Number(input.fetched || 0) > 0
  )
}
