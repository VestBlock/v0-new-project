export const propertySignalTypes = [
  'vacant_lot',
  'tax_delinquent',
  'city_owned',
  'code_violation',
  'probate',
  'foreclosure',
  'preforeclosure',
  'opportunity_zone',
  'absentee_owner',
  'llc_owner',
  'out_of_state_owner',
  'low_assessed_value',
  'high_land_to_building_ratio',
  'high_equity',
  'low_equity',
  'free_and_clear',
  'active_mortgage',
  'recent_sale',
  'long_term_owner',
  'corporate_owner',
] as const

export type PropertySignalType = (typeof propertySignalTypes)[number]

export type PropertyIntelligenceRecord = {
  id: string
  source_id: string | null
  import_id: string | null
  owner_entity_id: string | null
  parcel_id: string | null
  property_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  county: string | null
  latitude: number | null
  longitude: number | null
  land_use: string | null
  property_class: string | null
  assessed_value: number | null
  land_value: number | null
  building_value: number | null
  improvement_value: number | null
  structure_sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  is_vacant_lot: boolean
  vacant_lot_confidence: number
  raw_fields: Record<string, unknown>
  owner_entities?: OwnerRecord | null
  property_signals?: PropertySignalRecord[]
  deal_scores?: DealScoreRecord[]
}

export type OwnerRecord = {
  id: string
  owner_name: string
  owner_type: string
  mailing_address: string | null
  mailing_city: string | null
  mailing_state: string | null
  mailing_zip: string | null
  is_absentee: boolean
  is_out_of_state: boolean
  is_llc: boolean
}

export type PropertySignalRecord = {
  id?: string
  property_intelligence_record_id?: string
  signal_type: PropertySignalType | string
  signal_label: string
  signal_value?: string | null
  confidence_score: number
  source_name?: string | null
  source_url?: string | null
  raw_fields?: Record<string, unknown>
}

export type DealScoreRecord = {
  id?: string
  property_intelligence_record_id?: string
  score: number
  reason_codes: string[]
  explanation: string
  recommended_next_action: string
  scoring_version?: string
}

export type NormalizedPropertyInput = {
  parcelId?: string | null
  propertyAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  county?: string | null
  latitude?: number | null
  longitude?: number | null
  landUse?: string | null
  propertyClass?: string | null
  assessedValue?: number | null
  landValue?: number | null
  buildingValue?: number | null
  improvementValue?: number | null
  structureSqft?: number | null
  lotSqft?: number | null
  yearBuilt?: number | null
  ownerName?: string | null
  mailingAddress?: string | null
  mailingCity?: string | null
  mailingState?: string | null
  mailingZip?: string | null
  sourceName: string
  sourceUrl?: string | null
  fileName?: string | null
  confidenceLevel?: number
  rawFields: Record<string, unknown>
  geometry?: Record<string, unknown> | null
}

export type ImportPreviewRow = {
  input: NormalizedPropertyInput
  vacantLotConfidence: number
  vacantLotReasons: string[]
  signals: PropertySignalRecord[]
  dealScore: DealScoreRecord
}

export type PropertyIntelligenceFilters = {
  search?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  signal?: string | null
  vacantOnly?: boolean
  minScore?: number | null
  maxScore?: number | null
  minValue?: number | null
  maxValue?: number | null
  limit?: number
}
