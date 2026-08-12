import assert from 'node:assert/strict'

import {
  buildPropertyBuyerMatchInputFromLead,
  evaluateQualifiedSellerRouting,
} from '../lib/buyers/qualifiedSellerRoutingCore'
import type { LeadRecord } from '../lib/leads/types'

const lead = {
  id: '10000000-0000-4000-8000-000000000001',
  lead_type: 'sell_house',
  category: 'seller_lead',
  market_segment: 'preforeclosure-equity',
  source: 'county_preforeclosure',
  status: 'qualified',
  property_address: '123 Main St',
  city: 'Cleveland',
  state: 'OH',
  zip: '44101',
  pain_signal: 'Owner wants to avoid a rushed cash-only result.',
  notes: 'Open to seller finance or a hybrid structure.',
  form_data: {
    propertyType: 'single_family',
    occupancyStatus: 'owner occupied',
    propertyCondition: 'fair, needs repairs',
    timelineToSell: '30-60 days',
    askingPrice: '$185,000',
    estimatedValue: '$230,000',
  },
  metadata_json: {},
  contact_info: {},
  mailing_matches_property: true,
} as unknown as LeadRecord

assert.deepEqual(evaluateQualifiedSellerRouting(lead), {
  eligible: true,
  reason: 'eligible',
  legalSensitivity: false,
})

const matchInput = buildPropertyBuyerMatchInputFromLead(lead)
assert.equal(matchInput.askingPrice, 185000)
assert.equal(matchInput.estimatedValue, 230000)
assert.equal(matchInput.timelineDays, 45)
assert.equal(matchInput.creativeFinanceOpen, true)
assert.equal(matchInput.rehabLevel, 6)
assert.equal(matchInput.marketTag, 'Cleveland, OH')

const sensitive = { ...lead, notes: 'The property is in probate and needs attorney review.' }
assert.deepEqual(evaluateQualifiedSellerRouting(sensitive), {
  eligible: true,
  reason: 'legal_sensitivity_review',
  legalSensitivity: true,
})

const unqualified = { ...lead, status: 'contacted' } as LeadRecord
assert.equal(evaluateQualifiedSellerRouting(unqualified).eligible, false)

console.log('qualified-seller-routing: ok')
