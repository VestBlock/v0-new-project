import assert from 'node:assert/strict'

import {
  DAILY_STRATEGY_OUTPUT_LANES,
  allocateDailyStrategyOutput,
  chicagoBusinessDate,
  configuredDailyStrategyOutputTarget,
  getDailyStrategyOutputLane,
  totalDailyStrategyOutputByGroup,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { normalizeStrategyLeadMemberships } from '@/lib/outreach/strategyMembershipShape'

const expectedSellerKeys = [
  'preforeclosure-equity',
  'tax-code-stack',
  'tax-remote-equity-rotation',
  'lien-equity',
  'probate-vacant-equity',
  'portfolio-landlord',
  'small-multifamily-portfolio',
  'builder-infill-teardown',
  'land-wholesale',
  'vacant-equity',
  'seller-finance-free-clear',
  'subject-to-low-equity',
  'hybrid-equity-bridge',
  'novation-retail-equity',
  'absentee-equity-creative',
  'active-stale-creative',
]
const expectedBusinessKeys = [
  'dealvault_records',
  'funding_prep',
  'search_visibility',
  'ai_receptionist',
]
const expectedPartnerKeys = ['buyers', 'lenders', 'investors']
const expectedKeys = [...expectedSellerKeys, ...expectedBusinessKeys, ...expectedPartnerKeys]

assert.equal(DAILY_STRATEGY_OUTPUT_LANES.length, 23)
assert.equal(configuredDailyStrategyOutputTarget({}), 1_000)
assert.equal(
  configuredDailyStrategyOutputTarget({
    VESTBLOCK_DAILY_OUTREACH_TARGET: '1000',
    OUTREACH_V2_DAILY_QUALITY_TARGET: '500',
    LEADS_TARGET_EMAILS_PER_DAY: '250',
  }),
  1_000,
  'the canonical target must override every legacy target'
)
assert.equal(
  configuredDailyStrategyOutputTarget({ OUTREACH_V2_DAILY_QUALITY_TARGET: '500' }),
  500,
  'a legacy target remains a compatibility fallback only when the canonical target is absent'
)
assert.equal(configuredDailyStrategyOutputTarget({ VESTBLOCK_DAILY_OUTREACH_TARGET: '1200' }), 1_000)
assert.equal(configuredDailyStrategyOutputTarget({ VESTBLOCK_DAILY_OUTREACH_TARGET: '0' }), 0)
assert.deepEqual(DAILY_STRATEGY_OUTPUT_LANES.map((lane) => lane.key), expectedKeys)
assert.equal(new Set(expectedKeys).size, expectedKeys.length, 'Every canonical strategy key must be unique')
assert.equal(DAILY_STRATEGY_OUTPUT_LANES.filter((lane) => lane.group === 'seller').length, 16)
assert.equal(DAILY_STRATEGY_OUTPUT_LANES.filter((lane) => lane.group === 'business').length, 4)
assert.equal(DAILY_STRATEGY_OUTPUT_LANES.filter((lane) => lane.group === 'partner').length, 3)

const firstDay = new Date('2026-09-15T17:00:00.000Z')
const nextDay = new Date('2026-09-16T17:00:00.000Z')
const defaultPlan = allocateDailyStrategyOutput(undefined, firstDay)
const defaultTargets = defaultPlan.allocations.map((allocation) => allocation.target)

assert.equal(defaultPlan.target, 1_000)
assert.equal(defaultTargets.reduce((sum, target) => sum + target, 0), 1_000)
assert.equal(defaultTargets.filter((target) => target === 44).length, 11)
assert.equal(defaultTargets.filter((target) => target === 43).length, 12)
assert.ok(Math.max(...defaultTargets) - Math.min(...defaultTargets) <= 1)
assert.deepEqual(defaultPlan.allocations.map((allocation) => allocation.key), expectedKeys, 'Allocation output order must stay canonical')

const nextPlan = allocateDailyStrategyOutput(1_000, nextDay)
assert.notEqual(nextPlan.rotationOffset, defaultPlan.rotationOffset)
assert.notDeepEqual(
  nextPlan.allocations.filter((allocation) => allocation.target === 44).map((allocation) => allocation.key),
  defaultPlan.allocations.filter((allocation) => allocation.target === 44).map((allocation) => allocation.key),
  'The remainder lanes must rotate on the next Chicago business date'
)

const aroundChicagoMidnight = new Date('2026-09-16T04:30:00.000Z')
assert.equal(chicagoBusinessDate(aroundChicagoMidnight), '2026-09-15')
assert.equal(allocateDailyStrategyOutput(1_000, aroundChicagoMidnight).rotationOffset, defaultPlan.rotationOffset)

const smallPlan = allocateDailyStrategyOutput(5, firstDay)
const smallTargets = smallPlan.allocations.map((allocation) => allocation.target)
assert.equal(smallTargets.reduce((sum, target) => sum + target, 0), 5)
assert.equal(smallTargets.filter((target) => target === 1).length, 5)
assert.equal(smallTargets.filter((target) => target === 0).length, 18)
assert.ok(Math.max(...smallTargets) - Math.min(...smallTargets) <= 1)

const zeroPlan = allocateDailyStrategyOutput(0, firstDay)
assert.equal(zeroPlan.allocations.reduce((sum, allocation) => sum + allocation.target, 0), 0)
assert.ok(zeroPlan.allocations.every((allocation) => allocation.target === 0))
assert.deepEqual(zeroPlan.groupTotals, { seller: 0, business: 0, partner: 0 })

const independentlySummedGroups = totalDailyStrategyOutputByGroup(defaultPlan.allocations)
assert.deepEqual(defaultPlan.groupTotals, independentlySummedGroups)
assert.equal(Object.values(defaultPlan.groupTotals).reduce((sum, target) => sum + target, 0), 1_000)
assert.equal(
  defaultPlan.groupTotals.seller,
  defaultPlan.allocations.filter((allocation) => allocation.group === 'seller').reduce((sum, allocation) => sum + allocation.target, 0)
)
assert.equal(
  defaultPlan.groupTotals.business,
  defaultPlan.allocations.filter((allocation) => allocation.group === 'business').reduce((sum, allocation) => sum + allocation.target, 0)
)
assert.equal(
  defaultPlan.groupTotals.partner,
  defaultPlan.allocations.filter((allocation) => allocation.group === 'partner').reduce((sum, allocation) => sum + allocation.target, 0)
)

assert.equal(getDailyStrategyOutputLane('ai_receptionist')?.group, 'business')
assert.equal(getDailyStrategyOutputLane('missing-strategy'), null)
assert.equal(defaultPlan.byKey['preforeclosure-equity'], defaultPlan.allocations[0].target)
assert.equal(defaultPlan.byKey.investors, defaultPlan.allocations.at(-1)?.target)

const singularMembership = { strategy_key: 'tax-code-stack', created_at: '2026-09-15T18:00:00.000Z' }
assert.deepEqual(
  normalizeStrategyLeadMemberships(singularMembership),
  [singularMembership],
  'a unique PostgREST relationship is embedded as an object and must remain iterable'
)
assert.deepEqual(normalizeStrategyLeadMemberships([singularMembership]), [singularMembership])
assert.deepEqual(normalizeStrategyLeadMemberships(null), [])

console.log('Daily strategy output allocation tests passed.')
