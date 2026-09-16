import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  canonicalPropertyKey,
  isSameParcelIdentity,
  mergePropertyRawFields,
  mergedOwnerEntityPayload,
  missingPropertySignals,
  normalizeParcelToken,
  normalizedInputFromStoredProperty,
  type PropertySourceEvidence,
} from '@/lib/property-intelligence/identity'
import { cleanupPartialPropertyImport } from '@/lib/property-intelligence/importCleanup'
import { detectVacantLot, scoreDeal } from '@/lib/property-intelligence/scoring'
import { generateSafeOutreachSummary } from '@/lib/property-intelligence/outreach'
import { buildAttomSignals, finalizeAttomFacts, type AttomPropertyFacts, type AttomStrategyRoute } from '@/lib/property-intelligence/attom-strategy'
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

function importFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Property intelligence import failed.')
  return message.slice(0, 2000)
}

function missingIdentityColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  return Boolean(error && (
    error.code === '42703' ||
    /canonical_property_key|normalized_parcel_id/i.test(error.message || '')
  ))
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

function hasOwnerDetails(input: NormalizedPropertyInput) {
  return Boolean(
    nullIfBlank(input.ownerName) ||
    nullIfBlank(input.mailingAddress) ||
    nullIfBlank(input.mailingCity) ||
    nullIfBlank(input.mailingState) ||
    nullIfBlank(input.mailingZip)
  )
}

async function findDuplicateProperty(input: NormalizedPropertyInput) {
  const admin = createAdminClient()
  const canonicalKey = canonicalPropertyKey(input)
  if (canonicalKey) {
    const { data, error } = await admin
      .from('property_intelligence_records')
      .select('*')
      .eq('canonical_property_key', canonicalKey)
      .limit(1)
      .maybeSingle()
    if (error && !missingIdentityColumn(error)) throw error
    if (data?.id) return data
  }

  const normalizedParcelId = normalizeParcelToken(input.parcelId)
  const state = nullIfBlank(input.state)?.toUpperCase()
  if (normalizedParcelId && state) {
    const normalizedQuery = await admin
      .from('property_intelligence_records')
      .select('*')
      .eq('state', state)
      .eq('normalized_parcel_id', normalizedParcelId)
      .limit(50)
    let data = normalizedQuery.data
    if (normalizedQuery.error) {
      if (!missingIdentityColumn(normalizedQuery.error)) throw normalizedQuery.error
      const legacyQuery = await admin
        .from('property_intelligence_records')
        .select('*')
        .eq('state', state)
        .eq('parcel_id', input.parcelId)
        .limit(50)
      if (legacyQuery.error) throw legacyQuery.error
      data = legacyQuery.data
    }
    const duplicate = (data || []).find((row: any) => isSameParcelIdentity(row, input))
    if (duplicate?.id) return duplicate
  }

  const address = nullIfBlank(input.propertyAddress)
  const city = nullIfBlank(input.city)
  if (!address || !city || !state) return null

  const { data, error } = await admin
    .from('property_intelligence_records')
    .select('*')
    .ilike('property_address', address)
    .ilike('city', city)
    .eq('state', state)
    .limit(5)
  if (error) throw error

  const key = canonicalPropertyKey({ ...input, parcelId: null })
  return (data || []).find((row: any) => canonicalPropertyKey({
    parcelId: null,
    propertyAddress: row.property_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    county: row.county,
  }) === key) || null
}

function buildSourceEvidence(input: NormalizedPropertyInput, sourceId: string, importId: string, observedAt: string): PropertySourceEvidence {
  return {
    sourceName: input.sourceName,
    sourceUrl: nullIfBlank(input.sourceUrl),
    fileName: nullIfBlank(input.fileName),
    sourceId,
    importId,
    observedAt,
    fields: input.rawFields,
  }
}

async function attachPropertySourceEvidence(
  admin: ReturnType<typeof createAdminClient>,
  propertyId: string,
  evidence: PropertySourceEvidence,
) {
  const evidenceKey = createHash('sha256')
    .update([evidence.sourceName, evidence.sourceUrl, evidence.fileName].map((value) => String(value || '').trim().toLowerCase()).join('|'))
    .digest('hex')
  const { error } = await admin.from('property_intelligence_record_sources').upsert({
    property_intelligence_record_id: propertyId,
    source_id: evidence.sourceId,
    import_id: evidence.importId,
    source_name: evidence.sourceName,
    source_url: evidence.sourceUrl,
    file_name: evidence.fileName,
    evidence_key: evidenceKey,
    observed_at: evidence.observedAt,
    raw_fields: evidence.fields,
    updated_at: evidence.observedAt,
  }, {
    onConflict: 'property_intelligence_record_id,evidence_key',
  })
  if (error && error.code !== '42P01' && !/property_intelligence_record_sources|schema cache/i.test(error.message || '')) throw error
}

function propertyPayload(input: NormalizedPropertyInput, sourceId: string, importId: string, ownerEntityId: string, observedAt: string) {
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
    raw_fields: mergePropertyRawFields({}, input.rawFields, buildSourceEvidence(input, sourceId, importId, observedAt)),
    updated_at: observedAt,
  }
}

function preferStored<T>(stored: T | null | undefined, incoming: T | null | undefined) {
  if (stored !== null && stored !== undefined && String(stored).trim() !== '') return stored
  return incoming ?? null
}

function mergedDuplicatePayload(
  existing: Record<string, any>,
  input: NormalizedPropertyInput,
  sourceId: string,
  importId: string,
  observedAt: string,
  ownerEntityId?: string | null,
) {
  const vacant = detectVacantLot(input)
  return {
    owner_entity_id: ownerEntityId || existing.owner_entity_id || null,
    parcel_id: preferStored(existing.parcel_id, nullIfBlank(input.parcelId)),
    property_address: preferStored(existing.property_address, nullIfBlank(input.propertyAddress)),
    city: preferStored(existing.city, nullIfBlank(input.city)),
    state: preferStored(existing.state, nullIfBlank(input.state)?.toUpperCase() || null),
    zip_code: preferStored(existing.zip_code, nullIfBlank(input.zipCode)),
    county: preferStored(existing.county, nullIfBlank(input.county)),
    latitude: preferStored(existing.latitude, input.latitude),
    longitude: preferStored(existing.longitude, input.longitude),
    land_use: preferStored(existing.land_use, nullIfBlank(input.landUse)),
    property_class: preferStored(existing.property_class, nullIfBlank(input.propertyClass)),
    assessed_value: preferStored(existing.assessed_value, input.assessedValue),
    land_value: preferStored(existing.land_value, input.landValue),
    building_value: preferStored(existing.building_value, input.buildingValue),
    improvement_value: preferStored(existing.improvement_value, input.improvementValue),
    structure_sqft: preferStored(existing.structure_sqft, input.structureSqft),
    lot_sqft: preferStored(existing.lot_sqft, input.lotSqft),
    year_built: preferStored(existing.year_built, input.yearBuilt),
    is_vacant_lot: Boolean(existing.is_vacant_lot || vacant.isVacantLot),
    vacant_lot_confidence: Math.max(Number(existing.vacant_lot_confidence || 0), vacant.confidence),
    raw_fields: mergePropertyRawFields(
      existing.raw_fields,
      input.rawFields,
      buildSourceEvidence(input, sourceId, importId, observedAt),
    ),
    updated_at: observedAt,
  }
}

async function mergeDuplicateOwner(
  admin: ReturnType<typeof createAdminClient>,
  property: Record<string, any>,
  input: NormalizedPropertyInput,
) {
  if (!hasOwnerDetails(input)) return property.owner_entity_id || null

  if (property.owner_entity_id) {
    const { data: existingOwner, error: ownerReadError } = await admin
      .from('owner_entities')
      .select('*')
      .eq('id', property.owner_entity_id)
      .maybeSingle()
    if (ownerReadError) throw ownerReadError
    if (existingOwner?.id) {
      const { error: ownerUpdateError } = await admin
        .from('owner_entities')
        .update(mergedOwnerEntityPayload(existingOwner, input))
        .eq('id', existingOwner.id)
      if (ownerUpdateError) throw ownerUpdateError
      return existingOwner.id as string
    }
  }

  const { data: owner, error: ownerInsertError } = await admin
    .from('owner_entities')
    .insert(ownerPayload(input))
    .select('id')
    .single()
  if (ownerInsertError) throw ownerInsertError
  return owner.id as string
}

async function mergeDuplicateProperty(input: {
  property: Record<string, any>
  row: ImportPreviewRow
  sourceId: string
  importId: string
  observedAt: string
}) {
  const admin = createAdminClient()
  const { property, row } = input
  const evidence = buildSourceEvidence(row.input, input.sourceId, input.importId, input.observedAt)
  const ownerEntityId = await mergeDuplicateOwner(admin, property, row.input)
  const { data: storedSignals, error: storedSignalsError } = await admin
    .from('property_signals')
    .select('signal_type,signal_label,signal_value,confidence_score,source_name,source_url,raw_fields')
    .eq('property_intelligence_record_id', property.id)
  if (storedSignalsError) throw storedSignalsError

  const newSignals = missingPropertySignals(storedSignals || [], row.signals)
  const mergedProperty = mergedDuplicatePayload(
    property,
    row.input,
    input.sourceId,
    input.importId,
    input.observedAt,
    ownerEntityId,
  )
  const { error: updateError } = await admin
    .from('property_intelligence_records')
    .update(mergedProperty)
    .eq('id', property.id)
  if (updateError) throw updateError
  await attachPropertySourceEvidence(admin, property.id, evidence)

  if (newSignals.length) {
    const { error: signalError } = await admin.from('property_signals').insert(
      newSignals.map((signal) => ({
        property_intelligence_record_id: property.id,
        signal_type: signal.signal_type,
        signal_label: signal.signal_label,
        signal_value: signal.signal_value || null,
        confidence_score: signal.confidence_score,
        source_name: signal.source_name || row.input.sourceName,
        source_url: signal.source_url || row.input.sourceUrl || null,
        raw_fields: signal.raw_fields || row.input.rawFields,
      })),
    )
    if (signalError) throw signalError
  }

  const combinedSignals = [...(storedSignals || []), ...newSignals]
  const updatedScore = scoreDeal(normalizedInputFromStoredProperty(mergedProperty, row.input), combinedSignals)
  const { data: currentScore, error: currentScoreError } = await admin
    .from('deal_scores')
    .select('score,reason_codes,scoring_version')
    .eq('property_intelligence_record_id', property.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (currentScoreError) throw currentScoreError
  const priorReasons = Array.isArray(currentScore?.reason_codes) ? [...currentScore.reason_codes].sort().join('|') : ''
  const nextReasons = [...updatedScore.reason_codes].sort().join('|')
  if (!currentScore || currentScore.score !== updatedScore.score || priorReasons !== nextReasons || currentScore.scoring_version !== updatedScore.scoring_version) {
    const { error: scoreError } = await admin.from('deal_scores').insert({
      property_intelligence_record_id: property.id,
      score: updatedScore.score,
      reason_codes: updatedScore.reason_codes,
      explanation: updatedScore.explanation,
      recommended_next_action: updatedScore.recommended_next_action,
      scoring_version: updatedScore.scoring_version || 'phase1-v1',
    })
    if (scoreError) throw scoreError
  }

  return { signalsCreated: newSignals.length }
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
  let merged = 0
  let signalsCreated = 0
  const scoreCounts = { high: 0, medium: 0, low: 0 }

  try {
    for (const row of rows) {
      const duplicate = await findDuplicateProperty(row.input)
      if (duplicate?.id) {
        deduped += 1
        const mergeResult = await mergeDuplicateProperty({
          property: duplicate,
          row,
          sourceId: source.id,
          importId: importRun.id,
          observedAt: new Date().toISOString(),
        })
        merged += 1
        signalsCreated += mergeResult.signalsCreated
        continue
      }

      let ownerId: string | null = null
      let propertyId: string | null = null
      try {
        const owner = ownerPayload(row.input)
        const { data: ownerRecord, error: ownerError } = await admin.from('owner_entities').insert(owner).select('id').single()
        if (ownerError) throw ownerError
        ownerId = ownerRecord.id

        const { data: property, error: propertyError } = await admin
          .from('property_intelligence_records')
          .insert(propertyPayload(row.input, source.id, importRun.id, ownerRecord.id, new Date().toISOString()))
          .select('id')
          .single()
        if (propertyError) throw propertyError
        propertyId = property.id
        await attachPropertySourceEvidence(
          admin,
          property.id,
          buildSourceEvidence(row.input, source.id, importRun.id, new Date().toISOString()),
        )

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
      } catch (rowError) {
        try {
          await cleanupPartialPropertyImport(admin, { propertyId, ownerId })
        } catch (cleanupError) {
          throw new Error(`${importFailureMessage(rowError)} Cleanup failed: ${importFailureMessage(cleanupError)}`)
        }
        throw rowError
      }

      imported += 1
      signalsCreated += row.signals.length
      if (row.dealScore.score >= 75) scoreCounts.high += 1
      else if (row.dealScore.score >= 55) scoreCounts.medium += 1
      else scoreCounts.low += 1
    }

    const { error: completionError } = await admin
      .from('property_intelligence_imports')
      .update({
        import_status: 'completed',
        records_created: imported,
        records_deduped: deduped,
      })
      .eq('id', importRun.id)
    if (completionError) throw completionError
  } catch (error) {
    const { error: failureUpdateError } = await admin
      .from('property_intelligence_imports')
      .update({
        import_status: 'failed',
        records_created: imported,
        records_deduped: deduped,
        error_message: importFailureMessage(error),
      })
      .eq('id', importRun.id)
    if (failureUpdateError) {
      throw new Error(`${importFailureMessage(error)} Failed to record import failure: ${importFailureMessage(failureUpdateError)}`)
    }
    throw error
  }

  return { imported, deduped, merged, signalsCreated, dataSourceId: source.id as string, importId: importRun.id as string, scoreCounts }
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
  if (error) {
    if (/property_intelligence_records|schema cache|could not find the table/i.test(error.message)) {
      return listAttomLeadFallback(filters)
    }
    throw error
  }

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

/**
 * Small, privacy-safe public summary. The operator query above intentionally
 * remains richer; this avoids joining owner records and unbounded signal sets
 * on an unauthenticated page.
 */
export async function listPublicPropertyOpportunities(limit = 24) {
  const admin = createAdminClient()
  const cappedLimit = Math.max(1, Math.min(limit, 50))
  const { data: scoreRows, error: scoreError } = await admin
    .from('deal_scores')
    .select('property_intelligence_record_id,score,reason_codes,explanation,recommended_next_action')
    .gte('score', 55)
    .order('score', { ascending: false })
    .limit(cappedLimit)

  if (scoreError) throw scoreError
  const ids = Array.from(new Set((scoreRows || []).map((row) => row.property_intelligence_record_id).filter(Boolean)))
  if (!ids.length) return { properties: [], summary: summarizeProperties([]) }

  const [{ data: records, error: recordsError }, { data: signals, error: signalsError }] = await Promise.all([
    admin.from('property_intelligence_records')
      .select('id,city,state,latitude,longitude,is_vacant_lot,vacant_lot_confidence')
      .in('id', ids),
    admin.from('property_signals')
      .select('property_intelligence_record_id,signal_type,signal_label,confidence_score')
      .in('property_intelligence_record_id', ids)
      .order('confidence_score', { ascending: false })
      .limit(cappedLimit * 3),
  ])

  if (recordsError) throw recordsError
  if (signalsError) throw signalsError

  const recordById = new Map((records || []).map((record) => [record.id, record]))
  const signalsById = new Map<string, typeof signals>()
  for (const signal of signals || []) {
    const values = signalsById.get(signal.property_intelligence_record_id) || []
    if (values.length < 3) values.push(signal)
    signalsById.set(signal.property_intelligence_record_id, values)
  }

  const properties = (scoreRows || []).flatMap((score, index) => {
    const record = recordById.get(score.property_intelligence_record_id)
    if (!record) return []
    return [{
      id: `public-opportunity-${index + 1}`,
      property_address: 'Property opportunity',
      city: record.city,
      state: record.state,
      zip_code: null,
      latitude: typeof record.latitude === 'number' ? Number(record.latitude.toFixed(2)) : null,
      longitude: typeof record.longitude === 'number' ? Number(record.longitude.toFixed(2)) : null,
      is_vacant_lot: record.is_vacant_lot,
      vacant_lot_confidence: record.vacant_lot_confidence,
      owner_entities: null,
      property_signals: (signalsById.get(record.id) || []).map((signal) => ({
        signal_type: signal.signal_type,
        signal_label: signal.signal_label,
        confidence_score: signal.confidence_score,
      })),
      deal_scores: [{
        score: score.score,
        reason_codes: score.reason_codes,
        explanation: score.explanation,
        recommended_next_action: score.recommended_next_action,
      }],
    } as PropertyIntelligenceRecord]
  })

  return { properties, summary: summarizeProperties(properties) }
}

async function listAttomLeadFallback(filters: PropertyIntelligenceFilters) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('id,name,property_address,city,state,zip,source,metadata_json,created_at')
    .not('property_address', 'is', null)
    .or('category.eq.seller_lead,lead_type.eq.sell_house')
    .order('created_at', { ascending: false })
    .limit(Math.max(filters.limit || 250, 500))
  if (error) throw error

  let properties = (data || []).flatMap((lead: any) => {
    const cache = lead.metadata_json?.attom
    if (!cache?.facts || cache.version !== 'attom-v1') return []
    const facts = finalizeAttomFacts(cache.facts as Partial<AttomPropertyFacts>)
    const strategies = (Array.isArray(cache.strategies) ? cache.strategies : []) as AttomStrategyRoute[]
    const primary = strategies.find((route) => !route.suppress) || strategies[0]
    const record: PropertyIntelligenceRecord = {
      id: lead.id,
      source_id: null,
      import_id: null,
      owner_entity_id: null,
      parcel_id: facts.apn,
      property_address: lead.property_address,
      city: lead.city,
      state: lead.state,
      zip_code: lead.zip,
      county: null,
      latitude: facts.latitude,
      longitude: facts.longitude,
      land_use: facts.landUse,
      property_class: facts.propertyClass || facts.propertyType,
      assessed_value: facts.assessedValue,
      land_value: facts.landValue,
      building_value: facts.improvementValue,
      improvement_value: facts.improvementValue,
      structure_sqft: facts.structureSqft,
      lot_sqft: facts.lotSizeAcres ? Math.round(facts.lotSizeAcres * 43_560) : null,
      year_built: facts.yearBuilt,
      is_vacant_lot: /land|vacant|lot|acreage/i.test(`${facts.propertyType || ''} ${facts.landUse || ''}`),
      vacant_lot_confidence: /land|vacant|lot|acreage/i.test(`${facts.propertyType || ''} ${facts.landUse || ''}`) ? 85 : 0,
      raw_fields: { lead_id: lead.id, lead_source: lead.source, attom: cache, storage: 'lead_metadata_fallback' },
      owner_entities: facts.ownerName ? {
        id: `attom-owner-${lead.id}`,
        owner_name: facts.ownerName,
        owner_type: facts.ownerType || (facts.corporateOwner ? 'entity' : 'unknown'),
        mailing_address: facts.ownerMailingAddress,
        mailing_city: null,
        mailing_state: null,
        mailing_zip: null,
        is_absentee: facts.absenteeOwner,
        is_out_of_state: false,
        is_llc: facts.corporateOwner,
      } : null,
      property_signals: buildAttomSignals(facts),
      deal_scores: [{
        score: primary?.score || 50,
        reason_codes: strategies.map((route) => route.key.toUpperCase().replaceAll('-', '_')),
        explanation: primary?.rationale?.join('; ') || 'ATTOM property facts available for review.',
        recommended_next_action: primary?.suppress
          ? 'Suppress automated outreach until the recent-sale cooldown expires.'
          : `Review ${primary?.label || 'creative-finance options'} and verify payoff, title, condition, and seller intent.`,
        scoring_version: 'attom-v1',
      }],
    }
    return [record]
  })

  if (filters.search) {
    const needle = filters.search.toLowerCase()
    properties = properties.filter((property) => `${property.property_address} ${property.city} ${property.parcel_id}`.toLowerCase().includes(needle))
  }
  if (filters.city) properties = properties.filter((property) => String(property.city || '').toLowerCase().includes(filters.city!.toLowerCase()))
  if (filters.state) properties = properties.filter((property) => String(property.state || '').toUpperCase() === filters.state!.toUpperCase())
  if (filters.zipCode) properties = properties.filter((property) => String(property.zip_code || '').startsWith(filters.zipCode!))
  if (filters.vacantOnly) properties = properties.filter((property) => property.is_vacant_lot)
  if (filters.signal && filters.signal !== 'all') properties = properties.filter((property) => property.property_signals?.some((signal) => signal.signal_type === filters.signal))
  if (typeof filters.minScore === 'number') properties = properties.filter((property) => (property.deal_scores?.[0]?.score || 0) >= filters.minScore!)
  if (typeof filters.maxScore === 'number') properties = properties.filter((property) => (property.deal_scores?.[0]?.score || 0) <= filters.maxScore!)
  if (typeof filters.minValue === 'number') properties = properties.filter((property) => (property.assessed_value || 0) >= filters.minValue!)
  if (typeof filters.maxValue === 'number') properties = properties.filter((property) => (property.assessed_value || 0) <= filters.maxValue!)
  properties = properties.slice(0, filters.limit || 250)

  return { properties, summary: summarizeProperties(properties) }
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
