import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  buyerHunterBudgetDateKey,
  nextHunterCasTimestamp,
  reserveBuyerHunterBudget,
  type BuyerHunterBudgetMetrics,
} from '@/lib/buyers/hunterBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

const BUYER_HUNTER_BUDGET_JOB_KEY = 'buyer-hunter-daily-lookup-budget'
const MAX_RESERVATION_RETRIES = 5

type BuyerHunterBudgetRow = {
  id: string
  metrics_json: BuyerHunterBudgetMetrics | null
  updated_at: string
}

export type BuyerHunterLookupReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  remaining: number
}

function baseBudgetJob(now: Date) {
  const budgetDate = buyerHunterBudgetDateKey(now)
  return {
    job_key: BUYER_HUNTER_BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Buyer Hunter paid lookup budget',
    status: 'active',
    cadence: 'daily budget only',
    priority: 115,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      scope: 'buyer_hunter_enrichment',
      resetTimeZone: 'America/Chicago',
      countsPreRequestReservations: true,
    },
    metrics_json: {
      budgetDate,
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
      .eq('job_key', BUYER_HUNTER_BUDGET_JOB_KEY)
      .maybeSingle()

  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as BuyerHunterBudgetRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseBudgetJob(now))
    .select('id,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as BuyerHunterBudgetRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error('Buyer Hunter lookup budget row could not be initialized.')
  return raced.data as BuyerHunterBudgetRow
}

export async function reserveBuyerHunterDailyLookup(input: {
  buyerId: string
  claimId: string
  dailyLimit: number
  now?: Date
}): Promise<BuyerHunterLookupReservation> {
  const now = input.now || new Date()
  const reservationId = randomUUID()
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const decision = reserveBuyerHunterBudget({
      metrics: row.metrics_json,
      buyerId: input.buyerId,
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

    const updatedAt = nextHunterCasTimestamp(row.updated_at, now)
    const { data: reserved, error } = await admin
      .from('command_center_jobs')
      .update({
        status: 'active',
        last_run_at: now.toISOString(),
        last_status: 'buyer_hunter_lookup_reserved',
        last_error: null,
        metrics_json: {
          ...decision.metrics,
          budgetRevision: randomUUID(),
        },
        updated_at: updatedAt,
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
    reason: 'buyer_hunter_budget_contention',
    attemptCount: 0,
    remaining: 0,
  }
}
