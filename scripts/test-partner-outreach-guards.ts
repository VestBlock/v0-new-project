import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { evaluateLenderAutoApproval } from '../lib/lenders/automationCore'
import { generateLenderOutreach, LENDER_OUTREACH_TEMPLATE_VERSION } from '../lib/lenders/outreach'
import type { LenderOutreachMessageRecord, LenderRecord } from '../lib/lenders/types'
import { evaluateInvestorAutoApproval } from '../lib/investors/automationCore'
import {
  buildInvestorFollowupMessage,
  buildInvestorOutreachMessage,
  INVESTOR_OUTREACH_TEMPLATE_VERSION,
} from '../lib/investors/outreach'
import type { InvestorOutreachMessageRecord, InvestorProfileRecord } from '../lib/investors/types'
import { allocateDailyStrategyOutput } from '../lib/outreach/dailyStrategyOutputCore'
import { evaluateBuyerAutoApproval, isBuyerAcquisitionEntity } from '../lib/buyers/automationCore'

assert.equal(isBuyerAcquisitionEntity({
  name: 'Example Acquisitions LLC',
  source: 'outscraper_google_maps_businesses',
  category: 'local_cash_buyer',
  metadata_json: { lane: 'buyer-network' },
}), true)
for (const lane of [
  'land-developers',
  'investor-network',
  'acquisition-manager-network',
  'property-manager-network',
  'wholesaler-network',
  'buyer-developer',
  'fire-damage-builders',
]) {
  assert.equal(isBuyerAcquisitionEntity({
    name: 'Verified Property Operator LLC',
    source: 'outscraper_google_maps_businesses',
    category: 'local_cash_buyer',
    metadata_json: { lane },
  }), true, `${lane} must remain an affirmative buyer-acquisition lane`)
}
for (const buyer of [
  {
    name: 'Direct Buyer Signup LLC',
    source: 'public_buyer_signup',
    category: 'fix_and_flip_buyer',
    metadata_json: { publicSignup: { submittedAt: '2026-09-16T12:00:00.000Z' } },
  },
  {
    name: 'Metro Property Investors',
    source: 'google_places_buyers',
    category: 'local_cash_buyer',
    metadata_json: { discoveryQuery: 'cash home buyer in Toledo, OH' },
  },
  {
    name: 'Portfolio Holdings LLC',
    source: 'dealmachine_portfolio_owner_scan',
    category: 'landlord_buyer',
    metadata_json: { buyerLane: 'portfolio_landlord_buyer_criteria' },
  },
]) {
  assert.equal(isBuyerAcquisitionEntity(buyer), true, `${buyer.source} must remain a recognized buyer source`)
}
assert.equal(isBuyerAcquisitionEntity({
  name: 'Unclassified Business LLC',
  source: 'outscraper_google_maps_businesses',
  category: 'local_cash_buyer',
  metadata_json: {},
}), false, 'generic business discovery is not affirmative buyer provenance')
assert.equal(isBuyerAcquisitionEntity({
  name: 'Example Mortgage Corporation Loan Officer',
  source: 'outscraper_google_maps_businesses',
  category: 'local_cash_buyer',
  metadata_json: { lane: 'lender-network' },
}), false, 'lender-network records must never receive buyer acquisition copy')
for (const name of [
  'Community Bank',
  'Neighborhood Credit Union',
  'Example Hard Money',
  'Trusted Home Loans',
  'Regional Mortgage Lending',
]) {
  assert.equal(isBuyerAcquisitionEntity({
    name,
    source: 'google_places_buyers',
    category: 'local_cash_buyer',
    metadata_json: { discoveryQuery: 'cash home buyer in Toledo, OH' },
  }), false, `${name} must be rejected despite buyer-shaped provenance`)
}

const lender = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Example Capital',
  lender_type: 'real_estate',
  category: 'hard_money',
  contact_email: 'criteria@acmeprivatecapital.com',
  confidence_score: 70,
  relationship_stage: 'researched',
  outreach_status: 'needs_review',
  metadata_json: {},
} as unknown as LenderRecord
const lenderBundle = generateLenderOutreach(lender)
assert.equal(LENDER_OUTREACH_TEMPLATE_VERSION, 'vestblock-lender-network-2026-09-14')
assert.equal(lenderBundle.emailIntro.subject, 'Fit criteria for VestBlock referrals')
assert.match(lenderBundle.emailIntro.body, /^Hi there,/)
assert.match(lenderBundle.emailIntro.body, /product guide, criteria sheet, or intake link/i)
assert.match(lenderBundle.emailIntro.complianceNote, /reply opt out/i)
assert.doesNotMatch(lenderBundle.emailIntro.body, /AEO\/SEO|booster|team,/i)
assert.doesNotMatch(lenderBundle.emailFollowup.body, /wanted to circle back|trying to build this the right way/i)
assert.ok(lenderBundle.emailIntro.body.length < 1200)
assert.ok(lenderBundle.emailFollowup.body.length < 1200)
const lenderMessage = {
  id: '20000000-0000-4000-8000-000000000001',
  lender_id: lender.id,
  channel: 'email_intro',
  subject: lenderBundle.emailIntro.subject,
  body: lenderBundle.emailIntro.body,
  compliance_note: lenderBundle.emailIntro.complianceNote,
  metadata_json: { templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION },
} as unknown as LenderOutreachMessageRecord
assert.deepEqual(
  evaluateLenderAutoApproval({ lender, message: lenderMessage, templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION, minimumScore: 40 }),
  { approved: true, reason: 'approved' }
)
assert.equal(
  evaluateLenderAutoApproval({ lender, message: lenderMessage, templateVersion: 'stale', minimumScore: 40 }).approved,
  false
)

const investor = {
  id: '30000000-0000-4000-8000-000000000001',
  display_name: 'Example Homes LLC',
  company_name: 'Example Homes LLC',
  person_name: 'Jordan',
  primary_investor_type: 'buy_and_hold',
  assigned_sequence: 'A',
  contact_email: 'acquisitions@examplehomesllc.com',
  partnership_score: 75,
  relationship_stage: 'researched',
  outreach_status: 'needs_review',
  markets: ['Cleveland, OH'],
  classification_tags: [],
  property_types: ['single_family'],
  metadata_json: {},
} as unknown as InvestorProfileRecord
const investorDraft = buildInvestorOutreachMessage(investor)
const investorMessage = {
  id: '40000000-0000-4000-8000-000000000001',
  investor_profile_id: investor.id,
  sequence_code: investor.assigned_sequence,
  step_number: 1,
  channel: 'email',
  subject: investorDraft.subject,
  body: investorDraft.body,
  metadata_json: { templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION },
} as unknown as InvestorOutreachMessageRecord
assert.deepEqual(
  evaluateInvestorAutoApproval({ investor, message: investorMessage, templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION, minimumScore: 45 }),
  { approved: true, reason: 'approved' }
)

const followup = buildInvestorFollowupMessage(investor)
assert.match(followup.body, /acquisitions@vestblock\.io/)
assert.match(followup.body, /opt out/i)
assert.match(followup.body, /buy[- ]box/i)

const buyerAutomationSource = readFileSync(resolve(process.cwd(), 'lib/buyers/automation.ts'), 'utf8')
const lenderAutomationSource = readFileSync(resolve(process.cwd(), 'lib/lenders/automation.ts'), 'utf8')
const investorServiceSource = readFileSync(resolve(process.cwd(), 'lib/investors/service.ts'), 'utf8')
const investorAutomationSource = readFileSync(resolve(process.cwd(), 'lib/investors/automation.ts'), 'utf8')
const partnerRouteSource = readFileSync(resolve(process.cwd(), 'app/api/cron/partner-network-pipeline/route.ts'), 'utf8')
const buyerRouteSource = readFileSync(resolve(process.cwd(), 'app/api/cron/buyers-pipeline/route.ts'), 'utf8')
const investorPipelineRouteSource = readFileSync(resolve(process.cwd(), 'app/api/cron/investors-pipeline/route.ts'), 'utf8')
const investorSendRouteSource = readFileSync(resolve(process.cwd(), 'app/api/cron/investors-send/route.ts'), 'utf8')

for (const source of [buyerAutomationSource, lenderAutomationSource, investorServiceSource]) {
  assert.match(source, /operationalFailureCount/)
  assert.match(source, /ok: operationalFailureCount === 0/)
}
assert.match(investorAutomationSource, /const errorCount = results\.filter\(\(item\) => item\.status === 'failed'\)\.length/)
assert.match(investorAutomationSource, /const skippedCount = results\.filter\(\(item\) => item\.status === 'skipped'\)\.length/)
assert.match(investorAutomationSource, /status: ok \? 'completed' : 'failed'/)
assert.match(investorAutomationSource, /const ok = stages\.every\(\(stage\) => stage\.ok !== false\)/)
for (const source of [partnerRouteSource, buyerRouteSource, investorPipelineRouteSource, investorSendRouteSource]) {
  assert.doesNotMatch(source, /status: [^\n]*207/)
  assert.match(source, /status: [^\n]*\? 200 : 500/)
}

const partnerPlan = allocateDailyStrategyOutput(1_000, new Date('2026-09-15T17:00:00.000Z'))
const partnerTargets = [partnerPlan.byKey.buyers, partnerPlan.byKey.lenders, partnerPlan.byKey.investors]
assert.ok(partnerTargets.every((target) => target === 25))
assert.equal(
  partnerTargets.reduce((sum, target) => sum + target, 0) + partnerPlan.byKey.listing_agents,
  partnerPlan.groupTotals.partner
)
for (const source of [buyerAutomationSource, lenderAutomationSource, investorAutomationSource]) {
  assert.match(source, /allocateDailyStrategyOutput/)
  assert.match(source, /dailyLaneTarget/)
}
assert.match(buyerAutomationSource, /const dailyLimit = buyerDailyOutputTarget\(\)/)
assert.match(lenderAutomationSource, /const dailyLimit = lenderDailyOutputTarget\(\)/)
assert.match(investorAutomationSource, /runDailyInvestorSend\(sendLimit/)
assert.doesNotMatch(
  investorServiceSource,
  /INVESTORS_DAILY_SEND_LIMIT/,
  'legacy investor caps must not override the canonical lane allocation'
)
assert.match(partnerRouteSource, /canonicalSendAllocations/)
assert.match(partnerRouteSource, /let invocationRemaining = 2/)
assert.match(partnerRouteSource, /stage: 'outlook_cold_guarded'/)
assert.match(partnerRouteSource, /perInvocationCap: 2/)
assert.doesNotMatch(partnerRouteSource, /PARTNER_PIPELINE_SEND_LIMIT/)

console.log('partner-outreach-guards: ok')
