import 'server-only'

import { buildBossBriefing } from '@/lib/admin/bossAgent'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { runDailyLenderPipeline } from '@/lib/lenders/automation'
import { getOutlookMailboxStatus, syncOutlookMailbox } from '@/lib/email/outlookMailbox'
import { runLeadThroughputSprint } from '@/lib/leads/dailyAutomation'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureKpiSnapshot, runBossRetrospective } from '@/lib/admin/selfImprovement'
import { loadOperatingLoopTelemetryFromDatabase, type OperatingLoopTelemetry } from '@/lib/admin/operatingLoops'

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

function envInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

async function recordRevenueLoopJob(input: {
  status: 'active' | 'running' | 'failed'
  lastStatus: string
  error?: string | null
  metrics?: Record<string, unknown>
}) {
  const now = new Date()
  const admin = createAdminClient()
  const { error } = await admin.from('command_center_jobs').upsert(
    {
      job_key: 'seller-outreach-batch',
      job_type: 'seller_outreach_batch',
      title: 'Run guarded seller and partner revenue lanes',
      status: input.status,
      cadence: '4 times daily',
      priority: 95,
      next_run_at: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      last_run_at: now.toISOString(),
      last_status: input.lastStatus,
      last_error: input.error || null,
      metrics_json: input.metrics || {},
      config_json: {
        sellerLimit: envInt('BOSS_SELLER_SEND_LIMIT_PER_RUN', 35),
        buyerLimit: envInt('BUYERS_SEND_LIMIT_PER_RUN', 10),
        lenderLimit: envInt('LENDERS_DAILY_SEND_LIMIT', 15),
        investorLimit: envInt('INVESTORS_DAILY_SEND_LIMIT', 20),
        guardedSend: true,
      },
      updated_at: now.toISOString(),
    },
    { onConflict: 'job_key' }
  )
  if (error) throw error
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
  syncMailbox?: boolean
  createdByUserId?: string | null
} = {}): Promise<DailyOperatingLoopResult> {
  const dryRun = options.dryRun !== false
  const dispatch = Boolean(options.dispatch && !dryRun)
  const send = Boolean(options.send && !dryRun && process.env.BOSS_DAILY_LOOP_ENABLE_SEND === 'true')
  const syncMailbox = options.syncMailbox !== false
  await recordRevenueLoopJob({
    status: 'running',
    lastStatus: dryRun ? 'dry_run_started' : 'live_run_started',
    metrics: { dryRun, dispatch, send, syncMailbox },
  }).catch((error) => console.warn('[daily-operating-loop] job start was not recorded:', error))
  const mailbox = syncMailbox
    ? await syncOutlookMailbox({ dryRun, sinceHours: 72, limit: 50 })
    : {
        ok: true,
        connected: false,
        ...getOutlookMailboxStatus(),
        fetched: 0,
        stored: 0,
        classifications: {},
        skipped: true,
      }
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
    const [seller, buyer, lender, investor] = await Promise.allSettled([
      runLeadThroughputSprint({
        dryRun: false,
        sendLimit: envInt('BOSS_SELLER_SEND_LIMIT_PER_RUN', 35),
        budgetMs: envInt('BOSS_SELLER_BUDGET_MS', 75_000),
      }),
      runDailyBuyerPipeline({ dryRun: false }),
      runDailyLenderPipeline({ dryRun: false }),
      runDailyInvestorPipeline({ dryRun: false }),
    ])
    const sellerOk = seller.status === 'fulfilled' && seller.value.ok
    const buyerOk = buyer.status === 'fulfilled' && buyer.value.ok
    const lenderOk = lender.status === 'fulfilled' && lender.value.ok
    const investorOk = investor.status === 'fulfilled' && investor.value.ok
    const sellerDetail = seller.status === 'fulfilled'
      ? seller.value
      : { ok: false, error: seller.reason instanceof Error ? seller.reason.message : String(seller.reason) }
    const buyerDetail = buyer.status === 'fulfilled'
      ? buyer.value
      : { ok: false, error: buyer.reason instanceof Error ? buyer.reason.message : String(buyer.reason) }
    const lenderDetail = lender.status === 'fulfilled'
      ? lender.value
      : { ok: false, error: lender.reason instanceof Error ? lender.reason.message : String(lender.reason) }
    const investorDetail = investor.status === 'fulfilled'
      ? investor.value
      : { ok: false, error: investor.reason instanceof Error ? investor.reason.message : String(investor.reason) }
    sendAttempt = {
      attempted: true,
      ok: sellerOk && buyerOk && lenderOk && investorOk,
      message: sellerOk && buyerOk && lenderOk && investorOk
        ? 'Seller, buyer, lender, and investor revenue lanes completed with their configured caps.'
        : 'The revenue loop completed partially. Review the returned seller and partner stage results.',
      details: { seller: sellerDetail, buyer: buyerDetail, lender: lenderDetail, investor: investorDetail },
    }
  }

  await recordRevenueLoopJob({
    status: sendAttempt.ok ? 'active' : 'failed',
    lastStatus: dryRun ? 'dry_run_completed' : sendAttempt.ok ? 'completed' : 'partial',
    error: sendAttempt.ok ? null : sendAttempt.message,
    metrics: {
      dryRun,
      dispatch,
      send,
      mailboxConnected: mailbox.connected,
      directivesDispatched: dispatchResult.dispatched,
      sendAttempted: sendAttempt.attempted,
      sendOk: sendAttempt.ok,
      focusKey: focus?.key || null,
      challengerKey: challenger?.key || null,
    },
  }).catch((error) => console.warn('[daily-operating-loop] job completion was not recorded:', error))

  return {
    dryRun,
    dispatch,
    send,
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
}
