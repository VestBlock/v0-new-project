import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  lenderHunterBudgetDateKey,
  nextLenderHunterCasTimestamp,
  reserveLenderHunterBudget,
  type LenderHunterBudgetMetrics,
} from '@/lib/lenders/hunterBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

const LENDER_HUNTER_BUDGET_JOB_KEY = 'lender-hunter-daily-lookup-budget'
const MAX_RESERVATION_RETRIES = 5

type LenderHunterBudgetRow = {
  id: string
  metrics_json: LenderHunterBudgetMetrics | null
  updated_at: string
}

export type LenderHunterLookupReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  remaining: number
}

function baseBudgetJob(now: Date) {
  return {
    job_key: LENDER_HUNTER_BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Lender Hunter paid lookup budget',
    status: 'active',
    cadence: 'daily budget only',
    priority: 115,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      scope: 'lender_hunter_enrichment',
      resetTimeZone: 'America/Chicago',
      countsPreRequestReservations: true,
    },
    metrics_json: {
      budgetDate: lenderHunterBudgetDateKey(now),
      attemptCount: 0,
      attemptMarkers: [],
      budgetRevision: randomUUID(),
    },
    updated_at: now.toISOString(),
  }
}

async function loadOrCreateBudgetRow(now: Date) {
  const admin = createAdminClient()
  const load = () =>
    admin
      .from('command_center_jobs')
      .select('id,metrics_json,updated_at')
      .eq('job_key', LENDER_HUNTER_BUDGET_JOB_KEY)
      .maybeSingle()

  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as LenderHunterBudgetRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseBudgetJob(now))
    .select('id,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as LenderHunterBudgetRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error('Lender Hunter lookup budget row could not be initialized.')
  return raced.data as LenderHunterBudgetRow
}

export async function reserveLenderHunterDailyLookup(input: {
  lenderId: string
  claimId: string
  dailyLimit: number
  now?: Date
}): Promise<LenderHunterLookupReservation> {
  const now = input.now || new Date()
  const reservationId = randomUUID()
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const decision = reserveLenderHunterBudget({
      metrics: row.metrics_json,
      lenderId: input.lenderId,
      claimId: input.claimId,
      reservationId,
      dailyLimit: input.dailyLimit,
      now,
    })

    if (!decision.allowed) {
      return {
        allowed: false,
        reason: decision.reason,
        attemptCount: decision.attemptCount,
        remaining: decision.remaining,
      }
    }

    const { data: reserved, error } = await admin
      .from('command_center_jobs')
      .update({
        status: 'active',
        last_run_at: now.toISOString(),
        last_status: 'lender_hunter_lookup_reserved',
        last_error: null,
        metrics_json: {
          ...decision.metrics,
          budgetRevision: randomUUID(),
        },
        updated_at: nextLenderHunterCasTimestamp(row.updated_at, now),
      })
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (reserved?.id) {
      return {
        allowed: true,
        reason: null,
        reservationId,
        attemptCount: decision.attemptCount,
        remaining: decision.remaining,
      }
    }
  }

  return {
    allowed: false,
    reason: 'lender_hunter_budget_contention',
    attemptCount: 0,
    remaining: 0,
  }
}
