import assert from 'node:assert/strict'

import { STRATEGY_EXECUTION_LANES } from '@/lib/admin/strategyExecutionCatalog'
import {
  STRATEGY_SOURCE_CONTRACTS,
  evaluateLeadStrategyStack,
  evaluatePropertyStrategyStack,
} from '@/lib/admin/strategySourceContracts'
import type { LeadRecord } from '@/lib/leads/types'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

function lead(metadata: Record<string, unknown>): LeadRecord {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    lead_type: 'sell_house',
    status: 'new',
    source: 'property_intelligence:county_public',
    source_url: null,
    category: 'seller_lead',
    external_id: 'test',
    name: 'Test Owner',
    business_name: null,
    property_address: '1 Test St',
    mailing_address: null,
    phone: null,
    email: 'owner@example.org',
    website: null,
    city: 'Test City',
    state: 'OH',
    zip: '00000',
    language_signal: null,
    pain_signal: null,
    best_offer: 'Real Estate Seller Lead',
    lead_score: 0,
    notes: null,
    contact_info: {},
    form_data: {},
    metadata_json: metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

for (const lane of STRATEGY_EXECUTION_LANES.filter((row) => row.enabled)) {
  assert.ok(STRATEGY_SOURCE_CONTRACTS[lane.key], `${lane.key} must have a source contract`)
}

assert.equal(
  evaluateLeadStrategyStack(lead({ signals: ['tax delinquent'] }), 'tax-code-stack').eligible,
  false,
  'tax-code-stack must not qualify from tax alone'
)

const circularRecommendationOnly = {
  id: '00000000-0000-0000-0000-000000000002',
  source_id: null,
  import_id: null,
  owner_entity_id: null,
  parcel_id: null,
  property_address: '2 Test St',
  city: 'Test City',
  state: 'OH',
  zip_code: '00000',
  county: null,
  latitude: null,
  longitude: null,
  land_use: 'SFR',
  property_class: 'Single Family Residence',
  assessed_value: 100_000,
  land_value: 20_000,
  building_value: 80_000,
  improvement_value: 80_000,
  structure_sqft: 1_200,
  lot_sqft: 5_000,
  year_built: 1980,
  is_vacant_lot: false,
  vacant_lot_confidence: 0,
  raw_fields: {
    attom: {
      facts: { equityPercent: 25, equityAmount: 50_000, estimatedLoanBalance: 150_000, ltvPercent: 75 },
      strategies: [{ key: 'preforeclosure-equity' }, { key: 'vacant-equity' }],
    },
  },
  property_signals: [{ signal_type: 'active_mortgage', signal_label: 'Active mortgage', confidence_score: 85 }],
  deal_scores: [{
    score: 99,
    reason_codes: ['PREFORECLOSURE_EQUITY', 'VACANT_EQUITY'],
    explanation: 'Circular recommendation labels',
    recommended_next_action: 'Review',
  }],
} satisfies PropertyIntelligenceRecord

assert.equal(
  evaluatePropertyStrategyStack(circularRecommendationOnly, 'preforeclosure-equity').eligible,
  false,
  'A prior recommendation or deal-score reason code must never become source evidence'
)
assert.equal(
  evaluatePropertyStrategyStack(circularRecommendationOnly, 'vacant-equity').eligible,
  false,
  'A strategy label must not manufacture a vacancy signal'
)
assert.equal(
  evaluatePropertyStrategyStack(circularRecommendationOnly, 'hybrid-equity-bridge').eligible,
  true,
  'Structured mortgage and equity facts may qualify a compatible creative-finance lane'
)
assert.equal(
  evaluateLeadStrategyStack(lead({ signals: ['tax delinquent', 'code violation'] }), 'tax-code-stack').eligible,
  true,
  'tax-code-stack requires both tax and code evidence'
)
assert.equal(
  evaluateLeadStrategyStack(lead({ signals: ['active mortgage', 'low equity'] }), 'subject-to-low-equity').eligible,
  true,
  'subject-to requires both active financing and low-equity evidence'
)
assert.equal(
  evaluateLeadStrategyStack(lead({ signals: ['vacant', 'equity'] }), 'probate-vacant-equity').eligible,
  false,
  'probate lane must not qualify without probate evidence'
)

console.log(`Validated ${STRATEGY_EXECUTION_LANES.filter((row) => row.enabled).length} enabled strategy source contracts.`)
