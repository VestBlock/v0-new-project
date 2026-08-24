import assert from 'node:assert/strict'

import { decideStrategyOutcome } from '../lib/improvement/strategyOutcomePolicy'

const now = new Date('2026-08-24T12:00:00.000Z')

const winner = decideStrategyOutcome({
  currentStatus: 'cooling',
  currentPriorityScore: 10,
  currentNextRunAt: null,
  metrics: { sent: 10, delivered: 8, replied: 2, bounced: 0 },
  now,
})
assert.equal(winner.action, 'promote')
assert.equal(winner.status, 'active')
assert.equal(winner.priorityScore, 22)
assert.equal(winner.nextRunAt, '2026-08-28T12:00:00.000Z')

const poorDelivery = decideStrategyOutcome({
  currentStatus: 'active',
  currentPriorityScore: 25,
  currentNextRunAt: null,
  metrics: { sent: 10, delivered: 3, replied: 0, bounced: 2 },
  now,
})
assert.equal(poorDelivery.action, 'cool')
assert.equal(poorDelivery.status, 'cooling')
assert.equal(poorDelivery.priorityScore, 9)
assert.equal(poorDelivery.nextRunAt, '2026-09-14T12:00:00.000Z')

const insufficientSample = decideStrategyOutcome({
  currentStatus: 'active',
  currentPriorityScore: 8,
  currentNextRunAt: '2026-08-30T12:00:00.000Z',
  metrics: { sent: 2, delivered: 2, replied: 1, bounced: 0 },
  now,
})
assert.equal(insufficientSample.action, 'hold')
assert.equal(insufficientSample.priorityScore, 8)
assert.equal(insufficientSample.nextRunAt, '2026-08-30T12:00:00.000Z')

const pausedLane = decideStrategyOutcome({
  currentStatus: 'paused',
  currentPriorityScore: 40,
  currentNextRunAt: '2026-09-01T12:00:00.000Z',
  metrics: { sent: 20, delivered: 18, replied: 5, bounced: 0 },
  now,
})
assert.equal(pausedLane.action, 'hold')
assert.equal(pausedLane.status, 'paused')
assert.equal(pausedLane.priorityScore, 40)

console.log('strategy-outcome-learning: ok')
