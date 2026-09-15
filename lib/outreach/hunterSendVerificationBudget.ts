import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import {
  HUNTER_SEND_VERIFICATION_DAILY_HARD_LIMIT,
  hashHunterVerificationEmail,
} from '@/lib/outreach/hunterSendVerificationCore'
import {
  leadHunterBudgetDateKey,
  nextLeadHunterBudgetCasTimestamp,
  reserveLeadHunterBudget,
  type LeadHunterBudgetMetrics,
} from '@/lib/outreach/hunterSendVerificationBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

const HUNTER_SEND_VERIFICATION_BUDGET_JOB_KEY = 'hunter-send-verification-budget'
const MAX_RESERVATION_RETRIES = 5

type BudgetRow = {
  id: string
  metrics_json: LeadHunterBudgetMetrics | null
  updated_at: string
}

export type HunterSendVerificationReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  remaining: number
}

export type HunterSendVerificationScope =
  | 'lead'
  | 'buyer'
  | 'lender'
  | 'investor'
  | 'lender_canary'

function claimHash(messageId: string, email: string) {
  return createHash('sha256')
    .update(`${String(messageId).trim()}:${hashHunterVerificationEmail(email)}`)
    .digest('hex')
}

function baseBudgetJob(now: Date) {
  return {
    job_key: HUNTER_SEND_VERIFICATION_BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Hunter pre-send verification budget',
    status: 'active',
    cadence: 'daily budget only',
    priority: 120,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      scope: 'all_first_touch_and_recovery_canary_verification',
      resetTimeZone: 'America/Chicago',
      countsPreRequestReservations: true,
      storesHashedAddressesOnly: true,
    },
    metrics_json: {
      budgetDate: leadHunterBudgetDateKey(now),
      attemptCount: 0,
      attemptMarkers: [],
      budgetRevision: randomUUID(),
    },
    updated_at: now.toISOString(),
  }
}

async function loadOrCreateBudgetRow(now: Date) {
  const admin = createAdminClient()
  const load = () => admin
      .from('command_center_jobs')
      .select('id,metrics_json,updated_at')
      .eq('job_key', HUNTER_SEND_VERIFICATION_BUDGET_JOB_KEY)
    .maybeSingle()
  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as BudgetRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseBudgetJob(now))
    .select('id,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as BudgetRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error('Hunter send-verification budget row could not be initialized.')
  return raced.data as BudgetRow
}

export async function reserveHunterSendVerification(input: {
  scope: HunterSendVerificationScope
  messageId: string
  email: string
  dailyLimit: number
  now?: Date
}): Promise<HunterSendVerificationReservation> {
  const now = input.now || new Date()
  const reservationId = randomUUID()
  const emailHash = hashHunterVerificationEmail(input.email)
  const hashedClaim = claimHash(`${input.scope}:${input.messageId}`, input.email)
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const decision = reserveLeadHunterBudget({
      metrics: row.metrics_json,
      claimHash: hashedClaim,
      emailHash,
      reservationId,
      dailyLimit: input.dailyLimit,
      dailyHardLimit: HUNTER_SEND_VERIFICATION_DAILY_HARD_LIMIT,
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
        last_status: `${input.scope}_hunter_verification_reserved`,
        last_error: null,
        metrics_json: { ...decision.metrics, budgetRevision: randomUUID() },
        updated_at: nextLeadHunterBudgetCasTimestamp(row.updated_at, now),
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

  return { allowed: false, reason: 'lead_hunter_budget_contention', attemptCount: 0, remaining: 0 }
}

export async function reserveLeadHunterSendVerification(input: {
  messageId: string
  email: string
  dailyLimit: number
  now?: Date
}) {
  return reserveHunterSendVerification({ ...input, scope: 'lead' })
}
