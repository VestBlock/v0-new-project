import assert from 'node:assert/strict'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const {
  buildApifyYelpPaidWorkPlan,
  buildOutscraperPaidWorkPlan,
  getPaidSourceDailyLimit,
  normalizePaidSourceBudget,
  paidSourceBudgetDateKey,
  reservePaidSourceBudget,
} = require('../lib/leads/paidSourceBudgetCore') as typeof import('../lib/leads/paidSourceBudgetCore')
const {
  reservePaidSourceDailyAttemptWithStore,
  runPaidSourceAttempt,
} = require('../lib/leads/paidSourceBudget') as typeof import('../lib/leads/paidSourceBudget')
import type {
  PaidSourceBudgetRow,
  PaidSourceBudgetStore,
} from '../lib/leads/paidSourceBudget'

const beforeChicagoMidnight = new Date('2026-09-16T04:59:59.000Z')
const afterChicagoMidnight = new Date('2026-09-16T05:00:00.000Z')
assert.equal(paidSourceBudgetDateKey(beforeChicagoMidnight), '2026-09-15')
assert.equal(paidSourceBudgetDateKey(afterChicagoMidnight), '2026-09-16')

assert.equal(getPaidSourceDailyLimit('outscraper', {}), 4)
assert.equal(getPaidSourceDailyLimit('apify', {}), 4)
assert.equal(getPaidSourceDailyLimit('google_places', {}), 3)
assert.equal(getPaidSourceDailyLimit('outscraper', { SOURCE_LIMIT_OUTSCRAPER_DAILY: '0' }), 0)
assert.equal(getPaidSourceDailyLimit('apify', { SOURCE_LIMIT_APIFY_DAILY: 'not-a-number' }), 0)
assert.equal(getPaidSourceDailyLimit('outscraper', { SOURCE_LIMIT_OUTSCRAPER_DAILY: '999' }), 24)
assert.equal(getPaidSourceDailyLimit('google_places', { SOURCE_LIMIT_GOOGLE_PLACES_DAILY: '999' }), 24)

const outscraperWorkPlan = buildOutscraperPaidWorkPlan({
  niches: [
    'plumber',
    'electrician',
    'roofer',
    'landscaper',
    'dentist',
    'attorney',
    'accountant',
    'PLUMBER',
  ],
  limitPerNiche: 999,
})
assert.equal(outscraperWorkPlan.niches.length, 6)
assert.equal(outscraperWorkPlan.limitPerNiche, 4)
assert.equal(outscraperWorkPlan.resultUnits, 24)
assert.equal(outscraperWorkPlan.estimatedBillableUnits, 24)

const reservedOutscraperWorkPlan = buildOutscraperPaidWorkPlan({
  niches: outscraperWorkPlan.niches,
  limitPerNiche: outscraperWorkPlan.limitPerNiche,
  unitBudget: 5,
})
assert.equal(reservedOutscraperWorkPlan.niches.length, 5)
assert.equal(reservedOutscraperWorkPlan.limitPerNiche, 1)
assert.equal(reservedOutscraperWorkPlan.estimatedBillableUnits, 5)

const apifyWorkPlan = buildApifyYelpPaidWorkPlan({
  niches: ['plumber', 'electrician', 'roofer', 'landscaper', 'dentist'],
  limitPerNiche: 999,
  memoryMbytes: 999_999,
  timeoutSecs: 999_999,
  maxWaitMs: 999_999,
  maxConcurrency: 999_999,
  proxyCountry: 'not-a-country',
})
assert.equal(apifyWorkPlan.niches.length, 4)
assert.equal(apifyWorkPlan.limitPerNiche, 5)
assert.equal(apifyWorkPlan.resultUnits, 20)
assert.equal(apifyWorkPlan.estimatedBillableUnits, 21)
assert.equal(apifyWorkPlan.memoryMbytes, 1024)
assert.equal(apifyWorkPlan.timeoutSecs, 120)
assert.equal(apifyWorkPlan.maxWaitMs, 120_000)
assert.equal(apifyWorkPlan.maxConcurrency, 3)
assert.equal(apifyWorkPlan.proxyCountry, 'US')

const reservedApifyWorkPlan = buildApifyYelpPaidWorkPlan({
  niches: apifyWorkPlan.niches,
  limitPerNiche: apifyWorkPlan.limitPerNiche,
  unitBudget: 4,
})
assert.equal(reservedApifyWorkPlan.niches.length, 3)
assert.equal(reservedApifyWorkPlan.limitPerNiche, 1)
assert.equal(reservedApifyWorkPlan.resultUnits, 3)
assert.equal(reservedApifyWorkPlan.estimatedBillableUnits, 4)

const now = new Date('2026-09-15T16:00:00.000Z')
const emptyMetrics = {
  budgetDate: '2026-09-15',
  attemptCount: 0,
  attemptMarkers: [],
}
const firstDecision = reservePaidSourceBudget({
  provider: 'outscraper',
  metrics: emptyMetrics,
  attemptKey: 'refill:maps:milwaukee-wi',
  reservationId: 'reservation-1',
  dailyLimit: 1,
  now,
})
assert.equal(firstDecision.allowed, true)
assert.equal(firstDecision.attemptCount, 1)
assert.equal(firstDecision.remaining, 0)

const duplicateDecision = reservePaidSourceBudget({
  provider: 'outscraper',
  metrics: firstDecision.metrics,
  attemptKey: 'refill:maps:milwaukee-wi',
  reservationId: 'reservation-2',
  dailyLimit: 1,
  now,
})
assert.equal(duplicateDecision.allowed, false)
assert.equal(duplicateDecision.reason, 'paid_source_attempt_already_reserved')
assert.equal(duplicateDecision.attemptCount, 1)

const exhaustedDecision = reservePaidSourceBudget({
  provider: 'outscraper',
  metrics: firstDecision.metrics,
  attemptKey: 'refill:maps:chicago-il',
  reservationId: 'reservation-3',
  dailyLimit: 1,
  now,
})
assert.equal(exhaustedDecision.allowed, false)
assert.equal(exhaustedDecision.reason, 'paid_source_daily_budget_exhausted')

const partialBatchDecision = reservePaidSourceBudget({
  provider: 'google_places',
  metrics: emptyMetrics,
  attemptKey: 'partner:buyers:google:chicago-il',
  reservationId: 'reservation-google-batch',
  dailyLimit: 3,
  units: 4,
  now,
})
assert.equal(partialBatchDecision.allowed, true)
assert.equal(partialBatchDecision.requestedUnits, 4)
assert.equal(partialBatchDecision.reservedUnits, 3)
assert.equal(partialBatchDecision.attemptCount, 3)
assert.equal(partialBatchDecision.metrics.attemptMarkers[0]?.units, 3)

const belowMinimumDecision = reservePaidSourceBudget({
  provider: 'apify',
  metrics: {
    budgetDate: '2026-09-15',
    attemptCount: 3,
    attemptMarkers: [
      {
        reservationId: 'reservation-existing',
        attemptKey: 'daily:yelp:existing-market',
        units: 3,
        reservedAt: '2026-09-15T15:00:00.000Z',
      },
    ],
  },
  attemptKey: 'daily:yelp:new-market',
  reservationId: 'reservation-apify-minimum',
  dailyLimit: 4,
  units: 10,
  minimumUnits: 2,
  now,
})
assert.equal(belowMinimumDecision.allowed, false)
assert.equal(belowMinimumDecision.reason, 'paid_source_remaining_budget_below_minimum')
assert.equal(belowMinimumDecision.reservedUnits, 0)
assert.equal(belowMinimumDecision.attemptCount, 3)
assert.equal(belowMinimumDecision.remaining, 1)

const reset = normalizePaidSourceBudget(
  'apify',
  {
    budgetDate: '2026-09-14',
    attemptCount: 1,
    attemptMarkers: [
      {
        reservationId: 'old-reservation',
        attemptKey: 'daily:yelp:old-market',
        units: 1,
        reservedAt: '2026-09-14T16:00:00.000Z',
      },
    ],
  },
  now
)
assert.equal(reset.valid, true)
assert.equal(reset.budgetDate, '2026-09-15')
assert.equal(reset.attemptCount, 0)

const corrupt = normalizePaidSourceBudget(
  'apify',
  {
    budgetDate: '2026-09-15',
    attemptCount: 2,
    attemptMarkers: [],
  },
  now
)
assert.equal(corrupt.valid, false)
assert.equal(corrupt.reason, 'paid_source_budget_state_is_invalid')

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

class MemoryBudgetStore implements PaidSourceBudgetStore {
  private rows = new Map<string, PaidSourceBudgetRow>()

  async load(provider: 'google_places' | 'outscraper' | 'apify') {
    await Promise.resolve()
    const row = this.rows.get(provider)
    return row ? clone(row) : null
  }

  async insert(provider: 'google_places' | 'outscraper' | 'apify', payload: Parameters<PaidSourceBudgetStore['insert']>[1]) {
    await Promise.resolve()
    if (this.rows.has(provider)) return null
    const row: PaidSourceBudgetRow = {
      id: `row-${provider}`,
      metrics_json: clone(payload.metrics_json),
      updated_at: payload.updated_at,
    }
    this.rows.set(provider, row)
    return clone(row)
  }

  async compareAndSwap(input: Parameters<PaidSourceBudgetStore['compareAndSwap']>[0]) {
    await Promise.resolve()
    const provider = input.rowId.replace('row-', '') as 'google_places' | 'outscraper' | 'apify'
    const current = this.rows.get(provider)
    if (!current || current.updated_at !== input.expectedUpdatedAt) return false
    this.rows.set(provider, {
      id: current.id,
      metrics_json: clone(input.payload.metrics_json),
      updated_at: input.payload.updated_at,
    })
    return true
  }

  async snapshot(provider: 'google_places' | 'outscraper' | 'apify') {
    return this.load(provider)
  }
}

async function main() {
  const store = new MemoryBudgetStore()
  const reservations = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      reservePaidSourceDailyAttemptWithStore(
        {
          provider: 'outscraper',
          attemptKey: `refill:maps:market-${index}`,
          dailyLimit: 4,
          now,
        },
        store
      )
    )
  )
  assert.equal(reservations.filter((reservation) => reservation.allowed).length, 4)
  assert.equal(
    reservations.filter(
      (reservation) => !reservation.allowed && reservation.reason === 'paid_source_daily_budget_exhausted'
    ).length,
    16
  )

  const stored = await store.snapshot('outscraper')
  assert.equal(stored?.metrics_json?.attemptCount, 4)
  assert.equal(stored?.metrics_json?.attemptMarkers?.length, 4)

  const batchStore = new MemoryBudgetStore()
  const batchReservations = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      reservePaidSourceDailyAttemptWithStore(
        {
          provider: 'google_places',
          attemptKey: `partner:buyers:google:market-${index}`,
          dailyLimit: 5,
          units: 4,
          now,
        },
        batchStore
      )
    )
  )
  assert.equal(
    batchReservations.reduce((sum, reservation) => sum + reservation.reservedUnits, 0),
    5
  )
  assert.equal(batchReservations.filter((reservation) => reservation.allowed).length, 2)
  assert.deepEqual(
    batchReservations
      .filter((reservation) => reservation.allowed)
      .map((reservation) => reservation.reservedUnits)
      .sort((left, right) => left - right),
    [1, 4]
  )
  const storedBatch = await batchStore.snapshot('google_places')
  assert.equal(storedBatch?.metrics_json?.attemptCount, 5)

  const events: string[] = []
  const completed = await runPaidSourceAttempt(
    {
      provider: 'apify',
      attemptKey: 'daily:yelp:austin-tx',
      execute: async () => {
        events.push('provider')
        return ['lead']
      },
    },
    {
      reserve: async () => {
        events.push('reserve')
        return {
          allowed: true,
          provider: 'apify',
          reason: null,
          reservationId: 'reservation-ok',
          businessDate: '2026-09-15',
          dailyLimit: 4,
          requestedUnits: 1,
          reservedUnits: 1,
          attemptCount: 1,
          remaining: 3,
        }
      },
    }
  )
  assert.deepEqual(events, ['reserve', 'provider'])
  assert.equal(completed.status, 'completed')

  const prEvents: string[] = []
  const prQueries = ['chamber', 'business journal', 'small business center', 'business program']
  const partialPrBatch = await runPaidSourceAttempt(
    {
      provider: 'google_places',
      attemptKey: 'pr:destination:google:target-1',
      units: prQueries.length,
      execute: async (reservation) => {
        for (const query of prQueries.slice(0, reservation.reservedUnits)) {
          prEvents.push(`provider:${query}`)
        }
        return prEvents.length
      },
    },
    {
      reserve: async () => {
        prEvents.push('reserve')
        return {
          allowed: true,
          provider: 'google_places',
          reason: null,
          reservationId: 'reservation-pr-partial',
          businessDate: '2026-09-15',
          dailyLimit: 2,
          requestedUnits: 4,
          reservedUnits: 2,
          attemptCount: 2,
          remaining: 0,
        }
      },
    }
  )
  assert.equal(partialPrBatch.status, 'completed')
  assert.deepEqual(prEvents, ['reserve', 'provider:chamber', 'provider:business journal'])

  let deniedProviderCalled = false
  const skipped = await runPaidSourceAttempt(
    {
      provider: 'apify',
      attemptKey: 'daily:yelp:dallas-tx',
      execute: async () => {
        deniedProviderCalled = true
        return []
      },
    },
    {
      reserve: async () => ({
        allowed: false,
        provider: 'apify',
        reason: 'paid_source_daily_budget_exhausted',
        businessDate: '2026-09-15',
        dailyLimit: 4,
        requestedUnits: 1,
        reservedUnits: 0,
        attemptCount: 4,
        remaining: 0,
      }),
    }
  )
  assert.equal(skipped.status, 'skipped')
  assert.equal(deniedProviderCalled, false)

  let failedReservationProviderCalled = false
  const failedReservation = await runPaidSourceAttempt(
    {
      provider: 'outscraper',
      attemptKey: 'daily:maps:phoenix-az',
      execute: async () => {
        failedReservationProviderCalled = true
        return []
      },
    },
    {
      reserve: async () => {
        throw new Error('budget database unavailable')
      },
    }
  )
  assert.equal(failedReservation.status, 'failed')
  assert.equal(failedReservationProviderCalled, false)

  const failedProvider = await runPaidSourceAttempt(
    {
      provider: 'outscraper',
      attemptKey: 'daily:maps:atlanta-ga',
      execute: async () => {
        throw new Error('provider timeout')
      },
    },
    {
      reserve: async () => ({
        allowed: true,
        provider: 'outscraper',
        reason: null,
        reservationId: 'reservation-failed-provider',
        businessDate: '2026-09-15',
        dailyLimit: 4,
        requestedUnits: 1,
        reservedUnits: 1,
        attemptCount: 2,
        remaining: 2,
      }),
    }
  )
  assert.equal(failedProvider.status, 'failed')
  assert.equal(failedProvider.reservation?.allowed, true)

  console.log('paid-source-budget: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
