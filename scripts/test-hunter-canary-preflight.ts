import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  normalizeHunterEmailVerificationStatus,
  verifyEmailWithHunter,
  type HunterEmailVerificationStatus,
} from '../lib/email/hunterVerifier'
import {
  buildHunterCanaryVerificationEvidence,
  getFreshHunterCanaryVerificationEvidence,
  isLenderCanaryPreCandidate,
  lenderCanaryCandidateScanLimit,
  preflightLenderRecoveryCanaryEmail,
  withHunterCanaryVerificationEvidence,
} from '../lib/lenders/canary'

async function main() {
const now = new Date('2026-09-15T17:00:00.000Z')
const email = 'partner@trustedcapital.com'

let capturedUrl = ''
let capturedHeaders = new Headers()
const validFetch: typeof fetch = async (request, init) => {
  capturedUrl = String(request)
  capturedHeaders = new Headers(init?.headers)
  return new Response(JSON.stringify({ data: { email, status: 'valid' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
const validResult = await verifyEmailWithHunter({
  email: ' Partner@TrustedCapital.com ',
  apiKey: 'hunter-test-key',
  now,
  fetchImpl: validFetch,
})
assert.deepEqual(validResult, {
  status: 'valid',
  checkedAt: now.toISOString(),
  cacheable: true,
  reason: 'hunter_valid',
})
const verifierUrl = new URL(capturedUrl)
assert.equal(verifierUrl.origin + verifierUrl.pathname, 'https://api.hunter.io/v2/email-verifier')
assert.equal(verifierUrl.searchParams.get('email'), email)
assert.equal(verifierUrl.searchParams.has('api_key'), false)
assert.equal(capturedHeaders.get('x-api-key'), 'hunter-test-key')
assert.equal(capturedHeaders.get('authorization'), null)

for (const status of ['accept_all', 'invalid', 'unknown', 'webmail', 'disposable'] as const) {
  const result = await verifyEmailWithHunter({
    email,
    apiKey: 'hunter-test-key',
    now,
    fetchImpl: async () => new Response(JSON.stringify({ data: { email, status } }), { status: 200 }),
  })
  assert.equal(result.status, status)
  assert.equal(result.cacheable, true)
  assert.notEqual(result.status, 'valid')
}
assert.equal(normalizeHunterEmailVerificationStatus('unexpected-provider-value'), 'unknown')

let missingKeyFetchCalled = false
const missingKey = await verifyEmailWithHunter({
  email,
  apiKey: '',
  now,
  fetchImpl: async () => {
    missingKeyFetchCalled = true
    throw new Error('must not call Hunter without a key')
  },
})
assert.equal(missingKeyFetchCalled, false)
assert.equal(missingKey.cacheable, false)
assert.equal(missingKey.reason, 'hunter_api_key_missing')

const pendingResult = await verifyEmailWithHunter({
  email,
  apiKey: 'hunter-test-key',
  now,
  fetchImpl: async () => new Response(null, { status: 202 }),
})
assert.equal(pendingResult.status, 'unknown')
assert.equal(pendingResult.cacheable, true)

const mismatchedResult = await verifyEmailWithHunter({
  email,
  apiKey: 'hunter-test-key',
  now,
  fetchImpl: async () => new Response(
    JSON.stringify({ data: { email: 'someone-else@trustedcapital.com', status: 'valid' } }),
    { status: 200 }
  ),
})
assert.equal(mismatchedResult.status, 'unknown')
assert.equal(mismatchedResult.cacheable, false)
assert.equal(mismatchedResult.reason, 'hunter_email_mismatch')

const unboundResult = await verifyEmailWithHunter({
  email,
  apiKey: 'hunter-test-key',
  now,
  fetchImpl: async () => new Response(
    JSON.stringify({ data: { status: 'valid' } }),
    { status: 200 }
  ),
})
assert.equal(unboundResult.status, 'unknown')
assert.equal(unboundResult.cacheable, false)
assert.equal(unboundResult.reason, 'hunter_email_missing')

const sanitizedPreCandidate = {
  contact_email: email,
  metadata_json: {
    hunterContactEnrichment: {
      provider: 'hunter',
      status: 'found',
      checkedAt: '2026-06-01T12:00:00.000Z',
      accepted: true,
      acceptedConfidence: 95,
      acceptedVerificationStatus: 'valid',
    },
  },
}
assert.equal(isLenderCanaryPreCandidate({
  lender: sanitizedPreCandidate,
  channel: 'email_followup',
  hasPriorInitialSend: true,
  suppressed: false,
}), true)
assert.equal(isLenderCanaryPreCandidate({
  lender: {
    ...sanitizedPreCandidate,
    metadata_json: {
      hunterContactEnrichment: {
        accepted: true,
        acceptedConfidence: 99,
        acceptedVerificationStatus: 'accept_all',
      },
    },
  },
  channel: 'email_followup',
  hasPriorInitialSend: true,
  suppressed: false,
}), false)
assert.equal(isLenderCanaryPreCandidate({
  lender: {
    contact_email: email,
    metadata_json: {
      hunterContactEnrichment: {
        primaryCandidate: { email, confidence: 95, verificationStatus: 'valid' },
      },
    },
  },
  channel: 'email_followup',
  hasPriorInitialSend: true,
  suppressed: false,
}), true, 'legacy Hunter metadata remains only a pre-candidate signal')

const validEvidence = buildHunterCanaryVerificationEvidence({
  email,
  status: 'valid',
  checkedAt: now.toISOString(),
})
assert.deepEqual(Object.keys(validEvidence).sort(), ['checkedAt', 'emailHash', 'status'])
assert.doesNotMatch(JSON.stringify(validEvidence), /partner@trustedcapital\.com/i)
assert.deepEqual(getFreshHunterCanaryVerificationEvidence({
  email,
  metadata: withHunterCanaryVerificationEvidence({}, validEvidence),
  now,
}), validEvidence)
assert.equal(getFreshHunterCanaryVerificationEvidence({
  email: 'changed@trustedcapital.com',
  metadata: withHunterCanaryVerificationEvidence({}, validEvidence),
  now,
}), null, 'a cached verdict cannot be reused after the recipient changes')

let freshCacheVerifierCalls = 0
const freshCachePreflight = await preflightLenderRecoveryCanaryEmail({
  lender: {
    contact_email: email,
    metadata_json: withHunterCanaryVerificationEvidence({}, validEvidence),
  },
  allowLiveLookup: true,
  now,
  verify: async () => {
    freshCacheVerifierCalls += 1
    throw new Error('fresh cache must avoid a paid Hunter call')
  },
  persist: async () => {
    throw new Error('fresh cache must not be rewritten')
  },
})
assert.equal(freshCachePreflight.allowed, true)
assert.equal(freshCachePreflight.source, 'cache')
assert.equal(freshCacheVerifierCalls, 0)

const negativeEvidence = buildHunterCanaryVerificationEvidence({
  email,
  status: 'accept_all',
  checkedAt: now.toISOString(),
})
let negativeCacheVerifierCalls = 0
const negativeCachePreflight = await preflightLenderRecoveryCanaryEmail({
  lender: {
    contact_email: email,
    metadata_json: withHunterCanaryVerificationEvidence({}, negativeEvidence),
  },
  allowLiveLookup: true,
  now,
  verify: async () => {
    negativeCacheVerifierCalls += 1
    throw new Error('fresh negative cache must avoid a paid Hunter call')
  },
  persist: async () => true,
})
assert.equal(negativeCachePreflight.allowed, false)
assert.equal(negativeCachePreflight.status, 'accept_all')
assert.equal(negativeCacheVerifierCalls, 0)

let deniedReservationVerifierCalls = 0
const deniedReservationPreflight = await preflightLenderRecoveryCanaryEmail({
  lender: { contact_email: email, metadata_json: {} },
  allowLiveLookup: true,
  now,
  reserve: async () => ({ allowed: false, reason: 'hunter_daily_budget_exhausted' }),
  verify: async () => {
    deniedReservationVerifierCalls += 1
    throw new Error('a denied CAS reservation must prevent the paid Hunter request')
  },
  persist: async () => true,
})
assert.equal(deniedReservationPreflight.allowed, false)
assert.equal(deniedReservationPreflight.source, 'not_checked')
assert.equal(deniedReservationPreflight.reason, 'hunter_daily_budget_exhausted')
assert.equal(deniedReservationVerifierCalls, 0)

const reservedCallOrder: string[] = []
const reservedPreflight = await preflightLenderRecoveryCanaryEmail({
  lender: { contact_email: email, metadata_json: {} },
  allowLiveLookup: true,
  now,
  reserve: async () => {
    reservedCallOrder.push('reserve')
    return { allowed: true, reason: null }
  },
  verify: async () => {
    reservedCallOrder.push('verify')
    return { status: 'valid', checkedAt: now.toISOString(), cacheable: true, reason: 'hunter_valid' }
  },
  persist: async () => {
    reservedCallOrder.push('persist')
    return true
  },
})
assert.equal(reservedPreflight.allowed, true)
assert.deepEqual(reservedCallOrder, ['reserve', 'verify', 'persist'])

const oldCheckedAt = new Date(now.getTime() - 105 * 24 * 60 * 60 * 1000).toISOString()
const oldEvidence = buildHunterCanaryVerificationEvidence({ email, status: 'valid', checkedAt: oldCheckedAt })
let staleVerifierCalls = 0
const persistedEvidence: Array<ReturnType<typeof buildHunterCanaryVerificationEvidence>> = []
const refreshedPreflight = await preflightLenderRecoveryCanaryEmail({
  lender: {
    contact_email: email,
    metadata_json: withHunterCanaryVerificationEvidence({}, oldEvidence),
  },
  allowLiveLookup: true,
  now,
  verify: async () => {
    staleVerifierCalls += 1
    return { status: 'valid', checkedAt: now.toISOString(), cacheable: true, reason: 'hunter_valid' }
  },
  persist: async (evidence) => {
    persistedEvidence.push(evidence)
    return true
  },
})
assert.equal(staleVerifierCalls, 1, '105-day-old evidence must trigger a fresh verifier call')
assert.equal(refreshedPreflight.allowed, true)
assert.equal(refreshedPreflight.source, 'hunter')
assert.equal(persistedEvidence[0]?.status, 'valid')

for (const status of ['accept_all', 'invalid', 'unknown'] as HunterEmailVerificationStatus[]) {
  const rejected = await preflightLenderRecoveryCanaryEmail({
    lender: { contact_email: email, metadata_json: {} },
    allowLiveLookup: true,
    now,
    verify: async () => ({ status, checkedAt: now.toISOString(), cacheable: true, reason: `hunter_${status}` }),
    persist: async () => true,
  })
  assert.equal(rejected.allowed, false, `${status} must never reach the provider send boundary`)
}

const unpersistedValid = await preflightLenderRecoveryCanaryEmail({
  lender: { contact_email: email, metadata_json: {} },
  allowLiveLookup: true,
  now,
  verify: async () => ({ status: 'valid', checkedAt: now.toISOString(), cacheable: true, reason: 'hunter_valid' }),
  persist: async () => false,
})
assert.equal(unpersistedValid.allowed, false, 'valid proof must be auditable before sending')
assert.equal(unpersistedValid.reason, 'hunter_verification_cache_write_failed')

assert.equal(lenderCanaryCandidateScanLimit(5), 20)
assert.equal(lenderCanaryCandidateScanLimit(1), 10)
assert.equal(lenderCanaryCandidateScanLimit(0), 0)

const simulatedStatuses: HunterEmailVerificationStatus[] = [
  'invalid',
  'accept_all',
  'unknown',
  'valid',
  'invalid',
  'valid',
  'valid',
  'accept_all',
  'valid',
  'valid',
  'valid',
]
let simulatedProviderSends = 0
let simulatedScanned = 0
for (const status of simulatedStatuses.slice(0, lenderCanaryCandidateScanLimit(5))) {
  if (simulatedProviderSends >= 5) break
  simulatedScanned += 1
  if (status !== 'valid') continue
  simulatedProviderSends += 1
}
assert.equal(simulatedProviderSends, 5, 'rejected candidates are replaced from the wider approved scan')
assert.equal(simulatedScanned, 10)

const automationSource = readFileSync(resolve(process.cwd(), 'lib/lenders/automation.ts'), 'utf8')
const preflightOffset = automationSource.indexOf('preflightLenderRecoveryCanaryEmail({')
const claimOffset = automationSource.indexOf('claimLenderOutreachMessageForSend(row.id')
const providerOffset = automationSource.indexOf('sendLenderOutreachEmail({', claimOffset)
assert.ok(preflightOffset > 0 && preflightOffset < claimOffset && claimOffset < providerOffset)
assert.match(automationSource, /\(canary \? canaryProviderAttemptCount : providerAttemptCount\) >= effectiveLimit/)
assert.match(automationSource, /if \(canary\) canaryProviderAttemptCount \+= 1/)
assert.match(automationSource, /listLenderCanaryPreCandidates\(canaryScanLimit\)/)
assert.match(automationSource, /reserve: \(email\) => reserveHunterSendVerification/)
assert.match(
  automationSource,
  /hunterSendVerification: buildHunterSendVerificationCache\(\{[\s\S]*?status: hunterPreflight\.status/,
  'The canary result must seed the universal send-boundary cache and avoid a second paid lookup'
)

const lenderRepositorySource = readFileSync(resolve(process.cwd(), 'lib/lenders/repository.ts'), 'utf8')
assert.match(
  lenderRepositorySource,
  /cacheLenderHunterCanaryVerification[\s\S]*?hunterSendVerification/,
  'The address-bound sanitized canary result must be reusable by ordinary lender send boundaries'
)

console.log('hunter-canary-preflight: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
