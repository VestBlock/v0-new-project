import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildHunterSendVerificationCache,
  classifyHunterVerificationFailureScope,
  hashHunterVerificationEmail,
  hunterVerificationReplacementScanLimit,
  shouldQuarantineHunterVerificationStatus,
} from '../lib/outreach/hunterSendVerificationCore'

function source(file: string) {
  return readFileSync(resolve(process.cwd(), file), 'utf8')
}

assert.equal(hunterVerificationReplacementScanLimit(0), 0)
assert.equal(hunterVerificationReplacementScanLimit(1), 10)
assert.equal(hunterVerificationReplacementScanLimit(50), 500)
assert.equal(hunterVerificationReplacementScanLimit(500), 1_000)
for (const status of ['invalid', 'disposable', 'accept_all', 'unknown', 'webmail']) {
  assert.equal(shouldQuarantineHunterVerificationStatus(status), true, `${status} must leave the approved queue`)
}
assert.equal(shouldQuarantineHunterVerificationStatus('valid'), false)
assert.equal(shouldQuarantineHunterVerificationStatus('unverified'), false)
assert.equal(classifyHunterVerificationFailureScope('hunter_email_missing'), 'infrastructure')
assert.equal(classifyHunterVerificationFailureScope('hunter_email_mismatch'), 'infrastructure')
assert.equal(classifyHunterVerificationFailureScope('lead_hunter_daily_budget_exhausted'), 'global')
assert.equal(classifyHunterVerificationFailureScope('hunter_webmail'), 'record')

const email = 'Partner@Example.com'
const cache = buildHunterSendVerificationCache({
  email,
  status: 'valid',
  checkedAt: '2026-09-15T18:00:00.000Z',
})
assert.equal(cache.emailHash, hashHunterVerificationEmail('partner@example.com'))
assert.doesNotMatch(JSON.stringify(cache), /partner@example\.com/i)

const helper = source('lib/outreach/partnerHunterSendVerification.ts')
assert.match(helper, /getOperationalReplyCaptureReadiness/)
assert.match(helper, /getOutreachRecipientGuard/)
assert.match(helper, /recipient_hash', recipientHash/)
assert.match(helper, /acceptedRecipientHash: recipientHash/)
assert.match(helper, /property_buyer_packet_sends/)
assert.match(helper, /status: 'not_required'/)
assert.match(helper, /source: 'followup_evidence'/)
assert.match(helper, /evaluateOutreachThroughputGovernor/)
assert.match(helper, /readOutreachDispatchCapacity/)
assert.match(helper, /ensureFreshHunterSendVerificationForEntity/)
assert.ok(
  helper.indexOf('getOperationalReplyCaptureReadiness') < helper.lastIndexOf('ensureFreshHunterSendVerificationForEntity'),
  'Operational reply capture must be evaluated before a live Hunter lookup'
)
assert.ok(
  helper.indexOf('getOutreachRecipientGuard') < helper.lastIndexOf('ensureFreshHunterSendVerificationForEntity'),
  'Suppression must be evaluated before a live Hunter lookup'
)
assert.ok(
  helper.indexOf('readOutreachDispatchCapacity') < helper.lastIndexOf('ensureFreshHunterSendVerificationForEntity'),
  'Governor capacity must be evaluated before a live Hunter lookup'
)

const runtime = source('lib/outreach/hunterSendVerification.ts')
for (const [scope, table, emailColumn] of [
  ['lead', 'leads', 'email'],
  ['buyer', 'buyers', 'contact_email'],
  ['lender', 'lenders', 'contact_email'],
  ['investor', 'investor_profiles', 'contact_email'],
] as const) {
  assert.match(runtime, new RegExp(`${scope}: \\{ table: '${table}', emailColumn: '${emailColumn}' \\}`))
}
assert.match(runtime, /hunterSendVerification: input\.cache/)
assert.doesNotMatch(runtime, /hunterPayload|rawHunter|apiKey/)

for (const [file, scope, strategy] of [
  ['lib/buyers/outbound.ts', 'buyer', 'buyers'],
  ['lib/lenders/outbound.ts', 'lender', 'lenders'],
  ['lib/investors/outbound.ts', 'investor', 'investors'],
] as const) {
  const outbound = source(file)
  assert.match(outbound, new RegExp(`preflightPartnerHunterSendVerification\\(\\{[\\s\\S]*?scope: '${scope}'`))
  assert.match(outbound, new RegExp(`strategyKey: '${strategy}'`))
  assert.match(outbound, /hunterPreflight\.deferredScope \|\| 'record'/)
  assert.ok(
    outbound.indexOf('preflightPartnerHunterSendVerification({') < outbound.indexOf('acquireGuardedDeliveryAttempt({'),
    `${file} must verify before reserving a provider attempt`
  )
}

const buyerOutbound = source('lib/buyers/outbound.ts')
assert.equal((buyerOutbound.match(/preflightPartnerHunterSendVerification\(\{/g) || []).length, 2)
assert.match(
  buyerOutbound,
  /sendBuyerPacketEmail[\s\S]*?preflightPartnerHunterSendVerification\(\{[\s\S]*?messageId: input\.messageId/
)
assert.match(buyerOutbound, /A packet may follow an accepted introduction/)

for (const [file, listFunction, claimFunction, downgradeFunction] of [
  ['lib/buyers/automation.ts', 'listApprovedBuyerEmailOutreach', 'claimBuyerOutreachMessageForSend', 'downgradeBuyerOutreachMessageIfApproved'],
  ['lib/lenders/automation.ts', 'listApprovedLenderEmailOutreach', 'claimLenderOutreachMessageForSend', 'downgradeLenderOutreachMessageIfApproved'],
  ['lib/investors/service.ts', 'listApprovedInvestorEmailOutreach', 'claimInvestorOutreachMessageForSend', 'downgradeInvestorOutreachMessageIfApproved'],
] as const) {
  const automation = source(file)
  assert.match(
    automation,
    new RegExp(`${listFunction}\\(hunterVerificationReplacementScanLimit\\(effectiveLimit\\)\\)`),
    `${file} must scan a bounded replacement pool`
  )
  assert.match(
    automation,
    /allowNetwork:\s*hunterVerificationAttempts < hunterVerificationReplacementScanLimit\(effectiveLimit\)/,
    `${file} must use a bounded replacement-verification pool instead of one lookup per send slot`
  )
  assert.match(automation, new RegExp(`${downgradeFunction}\\(row\\.id`))
  assert.match(automation, /shouldQuarantineHunterVerificationStatus\(hunterPreflight\.status\)/)
  assert.match(automation, /if \(hunterPreflight\.deferredScope !== 'record'\) break/)
  assert.ok(
    automation.indexOf('preflightPartnerHunterSendVerification({') < automation.indexOf(`${claimFunction}(row.id`),
    `${file} must avoid consuming a send reservation before Hunter rejects a candidate`
  )
}
assert.match(source('lib/buyers/automation.ts'), /providerAttemptCount >= effectiveLimit/)
assert.match(source('lib/investors/service.ts'), /providerAttemptCount >= effectiveLimit/)
assert.match(
  source('lib/lenders/automation.ts'),
  /\(canary \? canaryProviderAttemptCount : providerAttemptCount\) >= effectiveLimit/
)

assert.match(source('lib/buyers/packetDelivery.ts'), /sendResult\.deferred && sendResult\.deferredScope !== 'record'/)

for (const file of [
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
]) {
  const route = source(file)
  assert.match(route, /acceptedRecipientHash: hashHunterVerificationEmail/)
}

const leadOutbound = source('lib/leads/outbound.ts')
assert.match(leadOutbound, /hasPriorAcceptedLeadEmailEvidence/)
assert.match(leadOutbound, /normalizeEmailAddress\(event\.recipient\) === currentRecipient/)
assert.match(leadOutbound, /sequenceStep <= 1 \|\| !hasAcceptedFollowupEvidence/)
assert.ok(
  leadOutbound.indexOf('hasPriorAcceptedLeadEmailEvidence') < leadOutbound.indexOf('ensureFreshHunterSendVerification({'),
  'Seller follow-up exemption must be checked before deciding whether Hunter is required'
)

const leadRepository = source('lib/leads/repository.ts')
assert.match(leadRepository, /completedFollowupRecipientKeys/)
assert.match(leadRepository, /normalizeEmailAddress\(event\.recipient\)/)

console.log('partner-hunter-send-verification: ok')
