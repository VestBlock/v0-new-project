export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { runLeadThroughputSprint } from '@/lib/leads/dailyAutomation'
import { logEvent } from '@/lib/system/logEvent'

const outboundSprintSchema = z.object({
  target: z.coerce.number().int().min(1).max(500).optional(),
  dryRun: z.boolean().optional().default(false),
})

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envMs(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = outboundSprintSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const dailyTarget = envInt('LEADS_TARGET_EMAILS_PER_DAY', envInt('LEADS_DAILY_SEND_LIMIT', 500))
  const maxPerRun = envInt('LEADS_COMMAND_CENTER_MAX_SENDS_PER_RUN', Math.min(dailyTarget, 500))
  const target = Math.min(parsed.data.target || maxPerRun, maxPerRun)
  const budgetMs = envMs('LEADS_COMMAND_CENTER_OUTBOUND_BUDGET_MS', 90000)

  try {
    const result = await runLeadThroughputSprint({
      dryRun: parsed.data.dryRun,
      sendLimit: target,
      budgetMs,
      startedAtMs: Date.now(),
    })

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead_throughput',
      entityId: new Date().toISOString().slice(0, 10),
      metadata: {
        action: parsed.data.dryRun ? 'outreach_throughput_preview' : 'outreach_throughput_sprint',
        target,
        budgetMs,
        sentTotal: result.sentTotal,
        remainingTarget: result.remainingTarget,
        autoApprovedTotal: result.autoApprovedTotal,
        enrichedInQueueTotal: result.enrichedInQueueTotal,
        truncated: result.truncated,
      },
    })

    return NextResponse.json({
      success: true,
      dryRun: parsed.data.dryRun,
      requestedTarget: target,
      maxPerRun,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Outbound sprint failed.' },
      { status: 500 }
    )
  }
}
