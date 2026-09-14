export type DeliveryCircuitBreaker = {
  allowed: boolean
  broadSendingAllowed: boolean
  recoveryCanaryAllowed: boolean
  reason: string | null
  mode: 'healthy' | 'controlled_trial' | 'recovery_canary' | 'blocked' | 'unavailable'
  provider: string
  maxBatchSize: number | null
  windowDays: number
  threshold: number
  sampleSize: number
  delivered: number
  bounced: number
  complained: number
  suppressed: number
  failed: number
  badRate: number
  globalSampleSize: number
  globalFailed: number
  globalFailureRate: number
  providerGlobalHealthBlocked: boolean
}

type DeliveryEvidenceRow = {
  provider_message_id: string
  delivery_status: string
}

const TERMINAL_DELIVERY_STATUSES = new Set([
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'suppressed',
  'failed',
])

export function providerHasDeliveryTelemetry(provider: string) {
  return String(provider || '').trim().toLowerCase() === 'resend'
}

function latestTerminalStatuses(rows: DeliveryEvidenceRow[]) {
  const latestByMessage = new Map<string, string>()
  for (const row of rows) {
    if (!latestByMessage.has(row.provider_message_id)) {
      latestByMessage.set(row.provider_message_id, row.delivery_status)
    }
  }
  return Array.from(latestByMessage.values()).filter((status) => TERMINAL_DELIVERY_STATUSES.has(status))
}

export function evaluateDeliveryCircuitBreaker(
  rows: DeliveryEvidenceRow[],
  options: {
    provider: string
    windowDays: number
    threshold: number
    minimumSample: number
    trialBatchSize: number
    allowControlledTrial: boolean
    allowRecoveryCanary?: boolean
    globalRows?: DeliveryEvidenceRow[]
    globalFailureThreshold?: number
    globalMinimumSample?: number
  }
): DeliveryCircuitBreaker {
  const terminal = latestTerminalStatuses(rows)
  const globalTerminal = latestTerminalStatuses(options.globalRows || rows)
  const count = (status: string) => terminal.filter((value) => value === status).length
  const delivered = terminal.filter((status) => ['delivered', 'opened', 'clicked'].includes(status)).length
  const bounced = count('bounced')
  const complained = count('complained')
  const suppressed = count('suppressed')
  const failed = count('failed')
  const bad = bounced + complained + suppressed + failed
  const badRate = terminal.length ? bad / terminal.length : 0
  const globalFailed = globalTerminal.filter((status) => status === 'failed').length
  const globalFailureRate = globalTerminal.length ? globalFailed / globalTerminal.length : 0
  const providerGlobalHealthBlocked =
    globalTerminal.length >= (options.globalMinimumSample ?? options.minimumSample) &&
    globalFailureRate > (options.globalFailureThreshold ?? Math.max(options.threshold, 0.2))
  const hasEvidence = terminal.length >= options.minimumSample
  const complaintBlocked = complained > 0
  const qualityBlocked =
    complaintBlocked ||
    (bad > 0 && badRate > options.threshold) ||
    providerGlobalHealthBlocked
  const controlledTrial = !hasEvidence && !qualityBlocked && options.allowControlledTrial
  const broadSendingAllowed = !qualityBlocked && (hasEvidence || controlledTrial)
  // A recovery canary never bypasses complaint evidence. It only permits an
  // explicit, verified, five-recipient repair test while broad sending remains blocked.
  const recoveryCanaryAllowed = Boolean(
    options.allowRecoveryCanary && qualityBlocked && complained === 0 && !providerGlobalHealthBlocked
  )
  const safeTrialBatchSize = Math.min(5, options.trialBatchSize)
  const allowed = broadSendingAllowed || recoveryCanaryAllowed
  const mode: DeliveryCircuitBreaker['mode'] = recoveryCanaryAllowed
    ? 'recovery_canary'
    : qualityBlocked
      ? 'blocked'
      : hasEvidence
        ? 'healthy'
        : controlledTrial
          ? 'controlled_trial'
          : 'blocked'

  return {
    allowed,
    broadSendingAllowed,
    recoveryCanaryAllowed,
    reason: recoveryCanaryAllowed
      ? `recovery_canary: broad sending remains blocked at ${(badRate * 100).toFixed(1)}%; cap the explicit verified test at ${safeTrialBatchSize}`
      : complaintBlocked
        ? `complaint_evidence: ${complained} complaint event(s) in the active delivery window`
        : providerGlobalHealthBlocked
          ? `provider_global_failure_rate: ${(globalFailureRate * 100).toFixed(1)}% exceeds ${((options.globalFailureThreshold ?? Math.max(options.threshold, 0.2)) * 100).toFixed(1)}%`
        : qualityBlocked
          ? `bad_delivery_rate: ${(badRate * 100).toFixed(1)}% exceeds ${(options.threshold * 100).toFixed(1)}%`
          : controlledTrial
            ? `controlled_trial: ${terminal.length}/${options.minimumSample} finalized messages; cap each run at ${safeTrialBatchSize}`
            : hasEvidence
              ? null
              : `insufficient_delivery_evidence: ${terminal.length}/${options.minimumSample}`,
    mode,
    provider: options.provider,
    maxBatchSize: controlledTrial || recoveryCanaryAllowed ? safeTrialBatchSize : null,
    windowDays: options.windowDays,
    threshold: options.threshold,
    sampleSize: terminal.length,
    delivered,
    bounced,
    complained,
    suppressed,
    failed,
    badRate,
    globalSampleSize: globalTerminal.length,
    globalFailed,
    globalFailureRate,
    providerGlobalHealthBlocked,
  }
}
