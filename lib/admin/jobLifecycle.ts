import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_STALE_JOB_AFTER_MS,
  isStaleRunningJob,
  staleJobRecoveryPatch,
  type CommandCenterJobRow,
} from '@/lib/admin/jobLifecycleCore'

export * from '@/lib/admin/jobLifecycleCore'

export async function reconcileStaleCommandCenterJobs(options: {
  jobKey?: string
  now?: Date
  staleAfterMs?: number
} = {}) {
  const now = options.now || new Date()
  const staleAfterMs = options.staleAfterMs || DEFAULT_STALE_JOB_AFTER_MS
  const cutoff = new Date(now.getTime() - staleAfterMs).toISOString()
  const admin = createAdminClient()
  let query = admin
    .from('command_center_jobs')
    .select('id,job_key,status,last_status,last_run_at,locked_until,metrics_json,updated_at')
    .eq('status', 'running')
    .lt('updated_at', cutoff)
  if (options.jobKey) query = query.eq('job_key', options.jobKey)

  const { data, error } = await query.limit(100)
  if (error) throw error

  let reconciled = 0
  for (const rawJob of data || []) {
    const job = rawJob as CommandCenterJobRow
    if (!isStaleRunningJob(job, now, staleAfterMs)) continue
    const { data: updated, error: updateError } = await admin
      .from('command_center_jobs')
      .update(staleJobRecoveryPatch(job, now))
      .eq('id', job.id)
      .eq('status', 'running')
      .lt('updated_at', cutoff)
      .or(`locked_until.is.null,locked_until.lte.${now.toISOString()}`)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (updated?.id) reconciled += 1
  }

  return { examined: data?.length || 0, reconciled, cutoff }
}
