import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS,
  nextAutomaticEmailQuotaCasTimestamp,
  reserveAutomaticEmailAttemptQuota,
  seedAutomaticEmailAttemptQuota,
  type AutomaticEmailAttemptQuotaMetrics,
  type AutomaticEmailLane,
  type ObservedSentEmailAttempt,
} from '@/lib/outreach/laneAttemptQuotaCore'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_RESERVATION_RETRIES = 8
const MAX_OBSERVED_SENT_MARKERS = 500

const LANE_CONFIG: Record<AutomaticEmailLane, {
  jobKey: string
  title: string
  table: string
}> = {
  buyer: {
    jobKey: 'outreach-buyer-auto-email-attempt-budget',
    title: 'Buyer automatic email attempt budget',
    table: 'buyer_outreach_messages',
  },
  investor: {
    jobKey: 'outreach-investor-auto-email-attempt-budget',
    title: 'Investor automatic email attempt budget',
    table: 'investor_outreach_messages',
  },
  lender: {
    jobKey: 'outreach-lender-auto-email-attempt-budget',
    title: 'Lender automatic email attempt budget',
    table: 'lender_outreach_messages',
  },
}

type AutomaticEmailAttemptQuotaRow = {
  id: string
  metrics_json: AutomaticEmailAttemptQuotaMetrics | null
  updated_at: string
}

type ObservedSentSnapshot = {
  count: number
  attempts: ObservedSentEmailAttempt[]
}

export type AutomaticEmailAttemptReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  attemptCount: number
  remaining: number
  observedSentCount: number
}

async function readObservedSentSnapshot(input: {
  lane: AutomaticEmailLane
  now: Date
}): Promise<ObservedSentSnapshot> {
  const admin = createAdminClient()
  const config = LANE_CONFIG[input.lane]
  const since = new Date(input.now.getTime() - AUTOMATIC_EMAIL_ATTEMPT_WINDOW_MS).toISOString()
  const rowLimit = MAX_OBSERVED_SENT_MARKERS
  const { data, count, error } = await admin
    .from(config.table)
    .select('id,sent_at', { count: 'exact' })
    .not('sent_at', 'is', null)
    .gte('sent_at', since)
    .order('sent_at', { ascending: true })
    .limit(rowLimit)
  if (error) throw error

  return {
    count: count || 0,
    attempts: (data || []).flatMap((row) =>
      row?.id && row?.sent_at
        ? [{ messageId: String(row.id), sentAt: String(row.sent_at) }]
        : []
    ),
  }
}

function baseBudgetJob(input: {
  lane: AutomaticEmailLane
  dailyLimit: number
  observed: ObservedSentSnapshot
  now: Date
}) {
  const config = LANE_CONFIG[input.lane]
  const seeded = seedAutomaticEmailAttemptQuota({
    observedSentCount: input.observed.count,
    observedSentAttempts: input.observed.attempts,
    now: input.now,
  })
  if (!seeded.valid) throw new Error(seeded.reason || 'Automatic email attempt quota seed is invalid.')

  return {
    job_key: config.jobKey,
    job_type: 'suppression_sync',
    title: config.title,
    status: 'active',
    cadence: 'rolling 24 hours',
    priority: 118,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      lane: input.lane,
      maxAttempts: input.dailyLimit,
      windowHours: 24,
      countsPreProviderAttempts: true,
      reconcilesObservedSentAt: true,
    },
    metrics_json: {
      windowStartedAt: seeded.windowStartedAt,
      attemptCount: seeded.attemptCount,
      attemptMarkers: seeded.attemptMarkers,
      quotaRevision: randomUUID(),
    },
    updated_at: input.now.toISOString(),
  }
}

async function loadOrCreateBudgetRow(input: {
  lane: AutomaticEmailLane
  dailyLimit: number
  observed: ObservedSentSnapshot
  now: Date
}) {
  const admin = createAdminClient()
  const config = LANE_CONFIG[input.lane]
  const load = () =>
    admin
      .from('command_center_jobs')
      .select('id,metrics_json,updated_at')
      .eq('job_key', config.jobKey)
      .maybeSingle()

  const existing = await load()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as AutomaticEmailAttemptQuotaRow

  const { data, error } = await admin
    .from('command_center_jobs')
    .insert(baseBudgetJob(input))
    .select('id,metrics_json,updated_at')
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data) return data as AutomaticEmailAttemptQuotaRow

  const raced = await load()
  if (raced.error) throw raced.error
  if (!raced.data) throw new Error(`${input.lane} automatic email attempt quota could not be initialized.`)
  return raced.data as AutomaticEmailAttemptQuotaRow
}

export async function reserveAutomaticEmailLaneAttempt(input: {
  lane: AutomaticEmailLane
  messageId: string
  claimId: string
  dailyLimit: number
  now?: Date
}): Promise<AutomaticEmailAttemptReservation> {
  const now = input.now || new Date()
  const observed = await readObservedSentSnapshot({
    lane: input.lane,
    now,
  })
  const reservationId = randomUUID()
  const admin = createAdminClient()

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow({
      lane: input.lane,
      dailyLimit: input.dailyLimit,
      observed,
      now,
    })
    const decision = reserveAutomaticEmailAttemptQuota({
      metrics: row.metrics_json,
      observedSentCount: observed.count,
      observedSentAttempts: observed.attempts,
      messageId: input.messageId,
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
        observedSentCount: observed.count,
      }
    }

    const updatedAt = nextAutomaticEmailQuotaCasTimestamp(row.updated_at, now)
    const { data: reserved, error } = await admin
      .from('command_center_jobs')
      .update({
        status: 'active',
        last_run_at: now.toISOString(),
        last_status: `${input.lane}_automatic_email_attempt_reserved`,
        last_error: null,
        config_json: {
          lane: input.lane,
          maxAttempts: input.dailyLimit,
          windowHours: 24,
          countsPreProviderAttempts: true,
          reconcilesObservedSentAt: true,
        },
        metrics_json: {
          ...decision.metrics,
          quotaRevision: randomUUID(),
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
        observedSentCount: observed.count,
      }
    }
  }

  return {
    allowed: false,
    reason: 'automatic_email_attempt_quota_contention',
    attemptCount: 0,
    remaining: 0,
    observedSentCount: observed.count,
  }
}
