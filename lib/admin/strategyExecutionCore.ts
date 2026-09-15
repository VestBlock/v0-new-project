export const STRATEGY_MARKET_STATE_SEED_OPTIONS = {
  onConflict: 'strategy_key,market,source_provider',
  ignoreDuplicates: true,
} as const

export function isStrategyMarketDue(input: {
  nextRunAt: string | null
  availableCandidates: number
  nowMs?: number
}) {
  if (input.availableCandidates > 0) return true
  if (!input.nextRunAt) return true
  return Date.parse(input.nextRunAt) <= (input.nowMs ?? Date.now())
}
