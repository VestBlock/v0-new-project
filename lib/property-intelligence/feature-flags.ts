export type PropertyIntelligenceFeatureFlag =
  | 'PROPERTY_INTELLIGENCE_ENABLED'
  | 'DEALMACHINE_SYNC_ENABLED'
  | 'OSINT_ADAPTERS_ENABLED'
  | 'MAP_LAYERS_ENABLED'
  | 'OVERPASS_ENRICHMENT_ENABLED'
  | 'ATTOM_ENRICHMENT_ENABLED'
  | 'DOCUMENT_INTELLIGENCE_ENABLED'
  | 'BUYER_MATCHING_ENABLED'
  | 'OUTREACH_PREP_ENABLED'

const DEFAULTS: Record<PropertyIntelligenceFeatureFlag, boolean> = {
  PROPERTY_INTELLIGENCE_ENABLED: true,
  DEALMACHINE_SYNC_ENABLED: false,
  OSINT_ADAPTERS_ENABLED: false,
  MAP_LAYERS_ENABLED: true,
  OVERPASS_ENRICHMENT_ENABLED: false,
  ATTOM_ENRICHMENT_ENABLED: false,
  DOCUMENT_INTELLIGENCE_ENABLED: false,
  BUYER_MATCHING_ENABLED: false,
  OUTREACH_PREP_ENABLED: true,
}

export function isPropertyIntelligenceFeatureEnabled(flag: PropertyIntelligenceFeatureFlag) {
  const value = process.env[flag]
  if (value === undefined || value === '') return DEFAULTS[flag]
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.toLowerCase())
}

export function propertyIntelligenceFeatureSnapshot() {
  return (Object.keys(DEFAULTS) as PropertyIntelligenceFeatureFlag[]).reduce(
    (snapshot, flag) => {
      snapshot[flag] = isPropertyIntelligenceFeatureEnabled(flag)
      return snapshot
    },
    {} as Record<PropertyIntelligenceFeatureFlag, boolean>
  )
}
