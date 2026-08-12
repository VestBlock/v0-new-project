import type { StrategySourceProvider } from '@/lib/admin/strategyExecutionCatalog'
import type { LeadRecord } from '@/lib/leads/types'

export type StrategyLeadProvenance = {
  primaryStrategyKey: string
  matchedStrategyKeys: string[]
  provider: StrategySourceProvider
  sourceFamilies: string[]
  sourceRecordId: string
}

export function strategySourceProviderForLead(lead: LeadRecord): StrategySourceProvider | null {
  const source = String(lead.source || '').toLowerCase()
  if (source.includes('homeharvest') || source.includes('listing')) return 'homeharvest'
  if (source.includes('dealmachine')) return 'dealmachine'
  if (source.includes('property_intelligence') || source.includes('attom')) return 'property_intelligence'
  if (source.includes('public_record') || source.includes('county') || source.includes('court')) return 'public_records'
  return null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : []
}

export function getStrategyLeadProvenance(lead: LeadRecord): StrategyLeadProvenance | null {
  const metadata = lead.metadata_json || {}
  const primaryStrategyKey = String(metadata.strategyPrimary || '').trim()
  const matchedStrategyKeys = stringArray(metadata.strategyStackMatches)
  const sourceFamilies = stringArray(metadata.strategySourceFamilies)
  const sourceRecordId = String(
    metadata.strategySourceRecordId || metadata.propertyIntelligenceRecordId || ''
  ).trim()
  const sourceObservedAt = String(metadata.sourceObservedAt || '').trim()
  const contractVersion = Number(metadata.strategySourceContractVersion || 0)
  const provider = strategySourceProviderForLead(lead)

  if (
    !provider ||
    !primaryStrategyKey ||
    !matchedStrategyKeys.includes(primaryStrategyKey) ||
    !sourceFamilies.length ||
    !sourceRecordId ||
    !sourceObservedAt ||
    !Number.isFinite(Date.parse(sourceObservedAt)) ||
    contractVersion < 1
  ) return null

  return {
    primaryStrategyKey,
    matchedStrategyKeys,
    provider,
    sourceFamilies,
    sourceRecordId,
  }
}

export function isStrategyEngineAutoApprovalAllowed(lead: LeadRecord) {
  const strategyEngine = lead.automation_flags_json?.strategyEngine
  return Boolean(
    getStrategyLeadProvenance(lead) &&
      strategyEngine &&
      typeof strategyEngine === 'object' &&
      (strategyEngine as Record<string, unknown>).autoApprovalAllowed === true
  )
}
