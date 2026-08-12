import 'server-only'

import crypto from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { recordCommandCenterEvent } from '@/lib/admin/dealMemory'
import { runStrategyExecutionEngine, type StrategyExecutionResult } from '@/lib/admin/strategyExecutionEngine'
import {
  DEFAULT_AUTOPILOT_JOBS,
  buildAutopilotSnapshot,
  type AutopilotJobDefinition,
  type AutopilotReplyMemoryRow,
  type AutopilotRunRow,
  type AutopilotSnapshot,
  type AutopilotSnapshotInput,
} from '@/lib/admin/autonomousOperatingCore'

type AnyData = Record<string, any>

export type AutopilotPersistResult = {
  attempted: boolean
  dbWritable: boolean
  jobsSeeded: number
  strategyRunsWritten: number
  replyMemoriesWritten: number
  suppressionDecisionsWritten: number
  eventWritten: boolean
  warning?: string
}

export type CommandCenterAutopilotRunResult = {
  dryRun: boolean
  dispatch: boolean
  send: boolean
  generatedAt: string
  snapshot: AutopilotSnapshot
  execution: StrategyExecutionResult | null
  persist: AutopilotPersistResult
  sendAttempt: {
    attempted: boolean
    ok: boolean
    message: string
  }
}

function isoAddHours(hours: number, from = new Date()) {
  return new Date(from.getTime() + hours * 36e5).toISOString()
}

function nextRunHours(jobType: AutopilotJobDefinition['jobType']) {
  if (jobType === 'daily_strategy_plan') return 24
  if (jobType === 'source_rotation') return 6
  if (jobType === 'deal_routing_sync') return 12
  return 1
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function hashRecipient(value: unknown) {
  const normalized = normalizeEmail(value)
  if (!normalized) return null
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function commandDataToAutopilotInput(data: AnyData, extra: {
  jobs?: AnyData[]
  strategyRuns?: AutopilotRunRow[]
  replyMemory?: AutopilotReplyMemoryRow[]
  suppressionDecisions?: AnyData[]
} = {}): AutopilotSnapshotInput {
  return {
    remainingToday: Number(data?.outboundControl?.remainingToday || 0),
    sentToday: Number(data?.outboundControl?.sent24h || data?.strategyLab?.sentToday || 0),
    emailReady: Number(data?.outboundControl?.emailReady || data?.strategyLab?.emailReady || 0),
    needsReview: Number(data?.outboundControl?.needsReview || data?.strategyLab?.needsReview || 0),
    followupsDue: Number(data?.outboundControl?.followupsDue || 0),
    replySignals7d: Number(data?.strategyLab?.replySignals7d || data?.summary?.replySignals7d || 0),
    partnerBuyBoxesConfirmed: Number(data?.summary?.partnerBuyBoxesConfirmed || 0),
    sellerLeads: Number(data?.summary?.newLeads24h || 0),
    activeSuppressionCount: Number(data?.suppressionCenter?.activeCount || 0),
    missingSuppressionDb: Boolean(data?.suppressionCenter?.missingDb),
    sourceLanes: Array.isArray(data?.sourceGovernor?.lanes) ? data.sourceGovernor.lanes : [],
    marketHeat: Array.isArray(data?.marketHeat) ? data.marketHeat : [],
    nextRefreshMarkets: Array.isArray(data?.dealMachineFreshness?.nextRefreshMarkets)
      ? data.dealMachineFreshness.nextRefreshMarkets
      : [],
    campaigns: Array.isArray(data?.operatingLoops?.campaigns) ? data.operatingLoops.campaigns : [],
    jobs: extra.jobs,
    strategyRuns: extra.strategyRuns,
    replyMemory: extra.replyMemory,
    suppressionDecisions: extra.suppressionDecisions,
  }
}

function upsertJobPayload(job: AutopilotJobDefinition, now: string) {
  return {
    job_key: job.jobKey,
    job_type: job.jobType,
    title: job.title,
    status: 'active',
    cadence: job.cadence,
    priority: job.priority,
    strategy_key: job.strategyKey || null,
    source_provider: job.sourceProvider || null,
    market: job.market || null,
    next_run_at: now,
    config_json: job.config,
    updated_at: now,
  }
}

async function seedAutopilotJobs(now: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('command_center_jobs')
    .upsert(DEFAULT_AUTOPILOT_JOBS.map((job) => upsertJobPayload(job, now)), { onConflict: 'job_key' })
    .select('id,job_key,job_type,title,status,cadence,priority,next_run_at,last_run_at,last_status,last_error,config_json,metrics_json')

  if (error) throw error
  return data || []
}

async function updateAutopilotJobs(now: string, status: string, metrics: Record<string, unknown>) {
  const admin = createAdminClient()
  const rows = DEFAULT_AUTOPILOT_JOBS.map((job) => ({
    job_key: job.jobKey,
    job_type: job.jobType,
    title: job.title,
    status: 'active',
    cadence: job.cadence,
    priority: job.priority,
    strategy_key: job.strategyKey || null,
    source_provider: job.sourceProvider || null,
    market: job.market || null,
    next_run_at: isoAddHours(nextRunHours(job.jobType)),
    last_run_at: now,
    last_status: status,
    metrics_json: metrics,
    config_json: job.config,
    updated_at: now,
  }))
  const { error } = await admin.from('command_center_jobs').upsert(rows, { onConflict: 'job_key' })
  if (error) throw error
}

function suppressionDecisionRows(data: AnyData, now: string) {
  const suppressions = [
    ...(Array.isArray(data?.suppressionCenter?.recent) ? data.suppressionCenter.recent : []),
    ...(Array.isArray(data?.localSignals?.suppressionRecords) ? data.localSignals.suppressionRecords : []),
  ]
  const seen = new Set<string>()
  return suppressions
    .map((item) => {
      const email = normalizeEmail(item?.email)
      if (!email || seen.has(email)) return null
      seen.add(email)
      return {
        strategy_key: 'global-suppression',
        channel: 'email',
        matched_value: email,
        decision: 'blocked',
        reason: String(item?.reason || 'suppression'),
        metadata_json: {
          source: item?.source || 'command_center',
          propertyAddress: item?.propertyAddress || null,
          observedAt: item?.createdAt || now,
        },
      }
    })
    .filter(Boolean)
    .slice(0, 50) as Record<string, unknown>[]
}

async function persistAutopilotRun(
  data: AnyData,
  snapshot: AutopilotSnapshot,
  options: { dryRun: boolean; strategyRunsWritten: number }
) {
  const now = new Date().toISOString()
  const result: AutopilotPersistResult = {
    attempted: true,
    dbWritable: false,
    jobsSeeded: 0,
    strategyRunsWritten: 0,
    replyMemoriesWritten: 0,
    suppressionDecisionsWritten: 0,
    eventWritten: false,
  }

  try {
    const jobs = await seedAutopilotJobs(now)
    result.jobsSeeded = jobs.length

    const admin = createAdminClient()
    result.strategyRunsWritten = options.strategyRunsWritten

    // Real mailbox messages are written by the Microsoft Graph sync. Copying
    // command-center cards back into reply memory manufactured duplicate
    // "replies" and made the inbox look connected when it was not.

    const suppressionRows = suppressionDecisionRows(data, now)
    if (suppressionRows.length) {
      const { data: inserted, error } = await admin
        .from('command_center_suppression_decisions')
        .insert(suppressionRows)
        .select('id')
      if (error) throw error
      result.suppressionDecisionsWritten = inserted?.length || 0
    }

    await updateAutopilotJobs(now, options.dryRun ? 'dry_run' : 'planned', {
      mode: snapshot.mode,
      status: snapshot.status,
      strategyRunsWritten: result.strategyRunsWritten,
      replyMemoriesWritten: result.replyMemoriesWritten,
      suppressionDecisionsWritten: result.suppressionDecisionsWritten,
    })

    const eventResult = await recordCommandCenterEvent({
      eventType: 'command_center_autopilot_run',
      entityType: 'command_center',
      entityId: 'autopilot',
      source: 'command_center_autopilot',
      title: options.dryRun ? 'Autopilot dry run completed' : 'Autopilot plan dispatched',
      summary: snapshot.nextMove,
      priority: snapshot.status === 'red' ? 'critical' : snapshot.status === 'yellow' ? 'warning' : 'info',
      metadata: {
        mode: snapshot.mode,
        status: snapshot.status,
        batches: snapshot.batches.map((batch) => ({
          strategyKey: batch.strategyKey,
          targetEmailCount: batch.targetEmailCount,
          markets: batch.markets,
          blockedReason: batch.blockedReason,
        })),
      },
    })
    result.eventWritten = eventResult.localWritten || eventResult.dbWritten
    result.dbWritable = true
    return result
  } catch (error) {
    result.warning = error instanceof Error ? error.message : String(error)
    return result
  }
}

export function buildCommandCenterAutopilotSnapshot(data: AnyData, extra: {
  jobs?: AnyData[]
  strategyRuns?: AutopilotRunRow[]
  replyMemory?: AutopilotReplyMemoryRow[]
  suppressionDecisions?: AnyData[]
} = {}) {
  return buildAutopilotSnapshot(commandDataToAutopilotInput(data, extra))
}

export async function runCommandCenterAutopilot(
  data: AnyData,
  options: {
    dryRun?: boolean
    dispatch?: boolean
    send?: boolean
  } = {}
): Promise<CommandCenterAutopilotRunResult> {
  const dryRun = options.dryRun !== false
  const dispatch = Boolean(options.dispatch && !dryRun)
  const requestedSend = Boolean(options.send && !dryRun)
  const snapshot = buildCommandCenterAutopilotSnapshot(data)
  const execution = dispatch || dryRun
    ? await runStrategyExecutionEngine({ dryRun: !dispatch, syncDealMachine: true })
    : null
  const persist = dispatch || dryRun ? await persistAutopilotRun(data, snapshot, {
    dryRun,
    strategyRunsWritten: execution?.laneRuns.length || 0,
  }) : {
    attempted: false,
    dbWritable: false,
    jobsSeeded: 0,
    strategyRunsWritten: 0,
    replyMemoriesWritten: 0,
    suppressionDecisionsWritten: 0,
    eventWritten: false,
  }

  const liveSendEnabled = process.env.COMMAND_CENTER_AUTOPILOT_ENABLE_SEND === 'true'
  const sendAttempt =
    requestedSend && liveSendEnabled
      ? {
          attempted: true,
          ok: false,
          message:
            'Live send handoff is intentionally delegated to the existing seller outreach sender; use the command-center cap sprint once this dry plan is reviewed.',
        }
      : {
          attempted: requestedSend,
          ok: !requestedSend,
          message: requestedSend
            ? 'Live send blocked. Set COMMAND_CENTER_AUTOPILOT_ENABLE_SEND=true after reviewing the planned batches.'
            : 'Autopilot planned durable jobs and batches without live sending.',
        }

  return {
    dryRun,
    dispatch,
    send: requestedSend && liveSendEnabled,
    generatedAt: new Date().toISOString(),
    snapshot,
    execution,
    persist,
    sendAttempt,
  }
}

export { hashRecipient }
