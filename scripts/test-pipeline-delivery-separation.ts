import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { evaluateOutreachDispatchHealth } from '../lib/outreach/outreachDispatchCore'
import { resolvePipelineExecutionMode } from '../lib/outreach/pipelineExecutionCore'

assert.deepEqual(resolvePipelineExecutionMode(), {
  dryRun: false,
  deliveryEnabled: true,
  deliveryDryRun: false,
})

assert.deepEqual(
  resolvePipelineExecutionMode({ dryRun: false, deliveryEnabled: false }),
  {
    dryRun: false,
    deliveryEnabled: false,
    deliveryDryRun: true,
  },
  'disabling delivery must leave production preparation live'
)

assert.deepEqual(
  resolvePipelineExecutionMode({ dryRun: true, deliveryEnabled: true }),
  {
    dryRun: true,
    deliveryEnabled: false,
    deliveryDryRun: true,
  },
  'an explicit dry run must keep every stage read-only'
)

assert.equal(
  evaluateOutreachDispatchHealth({
    dryRun: false,
    liveEnabled: false,
    expectedSendCount: 25,
    sentCount: 0,
    remainingCapacityAfterRun: 25,
    globalRemainingAfterRun: 100,
    throughputBlockedReason: 'delivery_not_permitted',
    blockingReasons: ['outbound_provider_not_configured'],
  }).status,
  'live_disabled',
  'disabled delivery is an intentional state, not an operational failure'
)

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const leadRoute = source('app/api/cron/outreach-dispatch/route.ts')
const leadAutomation = source('lib/leads/dailyAutomation.ts')
const partnerRoute = source('app/api/cron/partner-network-pipeline/route.ts')
const buyerRoute = source('app/api/cron/buyers-pipeline/route.ts')
const investorRoute = source('app/api/cron/investors-pipeline/route.ts')
const buyerAutomation = source('lib/buyers/automation.ts')
const lenderAutomation = source('lib/lenders/automation.ts')
const investorAutomation = source('lib/investors/automation.ts')

assert.match(leadRoute, /const dryRun = forcedDryRun/)
assert.match(leadRoute, /const deliveryEnabled = liveEnabled && !forcedDryRun/)
assert.match(leadRoute, /runLeadThroughputSprint\(\{[\s\S]*?dryRun,[\s\S]*?deliveryEnabled,/)
assert.doesNotMatch(leadRoute, /const dryRun = forcedDryRun \|\| !liveEnabled/)

assert.match(leadAutomation, /deliveryEnabled\?: boolean/)
assert.match(leadAutomation, /dryRun: executionMode\.deliveryDryRun/)
assert.match(leadAutomation, /const preparationTarget = executionMode\.dryRun \|\| executionMode\.deliveryEnabled/)

assert.match(partnerRoute, /const dryRun = forcedDryRun/)
assert.match(partnerRoute, /deliveryEnabled: laneDeliveryEnabled\.buyers/)
assert.match(partnerRoute, /deliveryEnabled: laneDeliveryEnabled\.lenders/)
assert.match(partnerRoute, /deliveryEnabled: laneDeliveryEnabled\.investors/)
assert.match(partnerRoute, /evaluateOutreachDispatchHealth\(\{[\s\S]*?dryRun,[\s\S]*?liveEnabled:/)

for (const [name, route, flag] of [
  ['buyer', buyerRoute, 'BUYERS_PIPELINE_CRON_SEND'],
  ['investor', investorRoute, 'INVESTORS_PIPELINE_CRON_SEND'],
] as const) {
  assert.match(
    route,
    /const dryRun = enabled\(url\.searchParams\.get\('dryRun'\)\)/,
    `${name} standalone pipeline must reserve dryRun for an explicit request.`
  )
  assert.match(
    route,
    new RegExp(`const deliveryEnabled = enabled\\(process\\.env\\.${flag}\\) && !dryRun`),
    `${name} standalone pipeline must gate only its delivery stage.`
  )
  assert.match(
    route,
    /runDaily(?:Buyer|Investor)Pipeline\(\{[\s\S]*?dryRun,[\s\S]*?deliveryEnabled,[\s\S]*?invocationId/,
    `${name} standalone pipeline must pass independent preparation, delivery, and shared invocation controls.`
  )
  assert.doesNotMatch(
    route,
    /const dryRun = requestedDryRun === null[\s\S]*?!liveEnabled/,
    `${name} disabled delivery must not force the whole pipeline into preview mode.`
  )
}

for (const automation of [buyerAutomation, lenderAutomation, investorAutomation]) {
  assert.match(automation, /deliveryEnabled\?: boolean/)
  assert.match(automation, /resolvePipelineExecutionMode\(options\)/)
  assert.match(automation, /dryRun: deliveryDryRun/)
}

assert.match(
  buyerAutomation,
  /runQualifiedSellerBuyerRouting\(dailyLaneTarget, \{ dryRun, autoSend: deliveryEnabled \}\)/,
  'buyer packet routing must prepare matches without delivering packets'
)

console.log('pipeline-delivery-separation: ok')
