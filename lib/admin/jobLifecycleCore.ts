export type CommandCenterJobRow = {
  id: string
  job_key: string
  status: string
  last_status?: string | null
  last_run_at?: string | null
  locked_until?: string | null
  metrics_json?: Record<string, unknown> | null
  updated_at?: string | null
}

export const DEFAULT_STALE_JOB_AFTER_MS = 15 * 60 * 1000

export function buildRevenueLoopJobPayload(input: {
  status: 'active' | 'running' | 'failed'
  lastStatus: string
  runId: string
  now?: Date
  error?: string | null
  metrics?: Record<string, unknown>
}) {
  const now = input.now || new Date()
  return {
    job_key: 'seller-outreach-batch',
    job_type: 'seller_outreach_batch',
    title: 'Reconcile guarded revenue operations',
    status: input.status,
    cadence: '4 times daily',
    priority: 95,
    next_run_at: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    last_run_at: now.toISOString(),
    locked_until: input.status === 'running' ? new Date(now.getTime() + DEFAULT_STALE_JOB_AFTER_MS).toISOString() : null,
    last_status: input.lastStatus,
    last_error: input.error || null,
    metrics_json: { ...(input.metrics || {}), runId: input.runId },
    config_json: {
      controlPlaneOnly: true,
      sellerLane: '/api/cron/seller-followup',
      partnerLane: '/api/cron/partner-network-pipeline',
      mailboxLane: '/api/cron/mailbox-sync',
      guardedSend: 'delegated_to_dedicated_lanes',
    },
    updated_at: now.toISOString(),
  }
}

export function isStaleRunningJob(
  job: Pick<CommandCenterJobRow, 'status' | 'updated_at' | 'locked_until'>,
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_JOB_AFTER_MS
) {
  if (String(job.status || '').toLowerCase() !== 'running') return false
  const updatedAt = job.updated_at ? Date.parse(job.updated_at) : Number.NaN
  const lockedUntil = job.locked_until ? Date.parse(job.locked_until) : Number.NaN
  if (Number.isFinite(lockedUntil) && lockedUntil > now.getTime()) return false
  return !Number.isFinite(updatedAt) || now.getTime() - updatedAt >= staleAfterMs
}

export function staleJobRecoveryPatch(job: CommandCenterJobRow, now = new Date()) {
  const recoveredAt = now.toISOString()
  return {
    status: 'failed',
    last_status: 'stale_run_reconciled',
    last_error: `Job was still running after its lock expired and was safely reconciled at ${recoveredAt}.`,
    next_run_at: recoveredAt,
    locked_until: null,
    metrics_json: {
      ...(job.metrics_json || {}),
      staleRunReconciled: true,
      staleRunReconciledAt: recoveredAt,
      previousLastStatus: job.last_status || null,
      previousLastRunAt: job.last_run_at || null,
    },
    updated_at: recoveredAt,
  }
}
