export const LEAD_HUNTER_BUDGET_TIME_ZONE = 'America/Chicago'

export type LeadHunterBudgetMarker = {
  reservationId: string
  claimHash: string
  emailHash: string
  reservedAt: string
}

export type LeadHunterBudgetMetrics = {
  budgetDate?: string | null
  attemptCount?: number | null
  attemptMarkers?: Array<Record<string, unknown>> | null
  budgetRevision?: string | null
}

type NormalizedLeadHunterBudget = {
  valid: boolean
  reason: string | null
  budgetDate: string
  attemptCount: number
  attemptMarkers: LeadHunterBudgetMarker[]
}

export type LeadHunterBudgetDecision = {
  allowed: boolean
  reason: string | null
  attemptCount: number
  remaining: number
  metrics: {
    budgetDate: string
    attemptCount: number
    attemptMarkers: LeadHunterBudgetMarker[]
    budgetRevision?: string | null
  }
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value || ''
}

export function leadHunterBudgetDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAD_HUNTER_BUDGET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`
}

function isMarker(value: Record<string, unknown>): value is LeadHunterBudgetMarker {
  return (
    typeof value.reservationId === 'string' &&
    Boolean(value.reservationId) &&
    typeof value.claimHash === 'string' &&
    /^[a-f0-9]{64}$/.test(value.claimHash) &&
    typeof value.emailHash === 'string' &&
    /^[a-f0-9]{64}$/.test(value.emailHash) &&
    typeof value.reservedAt === 'string' &&
    Number.isFinite(Date.parse(value.reservedAt))
  )
}

function normalizeLeadHunterBudget(
  metrics: LeadHunterBudgetMetrics | null | undefined,
  dailyHardLimit: number,
  now: Date
): NormalizedLeadHunterBudget {
  const currentDate = leadHunterBudgetDateKey(now)
  const storedDate = typeof metrics?.budgetDate === 'string' ? metrics.budgetDate : null
  if (!storedDate || !/^\d{4}-\d{2}-\d{2}$/.test(storedDate)) {
    return {
      valid: false,
      reason: 'lead_hunter_budget_date_invalid',
      budgetDate: currentDate,
      attemptCount: 0,
      attemptMarkers: [],
    }
  }
  if (storedDate > currentDate) {
    return {
      valid: false,
      reason: 'lead_hunter_budget_date_future',
      budgetDate: storedDate,
      attemptCount: Math.max(0, Math.floor(Number(metrics?.attemptCount || 0))),
      attemptMarkers: [],
    }
  }
  if (storedDate < currentDate) {
    return {
      valid: true,
      reason: null,
      budgetDate: currentDate,
      attemptCount: 0,
      attemptMarkers: [],
    }
  }

  const rawMarkers = Array.isArray(metrics?.attemptMarkers) ? metrics.attemptMarkers : []
  const markers = rawMarkers.filter(isMarker)
  const attemptCount = Number(metrics?.attemptCount)
  if (
    !Number.isInteger(attemptCount) ||
    attemptCount < 0 ||
    attemptCount > dailyHardLimit ||
    markers.length !== rawMarkers.length ||
    markers.length !== attemptCount ||
    markers.some((marker) => leadHunterBudgetDateKey(new Date(marker.reservedAt)) !== storedDate)
  ) {
    return {
      valid: false,
      reason: 'lead_hunter_budget_state_invalid',
      budgetDate: currentDate,
      attemptCount: Number.isInteger(attemptCount) && attemptCount >= 0 ? attemptCount : 0,
      attemptMarkers: markers,
    }
  }
  return { valid: true, reason: null, budgetDate: currentDate, attemptCount, attemptMarkers: markers }
}

export function reserveLeadHunterBudget(input: {
  metrics: LeadHunterBudgetMetrics | null | undefined
  claimHash: string
  emailHash: string
  reservationId: string
  dailyLimit: number
  dailyHardLimit: number
  now?: Date
}): LeadHunterBudgetDecision {
  const now = input.now || new Date()
  const dailyHardLimit = Math.max(1, Math.floor(input.dailyHardLimit))
  const dailyLimit = Math.min(dailyHardLimit, Math.max(0, Math.floor(input.dailyLimit)))
  const normalized = normalizeLeadHunterBudget(input.metrics, dailyHardLimit, now)
  const baseMetrics = {
    budgetDate: normalized.budgetDate,
    attemptCount: normalized.attemptCount,
    attemptMarkers: normalized.attemptMarkers,
    budgetRevision: input.metrics?.budgetRevision || null,
  }
  if (!normalized.valid) {
    return { allowed: false, reason: normalized.reason, attemptCount: normalized.attemptCount, remaining: 0, metrics: baseMetrics }
  }
  if (normalized.attemptMarkers.some((marker) => marker.claimHash === input.claimHash)) {
    return {
      allowed: false,
      reason: 'lead_hunter_claim_already_reserved',
      attemptCount: normalized.attemptCount,
      remaining: Math.max(0, dailyLimit - normalized.attemptCount),
      metrics: baseMetrics,
    }
  }
  if (normalized.attemptMarkers.some((marker) => marker.emailHash === input.emailHash)) {
    return {
      allowed: false,
      reason: 'lead_hunter_email_already_reserved',
      attemptCount: normalized.attemptCount,
      remaining: Math.max(0, dailyLimit - normalized.attemptCount),
      metrics: baseMetrics,
    }
  }
  if (dailyLimit < 1 || normalized.attemptCount >= dailyLimit) {
    return {
      allowed: false,
      reason: 'lead_hunter_daily_budget_exhausted',
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
          claimHash: input.claimHash,
          emailHash: input.emailHash,
          reservedAt: now.toISOString(),
        },
      ],
    },
  }
}

export function nextLeadHunterBudgetCasTimestamp(currentUpdatedAt: string, now = new Date()) {
  const currentMs = Date.parse(currentUpdatedAt)
  return new Date(Number.isFinite(currentMs) ? Math.max(now.getTime(), currentMs + 1) : now.getTime()).toISOString()
}
