import { asNumber, detectSignals, detectVacantLot, scoreDeal } from '@/lib/property-intelligence/scoring'
import type { ImportPreviewRow, NormalizedPropertyInput } from '@/lib/property-intelligence/types'

const FIELD_ALIASES: Record<keyof Omit<NormalizedPropertyInput, 'sourceName' | 'sourceUrl' | 'fileName' | 'confidenceLevel' | 'rawFields' | 'geometry'>, string[]> = {
  parcelId: ['parcel_id', 'parcelid', 'parcel', 'apn', 'pin', 'account', 'account_number', 'property_id'],
  propertyAddress: ['property_address', 'site_address', 'situs_address', 'address', 'location_address', 'property location'],
  city: ['city', 'property_city', 'situs_city', 'site_city'],
  state: ['state', 'property_state', 'situs_state', 'site_state'],
  zipCode: ['zip', 'zip_code', 'zipcode', 'property_zip', 'situs_zip', 'postal_code'],
  county: ['county', 'county_name'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lon', 'lng', 'x'],
  landUse: ['land_use', 'landuse', 'use', 'use_description', 'property_use', 'zoning'],
  propertyClass: ['property_class', 'class', 'prop_class', 'property_type', 'class_description'],
  assessedValue: ['assessed_value', 'total_assessed_value', 'assessment', 'total_value', 'market_value', 'estimated_value'],
  landValue: ['land_value', 'assessed_land_value'],
  buildingValue: ['building_value', 'building_assessed_value', 'bldg_value'],
  improvementValue: ['improvement_value', 'improvements', 'impr_value'],
  structureSqft: ['structure_sqft', 'building_sqft', 'living_area', 'sqft', 'gross_area'],
  lotSqft: ['lot_sqft', 'land_sqft', 'lot_size_sqft', 'acreage'],
  yearBuilt: ['year_built', 'yr_built'],
  ownerName: ['owner_name', 'owner', 'taxpayer_name', 'name', 'grantor', 'respondent'],
  mailingAddress: ['mailing_address', 'owner_address', 'taxpayer_address', 'mail_address'],
  mailingCity: ['mailing_city', 'owner_city', 'taxpayer_city', 'mail_city'],
  mailingState: ['mailing_state', 'owner_state', 'taxpayer_state', 'mail_state'],
  mailingZip: ['mailing_zip', 'owner_zip', 'taxpayer_zip', 'mail_zip'],
}

function normalizeHeader(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function get(row: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]))
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias))
    if (value !== undefined && String(value).trim() !== '') return value
  }
  return null
}

export function parseCsv(text: string) {
  const parsedRows: string[][] = []
  let cells: string[] = []
  let value = ''
  let quoted = false
  const content = text.replace(/^\uFEFF/, '')

  const finishRow = () => {
    cells.push(value.trim())
    if (cells.some((cell) => cell.length > 0)) parsedRows.push(cells)
    cells = []
    value = ''
  }

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(value.trim())
      value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      finishRow()
    } else {
      value += char
    }
  }

  if (value.length || cells.length) finishRow()
  const headers = parsedRows[0] || []
  return parsedRows.slice(1).map((rowCells) => {
    return headers.reduce<Record<string, unknown>>((row, header, index) => {
      row[header] = rowCells[index] ?? ''
      return row
    }, {})
  })
}

export function normalizePropertyRow(row: Record<string, unknown>, source: {
  sourceName: string
  sourceUrl?: string | null
  fileName?: string | null
  confidenceLevel?: number
}): NormalizedPropertyInput {
  const pick = <K extends keyof typeof FIELD_ALIASES>(key: K) => get(row, FIELD_ALIASES[key])
  const state = String(pick('state') || '').trim().toUpperCase() || null
  const mailingState = String(pick('mailingState') || '').trim().toUpperCase() || null
  const rowSourceUrl = String(get(row, ['source_url', 'record_url', 'case_url', 'source_link']) || '').trim() || null

  return {
    parcelId: String(pick('parcelId') || '').trim() || null,
    propertyAddress: String(pick('propertyAddress') || '').trim() || null,
    city: String(pick('city') || '').trim() || null,
    state,
    zipCode: String(pick('zipCode') || '').trim() || null,
    county: String(pick('county') || '').trim() || null,
    latitude: asNumber(pick('latitude')),
    longitude: asNumber(pick('longitude')),
    landUse: String(pick('landUse') || '').trim() || null,
    propertyClass: String(pick('propertyClass') || '').trim() || null,
    assessedValue: asNumber(pick('assessedValue')),
    landValue: asNumber(pick('landValue')),
    buildingValue: asNumber(pick('buildingValue')),
    improvementValue: asNumber(pick('improvementValue')),
    structureSqft: asNumber(pick('structureSqft')),
    lotSqft: asNumber(pick('lotSqft')),
    yearBuilt: asNumber(pick('yearBuilt')),
    ownerName: String(pick('ownerName') || '').trim() || null,
    mailingAddress: String(pick('mailingAddress') || '').trim() || null,
    mailingCity: String(pick('mailingCity') || '').trim() || null,
    mailingState,
    mailingZip: String(pick('mailingZip') || '').trim() || null,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl || rowSourceUrl,
    fileName: source.fileName || null,
    confidenceLevel: source.confidenceLevel || 70,
    rawFields: row,
  }
}

export function parseGeoJson(text: string, source: {
  sourceName: string
  sourceUrl?: string | null
  fileName?: string | null
  confidenceLevel?: number
}) {
  const geojson = JSON.parse(text)
  const features = Array.isArray(geojson?.features) ? geojson.features : []
  return features.map((feature: any) => {
    const input = normalizePropertyRow(feature.properties || {}, source)
    const coordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null
    return {
      ...input,
      longitude: input.longitude ?? (Array.isArray(coordinates) ? asNumber(coordinates[0]) : null),
      latitude: input.latitude ?? (Array.isArray(coordinates) ? asNumber(coordinates[1]) : null),
      geometry: feature.geometry || null,
    }
  })
}

export function buildImportPreview(inputs: NormalizedPropertyInput[]): ImportPreviewRow[] {
  return inputs.map((input) => {
    const vacant = detectVacantLot(input)
    const signals = detectSignals(input)
    return {
      input,
      vacantLotConfidence: vacant.confidence,
      vacantLotReasons: vacant.reasons,
      signals,
      dealScore: scoreDeal(input, signals),
    }
  })
}

export function parsePropertyImport(text: string, input: {
  sourceName: string
  sourceUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  confidenceLevel?: number
}) {
  const isGeoJson = input.fileType?.includes('geojson') || input.fileName?.toLowerCase().endsWith('.geojson') || text.trim().startsWith('{')
  const rows = isGeoJson
    ? parseGeoJson(text, input)
    : parseCsv(text).map((row) => normalizePropertyRow(row, input))

  return buildImportPreview(rows)
}
