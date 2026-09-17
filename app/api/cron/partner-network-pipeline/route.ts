export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { runDailyLenderPipeline } from '@/lib/lenders/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import {
  allocateDailyStrategyOutput,
  configuredDailyStrategyOutputTarget,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { resolvePipelineExecutionMode } from '@/lib/outreach/pipelineExecutionCore'
import { evaluateOutreachDispatchHealth } from '@/lib/outreach/outreachDispatchCore'
import { partnerPipelineInvocationRotationOffset } from '@/lib/outreach/partnerPipelineCore'

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
  // Lane switches govern provider delivery, not discovery or draft creation.
  // Only an explicit dryRun query turns the entire partner pipeline read-only.
  const laneExecutionMode = {
    buyers: resolvePipelineExecutionMode({
      dryRun: forcedDryRun,
      deliveryEnabled: laneLiveEnabled.buyers,
    }),
    lenders: resolvePipelineExecutionMode({
      dryRun: forcedDryRun,
      deliveryEnabled: laneLiveEnabled.lenders,
    }),
    investors: resolvePipelineExecutionMode({
      dryRun: forcedDryRun,
      deliveryEnabled: laneLiveEnabled.investors,
    }),
  }
  const laneDryRun = {
    buyers: laneExecutionMode.buyers.dryRun,
    lenders: laneExecutionMode.lenders.dryRun,
    investors: laneExecutionMode.investors.dryRun,
  }
  const laneDeliveryEnabled = {
    buyers: laneExecutionMode.buyers.deliveryEnabled,
    lenders: laneExecutionMode.lenders.deliveryEnabled,
    investors: laneExecutionMode.investors.deliveryEnabled,
  }
  const configuredLanes = (['buyers', 'lenders', 'investors'] as const).filter(
    (lane) => laneDeliveryEnabled[lane]
  )
  const dryRun = forcedDryRun
  const deliveryEnabled = configuredLanes.length > 0
  const strategyOutputTarget = configuredDailyStrategyOutputTarget()
  const productionPlan = allocateDailyStrategyOutput(strategyOutputTarget)
  const canonicalSendAllocations = {
    buyers: laneDeliveryEnabled.buyers ? productionPlan.byKey.buyers : 0,
    lenders: laneDeliveryEnabled.lenders ? productionPlan.byKey.lenders : 0,
    investors: laneDeliveryEnabled.investors ? productionPlan.byKey.investors : 0,
  }
  const sharedSendLimit = Object.values(canonicalSendAllocations).reduce((sum, value) => sum + value, 0)
  const invocationId = `partner-network:${randomUUID()}`
  const partnerLaneOrder = (['buyers', 'lenders', 'investors'] as const)
  const rotationOffset = partnerPipelineInvocationRotationOffset(productionPlan.rotationOffset)
  const rotatedLanes = partnerLaneOrder.map(
    (_, index) => partnerLaneOrder[(rotationOffset + index) % partnerLaneOrder.length]
  )
  const sendAllocations: Record<PartnerLane, number> = { buyers: 0, lenders: 0, investors: 0 }
  let invocationRemaining = 2
  for (const lane of rotatedLanes) {
    if (invocationRemaining < 1) break
    if (!laneDeliveryEnabled[lane] || canonicalSendAllocations[lane] < 1) continue
    sendAllocations[lane] = 1
    invocationRemaining -= 1
  }
  const effectiveSendLimit = Object.values(sendAllocations).reduce((sum, value) => sum + value, 0)

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
      dryRun,
      deliveryEnabled: laneDeliveryEnabled.buyers,
      sendLimit: sendAllocations.buyers,
      invocationId,
      sendExecutor: serializePartnerSend,
    }),
    runDailyLenderPipeline({
      dryRun,
      deliveryEnabled: laneDeliveryEnabled.lenders,
      sendLimit: sendAllocations.lenders,
      invocationId,
      sendExecutor: serializePartnerSend,
    }),
    runDailyInvestorPipeline({
      dryRun,
      deliveryEnabled: laneDeliveryEnabled.investors,
      sendLimit: sendAllocations.investors,
      invocationId,
      sendExecutor: serializePartnerSend,
    }),
  ])
  const lanes = { buyers: settle(buyers), lenders: settle(lenders), investors: settle(investors) }
  const totalAccepted = (Object.keys(lanes) as PartnerLane[]).reduce((sum, lane) => {
    return sum + partnerSendSummary(lane, lanes[lane], sendAllocations[lane]).sentCount
  }, 0)
  const capacity = {
    globalRemaining: Math.max(0, 2 - totalAccepted),
    remainingByLane: Object.fromEntries(
      (Object.keys(lanes) as PartnerLane[]).map((lane) => {
        const accepted = partnerSendSummary(lane, lanes[lane], sendAllocations[lane]).sentCount
        return [lane, Math.max(0, sendAllocations[lane] - accepted)]
      })
    ) as Record<PartnerLane, number>,
  }
  const dispatchHealth = Object.fromEntries(
    (Object.keys(lanes) as PartnerLane[]).map((lane) => {
      const summary = partnerSendSummary(lane, lanes[lane], sendAllocations[lane])
      return [
        lane,
        evaluateOutreachDispatchHealth({
          dryRun,
          liveEnabled: laneLiveEnabled[lane],
          expectedSendCount: summary.expectedSendCount,
          sentCount: summary.sentCount,
          remainingCapacityAfterRun: capacity.remainingByLane[lane] || 0,
          globalRemainingAfterRun: capacity.globalRemaining,
          throughputBlockedReason: null,
          blockingReasons: summary.blockingReasons,
          operationalFailureCount: summary.operationalFailureCount,
          providerFailureCount: summary.providerFailureCount,
        }),
      ]
    })
  ) as Record<PartnerLane, ReturnType<typeof evaluateOutreachDispatchHealth>>
  const pipelineOk = Object.values(lanes).every((lane) => lane.ok)
  const dispatchOk = Object.values(dispatchHealth).every((health) => health.ok)
  const ok = pipelineOk && dispatchOk
  const failedDispatchLanes = (Object.keys(dispatchHealth) as PartnerLane[])
    .filter((lane) => !dispatchHealth[lane].ok)
  const operationalAlert = !dryRun && !ok
    ? await persistPartnerDispatchFailure({
        businessDate: productionPlan.businessDate,
        reason: failedDispatchLanes.length
          ? `Operational partner dispatch failure: ${failedDispatchLanes.join(', ')}.`
          : 'The partner pipeline reported one or more failed stages.',
        metadata: {
          dispatchHealth,
          capacity,
          laneLiveEnabled,
          sendAllocations,
          deliveryMode: 'outlook_direct',
          invocationId,
        },
      })
    : null
  return NextResponse.json(
    {
      success: ok,
      dryRun,
      deliveryEnabled,
      businessDate: productionPlan.businessDate,
      strategyOutputTarget,
      sharedSendLimit,
      effectiveSendLimit,
      rotationOffset,
      dailyRotationOffset: productionPlan.rotationOffset,
      canonicalSendAllocations,
      sendAllocations,
      throughput: {
        stage: 'outlook_cold_guarded',
        effectiveDailyCap: 25,
        perInvocationCap: 2,
        perDomainCap: 2,
        reason: null,
      },
      invocationId,
      laneLiveEnabled,
      laneDeliveryEnabled,
      laneDryRun,
      deliveryMode: 'outlook_direct',
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
