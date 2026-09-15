export const PAID_SOURCE_BUDGET_TIME_ZONE = 'America/Chicago'

export const OUTSCRAPER_MAX_NICHES_PER_REQUEST = 6
export const OUTSCRAPER_MAX_RESULTS_PER_NICHE = 10
export const OUTSCRAPER_MAX_WORK_UNITS_PER_REQUEST = 24
export const APIFY_YELP_MAX_NICHES_PER_RUN = 4
export const APIFY_YELP_MAX_RESULTS_PER_NICHE = 5
export const APIFY_YELP_MAX_WORK_UNITS_PER_RUN = 21
export const APIFY_YELP_MAX_MEMORY_MBYTES = 1024
export const APIFY_YELP_MAX_TIMEOUT_SECS = 120
export const APIFY_YELP_MAX_WAIT_MS = 120_000
export const APIFY_YELP_MAX_CONCURRENCY = 3

export type PaidSourceProvider = 'google_places' | 'outscraper' | 'apify'

export type PaidSourceBudgetMarker = {
  reservationId: string
  attemptKey: string
  units: number
  reservedAt: string
}

export type PaidSourceBudgetMetrics = {
  budgetDate?: string | null
  attemptCount?: number | null
  attemptMarkers?: Array<Record<string, unknown>> | null
  budgetRevision?: string | null
}

export type NormalizedPaidSourceBudget = {
  valid: boolean
  reason: string | null
  budgetDate: string
  attemptCount: number
  attemptMarkers: PaidSourceBudgetMarker[]
}

export type PaidSourceBudgetDecision = {
  allowed: boolean
  reason: string | null
  dailyLimit: number
  requestedUnits: number
  reservedUnits: number
  attemptCount: number
  remaining: number
  metrics: {
    budgetDate: string
    attemptCount: number
    attemptMarkers: PaidSourceBudgetMarker[]
    budgetRevision?: string | null
  }
}

type EnvShape = Record<string, string | undefined>

type BoundedPaidSourceBatch = {
  niches: string[]
  limitPerNiche: number
  resultUnits: number
}

export type OutscraperPaidWorkPlan = BoundedPaidSourceBatch & {
  estimatedBillableUnits: number
}

export type ApifyYelpPaidWorkPlan = BoundedPaidSourceBatch & {
  estimatedBillableUnits: number
  memoryMbytes: 256 | 512 | 1024
  timeoutSecs: number
  maxWaitMs: number
  maxConcurrency: number
  proxyCountry: string
}

const PROVIDER_LIMITS: Record<
  PaidSourceProvider,
  { defaultDailyLimit: number; hardDailyLimit: number; envName: string }
> = {
  google_places: {
    defaultDailyLimit: 3,
    hardDailyLimit: 24,
    envName: 'SOURCE_LIMIT_GOOGLE_PLACES_DAILY',
  },
  outscraper: {
    defaultDailyLimit: 4,
    hardDailyLimit: 24,
    envName: 'SOURCE_LIMIT_OUTSCRAPER_DAILY',
  },
  apify: {
    defaultDailyLimit: 4,
    hardDailyLimit: 24,
    envName: 'SOURCE_LIMIT_APIFY_DAILY',
  },
}

function boundedInteger(value: number | null | undefined, fallback: number, minimum: number, maximum: number) {
  const normalized = Number.isFinite(value) ? Math.floor(Number(value)) : fallback
  return Math.min(maximum, Math.max(minimum, normalized))
}

function normalizedPaidSourceNiches(values: string[], maximum: number) {
  const seen = new Set<string>()
  const niches: string[] = []
  for (const value of values) {
    const niche = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const key = niche.toLowerCase()
    if (!niche || seen.has(key)) continue
    seen.add(key)
    niches.push(niche)
    if (niches.length >= maximum) break
  }
  return niches
}

function fitPaidSourceBatch(input: {
  niches: string[]
  limitPerNiche: number
  unitBudget: number
}): BoundedPaidSourceBatch {
  let bestNicheCount = 0
  let bestLimitPerNiche = 0
  let bestResultUnits = 0

  for (let nicheCount = 1; nicheCount <= input.niches.length; nicheCount += 1) {
    const limitPerNiche = Math.min(
      input.limitPerNiche,
      Math.floor(input.unitBudget / nicheCount)
    )
    if (limitPerNiche < 1) continue
    const resultUnits = nicheCount * limitPerNiche
    if (
      resultUnits > bestResultUnits ||
      (resultUnits === bestResultUnits && nicheCount > bestNicheCount)
    ) {
      bestNicheCount = nicheCount
      bestLimitPerNiche = limitPerNiche
      bestResultUnits = resultUnits
    }
  }

  return {
    niches: input.niches.slice(0, bestNicheCount),
    limitPerNiche: bestLimitPerNiche,
    resultUnits: bestResultUnits,
  }
}

export function buildOutscraperPaidWorkPlan(input: {
  niches: string[]
  limitPerNiche: number
  unitBudget?: number
}): OutscraperPaidWorkPlan {
  const niches = normalizedPaidSourceNiches(input.niches, OUTSCRAPER_MAX_NICHES_PER_REQUEST)
  const limitPerNiche = boundedInteger(
    input.limitPerNiche,
    3,
    1,
    OUTSCRAPER_MAX_RESULTS_PER_NICHE
  )
  const unitBudget = boundedInteger(
    input.unitBudget,
    OUTSCRAPER_MAX_WORK_UNITS_PER_REQUEST,
    0,
    OUTSCRAPER_MAX_WORK_UNITS_PER_REQUEST
  )
  const batch = fitPaidSourceBatch({ niches, limitPerNiche, unitBudget })
  return {
    ...batch,
    estimatedBillableUnits: batch.resultUnits,
  }
}

function normalizedApifyMemory(value: number | null | undefined): 256 | 512 | 1024 {
  const memory = boundedInteger(value, 1024, 256, APIFY_YELP_MAX_MEMORY_MBYTES)
  if (memory >= 1024) return 1024
  if (memory >= 512) return 512
  return 256
}

export function buildApifyYelpPaidWorkPlan(input: {
  niches: string[]
  limitPerNiche: number
  unitBudget?: number
  memoryMbytes?: number
  timeoutSecs?: number
  maxWaitMs?: number
  maxConcurrency?: number
  proxyCountry?: string
}): ApifyYelpPaidWorkPlan {
  const niches = normalizedPaidSourceNiches(input.niches, APIFY_YELP_MAX_NICHES_PER_RUN)
  const limitPerNiche = boundedInteger(
    input.limitPerNiche,
    3,
    1,
    APIFY_YELP_MAX_RESULTS_PER_NICHE
  )
  const unitBudget = boundedInteger(
    input.unitBudget,
    APIFY_YELP_MAX_WORK_UNITS_PER_RUN,
    0,
    APIFY_YELP_MAX_WORK_UNITS_PER_RUN
  )
  const resultBudget = Math.max(0, unitBudget - 1)
  const batch = fitPaidSourceBatch({ niches, limitPerNiche, unitBudget: resultBudget })
  const proxyCountry = String(input.proxyCountry || 'US').trim().toUpperCase()

  return {
    ...batch,
    estimatedBillableUnits: batch.resultUnits > 0 ? batch.resultUnits + 1 : 0,
    memoryMbytes: normalizedApifyMemory(input.memoryMbytes),
    timeoutSecs: boundedInteger(input.timeoutSecs, 120, 30, APIFY_YELP_MAX_TIMEOUT_SECS),
    maxWaitMs: boundedInteger(input.maxWaitMs, 120_000, 15_000, APIFY_YELP_MAX_WAIT_MS),
    maxConcurrency: boundedInteger(
      input.maxConcurrency,
      3,
      1,
      APIFY_YELP_MAX_CONCURRENCY
    ),
    proxyCountry: /^[A-Z]{2}$/.test(proxyCountry) ? proxyCountry : 'US',
  }
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value || ''
}

export function paidSourceBudgetDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PAID_SOURCE_BUDGET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`
}

export function getPaidSourceDailyLimit(
  provider: PaidSourceProvider,
  env: EnvShape = process.env
) {
  const config = PROVIDER_LIMITS[provider]
  const raw = env[config.envName]
  if (raw === undefined || raw.trim() === '') return config.defaultDailyLimit

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0

  return Math.min(config.hardDailyLimit, Math.max(0, Math.floor(parsed)))
}

export function getPaidSourceHardDailyLimit(provider: PaidSourceProvider) {
  return PROVIDER_LIMITS[provider].hardDailyLimit
}

function isBudgetMarker(value: Record<string, unknown>): value is PaidSourceBudgetMarker {
  return (
    typeof value.reservationId === 'string' &&
    Boolean(value.reservationId) &&
    typeof value.attemptKey === 'string' &&
    Boolean(value.attemptKey) &&
    value.attemptKey.length <= 240 &&
    Number.isInteger(value.units) &&
    Number(value.units) > 0 &&
    typeof value.reservedAt === 'string' &&
    Number.isFinite(Date.parse(value.reservedAt))
  )
}

export function normalizePaidSourceBudget(
  provider: PaidSourceProvider,
  metrics: PaidSourceBudgetMetrics | null | undefined,
  now = new Date()
): NormalizedPaidSourceBudget {
  const currentDate = paidSourceBudgetDateKey(now)
  const storedDate = typeof metrics?.budgetDate === 'string' ? metrics.budgetDate : null

  if (!storedDate || !/^\d{4}-\d{2}-\d{2}$/.test(storedDate)) {
    return {
      valid: false,
      reason: 'paid_source_budget_date_is_missing_or_invalid',
      budgetDate: currentDate,
      attemptCount: 0,
      attemptMarkers: [],
    }
  }

  if (storedDate > currentDate) {
    return {
      valid: false,
      reason: 'paid_source_budget_date_is_in_the_future',
      budgetDate: storedDate,
      attemptCount: Number.isInteger(metrics?.attemptCount) ? Number(metrics?.attemptCount) : 0,
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

  const count = metrics?.attemptCount
  const rawMarkers = Array.isArray(metrics?.attemptMarkers) ? metrics.attemptMarkers : []
  const markers = rawMarkers.filter(isBudgetMarker)
  const hardLimit = getPaidSourceHardDailyLimit(provider)
  if (
    !Number.isInteger(count) ||
    Number(count) < 0 ||
    Number(count) > hardLimit ||
    rawMarkers.length !== markers.length ||
    markers.reduce((sum, marker) => sum + marker.units, 0) !== Number(count)
  ) {
    return {
      valid: false,
      reason: 'paid_source_budget_state_is_invalid',
      budgetDate: currentDate,
      attemptCount: Number.isInteger(count) && Number(count) >= 0 ? Number(count) : 0,
      attemptMarkers: markers,
    }
  }

  if (
    new Set(markers.map((marker) => marker.attemptKey)).size !== markers.length ||
    markers.some((marker) => paidSourceBudgetDateKey(new Date(marker.reservedAt)) !== storedDate)
  ) {
    return {
      valid: false,
      reason: 'paid_source_budget_markers_are_invalid',
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

export function reservePaidSourceBudget(input: {
  provider: PaidSourceProvider
  metrics: PaidSourceBudgetMetrics | null | undefined
  attemptKey: string
  reservationId: string
  dailyLimit: number
  units?: number
  minimumUnits?: number
  now?: Date
}): PaidSourceBudgetDecision {
  const now = input.now || new Date()
  const hardLimit = getPaidSourceHardDailyLimit(input.provider)
  const dailyLimit = Number.isFinite(input.dailyLimit)
    ? Math.min(hardLimit, Math.max(0, Math.floor(input.dailyLimit)))
    : 0
  const attemptKey = input.attemptKey.trim().slice(0, 240)
  const configuredUnits = input.units ?? 1
  const requestedUnits = Number.isFinite(configuredUnits)
    ? Math.min(hardLimit, Math.max(0, Math.floor(configuredUnits)))
    : 0
  const configuredMinimumUnits = input.minimumUnits ?? 1
  const minimumUnits = Number.isFinite(configuredMinimumUnits)
    ? Math.min(hardLimit, Math.max(1, Math.floor(configuredMinimumUnits)))
    : hardLimit
  const normalized = normalizePaidSourceBudget(input.provider, input.metrics, now)
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
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (!attemptKey) {
    return {
      allowed: false,
      reason: 'paid_source_attempt_key_is_missing',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (normalized.attemptMarkers.some((marker) => marker.attemptKey === attemptKey)) {
    return {
      allowed: false,
      reason: 'paid_source_attempt_already_reserved',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: Math.max(0, dailyLimit - normalized.attemptCount),
      metrics: baseMetrics,
    }
  }

  if (requestedUnits === 0) {
    return {
      allowed: false,
      reason: 'paid_source_requested_units_are_invalid',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (dailyLimit === 0) {
    return {
      allowed: false,
      reason: 'paid_source_daily_budget_disabled',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (normalized.attemptCount >= dailyLimit) {
    return {
      allowed: false,
      reason: 'paid_source_daily_budget_exhausted',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  const availableUnits = dailyLimit - normalized.attemptCount
  if (availableUnits < Math.min(requestedUnits, minimumUnits)) {
    return {
      allowed: false,
      reason: 'paid_source_remaining_budget_below_minimum',
      dailyLimit,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: normalized.attemptCount,
      remaining: Math.max(0, availableUnits),
      metrics: baseMetrics,
    }
  }

  const reservedUnits = Math.min(requestedUnits, availableUnits)
  const attemptCount = normalized.attemptCount + reservedUnits
  return {
    allowed: true,
    reason: null,
    dailyLimit,
    requestedUnits,
    reservedUnits,
    attemptCount,
    remaining: Math.max(0, dailyLimit - attemptCount),
    metrics: {
      ...baseMetrics,
      attemptCount,
      attemptMarkers: [
        ...normalized.attemptMarkers,
        {
          reservationId: input.reservationId,
          attemptKey,
          units: reservedUnits,
          reservedAt: now.toISOString(),
        },
      ],
    },
  }
}

export function nextPaidSourceBudgetCasTimestamp(currentUpdatedAt: string, now = new Date()) {
  const currentMs = Date.parse(currentUpdatedAt)
  const nextMs = Number.isFinite(currentMs)
    ? Math.max(now.getTime(), currentMs + 1)
    : now.getTime()
  return new Date(nextMs).toISOString()
}
