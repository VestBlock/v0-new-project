import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  assessHunterSendVerificationCache,
  buildHunterSendVerificationCache,
  classifyHunterVerificationFailureScope,
  deriveHunterSendVerificationLimits,
} from '../lib/outreach/hunterSendVerificationCore'
import {
  leadHunterBudgetDateKey,
  reserveLeadHunterBudget,
  type LeadHunterBudgetMetrics,
} from '../lib/outreach/hunterSendVerificationBudgetCore'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const now = new Date('2026-09-15T16:00:00.000Z')
const valid = buildHunterSendVerificationCache({
  email: 'Owner@Example.com',
  status: 'valid',
  checkedAt: new Date(now.getTime() - 60 * 60 * 1_000).toISOString(),
})
assert.deepEqual(
  Object.keys(valid).sort(),
  ['checkedAt', 'emailHash', 'schemaVersion', 'status'],
  'The persisted Hunter cache must contain only the sanitized contract'
)
assert.equal(JSON.stringify(valid).includes('owner@example.com'), false, 'The cache must not retain the address')
assert.equal(
  assessHunterSendVerificationCache({ metadata: { hunterSendVerification: valid }, email: 'owner@example.com', now }).sendable,
  true,
  'A fresh address-bound valid result is sendable'
)
assert.equal(
  assessHunterSendVerificationCache({ metadata: { hunterSendVerification: valid }, email: 'other@example.com', now }).reason,
  'hunter_verification_email_changed',
  'Changing the recipient must invalidate the cached verification'
)

for (const status of ['accept_all', 'webmail', 'unknown', 'invalid', 'disposable'] as const) {
  const record = buildHunterSendVerificationCache({ email: 'owner@example.com', status, checkedAt: now.toISOString() })
  const assessment = assessHunterSendVerificationCache({
    metadata: { hunterSendVerification: record },
    email: 'owner@example.com',
    now,
  })
  assert.equal(assessment.fresh, true)
  assert.equal(assessment.sendable, false, `${status} must fail closed at the send boundary`)
}

for (const reason of ['hunter_email_missing', 'hunter_email_mismatch', 'hunter_timeout', 'hunter_verification_budget_unavailable']) {
  assert.equal(classifyHunterVerificationFailureScope(reason), 'infrastructure')
}
assert.equal(classifyHunterVerificationFailureScope('lead_hunter_daily_budget_exhausted'), 'global')
assert.equal(classifyHunterVerificationFailureScope('hunter_accept_all'), 'record')

const yesterdayAmbiguous = buildHunterSendVerificationCache({
  email: 'owner@example.com',
  status: 'accept_all',
  checkedAt: new Date(now.getTime() - 25 * 60 * 60 * 1_000).toISOString(),
})
assert.equal(
  assessHunterSendVerificationCache({
    metadata: { hunterSendVerification: yesterdayAmbiguous },
    email: 'owner@example.com',
    now,
  }).fresh,
  false,
  'Ambiguous addresses must return to replacement verification after one day instead of being stranded'
)

const stale = buildHunterSendVerificationCache({
  email: 'owner@example.com',
  status: 'valid',
  checkedAt: new Date(now.getTime() - 73 * 60 * 60 * 1_000).toISOString(),
})
assert.equal(
  assessHunterSendVerificationCache({ metadata: { hunterSendVerification: stale }, email: 'owner@example.com', now }).reason,
  'hunter_verification_stale'
)

assert.deepEqual(
  deriveHunterSendVerificationLimits({
    effectiveDailyCap: 1_000,
    requestedSendLimit: 30,
    globalRemaining: 900,
    leadLaneRemaining: 800,
  }),
  { dailyLimit: 1_000, perRunLimit: 30 },
  'The verifier may not spend beyond the current send opportunity'
)
assert.deepEqual(
  deriveHunterSendVerificationLimits({
    effectiveDailyCap: 5,
    requestedSendLimit: 30,
    globalRemaining: 4,
    leadLaneRemaining: 3,
    configuredDailyLimit: 100,
    configuredPerRunLimit: 20,
  }),
  { dailyLimit: 100, perRunLimit: 20 },
  'An explicit replacement budget may inspect more candidates than send slots without raising provider capacity'
)
assert.deepEqual(
  deriveHunterSendVerificationLimits({
    effectiveDailyCap: 5,
    requestedSendLimit: 4,
    globalRemaining: 0,
    leadLaneRemaining: 4,
    configuredDailyLimit: 100,
    configuredPerRunLimit: 20,
  }),
  { dailyLimit: 0, perRunLimit: 0 },
  'Hunter spend must remain closed when no provider-send opportunity exists'
)
assert.deepEqual(
  deriveHunterSendVerificationLimits({
    effectiveDailyCap: 0,
    requestedSendLimit: 30,
    globalRemaining: 30,
    leadLaneRemaining: 30,
  }),
  { dailyLimit: 0, perRunLimit: 0 },
  'A closed delivery gate must expose no Hunter spend allowance'
)

let metrics: LeadHunterBudgetMetrics = {
  budgetDate: leadHunterBudgetDateKey(now),
  attemptCount: 0,
  attemptMarkers: [],
}
for (let index = 0; index < 3; index += 1) {
  const decision = reserveLeadHunterBudget({
    metrics,
    claimHash: String(index + 1).padStart(64, 'a'),
    emailHash: String(index + 1).padStart(64, 'b'),
    reservationId: `reservation-${index}`,
    dailyLimit: 3,
    dailyHardLimit: 1_000,
    now,
  })
  assert.equal(decision.allowed, true)
  metrics = decision.metrics
}
const exhausted = reserveLeadHunterBudget({
  metrics,
  claimHash: 'c'.repeat(64),
  emailHash: 'd'.repeat(64),
  reservationId: 'reservation-exhausted',
  dailyLimit: 3,
  dailyHardLimit: 1_000,
  now,
})
assert.equal(exhausted.allowed, false)
assert.equal(exhausted.reason, 'lead_hunter_daily_budget_exhausted')

const duplicate = reserveLeadHunterBudget({
  metrics,
  claimHash: '1'.padStart(64, 'a'),
  emailHash: '1'.padStart(64, 'b'),
  reservationId: 'reservation-duplicate',
  dailyLimit: 3,
  dailyHardLimit: 1_000,
  now,
})
assert.equal(duplicate.allowed, false)
assert.equal(duplicate.reason, 'lead_hunter_claim_already_reserved')

const duplicateAddress = reserveLeadHunterBudget({
  metrics,
  claimHash: '9'.repeat(64),
  emailHash: '1'.padStart(64, 'b'),
  reservationId: 'reservation-duplicate-address',
  dailyLimit: 3,
  dailyHardLimit: 1_000,
  now,
})
assert.equal(duplicateAddress.allowed, false)
assert.equal(duplicateAddress.reason, 'lead_hunter_email_already_reserved')

const nextDay = new Date('2026-09-16T16:00:00.000Z')
const reset = reserveLeadHunterBudget({
  metrics,
  claimHash: 'e'.repeat(64),
  emailHash: 'f'.repeat(64),
  reservationId: 'reservation-next-day',
  dailyLimit: 3,
  dailyHardLimit: 1_000,
  now: nextDay,
})
assert.equal(reset.allowed, true)
assert.equal(reset.attemptCount, 1)
assert.equal(reset.metrics.budgetDate, leadHunterBudgetDateKey(nextDay))

const dailyAutomationSource = readFileSync(resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'), 'utf8')
assert.match(dailyAutomationSource, /options\.sendLimit \?\?/, 'An explicit zero send limit must keep verification closed')
assert.match(dailyAutomationSource, /!options\.dryRun[\s\S]*?ensureFreshHunterSendVerification/)
assert.match(dailyAutomationSource, /await getOperationalReplyCaptureReadiness\(\)/)
assert.match(dailyAutomationSource, /hunterVerification\.status !== 'valid'/)
assert.match(dailyAutomationSource, /hunter_verification_blocked[\s\S]*?continue/)
assert.match(dailyAutomationSource, /classifyHunterVerificationFailureScope\(reason\)[\s\S]*?break/)
assert.match(dailyAutomationSource, /hunterVerificationAttempts < hunterVerificationLimits\.perRunLimit/)

const strategyEngineSource = readFileSync(resolve(process.cwd(), 'lib/admin/strategyExecutionEngine.ts'), 'utf8')
assert.doesNotMatch(strategyEngineSource, /verifyEmailWithHunter|verifySelectedRecipients/)
assert.doesNotMatch(source('lib/leads/email-enrichment.ts'), /enrichContactFromHunter/)
assert.match(source('lib/email/hunter.ts'), /budgetReservationId: string/)
for (const governedHunterPath of [
  'lib/buyers/service.ts',
  'lib/lenders/service.ts',
  'lib/investors/service.ts',
]) {
  assert.match(source(governedHunterPath), /budgetReservationId: .*reservationId/)
}
assert.match(strategyEngineSource, /hunterSendVerificationRequired: true/)
assert.match(strategyEngineSource, /autoApprovalAllowed: !effectiveReviewOnly/)
assert.match(
  dailyAutomationSource,
  /strategyEngineAllowsApprovedDelivery[\s\S]*message\.status === 'approved'[\s\S]*message\.approved_by_user_id[\s\S]*message\.approved_at/
)
assert.match(
  dailyAutomationSource,
  /strategyEngineAllowsApprovedDelivery\(currentLead, currentRow\)[\s\S]*currentRow\.status === 'approved'/
)

const repositorySource = readFileSync(resolve(process.cwd(), 'lib/leads/repository.ts'), 'utf8')
assert.match(repositorySource, /hunterCache\.fresh && !hunterCache\.sendable/)

const runtimeSource = readFileSync(resolve(process.cwd(), 'lib/outreach/hunterSendVerification.ts'), 'utf8')
assert.doesNotMatch(runtimeSource, /payload|apiKey|HUNTER_API_KEY/)
assert.match(runtimeSource, /hunterSendVerification: input\.cache/)

const outboundSource = readFileSync(resolve(process.cwd(), 'lib/leads/outbound.ts'), 'utf8')
assert.match(outboundSource, /purpose === 'cold_outreach'[\s\S]*?ensureFreshHunterSendVerification/)
assert.match(outboundSource, /!hunter\.sendable \|\| hunter\.status !== 'valid' \|\| !hunter\.cache/)
assert.ok(
  outboundSource.indexOf('ensureFreshHunterSendVerification') < outboundSource.indexOf('sendGuardedOutlookEmail({'),
  'The universal first-touch Hunter gate must execute before the provider call'
)
assert.match(outboundSource, /deferredScope\?: 'record' \| 'lane' \| 'global' \| 'infrastructure'/)

const adminLeadRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/leads/[id]/outreach/route.ts'),
  'utf8'
)
assert.match(adminLeadRoute, /sendLeadOutreachEmail\([\s\S]*?sequenceStep: 1/)

const sellerTargetedRoute = readFileSync(
  resolve(process.cwd(), 'app/api/cron/seller-targeted-send/route.ts'),
  'utf8'
)
assert.match(sellerTargetedRoute, /seller_cold_email_prohibited/)
assert.doesNotMatch(sellerTargetedRoute, /sendLeadOutreachEmail/)

console.log('lead-hunter-send-verification: ok')
