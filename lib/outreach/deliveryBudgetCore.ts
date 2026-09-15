export const OUTREACH_DELIVERY_BUDGET_LIMIT = 5
export const OUTREACH_DELIVERY_BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000

export type DeliveryBudgetMetrics = {
  windowStartedAt?: string | null
  attemptCount?: number | null
  attemptMarkers?: Array<Record<string, unknown>> | null
  activePermitId?: string | null
}

export function normalizeDeliveryBudget(
  metrics: DeliveryBudgetMetrics | null | undefined,
  now = new Date(),
  windowMs = OUTREACH_DELIVERY_BUDGET_WINDOW_MS
) {
  const startedAt = metrics?.windowStartedAt ? Date.parse(metrics.windowStartedAt) : Number.NaN
  const aggregateAttemptCount = Math.max(0, Math.floor(Number(metrics?.attemptCount || 0)))
  const rawMarkers = Array.isArray(metrics?.attemptMarkers) ? metrics.attemptMarkers : []
  const activeMarkers = rawMarkers.filter((marker) => {
    const attemptedAt = typeof marker.attemptedAt === 'string' ? Date.parse(marker.attemptedAt) : Number.NaN
    return (
      Number.isFinite(attemptedAt) &&
      attemptedAt <= now.getTime() &&
      now.getTime() - attemptedAt < windowMs
    )
  })
  const legacyWindowActive =
    aggregateAttemptCount > 0 &&
    (!Number.isFinite(startedAt) || startedAt > now.getTime() || now.getTime() - startedAt < windowMs)
  const suspiciousMarkers = legacyWindowActive
    ? rawMarkers
        .filter((marker) => {
          const attemptedAt = typeof marker.attemptedAt === 'string' ? Date.parse(marker.attemptedAt) : Number.NaN
          return !Number.isFinite(attemptedAt) || attemptedAt > now.getTime()
        })
        .map((marker) => ({
          ...marker,
          attemptedAt: now.toISOString(),
          normalizedFromUntrustedTimestamp: true,
        }))
    : []
  // Older budget rows only recorded an aggregate count. Keep that count until
  // its original window expires while all new attempts age out individually.
  const legacyAttemptCount = legacyWindowActive
    ? Math.max(0, aggregateAttemptCount - rawMarkers.length)
    : 0
  const retainedMarkers = [...activeMarkers, ...suspiciousMarkers]
  const oldestMarkerAt = retainedMarkers.reduce<number | null>((oldest, marker) => {
    const attemptedAt = Date.parse(String(marker.attemptedAt))
    return oldest === null || attemptedAt < oldest ? attemptedAt : oldest
  }, null)

  return {
    windowStartedAt: legacyAttemptCount > 0
      ? Number.isFinite(startedAt)
        ? startedAt > now.getTime()
          ? now.toISOString()
          : String(metrics?.windowStartedAt)
        : now.toISOString()
      : oldestMarkerAt === null
        ? now.toISOString()
        : new Date(oldestMarkerAt).toISOString(),
    attemptCount: legacyAttemptCount + retainedMarkers.length,
    attemptMarkers: retainedMarkers.slice(-20),
  }
}

/**
 * The command-center five-attempt budget predates the sender-specific atomic
 * throughput governor. Keeping both active double-counts one provider attempt
 * and lets traffic from one sender exhaust another sender's recovery capacity.
 *
 * The legacy budget reader remains for historical diagnostics, but every live
 * send is now authorized by reserve_outreach_throughput_attempt, which applies
 * the authoritative sender ramp, rolling global cap, lane cap, recipient
 * cooldown, and idempotency identity in one database transaction.
 */
export function deliveryModeRequiresBudget(_mode: string) {
  return false
}
