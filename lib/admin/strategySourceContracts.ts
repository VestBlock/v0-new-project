import type { LeadRecord } from '@/lib/leads/types'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

export type StrategySignalKey =
  | 'preforeclosure'
  | 'tax_delinquent'
  | 'code_violation'
  | 'lien'
  | 'absentee_owner'
  | 'equity'
  | 'low_equity'
  | 'retail_equity'
  | 'vacant'
  | 'probate'
  | 'portfolio_owner'
  | 'multifamily'
  | 'land'
  | 'teardown'
  | 'free_and_clear'
  | 'active_mortgage'
  | 'stale_listing'
  | 'price_fit'
  | 'distressed_condition'
  | 'long_term_owner'

export type StrategySourceRunner = 'vendor_api' | 'cloud_database' | 'local_mac' | 'signed_upload'

export type StrategySourceContract = {
  strategyKey: string
  requiredSignalGroups: StrategySignalKey[][]
  optionalSignals: StrategySignalKey[]
  discoveryProviders: string[]
  runners: StrategySourceRunner[]
  contactPolicy: 'verified_email' | 'business_public_contact_or_review' | 'manual_review'
  sensitive: boolean
}

export type StrategyStackEvidence = {
  eligible: boolean
  signals: StrategySignalKey[]
  sourceFamilies: string[]
  satisfiedGroups: StrategySignalKey[][]
  missingGroups: StrategySignalKey[][]
  stackDepth: number
  sourceDepth: number
  scoreBonus: number
}

export const STRATEGY_SOURCE_CONTRACTS: Record<string, StrategySourceContract> = {
  'preforeclosure-equity': contract('preforeclosure-equity', [['preforeclosure']], ['equity', 'low_equity', 'active_mortgage'], true),
  'tax-code-stack': contract('tax-code-stack', [['tax_delinquent'], ['code_violation']], ['equity', 'absentee_owner']),
  'tax-remote-equity-rotation': contract('tax-remote-equity-rotation', [['tax_delinquent'], ['absentee_owner'], ['equity']], ['long_term_owner']),
  'lien-equity': contract('lien-equity', [['lien'], ['equity']], ['absentee_owner']),
  'probate-vacant-equity': contract('probate-vacant-equity', [['probate'], ['vacant'], ['equity']], ['free_and_clear'], true),
  'portfolio-landlord': contract('portfolio-landlord', [['portfolio_owner']], ['absentee_owner', 'long_term_owner']),
  'small-multifamily-portfolio': contract('small-multifamily-portfolio', [['multifamily'], ['portfolio_owner']], ['absentee_owner']),
  'builder-infill-teardown': contract('builder-infill-teardown', [['land', 'teardown']], ['code_violation', 'vacant']),
  'land-wholesale': contract('land-wholesale', [['land']], ['absentee_owner', 'tax_delinquent']),
  'vacant-equity': contract('vacant-equity', [['vacant'], ['equity']], ['absentee_owner', 'code_violation']),
  'seller-finance-free-clear': contract('seller-finance-free-clear', [['free_and_clear']], ['long_term_owner', 'absentee_owner']),
  'subject-to-low-equity': contract('subject-to-low-equity', [['active_mortgage'], ['low_equity']], ['preforeclosure'], true),
  'hybrid-equity-bridge': contract('hybrid-equity-bridge', [['active_mortgage'], ['equity']], ['absentee_owner']),
  'novation-retail-equity': contract('novation-retail-equity', [['retail_equity']], ['stale_listing', 'equity'], true),
  'absentee-equity-creative': contract('absentee-equity-creative', [['absentee_owner'], ['equity']], ['long_term_owner']),
  'active-stale-creative': contract('active-stale-creative', [['stale_listing'], ['price_fit']], ['equity', 'active_mortgage']),
  'active-stale-lowball': contract('active-stale-lowball', [['stale_listing'], ['distressed_condition']], [], true),
}

function contract(
  strategyKey: string,
  requiredSignalGroups: StrategySignalKey[][],
  optionalSignals: StrategySignalKey[],
  sensitive = false
): StrategySourceContract {
  const listingOnly = strategyKey.startsWith('active-stale')
  return {
    strategyKey,
    requiredSignalGroups,
    optionalSignals,
    discoveryProviders: listingOnly
      ? ['homeharvest']
      : ['property_intelligence', 'public_records', 'dealmachine'],
    runners: listingOnly
      ? ['local_mac', 'signed_upload']
      : ['cloud_database', 'local_mac', 'signed_upload', 'vendor_api'],
    contactPolicy: sensitive ? 'manual_review' : 'business_public_contact_or_review',
    sensitive,
  }
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function boolValue(value: unknown) {
  return value === true || /^(1|true|yes|y)$/i.test(String(value || '').trim())
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function structuredField(record: Record<string, unknown>, keys: string[], depth = 0): unknown {
  if (depth > 3) return undefined
  const wanted = new Set(keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, '')))
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) return value
  }
  for (const [key, value] of Object.entries(record)) {
    if (/strateg|rationale|reason|recommend|explanation|score/i.test(key)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const nested = structuredField(value as Record<string, unknown>, keys, depth + 1)
    if (nested !== undefined) return nested
  }
  return undefined
}

function addSignal(signals: Set<StrategySignalKey>, condition: unknown, signal: StrategySignalKey) {
  if (condition) signals.add(signal)
}

function sourceFamily(value: unknown) {
  const text = String(value || '').toLowerCase()
  if (!text) return null
  if (text.includes('dealmachine')) return 'dealmachine'
  if (text.includes('homeharvest') || text.includes('listing') || text.includes('mls')) return 'homeharvest'
  if (text.includes('attom') || text.includes('property_intelligence')) return 'property_intelligence'
  if (/county|court|public|code|tax|land.?bank|recorder|assessor/.test(text)) return 'public_records'
  return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || null
}

function evaluateContract(strategyKey: string, signals: Set<StrategySignalKey>, sourceFamilies: Set<string>): StrategyStackEvidence {
  const sourceContract = STRATEGY_SOURCE_CONTRACTS[strategyKey]
  if (!sourceContract) {
    return {
      eligible: false,
      signals: [...signals],
      sourceFamilies: [...sourceFamilies],
      satisfiedGroups: [],
      missingGroups: [],
      stackDepth: 0,
      sourceDepth: sourceFamilies.size,
      scoreBonus: 0,
    }
  }

  const satisfiedGroups = sourceContract.requiredSignalGroups.filter((group) => group.some((signal) => signals.has(signal)))
  const missingGroups = sourceContract.requiredSignalGroups.filter((group) => !group.some((signal) => signals.has(signal)))
  const relevantSignals = new Set(sourceContract.requiredSignalGroups.flat().concat(sourceContract.optionalSignals))
  const stackDepth = [...signals].filter((signal) => relevantSignals.has(signal)).length
  return {
    eligible: missingGroups.length === 0,
    signals: [...signals].sort(),
    sourceFamilies: [...sourceFamilies].sort(),
    satisfiedGroups,
    missingGroups,
    stackDepth,
    sourceDepth: sourceFamilies.size,
    scoreBonus: satisfiedGroups.length * 8 + Math.min(12, Math.max(0, stackDepth - satisfiedGroups.length) * 3) + Math.min(8, sourceFamilies.size * 2),
  }
}

export function evaluateLeadStrategyStack(lead: LeadRecord, strategyKey: string): StrategyStackEvidence {
  const metadata = lead.metadata_json || {}
  const form = lead.form_data || {}
  const text = [
    lead.source,
    lead.niche,
    lead.market_segment,
    lead.pain_signal,
    lead.outreach_angle,
    lead.notes,
    JSON.stringify(metadata),
    JSON.stringify(form),
    JSON.stringify(lead.contact_info || {}),
  ].filter(Boolean).join(' ').toLowerCase()
  const signals = new Set<StrategySignalKey>()
  const sources = new Set<string>()

  addSignal(signals, /pre.?foreclosure|notice.?of.?default|lis.?pendens|auction.?date/.test(text), 'preforeclosure')
  addSignal(signals, /tax.?delinquent|past.?due.?tax|tax.?lien/.test(text), 'tax_delinquent')
  addSignal(signals, /code.?violation|city.?pressure|nuisance|unsafe.?structure/.test(text), 'code_violation')
  addSignal(signals, boolValue(metadata.activeLien || form.activeLien) || /active.?lien|water.?lien|hoa.?lien|multiple.?liens/.test(text), 'lien')
  addSignal(signals, /out.?of.?state|absentee|remote.?owner/.test(text), 'absentee_owner')
  addSignal(signals, /\bvacant\b|boarded|unoccupied/.test(text), 'vacant')
  addSignal(signals, /\bprobate\b|\binherit(?:ed|ance)?\b|\bestate (?:of|sale)\b|\bdeceased\b|\bheirs?\b/.test(text), 'probate')
  addSignal(signals, /portfolio|multiple.?properties|landlord/.test(text) || numberValue(metadata.portfolioCount || form.portfolioCount) >= 4, 'portfolio_owner')
  addSignal(signals, /duplex|triplex|fourplex|multifamily|multi.?family/.test(text) || numberValue(metadata.units || form.units) >= 2, 'multifamily')
  addSignal(signals, /\bland\b|vacant.?lot|buildable.?lot|acreage|parcel/.test(text), 'land')
  addSignal(signals, /teardown|fire.?damage|boarded|unsafe.?structure|stuck.?rehab/.test(text), 'teardown')
  addSignal(signals, boolValue(metadata.freeAndClear || form.freeAndClear) || /free.?and.?clear/.test(text), 'free_and_clear')
  addSignal(signals, numberValue(metadata.estimatedLoanBalance || form.estimatedLoanBalance) > 1_000 || /active.?mortgage/.test(text), 'active_mortgage')
  addSignal(signals, numberValue(metadata.ltvPercent || form.ltvPercent) >= 80 || /low.?equity/.test(text), 'low_equity')

  const equityPercent = numberValue(metadata.equityPercent || form.equityPercent)
  const equityAmount = numberValue(metadata.equityAmount || form.equityAmount)
  addSignal(signals, equityPercent >= 20 || equityAmount >= 30_000 || /high.?equity|equity/.test(text), 'equity')
  addSignal(signals, (equityPercent >= 35 && equityAmount >= 40_000) || /retail.?equity|novation/.test(text), 'retail_equity')

  const daysOnMarket = numberValue(form.daysOnMarket || metadata.daysOnMarket)
  const listPrice = numberValue(form.listPrice || metadata.listPrice || metadata.currentListingPrice)
  addSignal(signals, daysOnMarket >= 30, 'stale_listing')
  addSignal(signals, listPrice >= 50_000 && listPrice <= 1_000_000, 'price_fit')
  addSignal(signals, /as.?is|cash.?only|major.?repair|fire.?damage|teardown/.test(text), 'distressed_condition')
  addSignal(signals, /long.?term.?owner|years.?owned/.test(text), 'long_term_owner')

  const primarySource = sourceFamily(lead.source)
  if (primarySource) sources.add(primarySource)
  const metadataSources = Array.isArray(metadata.strategySourceFamilies) ? metadata.strategySourceFamilies : []
  for (const source of metadataSources) {
    const normalized = sourceFamily(source)
    if (normalized) sources.add(normalized)
  }

  return evaluateContract(strategyKey, signals, sources)
}

export function evaluatePropertyStrategyStack(
  property: PropertyIntelligenceRecord,
  strategyKey: string,
  source?: { source_name?: string | null; source_type?: string | null }
): StrategyStackEvidence {
  const signals = new Set<StrategySignalKey>()
  const sources = new Set<string>(['property_intelligence'])
  const signalTypes = new Set((property.property_signals || []).map((signal) => String(signal.signal_type || '').toLowerCase()))
  const signalText = (property.property_signals || [])
    .map((signal) => `${signal.signal_type || ''} ${signal.signal_label || ''} ${signal.signal_value || ''}`)
    .join(' ')
    .toLowerCase()
  const propertyText = `${property.land_use || ''} ${property.property_class || ''}`.toLowerCase()
  const raw = recordValue(property.raw_fields)
  const attomFacts = recordValue(recordValue(raw.attom).facts)
  const equityPercent = numberValue(structuredField(attomFacts, ['equityPercent']) ?? structuredField(raw, ['equityPercent']))
  const equityAmount = numberValue(structuredField(attomFacts, ['equityAmount']) ?? structuredField(raw, ['equityAmount']))
  const estimatedLoanBalance = numberValue(
    structuredField(attomFacts, ['estimatedLoanBalance', 'firstMortgageAmount']) ??
    structuredField(raw, ['estimatedLoanBalance', 'firstMortgageAmount'])
  )
  const ltvPercent = numberValue(structuredField(attomFacts, ['ltvPercent']) ?? structuredField(raw, ['ltvPercent']))
  const daysOnMarket = numberValue(structuredField(raw, ['daysOnMarket', 'dom']))
  const listPrice = numberValue(structuredField(raw, ['listPrice', 'currentListingPrice']))
  const portfolioCount = numberValue(structuredField(raw, ['portfolioCount', 'propertyCount', 'ownedPropertyCount']))
  const freeAndClear = boolValue(
    structuredField(attomFacts, ['freeAndClear']) ?? structuredField(raw, ['freeAndClear'])
  )

  // Strategy recommendations and deal-score reason codes are intentionally excluded.
  // They are outputs, not independent evidence, and reusing them creates circular qualification.
  addSignal(signals, signalTypes.has('preforeclosure') || signalTypes.has('foreclosure'), 'preforeclosure')
  addSignal(signals, signalTypes.has('tax_delinquent'), 'tax_delinquent')
  addSignal(signals, signalTypes.has('code_violation'), 'code_violation')
  addSignal(signals, signalTypes.has('lien') || signalTypes.has('tax_lien') || signalTypes.has('hoa_lien'), 'lien')
  addSignal(signals, property.owner_entities?.is_absentee || property.owner_entities?.is_out_of_state || signalTypes.has('absentee_owner') || signalTypes.has('out_of_state_owner'), 'absentee_owner')
  addSignal(signals, signalTypes.has('high_equity') || equityPercent >= 20 || equityAmount >= 30_000, 'equity')
  addSignal(signals, signalTypes.has('low_equity') || ltvPercent >= 80, 'low_equity')
  addSignal(signals, signalTypes.has('high_equity') && equityPercent >= 35 || equityPercent >= 35 && equityAmount >= 40_000, 'retail_equity')
  addSignal(signals, signalTypes.has('vacant') || signalTypes.has('vacant_structure'), 'vacant')
  addSignal(signals, signalTypes.has('probate'), 'probate')
  addSignal(signals, signalTypes.has('portfolio_owner') || portfolioCount >= 4, 'portfolio_owner')
  addSignal(signals, signalTypes.has('multifamily') || /duplex|triplex|fourplex|multifamily|multi.?family/.test(propertyText), 'multifamily')
  addSignal(signals, property.is_vacant_lot || signalTypes.has('vacant_lot') || /\bland\b|vacant.?lot|acreage/.test(propertyText), 'land')
  addSignal(signals, signalTypes.has('teardown') || signalTypes.has('fire_damage') || /teardown|fire.?damage|unsafe.?structure|boarded/.test(signalText), 'teardown')
  addSignal(signals, signalTypes.has('free_and_clear') || freeAndClear, 'free_and_clear')
  addSignal(signals, signalTypes.has('active_mortgage') || estimatedLoanBalance > 1_000, 'active_mortgage')
  addSignal(signals, signalTypes.has('long_term_owner'), 'long_term_owner')
  addSignal(signals, signalTypes.has('stale_listing') || daysOnMarket >= 30, 'stale_listing')
  addSignal(signals, signalTypes.has('price_fit') || listPrice >= 50_000 && listPrice <= 1_000_000, 'price_fit')
  addSignal(signals, signalTypes.has('distressed_condition'), 'distressed_condition')

  const normalizedSource = sourceFamily(`${source?.source_name || ''} ${source?.source_type || ''}`)
  if (normalizedSource) sources.add(normalizedSource)
  for (const signal of property.property_signals || []) {
    const normalized = sourceFamily(`${signal.source_name || ''} ${signal.source_url || ''}`)
    if (normalized) sources.add(normalized)
  }

  return evaluateContract(strategyKey, signals, sources)
}

export function strategySourceContract(strategyKey: string) {
  return STRATEGY_SOURCE_CONTRACTS[strategyKey] || null
}
