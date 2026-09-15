export const LENDER_HUNTER_BUDGET_TIME_ZONE = 'America/Chicago'
export const LENDER_HUNTER_BUDGET_HARD_LIMIT = 25

export type LenderHunterBudgetMarker = {
  reservationId: string
  claimId: string
  lenderId: string
  reservedAt: string
}

export type LenderHunterBudgetMetrics = {
  budgetDate?: string | null
  attemptCount?: number | null
  attemptMarkers?: Array<Record<string, unknown>> | null
  budgetRevision?: string | null
}

export type LenderHunterBudgetDecision = {
  allowed: boolean
  reason: string | null
  attemptCount: number
  remaining: number
  metrics: {
    budgetDate: string
    attemptCount: number
    attemptMarkers: LenderHunterBudgetMarker[]
    budgetRevision?: string | null
  }
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value || ''
}

export function lenderHunterBudgetDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LENDER_HUNTER_BUDGET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`
}

function isBudgetMarker(value: Record<string, unknown>): value is LenderHunterBudgetMarker {
  return (
    typeof value.reservationId === 'string' &&
    Boolean(value.reservationId) &&
    typeof value.claimId === 'string' &&
    Boolean(value.claimId) &&
    typeof value.lenderId === 'string' &&
    Boolean(value.lenderId) &&
    typeof value.reservedAt === 'string' &&
    Number.isFinite(Date.parse(value.reservedAt))
  )
}

export function normalizeLenderHunterBudget(
  metrics: LenderHunterBudgetMetrics | null | undefined,
  now = new Date()
) {
  const currentDate = lenderHunterBudgetDateKey(now)
  const storedDate = typeof metrics?.budgetDate === 'string' ? metrics.budgetDate : null

  if (!storedDate || !/^\d{4}-\d{2}-\d{2}$/.test(storedDate)) {
    return {
      valid: false,
      reason: 'budget_date_is_missing_or_invalid',
      budgetDate: currentDate,
      attemptCount: 0,
      attemptMarkers: [] as LenderHunterBudgetMarker[],
    }
  }

  if (storedDate > currentDate) {
    return {
      valid: false,
      reason: 'budget_date_is_in_the_future',
      budgetDate: storedDate,
      attemptCount: Number.isInteger(metrics?.attemptCount) ? Number(metrics?.attemptCount) : 0,
      attemptMarkers: [] as LenderHunterBudgetMarker[],
    }
  }

  if (storedDate < currentDate) {
    return {
      valid: true,
      reason: null,
      budgetDate: currentDate,
      attemptCount: 0,
      attemptMarkers: [] as LenderHunterBudgetMarker[],
    }
  }

  const count = metrics?.attemptCount
  const rawMarkers = Array.isArray(metrics?.attemptMarkers) ? metrics.attemptMarkers : []
  const markers = rawMarkers.filter(isBudgetMarker)
  if (!Number.isInteger(count) || Number(count) < 0 || markers.length !== rawMarkers.length) {
    return {
      valid: false,
      reason: 'budget_state_is_invalid',
      budgetDate: currentDate,
      attemptCount: Number.isInteger(count) && Number(count) >= 0 ? Number(count) : 0,
      attemptMarkers: markers,
    }
  }

  if (markers.length > Number(count)) {
    return {
      valid: false,
      reason: 'budget_marker_count_exceeds_attempt_count',
      budgetDate: currentDate,
      attemptCount: Number(count),
      attemptMarkers: markers,
    }
  }

  return {
    valid: true,
    reason: null,
    budgetDate: currentDate,
    attemptCount: Number(count),
    attemptMarkers: markers,
  }
}

export function reserveLenderHunterBudget(input: {
  metrics: LenderHunterBudgetMetrics | null | undefined
  lenderId: string
  claimId: string
  reservationId: string
  dailyLimit: number
  now?: Date
}): LenderHunterBudgetDecision {
  const now = input.now || new Date()
  const dailyLimit = Number.isFinite(input.dailyLimit)
    ? Math.min(LENDER_HUNTER_BUDGET_HARD_LIMIT, Math.max(1, Math.floor(input.dailyLimit)))
    : 1
  const normalized = normalizeLenderHunterBudget(input.metrics, now)
  const baseMetrics = {
    budgetDate: normalized.budgetDate,
    attemptCount: normalized.attemptCount,
    attemptMarkers: normalized.attemptMarkers,
    budgetRevision: input.metrics?.budgetRevision || null,
  }

  if (!normalized.valid) {
    return {
      allowed: false,
      reason: normalized.reason,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (normalized.attemptMarkers.some((marker) => marker.claimId === input.claimId)) {
    return {
      allowed: false,
      reason: 'lender_hunter_claim_already_reserved',
      attemptCount: normalized.attemptCount,
      remaining: Math.max(0, dailyLimit - normalized.attemptCount),
      metrics: baseMetrics,
    }
  }

  if (normalized.attemptCount >= dailyLimit) {
    return {
      allowed: false,
      reason: 'lender_hunter_daily_budget_exhausted',
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  const attemptCount = normalized.attemptCount + 1
  return {
    allowed: true,
    reason: null,
    attemptCount,
    remaining: Math.max(0, dailyLimit - attemptCount),
    metrics: {
      ...baseMetrics,
      attemptCount,
      attemptMarkers: [
        ...normalized.attemptMarkers,
        {
          reservationId: input.reservationId,
          claimId: input.claimId,
          lenderId: input.lenderId,
          reservedAt: now.toISOString(),
        },
      ].slice(-LENDER_HUNTER_BUDGET_HARD_LIMIT),
    },
  }
}

export function nextLenderHunterCasTimestamp(currentUpdatedAt: string, now = new Date()) {
  const currentMs = Date.parse(currentUpdatedAt)
  const nextMs = Number.isFinite(currentMs)
    ? Math.max(now.getTime(), currentMs + 1)
    : now.getTime()
  return new Date(nextMs).toISOString()
}
