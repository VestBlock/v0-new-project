import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEALMACHINE_STRATEGIES, buildDailyStrategyPlans } from '../lib/dealmachine/v2-strategy-catalog.mjs'

function source(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const activePlans = buildDailyStrategyPlans({ date: '2026-08-15' })
assert.equal(activePlans.length, 16)
assert.equal(activePlans.some((plan) => plan.lowball), false)
assert.deepEqual(
  DEALMACHINE_STRATEGIES.filter((strategy) => strategy.lowball).map((strategy) => ({
    key: strategy.key,
    enabled: strategy.enabled,
  })),
  [{ key: 'active-stale-lowball', enabled: false }]
)

const propertyOpportunityKeys = new Set([
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
])
const sellerOptionKeys = new Set([
  'seller-finance-free-clear',
  'subject-to-low-equity',
  'hybrid-equity-bridge',
  'novation-retail-equity',
  'absentee-equity-creative',
  'active-stale-creative',
])
assert.equal(activePlans.filter((plan) => propertyOpportunityKeys.has(plan.key)).length, 10)
assert.equal(activePlans.filter((plan) => sellerOptionKeys.has(plan.key)).length, 6)
assert.equal(activePlans.every((plan) => propertyOpportunityKeys.has(plan.key) || sellerOptionKeys.has(plan.key)), true)

const registry = source('lib/strategy/registry.ts')
for (const key of propertyOpportunityKeys) {
  assert.match(registry, new RegExp(`['\"]${key}['\"]`), `Missing registry mapping for ${key}.`)
}
for (const key of sellerOptionKeys) {
  assert.match(registry, new RegExp(`['\"]${key}['\"]`), `Missing registry mapping for ${key}.`)
}

const outboundEligibility = source('lib/leads/outboundEligibility.ts')
assert.match(outboundEligibility, /normalized\(lead\.source\)\.includes\('dealmachine'\)/)
assert.match(outboundEligibility, /return 'dealmachine_discovery_outbound_prohibited'/)

const api = source('lib/dealmachine/api.ts')
assert.equal(api.includes('upsertLead'), false, 'Discovery must not create or mutate lead records.')
assert.equal(api.includes('sendEmail'), false, 'Discovery must not dispatch email.')
assert.equal(api.includes('sendMail'), false, 'Discovery must not dispatch mail.')
assert.equal(api.includes('recordDealMachineSourceAttribution('), false, 'Raw observations must not self-attribute.')
assert.ok(api.indexOf('appendDealMachineObservation({') < api.indexOf('linkDealMachineObservationEntity({'))
assert.match(api, /mode === 'property_sample' && !isDealMachinePaidSearchEnabled\(\)/)
assert.match(api, /reviewed opaque approvalReference is required/)
assert.match(api, /countIdempotencyKey = requestIdentity\(\{ runKey: countRunKey, requestHash: countHash \}\)/)
assert.match(api, /sampleIdempotencyKey = requestIdentity\(\{ runKey: sampleRunKey, requestHash: searchHash \}\)/)
assert.match(api, /reason: 'provider_response_schema_drift'/)
assert.match(api, /eventType: 'provider_ambiguous',[\s\S]*errorCode: 'paid_response_schema_drift'/)
assert.match(api, /if \(!authority\.shouldExecute\)[\s\S]*billable provider replay was blocked/)
assert.ok(
  api.indexOf("if (!authority.shouldExecute)") < api.indexOf('paidClient!.searchProperties(searchBody)'),
  'The one-shot database claim must be checked before the billable provider call.'
)

const observationAuthority = source('lib/dealmachine/observation-authority.ts')
assert.match(observationAuthority, /DEALMACHINE_V2_WRITER_RELEASE = 'dealmachine_v2_observation_v1'/)
assert.match(observationAuthority, /recordDealMachineOperatorReview/)
assert.match(observationAuthority, /recordDealMachineSourceAttribution/)
assert.match(observationAuthority, /accepted_for_attribution/)

const strategyEngine = source('lib/admin/strategyExecutionEngine.ts')
const autonomousSystem = source('lib/admin/autonomousOperatingSystem.ts')
assert.equal(strategyEngine.includes('await syncDealMachineLeadSource('), false)
assert.match(strategyEngine, /DealMachine acquisition is isolated from strategy execution/)
assert.match(strategyEngine, /import \{ getLeadOutboundPauseReason \} from '@\/lib\/leads\/outboundEligibility'/)
assert.ok(
  strategyEngine.indexOf('if (getLeadOutboundPauseReason(lead)) continue') <
    strategyEngine.indexOf('const provenance = getStrategyLeadProvenance(lead)'),
  'A fully qualified legacy DealMachine lead must be excluded before provenance, pooling, verification, or drafting.'
)
assert.equal(
  strategyEngine.includes("(['dealmachine', 'homeharvest', 'public_records', 'property_intelligence']"),
  false,
  'DealMachine must not be a default strategy-engine provider.'
)
assert.match(autonomousSystem, /syncDealMachine: false/)

const cronRoute = source('app/api/cron/dealmachine-v2-acquisition/route.ts')
assert.match(cronRoute, /mode: 'count_only'/)
assert.equal(cronRoute.includes('property_sample'), false)
assert.equal(cronRoute.includes('strategy_source_events'), false)

const vercelConfig = JSON.parse(source('vercel.json'))
assert.equal(
  (vercelConfig.crons || []).some((cron) => String(cron.path || '').includes('dealmachine-v2-acquisition')),
  false,
  'DealMachine discovery must remain unscheduled until its database control is explicitly released.'
)

console.log('DealMachine v2 readiness tests passed: 16 property-only plans, 10/6 canonical owners, zero outreach authority.')
