import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  getPaidSourceDailyLimit,
  getPaidSourceHardDailyLimit,
  nextPaidSourceBudgetCasTimestamp,
  paidSourceBudgetDateKey,
  reservePaidSourceBudget,
  type PaidSourceBudgetMetrics,
  type PaidSourceProvider,
} from '@/lib/leads/paidSourceBudgetCore'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPersistedOperationalError } from '@/lib/system/errorMessage'

const MAX_RESERVATION_RETRIES = 12

const PROVIDER_JOB_CONFIG: Record<PaidSourceProvider, { jobKey: string; title: string }> = {
  google_places: {
    jobKey: 'paid-source-daily-budget-google-places',
    title: 'Google Places paid source daily budget',
  },
  outscraper: {
    jobKey: 'paid-source-daily-budget-outscraper',
    title: 'Outscraper paid source daily budget',
  },
  apify: {
    jobKey: 'paid-source-daily-budget-apify',
    title: 'Apify paid source daily budget',
  },
}

export type PaidSourceBudgetRow = {
  id: string
  metrics_json: PaidSourceBudgetMetrics | null
  updated_at: string
}

type PaidSourceBudgetJobPayload = {
  job_key: string
  job_type: string
  title: string
  status: string
  cadence: string
  priority: number
  next_run_at: null
  last_status: string
  last_error: null
  locked_until: null
  config_json: Record<string, unknown>
  metrics_json: Record<string, unknown>
  updated_at: string
}

type PaidSourceBudgetCasPayload = {
  status: string
  last_run_at: string
  last_status: string
  last_error: null
  config_json: Record<string, unknown>
  metrics_json: Record<string, unknown>
  updated_at: string
}

export type PaidSourceBudgetStore = {
  load(provider: PaidSourceProvider): Promise<PaidSourceBudgetRow | null>
  insert(
    provider: PaidSourceProvider,
    payload: PaidSourceBudgetJobPayload
  ): Promise<PaidSourceBudgetRow | null>
  compareAndSwap(input: {
    rowId: string
    expectedUpdatedAt: string
    payload: PaidSourceBudgetCasPayload
  }): Promise<boolean>
}

export type PaidSourceAttemptReservation = {
  allowed: boolean
  provider: PaidSourceProvider
  reason: string | null
  reservationId?: string
  businessDate: string
  dailyLimit: number
  requestedUnits: number
  reservedUnits: number
  attemptCount: number
  remaining: number
}

export type PaidSourceAttemptResult<T> =
  | {
      status: 'completed'
      value: T
      reservation: PaidSourceAttemptReservation & { allowed: true }
    }
  | {
      status: 'skipped'
      reservation: PaidSourceAttemptReservation & { allowed: false }
    }
  | {
      status: 'failed'
      error: unknown
      reservation: PaidSourceAttemptReservation | null
    }

export class PaidSourceBudgetSkipError extends Error {
  readonly code = 'PAID_SOURCE_BUDGET_SKIPPED'
  readonly reservation: PaidSourceAttemptReservation

  constructor(reservation: PaidSourceAttemptReservation) {
    super(paidSourceReservationDetail(reservation))
    this.name = 'PaidSourceBudgetSkipError'
    this.reservation = reservation
  }
}

export function isPaidSourceBudgetSkipError(error: unknown): error is PaidSourceBudgetSkipError {
  return error instanceof PaidSourceBudgetSkipError
}

export function paidSourcePolicySkipError(input: {
  provider: PaidSourceProvider
  units?: number
  reason?: string
  now?: Date
}) {
  const now = input.now || new Date()
  const configuredUnits = input.units ?? 1
  const requestedUnits = Number.isFinite(configuredUnits)
    ? Math.min(
        getPaidSourceHardDailyLimit(input.provider),
        Math.max(0, Math.floor(configuredUnits))
      )
    : 0
  return new PaidSourceBudgetSkipError({
    allowed: false,
    provider: input.provider,
    reason: input.reason || 'paid_source_not_approved',
    businessDate: paidSourceBudgetDateKey(now),
    dailyLimit: getPaidSourceDailyLimit(input.provider),
    requestedUnits,
    reservedUnits: 0,
    attemptCount: 0,
    remaining: 0,
  })
}

function baseBudgetJob(input: {
  provider: PaidSourceProvider
  dailyLimit: number
  now: Date
}): PaidSourceBudgetJobPayload {
  const config = PROVIDER_JOB_CONFIG[input.provider]
  return {
    job_key: config.jobKey,
    job_type: 'source_rotation',
    title: config.title,
    status: 'active',
    cadence: 'Chicago business day budget',
    priority: 116,
    next_run_at: null,
    last_status: 'budget_ready',
    last_error: null,
    locked_until: null,
    config_json: {
      provider: input.provider,
      budgetUnit: 'bounded_provider_work_unit',
      maxWorkUnits: input.dailyLimit,
      resetTimeZone: 'America/Chicago',
      countsPreRequestReservations: true,
      failedAndUnknownWorkRemainsCounted: true,
    },
    metrics_json: {
      budgetDate: paidSourceBudgetDateKey(input.now),
      attemptCount: 0,
      attemptMarkers: [],
      budgetRevision: randomUUID(),
    },
    updated_at: input.now.toISOString(),
  }
}

function createSupabasePaidSourceBudgetStore(): PaidSourceBudgetStore {
  const admin = createAdminClient()
  return {
    async load(provider) {
      const { data, error } = await admin
        .from('command_center_jobs')
        .select('id,metrics_json,updated_at')
        .eq('job_key', PROVIDER_JOB_CONFIG[provider].jobKey)
        .maybeSingle()
      if (error) throw error
      return data ? (data as PaidSourceBudgetRow) : null
    },
    async insert(_provider, payload) {
      const { data, error } = await admin
        .from('command_center_jobs')
        .insert(payload)
        .select('id,metrics_json,updated_at')
        .maybeSingle()
      if (error?.code === '23505') return null
      if (error) throw error
      return data ? (data as PaidSourceBudgetRow) : null
    },
    async compareAndSwap(input) {
      const { data, error } = await admin
        .from('command_center_jobs')
        .update(input.payload)
        .eq('id', input.rowId)
        .eq('updated_at', input.expectedUpdatedAt)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return Boolean(data?.id)
    },
  }
}

async function loadOrCreateBudgetRow(input: {
  provider: PaidSourceProvider
  dailyLimit: number
  now: Date
  store: PaidSourceBudgetStore
}) {
  const existing = await input.store.load(input.provider)
  if (existing) return existing

  const inserted = await input.store.insert(
    input.provider,
    baseBudgetJob({ provider: input.provider, dailyLimit: input.dailyLimit, now: input.now })
  )
  if (inserted) return inserted

  const raced = await input.store.load(input.provider)
  if (!raced) throw new Error(`${input.provider} paid source budget could not be initialized.`)
  return raced
}

export async function reservePaidSourceDailyAttemptWithStore(
  input: {
    provider: PaidSourceProvider
    attemptKey: string
    dailyLimit?: number
    units?: number
    minimumUnits?: number
    now?: Date
  },
  store: PaidSourceBudgetStore
): Promise<PaidSourceAttemptReservation> {
  const now = input.now || new Date()
  const configuredDailyLimit = input.dailyLimit ?? getPaidSourceDailyLimit(input.provider)
  const dailyLimit = Number.isFinite(configuredDailyLimit)
    ? Math.min(
        getPaidSourceHardDailyLimit(input.provider),
        Math.max(0, Math.floor(configuredDailyLimit))
      )
    : 0
  const businessDate = paidSourceBudgetDateKey(now)
  const configuredUnits = input.units ?? 1
  const requestedUnits = Number.isFinite(configuredUnits)
    ? Math.min(
        getPaidSourceHardDailyLimit(input.provider),
        Math.max(0, Math.floor(configuredUnits))
      )
    : 0
  if (dailyLimit <= 0) {
    return {
      allowed: false,
      provider: input.provider,
      reason: 'paid_source_daily_budget_disabled',
      businessDate,
      dailyLimit: 0,
      requestedUnits,
      reservedUnits: 0,
      attemptCount: 0,
      remaining: 0,
    }
  }

  const reservationId = randomUUID()
  let lastAttemptCount = 0

  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt += 1) {
    const row = await loadOrCreateBudgetRow({
      provider: input.provider,
      dailyLimit,
      now,
      store,
    })
    const decision = reservePaidSourceBudget({
      provider: input.provider,
      metrics: row.metrics_json,
      attemptKey: input.attemptKey,
      reservationId,
      dailyLimit,
      units: input.units,
      minimumUnits: input.minimumUnits,
      now,
    })
    lastAttemptCount = decision.attemptCount

    if (!decision.allowed) {
      return {
        allowed: false,
        provider: input.provider,
        reason: decision.reason,
        businessDate: decision.metrics.budgetDate,
        dailyLimit: decision.dailyLimit,
        requestedUnits: decision.requestedUnits,
        reservedUnits: decision.reservedUnits,
        attemptCount: decision.attemptCount,
        remaining: decision.remaining,
      }
    }

    const updatedAt = nextPaidSourceBudgetCasTimestamp(row.updated_at, now)
    const reserved = await store.compareAndSwap({
      rowId: row.id,
      expectedUpdatedAt: row.updated_at,
      payload: {
        status: 'active',
        last_run_at: now.toISOString(),
        last_status: `${input.provider}_paid_source_attempt_reserved`,
        last_error: null,
        config_json: {
          provider: input.provider,
          budgetUnit: 'bounded_provider_work_unit',
          maxWorkUnits: decision.dailyLimit,
          resetTimeZone: 'America/Chicago',
          countsPreRequestReservations: true,
          failedAndUnknownWorkRemainsCounted: true,
        },
        metrics_json: {
          ...decision.metrics,
          budgetRevision: randomUUID(),
        },
        updated_at: updatedAt,
      },
    })

    if (reserved) {
      return {
        allowed: true,
        provider: input.provider,
        reason: null,
        reservationId,
        businessDate: decision.metrics.budgetDate,
        dailyLimit: decision.dailyLimit,
        requestedUnits: decision.requestedUnits,
        reservedUnits: decision.reservedUnits,
        attemptCount: decision.attemptCount,
        remaining: decision.remaining,
      }
    }
  }

  return {
    allowed: false,
    provider: input.provider,
    reason: 'paid_source_budget_contention',
    businessDate,
    dailyLimit,
    requestedUnits,
    reservedUnits: 0,
    attemptCount: lastAttemptCount,
    remaining: 0,
  }
}

export async function reservePaidSourceDailyAttempt(input: {
  provider: PaidSourceProvider
  attemptKey: string
  units?: number
  minimumUnits?: number
  now?: Date
}) {
  return reservePaidSourceDailyAttemptWithStore(input, createSupabasePaidSourceBudgetStore())
}

export async function runPaidSourceAttempt<T>(
  input: {
    provider: PaidSourceProvider
    attemptKey: string
    units?: number
    minimumUnits?: number
    execute: (reservation: PaidSourceAttemptReservation & { allowed: true }) => Promise<T>
  },
  dependencies: {
    reserve?: typeof reservePaidSourceDailyAttempt
  } = {}
): Promise<PaidSourceAttemptResult<T>> {
  let reservation: PaidSourceAttemptReservation
  try {
    reservation = await (dependencies.reserve || reservePaidSourceDailyAttempt)({
      provider: input.provider,
      attemptKey: input.attemptKey,
      units: input.units,
      minimumUnits: input.minimumUnits,
    })
  } catch (error) {
    return { status: 'failed', error, reservation: null }
  }

  if (!reservation.allowed) {
    return {
      status: 'skipped',
      reservation: reservation as PaidSourceAttemptReservation & { allowed: false },
    }
  }

  try {
    const allowedReservation = reservation as PaidSourceAttemptReservation & { allowed: true }
    return {
      status: 'completed',
      value: await input.execute(allowedReservation),
      reservation: allowedReservation,
    }
  } catch (error) {
    return { status: 'failed', error, reservation }
  }
}

export function paidSourceReservationDetail(reservation: PaidSourceAttemptReservation) {
  if (reservation.allowed) {
    const unitDetail =
      reservation.requestedUnits === reservation.reservedUnits
        ? `${reservation.reservedUnits} work unit${reservation.reservedUnits === 1 ? '' : 's'}`
        : `${reservation.reservedUnits} of ${reservation.requestedUnits} requested work units`
    return `${reservation.provider} paid-source operation reserved ${unitDetail}; ${reservation.attemptCount}/${reservation.dailyLimit} used for ${reservation.businessDate}, ${reservation.remaining} remaining.`
  }

  if (reservation.reason === 'paid_source_attempt_already_reserved') {
    return `${reservation.provider} paid-source operation skipped because this market slice was already reserved for ${reservation.businessDate}; failed or unknown prior work remains counted.`
  }
  if (reservation.reason === 'paid_source_daily_budget_exhausted') {
    return `${reservation.provider} paid-source operation skipped because the Chicago-day work-unit budget is exhausted (${reservation.attemptCount}/${reservation.dailyLimit}) for ${reservation.businessDate}.`
  }
  if (reservation.reason === 'paid_source_daily_budget_disabled') {
    return `${reservation.provider} paid-source operation skipped because its configured Chicago-day work-unit budget is zero.`
  }
  if (reservation.reason === 'paid_source_remaining_budget_below_minimum') {
    return `${reservation.provider} paid-source operation skipped because only ${reservation.remaining} work unit${reservation.remaining === 1 ? '' : 's'} remain, below the safe minimum for this provider operation.`
  }
  if (reservation.reason === 'paid_source_not_approved') {
    return `${reservation.provider} paid-source operation skipped because the provider is not explicitly enabled with paid-scraping approval, a provider enable flag, and a configured credential.`
  }

  return `${reservation.provider} paid-source operation skipped by the fail-closed budget guard (${reservation.reason || 'unknown_reason'}).`
}

export function paidSourceFailureDetail(result: Extract<PaidSourceAttemptResult<unknown>, { status: 'failed' }>) {
  const message = formatPersistedOperationalError(result.error, 'Provider operation failed.')
  return result.reservation?.allowed
    ? `${paidSourceReservationDetail(result.reservation)} The provider request failed or had an unknown outcome, so the reservation remains counted. ${message}`
    : `Paid-source budget reservation failed closed before any provider request. ${message}`
}

export function unwrapPaidSourceAttempt<T>(result: PaidSourceAttemptResult<T>) {
  if (result.status === 'completed') return result.value
  if (result.status === 'skipped') throw new PaidSourceBudgetSkipError(result.reservation)
  throw new Error(paidSourceFailureDetail(result), {
    cause: result.error,
  })
}
