import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP,
  OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP,
  OUTLOOK_COLD_B2B_INVOCATION_CAP,
  OUTLOOK_COLD_B2B_LANE_KEYS,
  allocateOutlookColdLaneCaps,
  getOutlookColdSendWindow,
  inspectOutlookColdBudget,
  isOutlookColdSendWindow,
  reserveOutlookColdBudget,
  seedOutlookColdBudget,
  type OutlookColdBudgetMetrics,
} from '@/lib/outreach/outlookColdBudgetCore'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const now = new Date('2026-09-15T16:00:00.000Z')

assert.equal(OUTLOOK_COLD_B2B_GLOBAL_DAILY_CAP, 25)
assert.equal(OUTLOOK_COLD_B2B_DOMAIN_DAILY_CAP, 2)
assert.equal(OUTLOOK_COLD_B2B_INVOCATION_CAP, 2)
assert.equal(OUTLOOK_COLD_B2B_LANE_KEYS.length, 8)

const allocation = allocateOutlookColdLaneCaps(now)
assert.equal(Object.values(allocation.laneCaps).reduce((sum, cap) => sum + cap, 0), 25)
assert.equal(Object.values(allocation.laneCaps).filter((cap) => cap === 4).length, 1)
assert.equal(Object.values(allocation.laneCaps).filter((cap) => cap === 3).length, 7)
assert.deepEqual(allocateOutlookColdLaneCaps(now), allocation, 'lane allocation must be deterministic')

assert.equal(isOutlookColdSendWindow(now), true)
assert.equal(isOutlookColdSendWindow(new Date('2026-09-15T13:59:59.000Z')), false)
assert.equal(isOutlookColdSendWindow(new Date('2026-09-15T14:00:00.000Z')), true)
assert.equal(isOutlookColdSendWindow(new Date('2026-09-15T22:00:00.000Z')), false)
assert.equal(isOutlookColdSendWindow(new Date('2026-09-13T16:00:00.000Z')), false)
assert.equal(isOutlookColdSendWindow(new Date('2026-01-05T15:00:00.000Z')), true)
assert.equal(isOutlookColdSendWindow(new Date('2026-01-05T23:00:00.000Z')), false)
assert.deepEqual(
  getOutlookColdSendWindow(new Date('2026-09-15T14:00:00.000Z')),
  { allowed: true, weekday: 'Tue', hour: 9 },
  'the observable cron window must use the same Chicago predicate as provider admission'
)

function reserve(input: {
  metrics: OutlookColdBudgetMetrics
  key: string
  domain: string
  invocation: string
  lane: (typeof OUTLOOK_COLD_B2B_LANE_KEYS)[number]
  at?: Date
}) {
  return reserveOutlookColdBudget({
    metrics: input.metrics,
    idempotencyKeyHash: hash(`key:${input.key}`),
    recipientDomainHash: hash(`domain:${input.domain}`),
    invocationIdHash: hash(`invocation:${input.invocation}`),
    reservationId: `reservation-${input.key}`,
    strategyKey: input.lane,
    now: input.at || now,
  })
}

let metrics = seedOutlookColdBudget()
const first = reserve({ metrics, key: 'one', domain: 'one.test', invocation: 'run-a', lane: 'buyers' })
assert.equal(first.allowed, true)
assert.equal(first.attemptCount, 1)
metrics = first.metrics!
const second = reserve({ metrics, key: 'two', domain: 'two.test', invocation: 'run-a', lane: 'buyers' })
assert.equal(second.allowed, true)
metrics = second.metrics!
const burstBlocked = reserve({ metrics, key: 'three', domain: 'three.test', invocation: 'run-a', lane: 'buyers' })
assert.equal(burstBlocked.allowed, false)
assert.equal(burstBlocked.reason, 'outlook_cold_invocation_cap_exhausted')
const duplicate = reserve({ metrics, key: 'one', domain: 'one.test', invocation: 'run-b', lane: 'buyers' })
assert.equal(duplicate.allowed, true)
assert.equal(duplicate.duplicate, true)
assert.equal(duplicate.attemptCount, 2)
const inspection = inspectOutlookColdBudget(metrics, now)
assert.equal(inspection.valid, true)
assert.equal(inspection.globalAttemptCap, 25)
assert.equal(inspection.attemptCount, 2)
assert.equal(inspection.remaining, 23)
assert.equal(inspection.laneAttemptCounts.buyers, 2)

const invalidInspection = inspectOutlookColdBudget(null, now)
assert.equal(invalidInspection.valid, false)
assert.equal(invalidInspection.attemptCount, 0)
assert.equal(invalidInspection.remaining, 0, 'invalid budget state must fail closed')

metrics = seedOutlookColdBudget()
for (let index = 0; index < 2; index += 1) {
  const decision = reserve({
    metrics,
    key: `domain-${index}`,
    domain: 'shared.test',
    invocation: `domain-run-${index}`,
    lane: 'lenders',
  })
  assert.equal(decision.allowed, true)
  metrics = decision.metrics!
}
const domainBlocked = reserve({
  metrics,
  key: 'domain-three',
  domain: 'shared.test',
  invocation: 'domain-run-three',
  lane: 'lenders',
})
assert.equal(domainBlocked.reason, 'outlook_cold_domain_daily_cap_exhausted')

metrics = seedOutlookColdBudget()
const lane = OUTLOOK_COLD_B2B_LANE_KEYS[0]
const laneCap = allocation.laneCaps[lane]
for (let index = 0; index < laneCap; index += 1) {
  const decision = reserve({
    metrics,
    key: `lane-${index}`,
    domain: `lane-${index}.test`,
    invocation: `lane-run-${index}`,
    lane,
  })
  assert.equal(decision.allowed, true)
  metrics = decision.metrics!
}
const laneBlocked = reserve({
  metrics,
  key: 'lane-overflow',
  domain: 'lane-overflow.test',
  invocation: 'lane-overflow-run',
  lane,
})
assert.equal(laneBlocked.reason, 'outlook_cold_lane_daily_cap_exhausted')

metrics = seedOutlookColdBudget()
let sequence = 0
for (const strategyKey of OUTLOOK_COLD_B2B_LANE_KEYS) {
  for (let laneIndex = 0; laneIndex < allocation.laneCaps[strategyKey]; laneIndex += 1) {
    const decision = reserve({
      metrics,
      key: `global-${sequence}`,
      domain: `global-${sequence}.test`,
      invocation: `global-run-${sequence}`,
      lane: strategyKey,
    })
    assert.equal(decision.allowed, true)
    metrics = decision.metrics!
    sequence += 1
  }
}
assert.equal(sequence, 25)
const globalBlocked = reserve({
  metrics,
  key: 'global-overflow',
  domain: 'global-overflow.test',
  invocation: 'global-overflow-run',
  lane: OUTLOOK_COLD_B2B_LANE_KEYS[0],
})
assert.equal(globalBlocked.reason, 'outlook_cold_global_daily_cap_exhausted')

const afterWindow = new Date(now.getTime() + 25 * 60 * 60 * 1_000)
const agedOut = reserve({
  metrics,
  key: 'after-window',
  domain: 'after-window.test',
  invocation: 'after-window-run',
  lane: 'buyers',
  at: afterWindow,
})
assert.equal(agedOut.allowed, true)
assert.equal(agedOut.attemptCount, 1)

const malformed = reserveOutlookColdBudget({
  metrics: { schemaVersion: 1, windowHours: 24, attemptMarkers: [{}] },
  idempotencyKeyHash: hash('malformed-key'),
  recipientDomainHash: hash('malformed-domain'),
  invocationIdHash: hash('malformed-run'),
  reservationId: 'malformed',
  strategyKey: 'buyers',
  now,
})
assert.equal(malformed.allowed, false)
assert.equal(malformed.reason, 'outlook_cold_budget_marker_invalid')

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), 'lib/outreach/outlookColdBudget.ts'),
  'utf8'
)
const deliverySource = fs.readFileSync(
  path.join(process.cwd(), 'lib/outreach/outlookDelivery.ts'),
  'utf8'
)
const environmentDocs = fs.readFileSync(
  path.join(process.cwd(), 'docs/ENV_VARS_REQUIRED.md'),
  'utf8'
)
assert.match(repositorySource, /command_center_jobs/)
assert.match(repositorySource, /\.eq\('updated_at', row\.updated_at\)/)
assert.match(repositorySource, /recipientDomainHash/)
assert.doesNotMatch(repositorySource, /attemptMarkers:[\s\S]{0,200}recipientEmail/)
assert.match(deliverySource, /09:00–16:59 America\/Chicago/)
assert.match(environmentDocs, /09:00 through 16:59 America\/Chicago/)
assert.doesNotMatch(`${deliverySource}\n${environmentDocs}`, /15:00(?:–| through )21:59 UTC/)

console.log('Outlook cold budget, fairness, domain, invocation, and send-window tests passed.')
