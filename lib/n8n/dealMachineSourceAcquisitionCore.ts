export type DealMachineAcquisitionOutcome = 'completed' | 'partial' | 'blocked' | 'deferred'

type StrategyRunLike = { status?: string | null }

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
