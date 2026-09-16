import assert from 'node:assert/strict'

import { DAILY_STRATEGY_OUTPUT_LANES } from '@/lib/outreach/dailyStrategyOutputCore'
import {
  DELIVERY_LANE_POLICIES,
  getDeliveryLanePolicy,
  isLeadColdEmailProhibited,
  routeDeliveryPurpose,
  type ColdOutreachLanePolicy,
  type DeliveryPurposeDecision,
} from '@/lib/outreach/deliveryPurposeCore'
import { hashMarketingConsentRecipient } from '@/lib/outreach/marketingConsentCore'

const marketingRecipient = 'member@example.test'
const marketingConsentEvidence = {
  source: 'next_move_questionnaires',
  recordId: '11111111-1111-4111-8111-111111111111',
  status: 'current',
  consentedAt: '2026-09-01T12:00:00.000Z',
  verifiedAt: new Date().toISOString(),
  revokedAt: null,
  recipientHash: hashMarketingConsentRecipient(marketingRecipient),
} as const

const expectedLanePolicyCases = [
  ['preforeclosure-equity', 'seller', 'consumer_hold'],
  ['tax-code-stack', 'seller', 'consumer_hold'],
  ['tax-remote-equity-rotation', 'seller', 'consumer_hold'],
  ['lien-equity', 'seller', 'consumer_hold'],
  ['probate-vacant-equity', 'seller', 'consumer_hold'],
  ['portfolio-landlord', 'seller', 'consumer_hold'],
  ['small-multifamily-portfolio', 'seller', 'consumer_hold'],
  ['builder-infill-teardown', 'seller', 'consumer_hold'],
  ['land-wholesale', 'seller', 'consumer_hold'],
  ['vacant-equity', 'seller', 'consumer_hold'],
  ['seller-finance-free-clear', 'seller', 'consumer_hold'],
  ['subject-to-low-equity', 'seller', 'consumer_hold'],
  ['hybrid-equity-bridge', 'seller', 'consumer_hold'],
  ['novation-retail-equity', 'seller', 'consumer_hold'],
  ['absentee-equity-creative', 'seller', 'consumer_hold'],
  ['active-stale-creative', 'seller', 'consumer_hold'],
  ['dealvault_records', 'business', 'b2b_business_contact_required'],
  ['funding_prep', 'business', 'b2b_business_contact_required'],
  ['search_visibility', 'business', 'b2b_business_contact_required'],
  ['ai_receptionist', 'business', 'b2b_business_contact_required'],
  ['buyers', 'partner', 'partner_business_contact_required'],
  ['lenders', 'partner', 'partner_business_contact_required'],
  ['investors', 'partner', 'partner_business_contact_required'],
] as const satisfies ReadonlyArray<readonly [string, string, ColdOutreachLanePolicy]>

function assertEmailDecision(
  decision: DeliveryPurposeDecision,
  provider: 'outlook',
  reason: DeliveryPurposeDecision['reason']
) {
  assert.equal(decision.disposition, 'send_email')
  assert.equal(decision.channel, 'email')
  assert.equal(decision.provider, provider)
  assert.equal(decision.reason, reason)
}

function assertHeldDecision(
  decision: DeliveryPurposeDecision,
  reason: DeliveryPurposeDecision['reason']
) {
  assert.equal(decision.disposition, 'hold_non_email')
  assert.equal(decision.channel, 'non_email')
  assert.equal(decision.provider, null)
  assert.equal(decision.reason, reason)
}

assert.equal(expectedLanePolicyCases.length, 23, 'Every canonical lane must have an independent expected policy.')
assert.equal(DELIVERY_LANE_POLICIES.length, 23)
assert.deepEqual(
  expectedLanePolicyCases.map(([key]) => key),
  DAILY_STRATEGY_OUTPUT_LANES.map((lane) => lane.key),
  'The test table must stay exhaustive and in canonical lane order.'
)

const allColdDecisions: DeliveryPurposeDecision[] = []

for (const [strategyKey, expectedGroup, expectedColdPolicy] of expectedLanePolicyCases) {
  const lanePolicy = getDeliveryLanePolicy(strategyKey)
  assert.ok(lanePolicy, `${strategyKey} must resolve to a delivery policy.`)
  assert.equal(lanePolicy.group, expectedGroup)
  assert.equal(lanePolicy.coldOutreach, expectedColdPolicy)

  assertEmailDecision(
    routeDeliveryPurpose({ strategyKey, purpose: 'transactional' }),
    'outlook',
    'transactional_outlook'
  )
  assertEmailDecision(
    routeDeliveryPurpose({
      strategyKey,
      purpose: 'marketing',
      recipientEmail: marketingRecipient,
      marketingConsentEvidence,
    }),
    'outlook',
    'durable_opt_in_marketing_outlook'
  )
  assertHeldDecision(
    routeDeliveryPurpose({ strategyKey, purpose: 'marketing' }),
    'marketing_missing_durable_consent'
  )
  assertHeldDecision(
    routeDeliveryPurpose({ strategyKey, purpose: 'marketing', hasExplicitOptIn: true }),
    'marketing_missing_durable_consent'
  )

  const coldWithoutBusinessProof = routeDeliveryPurpose({ strategyKey, purpose: 'cold_outreach' })
  const coldWithBusinessProof = routeDeliveryPurpose({
    strategyKey,
    purpose: 'cold_outreach',
    isBusinessContact: true,
  })
  allColdDecisions.push(coldWithoutBusinessProof, coldWithBusinessProof)

  if (expectedGroup === 'business') {
    assertHeldDecision(coldWithoutBusinessProof, 'business_contact_not_confirmed')
    assertEmailDecision(coldWithBusinessProof, 'outlook', 'business_contact_b2b_cold_outlook')
  } else if (expectedGroup === 'partner') {
    assertHeldDecision(coldWithoutBusinessProof, 'partner_contact_not_confirmed_business')
    assertHeldDecision(
      routeDeliveryPurpose({ strategyKey, purpose: 'cold_outreach', isBusinessContact: false }),
      'partner_contact_not_confirmed_business'
    )
    assertEmailDecision(coldWithBusinessProof, 'outlook', 'partner_business_contact_b2b_cold_outlook')
  } else {
    assertHeldDecision(coldWithoutBusinessProof, 'consumer_cold_email_prohibited')
    assertHeldDecision(coldWithBusinessProof, 'consumer_cold_email_prohibited')
  }
}

assert.equal(
  DELIVERY_LANE_POLICIES.filter((policy) => policy.coldOutreach === 'consumer_hold').length,
  16
)
assert.equal(
  DELIVERY_LANE_POLICIES.filter((policy) => policy.coldOutreach === 'b2b_business_contact_required').length,
  4
)
assert.equal(
  DELIVERY_LANE_POLICIES.filter((policy) => policy.coldOutreach === 'partner_business_contact_required').length,
  3
)
assert.ok(
  allColdDecisions.every((decision) => decision.provider === 'outlook' || decision.provider === null),
  'Cold outreach must select only Outlook or a non-email hold.'
)

for (const purposeCase of [
  { purpose: 'transactional' },
  {
    purpose: 'marketing',
    recipientEmail: marketingRecipient,
    marketingConsentEvidence,
  },
  { purpose: 'cold_outreach', isBusinessContact: true },
] as const) {
  assertHeldDecision(
    routeDeliveryPurpose({ strategyKey: 'not-a-canonical-lane', ...purposeCase }),
    'unknown_strategy_lane'
  )
}

assertHeldDecision(
  routeDeliveryPurpose({ strategyKey: 'dealvault_records', purpose: 'not-a-purpose' }),
  'unknown_delivery_purpose'
)
assertHeldDecision(
  routeDeliveryPurpose({
    strategyKey: 'dealvault_records',
    purpose: 'marketing',
    hasExplicitOptIn: 'true' as unknown as boolean,
  }),
  'marketing_missing_durable_consent'
)
assertHeldDecision(
  routeDeliveryPurpose({
    strategyKey: 'dealvault_records',
    purpose: 'marketing',
    recipientEmail: 'different@example.test',
    marketingConsentEvidence,
  }),
  'marketing_missing_durable_consent'
)
assertHeldDecision(
  routeDeliveryPurpose({
    strategyKey: 'dealvault_records',
    purpose: 'marketing',
    recipientEmail: marketingRecipient,
    marketingConsentEvidence: { ...marketingConsentEvidence, status: 'revoked', revokedAt: new Date().toISOString() },
  }),
  'marketing_missing_durable_consent'
)
assertHeldDecision(
  routeDeliveryPurpose({
    strategyKey: 'dealvault_records',
    purpose: 'marketing',
    recipientEmail: marketingRecipient,
    marketingConsentEvidence: {
      ...marketingConsentEvidence,
      verifiedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
  'marketing_missing_durable_consent'
)
assertHeldDecision(
  routeDeliveryPurpose({
    strategyKey: 'buyers',
    purpose: 'cold_outreach',
    isBusinessContact: 1 as unknown as boolean,
  }),
  'partner_contact_not_confirmed_business'
)
assert.equal(getDeliveryLanePolicy('not-a-canonical-lane'), null)

assert.equal(
  isLeadColdEmailProhibited({
    strategyKey: 'dealvault_records',
    lead: { category: 'seller_lead', lead_type: 'sell_house' },
  }),
  true,
  'A seller entity misattributed to a B2B strategy must remain prohibited from cold email.'
)
assert.equal(
  isLeadColdEmailProhibited({
    strategyKey: 'dealvault_records',
    lead: { category: 'small_business', lead_type: 'business_funding' },
  }),
  false
)

console.log('Delivery-purpose routing tests passed for all 23 canonical strategy lanes.')
