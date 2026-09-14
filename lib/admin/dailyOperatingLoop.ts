import 'server-only'

import { randomUUID } from 'node:crypto'

import { buildBossBriefing } from '@/lib/admin/bossAgent'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { syncOutlookMailbox } from '@/lib/email/outlookMailbox'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureKpiSnapshot, runBossRetrospective } from '@/lib/admin/selfImprovement'
import { loadOperatingLoopTelemetryFromDatabase, type OperatingLoopTelemetry } from '@/lib/admin/operatingLoops'
import { buildRevenueLoopJobPayload, reconcileStaleCommandCenterJobs } from '@/lib/admin/jobLifecycle'

export type DailyOperatingLoopResult = {
  dryRun: boolean
  dispatch: boolean
  send: boolean
  generatedAt: string
  retrospective: Awaited<ReturnType<typeof runBossRetrospective>>
  telemetry: OperatingLoopTelemetry
  mailbox: Awaited<ReturnType<typeof syncOutlookMailbox>>
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
    details?: {
      seller: unknown
      buyer: unknown
      lender: unknown
      investor: unknown
    }
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

async function recordRevenueLoopJob(input: {
  status: 'active' | 'running' | 'failed'
  lastStatus: string
  runId: string
  final?: boolean
  error?: string | null
  metrics?: Record<string, unknown>
}) {
  const now = new Date()
  const admin = createAdminClient()
  const payload = buildRevenueLoopJobPayload({ ...input, now })
  if (input.final) {
    const { data, error } = await admin
      .from('command_center_jobs')
      .update(payload)
      .eq('job_key', 'seller-outreach-batch')
      .contains('metrics_json', { runId: input.runId })
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data?.id) throw new Error(`Revenue loop ${input.runId} no longer owns the job lock.`)
    return true
  }

  const { data: claimed, error: claimError } = await admin
    .from('command_center_jobs')
    .update(payload)
    .eq('job_key', 'seller-outreach-batch')
    .or(`status.neq.running,locked_until.is.null,locked_until.lte.${now.toISOString()}`)
    .select('id')
    .maybeSingle()
  if (claimError) throw claimError
  if (claimed?.id) return true

  const { data: existing, error: lookupError } = await admin
    .from('command_center_jobs')
    .select('id,status,locked_until')
    .eq('job_key', 'seller-outreach-batch')
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return false

  const { error: insertError } = await admin.from('command_center_jobs').insert(payload)
  if (insertError?.code === '23505') return false
  if (insertError) throw insertError
  return true
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
  const sendRequested = Boolean(options.send && !dryRun && process.env.BOSS_DAILY_LOOP_ENABLE_SEND === 'true')
  const runId = randomUUID()
  let startRecorded = false
  let finalStatus: 'active' | 'failed' = 'failed'
  let finalLastStatus = 'failed'
  let finalError: string | null = 'Daily operating loop ended before completion.'
  let finalMetrics: Record<string, unknown> = { dryRun, dispatch, sendRequested, mode: 'control_plane_only' }

  await reconcileStaleCommandCenterJobs({ jobKey: 'seller-outreach-batch' }).catch((error) =>
    console.warn('[daily-operating-loop] stale job reconciliation failed:', error)
  )
  startRecorded = await recordRevenueLoopJob({
    status: 'running',
    lastStatus: dryRun ? 'dry_run_started' : 'live_run_started',
    runId,
    metrics: { dryRun, dispatch, sendRequested, mode: 'control_plane_only' },
  })
  if (!startRecorded) {
    throw new Error('The daily operating loop is already running under an active job lock.')
  }
  try {
    const mailbox = await syncOutlookMailbox({ dryRun, sinceHours: 72, limit: 50 })
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
    const telemetry = await loadOperatingLoopTelemetryFromDatabase({
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

    const sendAttempt: DailyOperatingLoopResult['sendAttempt'] = {
      attempted: false,
      ok: true,
      message: sendRequested
        ? 'Outbound execution is delegated to the dedicated seller and partner cron lanes so this control loop cannot time out or duplicate sends.'
        : dryRun
          ? 'Dry run only; no email sends attempted.'
          : 'Outbound execution is delegated to the dedicated seller and partner cron lanes.',
    }

    finalStatus = 'active'
    finalLastStatus = dryRun ? 'dry_run_completed' : 'completed'
    finalError = null
    finalMetrics = {
      dryRun,
      dispatch,
      sendRequested,
      mailboxConnected: mailbox.connected,
      directivesDispatched: dispatchResult.dispatched,
      sendAttempted: false,
      sendDelegated: true,
      focusKey: focus?.key || null,
      challengerKey: challenger?.key || null,
    }

    return {
      dryRun,
      dispatch,
      send: false,
      generatedAt: new Date().toISOString(),
      retrospective,
      telemetry,
      mailbox,
      boss: {
        focusKey: focus?.key || null,
        focusName: focus?.name || null,
        challengerKey: challenger?.key || null,
        challengerName: challenger?.name || null,
      },
      dispatchResult,
      sendAttempt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    finalError = message.slice(0, 500)
    finalMetrics = { dryRun, dispatch, sendRequested, mode: 'control_plane_only' }
    throw error
  } finally {
    if (startRecorded) {
      await recordRevenueLoopJob({
        status: finalStatus,
        lastStatus: finalLastStatus,
        runId,
        final: true,
        error: finalError,
        metrics: finalMetrics,
      })
    }
  }
}
