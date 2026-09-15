import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  investorHunterBudgetDateKey,
  nextInvestorHunterCasTimestamp,
  reserveInvestorHunterBudget,
  type InvestorHunterBudgetMetrics,
} from '@/lib/investors/hunterBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

const INVESTOR_HUNTER_BUDGET_JOB_KEY = 'investor-hunter-daily-lookup-budget'
const MAX_RESERVATION_RETRIES = 5

type InvestorHunterBudgetRow = {
  id: string
  metrics_json: InvestorHunterBudgetMetrics | null
  updated_at: string
}

export type InvestorHunterLookupReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  remaining: number
}

function baseBudgetJob(now: Date) {
  return {
    job_key: INVESTOR_HUNTER_BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Investor Hunter paid lookup budget',
    status: 'active',
    cadence: 'daily budget only',
    priority: 115,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      scope: 'investor_hunter_enrichment',
      resetTimeZone: 'America/Chicago',
      countsPreRequestReservations: true,
    },
    metrics_json: {
      budgetDate: investorHunterBudgetDateKey(now),
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
      .eq('job_key', INVESTOR_HUNTER_BUDGET_JOB_KEY)
      .maybeSingle()

  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as InvestorHunterBudgetRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseBudgetJob(now))
    .select('id,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as InvestorHunterBudgetRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error('Investor Hunter lookup budget row could not be initialized.')
  return raced.data as InvestorHunterBudgetRow
}

export async function reserveInvestorHunterDailyLookup(input: {
  investorId: string
  claimId: string
  dailyLimit: number
  now?: Date
}): Promise<InvestorHunterLookupReservation> {
  const now = input.now || new Date()
  const reservationId = randomUUID()
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const decision = reserveInvestorHunterBudget({
      metrics: row.metrics_json,
      investorId: input.investorId,
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
        last_status: 'investor_hunter_lookup_reserved',
        last_error: null,
        metrics_json: {
          ...decision.metrics,
          budgetRevision: randomUUID(),
        },
        updated_at: nextInvestorHunterCasTimestamp(row.updated_at, now),
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
    reason: 'investor_hunter_budget_contention',
    attemptCount: 0,
    remaining: 0,
  }
}
