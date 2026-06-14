export type RoughPropertyEstimateSource =
  | 'internal_baseline'
  | 'seller_supplied'
  | 'rule_based'
  | 'none'

export type SellerExitPath =
  | 'fast_cash'
  | 'creative_structure'
  | 'novation'
  | 'rental_hold'
  | 'lender_review'
  | 'manual_review'

export type RoughPropertyEstimateInput = {
  address: string | null
  city?: string | null
  state?: string | null
  propertyType?: string | null
  bedrooms?: string | number | null
  bathrooms?: string | number | null
  squareFeet?: string | number | null
  sellerEstimatedValue?: string | number | null
  askingPrice?: string | number | null
  monthlyRentEstimate?: string | number | null
  mortgageBalance?: string | number | null
  liensOrTaxes?: string | number | null
  propertyCondition?: string | null
  timelineToSell?: string | null
  occupancyStatus?: string | null
  preferredSalePath?: string | null
}

export type RoughPropertyEstimate = {
  source: RoughPropertyEstimateSource
  sourceLabel: string
  provider?: string
  estimateValue: number | null
  lowEstimate: number | null
  highEstimate: number | null
  rentEstimate: number | null
  confidence: number
  confidenceLabel: 'high' | 'medium' | 'low' | 'needs_review'
  sellerEstimatedValue: number | null
  askingPrice: number | null
  mortgageBalance: number | null
  liensOrTaxesAmount: number | null
  equityEstimate: number | null
  ltvEstimate: number | null
  spreadToAsking: number | null
  acquisitionRangeLow: number | null
  acquisitionRangeHigh: number | null
  suggestedExitPaths: SellerExitPath[]
  buyerPacketSummary: string
  lenderPacketSummary: string
  warnings: string[]
  comparableCount: number
  subjectProperty: Record<string, unknown> | null
  generatedAt: string
  disclaimer: string
}

export function parseCurrencyAmount(value?: string | number | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!value) return null
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function roundToNearest(value: number | null, nearest = 1000) {
  if (!Number.isFinite(value)) return null
  return Math.round(Number(value) / nearest) * nearest
}

function normalizePropertyType(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('multi') || normalized.includes('duplex') || normalized.includes('triplex') || normalized.includes('fourplex')) {
    return 'Multi-Family'
  }
  if (normalized.includes('condo')) return 'Condo'
  if (normalized.includes('town')) return 'Townhouse'
  if (normalized.includes('mobile') || normalized.includes('manufactured')) return 'Manufactured'
  if (normalized.includes('apartment')) return 'Apartment'
  if (normalized.includes('land') || normalized.includes('lot')) return 'Land'
  if (normalized.includes('commercial') || normalized.includes('retail') || normalized.includes('office') || normalized.includes('industrial')) {
    return 'Commercial'
  }
  return 'Single Family'
}

function confidenceLabel(confidence: number): RoughPropertyEstimate['confidenceLabel'] {
  if (confidence >= 78) return 'high'
  if (confidence >= 55) return 'medium'
  if (confidence > 0) return 'low'
  return 'needs_review'
}

function conditionCashFactor(condition?: string | null) {
  const normalized = String(condition || '').toLowerCase()
  if (/fire|mold|gut|major|poor|distress|unsafe|vacant/.test(normalized)) return 0.58
  if (/fair|needs work|repairs|dated/.test(normalized)) return 0.68
  if (/good|average|livable/.test(normalized)) return 0.76
  if (/excellent|renovated|turnkey/.test(normalized)) return 0.82
  return 0.7
}

function conditionValueFactor(condition?: string | null) {
  const normalized = String(condition || '').toLowerCase()
  if (/fire|mold|gut|major|poor|unsafe/.test(normalized)) return 0.72
  if (/vacant|distress|code|violation/.test(normalized)) return 0.8
  if (/fair|repairs|dated|needs work/.test(normalized)) return 0.88
  if (/good|average|livable/.test(normalized)) return 0.96
  if (/excellent|renovated|turnkey/.test(normalized)) return 1.04
  return 0.9
}

function askingAdjustmentFactor(condition?: string | null) {
  const normalized = String(condition || '').toLowerCase()
  if (/fire|mold|gut|major|poor|unsafe/.test(normalized)) return 0.84
  if (/fair|repairs|dated|needs work|distress|vacant/.test(normalized)) return 0.9
  return 0.96
}

function rentMultiple(propertyType?: string | null) {
  const normalized = normalizePropertyType(propertyType)
  switch (normalized) {
    case 'Land':
      return 0
    case 'Commercial':
      return 85
    case 'Multi-Family':
      return 60
    case 'Condo':
    case 'Townhouse':
    case 'Apartment':
      return 88
    case 'Manufactured':
      return 72
    default:
      return 95
  }
}

function pricePerFoot(propertyType?: string | null) {
  const normalized = normalizePropertyType(propertyType)
  switch (normalized) {
    case 'Land':
      return 4
    case 'Commercial':
      return 92
    case 'Multi-Family':
      return 68
    case 'Condo':
    case 'Townhouse':
    case 'Apartment':
      return 108
    case 'Manufactured':
      return 58
    default:
      return 100
  }
}

function isFastTimeline(timeline?: string | null) {
  return /asap|immediate|now|7|14|30|fast|urgent/i.test(String(timeline || ''))
}

function isTenantOrRental(occupancy?: string | null) {
  return /tenant|rental|occupied by tenant|leased/i.test(String(occupancy || ''))
}

function uniqueExitPaths(paths: SellerExitPath[]) {
  return paths.filter((path, index) => paths.indexOf(path) === index)
}

function formatMoney(value: number | null) {
  if (!Number.isFinite(value)) return 'unknown'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function weightedAverage(entries: Array<{ value: number | null; weight: number }>) {
  const usable = entries.filter((entry) => Number.isFinite(entry.value) && entry.weight > 0) as Array<{
    value: number
    weight: number
  }>
  if (!usable.length) return null
  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0)
  if (!totalWeight) return null
  return usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
}

function buildInternalBaselineValue(input: RoughPropertyEstimateInput) {
  const sellerEstimatedValue = parseCurrencyAmount(input.sellerEstimatedValue)
  const askingPrice = parseCurrencyAmount(input.askingPrice)
  const monthlyRentEstimate = parseCurrencyAmount(input.monthlyRentEstimate)
  const squareFeet = parseCurrencyAmount(input.squareFeet)
  const valueFactor = conditionValueFactor(input.propertyCondition)

  const rentBasedValue =
    monthlyRentEstimate && rentMultiple(input.propertyType) > 0
      ? monthlyRentEstimate * rentMultiple(input.propertyType)
      : null

  const sizeBasedValue =
    squareFeet && pricePerFoot(input.propertyType) > 0
      ? squareFeet * pricePerFoot(input.propertyType) * valueFactor
      : null

  const adjustedAsking =
    askingPrice !== null ? askingPrice * askingAdjustmentFactor(input.propertyCondition) : null

  const baselineValue = weightedAverage([
    { value: sellerEstimatedValue, weight: 1.15 },
    { value: adjustedAsking, weight: 0.9 },
    { value: rentBasedValue, weight: 0.95 },
    { value: sizeBasedValue, weight: 0.7 },
  ])

  return {
    baselineValue: roundToNearest(baselineValue, 1000),
    rentBasedValue: roundToNearest(rentBasedValue, 1000),
    sizeBasedValue: roundToNearest(sizeBasedValue, 1000),
    signalCount: [sellerEstimatedValue, askingPrice, monthlyRentEstimate, squareFeet].filter((value) => Number.isFinite(value)).length,
    subjectProperty: {
      propertyType: normalizePropertyType(input.propertyType),
      bedrooms: parseCurrencyAmount(input.bedrooms),
      bathrooms: parseCurrencyAmount(input.bathrooms),
      squareFeet,
      condition: input.propertyCondition || null,
      rentBasedValue: roundToNearest(rentBasedValue, 1000),
      sizeBasedValue: roundToNearest(sizeBasedValue, 1000),
    } as Record<string, unknown>,
  }
}

export async function buildRoughPropertyEstimate(input: RoughPropertyEstimateInput): Promise<RoughPropertyEstimate> {
  const now = new Date().toISOString()
  const sellerEstimatedValue = parseCurrencyAmount(input.sellerEstimatedValue)
  const askingPrice = parseCurrencyAmount(input.askingPrice)
  const manualRentEstimate = parseCurrencyAmount(input.monthlyRentEstimate)
  const mortgageBalance = parseCurrencyAmount(input.mortgageBalance)
  const liensOrTaxesAmount = parseCurrencyAmount(input.liensOrTaxes)
  const internal = buildInternalBaselineValue(input)
  const debtLoad = (mortgageBalance || 0) + (liensOrTaxesAmount || 0)

  const source: RoughPropertyEstimateSource =
    internal.baselineValue !== null && internal.signalCount >= 2
      ? 'internal_baseline'
      : sellerEstimatedValue !== null
        ? 'seller_supplied'
        : askingPrice !== null
          ? 'rule_based'
          : 'none'

  const estimateValue =
    source === 'internal_baseline'
      ? internal.baselineValue
      : source === 'seller_supplied'
        ? roundToNearest(sellerEstimatedValue, 1000)
        : source === 'rule_based'
          ? roundToNearest(askingPrice, 1000)
          : null

  const confidence =
    source === 'internal_baseline'
      ? Math.min(68, 28 + internal.signalCount * 10 + (manualRentEstimate && parseCurrencyAmount(input.squareFeet) ? 8 : 0))
      : source === 'seller_supplied'
        ? 40
        : source === 'rule_based'
          ? 24
          : 0

  const spreadFactor =
    source === 'internal_baseline'
      ? 0.12
      : source === 'seller_supplied'
        ? 0.14
        : source === 'rule_based'
          ? 0.16
          : 0

  const lowEstimate = estimateValue ? roundToNearest(estimateValue * (1 - spreadFactor), 1000) : null
  const highEstimate = estimateValue ? roundToNearest(estimateValue * (1 + spreadFactor), 1000) : null
  const equityEstimate = estimateValue ? estimateValue - debtLoad : null
  const ltvEstimate = estimateValue && debtLoad > 0 ? Math.round((debtLoad / estimateValue) * 1000) / 10 : null
  const spreadToAsking = estimateValue && askingPrice ? estimateValue - askingPrice : null
  const cashFactor = conditionCashFactor(input.propertyCondition)
  const acquisitionRangeHigh = estimateValue ? roundToNearest(estimateValue * cashFactor, 5000) : null
  const acquisitionRangeLow = estimateValue ? roundToNearest(estimateValue * cashFactor * 0.9, 5000) : null
  const rentEstimate = manualRentEstimate ?? null

  const warnings: string[] = []
  if (source !== 'none') {
    warnings.push('VestBlock is using internal baseline math and manual inputs. Verify comps before making an offer.')
  }
  if (manualRentEstimate !== null) {
    warnings.push('Rent estimate is using a manual input. Verify current leases or market rent before routing.')
  }
  if (sellerEstimatedValue !== null && askingPrice !== null) {
    const variance = Math.abs(sellerEstimatedValue - askingPrice) / Math.max(1, sellerEstimatedValue)
    if (variance >= 0.15) {
      warnings.push('Seller estimate and asking price are materially different. Tighten value with comps before sending offers.')
    }
  }
  if (source === 'none') {
    warnings.push('Not enough pricing signals are present yet. Add asking price, rent, square footage, or a manual value range.')
  }
  if (!input.address) {
    warnings.push('Missing complete property address.')
  }

  const paths: SellerExitPath[] = []
  const preferredPath = String(input.preferredSalePath || '') as SellerExitPath
  if (['fast_cash', 'creative_structure', 'novation'].includes(preferredPath)) paths.push(preferredPath)
  if (isFastTimeline(input.timelineToSell) || /poor|distress|major|vacant/i.test(String(input.propertyCondition || ''))) {
    paths.push('fast_cash')
  }
  if ((ltvEstimate !== null && ltvEstimate >= 75) || (equityEstimate !== null && equityEstimate < 25000)) {
    paths.push('creative_structure')
  }
  if (estimateValue && askingPrice && askingPrice <= estimateValue * 0.9 && !/poor|gut|major/i.test(String(input.propertyCondition || ''))) {
    paths.push('novation')
  }
  if (isTenantOrRental(input.occupancyStatus)) {
    paths.push('rental_hold', 'lender_review')
  }
  if (estimateValue) paths.push('lender_review')
  paths.push('manual_review')

  const suggestedExitPaths = uniqueExitPaths(paths)
  const buyerPacketSummary = [
    `Address: ${input.address || 'unknown'}`,
    `rough value: ${formatMoney(estimateValue)}`,
    acquisitionRangeLow && acquisitionRangeHigh
      ? `cash review band: ${formatMoney(acquisitionRangeLow)} to ${formatMoney(acquisitionRangeHigh)}`
      : 'cash review band: needs comps',
    `condition: ${input.propertyCondition || 'unknown'}`,
    `timeline: ${input.timelineToSell || 'unknown'}`,
  ].join('; ')

  const lenderPacketSummary = [
    `Address: ${input.address || 'unknown'}`,
    `rough value: ${formatMoney(estimateValue)}`,
    `rough rent: ${formatMoney(rentEstimate)}`,
    ltvEstimate !== null ? `estimated LTV: ${ltvEstimate}%` : 'estimated LTV: needs debt details',
    `occupancy: ${input.occupancyStatus || 'unknown'}`,
  ].join('; ')

  return {
    source,
    sourceLabel:
      source === 'internal_baseline'
        ? 'VestBlock baseline estimate'
        : source === 'seller_supplied'
          ? 'Seller supplied estimate'
          : source === 'rule_based'
            ? 'Input-backed placeholder'
            : 'Needs review',
    estimateValue,
    lowEstimate,
    highEstimate,
    rentEstimate: roundToNearest(rentEstimate, 50),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    sellerEstimatedValue,
    askingPrice,
    mortgageBalance,
    liensOrTaxesAmount,
    equityEstimate: roundToNearest(equityEstimate, 1000),
    ltvEstimate,
    spreadToAsking: roundToNearest(spreadToAsking, 1000),
    acquisitionRangeLow,
    acquisitionRangeHigh,
    suggestedExitPaths,
    buyerPacketSummary,
    lenderPacketSummary,
    warnings,
    comparableCount: 0,
    subjectProperty: internal.subjectProperty,
    generatedAt: now,
    disclaimer: 'Rough internal estimate only. Not an appraisal or a guaranteed offer.',
  }
}
