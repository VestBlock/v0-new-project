import {
  DAILY_STRATEGY_OUTPUT_LANES,
  chicagoBusinessDate,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'

export const OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP = 25
export const OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP = 2
export const OUTLOOK_COLD_B2B_INVOCATION_CAP = 2
export const OUTLOOK_COLD_B2B_WINDOW_MS = 24 * 60 * 60 * 1_000

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000
const HASH_PATTERN = /^[a-f0-9]{64}$/

export const OUTLOOK_COLD_B2B_LANE_KEYS = Object.freeze(
  DAILY_STRATEGY_OUTPUT_LANES
    .filter((lane) => lane.group === 'business' || lane.group === 'partner')
    .map((lane) => lane.key)
) as readonly DailyStrategyOutputLaneKey[]

const OUTLOOK_COLD_B2B_LANE_SET = new Set<string>(OUTLOOK_COLD_B2B_LANE_KEYS)

export type OutlookColdBudgetAttemptMarker = {
  reservationId: string
  idempotencyKeyHash: string
  recipientDomainHash: string
  invocationIdHash: string
  strategyKey: DailyStrategyOutputLaneKey
  businessDate: string
  attemptedAt: string
}

export type OutlookColdBudgetMetrics = {
  schemaVersion: 1
  windowHours: 24
  attemptMarkers: OutlookColdBudgetAttemptMarker[]
}

export type OutlookColdBudgetDecision = {
  allowed: boolean
  duplicate: boolean
  reason: string | null
  attemptCount: number
  domainAttemptCount: number
  invocationAttemptCount: number
  laneAttemptCount: number
  laneDailyCap: number
  remaining: number
  domainRemaining: number
  metrics: OutlookColdBudgetMetrics | null
}

export type OutlookColdBudgetInspection = {
  valid: boolean
  reason: string | null
  windowHours: 24
  globalAttemptCap: number
  attemptCount: number
  remaining: number
  businessDate: string
  laneAttemptCounts: Record<DailyStrategyOutputLaneKey, number>
  laneCaps: Record<DailyStrategyOutputLaneKey, number>
}

function invalid(reason: string): OutlookColdBudgetDecision {
  return {
    allowed: false,
    duplicate: false,
    reason,
    attemptCount: 0,
    domainAttemptCount: 0,
    invocationAttemptCount: 0,
    laneAttemptCount: 0,
    laneDailyCap: 0,
    remaining: 0,
    domainRemaining: 0,
    metrics: null,
  }
}

export function seedOutlookColdBudget(): OutlookColdBudgetMetrics {
  return {
    schemaVersion: 1,
    windowHours: 24,
    attemptMarkers: [],
  }
}

/** Distributes the global cap exactly across every eligible lane with rotating remainder slots. */
export function allocateOutlookColdLaneCaps(now: Date = new Date()) {
  const businessDate = chicagoBusinessDate(now)
  const [year, month, day] = businessDate.split('-').map(Number)
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  const rotationOffset = ((dayIndex % OUTLOOK_COLD_B2B_LANE_KEYS.length) + OUTLOOK_COLD_B2B_LANE_KEYS.length) % OUTLOOK_COLD_B2B_LANE_KEYS.length
  const baseCap = Math.floor(OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP / OUTLOOK_COLD_B2B_LANE_KEYS.length)
  const remainder = OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP % OUTLOOK_COLD_B2B_LANE_KEYS.length
  const laneCaps = Object.fromEntries(
    OUTLOOK_COLD_B2B_LANE_KEYS.map((strategyKey) => [strategyKey, baseCap])
  ) as Record<DailyStrategyOutputLaneKey, number>
  for (let index = 0; index < remainder; index += 1) {
    const strategyKey = OUTLOOK_COLD_B2B_LANE_KEYS[
      (rotationOffset + index) % OUTLOOK_COLD_B2B_LANE_KEYS.length
    ]
    laneCaps[strategyKey] = baseCap + 1
  }
  return { businessDate, rotationOffset, laneCaps }
}

/** Direct cold dispatch is restricted to weekdays from 15:00 through 21:59 UTC. */
export function isOutlookColdSendWindow(now: Date = new Date()) {
  if (!Number.isFinite(now.getTime())) return false
  const weekday = now.getUTCDay()
  const hour = now.getUTCHours()
  return weekday >= 1 && weekday <= 5 && hour >= 15 && hour < 22
}

function normalizeOutlookColdBudget(
  value: unknown,
  now: Date
): { valid: true; metrics: OutlookColdBudgetMetrics } | { valid: false; reason: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, reason: 'outlook_cold_budget_state_missing' }
  }

  const candidate = value as Record<string, unknown>
  if (
    candidate.schemaVersion !== 1 ||
    candidate.windowHours !== 24 ||
    !Array.isArray(candidate.attemptMarkers)
  ) {
    return { valid: false, reason: 'outlook_cold_budget_state_invalid' }
  }

  const lowerBound = now.getTime() - OUTLOOK_COLD_B2B_WINDOW_MS
  const markers: OutlookColdBudgetAttemptMarker[] = []
  for (const raw of candidate.attemptMarkers) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { valid: false, reason: 'outlook_cold_budget_marker_invalid' }
    }
    const marker = raw as Record<string, unknown>
    const attemptedAtMs = Date.parse(String(marker.attemptedAt || ''))
    const reservationId = String(marker.reservationId || '').trim()
    const idempotencyKeyHash = String(marker.idempotencyKeyHash || '').trim().toLowerCase()
    const recipientDomainHash = String(marker.recipientDomainHash || '').trim().toLowerCase()
    const invocationIdHash = String(marker.invocationIdHash || '').trim().toLowerCase()
    const strategyKey = String(marker.strategyKey || '').trim() as DailyStrategyOutputLaneKey
    const businessDate = String(marker.businessDate || '').trim()
    if (
      !reservationId ||
      reservationId.length > 200 ||
      !HASH_PATTERN.test(idempotencyKeyHash) ||
      !HASH_PATTERN.test(recipientDomainHash) ||
      !HASH_PATTERN.test(invocationIdHash) ||
      !OUTLOOK_COLD_B2B_LANE_SET.has(strategyKey) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(businessDate) ||
      !Number.isFinite(attemptedAtMs) ||
      attemptedAtMs > now.getTime() + MAX_FUTURE_SKEW_MS ||
      businessDate !== chicagoBusinessDate(new Date(attemptedAtMs))
    ) {
      return { valid: false, reason: 'outlook_cold_budget_marker_invalid' }
    }
    if (attemptedAtMs < lowerBound) continue
    markers.push({
      reservationId,
      idempotencyKeyHash,
      recipientDomainHash,
      invocationIdHash,
      strategyKey,
      businessDate,
      attemptedAt: new Date(attemptedAtMs).toISOString(),
    })
  }

  return {
    valid: true,
    metrics: {
      schemaVersion: 1,
      windowHours: 24,
      attemptMarkers: markers,
    },
  }
}

/**
 * Reads the persisted rolling budget without reserving capacity. This is the
 * authoritative Command Center view of direct Outlook cold attempts; it never
 * consults the retired outreach-attempt reservation ledger.
 */
export function inspectOutlookColdBudget(
  metrics: unknown,
  now: Date = new Date()
): OutlookColdBudgetInspection {
  const allocation = Number.isFinite(now.getTime())
    ? allocateOutlookColdLaneCaps(now)
    : allocateOutlookColdLaneCaps(new Date(0))
  const emptyLaneCounts = Object.fromEntries(
    OUTLOOK_COLD_B2B_LANE_KEYS.map((strategyKey) => [strategyKey, 0])
  ) as Record<DailyStrategyOutputLaneKey, number>

  if (!Number.isFinite(now.getTime())) {
    return {
      valid: false,
      reason: 'outlook_cold_budget_clock_invalid',
      windowHours: 24,
      globalAttemptCap: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
      attemptCount: 0,
      remaining: 0,
      businessDate: allocation.businessDate,
      laneAttemptCounts: emptyLaneCounts,
      laneCaps: allocation.laneCaps,
    }
  }

  const normalized = normalizeOutlookColdBudget(metrics, now)
  if (!normalized.valid) {
    return {
      valid: false,
      reason: normalized.reason,
      windowHours: 24,
      globalAttemptCap: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
      attemptCount: 0,
      remaining: 0,
      businessDate: allocation.businessDate,
      laneAttemptCounts: emptyLaneCounts,
      laneCaps: allocation.laneCaps,
    }
  }

  const laneAttemptCounts = { ...emptyLaneCounts }
  for (const marker of normalized.metrics.attemptMarkers) {
    if (marker.businessDate === allocation.businessDate) {
      laneAttemptCounts[marker.strategyKey] += 1
    }
  }
  const attemptCount = normalized.metrics.attemptMarkers.length
  return {
    valid: true,
    reason: null,
    windowHours: 24,
    globalAttemptCap: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
    attemptCount,
    remaining: Math.max(0, OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - attemptCount),
    businessDate: allocation.businessDate,
    laneAttemptCounts,
    laneCaps: allocation.laneCaps,
  }
}

/**
 * Reserves one provider attempt against the global and recipient-domain
 * rolling windows. The caller persists the returned metrics with a database
 * compare-and-swap, making both limits one atomic decision.
 */
export function reserveOutlookColdBudget(input: {
  metrics: unknown
  idempotencyKeyHash: string
  recipientDomainHash: string
  invocationIdHash: string
  strategyKey: DailyStrategyOutputLaneKey | string
  reservationId: string
  now?: Date
}): OutlookColdBudgetDecision {
  const now = input.now || new Date()
  if (!Number.isFinite(now.getTime())) return invalid('outlook_cold_budget_clock_invalid')

  const idempotencyKeyHash = String(input.idempotencyKeyHash || '').trim().toLowerCase()
  const recipientDomainHash = String(input.recipientDomainHash || '').trim().toLowerCase()
  const invocationIdHash = String(input.invocationIdHash || '').trim().toLowerCase()
  const strategyKey = String(input.strategyKey || '').trim() as DailyStrategyOutputLaneKey
  const reservationId = String(input.reservationId || '').trim()
  if (
    !HASH_PATTERN.test(idempotencyKeyHash) ||
    !HASH_PATTERN.test(recipientDomainHash) ||
    !HASH_PATTERN.test(invocationIdHash) ||
    !OUTLOOK_COLD_B2B_LANE_SET.has(strategyKey) ||
    !reservationId ||
    reservationId.length > 200
  ) {
    return invalid('outlook_cold_budget_identity_invalid')
  }

  const normalized = normalizeOutlookColdBudget(input.metrics, now)
  if (!normalized.valid) return invalid(normalized.reason)

  const markers = normalized.metrics.attemptMarkers
  const allocation = allocateOutlookColdLaneCaps(now)
  const laneDailyCap = allocation.laneCaps[strategyKey]
  const prior = markers.find((marker) => marker.idempotencyKeyHash === idempotencyKeyHash)
  const domainAttemptCount = markers.filter(
    (marker) => marker.recipientDomainHash === recipientDomainHash
  ).length
  const invocationAttemptCount = markers.filter(
    (marker) => marker.invocationIdHash === invocationIdHash
  ).length
  const laneAttemptCount = markers.filter(
    (marker) =>
      marker.strategyKey === strategyKey &&
      marker.businessDate === allocation.businessDate
  ).length
  if (prior) {
    if (
      prior.recipientDomainHash !== recipientDomainHash ||
      prior.strategyKey !== strategyKey
    ) {
      return {
        ...invalid('outlook_cold_budget_idempotency_conflict'),
        attemptCount: markers.length,
        domainAttemptCount,
        invocationAttemptCount,
        laneAttemptCount,
        laneDailyCap,
      }
    }
    return {
      allowed: true,
      duplicate: true,
      reason: null,
      attemptCount: markers.length,
      domainAttemptCount,
      invocationAttemptCount,
      laneAttemptCount,
      laneDailyCap,
      remaining: Math.max(0, OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - markers.length),
      domainRemaining: Math.max(0, OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP - domainAttemptCount),
      metrics: normalized.metrics,
    }
  }

  if (markers.length >= OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP) {
    return {
      allowed: false,
      duplicate: false,
      reason: 'outlook_cold_global_daily_cap_exhausted',
      attemptCount: markers.length,
      domainAttemptCount,
      invocationAttemptCount,
      laneAttemptCount,
      laneDailyCap,
      remaining: 0,
      domainRemaining: Math.max(0, OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP - domainAttemptCount),
      metrics: normalized.metrics,
    }
  }
  if (laneAttemptCount >= laneDailyCap) {
    return {
      allowed: false,
      duplicate: false,
      reason: 'outlook_cold_lane_daily_cap_exhausted',
      attemptCount: markers.length,
      domainAttemptCount,
      invocationAttemptCount,
      laneAttemptCount,
      laneDailyCap,
      remaining: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - markers.length,
      domainRemaining: Math.max(0, OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP - domainAttemptCount),
      metrics: normalized.metrics,
    }
  }
  if (domainAttemptCount >= OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP) {
    return {
      allowed: false,
      duplicate: false,
      reason: 'outlook_cold_domain_daily_cap_exhausted',
      attemptCount: markers.length,
      domainAttemptCount,
      invocationAttemptCount,
      laneAttemptCount,
      laneDailyCap,
      remaining: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - markers.length,
      domainRemaining: 0,
      metrics: normalized.metrics,
    }
  }
  if (invocationAttemptCount >= OUTLOOK_COLD_B2B_INVOCATION_CAP) {
    return {
      allowed: false,
      duplicate: false,
      reason: 'outlook_cold_invocation_cap_exhausted',
      attemptCount: markers.length,
      domainAttemptCount,
      invocationAttemptCount,
      laneAttemptCount,
      laneDailyCap,
      remaining: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - markers.length,
      domainRemaining: Math.max(0, OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP - domainAttemptCount),
      metrics: normalized.metrics,
    }
  }

  const nextMarkers = [
    ...markers,
    {
      reservationId,
      idempotencyKeyHash,
      recipientDomainHash,
      invocationIdHash,
      strategyKey,
      businessDate: allocation.businessDate,
      attemptedAt: now.toISOString(),
    },
  ]
  return {
    allowed: true,
    duplicate: false,
    reason: null,
    attemptCount: nextMarkers.length,
    domainAttemptCount: domainAttemptCount + 1,
    invocationAttemptCount: invocationAttemptCount + 1,
    laneAttemptCount: laneAttemptCount + 1,
    laneDailyCap,
    remaining: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP - nextMarkers.length,
    domainRemaining: OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP - domainAttemptCount - 1,
    metrics: {
      schemaVersion: 1,
      windowHours: 24,
      attemptMarkers: nextMarkers,
    },
  }
}
