import type { NormalizedPropertyInput, PropertySignalRecord } from '@/lib/property-intelligence/types'

type StoredPropertyIdentity = {
  parcel_id?: string | null
  property_address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  county?: string | null
}

export type PropertySourceEvidence = {
  sourceName: string
  sourceUrl: string | null
  fileName: string | null
  sourceId: string | null
  importId: string | null
  observedAt: string
  fields: Record<string, unknown>
}

const SOURCE_EVIDENCE_KEY = '_vestblock_source_evidence'
const MAX_SOURCE_EVIDENCE = 50

function normalizedToken(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

function stateToken(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').trim()
}

function addressToken(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function normalizeParcelToken(value: unknown) {
  return normalizedToken(value)
}

export function normalizeCountyToken(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|municipality)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

function jurisdictionToken(input: {
  state?: string | null
  county?: string | null
  city?: string | null
  zipCode?: string | null
}) {
  const state = stateToken(input.state)
  if (!state) return null
  const county = normalizeCountyToken(input.county)
  if (county) return `${state}:county:${county}`
  const zipCode = normalizedToken(input.zipCode)
  if (zipCode) return `${state}:zip:${zipCode}`
  const city = normalizedToken(input.city)
  if (city) return `${state}:city:${city}`
  return null
}

export function normalizeParcelJurisdictionKey(input: Pick<NormalizedPropertyInput, 'parcelId' | 'state' | 'county' | 'city' | 'zipCode'>) {
  const parcelId = normalizeParcelToken(input.parcelId)
  const jurisdiction = jurisdictionToken(input)
  return parcelId && jurisdiction ? `parcel:${jurisdiction}:${parcelId}` : null
}

export function normalizeStoredParcelJurisdictionKey(input: StoredPropertyIdentity) {
  return normalizeParcelJurisdictionKey({
    parcelId: input.parcel_id,
    state: input.state,
    county: input.county,
    city: input.city,
    zipCode: input.zip_code,
  })
}

export function canonicalPropertyKey(input: Pick<NormalizedPropertyInput, 'parcelId' | 'propertyAddress' | 'city' | 'state' | 'zipCode' | 'county'>) {
  const parcelKey = normalizeParcelJurisdictionKey(input)
  if (parcelKey) return parcelKey
  const address = addressToken(input.propertyAddress)
  const city = addressToken(input.city)
  const state = stateToken(input.state).toLowerCase()
  return address && city && state ? `address:${address}|${city}|${state}` : null
}

export function isSameParcelIdentity(
  stored: StoredPropertyIdentity,
  incoming: Pick<NormalizedPropertyInput, 'parcelId' | 'state' | 'county' | 'city' | 'zipCode'>,
) {
  const parcelId = normalizeParcelToken(incoming.parcelId)
  if (!parcelId || parcelId !== normalizeParcelToken(stored.parcel_id)) return false

  const state = stateToken(incoming.state)
  if (!state || state !== stateToken(stored.state)) return false

  const incomingCounty = normalizeCountyToken(incoming.county)
  const storedCounty = normalizeCountyToken(stored.county)
  if (incomingCounty && storedCounty) return incomingCounty === storedCounty

  const incomingZip = normalizedToken(incoming.zipCode)
  const storedZip = normalizedToken(stored.zip_code)
  if (incomingZip && storedZip) return incomingZip === storedZip
  if (incomingCounty || storedCounty) return false

  const incomingCity = normalizedToken(incoming.city)
  const storedCity = normalizedToken(stored.city)
  return Boolean(incomingCity && storedCity && incomingCity === storedCity)
}

function nonBlank(value: unknown) {
  const cleaned = String(value || '').trim()
  return cleaned || null
}

function preferExisting<T>(existing: T | null | undefined, incoming: T | null | undefined) {
  if (existing !== null && existing !== undefined && String(existing).trim() !== '') return existing
  return incoming ?? null
}

export function normalizedInputFromStoredProperty(
  property: Record<string, any>,
  incoming: NormalizedPropertyInput,
): NormalizedPropertyInput {
  return {
    ...incoming,
    parcelId: property.parcel_id ?? incoming.parcelId ?? null,
    propertyAddress: property.property_address ?? incoming.propertyAddress ?? null,
    city: property.city ?? incoming.city ?? null,
    state: property.state ?? incoming.state ?? null,
    zipCode: property.zip_code ?? incoming.zipCode ?? null,
    county: property.county ?? incoming.county ?? null,
    latitude: property.latitude ?? incoming.latitude ?? null,
    longitude: property.longitude ?? incoming.longitude ?? null,
    landUse: property.land_use ?? incoming.landUse ?? null,
    propertyClass: property.property_class ?? incoming.propertyClass ?? null,
    assessedValue: property.assessed_value ?? incoming.assessedValue ?? null,
    landValue: property.land_value ?? incoming.landValue ?? null,
    buildingValue: property.building_value ?? incoming.buildingValue ?? null,
    improvementValue: property.improvement_value ?? incoming.improvementValue ?? null,
    structureSqft: property.structure_sqft ?? incoming.structureSqft ?? null,
    lotSqft: property.lot_sqft ?? incoming.lotSqft ?? null,
    yearBuilt: property.year_built ?? incoming.yearBuilt ?? null,
    rawFields: property.raw_fields && typeof property.raw_fields === 'object'
      ? property.raw_fields
      : incoming.rawFields,
  }
}

export function mergedOwnerEntityPayload(existing: Record<string, any>, input: NormalizedPropertyInput) {
  const incomingName = nonBlank(input.ownerName) || 'Unknown owner'
  const storedName = nonBlank(existing.owner_name)
  const preservesStoredIdentity = Boolean(storedName && storedName.toLowerCase() !== 'unknown owner')
  const ownerName = preservesStoredIdentity
    ? storedName
    : incomingName
  const mailingAddress = nonBlank(input.mailingAddress)
  const propertyAddress = nonBlank(input.propertyAddress)
  const propertyState = nonBlank(input.state)?.toUpperCase() || null
  const mailingState = nonBlank(input.mailingState)?.toUpperCase() || null
  const incomingIsLlc = /\b(llc|l\.l\.c\.|inc|corp|corporation|company|co\.|holdings|trust|properties|partners|ventures|investments|capital)\b/i.test(incomingName)
  const isLlc = Boolean(existing.is_llc || incomingIsLlc)
  return {
    owner_name: ownerName,
    owner_type: preservesStoredIdentity && existing.owner_type && existing.owner_type !== 'unknown'
      ? existing.owner_type
      : isLlc ? 'entity' : 'unknown',
    mailing_address: preferExisting(existing.mailing_address, mailingAddress),
    mailing_city: preferExisting(existing.mailing_city, nonBlank(input.mailingCity)),
    mailing_state: preferExisting(existing.mailing_state, mailingState),
    mailing_zip: preferExisting(existing.mailing_zip, nonBlank(input.mailingZip)),
    is_absentee: Boolean(existing.is_absentee || (mailingAddress && propertyAddress && mailingAddress.toLowerCase() !== propertyAddress.toLowerCase())),
    is_out_of_state: Boolean(existing.is_out_of_state || (mailingState && propertyState && mailingState !== propertyState)),
    is_llc: isLlc,
    raw_fields: {
      ...(input.rawFields || {}),
      ...((existing.raw_fields && typeof existing.raw_fields === 'object') ? existing.raw_fields : {}),
    },
    updated_at: new Date().toISOString(),
  }
}

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function propertySignalEvidenceKey(signal: Pick<PropertySignalRecord, 'signal_type' | 'signal_value' | 'source_name' | 'source_url'>) {
  return [signal.signal_type, signal.signal_value, signal.source_name, signal.source_url].map(clean).join('|')
}

export function missingPropertySignals(existing: PropertySignalRecord[], incoming: PropertySignalRecord[]) {
  const seen = new Set(existing.map(propertySignalEvidenceKey))
  return incoming.filter((signal) => {
    const key = propertySignalEvidenceKey(signal)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sourceEvidenceKey(evidence: Pick<PropertySourceEvidence, 'sourceName' | 'sourceUrl' | 'fileName'>) {
  return [evidence.sourceName, evidence.sourceUrl, evidence.fileName].map(clean).join('|')
}

function asEvidence(value: unknown): PropertySourceEvidence[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is PropertySourceEvidence => Boolean(item && typeof item === 'object' && clean((item as PropertySourceEvidence).sourceName)))
}

export function mergePropertyRawFields(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
  evidence: PropertySourceEvidence,
) {
  const existingFields = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
  const incomingFields = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {}
  const merged: Record<string, unknown> = { ...existingFields }
  for (const [key, value] of Object.entries(incomingFields)) {
    const previous = merged[key]
    if (previous === null || previous === undefined || String(previous).trim() === '') merged[key] = value
  }

  const evidenceByKey = new Map(
    asEvidence(existingFields[SOURCE_EVIDENCE_KEY]).map((item) => [sourceEvidenceKey(item), item]),
  )
  evidenceByKey.set(sourceEvidenceKey(evidence), evidence)
  merged[SOURCE_EVIDENCE_KEY] = Array.from(evidenceByKey.values()).slice(-MAX_SOURCE_EVIDENCE)
  return merged
}

export function sourceEvidenceCount(rawFields: Record<string, unknown> | null | undefined) {
  return asEvidence(rawFields?.[SOURCE_EVIDENCE_KEY]).length
}
