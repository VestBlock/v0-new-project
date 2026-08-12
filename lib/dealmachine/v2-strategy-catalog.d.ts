import type { DealMachineV2Client } from './v2-client.mjs'

export type DealMachineFilterSpec = {
  filterId: string
  operator: string | null
  value?: unknown
  optionLabels?: string[]
  optional?: boolean
}

export type DealMachineStrategy = {
  key: string
  label: string
  markets: string[]
  reviewOnly: boolean
  candidateOnly: boolean
  candidateReason?: string
  enabled: boolean
  lowball: boolean
  budgetWeight: number
  anchor?: 'properties' | 'people'
  variants: Array<{
    key: string
    signals: string[]
    filters: DealMachineFilterSpec[]
  }>
}

export const DEALMACHINE_STRATEGY_FIELDS: string[]
export const DEALMACHINE_STRATEGIES: DealMachineStrategy[]
export const DEALMACHINE_STRATEGY_BY_KEY: Map<string, DealMachineStrategy>
export function splitMarket(market: string): { city: string; state: string }
export function selectDailyStrategyMarket(strategy: DealMachineStrategy, date?: string): string
export function selectDailyStrategyVariant(strategy: DealMachineStrategy, date?: string): DealMachineStrategy['variants'][number]
export function compileStrategyFilters(
  filterSpecs: DealMachineFilterSpec[],
  filterMetadata: any[]
): { filters: Array<Record<string, unknown>>; warnings: string[] }
export function buildDailyStrategyPlans(options?: {
  date?: string
  strategyKeys?: string[]
  includeDisabled?: boolean
  includeLowball?: boolean
}): Array<DealMachineStrategy & { date: string; market: string; variant: DealMachineStrategy['variants'][number] }>
export function hydrateStrategyPlan(
  client: DealMachineV2Client,
  plan: ReturnType<typeof buildDailyStrategyPlans>[number],
  filterMetadata: any[]
): Promise<any>
