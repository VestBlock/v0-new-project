import 'server-only'

import { randomUUID } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  deliveryModeRequiresBudget,
  normalizeDeliveryBudget,
  OUTREACH_DELIVERY_BUDGET_LIMIT,
} from '@/lib/outreach/deliveryBudgetCore'

const BUDGET_JOB_KEY = 'outreach-delivery-safety-budget'
const PERMIT_LOCK_MS = 2 * 60 * 1000

type BudgetRow = {
  id: string
  status: string
  locked_until?: string | null
  metrics_json?: Record<string, unknown> | null
  updated_at: string
}

export type OutreachDeliveryPermit = {
  allowed: boolean
  counted: boolean
  permitId?: string
  jobId?: string
  reason?: string
  attemptCount?: number
  remaining?: number
}

function baseJobPayload(now: Date) {
  return {
    job_key: BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Global outreach trial and canary send budget',
    status: 'active',
    cadence: 'rolling 24 hours',
    priority: 120,
    next_run_at: now.toISOString(),
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      maxAttempts: OUTREACH_DELIVERY_BUDGET_LIMIT,
      scope: 'all_outreach_lanes',
      countsPreSendAttempts: true,
    },
    metrics_json: {
      windowStartedAt: now.toISOString(),
      attemptCount: 0,
      attemptMarkers: [],
      activePermitId: null,
    },
    updated_at: now.toISOString(),
  }
}

async function loadOrCreateBudgetRow(now: Date) {
  const admin = createAdminClient()
  const load = () =>
    admin
      .from('command_center_jobs')
      .select('id,status,locked_until,metrics_json,updated_at')
      .eq('job_key', BUDGET_JOB_KEY)
      .maybeSingle()

  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as BudgetRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseJobPayload(now))
    .select('id,status,locked_until,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as BudgetRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error('Global outreach delivery budget row could not be initialized.')
  return raced.data as BudgetRow
}

export async function acquireOutreachDeliveryPermit(input: {
  mode: string
  scope: string
  messageId: string
  now?: Date
}): Promise<OutreachDeliveryPermit> {
  if (!deliveryModeRequiresBudget(input.mode)) return { allowed: true, counted: false }

  const now = input.now || new Date()
  const admin = createAdminClient()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const lockedUntil = row.locked_until ? Date.parse(row.locked_until) : Number.NaN
    if (row.status === 'running' && Number.isFinite(lockedUntil) && lockedUntil > now.getTime()) {
      return { allowed: false, counted: false, reason: 'global_delivery_budget_lock_busy' }
    }

    const normalized = normalizeDeliveryBudget(row.metrics_json, now)
    if (normalized.attemptCount >= OUTREACH_DELIVERY_BUDGET_LIMIT) {
      return {
        allowed: false,
        counted: false,
        reason: 'global_delivery_trial_budget_exhausted',
        attemptCount: normalized.attemptCount,
        remaining: 0,
      }
    }

    const permitId = randomUUID()
    const attemptCount = normalized.attemptCount + 1
    const metrics = {
      ...row.metrics_json,
      ...normalized,
      attemptCount,
      attemptMarkers: [
        ...normalized.attemptMarkers,
        {
          permitId,
          attemptedAt: now.toISOString(),
          mode: input.mode,
          scope: input.scope,
          messageId: input.messageId,
        },
      ].slice(-20),
      activePermitId: permitId,
    }
    const { data: claimed, error } = await admin
      .from('command_center_jobs')
      .update({
        status: 'running',
        locked_until: new Date(now.getTime() + PERMIT_LOCK_MS).toISOString(),
        last_run_at: now.toISOString(),
        last_status: `${input.mode}_attempt_reserved`,
        last_error: null,
        metrics_json: metrics,
        updated_at: now.toISOString(),
      })
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .or(`status.neq.running,locked_until.is.null,locked_until.lte.${now.toISOString()}`)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (claimed?.id) {
      return {
        allowed: true,
        counted: true,
        permitId,
        jobId: row.id,
        attemptCount,
        remaining: OUTREACH_DELIVERY_BUDGET_LIMIT - attemptCount,
      }
    }
  }

  return { allowed: false, counted: false, reason: 'global_delivery_budget_contention' }
}

export async function releaseOutreachDeliveryPermit(
  permit: OutreachDeliveryPermit,
  outcome: 'accepted' | 'failed' | 'not_sent'
) {
  if (!permit.counted || !permit.permitId || !permit.jobId) return
  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('command_center_jobs')
    .select('metrics_json')
    .eq('id', permit.jobId)
    .contains('metrics_json', { activePermitId: permit.permitId })
    .maybeSingle()
  if (readError) throw readError
  if (!row) return

  const now = new Date().toISOString()
  const { error } = await admin
    .from('command_center_jobs')
    .update({
      status: 'active',
      locked_until: null,
      last_status: `delivery_attempt_${outcome}`,
      metrics_json: {
        ...(row.metrics_json || {}),
        activePermitId: null,
        lastOutcome: outcome,
        lastReleasedAt: now,
      },
      updated_at: now,
    })
    .eq('id', permit.jobId)
    .contains('metrics_json', { activePermitId: permit.permitId })
  if (error) throw error
}
