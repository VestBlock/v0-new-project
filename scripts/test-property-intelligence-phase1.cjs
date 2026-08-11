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

const { parsePropertyImport } = require('../lib/property-intelligence/import.ts')
const { mapDealMachineLead } = require('../lib/property-intelligence/dealmachine-adapter.ts')
const { propertyIntelligenceFeatureSnapshot } = require('../lib/property-intelligence/feature-flags.ts')
const { normalizePropertyAddressKey } = require('../lib/property-intelligence/address.ts')
const {
  buildBuyerMatchingHook,
  buildDscrPrefillHook,
  suggestFundingPaths,
  buildOutreachPreparationHook,
} = require('../lib/property-intelligence/integration-hooks.ts')

const csv = `parcel_id,property_address,city,state,zip,owner_name,mailing_address,mailing_state,land_use,building_value,improvement_value,structure_sqft,assessed_value,latitude,longitude,notes
P-100,123 Empty Lot,Kansas City,MO,64127,KC LAND HOLDINGS LLC,400 Investor Ave,KS,Vacant Residential Land,0,0,0,18000,39.092,-94.55,tax delinquent code violation
P-101,22 Normal St,Kansas City,MO,64110,Jane Owner,22 Normal St,MO,Single Family,90000,85000,1200,140000,39.04,-94.57,clean record`

const preview = parsePropertyImport(csv, { sourceName: 'Phase 1 fixture', fileName: 'fixture.csv' })

if (preview.length !== 2) throw new Error(`Expected 2 preview rows, got ${preview.length}`)
if (preview[0].vacantLotConfidence < 50) throw new Error(`Expected vacant confidence >= 50, got ${preview[0].vacantLotConfidence}`)
if (preview[0].dealScore.score <= preview[1].dealScore.score) throw new Error('Expected distressed vacant lot to score higher than clean single-family record')
if (!preview[0].signals.some((signal) => signal.signal_type === 'tax_delinquent')) throw new Error('Expected tax delinquent signal')
if (!preview[0].signals.some((signal) => signal.signal_type === 'code_violation')) throw new Error('Expected code violation signal')

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
