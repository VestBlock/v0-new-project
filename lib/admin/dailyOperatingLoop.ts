import 'server-only'

import { spawnSync } from 'node:child_process'

import { buildBossBriefing } from '@/lib/admin/bossAgent'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureKpiSnapshot, runBossRetrospective } from '@/lib/admin/selfImprovement'
import { loadOperatingLoopTelemetry, type OperatingLoopTelemetry } from '@/lib/admin/operatingLoops'

export type DailyOperatingLoopResult = {
  dryRun: boolean
  dispatch: boolean
  send: boolean
  generatedAt: string
  retrospective: Awaited<ReturnType<typeof runBossRetrospective>>
  telemetry: OperatingLoopTelemetry
  boss: {
    focusKey: string | null
    focusName: string | null
    challengerKey: string | null
    challengerName: string | null
  }
  dispatchResult: {
    attempted: boolean
    dispatched: number
    skipped: number
    message: string
  }
  sendAttempt: {
    attempted: boolean
    ok: boolean
    message: string
  }
}

const AGENT_LABELS: Record<string, string> = {
  acquisition: 'Lead Acquisition',
  outreach: 'Outreach',
  routing: 'Deal Routing',
  underwriting: 'Underwriting & Capital',
  authority: 'Authority Engine',
  qa: 'QA / Funnel Health',
  operator: 'Operator Intelligence',
}

function runNodeScript(script: string, args: string[]) {
  const result = spawnSync(process.execPath, ['--env-file=.env.local', script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

async function dispatchBossPlay(playKey: string, createdByUserId: string | null) {
  const data = await getCommandCenterData()
  const briefing = buildBossBriefing(data)
  const play = briefing.plays.find((item) => item.key === playKey)
  if (!play) {
    return { attempted: true, dispatched: 0, skipped: 0, message: `Unknown Boss play: ${playKey}` }
  }

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('admin_tasks')
    .select('id,metadata_json,status')
    .eq('task_type', 'boss_directive')
    .not('status', 'in', '("completed","dismissed")')
    .limit(200)

  if (existingError) {
    return { attempted: true, dispatched: 0, skipped: play.directives.length, message: existingError.message }
  }

  const openForPlay = (existing || []).filter(
    (task) => (task.metadata_json as Record<string, unknown> | null)?.play_key === playKey
  )
  if (openForPlay.length) {
    return {
      attempted: true,
      dispatched: 0,
      skipped: play.directives.length,
      message: `"${play.name}" already has ${openForPlay.length} open directive task(s).`,
    }
  }

  const now = new Date().toISOString()
  const kpiBefore = captureKpiSnapshot(data)
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
      kpi_before: kpiBefore,
      steps: play.steps,
      dispatched_by_loop: 'daily_operating_loop',
    },
    created_by: createdByUserId,
  }))

  const { data: inserted, error } = await admin.from('admin_tasks').insert(rows).select('id')
  if (error) {
    return { attempted: true, dispatched: 0, skipped: play.directives.length, message: error.message }
  }

  return {
    attempted: true,
    dispatched: inserted?.length || 0,
    skipped: 0,
    message: `Dispatched ${inserted?.length || 0} directive(s) for "${play.name}".`,
  }
}

export async function runDailyOperatingLoop(options: {
  dryRun?: boolean
  dispatch?: boolean
  send?: boolean
  createdByUserId?: string | null
} = {}): Promise<DailyOperatingLoopResult> {
  const dryRun = options.dryRun !== false
  const dispatch = Boolean(options.dispatch && !dryRun)
  const send = Boolean(options.send && !dryRun && process.env.BOSS_DAILY_LOOP_ENABLE_SEND === 'true')
  const data = await getCommandCenterData()
  const retrospective = dryRun
    ? {
        reviewed: 0,
        lessons: [],
        message: 'Dry run only; retrospective learning was not written.',
      }
    : await runBossRetrospective(data)
  const briefing = buildBossBriefing(data)
  const focus = briefing.plays.find((play) => play.key === briefing.focusKey) || briefing.plays[0] || null
  const challenger = briefing.plays.find((play) => play.key !== focus?.key) || null
  const telemetry = loadOperatingLoopTelemetry({
    sentToday: data.strategyLab.sentToday,
    remainingToday: data.strategyLab.remainingToday,
    replySignals7d: data.strategyLab.replySignals7d,
    emailReady: data.strategyLab.emailReady,
    needsReview: data.strategyLab.needsReview,
    focusStrategyKey: focus?.key || null,
    challengerStrategyKey: challenger?.key || null,
    followupsDue: data.outboundControl.followupsDue,
    activeSuppressionCount: data.suppressionCenter.activeCount,
    missingSuppressionDb: data.suppressionCenter.missingDb,
    buyerDemandSignals: data.summary.activePartners + data.summary.builderPartners,
    pendingMatches: data.routingQueue.reduce((sum, item) => sum + item.count, 0),
    partnerBuyBoxesConfirmed: data.summary.partnerBuyBoxesConfirmed,
    partnerResearchReady: data.summary.partnerResearchReady,
    partnerOutreachReady: data.summary.partnerOutreachReady,
    partnerDiscoveryRuns7d: data.summary.partnerDiscoveryRuns7d,
    failedPartnerRuns7d: data.summary.failedPartnerRuns7d,
    sourceFreshCount: data.dealMachineFreshness.freshCount,
    sourceStaleCount: data.dealMachineFreshness.staleCount,
    staleExportCount: data.dealMachineFreshness.staleCount,
    staleExportTotal: data.localSignals.dmExports.length,
    activeDirectiveCount: data.strategyLab.activeDirectiveCount,
    overdueTaskCount: data.overdueTasks.length,
    urgentTaskCount: data.summary.urgentTasks,
    openTaskCount: data.summary.openTasks,
    legacyDraftCount: data.summary.hiddenLegacyDrafts,
    archivedLegacyRuntimeRows: data.summary.archivedLegacyRuntimeRows,
    analyzerOutcomeCount: data.dealMemory.totalAnalyses,
  })

  const dispatchResult =
    dispatch && focus
      ? await dispatchBossPlay(focus.key, options.createdByUserId || null)
      : {
          attempted: false,
          dispatched: 0,
          skipped: focus ? focus.directives.length : 0,
          message: dryRun
            ? 'Dry run only; no Boss directives dispatched.'
            : 'Dispatch disabled for this run.',
        }

  let sendAttempt: DailyOperatingLoopResult['sendAttempt'] = {
    attempted: false,
    ok: true,
    message: send
      ? 'Send gate open, but no send lane was attempted.'
      : dryRun
        ? 'Dry run only; no email sends attempted.'
        : 'Live send disabled. Set BOSS_DAILY_LOOP_ENABLE_SEND=true and pass send=true to allow configured cap sends.',
  }

  if (send) {
    const result = runNodeScript('scripts/seller-outreach-autopilot.mjs', ['--send'])
    sendAttempt = {
      attempted: true,
      ok: result.ok,
      message: result.ok ? 'Seller outreach autopilot ran with the configured cap.' : result.stderr || 'Seller outreach autopilot failed.',
    }
  }

  return {
    dryRun,
    dispatch,
    send,
    generatedAt: new Date().toISOString(),
    retrospective,
    telemetry,
    boss: {
      focusKey: focus?.key || null,
      focusName: focus?.name || null,
      challengerKey: challenger?.key || null,
      challengerName: challenger?.name || null,
    },
    dispatchResult,
    sendAttempt,
  }
}
