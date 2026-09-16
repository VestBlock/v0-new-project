import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import { normalizeEmailAddress } from '@/lib/outreach/email-quality'
import type { DailyStrategyOutputLaneKey } from '@/lib/outreach/dailyStrategyOutputCore'
import {
  OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP,
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  reserveOutlookColdBudget,
  seedOutlookColdBudget,
  type OutlookColdBudgetMetrics,
} from '@/lib/outreach/outlookColdBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'

const BUDGET_JOB_KEY = 'outlook-cold-b2b-rolling-budget'
const MAX_RESERVATION_RETRIES = 8

type BudgetRow = {
  id: string
  metrics_json: OutlookColdBudgetMetrics | null
  updated_at: string
}

export type OutlookColdBudgetReservation = {
  allowed: boolean
  duplicate: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  domainAttemptCount: number
  invocationAttemptCount: number
  laneAttemptCount: number
  laneDailyCap: number
  remaining: number
  domainRemaining: number
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function recipientDomain(email: string) {
  const normalized = normalizeEmailAddress(email)
  const at = normalized.lastIndexOf('@')
  if (at < 1 || at === normalized.length - 1) return null
  const domain = normalized.slice(at + 1)
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain)
    ? domain
    : null
}

function nextCasTimestamp(previous: string, now: Date) {
  const previousMs = Date.parse(previous)
  if (!Number.isFinite(previousMs)) throw new Error('Outlook cold budget row has an invalid update timestamp.')
  return new Date(Math.max(now.getTime(), previousMs + 1)).toISOString()
}

function baseBudgetJob(now: Date) {
  return {
    job_key: BUDGET_JOB_KEY,
    job_type: 'suppression_sync',
    title: 'Outlook verified B2B cold email budget',
    status: 'active',
    cadence: 'rolling 24 hours',
    priority: 120,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      provider: 'outlook',
      purpose: 'cold_outreach',
      globalMaxAttempts: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
      recipientDomainMaxAttempts: OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP,
      invocationMaxAttempts: OUTLOOK_COLD_B2B_INVOCATION_CAP,
      windowHours: 24,
      countsPreProviderAttempts: true,
    },
    metrics_json: seedOutlookColdBudget(),
    updated_at: now.toISOString(),
  }
}

async function loadOrCreateBudgetRow(now: Date): Promise<BudgetRow> {
  const admin = createAdminClient()
  const load = () => admin
    .from('command_center_jobs')
    .select('id,metrics_json,updated_at')
    .eq('job_key', BUDGET_JOB_KEY)
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
  if (!raced.data) throw new Error('Outlook cold budget row could not be initialized.')
  return raced.data as BudgetRow
}

/**
 * Atomically reserves one cold Outlook attempt in the database. Only hashes
 * are persisted; raw recipient addresses and idempotency keys never enter the
 * budget ledger.
 */
export async function reserveOutlookColdEmailAttempt(input: {
  recipientEmail: string
  idempotencyKey: string
  invocationId: string
  strategyKey: DailyStrategyOutputLaneKey
  now?: Date
}): Promise<OutlookColdBudgetReservation> {
  const now = input.now || new Date()
  const domain = recipientDomain(input.recipientEmail)
  const idempotencyKey = String(input.idempotencyKey || '').trim()
  const invocationId = String(input.invocationId || '').trim()
  if (
    !domain ||
    !idempotencyKey ||
    idempotencyKey.length > 500 ||
    !invocationId ||
    invocationId.length > 500
  ) {
    return {
      allowed: false,
      duplicate: false,
      reason: 'outlook_cold_budget_identity_invalid',
      attemptCount: 0,
      domainAttemptCount: 0,
      invocationAttemptCount: 0,
      laneAttemptCount: 0,
      laneDailyCap: 0,
      remaining: 0,
      domainRemaining: 0,
    }
  }

  const idempotencyKeyHash = sha256(`vestblock:outlook:cold-budget:idempotency:v1:${idempotencyKey}`)
  const recipientDomainHash = sha256(`vestblock:outlook:cold-budget:domain:v1:${domain}`)
  const invocationIdHash = sha256(`vestblock:outlook:cold-budget:invocation:v1:${invocationId}`)
  const reservationId = randomUUID()
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow(now)
    const decision = reserveOutlookColdBudget({
      metrics: row.metrics_json,
      idempotencyKeyHash,
      recipientDomainHash,
      invocationIdHash,
      strategyKey: input.strategyKey,
      reservationId,
      now,
    })
    if (!decision.allowed || decision.duplicate || !decision.metrics) {
      return {
        allowed: decision.allowed,
        duplicate: decision.duplicate,
        reason: decision.reason,
        ...(decision.allowed ? { reservationId } : {}),
        attemptCount: decision.attemptCount,
        domainAttemptCount: decision.domainAttemptCount,
        invocationAttemptCount: decision.invocationAttemptCount,
        laneAttemptCount: decision.laneAttemptCount,
        laneDailyCap: decision.laneDailyCap,
        remaining: decision.remaining,
        domainRemaining: decision.domainRemaining,
      }
    }

    const updatedAt = nextCasTimestamp(row.updated_at, now)
    const { data: reserved, error } = await admin
      .from('command_center_jobs')
      .update({
        status: 'active',
        last_run_at: now.toISOString(),
        last_status: 'outlook_cold_attempt_reserved',
        last_error: null,
        config_json: {
          provider: 'outlook',
          purpose: 'cold_outreach',
          globalMaxAttempts: OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
          recipientDomainMaxAttempts: OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP,
          invocationMaxAttempts: OUTLOOK_COLD_B2B_INVOCATION_CAP,
          windowHours: 24,
          countsPreProviderAttempts: true,
        },
        metrics_json: decision.metrics,
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
        duplicate: false,
        reason: null,
        reservationId,
        attemptCount: decision.attemptCount,
        domainAttemptCount: decision.domainAttemptCount,
        invocationAttemptCount: decision.invocationAttemptCount,
        laneAttemptCount: decision.laneAttemptCount,
        laneDailyCap: decision.laneDailyCap,
        remaining: decision.remaining,
        domainRemaining: decision.domainRemaining,
      }
    }
  }

  return {
    allowed: false,
    duplicate: false,
    reason: 'outlook_cold_budget_contention',
    attemptCount: 0,
    domainAttemptCount: 0,
    invocationAttemptCount: 0,
    laneAttemptCount: 0,
    laneDailyCap: 0,
    remaining: 0,
    domainRemaining: 0,
  }
}
