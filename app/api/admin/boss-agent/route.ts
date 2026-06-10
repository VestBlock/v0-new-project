export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { buildBossBriefing } from '@/lib/admin/bossAgent'

const AGENT_LABELS: Record<string, string> = {
  acquisition: 'Lead Acquisition',
  outreach: 'Outreach',
  routing: 'Deal Routing',
  underwriting: 'Underwriting & Capital',
  authority: 'Authority Engine',
  qa: 'QA / Funnel Health',
  operator: 'Operator Intelligence',
}

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const data = await getCommandCenterData()
    const briefing = buildBossBriefing(data)
    return NextResponse.json(briefing)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to build the boss briefing.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const playKey = String(body?.playKey || '').trim()
  if (!playKey) {
    return NextResponse.json({ error: 'playKey is required.' }, { status: 400 })
  }

  try {
    const data = await getCommandCenterData()
    const briefing = buildBossBriefing(data)
    const play = briefing.plays.find((item) => item.key === playKey)
    if (!play) {
      return NextResponse.json({ error: `Unknown play: ${playKey}` }, { status: 404 })
    }

    const supabase = createAdminClient()

    // Skip duplicates: same play dispatched while directives are still open
    const { data: existing } = await supabase
      .from('admin_tasks')
      .select('id,metadata_json,status')
      .eq('task_type', 'boss_directive')
      .not('status', 'in', '("completed","dismissed")')
      .limit(200)

    const openForPlay = (existing || []).filter(
      (task) => (task.metadata_json as Record<string, unknown> | null)?.play_key === playKey
    )
    if (openForPlay.length) {
      return NextResponse.json({
        dispatched: 0,
        skipped: play.directives.length,
        message: `"${play.name}" already has ${openForPlay.length} open directive task(s). Complete or dismiss them before re-dispatching.`,
      })
    }

    const now = new Date().toISOString()
    const rows = play.directives.map((directive) => ({
      title: `[${AGENT_LABELS[directive.agent] || directive.agent}] ${directive.action}`,
      description: `${directive.detail}\n\nBoss play: ${play.name}\nThesis: ${play.thesis}`,
      task_type: 'boss_directive',
      status: 'open',
      priority: directive.priority,
      metadata_json: {
        play_key: play.key,
        play_name: play.name,
        agent: directive.agent,
        dispatched_at: now,
        steps: play.steps,
      },
      created_by: adminCheck.user?.id || null,
    }))

    const { data: inserted, error } = await supabase.from('admin_tasks').insert(rows).select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      dispatched: inserted?.length || 0,
      skipped: 0,
      message: `Dispatched ${inserted?.length || 0} directive(s) for "${play.name}" to the operator task board.`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dispatch failed.' },
      { status: 500 }
    )
  }
}
