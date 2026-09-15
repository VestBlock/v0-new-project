export const AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000

export type AutomaticEmailLane = 'buyer' | 'investor' | 'lender'

export type AutomaticEmailAttemptMarker = {
  reservationId: string
  claimId: string
  messageId: string
  reservedAt: string
  source: 'reservation' | 'sent_at'
}

export type AutomaticEmailAttemptQuotaMetrics = {
  windowStartedAt?: string | null
  attemptCount?: number | null
  attemptMarkers?: Array<Record<string, unknown>> | null
  quotaRevision?: string | null
}

export type ObservedSentEmailAttempt = {
  messageId: string
  sentAt: string
}

export type NormalizedAutomaticEmailAttemptQuota = {
  valid: boolean
  reason: string | null
  windowStartedAt: string
  attemptCount: number
  attemptMarkers: AutomaticEmailAttemptMarker[]
  legacyAttemptCount: number
  quotaRevision: string | null
}

export type AutomaticEmailAttemptQuotaDecision = {
  allowed: boolean
  reason: string | null
  attemptCount: number
  remaining: number
  metrics: {
    windowStartedAt: string
    attemptCount: number
    attemptMarkers: AutomaticEmailAttemptMarker[]
    quotaRevision: string | null
  }
}

function isAttemptMarker(value: Record<string, unknown>): value is AutomaticEmailAttemptMarker {
  return (
    typeof value.reservationId === 'string' &&
    Boolean(value.reservationId) &&
    typeof value.claimId === 'string' &&
    Boolean(value.claimId) &&
    typeof value.messageId === 'string' &&
    Boolean(value.messageId) &&
    typeof value.reservedAt === 'string' &&
    Number.isFinite(Date.parse(value.reservedAt)) &&
    (value.source === 'reservation' || value.source === 'sent_at')
  )
}

function oldestAttemptAt(markers: AutomaticEmailAttemptMarker[], fallback: Date) {
  const oldest = markers.reduce<number | null>((value, marker) => {
    const reservedAt = Date.parse(marker.reservedAt)
    return value === null || reservedAt < value ? reservedAt : value
  }, null)
  return oldest === null ? fallback.toISOString() : new Date(oldest).toISOString()
}

export function normalizeAutomaticEmailAttemptQuota(
  metrics: AutomaticEmailAttemptQuotaMetrics | null | undefined,
  now = new Date(),
  windowMs = AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS
): NormalizedAutomaticEmailAttemptQuota {
  const rawCount = metrics?.attemptCount ?? 0
  const rawMarkers = Array.isArray(metrics?.attemptMarkers) ? metrics.attemptMarkers : []
  const markers = rawMarkers.filter(isAttemptMarker)
  const countIsValid = Number.isInteger(rawCount) && Number(rawCount) >= 0
  const markerStateIsValid = markers.length === rawMarkers.length
  const claimsAreUnique = new Set(markers.map((marker) => marker.claimId)).size === markers.length
  const reservationsAreUnique = new Set(markers.map((marker) => marker.reservationId)).size === markers.length

  if (!countIsValid || !markerStateIsValid || !claimsAreUnique || !reservationsAreUnique || markers.length > Number(rawCount)) {
    return {
      valid: false,
      reason: 'automatic_email_attempt_quota_state_invalid',
      windowStartedAt: now.toISOString(),
      attemptCount: Number.isInteger(rawCount) && Number(rawCount) >= 0 ? Number(rawCount) : 0,
      attemptMarkers: [],
      legacyAttemptCount: 0,
      quotaRevision: typeof metrics?.quotaRevision === 'string' ? metrics.quotaRevision : null,
    }
  }

  const nowMs = now.getTime()
  if (markers.some((marker) => Date.parse(marker.reservedAt) > nowMs)) {
    return {
      valid: false,
      reason: 'automatic_email_attempt_quota_timestamp_in_future',
      windowStartedAt: now.toISOString(),
      attemptCount: Number(rawCount),
      attemptMarkers: [],
      legacyAttemptCount: 0,
      quotaRevision: typeof metrics?.quotaRevision === 'string' ? metrics.quotaRevision : null,
    }
  }

  const aggregateCount = Number(rawCount)
  const rawLegacyCount = Math.max(0, aggregateCount - markers.length)
  const storedWindowStartedAt = metrics?.windowStartedAt ? Date.parse(metrics.windowStartedAt) : Number.NaN
  if (
    rawLegacyCount > 0 &&
    (!Number.isFinite(storedWindowStartedAt) || storedWindowStartedAt > nowMs)
  ) {
    return {
      valid: false,
      reason: 'automatic_email_attempt_quota_legacy_window_invalid',
      windowStartedAt: now.toISOString(),
      attemptCount: aggregateCount,
      attemptMarkers: [],
      legacyAttemptCount: rawLegacyCount,
      quotaRevision: typeof metrics?.quotaRevision === 'string' ? metrics.quotaRevision : null,
    }
  }

  const activeMarkers = markers.filter((marker) => nowMs - Date.parse(marker.reservedAt) < windowMs)
  const legacyWindowActive =
    rawLegacyCount > 0 &&
    Number.isFinite(storedWindowStartedAt) &&
    nowMs - storedWindowStartedAt < windowMs
  const legacyAttemptCount = legacyWindowActive ? rawLegacyCount : 0
  const windowStartedAt = legacyAttemptCount > 0
    ? String(metrics?.windowStartedAt)
    : oldestAttemptAt(activeMarkers, now)

  return {
    valid: true,
    reason: null,
    windowStartedAt,
    attemptCount: legacyAttemptCount + activeMarkers.length,
    attemptMarkers: activeMarkers,
    legacyAttemptCount,
    quotaRevision: typeof metrics?.quotaRevision === 'string' ? metrics.quotaRevision : null,
  }
}

function normalizeObservedSentAttempts(input: {
  observedSentCount: number
  observedSentAttempts: ObservedSentEmailAttempt[]
  now: Date
  windowMs: number
}) {
  const observedSentCount = Number.isInteger(input.observedSentCount) && input.observedSentCount >= 0
    ? input.observedSentCount
    : -1
  const unique = new Map<string, ObservedSentEmailAttempt>()
  const nowMs = input.now.getTime()

  for (const attempt of input.observedSentAttempts) {
    const sentAt = Date.parse(attempt.sentAt)
    if (!attempt.messageId || !Number.isFinite(sentAt) || sentAt > nowMs) {
      return { valid: false as const, observedSentCount, attempts: [] }
    }
    if (nowMs - sentAt >= input.windowMs) continue
    const existing = unique.get(attempt.messageId)
    if (!existing || sentAt < Date.parse(existing.sentAt)) unique.set(attempt.messageId, attempt)
  }

  if (observedSentCount < 0 || unique.size > observedSentCount) {
    return { valid: false as const, observedSentCount, attempts: [] }
  }
  return { valid: true as const, observedSentCount, attempts: [...unique.values()] }
}

export function reconcileAutomaticEmailAttemptQuota(input: {
  metrics: AutomaticEmailAttemptQuotaMetrics | null | undefined
  observedSentCount: number
  observedSentAttempts: ObservedSentEmailAttempt[]
  now?: Date
  windowMs?: number
}) {
  const now = input.now || new Date()
  const windowMs = input.windowMs || AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS
  const normalized = normalizeAutomaticEmailAttemptQuota(input.metrics, now, windowMs)
  if (!normalized.valid) return normalized

  const observed = normalizeObservedSentAttempts({
    observedSentCount: input.observedSentCount,
    observedSentAttempts: input.observedSentAttempts,
    now,
    windowMs,
  })
  if (!observed.valid) {
    return {
      ...normalized,
      valid: false,
      reason: 'automatic_email_observed_sent_state_invalid',
    }
  }

  const attemptMarkers = [...normalized.attemptMarkers]
  for (const attempt of observed.attempts) {
    // A sent row is the eventual outcome of one existing reservation for the
    // same message, not an additional attempt. Multiple distinct reservations
    // for a retried message still count independently.
    if (attemptMarkers.some((marker) => marker.messageId === attempt.messageId)) continue
    attemptMarkers.push({
      reservationId: `observed_sent:${attempt.messageId}`,
      claimId: `observed_sent:${attempt.messageId}`,
      messageId: attempt.messageId,
      reservedAt: attempt.sentAt,
      source: 'sent_at',
    })
  }

  attemptMarkers.sort(
    (left, right) => Date.parse(left.reservedAt) - Date.parse(right.reservedAt)
  )
  const missingObservedMarkers = Math.max(0, observed.observedSentCount - observed.attempts.length)
  const legacyAttemptCount = Math.max(normalized.legacyAttemptCount, missingObservedMarkers)
  const attemptCount = legacyAttemptCount + attemptMarkers.length
  const windowStartedAt = legacyAttemptCount > normalized.legacyAttemptCount
    ? now.toISOString()
    : legacyAttemptCount > 0
      ? normalized.windowStartedAt
      : oldestAttemptAt(attemptMarkers, now)

  return {
    valid: true,
    reason: null,
    windowStartedAt,
    attemptCount,
    attemptMarkers,
    legacyAttemptCount,
    quotaRevision: normalized.quotaRevision,
  }
}

export function seedAutomaticEmailAttemptQuota(input: {
  observedSentCount: number
  observedSentAttempts: ObservedSentEmailAttempt[]
  now?: Date
}) {
  return reconcileAutomaticEmailAttemptQuota({
    metrics: {
      windowStartedAt: (input.now || new Date()).toISOString(),
      attemptCount: 0,
      attemptMarkers: [],
    },
    observedSentCount: input.observedSentCount,
    observedSentAttempts: input.observedSentAttempts,
    now: input.now,
  })
}

export function reserveAutomaticEmailAttemptQuota(input: {
  metrics: AutomaticEmailAttemptQuotaMetrics | null | undefined
  observedSentCount: number
  observedSentAttempts: ObservedSentEmailAttempt[]
  messageId: string
  claimId: string
  reservationId: string
  dailyLimit: number
  now?: Date
}): AutomaticEmailAttemptQuotaDecision {
  const now = input.now || new Date()
  const dailyLimit = Number.isInteger(input.dailyLimit) && input.dailyLimit > 0
    ? input.dailyLimit
    : 0
  const reconciled = reconcileAutomaticEmailAttemptQuota({
    metrics: input.metrics,
    observedSentCount: input.observedSentCount,
    observedSentAttempts: input.observedSentAttempts,
    now,
  })
  const baseMetrics = {
    windowStartedAt: reconciled.windowStartedAt,
    attemptCount: reconciled.attemptCount,
    attemptMarkers: reconciled.attemptMarkers,
    quotaRevision: reconciled.quotaRevision,
  }

  if (!dailyLimit || !reconciled.valid) {
    return {
      allowed: false,
      reason: reconciled.reason || 'automatic_email_attempt_quota_limit_invalid',
      attemptCount: reconciled.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  if (
    reconciled.attemptMarkers.some((marker) => marker.claimId === input.claimId)
  ) {
    return {
      allowed: false,
      reason: 'automatic_email_attempt_already_reserved',
      attemptCount: reconciled.attemptCount,
      remaining: Math.max(0, dailyLimit - reconciled.attemptCount),
      metrics: baseMetrics,
    }
  }

  if (reconciled.attemptCount >= dailyLimit) {
    return {
      allowed: false,
      reason: 'automatic_email_daily_attempt_quota_exhausted',
      attemptCount: reconciled.attemptCount,
      remaining: 0,
      metrics: baseMetrics,
    }
  }

  const attemptMarkers = [
    ...reconciled.attemptMarkers,
    {
      reservationId: input.reservationId,
      claimId: input.claimId,
      messageId: input.messageId,
      reservedAt: now.toISOString(),
      source: 'reservation' as const,
    },
  ]
  const attemptCount = reconciled.legacyAttemptCount + attemptMarkers.length
  return {
    allowed: true,
    reason: null,
    attemptCount,
    remaining: Math.max(0, dailyLimit - attemptCount),
    metrics: {
      windowStartedAt: reconciled.legacyAttemptCount > 0
        ? reconciled.windowStartedAt
        : oldestAttemptAt(attemptMarkers, now),
      attemptCount,
      attemptMarkers,
      quotaRevision: reconciled.quotaRevision,
    },
  }
}

export function nextAutomaticEmailQuotaCasTimestamp(currentUpdatedAt: string, now = new Date()) {
  const currentMs = Date.parse(currentUpdatedAt)
  const nextMs = Number.isFinite(currentMs)
    ? Math.max(now.getTime(), currentMs + 1)
    : now.getTime()
  return new Date(nextMs).toISOString()
}
