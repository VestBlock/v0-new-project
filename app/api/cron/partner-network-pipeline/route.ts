export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { runDailyLenderPipeline, runDailyLenderSend } from '@/lib/lenders/automation'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import {
  allocateDailyStrategyOutput,
  configuredDailyStrategyOutputTarget,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { getConfiguredOutboundProvider } from '@/lib/outreach/provider-preference'
import { readOutreachDispatchCapacity } from '@/lib/outreach/outreachDispatchCapacity'
import {
  evaluateAutomatedRecoveryCanaryHealth,
  evaluateOutreachDispatchHealth,
} from '@/lib/outreach/outreachDispatchCore'
import { evaluateOutreachThroughputGovernor } from '@/lib/outreach/throughputGovernorCore'
import { reconcileStaleOutreachReservations } from '@/lib/outreach/throughputGovernor'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function settle<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled'
    ? {
        ok: !(
          result.value &&
          typeof result.value === 'object' &&
          'ok' in result.value &&
          result.value.ok === false
        ),
        result: result.value,
      }
    : { ok: false as const, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
}

type PartnerLane = 'buyers' | 'lenders' | 'investors'

type AutomatedRecoveryCanaryResult = Awaited<ReturnType<typeof runDailyLenderSend>>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function finiteCount(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback
}

function partnerSendSummary(
  lane: PartnerLane,
  settledLane: unknown,
  allocation: number
) {
  const settled = record(settledLane)
  const pipeline = record(settled.result)
  const stage = lane === 'investors'
    ? record(pipeline.send)
    : record(record(pipeline.stages).send)
  const send = lane === 'investors' ? stage : record(stage.result)
  const results = Array.isArray(send.results) ? send.results.map(record) : []
  const sentCount = results.filter((item) => item.status === 'accepted').length
  const remainingBeforeRun = finiteCount(
    send.remainingBeforeRun ?? send.remainingDailyCapacity,
    allocation
  )
  const expectedSendCount = finiteCount(
    send.effectiveLimit,
    Math.min(allocation, remainingBeforeRun)
  )
  const sendBlockedReasons = Array.isArray(send.sendBlockedReasons)
    ? send.sendBlockedReasons
        .map((reason) => String(reason || '').trim())
        .filter((reason) => reason && reason !== 'daily_send_limit_reached')
    : []
  const sendStageFailed = lane === 'investors'
    ? send.ok === false
    : stage.ok === false || send.ok === false

  return {
    expectedSendCount,
    sentCount,
    operationalFailureCount:
      finiteCount(send.operationalFailureCount) + (sendStageFailed ? 1 : 0),
    providerFailureCount: results.filter((item) => item.status === 'failed').length,
    blockingReasons: [
      ...sendBlockedReasons,
      Object.keys(send).length === 0 ? 'send_stage_result_unavailable' : null,
    ].filter((reason): reason is string => Boolean(reason)),
  }
}

async function persistPartnerDispatchFailure(input: {
  businessDate: string
  reason: string
  metadata: Record<string, unknown>
}) {
  return createAdminTask({
    title: 'Partner-network dispatcher requires attention',
    description: `${input.reason}\n\nOne or more enabled partner lanes left usable allocation unfilled or encountered an operational stop. The cron returned a non-success status so scheduler monitoring remains truthful.`,
    taskType: 'partner_dispatch_operational_failure',
    priority: 'urgent',
    entityType: 'outreach_dispatch',
    entityId: `partner:${input.businessDate}`,
    dueAt: adminTaskDueDates.now(),
    metadata: input.metadata,
    createdBy: 'partner-network-pipeline-cron',
  })
}

function summarizeAutomatedRecoveryCanary(result: AutomatedRecoveryCanaryResult) {
  const health = evaluateAutomatedRecoveryCanaryHealth({
    runOk: result.ok,
    resultStatuses: result.results.map((item) => item.status),
    sentLast24h: result.canarySentLast24h,
    effectiveLimit: result.effectiveLimit,
    sendGateOpen: result.sendGateOpen,
    blockedReasons: result.sendBlockedReasons,
  })

  return {
    ...health,
    result,
  }
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRunParam = url.searchParams.get('dryRun')
  const forcedDryRun = dryRunParam !== null && enabled(dryRunParam)
  const schedulerEnabled = enabled(process.env.PARTNER_PIPELINE_CRON_SEND)
  const laneLiveEnabled = {
    buyers: schedulerEnabled && enabled(process.env.BUYERS_PIPELINE_CRON_SEND),
    lenders: schedulerEnabled && enabled(process.env.LENDERS_PIPELINE_CRON_SEND),
    investors: schedulerEnabled && enabled(process.env.INVESTORS_PIPELINE_CRON_SEND),
  }
  const laneDryRun = {
    buyers: forcedDryRun || !laneLiveEnabled.buyers,
    lenders: forcedDryRun || !laneLiveEnabled.lenders,
    investors: forcedDryRun || !laneLiveEnabled.investors,
  }
  const configuredLanes = (['buyers', 'lenders', 'investors'] as const).filter((lane) => laneLiveEnabled[lane])
  const dryRun = forcedDryRun || configuredLanes.length === 0
  const strategyOutputTarget = configuredDailyStrategyOutputTarget()
  const productionPlan = allocateDailyStrategyOutput(strategyOutputTarget)
  const canonicalSendAllocations = {
    buyers: laneLiveEnabled.buyers ? productionPlan.byKey.buyers : 0,
    lenders: laneLiveEnabled.lenders ? productionPlan.byKey.lenders : 0,
    investors: laneLiveEnabled.investors ? productionPlan.byKey.investors : 0,
  }
  const sharedSendLimit = Object.values(canonicalSendAllocations).reduce((sum, value) => sum + value, 0)
  const deliveryCircuitBreaker = await getDeliveryCircuitBreaker({
    provider: getConfiguredOutboundProvider(),
    allowControlledTrial: true,
  })
  const throughputDecision = evaluateOutreachThroughputGovernor({
    mode: deliveryCircuitBreaker.mode,
    sampleSize: deliveryCircuitBreaker.sampleSize,
    complained: deliveryCircuitBreaker.complained,
    badRate: deliveryCircuitBreaker.badRate,
    globalFailureRate: deliveryCircuitBreaker.globalFailureRate,
    terminalCompleteness: deliveryCircuitBreaker.terminalCompleteness,
    requestedDailyTarget: strategyOutputTarget,
  })
  const sendAllocations = {
    buyers: laneLiveEnabled.buyers ? throughputDecision.allocationPlan.byKey.buyers : 0,
    lenders: laneLiveEnabled.lenders ? throughputDecision.allocationPlan.byKey.lenders : 0,
    investors: laneLiveEnabled.investors ? throughputDecision.allocationPlan.byKey.investors : 0,
  }
  const effectiveSendLimit = Object.values(sendAllocations).reduce((sum, value) => sum + value, 0)
  const reservationReconciliation = dryRun
    ? null
    : await reconcileStaleOutreachReservations({ limit: 250 })

  // Discovery, enrichment, scoring, and drafting remain concurrent so the
  // combined partner cron stays inside its execution budget. Only the guarded
  // send stages are queued, preventing a shared permit lock from becoming a
  // false provider failure.
  let sendQueue: Promise<void> = Promise.resolve()
  const serializePartnerSend = <T,>(task: () => Promise<T>) => {
    const result = sendQueue.then(task, task)
    sendQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  const [buyers, lenders, investors] = await Promise.allSettled([
    runDailyBuyerPipeline({
      dryRun: laneDryRun.buyers,
      sendLimit: sendAllocations.buyers,
      sendExecutor: serializePartnerSend,
    }),
    runDailyLenderPipeline({
      dryRun: laneDryRun.lenders,
      sendLimit: sendAllocations.lenders,
      sendExecutor: serializePartnerSend,
    }),
    runDailyInvestorPipeline({
      dryRun: laneDryRun.investors,
      sendLimit: sendAllocations.investors,
      sendExecutor: serializePartnerSend,
    }),
  ])
  const lanes = { buyers: settle(buyers), lenders: settle(lenders), investors: settle(investors) }
  const automatedRecoveryCanaryEnabled =
    enabled(process.env.OUTREACH_AUTOMATED_RECOVERY_CANARY_ENABLED) &&
    enabled(process.env.OUTREACH_CANARY_ENABLED)
  const shouldRunAutomatedRecoveryCanary =
    !dryRun &&
    automatedRecoveryCanaryEnabled &&
    laneLiveEnabled.lenders &&
    deliveryCircuitBreaker.mode === 'blocked'
  let automatedRecoveryCanary: ReturnType<typeof summarizeAutomatedRecoveryCanary> | null = null
  if (shouldRunAutomatedRecoveryCanary) {
    automatedRecoveryCanary = summarizeAutomatedRecoveryCanary(
      await runDailyLenderSend(5, {
        canary: true,
        recoveryExplicitlyRequested: true,
      })
    )
  }
  const capacity = await readOutreachDispatchCapacity(throughputDecision)
  const throughputBlockedReason =
    !deliveryCircuitBreaker.allowed || throughputDecision.effectiveDailyCap < 1
      ? throughputDecision.reason || deliveryCircuitBreaker.reason || 'delivery_not_permitted'
      : null
  // Provider acceptance only proves that the recovery test was submitted. It
  // cannot restore broad sending until terminal delivery webhooks change the
  // next circuit-breaker evaluation, so keep normal dispatch fail-closed.
  const normalDispatchBlockedReason = throughputBlockedReason
  const dispatchHealth = Object.fromEntries(
    (Object.keys(lanes) as PartnerLane[]).map((lane) => {
      const summary = partnerSendSummary(lane, lanes[lane], sendAllocations[lane])
      return [
        lane,
        evaluateOutreachDispatchHealth({
          dryRun: laneDryRun[lane],
          liveEnabled: laneLiveEnabled[lane],
          expectedSendCount: summary.expectedSendCount,
          sentCount: summary.sentCount,
          remainingCapacityAfterRun: capacity.remainingByLane[lane] || 0,
          globalRemainingAfterRun: capacity.globalRemaining,
          throughputBlockedReason: normalDispatchBlockedReason,
          blockingReasons: summary.blockingReasons,
          operationalFailureCount: summary.operationalFailureCount,
          providerFailureCount: summary.providerFailureCount,
        }),
      ]
    })
  ) as Record<PartnerLane, ReturnType<typeof evaluateOutreachDispatchHealth>>
  const pipelineOk = Object.values(lanes).every((lane) => lane.ok)
  const dispatchOk = Object.values(dispatchHealth).every((health) => health.ok)
  const recoveryOk = automatedRecoveryCanary?.ok !== false
  const ok = pipelineOk && dispatchOk && recoveryOk
  const failedDispatchLanes = (Object.keys(dispatchHealth) as PartnerLane[])
    .filter((lane) => !dispatchHealth[lane].ok)
  const operationalAlert = !dryRun && !ok
    ? await persistPartnerDispatchFailure({
        businessDate: throughputDecision.allocationPlan.businessDate,
        reason: failedDispatchLanes.length
          ? `Operational partner dispatch failure: ${failedDispatchLanes.join(', ')}.`
          : 'The partner pipeline reported one or more failed stages.',
        metadata: {
          dispatchHealth,
          capacity,
          laneLiveEnabled,
          sendAllocations,
          deliveryMode: deliveryCircuitBreaker.mode,
          throughputStage: throughputDecision.stage,
          automatedRecoveryCanary,
        },
      })
    : null
  return NextResponse.json(
    {
      success: ok,
      dryRun,
      businessDate: productionPlan.businessDate,
      strategyOutputTarget,
      sharedSendLimit,
      effectiveSendLimit,
      rotationOffset: productionPlan.rotationOffset,
      canonicalSendAllocations,
      sendAllocations,
      throughput: {
        stage: throughputDecision.stage,
        effectiveDailyCap: throughputDecision.effectiveDailyCap,
        reason: throughputDecision.reason,
      },
      reservationReconciliation,
      automatedRecoveryCanaryEnabled,
      automatedRecoveryCanary,
      recoveryTerminalEvidencePending: Boolean(automatedRecoveryCanary?.accepted),
      laneLiveEnabled,
      laneDryRun,
      deliveryMode: deliveryCircuitBreaker.mode,
      capacity,
      dispatchHealth,
      operationalAlert,
      lanes,
    },
    // Cron providers treat every 2xx response as success. Return a real
    // failure status when any lane fails so monitoring and retries stay true.
    { status: ok ? 200 : 500 }
  )
}
