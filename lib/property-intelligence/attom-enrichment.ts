import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { LeadRecord } from '@/lib/leads/types'
import {
  AttomApiError,
  fetchAttomExpandedProfile,
  fetchAttomHomeEquity,
  getAttomConfig,
  getAttomProviderStatus,
  mergeAttomFacts,
  type AttomAddress,
  type AttomEndpointResult,
} from '@/lib/property-intelligence/attom-client'
import {
  buildAttomSignals,
  routeAttomStrategies,
  type AttomPropertyFacts,
  type AttomStrategyRoute,
} from '@/lib/property-intelligence/attom-strategy'

type AttomMode = 'equity' | 'smart' | 'full'

type AttomEndpointCache = {
  fetchedAt: string
  facts: Partial<AttomPropertyFacts>
}

type AttomLeadCache = {
  version: 'attom-v1'
  updatedAt: string
  endpoints: {
    homeEquity?: AttomEndpointCache
    expandedProfile?: AttomEndpointCache
  }
  facts: AttomPropertyFacts
  strategies: AttomStrategyRoute[]
}

export type AttomEnrichmentResult = {
  ok: boolean
  dryRun: boolean
  mode: AttomMode
  candidatesSeen: number
  selected: number
  leadsUpdated: number
  propertyRecordsUpdated: number
  successfulBillableCalls: number
  failedCalls: number
  cacheHits: number
  skipped: number
  dailyUsageBefore: number
  dailyUsageAfter: number
  dailyLimit: number
  remainingCalls: number
  circuitStatus: 'ready' | 'disabled' | 'unauthorized' | 'rate_limited' | 'budget_exhausted' | 'error'
  errors: Array<{ leadId: string; address: string; message: string; status?: number }>
  warnings: string[]
  strategyCounts: Record<string, number>
  preview: Array<{ leadId: string; address: string; priority: number; cached: boolean; source: string | null }>
}

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'unknown error')
  return 'unknown error'
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function attomCache(lead: LeadRecord): AttomLeadCache | null {
  const value = recordValue(lead.metadata_json?.attom)
  return value.version === 'attom-v1' && value.endpoints ? value as AttomLeadCache : null
}

function isFresh(fetchedAt: string | null | undefined, days: number) {
  const timestamp = fetchedAt ? Date.parse(fetchedAt) : Number.NaN
  return Number.isFinite(timestamp) && Date.now() - timestamp <= days * 24 * 60 * 60 * 1000
}

function leadSignalText(lead: LeadRecord) {
  return [
    lead.source,
    lead.status,
    lead.pain_signal,
    lead.notes,
    lead.niche,
    lead.campaign_name,
    JSON.stringify(lead.metadata_json || {}),
    JSON.stringify(lead.form_data || {}),
  ].filter(Boolean).join(' ').toLowerCase()
}

function leadPriority(lead: LeadRecord) {
  const text = leadSignalText(lead)
  let score = Math.max(0, numberValue(lead.lead_score))
  if (['replied', 'interested', 'qualified'].includes(String(lead.status || ''))) score += 100
  if (/pre.?foreclosure|foreclosure|auction|lis pendens|notice of default/.test(text)) score += 80
  if (/tax.?delinquent|tax.?lien|code.?violation|probate|estate|heir/.test(text)) score += 55
  if (/homeharvest|stale.?listing|listing/.test(text)) score += 35
  if (/absentee|out.?of.?state|landlord|portfolio|vacant/.test(text)) score += 30
  if (lead.email || lead.phone) score += 15
  if (attomCache(lead)) score -= 20
  return score
}

function normalizedAddressKey(lead: LeadRecord) {
  return [lead.property_address, lead.city, lead.state, lead.zip]
    .map((value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .filter(Boolean)
    .join('|')
}

export function leadToAttomAddress(lead: Pick<LeadRecord, 'property_address' | 'city' | 'state' | 'zip'>): AttomAddress | null {
  const fullAddress = String(lead.property_address || '').trim()
  const city = String(lead.city || '').trim()
  const state = String(lead.state || '').trim().toUpperCase()
  const zip = String(lead.zip || '').trim()
  if (!fullAddress || !city || !state) return null

  const cityIndex = fullAddress.toLowerCase().indexOf(`, ${city.toLowerCase()}`)
  const address1 = (cityIndex > 0 ? fullAddress.slice(0, cityIndex) : fullAddress.split(',')[0]).trim()
  if (!address1) return null
  return { address1, address2: `${city}, ${state}${zip ? ` ${zip}` : ''}` }
}

function sourceNeedsExpandedProfile(lead: LeadRecord) {
  return /pre.?foreclosure|foreclosure|tax.?delinquent|tax.?lien|code.?violation|probate|estate|heir|absentee|portfolio|landlord/.test(leadSignalText(lead))
}

async function loadCandidateLeads(limit: number, leadIds?: string[]) {
  const admin = createAdminClient()
  let query = admin
    .from('leads')
    .select('*')
    .not('property_address', 'is', null)
    .or('category.eq.seller_lead,lead_type.eq.sell_house')
    .not('status', 'in', '(do_not_contact,closed_lost,disqualified)')
    .order('created_at', { ascending: false })
    .limit(Math.max(100, Math.min(1000, limit * 20)))

  if (leadIds?.length) query = query.in('id', leadIds.slice(0, 100))
  const { data, error } = await query
  if (error) throw error
  return ((data || []) as LeadRecord[])
    .filter((lead) => Boolean(leadToAttomAddress(lead)))
    .sort((left, right) => leadPriority(right) - leadPriority(left))
}

async function dailyUsage() {
  const admin = createAdminClient()
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)
  const { data: providerLogs, error: providerError } = await admin
    .from('provider_sync_logs')
    .select('raw_payload')
    .eq('provider_key', 'attom')
    .gte('created_at', dayStart.toISOString())
  const { data: events, error: eventError } = await admin
    .from('command_center_events')
    .select('metadata_json')
    .eq('event_type', 'attom_enrichment_run')
    .gte('created_at', dayStart.toISOString())

  const providerUsage = providerError
    ? 0
    : (providerLogs || []).reduce((sum, row: any) => sum + numberValue(row.raw_payload?.successfulBillableCalls), 0)
  const legacyUsage = eventError
    ? 0
    : (events || []).reduce((sum, row: any) => sum + numberValue(row.metadata_json?.successfulBillableCalls), 0)
  return providerUsage + legacyUsage
}

function existingEndpoint(cache: AttomLeadCache | null, endpoint: 'homeEquity' | 'expandedProfile') {
  return cache?.endpoints?.[endpoint]
}

function contextForLead(lead: LeadRecord) {
  const asStrings = (value: unknown) => Array.isArray(value) ? value.map(String) : []
  const signals = [
    ...asStrings(lead.metadata_json?.signals),
    ...asStrings(lead.metadata_json?.attomStrategies),
  ]
  return { sourceText: leadSignalText(lead), existingSignals: signals, leadStatus: lead.status }
}

function nextLeadMetadata(lead: LeadRecord, cache: AttomLeadCache) {
  const primary = cache.strategies.find((route) => !route.suppress) || cache.strategies[0]
  const currentMetadata = recordValue(lead.metadata_json)
  return {
    ...currentMetadata,
    attom: cache,
    attomId: cache.facts.attomId,
    attomEnrichedAt: cache.updatedAt,
    attomStrategies: cache.strategies.map((route) => route.key),
    attomPrimaryStrategy: primary?.key || null,
    avmValue: cache.facts.avmValue,
    avmLow: cache.facts.avmLow,
    avmHigh: cache.facts.avmHigh,
    equityAmount: cache.facts.equityAmount,
    equityPercent: cache.facts.equityPercent,
    estimatedLoanBalance: cache.facts.estimatedLoanBalance,
    ltvPercent: cache.facts.ltvPercent,
    freeAndClear: cache.facts.freeAndClear,
    taxDelinquentYear: cache.facts.delinquentYear,
    ownerOccupied: !cache.facts.absenteeOwner,
  }
}

async function updateLeadWithAttom(lead: LeadRecord, cache: AttomLeadCache) {
  const admin = createAdminClient()
  const primary = cache.strategies.find((route) => !route.suppress) || cache.strategies[0]
  const automationFlags = recordValue(lead.automation_flags_json)
  const { error } = await admin.from('leads').update({
    metadata_json: nextLeadMetadata(lead, cache),
    automation_flags_json: {
      ...automationFlags,
      attomEnrichment: {
        status: 'completed',
        enrichedAt: cache.updatedAt,
        primaryStrategy: primary?.key || null,
        reviewOnly: Boolean(primary?.reviewOnly),
        suppress: Boolean(cache.strategies.some((route) => route.suppress)),
      },
    },
    lead_score: Math.max(numberValue(lead.lead_score), primary?.score || 0),
    estimated_value_label: cache.facts.avmValue ? `$${Math.round(cache.facts.avmValue).toLocaleString()} ATTOM AVM` : lead.estimated_value_label,
    updated_at: cache.updatedAt,
  }).eq('id', lead.id)
  if (error) throw error
}

async function getOrCreateAttomSource() {
  const admin = createAdminClient()
  const { data: existing, error: findError } = await admin
    .from('property_intelligence_sources')
    .select('id')
    .eq('source_name', 'ATTOM API')
    .limit(1)
    .maybeSingle()
  if (findError) throw findError
  if (existing?.id) return existing.id as string

  const { data, error } = await admin.from('property_intelligence_sources').insert({
    source_name: 'ATTOM API',
    source_type: 'licensed_provider',
    source_url: 'https://api.developer.attomdata.com/',
    confidence_level: 90,
    notes: 'Server-side licensed enrichment. API key is never stored in database payloads.',
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

async function upsertPropertyIntelligence(lead: LeadRecord, cache: AttomLeadCache, sourceId: string) {
  const admin = createAdminClient()
  const facts = cache.facts
  let ownerEntityId: string | null = null

  if (facts.ownerName) {
    const { data: existingOwner } = await admin
      .from('owner_entities')
      .select('id')
      .eq('owner_name', facts.ownerName)
      .limit(1)
      .maybeSingle()
    if (existingOwner?.id) ownerEntityId = existingOwner.id
    else {
      const { data: owner, error: ownerError } = await admin.from('owner_entities').insert({
        owner_name: facts.ownerName,
        owner_type: facts.corporateOwner ? 'entity' : facts.ownerType || 'unknown',
        mailing_address: facts.ownerMailingAddress,
        is_absentee: facts.absenteeOwner,
        is_out_of_state: false,
        is_llc: facts.corporateOwner,
        raw_fields: { provider: 'attom', attomId: facts.attomId },
      }).select('id').single()
      if (ownerError) throw ownerError
      ownerEntityId = owner.id
    }
  }

  const propertyPayload = {
    source_id: sourceId,
    owner_entity_id: ownerEntityId,
    existing_lead_id: lead.id,
    parcel_id: facts.apn,
    property_address: lead.property_address,
    city: lead.city,
    state: lead.state,
    zip_code: lead.zip,
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
    raw_fields: { lead_id: lead.id, lead_source: lead.source, attom: cache },
    updated_at: cache.updatedAt,
  }

  const { data: existing, error: findError } = await admin
    .from('property_intelligence_records')
    .select('id')
    .eq('existing_lead_id', lead.id)
    .limit(1)
    .maybeSingle()
  if (findError) throw findError

  let propertyId: string
  if (existing?.id) {
    const { error } = await admin.from('property_intelligence_records').update(propertyPayload).eq('id', existing.id)
    if (error) throw error
    propertyId = existing.id
  } else {
    const { data, error } = await admin.from('property_intelligence_records').insert(propertyPayload).select('id').single()
    if (error) throw error
    propertyId = data.id
  }

  await admin.from('property_signals').delete().eq('property_intelligence_record_id', propertyId).eq('source_name', 'ATTOM API')
  const signals = buildAttomSignals(facts)
  if (signals.length) {
    const { error } = await admin.from('property_signals').insert(signals.map((signal) => ({
      ...signal,
      property_intelligence_record_id: propertyId,
    })))
    if (error) throw error
  }

  const primary = cache.strategies.find((route) => !route.suppress) || cache.strategies[0]
  const { error: scoreError } = await admin.from('deal_scores').insert({
    property_intelligence_record_id: propertyId,
    score: primary?.score || 50,
    reason_codes: cache.strategies.map((route) => route.key.toUpperCase().replaceAll('-', '_')),
    explanation: primary ? primary.rationale.join('; ') : 'ATTOM property facts stored for manual review.',
    recommended_next_action: primary?.suppress
      ? 'Suppress automated outreach until the recent-sale cooldown expires.'
      : `Review ${primary?.label || 'creative-finance options'} and verify payoff, title, condition, and seller intent.`,
    scoring_version: 'attom-v1',
  })
  if (scoreError) throw scoreError
  return propertyId
}

async function logRun(result: AttomEnrichmentResult) {
  const payload = {
    dryRun: result.dryRun,
    mode: result.mode,
    successfulBillableCalls: result.successfulBillableCalls,
    failedCalls: result.failedCalls,
    cacheHits: result.cacheHits,
    dailyUsageBefore: result.dailyUsageBefore,
    dailyUsageAfter: result.dailyUsageAfter,
    strategyCounts: result.strategyCounts,
    leadsUpdated: result.leadsUpdated,
    propertyRecordsUpdated: result.propertyRecordsUpdated,
    warnings: result.warnings,
  }
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('provider_sync_logs').insert({
      provider_key: 'attom',
      sync_type: `lead_enrichment_${result.mode}`,
      status: result.ok ? 'completed' : result.circuitStatus,
      records_seen: result.candidatesSeen,
      records_imported: result.leadsUpdated,
      records_skipped: result.skipped,
      error_message: result.errors[0]?.message || null,
      raw_payload: payload,
    })
    if (error) throw error
    return
  } catch {
    // Fall through to the command-center event ledger available in older schemas.
  }

  try {
    const admin = createAdminClient()
    await admin.from('command_center_events').insert({
      event_type: 'attom_enrichment_run',
      entity_type: 'provider',
      entity_id: null,
      source: 'attom',
      title: result.dryRun ? 'ATTOM enrichment preview' : 'ATTOM enrichment completed',
      summary: `${result.leadsUpdated} leads updated with ${result.successfulBillableCalls} billable calls.`,
      priority: result.ok ? 'info' : 'warning',
      status: result.ok ? 'resolved' : 'open',
      occurred_at: new Date().toISOString(),
      metadata_json: payload,
    })
  } catch {
    // Lead metadata still contains the enrichment and endpoint cache.
  }
}

export async function runAttomLeadEnrichment(input: {
  limit?: number
  mode?: AttomMode
  dryRun?: boolean
  leadIds?: string[]
} = {}): Promise<AttomEnrichmentResult> {
  const config = getAttomConfig()
  const provider = getAttomProviderStatus()
  const mode: AttomMode = input.mode === 'full' || input.mode === 'equity' ? input.mode : 'smart'
  const limit = Math.max(1, Math.min(config.maxPropertiesPerRun, Math.round(input.limit || 10)))
  const candidates = await loadCandidateLeads(limit, input.leadIds)
  const selected = candidates.slice(0, limit)
  const usedBefore = await dailyUsage()
  const result: AttomEnrichmentResult = {
    ok: provider.configured && provider.enabled,
    dryRun: Boolean(input.dryRun),
    mode,
    candidatesSeen: candidates.length,
    selected: selected.length,
    leadsUpdated: 0,
    propertyRecordsUpdated: 0,
    successfulBillableCalls: 0,
    failedCalls: 0,
    cacheHits: 0,
    skipped: 0,
    dailyUsageBefore: usedBefore,
    dailyUsageAfter: usedBefore,
    dailyLimit: config.dailyCallLimit,
    remainingCalls: Math.max(0, config.dailyCallLimit - usedBefore),
    circuitStatus: provider.configured && provider.enabled ? 'ready' : 'disabled',
    errors: [],
    warnings: [],
    strategyCounts: {},
    preview: selected.map((lead) => ({
      leadId: lead.id,
      address: lead.property_address || '',
      priority: leadPriority(lead),
      cached: Boolean(attomCache(lead)),
      source: lead.source,
    })),
  }

  if (input.dryRun || !provider.configured || !provider.enabled) {
    if (!input.dryRun) result.errors.push({ leadId: '', address: '', message: 'ATTOM is not both configured and enabled.' })
    await logRun(result)
    return result
  }

  let sourceId: string | null = null
  try {
    sourceId = await getOrCreateAttomSource()
  } catch (error) {
    result.warnings.push(`Property-intelligence tables unavailable; using lead metadata and command-center event fallback: ${errorMessage(error)}`)
  }

  const runCache = new Map<string, AttomLeadCache>()
  for (const lead of selected) {
    const address = leadToAttomAddress(lead)
    if (!address) {
      result.skipped += 1
      continue
    }

    const addressKey = normalizedAddressKey(lead)
    let cache = runCache.get(addressKey) || attomCache(lead)
    const distressProfile = sourceNeedsExpandedProfile(lead)
    const equityFresh = isFresh(existingEndpoint(cache, 'homeEquity')?.fetchedAt, config.equityCacheDays)
    const profileFresh = isFresh(existingEndpoint(cache, 'expandedProfile')?.fetchedAt, distressProfile ? config.distressCacheDays : config.profileCacheDays)
    const needEquity = !equityFresh
    const needProfile = mode === 'full' ? !profileFresh : mode === 'smart' && distressProfile && !profileFresh

    if (!needEquity && !needProfile && cache) {
      result.cacheHits += 1
    } else if (runCache.has(addressKey) && cache) {
      result.cacheHits += 1
    } else {
      const endpointResults: AttomEndpointResult[] = []
      try {
        if (needEquity) {
          if (usedBefore + result.successfulBillableCalls >= config.dailyCallLimit) {
            result.circuitStatus = 'budget_exhausted'
            result.skipped += 1
            break
          }
          const endpoint = await fetchAttomHomeEquity(address)
          endpointResults.push(endpoint)
          result.successfulBillableCalls += Number(endpoint.billableCall)
        }
        if (needProfile) {
          if (usedBefore + result.successfulBillableCalls >= config.dailyCallLimit) {
            result.circuitStatus = 'budget_exhausted'
          } else {
            const endpoint = await fetchAttomExpandedProfile(address)
            endpointResults.push(endpoint)
            result.successfulBillableCalls += Number(endpoint.billableCall)
          }
        }

        const previousEndpoints = cache?.endpoints || {}
        const homeEquityResult = endpointResults.find((endpoint) => endpoint.endpoint === 'home_equity')
        const profileResult = endpointResults.find((endpoint) => endpoint.endpoint === 'expanded_profile')
        const endpoints: AttomLeadCache['endpoints'] = {
          homeEquity: homeEquityResult
            ? { fetchedAt: homeEquityResult.fetchedAt, facts: homeEquityResult.facts }
            : previousEndpoints.homeEquity,
          expandedProfile: profileResult
            ? { fetchedAt: profileResult.fetchedAt, facts: profileResult.facts }
            : previousEndpoints.expandedProfile,
        }
        const facts = mergeAttomFacts(endpoints.expandedProfile?.facts, endpoints.homeEquity?.facts)
        const strategies = routeAttomStrategies(facts, contextForLead(lead))
        cache = { version: 'attom-v1', updatedAt: new Date().toISOString(), endpoints, facts, strategies }
      } catch (error) {
        result.failedCalls += 1
        const attomError = error instanceof AttomApiError ? error : null
        if (attomError?.billableCall) result.successfulBillableCalls += 1
        result.errors.push({
          leadId: lead.id,
          address: lead.property_address || '',
          message: error instanceof Error ? error.message : 'ATTOM enrichment failed.',
          status: attomError?.status,
        })
        if (attomError?.status === 401 || attomError?.status === 403) {
          result.circuitStatus = 'unauthorized'
          break
        }
        if (attomError?.status === 429) {
          result.circuitStatus = 'rate_limited'
          break
        }
        continue
      }
    }

    if (!cache) {
      result.skipped += 1
      continue
    }
    runCache.set(addressKey, cache)
    try {
      await updateLeadWithAttom(lead, cache)
      result.leadsUpdated += 1
      for (const strategy of cache.strategies) {
        result.strategyCounts[strategy.key] = (result.strategyCounts[strategy.key] || 0) + 1
      }
      if (sourceId) {
        await upsertPropertyIntelligence(lead, cache, sourceId)
        result.propertyRecordsUpdated += 1
      }
    } catch (error) {
      result.errors.push({ leadId: lead.id, address: lead.property_address || '', message: error instanceof Error ? error.message : 'ATTOM persistence failed.' })
    }
  }

  result.dailyUsageAfter = usedBefore + result.successfulBillableCalls
  result.remainingCalls = Math.max(0, config.dailyCallLimit - result.dailyUsageAfter)
  if (result.circuitStatus === 'ready' && result.errors.length && result.leadsUpdated === 0) result.circuitStatus = 'error'
  result.ok = result.circuitStatus === 'ready' || result.circuitStatus === 'budget_exhausted'
  await logRun(result)
  return result
}
