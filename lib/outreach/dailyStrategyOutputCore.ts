export const DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET = 1_000

export function configuredDailyStrategyOutputTarget(
  env: Record<string, string | undefined> = process.env
) {
  for (const name of [
    'VESTBLOCK_DAILY_OUTREACH_TARGET',
    'OUTREACH_V2_DAILY_QUALITY_TARGET',
    'LEADS_TARGET_EMAILS_PER_DAY',
    'LEADS_DAILY_SEND_LIMIT',
  ]) {
    const raw = env[name]
    if (raw === undefined || raw === null || String(raw).trim() === '') continue
    const parsed = Number.parseInt(String(raw), 10)
    if (Number.isFinite(parsed)) {
      return Math.min(DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET, Math.max(0, parsed))
    }
  }
  return DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET
}

export const DAILY_STRATEGY_OUTPUT_GROUPS = ['seller', 'business', 'partner'] as const
export type DailyStrategyOutputGroup = (typeof DAILY_STRATEGY_OUTPUT_GROUPS)[number]
export const DAILY_STRATEGY_OUTPUT_GROUP_WEIGHTS: Record<DailyStrategyOutputGroup, number> = {
  seller: 8,
  business: 1,
  partner: 1,
}

export const DAILY_STRATEGY_OUTPUT_LANES = [
  { key: 'preforeclosure-equity', label: 'Preforeclosure creative options', group: 'seller' },
  { key: 'tax-code-stack', label: 'Tax delinquent and code stack', group: 'seller' },
  { key: 'tax-remote-equity-rotation', label: 'Tax delinquent remote owner', group: 'seller' },
  { key: 'lien-equity', label: 'Lien with equity', group: 'seller' },
  { key: 'probate-vacant-equity', label: 'Probate or inherited vacant property', group: 'seller' },
  { key: 'portfolio-landlord', label: 'Portfolio landlord', group: 'seller' },
  { key: 'small-multifamily-portfolio', label: 'Small multifamily or portfolio breakup', group: 'seller' },
  { key: 'builder-infill-teardown', label: 'Builder infill and teardown', group: 'seller' },
  { key: 'land-wholesale', label: 'Land and buildable lot', group: 'seller' },
  { key: 'vacant-equity', label: 'Vacant property with equity', group: 'seller' },
  { key: 'seller-finance-free-clear', label: 'Free-and-clear seller finance', group: 'seller' },
  { key: 'subject-to-low-equity', label: 'Subject-to low-equity review', group: 'seller' },
  { key: 'hybrid-equity-bridge', label: 'Hybrid cash and terms', group: 'seller' },
  { key: 'novation-retail-equity', label: 'Novation retail-equity review', group: 'seller' },
  { key: 'absentee-equity-creative', label: 'Absentee-owner creative options', group: 'seller' },
  { key: 'active-stale-creative', label: 'On-market creative finance', group: 'seller' },
  { key: 'dealvault_records', label: 'DealVault Records', group: 'business' },
  { key: 'funding_prep', label: 'Funding Prep', group: 'business' },
  { key: 'search_visibility', label: 'AI / Search Visibility', group: 'business' },
  { key: 'ai_receptionist', label: 'Website / AI Receptionist', group: 'business' },
  { key: 'listing_agents', label: 'Listing Agent Network', group: 'partner' },
  { key: 'buyers', label: 'Buyer Network', group: 'partner' },
  { key: 'lenders', label: 'Lender Network', group: 'partner' },
  { key: 'investors', label: 'Investor Network', group: 'partner' },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  group: DailyStrategyOutputGroup
}>

export type DailyStrategyOutputLane = (typeof DAILY_STRATEGY_OUTPUT_LANES)[number]
export type DailyStrategyOutputLaneKey = DailyStrategyOutputLane['key']

export type DailyStrategyOutputAllocation = DailyStrategyOutputLane & {
  target: number
}

export type DailyStrategyOutputGroupTotals = Record<DailyStrategyOutputGroup, number>
export type DailyStrategyOutputLookup = Record<DailyStrategyOutputLaneKey, number>

export type DailyStrategyOutputPlan = {
  businessDate: string
  target: number
  laneCount: number
  baseAllocation: number
  remainder: number
  rotationOffset: number
  allocations: DailyStrategyOutputAllocation[]
  byKey: DailyStrategyOutputLookup
  groupTotals: DailyStrategyOutputGroupTotals
}

const CHICAGO_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const MILLISECONDS_PER_DAY = 86_400_000

function chicagoDateParts(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new RangeError('A valid date is required')

  const values = Object.fromEntries(
    CHICAGO_DATE_FORMATTER.formatToParts(now)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, Number.parseInt(part.value, 10)])
  ) as Record<'year' | 'month' | 'day', number>

  return values
}

/** Returns the YYYY-MM-DD business date in America/Chicago. */
export function chicagoBusinessDate(now = new Date()) {
  const { year, month, day } = chicagoDateParts(now)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Advances the first remainder slot once per Chicago business date while the
 * canonical lane array remains in a stable order.
 */
export function dailyStrategyOutputRotationOffset(now = new Date()) {
  const { year, month, day } = chicagoDateParts(now)
  const businessDay = Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY)
  return ((businessDay % DAILY_STRATEGY_OUTPUT_LANES.length) + DAILY_STRATEGY_OUTPUT_LANES.length) % DAILY_STRATEGY_OUTPUT_LANES.length
}

function dailyRotationOffsetForCount(now: Date, count: number) {
  const { year, month, day } = chicagoDateParts(now)
  const businessDay = Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY)
  return ((businessDay % count) + count) % count
}

export function getDailyStrategyOutputLane(key: string) {
  return DAILY_STRATEGY_OUTPUT_LANES.find((lane) => lane.key === key) || null
}

export function totalDailyStrategyOutputByGroup(
  allocations: readonly DailyStrategyOutputAllocation[]
): DailyStrategyOutputGroupTotals {
  const totals: DailyStrategyOutputGroupTotals = { seller: 0, business: 0, partner: 0 }
  for (const allocation of allocations) totals[allocation.group] += allocation.target
  return totals
}

export function allocateDailyStrategyOutput(
  target = DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET,
  now = new Date()
): DailyStrategyOutputPlan {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.floor(target)) : DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET
  const laneCount = DAILY_STRATEGY_OUTPUT_LANES.length
  // Keep these legacy summary fields for API compatibility. Actual lane
  // targets below are weighted by business priority, then balanced inside each
  // group with a daily rotating remainder.
  const baseAllocation = Math.floor(safeTarget / laneCount)
  const remainder = safeTarget % laneCount
  const rotationOffset = dailyStrategyOutputRotationOffset(now)
  const totalWeight = Object.values(DAILY_STRATEGY_OUTPUT_GROUP_WEIGHTS).reduce((sum, value) => sum + value, 0)
  const rawGroupTargets = DAILY_STRATEGY_OUTPUT_GROUPS.map((group) => ({
    group,
    raw: safeTarget * DAILY_STRATEGY_OUTPUT_GROUP_WEIGHTS[group] / totalWeight,
  }))
  const groupTargets: DailyStrategyOutputGroupTotals = { seller: 0, business: 0, partner: 0 }
  let assigned = 0
  for (const item of rawGroupTargets) {
    groupTargets[item.group] = Math.floor(item.raw)
    assigned += groupTargets[item.group]
  }
  const tiedRotation = dailyRotationOffsetForCount(now, DAILY_STRATEGY_OUTPUT_GROUPS.length)
  const fractionalPriority = [...rawGroupTargets].sort((left, right) => {
    const fractionDifference = (right.raw - Math.floor(right.raw)) - (left.raw - Math.floor(left.raw))
    if (Math.abs(fractionDifference) > Number.EPSILON) return fractionDifference
    const leftIndex = (DAILY_STRATEGY_OUTPUT_GROUPS.indexOf(left.group) - tiedRotation + DAILY_STRATEGY_OUTPUT_GROUPS.length) % DAILY_STRATEGY_OUTPUT_GROUPS.length
    const rightIndex = (DAILY_STRATEGY_OUTPUT_GROUPS.indexOf(right.group) - tiedRotation + DAILY_STRATEGY_OUTPUT_GROUPS.length) % DAILY_STRATEGY_OUTPUT_GROUPS.length
    return leftIndex - rightIndex
  })
  for (let index = 0; index < safeTarget - assigned; index += 1) {
    groupTargets[fractionalPriority[index % fractionalPriority.length].group] += 1
  }

  const groupLanes = Object.fromEntries(
    DAILY_STRATEGY_OUTPUT_GROUPS.map((group) => [
      group,
      DAILY_STRATEGY_OUTPUT_LANES.filter((lane) => lane.group === group),
    ])
  ) as Record<DailyStrategyOutputGroup, DailyStrategyOutputLane[]>
  const allocations = DAILY_STRATEGY_OUTPUT_LANES.map((lane) => {
    const lanes = groupLanes[lane.group]
    const laneIndex = lanes.findIndex((candidate) => candidate.key === lane.key)
    const groupTarget = groupTargets[lane.group]
    const groupBase = Math.floor(groupTarget / lanes.length)
    const groupRemainder = groupTarget % lanes.length
    const groupRotation = dailyRotationOffsetForCount(now, lanes.length)
    const receivesRemainder = Array.from(
      { length: groupRemainder },
      (_, index) => (groupRotation + index) % lanes.length,
    ).includes(laneIndex)
    return { ...lane, target: groupBase + (receivesRemainder ? 1 : 0) }
  })
  const byKey = Object.fromEntries(
    allocations.map((allocation) => [allocation.key, allocation.target])
  ) as DailyStrategyOutputLookup

  return {
    businessDate: chicagoBusinessDate(now),
    target: safeTarget,
    laneCount,
    baseAllocation,
    remainder,
    rotationOffset,
    allocations,
    byKey,
    groupTotals: totalDailyStrategyOutputByGroup(allocations),
  }
}
