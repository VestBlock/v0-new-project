import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { STRATEGY_EXECUTION_LANES } from '@/lib/admin/strategyExecutionCatalog'
import {
  OPERATING_STRATEGY_DEFINITIONS,
  OPERATING_STRATEGY_PARENT,
  PLATFORM_STRATEGY_LANES,
  PROPOSED_PLATFORM_STRATEGY_LANES,
  STRATEGY_IDENTIFIER_CROSSWALK,
  getStrategyIdentifierMapping,
  resolveRegisteredStrategyIdentifier,
  type OperatingStrategyKey,
  type PlatformStrategyLaneKey,
} from '@/lib/strategy/registry'

const expectedPortfolios = [
  'capital_funding',
  'real_estate_buyers_investors',
  'seller_property_acquisition',
  'lenders_capital_providers',
  'real_estate_professionals_providers',
  'business_buyers_sellers',
  'next_move_roadmaps',
  'dealvault_opportunities',
  'partnerships_referrals',
  'content_visibility',
  'public_sector_opportunities',
  'customer_lifecycle_growth',
] as const

const expectedParents: Record<OperatingStrategyKey, PlatformStrategyLaneKey> = {
  capital_readiness_intake: 'capital_funding',
  seller_options_intake: 'seller_property_acquisition',
  property_opportunity_discovery: 'seller_property_acquisition',
  buyer_buy_box_activation: 'real_estate_buyers_investors',
  lender_provider_criteria: 'lenders_capital_providers',
  next_move_free_roadmap: 'next_move_roadmaps',
  credit_education_support: 'next_move_roadmaps',
  business_formation_readiness: 'next_move_roadmaps',
  dealvault_activation: 'dealvault_opportunities',
  service_provider_network: 'real_estate_professionals_providers',
  partner_referral_network: 'partnerships_referrals',
  investor_capital_relationships: 'lenders_capital_providers',
  public_sector_opportunity_readiness: 'public_sector_opportunities',
  professional_participant_activation: 'customer_lifecycle_growth',
  content_authority_intelligence: 'content_visibility',
  customer_lifecycle_orchestration: 'customer_lifecycle_growth',
  business_acquisition_network: 'business_buyers_sellers',
}

const expectedAutopilotKeys = [
  'buyer-demand-capture',
  'capital-desk-lender-capture',
  'developer-builder-demand-capture',
  'creative-finance-buyer-capture',
  'tax-code-stack',
  'senior-out-of-state-landlord',
  'builder-infill-teardown',
  'land-wholesale',
  'small-multifamily-portfolio',
  'institutional-btr-buybox',
  'on-market-lowball-agent-sweep',
  'novation-retail-spread',
  'commercial-small-bay-distress',
  'stale-listing-creative-finance',
] as const

assert.deepEqual(PLATFORM_STRATEGY_LANES, expectedPortfolios)
assert.equal(new Set(PLATFORM_STRATEGY_LANES).size, 12)
assert.deepEqual(PROPOSED_PLATFORM_STRATEGY_LANES, [
  'public_sector_opportunities',
  'customer_lifecycle_growth',
])

assert.equal(OPERATING_STRATEGY_DEFINITIONS.length, 17)
assert.equal(new Set(OPERATING_STRATEGY_DEFINITIONS.map((strategy) => strategy.key)).size, 17)
assert.deepEqual(OPERATING_STRATEGY_PARENT, expectedParents)

for (const definition of OPERATING_STRATEGY_DEFINITIONS) {
  assert.equal(definition.parent, expectedParents[definition.key])
  assert.equal(definition.initialVersionStatus, 'draft')
  assert.equal(definition.externalSendCap, 0)
  assert.equal(definition.crmOwner, 'vestblock_crm')
  assert.ok(definition.automationOwner === 'vestblock_application' || definition.automationOwner === 'operator_manual')
  if (definition.destination.mode === 'public_route') {
    assert.match(definition.destination.path, /^\//)
    assert.ok(definition.destination.cta.trim().length > 0)
  } else {
    assert.equal(definition.key, 'customer_lifecycle_orchestration')
    assert.equal(definition.destination.path, null)
    assert.equal(definition.destination.cta, null)
  }
}

for (const portfolio of PLATFORM_STRATEGY_LANES) {
  assert.ok(
    OPERATING_STRATEGY_DEFINITIONS.some((strategy) => strategy.parent === portfolio),
    `Portfolio ${portfolio} must have at least one operating strategy.`
  )
}

const namespacedIdentifiers = STRATEGY_IDENTIFIER_CROSSWALK.map(
  (mapping) => `${mapping.namespace}:${mapping.sourceIdentifier}`
)
assert.equal(STRATEGY_IDENTIFIER_CROSSWALK.length, 132)
assert.equal(new Set(namespacedIdentifiers).size, namespacedIdentifiers.length)

for (const mapping of STRATEGY_IDENTIFIER_CROSSWALK) {
  if (mapping.operatingStrategy) {
    assert.ok(OPERATING_STRATEGY_PARENT[mapping.operatingStrategy])
  }
  if (mapping.allowsNewActivity) {
    assert.equal(mapping.resolution, 'current')
    assert.ok(mapping.operatingStrategy)
  }
}

assert.equal(STRATEGY_EXECUTION_LANES.length, 17)
for (const lane of STRATEGY_EXECUTION_LANES) {
  const mapping = getStrategyIdentifierMapping('seller_execution', lane.key)
  assert.ok(mapping, `Seller execution key ${lane.key} needs a namespaced mapping.`)
  assert.equal(mapping?.allowsNewActivity, lane.enabled)
  if (lane.enabled) assert.equal(mapping?.resolution, 'current')
}

for (const key of expectedAutopilotKeys) {
  const mapping = getStrategyIdentifierMapping('command_center_autopilot', key)
  assert.ok(mapping, `Autopilot key ${key} needs a namespaced mapping.`)
  assert.equal(mapping?.resolution, 'current')
  assert.equal(mapping?.allowsNewActivity, true)
}

for (const overlappingKey of [
  'tax-code-stack',
  'builder-infill-teardown',
  'land-wholesale',
  'small-multifamily-portfolio',
]) {
  assert.ok(getStrategyIdentifierMapping('seller_execution', overlappingKey))
  assert.ok(getStrategyIdentifierMapping('command_center_autopilot', overlappingKey))
  assert.throws(
    () => resolveRegisteredStrategyIdentifier('legacy_runtime', overlappingKey),
    /Unmapped strategy identifier/
  )
}

assert.throws(
  () => resolveRegisteredStrategyIdentifier('seller_execution', 'active-stale-lowball'),
  /not approved for new activity/
)
assert.throws(
  () => resolveRegisteredStrategyIdentifier('revenue_campaign', 'other'),
  /not approved for new activity/
)
assert.throws(
  () => resolveRegisteredStrategyIdentifier('legacy_runtime', 'global-suppression'),
  /not approved for new activity/
)
assert.throws(
  () => resolveRegisteredStrategyIdentifier('seller_execution', 'unknown-strategy'),
  /Unmapped strategy identifier/
)
assert.throws(
  () => resolveRegisteredStrategyIdentifier('seller_execution', ''),
  /Unmapped strategy identifier/
)
assert.deepEqual(resolveRegisteredStrategyIdentifier('seller_execution', 'tax-code-stack'), {
  portfolio: 'seller_property_acquisition',
  operatingStrategy: 'property_opportunity_discovery',
  executionReady: false,
})
assert.equal(
  getStrategyIdentifierMapping('command_center_autopilot', 'buyer-reverse-engineering')?.operatingStrategy,
  'buyer_buy_box_activation'
)
assert.deepEqual(getStrategyIdentifierMapping('legacy_runtime', 'seller-outreach'), {
  namespace: 'legacy_runtime',
  sourceIdentifier: 'seller-outreach',
  kind: 'legacy_alias',
  operatingStrategy: 'seller_options_intake',
  resolution: 'current',
  allowsNewActivity: true,
})

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260815165840_gate3a_strategy_registry_contracts.sql'),
  'utf8'
)
for (const requiredFragment of [
  'activate_strategy_lane_version',
  'activate_operating_strategy_version',
  'resolve_operating_strategy_identifier',
  'strategy_identifier_crosswalk_one_current_idx',
  'operating_strategy_versions_one_active_idx',
  'FORCE ROW LEVEL SECURITY',
  'external_send_cap = 0',
  'n8n live sending to remain disabled',
]) {
  assert.ok(migration.includes(requiredFragment), `Migration is missing ${requiredFragment}.`)
}

const enforcementMigrationName = readdirSync(
  resolve(process.cwd(), 'supabase/migrations')
).filter((name) => name.endsWith('_gate3a_strategy_registry_enforcement.sql'))
assert.equal(enforcementMigrationName.length, 1)
const enforcementMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', enforcementMigrationName[0]),
  'utf8'
)
for (const requiredFragment of [
  'SECURITY DEFINER',
  'gate3a_assign_runtime_strategy',
  'strategy_lane_versions_history_guard',
  'apply_strategy_lane_proposal',
  'Hollow operating contracts must fail validation',
  "'seller-outreach'",
  'REVOKE ALL ON TABLE public.strategy_updates FROM service_role',
  'Gate 3A requires n8n live sending to remain disabled',
]) {
  assert.ok(enforcementMigration.includes(requiredFragment), `Enforcement migration is missing ${requiredFragment}.`)
}

const databaseTest = readFileSync(
  resolve(process.cwd(), 'scripts/test-strategy-registry-database.sql'),
  'utf8'
)
for (const requiredFragment of [
  'SET LOCAL ROLE service_role',
  'activate_operating_strategy_version',
  'apply_strategy_lane_proposal',
  'unknown_strategy_key',
  'gate3a_deliberate_nested_rollback',
  'An outcome contract without learningWindowDays was accepted',
  'An outcome contract without minimumExposure was accepted',
  'Retired portfolio strategy history was mutable',
  'ROLLBACK',
]) {
  assert.ok(databaseTest.includes(requiredFragment), `Database regression test is missing ${requiredFragment}.`)
}

const nullSemanticsMigrationName = readdirSync(
  resolve(process.cwd(), 'supabase/migrations')
).filter((name) => name.endsWith('_gate3a_outcome_validator_null_semantics.sql'))
assert.equal(nullSemanticsMigrationName.length, 1)
const nullSemanticsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', nullSemanticsMigrationName[0]),
  'utf8'
)
for (const requiredFragment of [
  'SELECT COALESCE(',
  "base_contract - 'learningWindowDays'",
  "base_contract - 'minimumExposure'",
  'Gate 3A requires n8n live sending to remain disabled',
]) {
  assert.ok(nullSemanticsMigration.includes(requiredFragment), `Null-semantics migration is missing ${requiredFragment}.`)
}

const sellerTargetedSend = readFileSync(
  resolve(process.cwd(), 'app/api/cron/seller-targeted-send/route.ts'),
  'utf8'
)
const sellerDailyAutomation = readFileSync(
  resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'),
  'utf8'
)
for (const [path, source] of [
  ['app/api/cron/seller-targeted-send/route.ts', sellerTargetedSend],
  ['lib/leads/dailyAutomation.ts', sellerDailyAutomation],
] as const) {
  assert.ok(
    source.includes("const GOVERNED_SELLER_STRATEGY_KEY = 'seller-outreach'"),
    `${path} must bind seller delivery to the governed seller strategy.`
  )
  assert.ok(
    source.includes('const marketSegment = lead.market_segment ||'),
    `${path} must retain the seller market segment as metadata.`
  )
  assert.ok(
    source.includes('strategyKey, marketSegment'),
    `${path} must record both the governed strategy and the market segment.`
  )
  assert.doesNotMatch(
    source,
    /strategyKey\s*[:=]\s*lead\.market_segment/,
    `${path} must not execute a market segment as a strategy key.`
  )
}


console.log(
  JSON.stringify(
    {
      passed: true,
      portfolios: PLATFORM_STRATEGY_LANES.length,
      proposedPortfolios: PROPOSED_PLATFORM_STRATEGY_LANES.length,
      operatingStrategies: OPERATING_STRATEGY_DEFINITIONS.length,
      namespacedCrosswalkRows: STRATEGY_IDENTIFIER_CROSSWALK.length,
      sellerExecutionKeys: STRATEGY_EXECUTION_LANES.length,
      autopilotKeys: expectedAutopilotKeys.length,
      externalSendCap: 0,
    },
    null,
    2
  )
)
