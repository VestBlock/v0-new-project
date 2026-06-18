import { parseCurrencyAmount } from './roughEstimate'

export type AttomPropertyEnrichment = {
  provider: 'ATTOM'
  attomId: number | null
  matchedAddress: string | null
  apn: string | null
  fips: string | null
  ownerName: string | null
  ownerMailingAddress: string | null
  absenteeOwner: boolean | null
  propertyType: string | null
  yearBuilt: number | null
  livingSize: number | null
  bathsTotal: number | null
  condition: string | null
  constructionType: string | null
  marketValue: number | null
  assessedValue: number | null
  taxAmount: number | null
  taxYear: number | null
  lastSaleAmount: number | null
  lastSaleDate: string | null
  lastSaleType: string | null
  sourceDate: string
  signals: string[]
  raw: Record<string, unknown>
}

export type AttomLookupInput = {
  address: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

function clean(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value: unknown) {
  const parsed = parseCurrencyAmount(typeof value === 'number' ? value : clean(value))
  return Number.isFinite(parsed) ? parsed : null
}

function boolFromAbsentee(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (!text) return null
  if (text.includes('absentee')) return true
  if (text.includes('owner occupied') || text.includes('situs')) return false
  return null
}

function addressParts(input: AttomLookupInput) {
  const line = clean(input.address)
  const cityStateZip = [clean(input.city), clean(input.state), clean(input.zipCode)]
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*(\d{5})$/, ' $1')
  if (!line || !cityStateZip) return null
  return { address1: line, address2: cityStateZip }
}

function endpointFor(input: AttomLookupInput) {
  const parts = addressParts(input)
  if (!parts) return null
  const params = new URLSearchParams(parts)
  return `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?${params.toString()}`
}

export async function fetchAttomPropertyEnrichment(input: AttomLookupInput): Promise<AttomPropertyEnrichment | null> {
  const apiKey = process.env.ATTOM_API_KEY?.trim()
  const url = endpointFor(input)
  if (!apiKey || !url) return null

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      apikey: apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`ATTOM lookup failed with ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const property = Array.isArray(payload?.property) ? payload.property[0] : null
  if (!property) return null

  const identifier = property.identifier || {}
  const address = property.address || {}
  const summary = property.summary || {}
  const building = property.building || {}
  const assessment = property.assessment || {}
  const sale = property.sale || {}
  const owner = assessment.owner || {}
  const owner1 = owner.owner1 || {}
  const market = assessment.market || {}
  const assessed = assessment.assessed || {}
  const tax = assessment.tax || {}
  const saleAmountData = sale.saleAmountData || {}
  const construction = building.construction || {}
  const rooms = building.rooms || {}
  const size = building.size || {}

  const ownerName = clean(owner1.fullName)
  const absenteeOwner = boolFromAbsentee(owner.absenteeOwnerStatus || summary.absenteeInd)
  const marketValue = numberOrNull(market.mktTtlValue)
  const taxAmount = numberOrNull(tax.taxAmt)
  const condition = clean(construction.condition)
  const saleAmount = numberOrNull(saleAmountData.saleAmt)
  const saleDate = clean(sale.saleTransDate || sale.saleSearchDate || saleAmountData.saleRecDate)
  const sourceDate = clean(payload?.status?.responseDateTime) || new Date().toISOString()

  const signals = [
    clean(address.oneLine) ? `ATTOM matched address: ${address.oneLine}` : null,
    ownerName ? `ATTOM owner: ${ownerName}` : null,
    absenteeOwner === true ? 'ATTOM absentee/out-of-state owner signal' : null,
    marketValue !== null ? `ATTOM county market value: $${Math.round(marketValue).toLocaleString()}` : null,
    taxAmount !== null && tax.taxYear ? `ATTOM ${tax.taxYear} tax amount: $${Math.round(taxAmount).toLocaleString()}` : null,
    condition ? `ATTOM condition: ${condition}` : null,
    summary.yearBuilt ? `ATTOM year built: ${summary.yearBuilt}` : null,
    saleAmount !== null && saleDate ? `ATTOM last sale: $${Math.round(saleAmount).toLocaleString()} on ${saleDate}` : null,
  ].filter(Boolean) as string[]

  return {
    provider: 'ATTOM',
    attomId: numberOrNull(identifier.attomId || identifier.Id),
    matchedAddress: clean(address.oneLine),
    apn: clean(identifier.apn),
    fips: clean(identifier.fips),
    ownerName,
    ownerMailingAddress: clean(owner.mailingAddressOneLine),
    absenteeOwner,
    propertyType: clean(summary.propertyType || summary.propClass || summary.propType),
    yearBuilt: numberOrNull(summary.yearBuilt),
    livingSize: numberOrNull(size.livingSize || size.bldgSize || size.universalSize),
    bathsTotal: numberOrNull(rooms.bathsTotal || rooms.bathsFull),
    condition,
    constructionType: clean(construction.constructionType),
    marketValue,
    assessedValue: numberOrNull(assessed.assdTtlValue),
    taxAmount,
    taxYear: numberOrNull(tax.taxYear),
    lastSaleAmount: saleAmount,
    lastSaleDate: saleDate,
    lastSaleType: clean(saleAmountData.saleTransType || saleAmountData.saleDocType),
    sourceDate,
    signals,
    raw: property,
  }
}
