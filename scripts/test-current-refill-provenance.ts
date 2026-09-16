import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getLeadOutboundPauseReason } from '@/lib/leads/outboundEligibility'
import {
  buildCurrentEmailReadyRefillProvenance,
  CURRENT_EMAIL_REFILL_METADATA_KEY,
  hasValidCurrentEmailReadyRefillProvenance,
  type CurrentEmailRefillProvider,
} from '@/lib/leads/refillProvenance'
import {
  persistCurrentEmailReadyRefillProvenanceWithStore,
  type CurrentEmailReadyRefillProvenanceStore,
} from '@/lib/leads/refillProvenancePersistence'
import type { LeadRecord } from '@/lib/leads/types'

const previousSigningSecret = process.env.LEADS_REFILL_PROVENANCE_SECRET
const previousLegacySmallBusiness = process.env.LEADS_ALLOW_LEGACY_SMALL_BUSINESS_OUTBOUND
const previousLegacyGoogle = process.env.LEADS_ALLOW_LEGACY_GOOGLE_PLACES

process.env.LEADS_REFILL_PROVENANCE_SECRET = 'focused-test-current-refill-signing-secret'
delete process.env.LEADS_ALLOW_LEGACY_SMALL_BUSINESS_OUTBOUND
delete process.env.LEADS_ALLOW_LEGACY_GOOGLE_PLACES

const issuedAt = new Date()
const baseLead = {
  id: 'lead-outscraper-canonical-1',
  source: 'outscraper_google_maps_businesses',
  email: 'owner@northstarbuilders.com',
  email_valid: true,
  lead_type: 'business_funding',
  metadata_json: {
    marketExpansion: true,
  } as Record<string, unknown>,
}

function signedLead<T extends typeof baseLead>(
  lead: T,
  provider: CurrentEmailRefillProvider,
  markerIssuedAt = issuedAt
) {
  const marker = buildCurrentEmailReadyRefillProvenance(lead, {
    provider,
    issuedAt: markerIssuedAt,
  })
  assert.ok(marker, 'an email-ready canonical approved-source row should produce a marker')
  return {
    ...lead,
    metadata_json: {
      ...(lead.metadata_json || {}),
      [CURRENT_EMAIL_REFILL_METADATA_KEY]: marker,
    },
  }
}

function canonicalLead(input: {
  id: string
  source: string
  email?: string
  metadata?: Record<string, unknown>
  updatedAt?: string
}) {
  return {
    ...baseLead,
    id: input.id,
    source: input.source,
    email: input.email || baseLead.email,
    metadata_json: input.metadata || { marketExpansion: true },
    updated_at: input.updatedAt || '2026-09-16T18:00:00.000Z',
  } as unknown as LeadRecord
}

function inMemoryProvenanceStore(initial: LeadRecord, onConflict?: (row: LeadRecord) => LeadRecord) {
  let row = structuredClone(initial)
  let compareAndSwapCalls = 0
  let forceConflict = Boolean(onConflict)
  const store: CurrentEmailReadyRefillProvenanceStore = {
    compareAndSwap: async ({ currentLead, metadataJson, updatedAt }) => {
      compareAndSwapCalls += 1
      if (forceConflict) {
        forceConflict = false
        row = onConflict?.(structuredClone(row)) || row
        return { updated: null, error: null }
      }
      if (
        currentLead.id !== row.id ||
        currentLead.source !== row.source ||
        currentLead.email !== row.email ||
        currentLead.updated_at !== row.updated_at
      ) return { updated: null, error: null }
      row = { ...row, metadata_json: metadataJson, updated_at: updatedAt }
      return { updated: structuredClone(row), error: null }
    },
    readById: async (leadId) => ({
      lead: leadId === row.id ? structuredClone(row) : null,
      error: null,
    }),
  }
  return {
    store,
    get row() { return structuredClone(row) },
    get compareAndSwapCalls() { return compareAndSwapCalls },
  }
}

async function main() {
try {
  const markedOutscraperLead = signedLead(baseLead, 'outscraper')
  const outscraperMarker = markedOutscraperLead.metadata_json[CURRENT_EMAIL_REFILL_METADATA_KEY] as Record<string, unknown>

  assert.deepEqual(
    {
      version: outscraperMarker.version,
      provider: outscraperMarker.provider,
      issuedAt: outscraperMarker.issuedAt,
      leadId: outscraperMarker.leadId,
      source: outscraperMarker.source,
    },
    {
      version: 2,
      provider: 'outscraper',
      issuedAt: issuedAt.toISOString(),
      leadId: baseLead.id,
      source: baseLead.source,
    },
    'the server marker must bind its version, provider, issuance time and canonical row identity'
  )
  assert.equal(getLeadOutboundPauseReason(markedOutscraperLead), null)

  const apifyDiscoveryMergedIntoOutscraper = signedLead(
    { ...baseLead, id: 'lead-cross-provider-apify-to-outscraper' },
    'apify'
  )
  assert.equal(
    getLeadOutboundPauseReason(apifyDiscoveryMergedIntoOutscraper),
    null,
    'a fresh Apify discovery deduped into a canonical Outscraper row must remain eligible'
  )

  const outscraperDiscoveryMergedIntoApify = signedLead(
    {
      ...baseLead,
      id: 'lead-cross-provider-outscraper-to-apify',
      source: 'apify_yelp_businesses',
    },
    'outscraper'
  )
  assert.equal(
    getLeadOutboundPauseReason(outscraperDiscoveryMergedIntoApify),
    null,
    'a fresh Outscraper discovery deduped into a canonical Apify row must remain eligible'
  )

  for (const scenario of [
    {
      label: 'Apify discovery into canonical Outscraper row',
      provider: 'apify' as const,
      canonicalSource: 'outscraper_google_maps_businesses',
    },
    {
      label: 'Outscraper discovery into canonical Apify row',
      provider: 'outscraper' as const,
      canonicalSource: 'apify_yelp_businesses',
    },
  ]) {
    const savedByFakeUpsert = canonicalLead({
      id: `fake-upsert-${scenario.provider}`,
      source: scenario.canonicalSource,
      metadata: { preexisting: scenario.label },
    })
    const fakeStore = inMemoryProvenanceStore(savedByFakeUpsert)
    const persisted = await persistCurrentEmailReadyRefillProvenanceWithStore({
      lead: savedByFakeUpsert,
      provider: scenario.provider,
      issuedAt,
      store: fakeStore.store,
    })
    assert.equal(
      hasValidCurrentEmailReadyRefillProvenance(persisted, issuedAt.getTime()),
      true,
      `${scenario.label} must sign the canonical saved identity after fake upsert`
    )
    const persistedMarker = persisted.metadata_json[CURRENT_EMAIL_REFILL_METADATA_KEY] as Record<string, unknown>
    assert.equal(persistedMarker.provider, scenario.provider)
    assert.equal(persistedMarker.source, scenario.canonicalSource)
    assert.equal(persisted.metadata_json.preexisting, scenario.label)
  }

  const conflictLead = canonicalLead({
    id: 'lead-cas-conflict',
    source: 'outscraper_google_maps_businesses',
    metadata: { original: true },
  })
  const conflictStore = inMemoryProvenanceStore(conflictLead, (row) => ({
    ...row,
    metadata_json: { ...row.metadata_json, concurrentWriter: 'preserved' },
    updated_at: '2026-09-16T18:00:01.000Z',
  }))
  const conflictPersisted = await persistCurrentEmailReadyRefillProvenanceWithStore({
    lead: conflictLead,
    provider: 'outscraper',
    issuedAt,
    store: conflictStore.store,
  })
  assert.equal(conflictStore.compareAndSwapCalls, 2, 'a first CAS conflict must retry once')
  assert.equal(conflictPersisted.metadata_json.concurrentWriter, 'preserved')
  assert.equal(hasValidCurrentEmailReadyRefillProvenance(conflictPersisted, issuedAt.getTime()), true)

  const bindingLead = canonicalLead({
    id: 'lead-binding-change',
    source: 'apify_yelp_businesses',
  })
  const bindingStore = inMemoryProvenanceStore(bindingLead, (row) => ({
    ...row,
    email: 'changed-owner@example.test',
    updated_at: '2026-09-16T18:00:01.000Z',
  }))
  const bindingResult = await persistCurrentEmailReadyRefillProvenanceWithStore({
    lead: bindingLead,
    provider: 'outscraper',
    issuedAt,
    store: bindingStore.store,
  })
  assert.equal(bindingStore.compareAndSwapCalls, 1, 'a recipient binding change must abort before another write')
  assert.equal(bindingResult.email, 'changed-owner@example.test')
  assert.equal(bindingResult.metadata_json[CURRENT_EMAIL_REFILL_METADATA_KEY], undefined)

  const exhaustedLead = canonicalLead({
    id: 'lead-cas-exhausted',
    source: 'outscraper_google_maps_businesses',
  })
  let exhaustedRow = structuredClone(exhaustedLead)
  let exhaustionCasCalls = 0
  const exhaustionStore: CurrentEmailReadyRefillProvenanceStore = {
    compareAndSwap: async () => {
      exhaustionCasCalls += 1
      exhaustedRow = {
        ...exhaustedRow,
        metadata_json: { ...exhaustedRow.metadata_json, [`conflict${exhaustionCasCalls}`]: true },
        updated_at: new Date(Date.parse(exhaustedRow.updated_at) + 1_000).toISOString(),
      }
      return { updated: null, error: null }
    },
    readById: async () => ({ lead: structuredClone(exhaustedRow), error: null }),
  }
  await assert.rejects(
    persistCurrentEmailReadyRefillProvenanceWithStore({
      lead: exhaustedLead,
      provider: 'outscraper',
      issuedAt,
      store: exhaustionStore,
    }),
    /could not be persisted after concurrent lead updates/
  )
  assert.equal(exhaustionCasCalls, 3, 'CAS retries must remain bounded')

  assert.equal(
    getLeadOutboundPauseReason(baseLead),
    'legacy_small_business_source_paused',
    'an unmarked legacy backlog row must remain paused'
  )

  const invalidSignatureMetadata = structuredClone(markedOutscraperLead.metadata_json)
  const invalidSignatureMarker = invalidSignatureMetadata[CURRENT_EMAIL_REFILL_METADATA_KEY] as Record<string, unknown>
  invalidSignatureMarker.signature = `${String(invalidSignatureMarker.signature)}tampered`
  assert.equal(
    getLeadOutboundPauseReason({ ...markedOutscraperLead, metadata_json: invalidSignatureMetadata }),
    'legacy_small_business_source_paused',
    'an invalid signature must not unlock a legacy row'
  )

  for (const [field, value] of [
    ['provider', 'apify'],
    ['issuedAt', new Date(issuedAt.getTime() + 1_000).toISOString()],
    ['sourceFamily', 'apify_yelp_businesses'],
  ] as const) {
    const tamperedMetadata = structuredClone(markedOutscraperLead.metadata_json)
    const tamperedMarker = tamperedMetadata[CURRENT_EMAIL_REFILL_METADATA_KEY] as Record<string, unknown>
    tamperedMarker[field] = value
    assert.equal(
      hasValidCurrentEmailReadyRefillProvenance({
        ...markedOutscraperLead,
        metadata_json: tamperedMetadata,
      }),
      false,
      `tampering with signed marker field ${field} must invalidate provenance`
    )
  }

  assert.equal(
    hasValidCurrentEmailReadyRefillProvenance({
      ...markedOutscraperLead,
      id: 'different-canonical-lead-id',
    }),
    false,
    'a signed marker replayed to another canonical row must fail even when source and email match'
  )

  assert.equal(
    getLeadOutboundPauseReason({
      ...markedOutscraperLead,
      email: 'different.owner@northstarbuilders.com',
    }),
    'legacy_small_business_source_paused',
    'a signed marker copied to a different recipient must not unlock that row'
  )
  assert.equal(
    hasValidCurrentEmailReadyRefillProvenance({
      ...markedOutscraperLead,
      source: `${markedOutscraperLead.source}__different-scope`,
    }),
    false,
    'the signature must bind the exact canonical source, not only its family'
  )

  const oldLead = signedLead(
    { ...baseLead, id: 'lead-expired-marker' },
    'outscraper',
    new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  )
  assert.equal(
    getLeadOutboundPauseReason(oldLead),
    'legacy_small_business_source_paused',
    'an expired refill marker must not unlock old backlog'
  )

  assert.equal(
    buildCurrentEmailReadyRefillProvenance(
      { ...baseLead, id: 'lead-google', source: 'google_places_businesses' },
      { provider: 'outscraper', issuedAt }
    ),
    null,
    'a canonical Google Places row must never receive the approved-provider exception'
  )
  assert.equal(
    getLeadOutboundPauseReason({
      ...markedOutscraperLead,
      id: 'lead-google-copy',
      source: 'google_places_businesses',
    }),
    'legacy_google_places_paused',
    'a marker copied onto a Google Places row must not bypass the phase-out'
  )

  assert.equal(
    buildCurrentEmailReadyRefillProvenance(
      { ...baseLead, id: 'lead-other-source', source: 'weak_web_presence_businesses' },
      { provider: 'apify', issuedAt }
    ),
    null,
    'other legacy source families must remain outside the refill exception'
  )

  assert.equal(
    buildCurrentEmailReadyRefillProvenance(
      { ...baseLead, id: 'lead-no-email', email: null, email_valid: null },
      { provider: 'outscraper', issuedAt }
    ),
    null,
    'a row without a usable email must not receive the exception marker'
  )

  const serviceRuntime = readFileSync(resolve(process.cwd(), 'lib/leads/service.ts'), 'utf8')
  assert.ok(
    serviceRuntime.indexOf('let lead = await upsertLead(input)') <
      serviceRuntime.indexOf('lead = await persistCurrentEmailReadyRefillProvenance({'),
    'provenance must be signed and persisted only after canonical dedupe/upsert'
  )
  const dailyRuntime = readFileSync(resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'), 'utf8')
  assert.doesNotMatch(dailyRuntime, /markCurrentEmailReadyRefillLead/)
  assert.match(dailyRuntime, /currentEmailReadyRefillProvider:/)

  console.log('Current refill provenance tests passed.')
} finally {
  if (previousSigningSecret === undefined) delete process.env.LEADS_REFILL_PROVENANCE_SECRET
  else process.env.LEADS_REFILL_PROVENANCE_SECRET = previousSigningSecret

  if (previousLegacySmallBusiness === undefined) delete process.env.LEADS_ALLOW_LEGACY_SMALL_BUSINESS_OUTBOUND
  else process.env.LEADS_ALLOW_LEGACY_SMALL_BUSINESS_OUTBOUND = previousLegacySmallBusiness

  if (previousLegacyGoogle === undefined) delete process.env.LEADS_ALLOW_LEGACY_GOOGLE_PLACES
  else process.env.LEADS_ALLOW_LEGACY_GOOGLE_PLACES = previousLegacyGoogle
}
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
