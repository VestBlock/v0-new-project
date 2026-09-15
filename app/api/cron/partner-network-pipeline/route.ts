export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { runDailyLenderPipeline } from '@/lib/lenders/automation'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import {
  allocatePartnerPipelineSendCap,
  PARTNER_PIPELINE_LANES,
  partnerPipelineRotationOffset,
} from '@/lib/outreach/partnerPipelineCore'
import { getConfiguredOutboundProvider } from '@/lib/outreach/provider-preference'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
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
  const configuredLanes = PARTNER_PIPELINE_LANES.filter((lane) => laneLiveEnabled[lane])
  const dryRun = forcedDryRun || configuredLanes.length === 0
  const sharedSendLimit = positiveInt(process.env.PARTNER_PIPELINE_SEND_LIMIT, 15)
  const deliveryCircuitBreaker = await getDeliveryCircuitBreaker({
    provider: getConfiguredOutboundProvider(),
    allowControlledTrial: true,
  })
  const trialSendLimit = deliveryCircuitBreaker.mode === 'controlled_trial'
    ? Math.min(sharedSendLimit, deliveryCircuitBreaker.maxBatchSize || 5)
    : sharedSendLimit
  const rotationOffset = partnerPipelineRotationOffset()
  const sendAllocations = allocatePartnerPipelineSendCap(trialSendLimit, rotationOffset, configuredLanes)

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
  const ok = Object.values(lanes).every((lane) => lane.ok)
  return NextResponse.json(
    {
      success: ok,
      dryRun,
      sharedSendLimit,
      effectiveSendLimit: trialSendLimit,
      rotationOffset,
      sendAllocations,
      laneLiveEnabled,
      laneDryRun,
      deliveryMode: deliveryCircuitBreaker.mode,
      lanes,
    },
    // Cron providers treat every 2xx response as success. Return a real
    // failure status when any lane fails so monitoring and retries stay true.
    { status: ok ? 200 : 500 }
  )
}
