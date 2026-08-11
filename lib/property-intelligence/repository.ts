import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePropertyAddressKey } from '@/lib/property-intelligence/address'
import { detectVacantLot } from '@/lib/property-intelligence/scoring'
import { generateSafeOutreachSummary } from '@/lib/property-intelligence/outreach'
import type {
  ImportPreviewRow,
  NormalizedPropertyInput,
  PropertyIntelligenceFilters,
  PropertyIntelligenceRecord,
} from '@/lib/property-intelligence/types'

function nullIfBlank(value?: string | null) {
  const cleaned = String(value || '').trim()
  return cleaned || null
}

function ownerPayload(input: NormalizedPropertyInput) {
  const ownerName = nullIfBlank(input.ownerName) || 'Unknown owner'
  const mailingAddress = nullIfBlank(input.mailingAddress)
  const propertyAddress = nullIfBlank(input.propertyAddress)
  const propertyState = nullIfBlank(input.state)?.toUpperCase() || null
  const mailingState = nullIfBlank(input.mailingState)?.toUpperCase() || null
  const isLlc = /\b(llc|l\.l\.c\.|inc|corp|corporation|company|co\.|holdings|trust|properties|partners|ventures|investments|capital)\b/i.test(ownerName)
  return {
    owner_name: ownerName,
    owner_type: isLlc ? 'entity' : 'unknown',
    mailing_address: mailingAddress,
    mailing_city: nullIfBlank(input.mailingCity),
    mailing_state: mailingState,
    mailing_zip: nullIfBlank(input.mailingZip),
    is_absentee: Boolean(mailingAddress && propertyAddress && mailingAddress.toLowerCase() !== propertyAddress.toLowerCase()),
    is_out_of_state: Boolean(mailingState && propertyState && mailingState !== propertyState),
    is_llc: isLlc,
    raw_fields: input.rawFields,
  }
}

async function findDuplicateProperty(input: NormalizedPropertyInput) {
  const admin = createAdminClient()
  if (input.parcelId) {
    const { data } = await admin
      .from('property_intelligence_records')
      .select('id')
      .eq('parcel_id', input.parcelId)
      .maybeSingle()
    if (data?.id) return data as { id: string }
  }

  const address = nullIfBlank(input.propertyAddress)
  const city = nullIfBlank(input.city)
  const state = nullIfBlank(input.state)?.toUpperCase()
  if (!address || !city || !state) return null

  const { data } = await admin
    .from('property_intelligence_records')
    .select('id,property_address,city,state,zip_code')
    .ilike('property_address', address)
    .ilike('city', city)
    .eq('state', state)
    .limit(5)

  const key = normalizePropertyAddressKey(input)
  return (data || []).find((row: any) => normalizePropertyAddressKey({
    propertyAddress: row.property_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
  }) === key) || null
}

function propertyPayload(input: NormalizedPropertyInput, sourceId: string, importId: string, ownerEntityId: string) {
  const vacant = detectVacantLot(input)
  return {
    source_id: sourceId,
    import_id: importId,
    owner_entity_id: ownerEntityId,
    parcel_id: nullIfBlank(input.parcelId),
    property_address: nullIfBlank(input.propertyAddress),
    city: nullIfBlank(input.city),
    state: nullIfBlank(input.state)?.toUpperCase() || null,
    zip_code: nullIfBlank(input.zipCode),
    county: nullIfBlank(input.county),
    latitude: input.latitude,
    longitude: input.longitude,
    land_use: nullIfBlank(input.landUse),
    property_class: nullIfBlank(input.propertyClass),
    assessed_value: input.assessedValue,
    land_value: input.landValue,
    building_value: input.buildingValue,
    improvement_value: input.improvementValue,
    structure_sqft: input.structureSqft,
    lot_sqft: input.lotSqft,
    year_built: input.yearBuilt,
    is_vacant_lot: vacant.isVacantLot,
    vacant_lot_confidence: vacant.confidence,
    raw_fields: input.rawFields,
    updated_at: new Date().toISOString(),
  }
}

export async function importPropertyIntelligenceRows(input: {
  rows: ImportPreviewRow[]
  sourceName: string
  sourceUrl?: string | null
  fileName?: string | null
  importedBy?: string | null
  confidenceLevel?: number
  limit?: number
}) {
  const admin = createAdminClient()
  const rows = input.rows.slice(0, input.limit || 5000)

  const { data: source, error: sourceError } = await admin
    .from('property_intelligence_sources')
    .insert({
      source_name: input.sourceName,
      source_type: input.fileName?.toLowerCase().endsWith('.geojson') ? 'geojson_upload' : 'csv_upload',
      source_url: nullIfBlank(input.sourceUrl),
      file_name: nullIfBlank(input.fileName),
      imported_by: input.importedBy || null,
      record_count: rows.length,
      confidence_level: input.confidenceLevel || 70,
    })
    .select('*')
    .single()

  if (sourceError) throw sourceError

  const { data: importRun, error: importError } = await admin
    .from('property_intelligence_imports')
    .insert({
      source_id: source.id,
      import_status: 'running',
      imported_by: input.importedBy || null,
      records_seen: rows.length,
      raw_metadata: { fileName: input.fileName, sourceUrl: input.sourceUrl },
    })
    .select('*')
    .single()

  if (importError) throw importError

  let imported = 0
  let deduped = 0
  let signalsCreated = 0
  const scoreCounts = { high: 0, medium: 0, low: 0 }

  for (const row of rows) {
    const owner = ownerPayload(row.input)
    const { data: ownerRecord, error: ownerError } = await admin.from('owner_entities').insert(owner).select('id').single()
    if (ownerError) throw ownerError

    const duplicate = await findDuplicateProperty(row.input)
    if (duplicate?.id) {
      deduped += 1
      continue
    }

    const { data: property, error: propertyError } = await admin
      .from('property_intelligence_records')
      .insert(propertyPayload(row.input, source.id, importRun.id, ownerRecord.id))
      .select('id')
      .single()
    if (propertyError) throw propertyError

    if (row.signals.length) {
      const { error: signalError } = await admin.from('property_signals').insert(
        row.signals.map((signal) => ({
          property_intelligence_record_id: property.id,
          signal_type: signal.signal_type,
          signal_label: signal.signal_label,
          signal_value: signal.signal_value || null,
          confidence_score: signal.confidence_score,
          source_name: signal.source_name || input.sourceName,
          source_url: signal.source_url || input.sourceUrl || null,
          raw_fields: signal.raw_fields || row.input.rawFields,
        }))
      )
      if (signalError) throw signalError
      signalsCreated += row.signals.length
    }

    if (row.input.geometry) {
      const { error: geometryError } = await admin.from('parcel_geometries').insert({
        property_intelligence_record_id: property.id,
        geojson: row.input.geometry,
        source_name: input.sourceName,
        confidence_score: input.confidenceLevel || 70,
      })
      if (geometryError) throw geometryError
    }

    const { error: scoreError } = await admin.from('deal_scores').insert({
      property_intelligence_record_id: property.id,
      score: row.dealScore.score,
      reason_codes: row.dealScore.reason_codes,
      explanation: row.dealScore.explanation,
      recommended_next_action: row.dealScore.recommended_next_action,
      scoring_version: row.dealScore.scoring_version || 'phase1-v1',
    })
    if (scoreError) throw scoreError

    if (row.dealScore.score >= 75) scoreCounts.high += 1
    else if (row.dealScore.score >= 55) scoreCounts.medium += 1
    else scoreCounts.low += 1
    imported += 1
  }

  await admin
    .from('property_intelligence_imports')
    .update({
      import_status: 'completed',
      records_created: imported,
      records_deduped: deduped,
    })
    .eq('id', importRun.id)

  return { imported, deduped, signalsCreated, dataSourceId: source.id as string, importId: importRun.id as string, scoreCounts }
}

export async function listPropertyIntelligence(filters: PropertyIntelligenceFilters = {}) {
  const admin = createAdminClient()
  let query = admin
    .from('property_intelligence_records')
    .select('*, owner_entities(*), property_signals(*), deal_scores(*)')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 250)

  if (filters.city) query = query.ilike('city', `%${filters.city.trim()}%`)
  if (filters.state) query = query.ilike('state', filters.state.trim().toUpperCase())
  if (filters.zipCode) query = query.ilike('zip_code', `${filters.zipCode.trim()}%`)
  if (filters.vacantOnly) query = query.eq('is_vacant_lot', true)
  if (typeof filters.minValue === 'number') query = query.gte('assessed_value', filters.minValue)
  if (typeof filters.maxValue === 'number') query = query.lte('assessed_value', filters.maxValue)
  if (filters.search) {
    const cleaned = filters.search.replace(/[,%()]/g, ' ').trim()
    if (cleaned) {
      query = query.or(`property_address.ilike.%${cleaned}%,parcel_id.ilike.%${cleaned}%,city.ilike.%${cleaned}%,zip_code.ilike.%${cleaned}%`)
    }
  }

  const { data, error } = await query
  if (error) throw error

  let properties = ((data || []) as PropertyIntelligenceRecord[]).map((property) => ({
    ...property,
    deal_scores: (property.deal_scores || []).sort((a, b) => b.score - a.score).slice(0, 1),
  }))

  if (filters.signal && filters.signal !== 'all') {
    properties = properties.filter((property) => (property.property_signals || []).some((signal) => signal.signal_type === filters.signal))
  }
  if (typeof filters.minScore === 'number') {
    properties = properties.filter((property) => (property.deal_scores?.[0]?.score || 0) >= filters.minScore!)
  }
  if (typeof filters.maxScore === 'number') {
    properties = properties.filter((property) => (property.deal_scores?.[0]?.score || 0) <= filters.maxScore!)
  }

  return {
    properties,
    summary: summarizeProperties(properties),
  }
}

export function summarizeProperties(properties: PropertyIntelligenceRecord[]) {
  const scores = properties.map((property) => property.deal_scores?.[0]?.score || 0)
  return {
    total: properties.length,
    vacantLots: properties.filter((property) => property.is_vacant_lot).length,
    highScore: scores.filter((score) => score >= 75).length,
    mediumScore: scores.filter((score) => score >= 55 && score < 75).length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    withCoordinates: properties.filter((property) => property.latitude && property.longitude).length,
  }
}

export function toExportRows(properties: PropertyIntelligenceRecord[]) {
  return properties.map((property) => {
    const outreach = generateSafeOutreachSummary(property)
    return {
      property_address: property.property_address || '',
      city: property.city || '',
      state: property.state || '',
      zip_code: property.zip_code || '',
      owner_name: property.owner_entities?.owner_name || '',
      score: property.deal_scores?.[0]?.score || 0,
      signals: (property.property_signals || []).map((signal) => signal.signal_label).join('; '),
      recommended_next_action: property.deal_scores?.[0]?.recommended_next_action || '',
      suggested_sms: outreach.suggestedSms,
      suggested_email: outreach.suggestedEmail.replace(/\n/g, '\\n'),
    }
  })
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] || {})
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')
}
