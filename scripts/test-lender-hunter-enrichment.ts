import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildSanitizedLenderHunterMetadata,
  isLenderHunterEnrichmentEligible,
  selectVerifiedLenderHunterCandidate,
  summarizeLenderScoringOutcomes,
  type LenderScoringOutcome,
} from '../lib/lenders/service'
import {
  lenderHunterBudgetDateKey,
  normalizeLenderHunterBudget,
  reserveLenderHunterBudget,
  type LenderHunterBudgetMetrics,
} from '../lib/lenders/hunterBudgetCore'
import type { HunterContactCandidate } from '../lib/email/hunter'

const now = new Date('2026-09-14T12:00:00.000Z')
const lenderBase = {
  contact_email: 'info@trustedlender.com',
  website: 'https://trustedlender.com',
  metadata_json: {},
}
assert.equal(isLenderHunterEnrichmentEligible(lenderBase, now), true)
assert.equal(isLenderHunterEnrichmentEligible({ ...lenderBase, contact_email: 'jordan@trustedlender.com' }, now), false)
assert.equal(isLenderHunterEnrichmentEligible({ ...lenderBase, website: 'https://linkedin.com/company/lender' }, now), false)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'checking', checkedAt: '2026-09-14T10:00:01.000Z' } },
}, now), false)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'checking', checkedAt: '2026-09-14T10:00:00.000Z' } },
}, now), true)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T06:00:01.000Z' } },
}, now), false)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T06:00:00.000Z' } },
}, now), true)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'not_found', checkedAt: '2026-08-16T12:00:00.000Z' } },
}, now), false)
assert.equal(isLenderHunterEnrichmentEligible({
  ...lenderBase,
  metadata_json: { hunterContactEnrichment: { status: 'not_found', checkedAt: '2026-08-15T12:00:00.000Z' } },
}, now), true)

const candidates: HunterContactCandidate[] = [
  {
    email: 'acceptall@trustedlender.com',
    fullName: 'Wrong Candidate',
    position: 'CEO',
    department: null,
    seniority: null,
    confidence: 100,
    verificationStatus: 'accept_all',
    score: 100,
    sourceUrls: ['https://source.invalid/raw'],
  },
  {
    email: 'owner@trustedlender.com',
    fullName: 'Jordan Reed',
    position: 'Owner',
    department: 'Lending',
    seniority: 'executive',
    confidence: 94,
    verificationStatus: 'valid',
    score: 30,
    sourceUrls: ['https://trustedlender.com/team'],
  },
  {
    email: 'director@trustedlender.com',
    fullName: 'Alex Lee',
    position: 'Director',
    department: 'Lending',
    seniority: 'senior',
    confidence: 99,
    verificationStatus: 'valid',
    score: 20,
    sourceUrls: [],
  },
]
const selected = selectVerifiedLenderHunterCandidate(candidates)
assert.equal(selected?.email, 'owner@trustedlender.com')

const sanitized = buildSanitizedLenderHunterMetadata({
  status: 'found',
  domain: 'trustedlender.com',
  organization: 'Trusted\nLender',
  checkedAt: now.toISOString(),
  claimId: 'claim-1',
  reservationId: 'reservation-1',
  candidate: selected,
  topCandidateConfidence: 100,
  topCandidateVerificationStatus: 'accept_all',
})
assert.equal(sanitized.accepted, true)
assert.equal(sanitized.acceptedConfidence, 94)
assert.equal(sanitized.organization, 'Trusted Lender')
const serializedMetadata = JSON.stringify(sanitized)
assert.doesNotMatch(serializedMetadata, /owner@trustedlender\.com/)
assert.doesNotMatch(serializedMetadata, /Jordan Reed/)
assert.doesNotMatch(serializedMetadata, /https:\/\/trustedlender\.com\/team/)
assert.equal('candidate' in sanitized, false)
assert.equal('candidates' in sanitized, false)
assert.equal(buildSanitizedLenderHunterMetadata({
  status: 'not_found',
  checkedAt: now.toISOString(),
  topCandidateConfidence: null,
}).topCandidateConfidence, null)

assert.equal(lenderHunterBudgetDateKey(new Date('2026-09-14T04:59:59.000Z')), '2026-09-13')
assert.equal(lenderHunterBudgetDateKey(new Date('2026-09-14T05:00:00.000Z')), '2026-09-14')
let metrics: LenderHunterBudgetMetrics = {
  budgetDate: '2026-09-14',
  attemptCount: 0,
  attemptMarkers: [],
}
for (let attempt = 1; attempt <= 2; attempt += 1) {
  const decision = reserveLenderHunterBudget({
    metrics,
    lenderId: `lender-${attempt}`,
    claimId: `claim-${attempt}`,
    reservationId: `reservation-${attempt}`,
    dailyLimit: 2,
    now,
  })
  assert.equal(decision.allowed, true)
  assert.equal(decision.attemptCount, attempt)
  metrics = decision.metrics
}
const exhausted = reserveLenderHunterBudget({
  metrics,
  lenderId: 'lender-3',
  claimId: 'claim-3',
  reservationId: 'reservation-3',
  dailyLimit: 2,
  now,
})
assert.equal(exhausted.allowed, false)
assert.equal(exhausted.reason, 'lender_hunter_daily_budget_exhausted')
const duplicate = reserveLenderHunterBudget({
  metrics,
  lenderId: 'lender-1',
  claimId: 'claim-1',
  reservationId: 'reservation-retry',
  dailyLimit: 10,
  now,
})
assert.equal(duplicate.allowed, false)
assert.equal(duplicate.reason, 'lender_hunter_claim_already_reserved')
const reset = reserveLenderHunterBudget({
  metrics,
  lenderId: 'lender-next-day',
  claimId: 'claim-next-day',
  reservationId: 'reservation-next-day',
  dailyLimit: 2,
  now: new Date('2026-09-15T05:00:00.000Z'),
})
assert.equal(reset.allowed, true)
assert.equal(reset.attemptCount, 1)
assert.equal(normalizeLenderHunterBudget(null, now).valid, false)
assert.equal(normalizeLenderHunterBudget({
  budgetDate: '2026-09-15',
  attemptCount: 0,
  attemptMarkers: [],
}, now).valid, false)

const outcome = (failed: boolean, id: string): LenderScoringOutcome => ({
  scored: failed ? null : ({ id } as never),
  failed,
  hunterAttempted: !failed,
  result: { lenderId: id, name: id, confidenceScore: failed ? null : 80, status: failed ? 'error' : 'enriched' },
})
assert.deepEqual(summarizeLenderScoringOutcomes([outcome(false, '1'), outcome(true, '2')]), {
  ok: false,
  partial: true,
  errorCount: 1,
  scoredCount: 1,
  hunterAttempted: 1,
})
assert.equal(summarizeLenderScoringOutcomes([outcome(true, '1')]).partial, false)

const serviceSource = readFileSync(resolve(process.cwd(), 'lib/lenders/service.ts'), 'utf8')
const claimIndex = serviceSource.indexOf('claimLenderForHunterEnrichment({ lender, claimId })')
const budgetIndex = serviceSource.indexOf('reserveLenderHunterDailyLookup({')
const providerIndex = serviceSource.indexOf('hunterResult = await enrichContactFromHunter({')
assert.ok(claimIndex >= 0 && budgetIndex > claimIndex && providerIndex > budgetIndex)
assert.match(serviceSource, /LENDER_ENRICHMENT_PREFER_FREE\?\.trim\(\)\.toLowerCase\(\) === 'false'/)
assert.match(serviceSource, /Promise\.allSettled/)
assert.match(serviceSource, /const effectiveLimit = Math\.min\(50, Math\.max\(1, normalizedLimit\)\)/)
assert.match(serviceSource, /if \(!existingContactEmail && freshHunterClaim\)/)
assert.doesNotMatch(serviceSource, /primaryCandidate:\s*hunterResult\.primaryCandidate/)
assert.doesNotMatch(serviceSource, /candidates:\s*hunterResult\.candidates/)

const repositorySource = readFileSync(resolve(process.cwd(), 'lib/lenders/repository.ts'), 'utf8')
assert.match(repositorySource, /\.eq\('updated_at', input\.expectedUpdatedAt\)/)
assert.match(repositorySource, /query\.is\('contact_email', null\)/)
assert.match(repositorySource, /query\.eq\('contact_email', input\.expectedContactEmail\)/)
assert.match(repositorySource, /query\.contains\('metadata_json'/)

const automationSource = readFileSync(resolve(process.cwd(), 'lib/lenders/automation.ts'), 'utf8')
assert.match(automationSource, /envInt\('LENDERS_PIPELINE_SCORE_LIMIT_CAP', 30\)/)
assert.match(automationSource, /runDailyLenderScoring\(scoringLimit\)/)
assert.match(automationSource, /if \(!result\.ok\)/)

console.log('Lender Hunter enrichment safety tests passed.')
