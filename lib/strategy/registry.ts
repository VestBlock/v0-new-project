export const PLATFORM_STRATEGY_LANES = [
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

export const PROPOSED_PLATFORM_STRATEGY_LANES = [
  'public_sector_opportunities',
  'customer_lifecycle_growth',
] as const

export type PlatformStrategyLaneKey = (typeof PLATFORM_STRATEGY_LANES)[number]

export type OperatingStrategyKey =
  | 'capital_readiness_intake'
  | 'seller_options_intake'
  | 'property_opportunity_discovery'
  | 'buyer_buy_box_activation'
  | 'lender_provider_criteria'
  | 'next_move_free_roadmap'
  | 'credit_education_support'
  | 'business_formation_readiness'
  | 'dealvault_activation'
  | 'service_provider_network'
  | 'partner_referral_network'
  | 'investor_capital_relationships'
  | 'public_sector_opportunity_readiness'
  | 'professional_participant_activation'
  | 'content_authority_intelligence'
  | 'customer_lifecycle_orchestration'
  | 'business_acquisition_network'

export type StrategyDestination =
  | { mode: 'public_route'; path: `/${string}`; cta: string }
  | { mode: 'internal_only'; path: null; cta: null }

export type OperatingStrategyDefinition = {
  key: OperatingStrategyKey
  parent: PlatformStrategyLaneKey
  title: string
  destination: StrategyDestination
  crmOwner: 'vestblock_crm'
  automationOwner: 'vestblock_application' | 'operator_manual'
  initialVersionStatus: 'draft'
  externalSendCap: 0
}

export const OPERATING_STRATEGY_DEFINITIONS = [
  {
    key: 'capital_readiness_intake',
    parent: 'capital_funding',
    title: 'Capital readiness intake',
    destination: { mode: 'public_route', path: '/capital', cta: 'Review my capital path' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'seller_options_intake',
    parent: 'seller_property_acquisition',
    title: 'Seller options intake',
    destination: { mode: 'public_route', path: '/sell', cta: 'Review my sale path' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'property_opportunity_discovery',
    parent: 'seller_property_acquisition',
    title: 'Property opportunity discovery',
    destination: { mode: 'public_route', path: '/real-estate', cta: 'Explore real estate paths' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'buyer_buy_box_activation',
    parent: 'real_estate_buyers_investors',
    title: 'Buyer buy-box activation',
    destination: { mode: 'public_route', path: '/workspace/profiles', cta: 'Create my buyer profile' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'lender_provider_criteria',
    parent: 'lenders_capital_providers',
    title: 'Lender and provider criteria',
    destination: { mode: 'public_route', path: '/workspace/profiles', cta: 'Add my provider criteria' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'next_move_free_roadmap',
    parent: 'next_move_roadmaps',
    title: 'Free Next Move roadmap',
    destination: { mode: 'public_route', path: '/next-move', cta: 'Build my free roadmap' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'credit_education_support',
    parent: 'next_move_roadmaps',
    title: 'Credit education and support',
    destination: { mode: 'public_route', path: '/credit-upload', cta: 'Review my credit report' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'business_formation_readiness',
    parent: 'next_move_roadmaps',
    title: 'Business formation readiness',
    destination: { mode: 'public_route', path: '/business-setup', cta: 'Build my business foundation' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'dealvault_activation',
    parent: 'dealvault_opportunities',
    title: 'DealVault activation',
    destination: { mode: 'public_route', path: '/dealvault', cta: 'Explore DealVault' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'service_provider_network',
    parent: 'real_estate_professionals_providers',
    title: 'Service-provider network',
    destination: { mode: 'public_route', path: '/workspace/profiles', cta: 'Create my provider profile' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'partner_referral_network',
    parent: 'partnerships_referrals',
    title: 'Partner referral network',
    destination: { mode: 'public_route', path: '/opportunity', cta: 'Explore partnership paths' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'operator_manual',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'investor_capital_relationships',
    parent: 'lenders_capital_providers',
    title: 'Investor and capital relationships',
    destination: { mode: 'public_route', path: '/workspace/profiles', cta: 'Create my investor profile' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'public_sector_opportunity_readiness',
    parent: 'public_sector_opportunities',
    title: 'Public-sector opportunity readiness',
    destination: { mode: 'public_route', path: '/opportunity', cta: 'Review opportunity readiness' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'operator_manual',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'professional_participant_activation',
    parent: 'customer_lifecycle_growth',
    title: 'Professional participant activation',
    destination: { mode: 'public_route', path: '/workspace/profiles', cta: 'Complete my participant profile' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'content_authority_intelligence',
    parent: 'content_visibility',
    title: 'Content authority and intelligence',
    destination: { mode: 'public_route', path: '/opportunity', cta: 'Find my next opportunity' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'customer_lifecycle_orchestration',
    parent: 'customer_lifecycle_growth',
    title: 'Customer lifecycle orchestration',
    destination: { mode: 'internal_only', path: null, cta: null },
    crmOwner: 'vestblock_crm',
    automationOwner: 'vestblock_application',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
  {
    key: 'business_acquisition_network',
    parent: 'business_buyers_sellers',
    title: 'Business acquisition network',
    destination: { mode: 'public_route', path: '/capital', cta: 'Prepare for a business acquisition' },
    crmOwner: 'vestblock_crm',
    automationOwner: 'operator_manual',
    initialVersionStatus: 'draft',
    externalSendCap: 0,
  },
] as const satisfies readonly OperatingStrategyDefinition[]

export const OPERATING_STRATEGY_KEYS = OPERATING_STRATEGY_DEFINITIONS.map((definition) => definition.key)

export const OPERATING_STRATEGY_PARENT = Object.freeze(
  Object.fromEntries(OPERATING_STRATEGY_DEFINITIONS.map((definition) => [definition.key, definition.parent]))
) as Readonly<Record<OperatingStrategyKey, PlatformStrategyLaneKey>>

export type StrategyIdentifierNamespace =
  | 'operating_strategy'
  | 'seller_execution'
  | 'command_center_autopilot'
  | 'city_scenario'
  | 'next_move_focus'
  | 'capital_path'
  | 'revenue_campaign'
  | 'platform_scenario'
  | 'legacy_runtime'

export type StrategyIdentifierKind =
  | 'operating_strategy'
  | 'source_tactic'
  | 'segment'
  | 'journey'
  | 'recommendation_tag'
  | 'legacy_alias'

export type StrategyIdentifierMapping = {
  namespace: StrategyIdentifierNamespace
  sourceIdentifier: string
  kind: StrategyIdentifierKind
  operatingStrategy: OperatingStrategyKey | null
  resolution: 'current' | 'historical' | 'unresolved' | 'retired'
  allowsNewActivity: boolean
}

const map = (
  namespace: StrategyIdentifierNamespace,
  sourceIdentifier: string,
  kind: StrategyIdentifierKind,
  operatingStrategy: OperatingStrategyKey | null,
  resolution: StrategyIdentifierMapping['resolution'] = 'historical',
  allowsNewActivity = false
): StrategyIdentifierMapping => ({
  namespace,
  sourceIdentifier,
  kind,
  operatingStrategy,
  resolution,
  allowsNewActivity,
})

const operatingMappings = OPERATING_STRATEGY_DEFINITIONS.map((definition) =>
  map('operating_strategy', definition.key, 'operating_strategy', definition.key, 'current', true)
)

const sellerExecutionMappings: StrategyIdentifierMapping[] = [
  ...['preforeclosure-equity', 'tax-code-stack', 'tax-remote-equity-rotation', 'lien-equity', 'probate-vacant-equity', 'portfolio-landlord', 'small-multifamily-portfolio', 'builder-infill-teardown', 'land-wholesale', 'vacant-equity'].map((key) =>
    map('seller_execution', key, 'source_tactic', 'property_opportunity_discovery', 'current', true)
  ),
  ...['seller-finance-free-clear', 'subject-to-low-equity', 'hybrid-equity-bridge', 'novation-retail-equity', 'absentee-equity-creative', 'active-stale-creative'].map((key) =>
    map('seller_execution', key, 'source_tactic', 'seller_options_intake', 'current', true)
  ),
  map('seller_execution', 'active-stale-lowball', 'source_tactic', 'seller_options_intake', 'retired', false),
]

const commandCenterMappings: StrategyIdentifierMapping[] = [
  map('command_center_autopilot', 'buyer-demand-capture', 'source_tactic', 'buyer_buy_box_activation', 'current', true),
  map('command_center_autopilot', 'capital-desk-lender-capture', 'source_tactic', 'lender_provider_criteria', 'current', true),
  map('command_center_autopilot', 'developer-builder-demand-capture', 'source_tactic', 'service_provider_network', 'current', true),
  map('command_center_autopilot', 'creative-finance-buyer-capture', 'source_tactic', 'buyer_buy_box_activation', 'current', true),
  map('command_center_autopilot', 'tax-code-stack', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'senior-out-of-state-landlord', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'builder-infill-teardown', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'land-wholesale', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'small-multifamily-portfolio', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'institutional-btr-buybox', 'source_tactic', 'buyer_buy_box_activation', 'current', true),
  map('command_center_autopilot', 'on-market-lowball-agent-sweep', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'novation-retail-spread', 'source_tactic', 'seller_options_intake', 'current', true),
  map('command_center_autopilot', 'commercial-small-bay-distress', 'source_tactic', 'property_opportunity_discovery', 'current', true),
  map('command_center_autopilot', 'stale-listing-creative-finance', 'source_tactic', 'seller_options_intake', 'current', true),
]

const historicalCommandCenterKeys = [
  'contractor-distress-flip',
  'failed-landlord-exit',
  'insurance-damage-event',
  'judgment-lien-pressure',
  'permit-spike-developer-land',
  'portfolio-fragmentation',
  'rent-gap-multifamily',
  'senior-downsizer',
  'small-commercial-owner-exit',
  'tax-assessment-shock',
  'tired-airbnb-midterm',
  'utility-lien-water-shutoff',
  'zombie-rehab',
]

const cityScenarioKeys = [
  'divorce-separation-quiet-exit',
  'relocation-job-transfer',
  'out-of-state-heir-remote-relief',
  'senior-downsizing-medical-soft-touch',
  'fire-storm-insurance-damage',
  'problem-tenant-eviction-relief',
  'fsbo-conversion-real-buyer',
  'failed-flipper-stuck-rehab',
  'hoa-delinquent-association-pressure',
  'reverse-mortgage-exit',
  'title-issue-cloud-on-title',
  'post-auction-backup-buyer',
  'attorney-partnership-referral',
  'neighbor-referral-bird-dog',
  'preforeclosure-subto-absentee-rental',
  'auction-postponed-distress',
  'bankruptcy-dismissed-foreclosure-restart',
  'eviction-landlord-fatigue',
  'utility-shutoff-absentee-landlord',
  'small-multifamily-breakup',
  'probate-vacant-equity',
  'estate-deferred-maintenance',
  'tax-delinquent-vacant-improvement',
  'tax-delinquent-senior-owner-soft-touch',
  'multiple-liens-equity',
  'water-lien-absentee-stack',
  'code-boarded-fire-damage',
  'active-dom90-condition-problem',
  'back-on-market-fatigue',
  'price-cut-3x-distress',
  'teardown-near-infill-demand',
  'vacant-lot-tax-lien-builder',
  'corner-lot-small-builder',
]

const nextMoveMappings: Array<[string, OperatingStrategyKey]> = [
  ['business-funding', 'capital_readiness_intake'],
  ['real-estate-funding', 'capital_readiness_intake'],
  ['grants', 'capital_readiness_intake'],
  ['business-credit', 'business_formation_readiness'],
  ['sell-property', 'seller_options_intake'],
  ['buy-property', 'buyer_buy_box_activation'],
  ['fund-deal', 'capital_readiness_intake'],
  ['business-acquisition', 'business_acquisition_network'],
  ['builder-developer', 'service_provider_network'],
  ['improve-credit', 'credit_education_support'],
  ['increase-income', 'next_move_free_roadmap'],
  ['start-business', 'business_formation_readiness'],
  ['grow-business', 'business_formation_readiness'],
  ['visibility', 'content_authority_intelligence'],
]

const capitalMappings: Array<[string, OperatingStrategyKey]> = [
  ['business_funding', 'capital_readiness_intake'],
  ['real_estate_funding', 'capital_readiness_intake'],
  ['business_acquisition', 'business_acquisition_network'],
  ['business_credit', 'business_formation_readiness'],
  ['grants_programs', 'capital_readiness_intake'],
  ['capital_provider', 'lender_provider_criteria'],
]

export const STRATEGY_IDENTIFIER_CROSSWALK: readonly StrategyIdentifierMapping[] = [
  ...operatingMappings,
  ...sellerExecutionMappings,
  ...commandCenterMappings,
  map('command_center_autopilot', 'buyer-reverse-engineering', 'source_tactic', 'buyer_buy_box_activation'),
  ...historicalCommandCenterKeys.map((key) =>
    map('command_center_autopilot', key, 'source_tactic', 'property_opportunity_discovery')
  ),
  ...cityScenarioKeys.map((key) =>
    map(
      'city_scenario',
      key,
      'recommendation_tag',
      key === 'attorney-partnership-referral' || key === 'neighbor-referral-bird-dog'
        ? 'partner_referral_network'
        : 'property_opportunity_discovery'
    )
  ),
  ...nextMoveMappings.map(([key, strategy]) => map('next_move_focus', key, 'journey', strategy)),
  ...capitalMappings.map(([key, strategy]) => map('capital_path', key, 'journey', strategy)),
  map('revenue_campaign', 'dealvault_smart_contracts', 'segment', 'dealvault_activation', 'current', true),
  map('revenue_campaign', 'ai_receptionist_visibility', 'segment', 'content_authority_intelligence', 'current', true),
  map('revenue_campaign', 'funding_prep', 'segment', 'capital_readiness_intake', 'current', true),
  map('revenue_campaign', 'seller_real_estate', 'segment', 'seller_options_intake', 'current', true),
  map('revenue_campaign', 'other', 'segment', null, 'unresolved', false),
  map('platform_scenario', 'business', 'journey', 'capital_readiness_intake'),
  map('platform_scenario', 'property', 'journey', 'buyer_buy_box_activation'),
  map('platform_scenario', 'sell', 'journey', 'seller_options_intake'),
  map('platform_scenario', 'readiness', 'journey', 'next_move_free_roadmap'),
  map('platform_scenario', 'participate', 'journey', 'professional_participant_activation'),
  map('legacy_runtime', 'buyer-network', 'legacy_alias', 'buyer_buy_box_activation', 'current', true),
  map('legacy_runtime', 'buyer-packet-routing', 'legacy_alias', 'buyer_buy_box_activation', 'current', true),
  map('legacy_runtime', 'investor-network', 'legacy_alias', 'investor_capital_relationships', 'current', true),
  map('legacy_runtime', 'lender-network', 'legacy_alias', 'lender_provider_criteria', 'current', true),
  map('legacy_runtime', 'seller-outreach', 'legacy_alias', 'seller_options_intake', 'current', true),
  map('legacy_runtime', 'seller_lead', 'legacy_alias', 'seller_options_intake', 'current', true),
  map('legacy_runtime', 'global-suppression', 'legacy_alias', null, 'unresolved', false),
] as const

const crosswalkByNamespacedIdentifier = new Map(
  STRATEGY_IDENTIFIER_CROSSWALK.map((mapping) => [
    `${mapping.namespace}:${mapping.sourceIdentifier}`,
    mapping,
  ])
)

export function getStrategyIdentifierMapping(namespace: StrategyIdentifierNamespace, sourceIdentifier: string) {
  return crosswalkByNamespacedIdentifier.get(`${namespace}:${sourceIdentifier}`) || null
}

// This is a static registration check only. Runtime execution must use the
// service-role-only database resolver, which also requires an active version.
export function resolveRegisteredStrategyIdentifier(
  namespace: StrategyIdentifierNamespace,
  sourceIdentifier: string
) {
  const mapping = getStrategyIdentifierMapping(namespace, sourceIdentifier)
  if (!mapping) throw new Error(`Unmapped strategy identifier: ${namespace}:${sourceIdentifier}`)
  if (!mapping.operatingStrategy || mapping.resolution !== 'current' || !mapping.allowsNewActivity) {
    throw new Error(`Strategy identifier is not approved for new activity: ${namespace}:${sourceIdentifier}`)
  }
  return {
    portfolio: OPERATING_STRATEGY_PARENT[mapping.operatingStrategy],
    operatingStrategy: mapping.operatingStrategy,
    executionReady: false as const,
  }
}
