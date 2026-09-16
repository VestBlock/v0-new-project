export type DealMachineBudgetDecision =
  | 'search'
  | 'defer_run_cap'
  | 'block_run_cap'
  | 'block_balance'

export type DealMachineCreditBreakdown = {
  used: number
  properties: number
  people: number
  deduplicated: number
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * DealMachine returns this ledger on every billable response. The fallback is
 * deliberately limited to `used`: older/provider-error response shapes may
 * omit the breakdown, but the cap must still reserve the estimated charge.
 */
export function readDealMachineCreditBreakdown(
  payload: Record<string, any> | null | undefined,
  fallbackUsed = 0
): DealMachineCreditBreakdown {
  const credits = payload?.credits && typeof payload.credits === 'object'
    ? payload.credits
    : null
  const reportedUsed = credits ? Number(credits.used) : Number.NaN
  return {
    used: Number.isFinite(reportedUsed)
      ? nonNegativeNumber(reportedUsed)
      : nonNegativeNumber(fallbackUsed),
    properties: credits ? nonNegativeNumber(credits.properties) : 0,
    people: credits ? nonNegativeNumber(credits.people) : 0,
    deduplicated: credits ? nonNegativeNumber(credits.deduplicated) : 0,
  }
}

export function addDealMachineCreditBreakdowns(
  left: DealMachineCreditBreakdown,
  right: DealMachineCreditBreakdown
): DealMachineCreditBreakdown {
  return {
    used: left.used + right.used,
    properties: left.properties + right.properties,
    people: left.people + right.people,
    deduplicated: left.deduplicated + right.deduplicated,
  }
}

export function emptyDealMachineCreditBreakdown(): DealMachineCreditBreakdown {
  return { used: 0, properties: 0, people: 0, deduplicated: 0 }
}

export function dealMachineContactRevealLimit(input: {
  requestedRows: number
  configuredRows: number
  candidateOnly: boolean
  sourceType: string
}) {
  if (input.candidateOnly || input.sourceType !== 'properties') return 0
  return Math.min(
    Math.max(0, Math.floor(input.requestedRows)),
    Math.max(0, Math.floor(input.configuredRows))
  )
}

export function decideDealMachineSearchBudget(input: {
  estimatedCost: number
  creditsReserved: number
  maxCredits: number
  creditBalance: number | null
}): DealMachineBudgetDecision {
  const wouldExceedBalance =
    input.creditBalance !== null &&
    input.creditsReserved + input.estimatedCost > input.creditBalance
  if (wouldExceedBalance) return 'block_balance'

  const wouldExceedRunCap =
    input.creditsReserved + input.estimatedCost > input.maxCredits
  if (!wouldExceedRunCap) return 'search'

  return input.creditsReserved > 0 ? 'defer_run_cap' : 'block_run_cap'
}

export function advanceDealMachineCursor(input: {
  startAfter: number
  advancedPlanCount: number
  planCount: number
}) {
  if (input.planCount <= 0) return { nextAfter: 0, wrapped: false }
  const rawNextAfter = input.startAfter + input.advancedPlanCount
  return {
    nextAfter: rawNextAfter % input.planCount,
    wrapped: rawNextAfter >= input.planCount,
  }
}
