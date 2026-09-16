export type DealMachineBudgetDecision =
  | 'search'
  | 'defer_run_cap'
  | 'block_run_cap'
  | 'block_balance'

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
