import 'server-only'

import { finalizeAttomFacts, type AttomPropertyFacts } from '@/lib/property-intelligence/attom-strategy'

const DEFAULT_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

type UnknownRecord = Record<string, any>

export type AttomAddress = {
  address1: string
  address2: string
}

export type AttomEndpointResult = {
  endpoint: 'expanded_profile' | 'home_equity'
  status: number
  billableCall: boolean
  fetchedAt: string
  facts: Partial<AttomPropertyFacts>
}

export class AttomApiError extends Error {
  status: number
  endpoint: string
  billableCall: boolean

  constructor(message: string, input: { status: number; endpoint: string; billableCall: boolean }) {
    super(message)
    this.name = 'AttomApiError'
    this.status = input.status
    this.endpoint = input.endpoint
    this.billableCall = input.billableCall
  }
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name])
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

export function getAttomConfig() {
  return {
    apiKey: String(process.env.ATTOM_API_KEY || '').trim(),
    baseUrl: String(process.env.ATTOM_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    enabled: ['1', 'true', 'yes', 'on'].includes(String(process.env.ATTOM_ENRICHMENT_ENABLED || '').toLowerCase()),
    dailyCallLimit: envNumber('ATTOM_DAILY_CALL_LIMIT', 100, 1, 10_000),
    maxPropertiesPerRun: envNumber('ATTOM_MAX_PROPERTIES_PER_RUN', 25, 1, 100),
    equityCacheDays: envNumber('ATTOM_EQUITY_CACHE_DAYS', 30, 1, 90),
    profileCacheDays: envNumber('ATTOM_PROFILE_CACHE_DAYS', 30, 1, 90),
    distressCacheDays: envNumber('ATTOM_DISTRESS_CACHE_DAYS', 5, 1, 30),
    timeoutMs: envNumber('ATTOM_TIMEOUT_MS', 12_000, 2_000, 30_000),
    trialEndDate: String(process.env.ATTOM_TRIAL_END_DATE || '').trim() || null,
  }
}

export function getAttomProviderStatus() {
  const config = getAttomConfig()
  const trialEnd = config.trialEndDate ? Date.parse(config.trialEndDate) : Number.NaN
  const trialDaysRemaining = Number.isFinite(trialEnd)
    ? Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)))
    : null
  return {
    configured: Boolean(config.apiKey),
    enabled: config.enabled,
    dailyCallLimit: config.dailyCallLimit,
    maxPropertiesPerRun: config.maxPropertiesPerRun,
    equityCacheDays: config.equityCacheDays,
    profileCacheDays: config.profileCacheDays,
    trialEndDate: config.trialEndDate,
    trialDaysRemaining,
  }
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(value: unknown): string | null {
  const cleaned = String(value ?? '').trim()
  return cleaned || null
}

function boolIndicator(...values: unknown[]) {
  const text = values.map((value) => String(value || '')).join(' ').toLowerCase()
  return /\b(y|yes|true|absentee|corporate|company|business|entity)\b/.test(text)
}

function propertyFromBody(body: UnknownRecord) {
  const property = Array.isArray(body?.property) ? body.property[0] : null
  return property && typeof property === 'object' ? property as UnknownRecord : null
}

export function parseAttomExpandedProfile(body: UnknownRecord): Partial<AttomPropertyFacts> {
  const property = propertyFromBody(body)
  if (!property) return {}
  const assessment = property.assessment || {}
  const owner = assessment.owner || {}
  const mortgage = assessment.mortgage || {}
  const market = assessment.market || {}
  const sale = property.sale || {}
  const identifier = property.identifier || {}
  const summary = property.summary || {}

  return {
    attomId: numberValue(identifier.attomId),
    apn: stringValue(identifier.apn || identifier.apnOrig),
    address: stringValue(property.address?.oneLine),
    ownerName: stringValue(owner.owner1?.fullName || owner.owner1 || owner.description),
    ownerType: stringValue(owner.type || owner.description),
    ownerMailingAddress: stringValue(owner.mailingAddressOneLine),
    absenteeOwner: boolIndicator(summary.absenteeInd, owner.absenteeOwnerStatus),
    corporateOwner: boolIndicator(owner.corporateIndicator, owner.type),
    propertyType: stringValue(summary.propertyType || summary.propType || summary.propSubType),
    propertyClass: stringValue(summary.propClass),
    landUse: stringValue(summary.propLandUse),
    yearBuilt: numberValue(summary.yearBuilt),
    structureSqft: numberValue(property.building?.size?.universalSize || property.building?.size?.livingSize || property.building?.size?.bldgSize),
    lotSizeAcres: numberValue(property.lot?.lotSize1),
    latitude: numberValue(property.location?.latitude),
    longitude: numberValue(property.location?.longitude),
    assessedValue: numberValue(assessment.assessed?.assdTtlValue),
    marketValue: numberValue(market.mktTtlValue),
    landValue: numberValue(market.mktLandValue),
    improvementValue: numberValue(market.mktImprValue),
    taxAmount: numberValue(assessment.tax?.taxAmt),
    taxYear: numberValue(assessment.tax?.taxYear),
    delinquentYear: numberValue(assessment.delinquentyear),
    latestSaleAmount: numberValue(sale.amount?.saleAmt),
    latestSaleDate: stringValue(sale.amount?.saleRecDate || sale.saleTransDate || sale.saleSearchDate),
    firstMortgageAmount: numberValue(mortgage.FirstConcurrent?.amount),
    secondMortgageAmount: numberValue(mortgage.SecondConcurrent?.amount),
    dataLastUpdated: stringValue(property.vintage?.lastModified || property.vintage?.pubDate),
  }
}

export function parseAttomHomeEquity(body: UnknownRecord): Partial<AttomPropertyFacts> {
  const property = propertyFromBody(body)
  if (!property) return {}
  const equity = property.homeEquity || {}
  const avm = property.avm || {}
  const identifier = property.identifier || {}
  const summary = property.summary || {}

  return {
    attomId: numberValue(identifier.attomId),
    apn: stringValue(identifier.apn || identifier.apnOrig),
    address: stringValue(property.address?.oneLine),
    propertyType: stringValue(summary.propertyType || summary.propType || summary.propSubType),
    propertyClass: stringValue(summary.propClass),
    landUse: stringValue(summary.propLandUse),
    yearBuilt: numberValue(summary.yearBuilt),
    structureSqft: numberValue(property.building?.size?.universalSize || property.building?.size?.livingSize),
    lotSizeAcres: numberValue(property.lot?.lotSize1),
    latitude: numberValue(property.location?.latitude),
    longitude: numberValue(property.location?.longitude),
    estimatedLoanBalance: numberValue(equity.totalEstimatedLoanBalance),
    avmValue: numberValue(avm.amount?.value),
    avmLow: numberValue(avm.amount?.low),
    avmHigh: numberValue(avm.amount?.high),
    avmConfidence: numberValue(avm.amount?.scr),
    ltvPercent: numberValue(equity.LTV),
    equityAmount: numberValue(equity.estimatedAvailableEquity),
    dataLastUpdated: stringValue(equity.recordLastUpdated || avm.eventDate || property.vintage?.lastModified),
  }
}

async function fetchEndpoint(endpoint: 'property/expandedprofile' | 'valuation/homeequity', address: AttomAddress) {
  const config = getAttomConfig()
  if (!config.apiKey) throw new AttomApiError('ATTOM_API_KEY is not configured.', { status: 0, endpoint, billableCall: false })
  if (!config.enabled) throw new AttomApiError('ATTOM_ENRICHMENT_ENABLED is disabled.', { status: 0, endpoint, billableCall: false })

  const url = new URL(`${config.baseUrl}/${endpoint}`)
  url.searchParams.set('address1', address.address1)
  url.searchParams.set('address2', address.address2)
  const response = await fetch(url, {
    headers: { Accept: 'application/json', apikey: config.apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  const body = await response.json().catch(() => ({})) as UnknownRecord
  if (!response.ok) {
    const providerMessage = stringValue(body?.status?.msg || body?.status?.message || body?.message)
    throw new AttomApiError(providerMessage || `ATTOM request failed with ${response.status}.`, {
      status: response.status,
      endpoint,
      billableCall: response.status === 200,
    })
  }
  if (!propertyFromBody(body)) {
    throw new AttomApiError('ATTOM returned no property match for this address.', {
      status: response.status,
      endpoint,
      billableCall: true,
    })
  }
  return body
}

export async function fetchAttomExpandedProfile(address: AttomAddress): Promise<AttomEndpointResult> {
  const fetchedAt = new Date().toISOString()
  const body = await fetchEndpoint('property/expandedprofile', address)
  return { endpoint: 'expanded_profile', status: 200, billableCall: true, fetchedAt, facts: parseAttomExpandedProfile(body) }
}

export async function fetchAttomHomeEquity(address: AttomAddress): Promise<AttomEndpointResult> {
  const fetchedAt = new Date().toISOString()
  const body = await fetchEndpoint('valuation/homeequity', address)
  return { endpoint: 'home_equity', status: 200, billableCall: true, fetchedAt, facts: parseAttomHomeEquity(body) }
}

export function mergeAttomFacts(...facts: Array<Partial<AttomPropertyFacts> | null | undefined>) {
  return finalizeAttomFacts(Object.assign({}, ...facts.filter(Boolean)))
}
