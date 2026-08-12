import type {
  DealScoreRecord,
  NormalizedPropertyInput,
  PropertySignalRecord,
  PropertySignalType,
} from '@/lib/property-intelligence/types'

const LLC_PATTERN = /\b(llc|l\.l\.c\.|inc|corp|corporation|company|co\.|holdings|trust|properties|partners|ventures|investments|capital)\b/i
const VACANT_PATTERN = /\b(vacant|land|lot|unimproved|undeveloped|residential vacant|commercial vacant|raw land)\b/i
const FORECLOSURE_PATTERN = /\b(foreclosure|preforeclosure|lis pendens|notice of default|sheriff|trustee sale)\b/i
const PROBATE_PATTERN = /\b(probate|estate|heirs?|inherited|executor|administrator)\b/i
const TAX_PATTERN = /\b(tax delinquent|delinquent|back taxes|tax sale|certificate|lien)\b/i
const CODE_PATTERN = /\b(code violation|nuisance|condemned|unsafe|demolition|vacant building)\b/i
const CITY_OWNED_PATTERN = /\b(city of|county of|land bank|redevelopment authority|municipal|public works)\b/i
const OZ_PATTERN = /\b(opportunity zone|qoz|qualified opportunity)\b/i

function clean(value: unknown) {
  return String(value ?? '').trim()
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function zeroOrMissing(value?: number | null) {
  return value === null || value === undefined || value === 0
}

function includesAnyRaw(input: NormalizedPropertyInput, pattern: RegExp) {
  const haystack = [
    input.sourceName,
    input.sourceUrl,
    input.fileName,
    ...Object.entries(input.rawFields || {}).map(([key, value]) => `${key}: ${clean(value)}`),
  ].map(clean).join(' | ')
  return pattern.test(haystack)
}

function rawNumber(input: NormalizedPropertyInput, aliases: string[]) {
  const normalize = (value: string) => value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
  const wanted = new Set(aliases.map(normalize))
  for (const [key, value] of Object.entries(input.rawFields || {})) {
    if (!wanted.has(normalize(key))) continue
    const parsed = asNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

export function detectVacantLot(input: NormalizedPropertyInput) {
  const reasons: string[] = []

  if (VACANT_PATTERN.test(clean(input.landUse))) reasons.push('land_use_vacant')
  if (VACANT_PATTERN.test(clean(input.propertyClass))) reasons.push('property_class_vacant')
  if (zeroOrMissing(input.buildingValue)) reasons.push('building_value_zero_or_missing')
  if (zeroOrMissing(input.improvementValue)) reasons.push('improvement_value_zero_or_missing')
  if (zeroOrMissing(input.structureSqft)) reasons.push('structure_sqft_zero_or_missing')
  if (includesAnyRaw(input, /\b(vacant\s*=\s*yes|is vacant|vacant lot|use code.*vacant)\b/i)) reasons.push('source_explicit_vacant')

  let score = 0
  if (reasons.includes('source_explicit_vacant')) score += 35
  if (reasons.includes('land_use_vacant')) score += 25
  if (reasons.includes('property_class_vacant')) score += 20
  if (reasons.includes('building_value_zero_or_missing')) score += 10
  if (reasons.includes('improvement_value_zero_or_missing')) score += 10
  if (reasons.includes('structure_sqft_zero_or_missing')) score += 10
  if ((input.landValue || 0) > 0 && zeroOrMissing(input.buildingValue)) score += 5

  return {
    isVacantLot: score >= 50,
    confidence: Math.max(0, Math.min(100, score)),
    reasons,
  }
}

export function detectSignals(input: NormalizedPropertyInput): PropertySignalRecord[] {
  const signals: PropertySignalRecord[] = []
  const add = (signal_type: PropertySignalType, signal_label: string, confidence_score = 70, signal_value?: string | null) => {
    signals.push({
      signal_type,
      signal_label,
      signal_value: signal_value || null,
      confidence_score,
      source_name: input.sourceName,
      source_url: input.sourceUrl || null,
      raw_fields: input.rawFields,
    })
  }

  const vacant = detectVacantLot(input)
  if (vacant.isVacantLot) add('vacant_lot', 'Potential vacant lot', vacant.confidence, vacant.reasons.join(', '))
  if (includesAnyRaw(input, TAX_PATTERN)) add('tax_delinquent', 'Tax delinquency signal', 75)
  if (includesAnyRaw(input, CODE_PATTERN)) add('code_violation', 'Code violation signal', 75)
  if (includesAnyRaw(input, FORECLOSURE_PATTERN)) add('preforeclosure', 'Foreclosure or pre-foreclosure signal', 70)
  if (includesAnyRaw(input, PROBATE_PATTERN) || PROBATE_PATTERN.test(clean(input.ownerName))) add('probate', 'Probate or inherited-property signal', 65)
  if (includesAnyRaw(input, OZ_PATTERN)) add('opportunity_zone', 'Opportunity zone signal', 65)
  if (CITY_OWNED_PATTERN.test(clean(input.ownerName))) add('city_owned', 'City/public-owned signal', 85, input.ownerName || null)

  const ownerState = clean(input.mailingState).toUpperCase()
  const propertyState = clean(input.state).toUpperCase()
  if (input.mailingAddress && input.propertyAddress && clean(input.mailingAddress).toLowerCase() !== clean(input.propertyAddress).toLowerCase()) {
    add('absentee_owner', 'Absentee owner signal', 70)
  }
  if (ownerState && propertyState && ownerState !== propertyState) add('out_of_state_owner', 'Out-of-state owner signal', 80, `${ownerState} owner / ${propertyState} property`)
  if (LLC_PATTERN.test(clean(input.ownerName))) add('llc_owner', 'Entity or LLC owner signal', 75, input.ownerName || null)
  const equityPercent = rawNumber(input, ['equity_percent', 'equity_percentage', 'equity_pct'])
  const mortgageBalance = rawNumber(input, ['mortgage_balance', 'loan_balance', 'estimated_loan_balance'])
  if (equityPercent !== null && equityPercent >= 30) add('high_equity', 'High equity signal', 75, String(equityPercent))
  if (equityPercent !== null && equityPercent <= 25) add('low_equity', 'Low equity signal', 75, String(equityPercent))
  if (mortgageBalance !== null && mortgageBalance > 1000) add('active_mortgage', 'Active mortgage signal', 75, String(mortgageBalance))
  if (mortgageBalance !== null && mortgageBalance <= 1000 && (input.assessedValue || 0) > 0) {
    add('free_and_clear', 'Free-and-clear signal', 70, String(mortgageBalance))
  }
  if ((input.assessedValue || 0) > 0 && (input.assessedValue || 0) <= 50000) add('low_assessed_value', 'Low assessed value', 65, String(input.assessedValue))
  if ((input.landValue || 0) > 0 && zeroOrMissing(input.buildingValue)) add('high_land_to_building_ratio', 'High land-to-building value ratio', 75)

  return signals
}

export function scoreDeal(input: NormalizedPropertyInput, signals = detectSignals(input)): DealScoreRecord {
  const reasonCodes: string[] = []
  let score = 20
  const has = (type: string) => signals.some((signal) => signal.signal_type === type)
  const add = (points: number, code: string) => {
    score += points
    reasonCodes.push(code)
  }

  if (has('vacant_lot')) add(18, 'VACANT_LOT')
  if (has('tax_delinquent')) add(12, 'TAX_DELINQUENT')
  if (has('code_violation')) add(10, 'CODE_VIOLATION')
  if (has('absentee_owner')) add(10, 'ABSENTEE_OWNER')
  if (has('llc_owner')) add(7, 'LLC_OWNER')
  if (has('out_of_state_owner')) add(8, 'OUT_OF_STATE_OWNER')
  if (has('low_assessed_value')) add(8, 'LOW_ASSESSED_VALUE')
  if (has('high_land_to_building_ratio')) add(8, 'LAND_VALUE_HEAVY')
  if (has('preforeclosure') || has('foreclosure')) add(14, 'FORECLOSURE_SIGNAL')
  if (has('probate')) add(10, 'PROBATE_SIGNAL')
  if (has('opportunity_zone')) add(5, 'OPPORTUNITY_ZONE')

  const zipPriority = /\b(641|661|741|722|631|532|452|441|482|462|402)/.test(clean(input.zipCode))
  if (zipPriority) add(4, 'ZIP_PRIORITY')

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))
  const explanation =
    reasonCodes.length > 0
      ? `Scored ${finalScore}/100 because the public record stack includes ${reasonCodes.map((code) => code.toLowerCase().replaceAll('_', ' ')).join(', ')}.`
      : `Scored ${finalScore}/100 with limited public distress signals. Keep for map review or enrichment.`
  const recommended_next_action =
    finalScore >= 75
      ? 'Review source records, verify ownership, then prepare seller outreach or buyer-fit routing.'
      : finalScore >= 55
        ? 'Queue for owner/contact research and manual source review.'
        : 'Keep as watchlist/map context until another public signal appears.'

  return {
    score: finalScore,
    reason_codes: reasonCodes,
    explanation,
    recommended_next_action,
    scoring_version: 'phase1-v1',
  }
}
