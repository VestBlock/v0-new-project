export type OutreachDispatchHealthStatus =
  | 'dry_run'
  | 'live_disabled'
  | 'target_exhausted'
  | 'capacity_exhausted'
  | 'completed'
  | 'operational_failure'

export type OutreachDispatchHealth = {
  ok: boolean
  operationalFailure: boolean
  status: OutreachDispatchHealthStatus
  reason: string
  expectedSendCount: number
  sentCount: number
  remainingCapacityAfterRun: number
  globalRemainingAfterRun: number
  underfilled: boolean
}

export type OutreachDispatchHealthInput = {
  dryRun: boolean
  liveEnabled: boolean
  expectedSendCount: number
  sentCount: number
  remainingCapacityAfterRun: number
  globalRemainingAfterRun: number
  targetGapBeforeRun?: number | null
  throughputBlockedReason?: string | null
  blockingReasons?: readonly string[]
  operationalFailureCount?: number
  providerFailureCount?: number
  providerCircuitTripped?: boolean
}

export type AutomatedRecoveryCanaryHealth = {
  ok: boolean
  accepted: number
  expected: number
  capacityAlreadyUsed: boolean
  blockedReasons: string[]
}

function count(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0
}

export function evaluateAutomatedRecoveryCanaryHealth(input: {
  runOk: boolean
  resultStatuses: readonly string[]
  sentLast24h: number
  effectiveLimit: number
  sendGateOpen: boolean
  blockedReasons?: readonly string[]
}): AutomatedRecoveryCanaryHealth {
  const accepted = input.resultStatuses.filter((status) => status === 'accepted').length
  const remainingBeforeRun = Math.max(0, 5 - count(input.sentLast24h))
  const expected = Math.min(count(input.effectiveLimit), remainingBeforeRun)
  const capacityAlreadyUsed = remainingBeforeRun === 0
  const blockedReasons = (input.blockedReasons || [])
    .map((reason) => String(reason || '').trim())
    .filter(Boolean)

  return {
    ok: input.runOk && (
      input.sendGateOpen && expected > 0 && accepted === expected
    ),
    accepted,
    expected,
    capacityAlreadyUsed,
    blockedReasons,
  }
}

export function isControlledTrialAllowanceFilled(input: {
  mode: string
  effectiveSendLimit: number
  sentCount: number
}) {
  const allowance = count(input.effectiveSendLimit)
  return input.mode === 'controlled_trial' && allowance > 0 && count(input.sentCount) >= allowance
}

function result(
  input: OutreachDispatchHealthInput,
  status: OutreachDispatchHealthStatus,
  reason: string,
  operationalFailure = false
): OutreachDispatchHealth {
  const expectedSendCount = count(input.expectedSendCount)
  const sentCount = count(input.sentCount)
  return {
    ok: !operationalFailure,
    operationalFailure,
    status,
    reason,
    expectedSendCount,
    sentCount,
    remainingCapacityAfterRun: count(input.remainingCapacityAfterRun),
    globalRemainingAfterRun: count(input.globalRemainingAfterRun),
    underfilled: expectedSendCount > sentCount,
  }
}

/**
 * Gives cron monitoring a truthful outcome without treating a completely used
 * allocation as an incident. Inputs are deliberately limited to facts already
 * persisted by the atomic throughput governor and the just-finished send run.
 */
export function evaluateOutreachDispatchHealth(
  input: OutreachDispatchHealthInput
): OutreachDispatchHealth {
  if (input.dryRun) {
    return result(input, 'dry_run', 'Dispatch ran in preview mode.')
  }
  if (!input.liveEnabled) {
    return result(input, 'live_disabled', 'Live dispatch is disabled.')
  }

  const throughputBlockedReason = String(input.throughputBlockedReason || '').trim()
  if (throughputBlockedReason) {
    return result(
      input,
      'operational_failure',
      `The delivery throughput governor blocked this live run: ${throughputBlockedReason}`,
      true
    )
  }

  const expectedSendCount = count(input.expectedSendCount)
  const sentCount = count(input.sentCount)
  const remainingCapacity = count(input.remainingCapacityAfterRun)
  const globalRemaining = count(input.globalRemainingAfterRun)

  if (input.targetGapBeforeRun !== undefined && input.targetGapBeforeRun !== null && count(input.targetGapBeforeRun) === 0) {
    return result(input, 'target_exhausted', 'The rolling send target was already satisfied before this run.')
  }

  // A live lane can legitimately receive zero work after its canonical share
  // was used by an earlier run (or assigned elsewhere during a recovery ramp).
  if (expectedSendCount === 0 && (globalRemaining === 0 || remainingCapacity === 0)) {
    return result(
      input,
      'capacity_exhausted',
      globalRemaining === 0
        ? 'The atomic 24-hour global allocation is exhausted.'
        : 'The applicable daily lane allocation is exhausted.'
    )
  }

  const operationalFailureCount = count(input.operationalFailureCount)
  const providerFailureCount = count(input.providerFailureCount)
  if (input.providerCircuitTripped || operationalFailureCount > 0 || providerFailureCount > 0) {
    const detail = input.providerCircuitTripped
      ? 'The provider failure circuit opened during this run.'
      : providerFailureCount > 0
        ? `${providerFailureCount} provider send operation(s) failed.`
        : `${operationalFailureCount} send operation(s) failed.`
    return result(input, 'operational_failure', detail, true)
  }

  const blockingReasons = [...new Set(
    (input.blockingReasons || []).map((reason) => String(reason || '').trim()).filter(Boolean)
  )]
  if (blockingReasons.length > 0) {
    return result(
      input,
      'operational_failure',
      `Live sending is not ready: ${blockingReasons.join(', ')}.`,
      true
    )
  }

  if (sentCount >= expectedSendCount && expectedSendCount > 0) {
    return result(input, 'completed', 'The live run met its expected send count.')
  }

  if (globalRemaining === 0) {
    return result(input, 'capacity_exhausted', 'The atomic 24-hour global allocation is exhausted.')
  }
  if (remainingCapacity === 0) {
    return result(input, 'capacity_exhausted', 'The applicable daily lane allocation is exhausted.')
  }

  if (expectedSendCount === 0) {
    return result(
      input,
      'operational_failure',
      'Live capacity remains, but this run received an effective send limit of zero.',
      true
    )
  }
  if (sentCount === 0) {
    return result(
      input,
      'operational_failure',
      'Live capacity remains, but the dispatcher made zero send progress.',
      true
    )
  }

  return result(
    input,
    'operational_failure',
    `The dispatcher underfilled its run (${sentCount}/${expectedSendCount}) while capacity remained${
      providerFailureCount > 0 ? `; provider failures: ${providerFailureCount}` : ''
    }.`,
    true
  )
}
