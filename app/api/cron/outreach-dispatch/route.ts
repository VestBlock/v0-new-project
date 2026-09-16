export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { runLeadThroughputSprint } from '@/lib/leads/dailyAutomation'
import { chicagoBusinessDate } from '@/lib/outreach/dailyStrategyOutputCore'
import { readOutreachDispatchCapacity } from '@/lib/outreach/outreachDispatchCapacity'
import { evaluateOutreachDispatchHealth } from '@/lib/outreach/outreachDispatchCore'
import { reconcileStaleOutreachReservations } from '@/lib/outreach/throughputGovernor'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function enabled(value: string | null | undefined) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim())
}

function positiveInt(value: string | null | undefined, fallback: number, maximum: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, parsed) : fallback
}

function chicagoDispatchWindow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .filter((part) => part.type === 'weekday' || part.type === 'hour')
      .map((part) => [part.type, part.value])
  )
  const hour = Number.parseInt(String(parts.hour || ''), 10)
  return {
    allowed: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(String(parts.weekday)) && hour >= 9 && hour < 17,
    weekday: String(parts.weekday || ''),
    hour,
  }
}

async function persistDispatchFailure(input: {
  businessDate: string
  reason: string
  metadata?: Record<string, unknown>
}) {
  return createAdminTask({
    title: 'Live outreach dispatcher requires attention',
    description: `${input.reason}\n\nThe cron returned a non-success status so scheduler monitoring can retry or escalate it. Restore send readiness or replenish the eligible queue before the next dispatch window.`,
    taskType: 'outreach_dispatch_operational_failure',
    priority: 'urgent',
    entityType: 'outreach_dispatch',
    entityId: `lead:${input.businessDate}`,
    dueAt: adminTaskDueDates.now(),
    metadata: input.metadata,
    createdBy: 'outreach-dispatch-cron',
  })
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const forcedDryRun = enabled(url.searchParams.get('dryRun'))
  const liveEnabled = enabled(process.env.OUTREACH_DISPATCH_CRON_SEND)
  // The cron flag governs provider delivery only. Preparation remains a live,
  // persistent pipeline unless the caller explicitly requests a full dry run.
  const dryRun = forcedDryRun
  const deliveryEnabled = liveEnabled && !forcedDryRun
  const window = chicagoDispatchWindow()
  const sendLimit = positiveInt(
    url.searchParams.get('limit') || process.env.OUTREACH_DISPATCH_PER_RUN,
    30,
    50
  )

  if (!dryRun && !window.allowed) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'outside_chicago_weekday_dispatch_window',
      window,
      sendLimit,
      deliveryEnabled,
    })
  }

  try {
    const reservationReconciliation = deliveryEnabled
      ? await reconcileStaleOutreachReservations({ limit: 250 })
      : null
    const result = await runLeadThroughputSprint({
      dryRun,
      deliveryEnabled,
      sendLimit,
      budgetMs: 240_000,
      startedAtMs: Date.now(),
      suppressDigest: true,
      // A production dispatch gap must attempt the email-ready refill. Each
      // paid source remains independently protected by approval, credentials,
      // daily-unit reservations, and the source cost governor.
      refillEnabled: true,
    })
    const sendPasses = [
      result.firstPass.send,
      result.secondPass?.send,
      result.refillPass?.send,
    ].filter((pass): pass is NonNullable<typeof pass> => Boolean(pass))
    const firstSend = result.firstPass.send
    const providerFailureCount = sendPasses.reduce(
      (sum, pass) => sum + pass.providerFailureCount,
      0
    )
    const circuitBreakerTripped = sendPasses.some((pass) => pass.circuitBreakerTripped)
    const skipReasonCounts = sendPasses.reduce<Record<string, number>>((counts, pass) => {
      for (const [reason, value] of Object.entries(pass.skipReasonCounts)) {
        counts[reason] = (counts[reason] || 0) + Number(value || 0)
      }
      return counts
    }, {})
    const capacity = await readOutreachDispatchCapacity(firstSend.throughputDecision)
    const blockingReasons = [
      !firstSend.autoSendRequested ? 'automatic_sending_disabled' : null,
      !firstSend.replyCaptureReadiness.ready ? 'reply_capture_not_ready' : null,
      !firstSend.mailingAddressConfigured ? 'mailing_address_not_configured' : null,
    ].filter((reason): reason is string => Boolean(reason))
    const throughputBlockedReason =
      !firstSend.deliveryCircuitBreaker.allowed || firstSend.throughputDecision.effectiveDailyCap < 1
        ? firstSend.throughputDecision.reason || firstSend.deliveryCircuitBreaker.reason || 'delivery_not_permitted'
        : null
    const dispatchHealth = evaluateOutreachDispatchHealth({
      dryRun,
      liveEnabled,
      expectedSendCount: firstSend.effectiveSendLimit,
      sentCount: result.sentTotal,
      remainingCapacityAfterRun: capacity.leadLaneRemaining,
      globalRemainingAfterRun: capacity.globalRemaining,
      targetGapBeforeRun: firstSend.targetGap24hBeforeRun,
      throughputBlockedReason,
      blockingReasons,
      providerFailureCount,
      providerCircuitTripped: circuitBreakerTripped,
    })
    const operationalAlert = dispatchHealth.operationalFailure
      ? await persistDispatchFailure({
          businessDate: firstSend.throughputDecision.allocationPlan.businessDate,
          reason: dispatchHealth.reason,
          metadata: {
            dispatchHealth,
            capacity,
            sendLimit,
            skipReasonCounts,
            providerFailureCount,
            deliveryMode: firstSend.deliveryCircuitBreaker.mode,
            throughputStage: firstSend.throughputDecision.stage,
            refillCreated: result.refillPass?.scrape?.totalCreated || 0,
            refillAttempted: Boolean(result.refillPass),
          },
        })
      : null
    const ok = result.ok && dispatchHealth.ok
    return NextResponse.json(
      {
        success: ok,
        dryRun,
        liveEnabled,
        deliveryEnabled,
        window,
        sendLimit,
        reservationReconciliation,
        capacity,
        dispatchHealth,
        operationalAlert,
        result,
      },
      { status: ok ? 200 : 500 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outreach dispatch failed.'
    const operationalAlert = dryRun
      ? null
      : await persistDispatchFailure({
          businessDate: chicagoBusinessDate(),
          reason: message,
          metadata: { phase: 'unhandled_dispatch_error', sendLimit },
        })
    return NextResponse.json(
      {
        success: false,
        dryRun,
        liveEnabled,
        deliveryEnabled,
        window,
        sendLimit,
        operationalAlert,
        error: message,
      },
      { status: 500 }
    )
  }
}
