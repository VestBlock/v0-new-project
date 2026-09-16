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
import {
  classifyPartnerOutreachSendResult,
  isPartnerSendOperationalFailureStatus,
} from '../lib/outreach/partnerSendLoopCore'
import { isMessageGenerationProtected } from '../lib/outreach/messageState'

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
assert.equal(classifyHunterVerificationFailureScope('lead_hunter_claim_already_reserved'), 'record')
assert.equal(classifyHunterVerificationFailureScope('lead_hunter_email_already_reserved'), 'record')
assert.equal(classifyHunterVerificationFailureScope('hunter_webmail'), 'record')

assert.deepEqual(
  classifyPartnerOutreachSendResult({
    ok: false,
    deferred: true,
    deferredScope: 'record',
    provider: 'none',
  }),
  {
    providerAttempted: false,
    quarantineRecord: true,
    stopReplacementScan: false,
  },
  'A record-scoped Hunter rejection must not consume an Outlook attempt or stop replacement scanning'
)
assert.deepEqual(
  classifyPartnerOutreachSendResult({
    ok: false,
    deferred: true,
    deferredScope: 'global',
    provider: 'none',
  }),
  {
    providerAttempted: false,
    quarantineRecord: false,
    stopReplacementScan: true,
  },
  'A global Hunter budget deferral must stop replacement scanning without claiming an Outlook attempt'
)
assert.deepEqual(
  classifyPartnerOutreachSendResult({ ok: true, provider: 'outlook' }),
  {
    providerAttempted: true,
    quarantineRecord: false,
    stopReplacementScan: false,
  },
  'An Outlook delivery must consume one provider attempt'
)
for (const reason of [
  'lead_hunter_claim_already_reserved',
  'lead_hunter_email_already_reserved',
]) {
  assert.deepEqual(
    classifyPartnerOutreachSendResult({
      ok: false,
      deferred: true,
      deferredScope: 'record',
      provider: 'none',
      error: `Verified B2B Outlook admission requires fresh Hunter status=valid (${reason}).`,
    }),
    {
      providerAttempted: false,
      quarantineRecord: false,
      stopReplacementScan: false,
    },
    `${reason} must be restored for a later retry while this run scans another record`
  )
}
assert.deepEqual(
  classifyPartnerOutreachSendResult({
    ok: false,
    deferred: true,
    deferredScope: 'record',
    provider: 'none',
    error: 'public_business_evidence_refresh_retryable',
  }),
  {
    providerAttempted: false,
    quarantineRecord: false,
    stopReplacementScan: false,
  },
  'A transient website evidence refresh failure must be restored while the run scans another record'
)
assert.equal(isPartnerSendOperationalFailureStatus('record_delivery_quarantine_failed'), true)
assert.equal(isPartnerSendOperationalFailureStatus('delivery_deferred_restore_failed'), true)
assert.equal(isPartnerSendOperationalFailureStatus('record_delivery_quarantined'), false)
assert.equal(isPartnerSendOperationalFailureStatus('failed'), true)
assert.equal(isPartnerSendOperationalFailureStatus('automatic_email_attempt_quota_unavailable'), true)
assert.equal(isPartnerSendOperationalFailureStatus('automatic_email_daily_attempt_quota_exhausted'), false)
assert.equal(
  isMessageGenerationProtected({ status: 'archived', sent_at: null }),
  true,
  'A quarantined invalid recipient must not be regenerated into the automatic approval queue'
)

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
assert.match(helper, /assertPurposeBoundBreakerProvider\(input\.provider, input\.deliveryCircuitBreaker\)/)
assert.ok(
  helper.indexOf('assertPurposeBoundBreakerProvider') < helper.lastIndexOf('ensureFreshHunterSendVerificationForEntity'),
  'Breaker/provider alignment must be evaluated before a live Hunter lookup'
)
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
assert.match(
  source('lib/outreach/outlookDelivery.ts'),
  /deferredScope: classifyVerifiedBusinessColdEmailAdmissionScope\(coldAdmission\.reason\)/
)

for (const [file, scope, strategy] of [
  ['lib/buyers/outbound.ts', 'buyer', 'buyers'],
  ['lib/lenders/outbound.ts', 'lender', 'lenders'],
  ['lib/investors/outbound.ts', 'investor', 'investors'],
] as const) {
  const outbound = source(file)
  assert.match(outbound, new RegExp(`ensureFreshHunterSendVerificationForEntity\\(\\{[\\s\\S]*?scope: '${scope}'`))
  assert.match(outbound, new RegExp(`strategyKey: '${strategy}'`))
  assert.match(outbound, /!hunter\.sendable \|\| hunter\.status !== 'valid' \|\| !hunter\.cache/)
  assert.match(outbound, /deferredScope: classifyHunterVerificationFailureScope\(hunter\.reason\)/)
  assert.match(outbound, /business_contact_evidence_required/)
  if (scope === 'buyer' || scope === 'lender') {
    assert.match(outbound, /ensurePublicBusinessWebsiteEvidenceForEntity/)
    assert.ok(
      outbound.indexOf('ensurePublicBusinessWebsiteEvidenceForEntity') < outbound.indexOf('ensureFreshHunterSendVerificationForEntity({'),
      `${file} must refresh exact public website evidence before spending a Hunter credit`
    )
  }
  assert.match(outbound, /sendGuardedOutlookEmail/)
  assert.ok(
    outbound.indexOf('deriveRecipientBoundBusinessContactEvidence({') < outbound.indexOf('ensureFreshHunterSendVerificationForEntity({'),
    `${file} must reject candidates without recipient-bound business evidence before spending a Hunter credit`
  )
  assert.ok(
    outbound.indexOf('ensureFreshHunterSendVerificationForEntity({') < outbound.indexOf('sendGuardedOutlookEmail({'),
    `${file} must verify with Hunter before the Outlook provider call`
  )
}

const buyerOutbound = source('lib/buyers/outbound.ts')
assert.equal((buyerOutbound.match(/ensureFreshHunterSendVerificationForEntity\(\{/g) || []).length, 2)
assert.match(
  buyerOutbound,
  /sendBuyerPacketEmail[\s\S]*?confirmedTransactionalRelationship[\s\S]*?effectivePurpose === 'cold_outreach'[\s\S]*?ensureFreshHunterSendVerificationForEntity\(\{[\s\S]*?messageId: input\.messageId/
)
assert.match(buyerOutbound, /hasConfirmedBuyerPacketRelationship\(input\.buyer\.id\)/)

for (const [file, listFunction, claimFunction, downgradeFunction, quarantineFunction, sendFunction] of [
  ['lib/buyers/automation.ts', 'listApprovedBuyerEmailOutreach', 'claimBuyerOutreachMessageForSend', 'downgradeBuyerOutreachMessageIfApproved', 'quarantineBuyerOutreachMessageAfterRecordDeferral', 'sendBuyerOutreachEmail'],
  ['lib/lenders/automation.ts', 'listApprovedLenderEmailOutreach', 'claimLenderOutreachMessageForSend', 'downgradeLenderOutreachMessageIfApproved', 'quarantineLenderOutreachMessageAfterRecordDeferral', 'sendLenderOutreachEmail'],
  ['lib/investors/service.ts', 'listApprovedInvestorEmailOutreach', 'claimInvestorOutreachMessageForSend', 'downgradeInvestorOutreachMessageIfApproved', 'quarantineInvestorOutreachMessageAfterRecordDeferral', 'sendInvestorOutreachEmail'],
] as const) {
  const automation = source(file)
  assert.match(
    automation,
    new RegExp(`${listFunction}\\(hunterVerificationReplacementScanLimit\\(effectiveLimit\\)\\)`),
    `${file} must scan a bounded replacement pool`
  )
  assert.match(
    automation,
    /restore(?:Buyer|Lender|Investor)OutreachMessageAfterQuotaDenial/,
    `${file} must restore a claimed message when the guarded Outlook admission defers it`
  )
  assert.match(automation, new RegExp(`${downgradeFunction}\\(row\\.id`))
  assert.match(automation, new RegExp(`${claimFunction}\\(row\\.id`))
  assert.match(automation, new RegExp(`${quarantineFunction}\\([\\s\\S]*?claimed\\.updated_at`))
  assert.match(automation, /if \(disposition\.providerAttempted\)/)
  assert.match(automation, /if \(disposition\.quarantineRecord\)/)
  assert.match(automation, /automaticSendDeferral:[\s\S]*?reason: sent\.error/)
  assert.match(automation, /status: quarantined \? 'record_delivery_quarantined'[\s\S]*?reason: sent\.error/)
  assert.match(automation, /isPartnerSendOperationalFailureStatus\(result\.status\)/)
  assert.ok(
    automation.indexOf(`${sendFunction}({`) < automation.indexOf('classifyPartnerOutreachSendResult(sent)'),
    `${file} must classify the actual send result before accounting for provider capacity`
  )
}
assert.match(source('lib/buyers/automation.ts'), /providerAttemptCount >= effectiveLimit/)
assert.match(source('lib/investors/service.ts'), /providerAttemptCount >= effectiveLimit/)
assert.match(
  source('lib/lenders/automation.ts'),
  /\(canary \? canaryProviderAttemptCount : providerAttemptCount\) >= effectiveLimit/
)

for (const [file, quarantineFunction] of [
  ['lib/buyers/repository.ts', 'quarantineBuyerOutreachMessageAfterRecordDeferral'],
  ['lib/lenders/repository.ts', 'quarantineLenderOutreachMessageAfterRecordDeferral'],
  ['lib/investors/repository.ts', 'quarantineInvestorOutreachMessageAfterRecordDeferral'],
] as const) {
  const repository = source(file)
  assert.match(
    repository,
    new RegExp(`${quarantineFunction}\\([\\s\\S]*?status: 'archived'[\\s\\S]*?approved_at: null[\\s\\S]*?\\.eq\\('status', 'queued'\\)[\\s\\S]*?\\.eq\\('updated_at', claimedUpdatedAt\\)`),
    `${file} must atomically remove only the claimed queued record from automatic approval`
  )
}

assert.match(source('lib/outreach/messageState.ts'), /GENERATION_PROTECTED_STATUSES[\s\S]*?'archived'/)

assert.match(source('lib/buyers/packetDelivery.ts'), /sendResult\.deferred && sendResult\.deferredScope !== 'record'/)

for (const file of [
  'app/api/admin/buyers/[id]/outreach/route.ts',
  'app/api/admin/lenders/[id]/outreach/route.ts',
]) {
  const route = source(file)
  assert.match(route, /acceptedRecipientHash: hashHunterVerificationEmail/)
}

const leadOutbound = source('lib/leads/outbound.ts')
assert.match(leadOutbound, /purpose === 'cold_outreach'[\s\S]*?ensureFreshHunterSendVerification/)
assert.match(leadOutbound, /!hunter\.sendable \|\| hunter\.status !== 'valid' \|\| !hunter\.cache/)
assert.ok(
  leadOutbound.indexOf('ensureFreshHunterSendVerification({') < leadOutbound.indexOf('sendGuardedOutlookEmail({'),
  'Hunter verification must complete before the guarded Outlook provider call'
)

console.log('partner-hunter-send-verification: ok')
