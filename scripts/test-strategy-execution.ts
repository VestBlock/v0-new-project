import assert from 'node:assert/strict'

import {
  getStrategyLeadFreshness,
  STRATEGY_EXECUTION_LANES,
  qualifyLeadForStrategy,
} from '../lib/admin/strategyExecutionCatalog'
import { buildStrategyEmailDraft } from '../lib/admin/strategyOutreachTemplates'
import {
  getStrategyLeadProvenance,
  isStrategyEngineAutoApprovalAllowed,
} from '../lib/admin/strategyLeadProvenance'
import { validateOutreachMessageQuality } from '../lib/leads/revenueCampaigns'
import type { LeadRecord } from '../lib/leads/types'

function lead(overrides: Partial<LeadRecord>): LeadRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    lead_type: 'sell_house',
    source: 'homeharvest_stale_listing',
    category: 'seller_lead',
    name: 'Jordan',
    property_address: '123 Main Street',
    email: 'agent@example.com',
    email_valid: true,
    city: 'Cleveland',
    state: 'OH',
    status: 'new',
    outreach_status: 'not_started',
    delivery_status: 'not_sent',
    form_data: {},
    metadata_json: {},
    automation_flags_json: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as LeadRecord
}

function lane(key: string) {
  const found = STRATEGY_EXECUTION_LANES.find((item) => item.key === key)
  assert.ok(found, `Missing strategy lane ${key}`)
  return found
}

const staleListing = lead({
  form_data: {
    daysOnMarket: 75,
    listPrice: 275_000,
    propertyType: 'single family',
  },
  metadata_json: { listingRemarks: 'Back on market. Seller will consider options.' },
})
assert.equal(
  getStrategyLeadProvenance(staleListing),
  null,
  'A generic listing lead must not enter strategy automation without source-contract provenance'
)
assert.equal(
  isStrategyEngineAutoApprovalAllowed(staleListing),
  false,
  'A seller lead without source-contract provenance must never receive autonomous approval'
)
const provenStaleListing = lead({
  ...staleListing,
  metadata_json: {
    ...staleListing.metadata_json,
    strategyPrimary: 'active-stale-creative',
    strategyStackMatches: ['active-stale-creative'],
    strategySourceFamilies: ['homeharvest'],
    strategySourceRecordId: 'listing-123',
    strategySourceContractVersion: 1,
    sourceObservedAt: new Date().toISOString(),
  },
})
assert.equal(getStrategyLeadProvenance(provenStaleListing)?.primaryStrategyKey, 'active-stale-creative')
assert.equal(
  isStrategyEngineAutoApprovalAllowed({
    ...provenStaleListing,
    automation_flags_json: {
      strategyEngine: { autoApprovalAllowed: true },
    },
  }),
  true,
  'A provenance-backed seller lead may be auto-approved only when the strategy engine explicitly allows it'
)
const creativeQualification = qualifyLeadForStrategy(
  staleListing,
  lane('active-stale-creative'),
  'homeharvest'
)
assert.equal(creativeQualification.eligible, true)
assert.equal(creativeQualification.reviewOnly, false)
assert.ok(creativeQualification.reasons.some((reason) => reason.includes('days on market')))

const creativeDraft = buildStrategyEmailDraft('active-stale-creative', staleListing)
assert.match(creativeDraft.body, /seller financing/i)
assert.match(creativeDraft.body, /subject-to/i)
assert.match(creativeDraft.body, /protecting your commission/i)
assert.equal(
  validateOutreachMessageQuality({
    lead: staleListing,
    message: {
      subject: creativeDraft.subject,
      body: creativeDraft.body,
      compliance_note: creativeDraft.complianceNote,
    },
  }),
  null
)

const staleOnMarketLead = lead({
  created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  form_data: { daysOnMarket: 90, listPrice: 325_000 },
  metadata_json: { listingRemarks: 'Back on market. Seller will consider options.' },
})
const staleOnMarketFreshness = getStrategyLeadFreshness(staleOnMarketLead, lane('active-stale-creative'))
assert.equal(staleOnMarketFreshness.fresh, false)
assert.equal(
  qualifyLeadForStrategy(staleOnMarketLead, lane('active-stale-creative'), 'homeharvest').eligible,
  false,
  'Old listing observations must be refreshed before a new first-contact run'
)

const recentPreforeclosure = lead({
  source: 'dealmachine_api_sync',
  created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  pain_signal: 'DealMachine property signals: preforeclosure, equity.',
  metadata_json: { equityPercent: 35 },
})
assert.equal(getStrategyLeadFreshness(recentPreforeclosure, lane('preforeclosure-equity')).fresh, true)

const preforeclosure = lead({
  source: 'dealmachine_api_sync',
  pain_signal: 'DealMachine property signals: preforeclosure, equity.',
  metadata_json: { equityPercent: 35 },
})
const preforeclosureQualification = qualifyLeadForStrategy(
  preforeclosure,
  lane('preforeclosure-equity'),
  'dealmachine'
)
assert.equal(preforeclosureQualification.eligible, true)
assert.equal(preforeclosureQualification.reviewOnly, true)
const preforeclosureDraft = buildStrategyEmailDraft('preforeclosure-equity', preforeclosure)
assert.match(preforeclosureDraft.body, /not a foreclosure-rescue promise or legal advice/i)
assert.match(preforeclosureDraft.body, /verified ownership/i)

const taxCode = lead({
  source: 'dealmachine_contacts_export',
  pain_signal: 'Tax delinquent with an active code violation and boarded structure.',
})
assert.equal(qualifyLeadForStrategy(taxCode, lane('tax-code-stack'), 'dealmachine').eligible, true)
assert.equal(
  qualifyLeadForStrategy(taxCode, lane('tax-code-stack'), 'homeharvest').eligible,
  false,
  'A lead cannot qualify through a source it did not come from'
)

assert.equal(
  qualifyLeadForStrategy(staleListing, lane('active-stale-lowball'), 'homeharvest').eligible,
  false,
  'Lowball remains disabled by default'
)
assert.equal(
  qualifyLeadForStrategy(lead({ email: null }), lane('active-stale-creative'), 'homeharvest').eligible,
  false,
  'Email outreach requires a real contact'
)

console.log('strategy-execution: ok')
