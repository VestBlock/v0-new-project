import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buyerHunterBudgetDateKey,
  nextHunterCasTimestamp,
  normalizeBuyerHunterBudget,
  reserveBuyerHunterBudget,
  type BuyerHunterBudgetMetrics,
} from '../lib/buyers/hunterBudgetCore'

const beforeCentralMidnight = new Date('2026-09-14T04:59:59.000Z')
const atCentralMidnight = new Date('2026-09-14T05:00:00.000Z')
assert.equal(buyerHunterBudgetDateKey(beforeCentralMidnight), '2026-09-13')
assert.equal(buyerHunterBudgetDateKey(atCentralMidnight), '2026-09-14')

let metrics: BuyerHunterBudgetMetrics = {
  budgetDate: '2026-09-14',
  attemptCount: 0,
  attemptMarkers: [],
}
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const decision = reserveBuyerHunterBudget({
    metrics,
    buyerId: `buyer-${attempt}`,
    claimId: `claim-${attempt}`,
    reservationId: `reservation-${attempt}`,
    dailyLimit: 3,
    now: atCentralMidnight,
  })
  assert.equal(decision.allowed, true)
  assert.equal(decision.attemptCount, attempt)
  assert.equal(decision.remaining, 3 - attempt)
  metrics = decision.metrics
}

const exhausted = reserveBuyerHunterBudget({
  metrics,
  buyerId: 'buyer-4',
  claimId: 'claim-4',
  reservationId: 'reservation-4',
  dailyLimit: 3,
  now: atCentralMidnight,
})
assert.equal(exhausted.allowed, false)
assert.equal(exhausted.reason, 'buyer_hunter_daily_budget_exhausted')
assert.equal(exhausted.attemptCount, 3)

const duplicateClaim = reserveBuyerHunterBudget({
  metrics,
  buyerId: 'buyer-1',
  claimId: 'claim-1',
  reservationId: 'reservation-retry',
  dailyLimit: 10,
  now: atCentralMidnight,
})
assert.equal(duplicateClaim.allowed, false)
assert.equal(duplicateClaim.reason, 'buyer_hunter_claim_already_reserved')
assert.equal(duplicateClaim.attemptCount, 3)

const nextDay = new Date('2026-09-15T05:00:00.000Z')
const reset = reserveBuyerHunterBudget({
  metrics,
  buyerId: 'buyer-next-day',
  claimId: 'claim-next-day',
  reservationId: 'reservation-next-day',
  dailyLimit: 3,
  now: nextDay,
})
assert.equal(reset.allowed, true)
assert.equal(reset.attemptCount, 1)
assert.equal(reset.metrics.budgetDate, '2026-09-15')

const malformed = normalizeBuyerHunterBudget({
  budgetDate: '2026-09-14',
  attemptCount: 1,
  attemptMarkers: [{ claimId: 'missing-required-marker-fields' }],
}, atCentralMidnight)
assert.equal(malformed.valid, false)
assert.equal(malformed.reason, 'budget_state_is_invalid')

const missing = normalizeBuyerHunterBudget(null, atCentralMidnight)
assert.equal(missing.valid, false)
assert.equal(missing.reason, 'budget_date_is_missing_or_invalid')

const futureDated = normalizeBuyerHunterBudget({
  budgetDate: '2026-09-15',
  attemptCount: 0,
  attemptMarkers: [],
}, atCentralMidnight)
assert.equal(futureDated.valid, false)
assert.equal(futureDated.reason, 'budget_date_is_in_the_future')

const hardCapped = reserveBuyerHunterBudget({
  metrics: {
    budgetDate: '2026-09-14',
    attemptCount: 25,
    attemptMarkers: [],
  },
  buyerId: 'buyer-over-configured-limit',
  claimId: 'claim-over-configured-limit',
  reservationId: 'reservation-over-configured-limit',
  dailyLimit: 1000,
  now: atCentralMidnight,
})
assert.equal(hardCapped.allowed, false)
assert.equal(hardCapped.reason, 'buyer_hunter_daily_budget_exhausted')

assert.equal(
  nextHunterCasTimestamp('2026-09-14T05:00:00.000Z', new Date('2026-09-14T05:00:00.000Z')),
  '2026-09-14T05:00:00.001Z'
)

const repositorySource = readFileSync(resolve(process.cwd(), 'lib/buyers/repository.ts'), 'utf8')
assert.match(repositorySource, /\.eq\('updated_at', input\.expectedUpdatedAt\)/)
assert.match(repositorySource, /query\.is\('contact_email', null\)/)
assert.match(repositorySource, /query\.eq\('contact_email', input\.expectedContactEmail\)/)
assert.match(repositorySource, /query\.contains\('metadata_json'/)

const serviceSource = readFileSync(resolve(process.cwd(), 'lib/buyers/service.ts'), 'utf8')
const claimIndex = serviceSource.indexOf('claimBuyerForHunterEnrichment({ buyer, claimId })')
const budgetIndex = serviceSource.indexOf('reserveBuyerHunterDailyLookup({')
const providerIndex = serviceSource.indexOf('hunterResult = await enrichContactFromHunter({')
assert.ok(claimIndex >= 0 && budgetIndex > claimIndex && providerIndex > budgetIndex)
assert.doesNotMatch(serviceSource, /reservePaidHunterLookup/)
assert.match(serviceSource, /if \(!currentContactEmail && freshHunterClaim\) return buyer/)
assert.match(serviceSource, /else \{\s+return \(await getBuyerRecordById\(buyer\.id\)\) \|\| buyer\s+\}/)

console.log('Buyer Hunter daily budget and atomic claim tests passed.')
