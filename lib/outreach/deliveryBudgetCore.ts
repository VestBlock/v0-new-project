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
  const expired = !Number.isFinite(startedAt) || now.getTime() - startedAt >= windowMs || startedAt > now.getTime()
  return {
    windowStartedAt: expired ? now.toISOString() : String(metrics?.windowStartedAt),
    attemptCount: expired ? 0 : Math.max(0, Math.floor(Number(metrics?.attemptCount || 0))),
    attemptMarkers: expired || !Array.isArray(metrics?.attemptMarkers) ? [] : metrics.attemptMarkers.slice(-20),
  }
}

export function deliveryModeRequiresBudget(mode: string) {
  return mode === 'controlled_trial' || mode === 'recovery_canary'
}
