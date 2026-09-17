import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { isStrategyMarketDue, STRATEGY_MARKET_STATE_SEED_OPTIONS } from '../lib/admin/strategyExecutionCore'
import {
  advanceStrategyLaneDraftCount,
  strategyLaneDraftLimit,
} from '../lib/admin/strategyDailyLaneQuotaCore'

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
import {
  repairMissingEmailOptOutNote,
  validateOutreachMessageQuality,
} from '../lib/leads/revenueCampaigns'
import type { LeadRecord } from '../lib/leads/types'
import { allocateDailyStrategyOutput } from '../lib/outreach/dailyStrategyOutputCore'

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

const enabledSellerLanes = STRATEGY_EXECUTION_LANES.filter((item) => item.enabled)
const canonicalOutputPlan = allocateDailyStrategyOutput(1_000, new Date('2026-09-15T18:00:00.000Z'))
const canonicalSellerAllocations = canonicalOutputPlan.allocations.filter((allocation) => allocation.group === 'seller')

assert.equal(enabledSellerLanes.length, 16, 'Every default strategy-engine run must be able to cover all 16 enabled seller lanes')
assert.deepEqual(
  enabledSellerLanes.map((item) => item.key).sort(),
  canonicalSellerAllocations.map((item) => item.key).sort(),
  'The strategy-engine catalog must stay aligned with the canonical daily seller allocation'
)
assert.ok(
  canonicalSellerAllocations.every((allocation) => allocation.target === 50),
  'A 1,000-output day must allocate 800 seller slots, or 50 to each enabled seller lane'
)

const rotatingOutputPlan = allocateDailyStrategyOutput(999, new Date('2026-09-15T18:00:00.000Z'))
const rotatedOutputPlan = allocateDailyStrategyOutput(999, new Date('2026-09-16T18:00:00.000Z'))
assert.notDeepEqual(
  rotatedOutputPlan.allocations.filter((allocation) => allocation.group === 'seller' && allocation.target === 49).map((allocation) => allocation.key),
  rotatingOutputPlan.allocations.filter((allocation) => allocation.group === 'seller' && allocation.target === 49).map((allocation) => allocation.key),
  'The seller remainder must rotate on the next Chicago business date'
)
const fullRotationLowCounts = new Map<string, number>()
for (let dayOffset = 0; dayOffset < canonicalSellerAllocations.length; dayOffset += 1) {
  const plan = allocateDailyStrategyOutput(999, new Date(Date.UTC(2026, 8, 15 + dayOffset, 18)))
  for (const allocation of plan.allocations) {
    if (allocation.group === 'seller' && allocation.target === 49) {
      fullRotationLowCounts.set(allocation.key, (fullRotationLowCounts.get(allocation.key) || 0) + 1)
    }
  }
}
assert.ok(
  canonicalSellerAllocations.every((allocation) => fullRotationLowCounts.get(allocation.key) === 1),
  'Every seller lane must rotate through the single lower slot during a complete seller-lane cycle'
)

const cappedLane = canonicalOutputPlan.allocations.find((allocation) => allocation.key === 'builder-infill-teardown')
assert.ok(cappedLane)
let persistedLaneDrafts = 0
const firstStateLimit = strategyLaneDraftLimit({
  target: cappedLane.target,
  existing: persistedLaneDrafts,
  perRunLimit: 30,
})
assert.equal(firstStateLimit, 30)
persistedLaneDrafts = advanceStrategyLaneDraftCount(persistedLaneDrafts, firstStateLimit)
const secondStateLimit = strategyLaneDraftLimit({
  target: cappedLane.target,
  existing: persistedLaneDrafts,
  perRunLimit: 30,
})
assert.equal(secondStateLimit, cappedLane.target - 30)
persistedLaneDrafts = advanceStrategyLaneDraftCount(persistedLaneDrafts, secondStateLimit)
assert.equal(persistedLaneDrafts, cappedLane.target, 'Two market/provider states must not exceed the lane allocation')
assert.equal(
  strategyLaneDraftLimit({ target: cappedLane.target, existing: persistedLaneDrafts, perRunLimit: 30 }),
  0,
  'A later cron run must receive no drafting capacity after the durable daily count reaches its target'
)

const quotaMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915212405_enforce_strategy_daily_lane_cap.sql'),
  'utf8'
)
const quotaAlignmentMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260917184912_align_strategy_lane_quota_with_weighted_plan.sql'),
  'utf8'
)
assert.match(quotaMigration, /pg_advisory_xact_lock/)
assert.match(quotaMigration, /FROM public\.strategy_lead_memberships AS membership[\s\S]*?JOIN public\.command_center_strategy_runs AS run/)
assert.match(quotaMigration, /IF v_existing_count >= p_lane_target[\s\S]*?daily_lane_allocation_exhausted/)
assert.match(quotaMigration, /INSERT INTO public\.strategy_lead_memberships/)
assert.match(quotaMigration, /membership\.status NOT IN \('rejected', 'failed'\)/)
assert.match(quotaMigration, /membership\.created_at >= pg_catalog\.clock_timestamp\(\) - INTERVAL '15 minutes'/)
assert.match(quotaMigration, /message\.generated_with = 'strategy_engine:' \|\| membership\.strategy_key/)
assert.match(quotaMigration, /SECURITY DEFINER/)
assert.match(quotaMigration, /REVOKE INSERT ON TABLE public\.strategy_lead_memberships FROM authenticated/)
assert.match(quotaMigration, /REVOKE INSERT ON TABLE public\.strategy_lead_memberships FROM service_role/)
const maximumCanonicalLaneTarget = Math.max(
  ...canonicalOutputPlan.allocations.map((allocation) => allocation.target)
)
const alignedDatabaseMaximum = Number(
  quotaAlignmentMigration.match(/p_lane_target > (\d+)/)?.[1] || Number.NaN
)
assert.equal(
  alignedDatabaseMaximum,
  maximumCanonicalLaneTarget,
  'The database reservation guard must accept the largest canonical weighted lane target'
)
assert.match(quotaAlignmentMigration, /SECURITY DEFINER[\s\S]*?SET search_path = ''/)
assert.match(quotaAlignmentMigration, /pg_advisory_xact_lock[\s\S]*?FROM public\.strategy_lead_memberships AS membership/)
assert.match(quotaAlignmentMigration, /GRANT EXECUTE ON FUNCTION public\.reserve_strategy_daily_lane_membership[\s\S]*?TO service_role/)
assert.ok(
  quotaMigration.indexOf('pg_advisory_xact_lock') <
    quotaMigration.indexOf('SELECT COUNT(*)::INTEGER\n  INTO v_existing_count') &&
    quotaMigration.indexOf('SELECT COUNT(*)::INTEGER\n  INTO v_existing_count') <
      quotaMigration.indexOf('INSERT INTO public.strategy_lead_memberships'),
  'The database reservation must lock before it counts and inserts'
)

const strategyEngineSource = readFileSync(resolve(process.cwd(), 'lib/admin/strategyExecutionEngine.ts'), 'utf8')
assert.match(strategyEngineSource, /loadDailyLaneDraftCounts\(date\)/)
assert.match(strategyEngineSource, /strategyLaneDraftLimit\([\s\S]*?existing: existingDraftCount/)
assert.match(strategyEngineSource, /reserve_strategy_daily_lane_membership/)
assert.match(strategyEngineSource, /advanceStrategyLaneDraftCount\(existingDraftCount, laneRun\.draftsCreated\)/)
assert.match(strategyEngineSource, /getOperationalReplyCaptureReadiness\(\)/)
assert.match(strategyEngineSource, /outlook_direct_guarded/)
assert.doesNotMatch(strategyEngineSource, /getDeliveryCircuitBreaker/)
assert.match(strategyEngineSource, /releasedDailyLaneReservation: true/)
assert.ok(
  strategyEngineSource.indexOf("status: 'needs_review'") <
    strategyEngineSource.indexOf('await updateLeadRecord(candidate.lead.id'),
  'A persisted draft must finalize its quota membership before secondary lead metadata work'
)
assert.doesNotMatch(strategyEngineSource, /from\('strategy_lead_memberships'\)[\s\S]{0,100}\.insert\(/)

assert.deepEqual(
  STRATEGY_MARKET_STATE_SEED_OPTIONS,
  {
    onConflict: 'strategy_key,market,source_provider',
    ignoreDuplicates: true,
  },
  'Market seeding must never rewrite immutable strategy identity on an existing state'
)

const selectionNow = Date.parse('2026-09-14T12:00:00.000Z')
assert.equal(
  isStrategyMarketDue({
    nextRunAt: '2026-09-21T12:00:00.000Z',
    availableCandidates: 1,
    nowMs: selectionNow,
  }),
  true,
  'Fresh unassigned inventory must wake an existing market without updating its identity-bound row'
)
assert.equal(
  isStrategyMarketDue({
    nextRunAt: '2026-09-21T12:00:00.000Z',
    availableCandidates: 0,
    nowMs: selectionNow,
  }),
  false,
  'A future market without inventory must remain scheduled'
)
assert.equal(
  isStrategyMarketDue({
    nextRunAt: '2026-09-13T12:00:00.000Z',
    availableCandidates: 0,
    nowMs: selectionNow,
  }),
  true,
  'An expired market schedule must remain due'
)

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

const staleDraftWithoutCompliance = {
  subject: creativeDraft.subject,
  body: `${creativeDraft.body}\n\nIf this is not relevant, reply opt out.`,
  compliance_note: null,
}
assert.equal(
  validateOutreachMessageQuality({ lead: staleListing, message: staleDraftWithoutCompliance }),
  'missing_opt_out_note'
)
const complianceRepairedDraft = repairMissingEmailOptOutNote(staleDraftWithoutCompliance)
assert.equal(complianceRepairedDraft.subject, staleDraftWithoutCompliance.subject)
assert.equal(complianceRepairedDraft.body, staleDraftWithoutCompliance.body)
assert.match(String(complianceRepairedDraft.compliance_note), /opt out/i)
assert.equal(
  validateOutreachMessageQuality({ lead: staleListing, message: complianceRepairedDraft }),
  null,
  'The dispatcher must repair legacy compliance metadata without rewriting seller copy'
)
const customCompliantDraft = {
  ...staleDraftWithoutCompliance,
  compliance_note: 'Please reply do not contact and we will close the conversation.',
}
assert.equal(
  repairMissingEmailOptOutNote(customCompliantDraft),
  customCompliantDraft,
  'A compliant custom note must be preserved byte-for-byte'
)
const stillInvalidAfterComplianceRepair = repairMissingEmailOptOutNote({
  subject: '',
  body: staleDraftWithoutCompliance.body,
  compliance_note: null,
})
assert.equal(
  validateOutreachMessageQuality({ lead: staleListing, message: stillInvalidAfterComplianceRepair }),
  'missing_subject',
  'Adding the compliance note must not bypass an unrelated copy-quality blocker'
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

for (const strategyKey of ['lien-equity', 'novation-retail-equity']) {
  const disclaimerDraft = buildStrategyEmailDraft(strategyKey, preforeclosure)
  assert.equal(
    validateOutreachMessageQuality({
      lead: preforeclosure,
      message: {
        subject: disclaimerDraft.subject,
        body: disclaimerDraft.body,
        compliance_note: disclaimerDraft.complianceNote,
      },
    }),
    null,
    `${strategyKey} risk disclaimers must not be misclassified as affirmative guarantees`
  )
}
const prohibitedPromise = buildStrategyEmailDraft('active-stale-creative', preforeclosure)
const sellerClaimQualityMatrix = [
  ['VestBlock guarantees a closing.', 'overpromising_or_government_claim'],
  ['VestBlock guarantees your sale.', 'overpromising_or_government_claim'],
  ['We guarantee you will close.', 'overpromising_or_government_claim'],
  ['This is an official government assistance program.', 'overpromising_or_government_claim'],
  ["We don't guarantee closing.", null],
  ['Results are never guaranteed.', null],
  ['No result is ever guaranteed.', null],
  ['This is not a guarantee.', null],
  ['No outcome can be guaranteed.', null],
  ['Closing cannot be guaranteed.', null],
  ['We are not affiliated with any government program.', null],
  ["VestBlock isn’t a government program.", null],
  ['We have no affiliation with the government.', null],
] as const

for (const [claim, expectedIssue] of sellerClaimQualityMatrix) {
  assert.equal(
    validateOutreachMessageQuality({
      lead: preforeclosure,
      message: {
        subject: prohibitedPromise.subject,
        body: `${prohibitedPromise.body}\n\n${claim}`,
        compliance_note: prohibitedPromise.complianceNote,
      },
    }),
    expectedIssue,
    `seller claim quality classification failed for: ${claim}`
  )
}

const taxCode = lead({
  source: 'dealmachine_contacts_export',
  pain_signal: 'Tax delinquent with an active code violation and boarded structure.',
})
const taxCodeQualification = qualifyLeadForStrategy(taxCode, lane('tax-code-stack'), 'dealmachine')
assert.equal(taxCodeQualification.eligible, true)
assert.equal(
  taxCodeQualification.reviewOnly,
  true,
  'Tax/code-stack contacts require evidence review and must never enter automatic sending'
)
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
