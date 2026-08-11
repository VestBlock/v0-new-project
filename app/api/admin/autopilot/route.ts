export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { getAutopilotCockpitSnapshot } from '@/lib/autopilot/cockpit'
import {
  buildWeeklyStrategyCandidates,
  createCampaignFromStrategy,
  createVestBlockStrategies,
  recordStrategyResult,
} from '@/lib/autopilot/repository'
import {
  createStrategyObject,
  STRATEGY_VERTICALS,
} from '@/lib/autopilot/strategyEngine'
import { isTrustedMutationOrigin } from '@/lib/security/sameOrigin'
import { logEvent } from '@/lib/system/logEvent'

const scoreSchema = z.object({
  expectedImpact: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  cost: z.number().min(0).max(100),
  timeToResult: z.number().min(0).max(100),
  executionDifficulty: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
})

const requestSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('generate_candidates') }),
  z.object({
    intent: z.literal('create_strategy'),
    strategy: z.object({
      name: z.string().trim().min(4).max(180),
      vertical: z.enum(STRATEGY_VERTICALS),
      hypothesis: z.string().trim().min(10).max(1500),
      targetAudience: z.string().trim().min(3).max(500),
      problem: z.string().trim().min(3).max(1000),
      tactic: z.string().trim().min(3).max(1500),
      channel: z.string().trim().min(2).max(180),
      expectedOutcome: z.string().trim().min(3).max(800),
      primaryKpi: z.string().trim().min(2).max(180),
      secondaryKpis: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
      cost: z.string().trim().min(1).max(300),
      risk: z.enum(['low', 'medium', 'high']),
      confidence: z.number().min(0).max(100),
      evidence: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
      score: scoreSchema,
    }),
  }),
  z.object({ intent: z.literal('create_campaign'), strategyId: z.string().uuid() }),
  z.object({
    intent: z.literal('record_result'),
    strategyId: z.string().uuid(),
    campaignRunId: z.string().uuid().nullable().optional(),
    leads: z.number().int().min(0).max(1000000),
    replies: z.number().int().min(0).max(1000000),
    opportunities: z.number().int().min(0).max(1000000),
    conversions: z.number().int().min(0).max(1000000),
    revenue: z.number().min(0).max(1000000000),
    lesson: z.string().trim().min(3).max(1500),
    nextIteration: z.string().trim().min(3).max(1500),
  }),
])

async function requireAdmin() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin || !adminCheck.user) {
    return {
      adminCheck,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: adminCheck.user ? 403 : 401 }
      ),
    }
  }
  return { adminCheck, response: null }
}

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response
  try {
    const data = await getCommandCenterData()
    const cockpit = await getAutopilotCockpitSnapshot(data)
    return NextResponse.json({ data, cockpit })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load Autopilot.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { adminCheck, response } = await requireAdmin()
  if (response) return response
  const adminUser = adminCheck.user
  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Autopilot request.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.intent === 'generate_candidates') {
      const data = await getCommandCenterData()
      const cockpit = await getAutopilotCockpitSnapshot(data)
      const strategies = buildWeeklyStrategyCandidates(data, cockpit)
      const created = await createVestBlockStrategies(strategies, {
        actorUserId: adminUser.id,
      })
      await logEvent({
        eventType: 'admin_action',
        actorUserId: adminUser.id,
        entityType: 'autopilot_strategy',
        metadata: { action: 'generate_weekly_candidates', created: created.length },
      })
      return NextResponse.json({ success: true, created })
    }

    if (parsed.data.intent === 'create_strategy') {
      const strategy = createStrategyObject(parsed.data.strategy)
      const [created] = await createVestBlockStrategies([strategy], {
        actorUserId: adminUser.id,
        dedupeWeek: `manual-${Date.now()}`,
      })
      return NextResponse.json({ success: true, created })
    }

    if (parsed.data.intent === 'create_campaign') {
      const campaign = await createCampaignFromStrategy(
        parsed.data.strategyId,
        adminUser.id
      )
      await logEvent({
        eventType: 'admin_action',
        actorUserId: adminUser.id,
        entityType: 'command_center_strategy_run',
        entityId: campaign.id,
        metadata: { action: 'build_campaign_from_strategy', launchAuthority: 'not_granted' },
      })
      return NextResponse.json({ success: true, campaign })
    }

    const result = await recordStrategyResult(parsed.data)
    await logEvent({
      eventType: 'admin_action',
      actorUserId: adminUser.id,
      entityType: 'autopilot_strategy',
      entityId: parsed.data.strategyId,
      metadata: { action: 'record_strategy_result' },
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run Autopilot action.' },
      { status: 500 }
    )
  }
}
