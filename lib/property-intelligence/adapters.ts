import type { NormalizedPropertyInput } from '@/lib/property-intelligence/types'

export type ProviderComplianceStatus = 'public' | 'user_provided' | 'licensed' | 'manual_review' | 'blocked'

export type PropertyProviderResult = {
  providerKey: string
  sourceType: string
  complianceStatus: ProviderComplianceStatus
  confidenceScore: number
  rawPayload: Record<string, unknown>
  normalized: NormalizedPropertyInput
}

export type PropertyProviderAdapter = {
  key: string
  label: string
  riskyByDefault?: boolean
  isConfigured(): boolean
  normalize(input: Record<string, unknown>): PropertyProviderResult
}

export const providerAdapterKeys = [
  'dealmachine',
  'county_parcel_csv',
  'county_tax_delinquency',
  'city_code_violation',
  'public_assessor',
  'public_gis_geojson',
  'openstreetmap_overpass',
  'future_attom',
  'future_propstream',
  'future_skiptrace',
  'spiderfoot',
  'theharvester',
  'maigret',
  'sherlock',
  'holehe',
  'phoneinfoga',
  'firecrawl',
  'scrapy_permitted',
] as const

export type ProviderAdapterKey = (typeof providerAdapterKeys)[number]

export const futureProviderStubs: Record<ProviderAdapterKey, { label: string; status: 'implemented' | 'stub'; note: string }> = {
  dealmachine: { label: 'DealMachine API', status: 'implemented', note: 'Manual admin sync adapter with env API key and rate-limit/error logging hooks.' },
  county_parcel_csv: { label: 'County parcel CSV', status: 'implemented', note: 'Handled by CSV importer and field aliases.' },
  county_tax_delinquency: { label: 'County tax delinquency', status: 'implemented', note: 'Handled by CSV importer and signal detection.' },
  city_code_violation: { label: 'City code violation', status: 'implemented', note: 'Handled by CSV importer and signal detection.' },
  public_assessor: { label: 'Public assessor data', status: 'implemented', note: 'Handled by public CSV/GeoJSON imports.' },
  public_gis_geojson: { label: 'Public GIS/GeoJSON', status: 'implemented', note: 'Handled by GeoJSON importer and parcel geometry storage.' },
  openstreetmap_overpass: { label: 'OpenStreetMap / Overpass', status: 'implemented', note: 'Manual enrichment adapter; external calls feature-flagged.' },
  future_attom: { label: 'ATTOM API', status: 'stub', note: 'Add licensed provider credentials and mapping without changing core records.' },
  future_propstream: { label: 'PropStream-style provider', status: 'stub', note: 'Add licensed provider adapter behind the same normalized interface.' },
  future_skiptrace: { label: 'Future skip-trace provider', status: 'stub', note: 'Only store legally usable user-approved or licensed contacts.' },
  spiderfoot: { label: 'SpiderFoot', status: 'stub', note: 'Manual-only OSINT adapter.' },
  theharvester: { label: 'theHarvester', status: 'stub', note: 'Manual-only business/domain contact discovery.' },
  maigret: { label: 'Maigret', status: 'stub', note: 'Manual-only username/profile verification.' },
  sherlock: { label: 'Sherlock', status: 'stub', note: 'Manual-only username/profile verification.' },
  holehe: { label: 'Holehe', status: 'stub', note: 'Manual-only email account checks with compliance approval.' },
  phoneinfoga: { label: 'PhoneInfoga', status: 'stub', note: 'Manual-only phone metadata review.' },
  firecrawl: { label: 'Firecrawl', status: 'stub', note: 'Only permitted public pages, robots/TOS respected.' },
  scrapy_permitted: { label: 'Scrapy permitted crawlers', status: 'stub', note: 'Only public permitted crawlers, no captcha/login bypass.' },
}
