import assert from 'node:assert/strict'

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

console.log('partner-outreach-guards: ok')
