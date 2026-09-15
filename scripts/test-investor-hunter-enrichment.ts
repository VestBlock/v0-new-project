import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildSanitizedInvestorHunterMetadata,
  isInvestorHunterEnrichmentEligible,
  mergeInvestorRediscoveryInput,
} from '../lib/investors/repository'
import { hunterLookupStatusForHttp } from '../lib/email/hunter'
import { companyWebsiteDomain } from '../lib/email/companyDomain'
import { isBuyerHunterEnrichmentEligible } from '../lib/buyers/service'
import {
  processInvestorHunterEnrichmentRecord,
  selectVerifiedInvestorHunterCandidate,
  summarizeInvestorHunterEnrichmentOutcomes,
} from '../lib/investors/service'
import type { HunterContactLookupResult } from '../lib/email/hunter'
import type { InvestorProfileRecord } from '../lib/investors/types'
import {
  INVESTOR_HUNTER_BUDGET_HARD_LIMIT,
  investorHunterBudgetDateKey,
  nextInvestorHunterCasTimestamp,
  normalizeInvestorHunterBudget,
  reserveInvestorHunterBudget,
  type InvestorHunterBudgetMetrics,
} from '../lib/investors/hunterBudgetCore'

const existing = {
  id: '30000000-0000-4000-8000-000000000010',
  display_name: 'Legacy Capital Partners',
  person_name: 'Jordan Reed',
  llc_name: 'Legacy Capital LLC',
  company_name: 'Legacy Capital Partners',
  primary_investor_type: 'buy_and_hold',
  classification_tags: ['landlord'],
  contact_email: 'jordan@legacycapitalpartners.com',
  contact_phone: '555-0100',
  website: 'https://legacycapitalpartners.com',
  linkedin_url: 'https://linkedin.com/company/legacy-capital',
  facebook_url: 'https://facebook.com/legacy-capital',
  markets: ['Cleveland, OH'],
  property_types: ['single_family'],
  estimated_buy_box: { priceMax: 350000 },
  financing_indicators: ['dscr'],
  source_names: ['county_records'],
  source_confidence_score: 82,
  metadata_json: { sourceIdentity: 'website:https://legacycapitalpartners.com' },
  automation_flags_json: {},
  notes: 'Confirmed local landlord profile.',
} as unknown as InvestorProfileRecord

const merged = mergeInvestorRediscoveryInput(
  {
    displayName: 'Legacy Capital Partners',
    sourceIdentity: 'website:https://legacycapitalpartners.com',
    contactEmail: null,
    contactPhone: null,
    website: null,
    classificationTags: [],
    markets: ['Columbus, OH'],
    propertyTypes: [],
    sourceNames: ['google_places'],
  },
  existing
)
assert.equal(merged.contactEmail, existing.contact_email)
assert.equal(merged.contactPhone, existing.contact_phone)
assert.equal(merged.website, existing.website)
assert.equal(merged.companyName, existing.company_name)
assert.equal(merged.linkedinUrl, existing.linkedin_url)
assert.deepEqual(merged.classificationTags, ['landlord'])
assert.deepEqual(merged.markets, ['Cleveland, OH', 'Columbus, OH'])
assert.deepEqual(merged.propertyTypes, ['single_family'])
assert.deepEqual(merged.sourceNames, ['county_records', 'google_places'])
assert.deepEqual(merged.estimatedBuyBox, existing.estimated_buy_box)

const invalidExisting = {
  ...existing,
  contact_email: 'info@legacycapitalpartners.com',
} as InvestorProfileRecord
const repairedMerge = mergeInvestorRediscoveryInput(
  {
    displayName: existing.display_name,
    sourceIdentity: 'website:https://legacycapitalpartners.com',
    contactEmail: 'owner@legacycapitalpartners.com',
    website: existing.website,
  },
  invalidExisting
)
assert.equal(repairedMerge.contactEmail, 'owner@legacycapitalpartners.com')
const clearedMerge = mergeInvestorRediscoveryInput(
  {
    displayName: existing.display_name,
    sourceIdentity: 'website:https://legacycapitalpartners.com',
    contactEmail: null,
    website: existing.website,
  },
  invalidExisting
)
assert.equal(clearedMerge.contactEmail, null)

const now = new Date('2026-09-14T12:00:00.000Z')
assert.equal(investorHunterBudgetDateKey(new Date('2026-09-14T04:59:59.000Z')), '2026-09-13')
assert.equal(investorHunterBudgetDateKey(new Date('2026-09-14T05:00:00.000Z')), '2026-09-14')

let hunterBudgetMetrics: InvestorHunterBudgetMetrics = {
  budgetDate: '2026-09-14',
  attemptCount: 0,
  attemptMarkers: [],
}
for (let attempt = 1; attempt <= 2; attempt += 1) {
  const decision = reserveInvestorHunterBudget({
    metrics: hunterBudgetMetrics,
    investorId: `investor-${attempt}`,
    claimId: `claim-${attempt}`,
    reservationId: `reservation-${attempt}`,
    dailyLimit: 2,
    now,
  })
  assert.equal(decision.allowed, true)
  assert.equal(decision.attemptCount, attempt)
  hunterBudgetMetrics = decision.metrics
}
const exhaustedHunterBudget = reserveInvestorHunterBudget({
  metrics: hunterBudgetMetrics,
  investorId: 'investor-3',
  claimId: 'claim-3',
  reservationId: 'reservation-3',
  dailyLimit: 2,
  now,
})
assert.equal(exhaustedHunterBudget.allowed, false)
assert.equal(exhaustedHunterBudget.reason, 'investor_hunter_daily_budget_exhausted')
const duplicateHunterClaim = reserveInvestorHunterBudget({
  metrics: hunterBudgetMetrics,
  investorId: 'investor-1',
  claimId: 'claim-1',
  reservationId: 'reservation-retry',
  dailyLimit: 10,
  now,
})
assert.equal(duplicateHunterClaim.allowed, false)
assert.equal(duplicateHunterClaim.reason, 'investor_hunter_claim_already_reserved')
const resetHunterBudget = reserveInvestorHunterBudget({
  metrics: hunterBudgetMetrics,
  investorId: 'investor-next-day',
  claimId: 'claim-next-day',
  reservationId: 'reservation-next-day',
  dailyLimit: 2,
  now: new Date('2026-09-15T05:00:00.000Z'),
})
assert.equal(resetHunterBudget.allowed, true)
assert.equal(resetHunterBudget.attemptCount, 1)
assert.equal(normalizeInvestorHunterBudget(null, now).valid, false)
assert.equal(normalizeInvestorHunterBudget({
  budgetDate: '2026-09-15',
  attemptCount: 0,
  attemptMarkers: [],
}, now).valid, false)
assert.equal(normalizeInvestorHunterBudget({
  budgetDate: '2026-09-14',
  attemptCount: 1,
  attemptMarkers: [],
}, now).valid, false)

let hardCappedMetrics: InvestorHunterBudgetMetrics = {
  budgetDate: '2026-09-14',
  attemptCount: 0,
  attemptMarkers: [],
}
for (let attempt = 1; attempt <= INVESTOR_HUNTER_BUDGET_HARD_LIMIT; attempt += 1) {
  const decision = reserveInvestorHunterBudget({
    metrics: hardCappedMetrics,
    investorId: `hard-capped-investor-${attempt}`,
    claimId: `hard-capped-claim-${attempt}`,
    reservationId: `hard-capped-reservation-${attempt}`,
    dailyLimit: 1_000,
    now,
  })
  assert.equal(decision.allowed, true)
  hardCappedMetrics = decision.metrics
}
const overHardCap = reserveInvestorHunterBudget({
  metrics: hardCappedMetrics,
  investorId: 'hard-capped-investor-over-limit',
  claimId: 'hard-capped-claim-over-limit',
  reservationId: 'hard-capped-reservation-over-limit',
  dailyLimit: 1_000,
  now,
})
assert.equal(overHardCap.allowed, false)
assert.equal(overHardCap.reason, 'investor_hunter_daily_budget_exhausted')
assert.equal(
  nextInvestorHunterCasTimestamp('2026-09-14T12:00:00.000Z', now),
  '2026-09-14T12:00:00.001Z'
)
assert.equal(hunterLookupStatusForHttp(500), 'error')
assert.equal(hunterLookupStatusForHttp(503), 'error')
assert.equal(hunterLookupStatusForHttp(408), 'error')
assert.equal(hunterLookupStatusForHttp(429), 'error')
assert.equal(hunterLookupStatusForHttp(404), 'not_found')
assert.equal(companyWebsiteDomain('https://www.legitcapital.com/about'), 'legitcapital.com')
assert.equal(companyWebsiteDomain('https://linkedin.com/company/legit-capital'), null)
assert.equal(companyWebsiteDomain('https://business.facebook.com/legit-capital'), null)
assert.equal(companyWebsiteDomain('https://yelp.com/biz/legit-capital'), null)
const buyerHunterBase = {
  contact_email: 'info@buyer.example',
  website: 'https://buyer.example',
  metadata_json: {},
}
assert.equal(isBuyerHunterEnrichmentEligible(buyerHunterBase, now), true)
assert.equal(isBuyerHunterEnrichmentEligible({ ...buyerHunterBase, contact_email: 'owner@buyer.example' }, now), false)
assert.equal(isBuyerHunterEnrichmentEligible({ ...buyerHunterBase, website: 'https://linkedin.com/company/buyer' }, now), false)
assert.equal(isBuyerHunterEnrichmentEligible({
  ...buyerHunterBase,
  metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T07:00:01.000Z' } },
}, now), false)
assert.equal(isBuyerHunterEnrichmentEligible({
  ...buyerHunterBase,
  metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T06:00:00.000Z' } },
}, now), true)
const enrichmentBase = {
  contact_email: null,
  website: 'https://www.legitcapital.com/about',
  metadata_json: {},
}
assert.equal(isInvestorHunterEnrichmentEligible(enrichmentBase, now), true)
assert.equal(
  isInvestorHunterEnrichmentEligible(
    {
      ...enrichmentBase,
      metadata_json: { hunterContactEnrichment: { status: 'not_found', checkedAt: '2026-08-16T12:00:00.000Z' } },
    },
    now
  ),
  false
)
assert.equal(
  isInvestorHunterEnrichmentEligible(
    {
      ...enrichmentBase,
      metadata_json: { hunterContactEnrichment: { status: 'not_found', checkedAt: '2026-08-15T12:00:00.000Z' } },
    },
    now
  ),
  true
)
assert.equal(isInvestorHunterEnrichmentEligible({ ...enrichmentBase, contact_email: 'owner@legitcapital.com' }, now), false)
assert.equal(isInvestorHunterEnrichmentEligible({ ...enrichmentBase, contact_email: 'info@legitcapital.com' }, now), true)
assert.equal(isInvestorHunterEnrichmentEligible({ ...enrichmentBase, contact_email: 'not-an-email' }, now), true)
assert.equal(
  isInvestorHunterEnrichmentEligible({
    ...enrichmentBase,
    metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T07:00:01.000Z' } },
  }, now),
  false
)
assert.equal(
  isInvestorHunterEnrichmentEligible({
    ...enrichmentBase,
    metadata_json: { hunterContactEnrichment: { status: 'error', checkedAt: '2026-09-14T06:00:00.000Z' } },
  }, now),
  true
)
assert.equal(
  isInvestorHunterEnrichmentEligible({
    ...enrichmentBase,
    metadata_json: { hunterContactEnrichment: { status: 'checking', checkedAt: '2026-09-14T10:00:01.000Z' } },
  }, now),
  false
)
assert.equal(
  isInvestorHunterEnrichmentEligible({
    ...enrichmentBase,
    metadata_json: { hunterContactEnrichment: { status: 'checking', checkedAt: '2026-09-14T10:00:00.000Z' } },
  }, now),
  true
)
assert.equal(isInvestorHunterEnrichmentEligible({ ...enrichmentBase, website: 'not a website' }, now), false)
assert.equal(isInvestorHunterEnrichmentEligible({ ...enrichmentBase, website: 'https://linkedin.com/company/foo' }, now), false)

const rejected = buildSanitizedInvestorHunterMetadata({
  status: 'found',
  domain: 'legitcapital.com',
  organization: 'Legit Capital\nPartners',
  checkedAt: now.toISOString(),
  candidate: {
    email: 'founder@legitcapital.com',
    fullName: 'Taylor Morgan',
    confidence: 89,
    verificationStatus: 'valid',
  },
})
assert.equal(rejected.candidate, null)
assert.equal(rejected.metadata.accepted, false)
assert.equal(rejected.metadata.organization, 'Legit Capital Partners')
assert.equal(JSON.stringify(rejected.metadata).includes('founder@legitcapital.com'), false)

const accepted = buildSanitizedInvestorHunterMetadata({
  status: 'found',
  domain: 'legitcapital.com',
  checkedAt: now.toISOString(),
  candidate: {
    email: 'Founder@LegitCapital.com',
    fullName: 'Taylor Morgan',
    confidence: 90,
    verificationStatus: 'valid',
  },
})
assert.equal(accepted.candidate?.email, 'founder@legitcapital.com')
assert.equal(accepted.candidate?.verificationStatus, 'valid')
assert.equal(accepted.metadata.accepted, true)

const sanitizedBudgetMetadata = buildSanitizedInvestorHunterMetadata({
  status: 'error',
  domain: 'legitcapital.com',
  checkedAt: now.toISOString(),
  claimId: '00000000-0000-4000-8000-000000000001',
  reservationId: 'hunter_api_key_must_not_persist',
  budgetReason: 'provider response contained a secret',
  candidate: null,
})
assert.equal(sanitizedBudgetMetadata.metadata.claimId, '00000000-0000-4000-8000-000000000001')
assert.equal(sanitizedBudgetMetadata.metadata.reservationId, null)
assert.equal(sanitizedBudgetMetadata.metadata.budgetReason, null)
assert.doesNotMatch(JSON.stringify(sanitizedBudgetMetadata), /must_not_persist|contained a secret/)

const selected = selectVerifiedInvestorHunterCandidate([
  {
    email: 'founder@legitcapital.com',
    fullName: 'Taylor Morgan',
    position: 'Founder',
    department: null,
    seniority: 'executive',
    confidence: 92,
    verificationStatus: 'valid',
    score: 20,
    sourceUrls: [],
  },
  {
    email: 'other@legitcapital.com',
    fullName: 'Other Person',
    position: null,
    department: null,
    seniority: null,
    confidence: 99,
    verificationStatus: 'accept_all',
    score: 30,
    sourceUrls: [],
  },
  {
    email: 'info@legitcapital.com',
    fullName: null,
    position: null,
    department: null,
    seniority: null,
    confidence: 99,
    verificationStatus: 'valid',
    score: 40,
    sourceUrls: [],
  },
])
assert.equal(selected?.email, 'founder@legitcapital.com')

const relevanceSelected = selectVerifiedInvestorHunterCandidate([
  {
    email: 'unrelated.employee@legitcapital.com',
    fullName: 'Unrelated Employee',
    position: 'Coordinator',
    department: null,
    seniority: null,
    confidence: 99,
    verificationStatus: 'valid',
    score: 20,
    sourceUrls: [],
  },
  {
    email: 'matched.founder@legitcapital.com',
    fullName: 'Matched Founder',
    position: 'Founder',
    department: 'Acquisitions',
    seniority: 'executive',
    confidence: 91,
    verificationStatus: 'valid',
    score: 38,
    sourceUrls: [],
  },
])
assert.equal(relevanceSelected?.email, 'matched.founder@legitcapital.com')

const workerInvestor = {
  ...existing,
  contact_email: null,
  person_name: null,
  metadata_json: {},
} as InvestorProfileRecord

const foundLookup = {
  status: 'found',
  domain: 'legacycapitalpartners.com',
  organization: 'Legacy Capital Partners',
  pattern: '{first}',
  note: 'Candidate found.',
  primaryCandidate: selected,
  candidates: selected ? [selected] : [],
} satisfies HunterContactLookupResult

const errorLookup = {
  ...foundLookup,
  status: 'error',
  note: 'Provider unavailable.',
  primaryCandidate: null,
  candidates: [],
} satisfies HunterContactLookupResult

const allowHunterReservation = async () => ({
  allowed: true,
  reason: null,
  reservationId: '00000000-0000-4000-8000-000000000099',
  attemptCount: 1,
  remaining: 19,
})

async function runWorkerFailureAssertions() {
  const returnedErrorWrites: Array<Record<string, unknown>> = []
  const returnedError = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: allowHunterReservation,
    lookupContact: async () => errorLookup,
    saveResult: async (input) => {
      returnedErrorWrites.push(input.enrichment as unknown as Record<string, unknown>)
      return {
        ...workerInvestor,
        metadata_json: { hunterContactEnrichment: { status: input.enrichment.status } },
      }
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(returnedError.failed, true)
  assert.equal(returnedError.result.status, 'error')
  assert.equal(returnedError.result.reason, 'hunter_lookup_failed')
  assert.equal(returnedError.result.errorStatePersisted, true)
  assert.equal(returnedErrorWrites[0]?.status, 'error')

  const thrownLookupWrites: Array<Record<string, unknown>> = []
  const thrownLookup = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: allowHunterReservation,
    lookupContact: async () => {
      throw new Error('Hunter request failed with api_key=must-not-escape')
    },
    saveResult: async (input) => {
      thrownLookupWrites.push(input.enrichment as unknown as Record<string, unknown>)
      return {
        ...workerInvestor,
        metadata_json: { hunterContactEnrichment: { status: input.enrichment.status } },
      }
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(thrownLookup.failed, true)
  assert.equal(thrownLookup.result.reason, 'hunter_lookup_failed')
  assert.equal(thrownLookup.result.errorStatePersisted, true)
  assert.equal(thrownLookupWrites[0]?.status, 'error')
  assert.equal(JSON.stringify(thrownLookup).includes('must-not-escape'), false)

  const persistenceWrites: Array<Record<string, unknown>> = []
  const persistenceFailure = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: allowHunterReservation,
    lookupContact: async () => foundLookup,
    saveResult: async (input) => {
      persistenceWrites.push(input.enrichment as unknown as Record<string, unknown>)
      if (persistenceWrites.length === 1) throw new Error('database connection contained a secret')
      return {
        ...workerInvestor,
        metadata_json: { hunterContactEnrichment: { status: input.enrichment.status } },
      }
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(persistenceFailure.failed, true)
  assert.equal(persistenceFailure.result.reason, 'record_persistence_failed')
  assert.equal(persistenceFailure.result.errorStatePersisted, true)
  assert.equal(persistenceWrites[1]?.status, 'error')
  assert.equal(JSON.stringify(persistenceFailure).includes('secret'), false)

  const duplicateWrites: Array<Record<string, unknown>> = []
  const duplicateContact = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: allowHunterReservation,
    lookupContact: async () => foundLookup,
    saveResult: async (input) => {
      duplicateWrites.push(input.enrichment as unknown as Record<string, unknown>)
      if (duplicateWrites.length === 1) throw { code: '23505', message: 'duplicate key value' }
      return {
        ...workerInvestor,
        metadata_json: { hunterContactEnrichment: { status: input.enrichment.status } },
      }
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(duplicateContact.failed, false)
  assert.equal(duplicateContact.result.status, 'duplicate_contact')
  assert.equal(duplicateWrites.length, 2)
  assert.equal(duplicateWrites[1]?.status, 'found')
  assert.equal(duplicateWrites[1]?.candidate, null)

  const orderedStages: string[] = []
  const ordered = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => {
      orderedStages.push('claim')
      return workerInvestor
    },
    reserveLookup: async () => {
      orderedStages.push('reserve')
      return allowHunterReservation()
    },
    lookupContact: async () => {
      orderedStages.push('lookup')
      return foundLookup
    },
    saveResult: async () => {
      orderedStages.push('persist')
      return workerInvestor
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(ordered.failed, false)
  assert.deepEqual(orderedStages, ['claim', 'reserve', 'lookup', 'persist'])

  let deniedLookupCalls = 0
  const deniedWrites: Array<Record<string, unknown>> = []
  const budgetDenied = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: async () => ({
      allowed: false,
      reason: 'investor_hunter_daily_budget_exhausted',
      attemptCount: 20,
      remaining: 0,
    }),
    lookupContact: async () => {
      deniedLookupCalls += 1
      return foundLookup
    },
    saveResult: async (input) => {
      deniedWrites.push(input.enrichment as unknown as Record<string, unknown>)
      return workerInvestor
    },
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(budgetDenied.failed, false)
  assert.equal(budgetDenied.result.status, 'skipped_budget')
  assert.equal(budgetDenied.result.reason, 'investor_hunter_daily_budget_exhausted')
  assert.equal(deniedLookupCalls, 0)
  assert.equal(deniedWrites[0]?.status, 'skipped')
  assert.equal(deniedWrites[0]?.budgetReason, 'investor_hunter_daily_budget_exhausted')

  const unavailableBudget = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: async () => ({
      allowed: false,
      reason: 'budget_state_is_invalid',
      attemptCount: 0,
      remaining: 0,
    }),
    lookupContact: async () => {
      throw new Error('lookup must not start without a reservation')
    },
    saveResult: async () => workerInvestor,
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(unavailableBudget.failed, true)
  assert.equal(unavailableBudget.result.reason, 'hunter_budget_reservation_failed')

  let unavailableLookupCalls = 0
  const thrownBudget = await processInvestorHunterEnrichmentRecord(workerInvestor, {
    now: () => now,
    claimInvestor: async () => workerInvestor,
    reserveLookup: async () => {
      throw new Error('database failure with credential that must not escape')
    },
    lookupContact: async () => {
      unavailableLookupCalls += 1
      return foundLookup
    },
    saveResult: async () => workerInvestor,
    recordEnrichedEvent: async () => undefined,
  })
  assert.equal(thrownBudget.failed, true)
  assert.equal(thrownBudget.result.reason, 'hunter_budget_reservation_failed')
  assert.equal(unavailableLookupCalls, 0)
  assert.doesNotMatch(JSON.stringify(thrownBudget), /credential that must not escape/)

  const summary = summarizeInvestorHunterEnrichmentOutcomes([
    duplicateContact,
    persistenceFailure,
  ])
  assert.deepEqual(summary, { ok: false, partial: true, errorCount: 1 })
}

const serviceSource = readFileSync(resolve(process.cwd(), 'lib/investors/service.ts'), 'utf8')
assert.match(serviceSource, /\.not\('sent_at', 'is', null\)[\s\S]*?\.gte\('sent_at', since\)/)
assert.match(serviceSource, /getCommercialOutreachMailingAddress\(\)/)
assert.match(serviceSource, /INVESTORS_HUNTER_CONCURRENCY/)
assert.match(serviceSource, /reserveInvestorHunterDailyLookup/)
assert.match(serviceSource, /Promise\.allSettled\(\s*batch\.map/)
assert.match(serviceSource, /status: 'error'/)
assert.match(serviceSource, /status: summary\.ok \? 'completed' : 'failed'/)
assert.match(serviceSource, /return \{[\s\S]*?\.\.\.summary,[\s\S]*?configured: true/)
const automationSource = readFileSync(resolve(process.cwd(), 'lib/investors/automation.ts'), 'utf8')
assert.match(automationSource, /runDailyInvestorHunterEnrichment\(dailyLaneTarget\)\.catch/)
assert.match(automationSource, /investor_enrichment_stage_failed/)
assert.doesNotMatch(serviceSource, /runType: 'contact_enrichment'/)
assert.match(serviceSource, /runType: 'scoring',[\s\S]*?hunter_investor_domain_search/)
assert.ok(
  serviceSource.indexOf('evaluateInvestorAutoApproval({', serviceSource.indexOf('runDailyInvestorSend')) <
    serviceSource.indexOf('claimInvestorOutreachMessageForSend(row.id, row.updated_at)', serviceSource.indexOf('runDailyInvestorSend'))
)
assert.match(serviceSource, /downgradeInvestorOutreachMessageIfApproved[\s\S]*?approvalRevalidation/)
const repositorySource = readFileSync(resolve(process.cwd(), 'lib/investors/repository.ts'), 'utf8')
assert.match(
  repositorySource,
  /downgradeInvestorOutreachMessageIfApproved[\s\S]*?\.eq\('status', 'approved'\)[\s\S]*?\.is\('sent_at', null\)/
)
assert.match(repositorySource, /COMMON_INVALID_CONTACT_PREFIXES/)
assert.match(repositorySource, /\.is\('contact_email', null\)[\s\S]*?commonInvalid[\s\S]*?\.range\(offset, offset \+ pageSize - 1\)/)
assert.match(repositorySource, /const completedAt = new Date\([\s\S]*?updated_at: completedAt/)
assert.match(repositorySource, /updateError\?\.code === '23505'[\s\S]*?status: 'duplicate_contact'[\s\S]*?accepted: false/)
assert.match(repositorySource, /hunterContactEnrichment: \{ claimId: expectedClaimId \}/)
const budgetRuntimeSource = readFileSync(resolve(process.cwd(), 'lib/investors/hunterBudget.ts'), 'utf8')
assert.match(budgetRuntimeSource, /job_type: 'suppression_sync'/)
assert.match(budgetRuntimeSource, /\.eq\('updated_at', row\.updated_at\)/)
assert.match(budgetRuntimeSource, /reserveInvestorHunterBudget/)
const buyerServiceSource = readFileSync(resolve(process.cwd(), 'lib/buyers/service.ts'), 'utf8')
assert.match(buyerServiceSource, /BUYER_ENRICHMENT_PREFER_FREE\?\.trim\(\)\.toLowerCase\(\) === 'false'/)
assert.match(buyerServiceSource, /BUYERS_DAILY_HUNTER_LOOKUP_LIMIT/)
assert.match(buyerServiceSource, /BUYERS_SCORING_CONCURRENCY/)
assert.match(buyerServiceSource, /Promise\.all\(batch\.map/)
assert.doesNotMatch(buyerServiceSource, /primaryCandidate:\s*hunterResult\.primaryCandidate/)

runWorkerFailureAssertions()
  .then(() => console.log('investor-hunter-enrichment: ok'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
