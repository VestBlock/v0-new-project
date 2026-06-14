import assert from 'node:assert/strict'

import { buildOperatingArchitecture } from '../lib/admin/operatingArchitecture'

const weak = buildOperatingArchitecture({
  ledgerEventCount: 0,
  operatingLoopCount: 10,
  replySignals7d: 0,
  sent7d: 0,
  sellerLeads: 12,
  propertyLeadCount: 6,
  pendingBuyerMatches: 0,
  pendingLenderMatches: 0,
  followupsDue: 0,
  partnerFollowupsDue: 0,
  partnerBuyBoxesConfirmed: 0,
  partnerResearchReady: 0,
  partnerOutreachReady: 0,
  activeSuppressionCount: 0,
  freshSourceCount: 0,
  staleSourceCount: 4,
  openTaskCount: 0,
  overdueTaskCount: 0,
  analyzerOutcomeCount: 0,
})

assert.equal(weak.status, 'red')
assert.equal(weak.pillars.length, 6)
assert.equal(weak.pillars.find((pillar) => pillar.key === 'event_bus')?.status, 'red')
assert.equal(weak.pillars.find((pillar) => pillar.key === 'deal_digital_twin')?.status, 'yellow')
assert.ok(weak.nextBuildSteps.some((step) => step.includes('event ledger')))

const strong = buildOperatingArchitecture({
  ledgerEventCount: 44,
  operatingLoopCount: 10,
  replySignals7d: 8,
  sent7d: 220,
  sellerLeads: 900,
  propertyLeadCount: 260,
  pendingBuyerMatches: 2,
  pendingLenderMatches: 1,
  followupsDue: 3,
  partnerFollowupsDue: 1,
  partnerBuyBoxesConfirmed: 14,
  partnerResearchReady: 27,
  partnerOutreachReady: 19,
  activeSuppressionCount: 35,
  freshSourceCount: 6,
  staleSourceCount: 0,
  openTaskCount: 4,
  overdueTaskCount: 0,
  analyzerOutcomeCount: 11,
})

assert.equal(strong.status, 'green')
assert.equal(strong.pillars.find((pillar) => pillar.key === 'event_bus')?.status, 'green')
assert.equal(strong.pillars.find((pillar) => pillar.key === 'agent_debate')?.status, 'green')
assert.ok(strong.summary.includes('core operating-system pieces'))

console.log('operating-architecture: ok')
