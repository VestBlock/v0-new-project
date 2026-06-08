export type RoughPropertyEstimateSource =
  | 'rentcast'
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

type RentCastValueResponse = {
  price?: number
  value?: number
  estimatedValue?: number
  priceRangeLow?: number
  priceRangeHigh?: number
  comparables?: unknown[]
  subjectProperty?: Record<string, unknown>
}

type RentCastRentResponse = {
  rent?: number
  price?: number
  priceRangeLow?: number
  priceRangeHigh?: number
}

type RentCastSnapshot = {
  value: number | null
  low: number | null
  high: number | null
  rent: number | null
  comparableCount: number
  subjectProperty: Record<string, unknown> | null
  warnings: string[]
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

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizePropertyType(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('multi') || normalized.includes('duplex') || normalized.includes('triplex')) return 'Multi-Family'
  if (normalized.includes('condo')) return 'Condo'
  if (normalized.includes('town')) return 'Townhouse'
  if (normalized.includes('mobile') || normalized.includes('manufactured')) return 'Manufactured'
  if (normalized.includes('apartment')) return 'Apartment'
  if (normalized.includes('land') || normalized.includes('lot')) return 'Land'
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

async function fetchJsonWithTimeout(url: URL, apiKey: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5500)

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'X-Api-Key': apiKey,
      },
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!response.ok) {
      throw new Error(`RentCast ${response.status}: ${await response.text().catch(() => response.statusText)}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchRentCastSnapshot(input: RoughPropertyEstimateInput): Promise<RentCastSnapshot | null> {
  const apiKey = process.env.RENTCAST_API_KEY
  const address = input.address?.trim()
  if (!apiKey || !address) return null

  const baseUrl = process.env.RENTCAST_API_BASE_URL || 'https://api.rentcast.io/v1'
  const valuePath = process.env.RENTCAST_VALUE_PATH || '/avm/value'
  const rentPath = process.env.RENTCAST_RENT_PATH || '/avm/rent/long-term'
  const propertyType = normalizePropertyType(input.propertyType)
  const warnings: string[] = []

  const buildUrl = (path: string) => {
    const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
    url.searchParams.set('address', address)
    url.searchParams.set('compCount', '5')
    if (propertyType) url.searchParams.set('propertyType', propertyType)
    return url
  }

  const [valueResult, rentResult] = await Promise.allSettled([
    fetchJsonWithTimeout(buildUrl(valuePath), apiKey),
    fetchJsonWithTimeout(buildUrl(rentPath), apiKey),
  ])

  let valuePayload: RentCastValueResponse | null = null
  let rentPayload: RentCastRentResponse | null = null

  if (valueResult.status === 'fulfilled') {
    valuePayload = valueResult.value as RentCastValueResponse
  } else {
    warnings.push(valueResult.reason instanceof Error ? valueResult.reason.message : 'RentCast value estimate unavailable.')
  }

  if (rentResult.status === 'fulfilled') {
    rentPayload = rentResult.value as RentCastRentResponse
  } else {
    warnings.push(rentResult.reason instanceof Error ? rentResult.reason.message : 'RentCast rent estimate unavailable.')
  }

  if (!valuePayload && !rentPayload) return { value: null, low: null, high: null, rent: null, comparableCount: 0, subjectProperty: null, warnings }

  return {
    value:
      asNumber(valuePayload?.price) ??
      asNumber(valuePayload?.value) ??
      asNumber(valuePayload?.estimatedValue),
    low: asNumber(valuePayload?.priceRangeLow),
    high: asNumber(valuePayload?.priceRangeHigh),
    rent: asNumber(rentPayload?.rent) ?? asNumber(rentPayload?.price),
    comparableCount: Array.isArray(valuePayload?.comparables) ? valuePayload.comparables.length : 0,
    subjectProperty: valuePayload?.subjectProperty || null,
    warnings,
  }
}

export async function buildRoughPropertyEstimate(input: RoughPropertyEstimateInput): Promise<RoughPropertyEstimate> {
  const now = new Date().toISOString()
  const sellerEstimatedValue = parseCurrencyAmount(input.sellerEstimatedValue)
  const askingPrice = parseCurrencyAmount(input.askingPrice)
  const mortgageBalance = parseCurrencyAmount(input.mortgageBalance)
  const liensOrTaxesAmount = parseCurrencyAmount(input.liensOrTaxes)
  const rentcast = await fetchRentCastSnapshot(input).catch((error) => ({
    value: null,
    low: null,
    high: null,
    rent: null,
    comparableCount: 0,
    subjectProperty: null,
    warnings: [error instanceof Error ? error.message : 'Property valuation provider unavailable.'],
  }))

  const providerValue = rentcast?.value ?? null
  const fallbackValue = sellerEstimatedValue ?? askingPrice ?? null
  const estimateValue = providerValue ?? fallbackValue
  const source: RoughPropertyEstimateSource = providerValue
    ? 'rentcast'
    : sellerEstimatedValue
      ? 'seller_supplied'
      : askingPrice
        ? 'rule_based'
        : 'none'

  const confidence =
    source === 'rentcast'
      ? rentcast?.comparableCount
        ? 82
        : 72
      : source === 'seller_supplied'
        ? 44
        : source === 'rule_based'
          ? 28
          : 0

  const lowEstimate = rentcast?.low ?? (estimateValue ? Math.round(estimateValue * 0.85) : null)
  const highEstimate = rentcast?.high ?? (estimateValue ? Math.round(estimateValue * 1.15) : null)
  const debtLoad = (mortgageBalance || 0) + (liensOrTaxesAmount || 0)
  const equityEstimate = estimateValue ? estimateValue - debtLoad : null
  const ltvEstimate = estimateValue && debtLoad > 0 ? Math.round((debtLoad / estimateValue) * 1000) / 10 : null
  const spreadToAsking = estimateValue && askingPrice ? estimateValue - askingPrice : null
  const cashFactor = conditionCashFactor(input.propertyCondition)
  const acquisitionRangeHigh = estimateValue ? roundToNearest(estimateValue * cashFactor, 5000) : null
  const acquisitionRangeLow = estimateValue ? roundToNearest(estimateValue * cashFactor * 0.9, 5000) : null
  const warnings = [...(rentcast?.warnings || [])]

  if (source !== 'rentcast') {
    warnings.push('No live AVM provider result was available. Review comps before making an offer.')
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
    `rough rent: ${formatMoney(rentcast?.rent ?? null)}`,
    ltvEstimate !== null ? `estimated LTV: ${ltvEstimate}%` : 'estimated LTV: needs debt details',
    `occupancy: ${input.occupancyStatus || 'unknown'}`,
  ].join('; ')

  return {
    source,
    sourceLabel:
      source === 'rentcast'
        ? 'RentCast AVM'
        : source === 'seller_supplied'
          ? 'Seller supplied estimate'
          : source === 'rule_based'
            ? 'Rule-based placeholder'
            : 'Needs review',
    provider: source === 'rentcast' ? 'RentCast' : undefined,
    estimateValue: roundToNearest(estimateValue, 1000),
    lowEstimate: roundToNearest(lowEstimate, 1000),
    highEstimate: roundToNearest(highEstimate, 1000),
    rentEstimate: roundToNearest(rentcast?.rent ?? null, 50),
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
    comparableCount: rentcast?.comparableCount || 0,
    subjectProperty: rentcast?.subjectProperty || null,
    generatedAt: now,
    disclaimer: 'Rough internal estimate only. Not an appraisal or a guaranteed offer.',
  }
}
