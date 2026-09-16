process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' })
require('ts-node/register')

const Module = require('module')
const path = require('path')
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveVestBlockAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const { parseCsv, parsePropertyImport } = require('../lib/property-intelligence/import.ts')
const { mapDealMachineLead } = require('../lib/property-intelligence/dealmachine-adapter.ts')
const { propertyIntelligenceFeatureSnapshot } = require('../lib/property-intelligence/feature-flags.ts')
const { normalizePropertyAddressKey } = require('../lib/property-intelligence/address.ts')
const {
  canonicalPropertyKey,
  isSameParcelIdentity,
  mergePropertyRawFields,
  mergedOwnerEntityPayload,
  missingPropertySignals,
  normalizeCountyToken,
  normalizeParcelJurisdictionKey,
  normalizeParcelToken,
  normalizedInputFromStoredProperty,
  sourceEvidenceCount,
} = require('../lib/property-intelligence/identity.ts')
const { scoreDeal } = require('../lib/property-intelligence/scoring.ts')
const {
  buildBuyerMatchingHook,
  buildDscrPrefillHook,
  suggestFundingPaths,
  buildOutreachPreparationHook,
} = require('../lib/property-intelligence/integration-hooks.ts')

const csv = `parcel_id,property_address,city,state,zip,owner_name,mailing_address,mailing_state,land_use,building_value,improvement_value,structure_sqft,assessed_value,latitude,longitude,notes,source_url
P-100,123 Empty Lot,Kansas City,MO,64127,KC LAND HOLDINGS LLC,400 Investor Ave,KS,Vacant Residential Land,0,0,0,18000,39.092,-94.55,tax delinquent code violation,https://data.example.gov/case/P-100
P-101,22 Normal St,Kansas City,MO,64110,Jane Owner,22 Normal St,MO,Single Family,90000,85000,1200,140000,39.04,-94.57,clean record,https://data.example.gov/case/P-101`

const preview = parsePropertyImport(csv, { sourceName: 'Phase 1 fixture', fileName: 'fixture.csv' })

if (preview.length !== 2) throw new Error(`Expected 2 preview rows, got ${preview.length}`)
if (preview[0].vacantLotConfidence < 50) throw new Error(`Expected vacant confidence >= 50, got ${preview[0].vacantLotConfidence}`)
if (preview[0].dealScore.score <= preview[1].dealScore.score) throw new Error('Expected distressed vacant lot to score higher than clean single-family record')
if (!preview[0].signals.some((signal) => signal.signal_type === 'tax_delinquent')) throw new Error('Expected tax delinquent signal')
if (!preview[0].signals.some((signal) => signal.signal_type === 'code_violation')) throw new Error('Expected code violation signal')
if (preview[0].input.sourceUrl !== 'https://data.example.gov/case/P-100') throw new Error('Expected row-level government source URL to be preserved')
if (!preview[0].signals.every((signal) => signal.source_url === 'https://data.example.gov/case/P-100')) throw new Error('Expected signals to preserve row-level government source URL')

const complexCsv = '\uFEFFparcel_id,property_address,notes,owner_name\r\n"00-12-3","100 Main St, Unit 2","First line\r\nSecond line, with comma","Doe, Jane"\r\n"00-12-4",200 Main St,"Said ""call me""",John Doe\r\n'
const complexRows = parseCsv(complexCsv)
if (complexRows.length !== 2) throw new Error(`Expected 2 logical quoted CSV rows, got ${complexRows.length}`)
if (complexRows[0].property_address !== '100 Main St, Unit 2') throw new Error('Expected quoted comma to remain in the property address')
if (complexRows[0].notes !== 'First line\r\nSecond line, with comma') throw new Error('Expected quoted CRLF and comma to remain in one field')
if (complexRows[1].notes !== 'Said "call me"') throw new Error('Expected escaped CSV quotes to be decoded')

const scopedParcelA = normalizeParcelJurisdictionKey({ parcelId: '00-12-3', county: 'Jackson County', city: 'Kansas City', state: 'MO', zipCode: '64127' })
const scopedParcelB = normalizeParcelJurisdictionKey({ parcelId: '00123', county: 'Jackson County', city: 'Kansas City', state: 'MO', zipCode: '64127' })
const scopedParcelOtherCounty = normalizeParcelJurisdictionKey({ parcelId: '00123', county: 'Clay County', city: 'Kansas City', state: 'MO', zipCode: '64127' })
if (scopedParcelA !== scopedParcelB) throw new Error('Expected formatting variants of one parcel in the same jurisdiction to share a key')
if (scopedParcelA === scopedParcelOtherCounty) throw new Error('Expected the same parcel id in different counties to remain distinct')
if (normalizeParcelJurisdictionKey({ parcelId: '00123', state: null, county: null, city: null, zipCode: null }) !== null) {
  throw new Error('Expected parcel-only records without jurisdiction to avoid unsafe global deduplication')
}
if (normalizeCountyToken('Hamilton County') !== normalizeCountyToken('Hamilton')) {
  throw new Error('Expected county suffix variants to share one jurisdiction token')
}
if (normalizeParcelToken('00-12-3') !== '00123') throw new Error('Expected parcel formatting to normalize')
if (!isSameParcelIdentity(
  { parcel_id: '00-12-3', state: 'OH', county: 'Hamilton County', city: 'Cincinnati', zip_code: '45202' },
  { parcelId: '00123', state: 'OH', county: null, city: 'Cincinnati', zipCode: '45202' },
)) {
  throw new Error('Expected a partial and enriched parcel record with overlapping jurisdiction facts to match')
}
if (!canonicalPropertyKey({ parcelId: null, propertyAddress: '1 Main St', city: 'Toledo', state: 'OH', zipCode: '43604', county: null })?.startsWith('address:')) {
  throw new Error('Expected address identity fallback when no safely scoped parcel key exists')
}
if (canonicalPropertyKey({ parcelId: null, propertyAddress: '1 Main St', city: 'Toledo', state: 'OH', zipCode: null, county: null }) !==
    canonicalPropertyKey({ parcelId: null, propertyAddress: '1 Main St', city: 'Toledo', state: 'OH', zipCode: '43604', county: null })) {
  throw new Error('Expected address identity not to change when ZIP enrichment arrives')
}

const sourceOneSignal = { signal_type: 'tax_delinquent', signal_label: 'Tax delinquency', signal_value: '2025', confidence_score: 75, source_name: 'County tax', source_url: 'https://county.example/tax' }
const sourceTwoSignal = { ...sourceOneSignal, source_name: 'City code', source_url: 'https://city.example/code' }
const missingSignals = missingPropertySignals([sourceOneSignal], [sourceOneSignal, sourceTwoSignal, sourceTwoSignal])
if (missingSignals.length !== 1 || missingSignals[0].source_name !== 'City code') {
  throw new Error('Expected exact signal evidence to dedupe while preserving corroboration from another source')
}

const firstEvidence = {
  sourceName: 'County tax', sourceUrl: 'https://county.example/tax', fileName: 'tax.csv',
  sourceId: 'source-1', importId: 'import-1', observedAt: '2026-09-16T12:00:00.000Z', fields: { balance: '1200' },
}
const secondEvidence = {
  sourceName: 'City code', sourceUrl: 'https://city.example/code', fileName: 'code.csv',
  sourceId: 'source-2', importId: 'import-2', observedAt: '2026-09-16T13:00:00.000Z', fields: { case: 'unsafe structure' },
}
let mergedFields = mergePropertyRawFields({ owner: 'Original owner' }, { owner: 'Conflicting owner', tax_year: '2025' }, firstEvidence)
mergedFields = mergePropertyRawFields(mergedFields, { code_case: 'CV-1' }, secondEvidence)
mergedFields = mergePropertyRawFields(mergedFields, { code_case: 'CV-1' }, { ...secondEvidence, importId: 'retry', observedAt: '2026-09-16T13:05:00.000Z' })
if (mergedFields.owner !== 'Original owner') throw new Error('Expected source merge not to overwrite established conflicting property facts')
if (mergedFields.tax_year !== '2025' || mergedFields.code_case !== 'CV-1') throw new Error('Expected missing source fields to merge into the property record')
if (sourceEvidenceCount(mergedFields) !== 2) throw new Error('Expected two distinct sources and no duplicate evidence on retry')

const partialIncoming = {
  parcelId: '00123', propertyAddress: '10 Main St', city: 'Kansas City', state: 'MO', zipCode: null,
  sourceName: 'City code', rawFields: { violation: 'Unsafe structure' },
}
const mergedScoringInput = normalizedInputFromStoredProperty({
  parcel_id: '00-12-3', property_address: '10 Main St', city: 'Kansas City', state: 'MO', zip_code: '64127',
  raw_fields: { original: true, violation: 'Unsafe structure' },
}, partialIncoming)
const mergedScore = scoreDeal(mergedScoringInput, [sourceOneSignal])
if (!mergedScore.reason_codes.includes('ZIP_PRIORITY')) {
  throw new Error('Expected a partial corroborating import to retain stored ZIP scoring context')
}

const enrichedOwner = mergedOwnerEntityPayload({
  owner_name: 'Unknown owner', owner_type: 'unknown', mailing_address: null, mailing_city: null,
  mailing_state: null, mailing_zip: null, is_absentee: false, is_out_of_state: false, is_llc: false,
  raw_fields: { original: true },
}, {
  ...partialIncoming,
  ownerName: 'Main Street Holdings LLC',
  mailingAddress: '99 Market St',
  mailingCity: 'St Louis',
  mailingState: 'MO',
  mailingZip: '63101',
})
if (enrichedOwner.owner_name !== 'Main Street Holdings LLC' || enrichedOwner.mailing_zip !== '63101' || !enrichedOwner.is_llc) {
  throw new Error('Expected a duplicate import to fill missing normalized owner facts')
}
const preservedOwner = mergedOwnerEntityPayload({ ...enrichedOwner, owner_name: 'Established Owner' }, {
  ...partialIncoming,
  ownerName: 'Conflicting Owner',
})
if (preservedOwner.owner_name !== 'Established Owner') throw new Error('Expected established owner identity not to be overwritten')

const flags = propertyIntelligenceFeatureSnapshot()
if (!flags.PROPERTY_INTELLIGENCE_ENABLED) throw new Error('Property intelligence should default enabled')
if (flags.DEALMACHINE_SYNC_ENABLED) throw new Error('DealMachine sync should default disabled')
if (flags.OSINT_ADAPTERS_ENABLED) throw new Error('OSINT adapters should default disabled')

const keyA = normalizePropertyAddressKey({ propertyAddress: '123 Empty Lot', city: 'Kansas City', state: 'MO', zipCode: '64127' })
const keyB = normalizePropertyAddressKey({ propertyAddress: '123  EMPTY   LOT', city: 'kansas city', state: 'mo', zipCode: '64127' })
if (keyA !== keyB) throw new Error('Expected normalized duplicate address keys to match')

const dm = mapDealMachineLead({
  id: 'dm-1',
  address: '500 DM Lead Ave',
  city: 'Tulsa',
  state: 'OK',
  zip: '74103',
  owner_name: 'DM OWNER LLC',
  mailing_state: 'TX',
})
if (dm.providerKey !== 'dealmachine' || dm.normalized.sourceName !== 'DealMachine') throw new Error('DealMachine mapping failed')

const propertyRecord = {
  id: 'p1',
  source_id: 's1',
  import_id: 'i1',
  owner_entity_id: 'o1',
  parcel_id: 'P-100',
  property_address: '123 Empty Lot',
  city: 'Kansas City',
  state: 'MO',
  zip_code: '64127',
  county: null,
  latitude: 39.092,
  longitude: -94.55,
  land_use: 'Vacant Residential Land',
  property_class: null,
  assessed_value: 18000,
  land_value: null,
  building_value: 0,
  improvement_value: 0,
  structure_sqft: 0,
  lot_sqft: null,
  year_built: null,
  is_vacant_lot: true,
  vacant_lot_confidence: preview[0].vacantLotConfidence,
  raw_fields: {},
  owner_entities: { id: 'o1', owner_name: 'KC LAND HOLDINGS LLC', owner_type: 'entity', mailing_address: null, mailing_city: null, mailing_state: 'KS', mailing_zip: null, is_absentee: true, is_out_of_state: true, is_llc: true },
  property_signals: preview[0].signals,
  deal_scores: [preview[0].dealScore],
}

const buyerHook = buildBuyerMatchingHook(propertyRecord)
if (!buyerHook.reason_codes.includes('VACANT_LAND_BUYERS')) throw new Error('Expected vacant land buyer hook')
const dscrHook = buildDscrPrefillHook(propertyRecord)
if (!dscrHook.missingFields.includes('marketRent')) throw new Error('Expected DSCR missing market rent')
const funding = suggestFundingPaths(propertyRecord)
if (!funding.some((item) => item.path === 'land_acquisition_loan')) throw new Error('Expected land funding suggestion')
const outreach = buildOutreachPreparationHook(propertyRecord)
if (/behind on payments/i.test(outreach.email_draft) || /mortgage delinquency/i.test(outreach.email_draft)) {
  throw new Error('Outreach draft contains unsupported sensitive claim')
}

console.log(JSON.stringify({
  rows: preview.length,
  firstScore: preview[0].dealScore.score,
  firstSignals: preview[0].signals.map((signal) => signal.signal_type),
  secondScore: preview[1].dealScore.score,
  dealMachineMapped: dm.normalized.propertyAddress,
  buyerHook: buyerHook.reason_codes,
  featureDefaults: flags,
}, null, 2))
