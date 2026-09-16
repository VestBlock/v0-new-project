import 'server-only'

import type { OutreachThroughputGovernorDecision } from '@/lib/outreach/throughputGovernorCore'
import {
  deriveOutreachDispatchCapacity,
  type OutreachDispatchCapacity,
} from '@/lib/outreach/outreachDispatchCapacityCore'
import {
  inspectOutlookColdBudget,
  seedOutlookColdBudget,
  type OutlookColdBudgetMetrics,
} from '@/lib/outreach/outlookColdBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

export type { OutreachDispatchCapacity } from '@/lib/outreach/outreachDispatchCapacityCore'

const OUTLOOK_COLD_BUDGET_JOB_KEY = 'outlook-cold-b2b-rolling-budget'

/** Reads the same rolling Outlook budget used by the atomic provider reservation. */
export async function readOutreachDispatchCapacity(
  decision: OutreachThroughputGovernorDecision,
  now = new Date()
): Promise<OutreachDispatchCapacity> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('command_center_jobs')
    .select('metrics_json')
    .eq('job_key', OUTLOOK_COLD_BUDGET_JOB_KEY)
    .maybeSingle()
  if (error) throw error

  // A missing row is the same empty state the first atomic reservation will
  // initialize. A present but malformed row still fails closed in inspection.
  const metrics = data
    ? (data.metrics_json as OutlookColdBudgetMetrics | null)
    : seedOutlookColdBudget()
  const inspection = inspectOutlookColdBudget(metrics, now)
  if (!inspection.valid) {
    throw new Error(`Outlook cold budget inspection failed (${inspection.reason || 'invalid_state'}).`)
  }
  return deriveOutreachDispatchCapacity(inspection, decision)
}
