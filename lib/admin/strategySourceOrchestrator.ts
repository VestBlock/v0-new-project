import 'server-only'

import { createHash } from 'node:crypto'

import { STRATEGY_EXECUTION_LANES, type StrategyLane } from '@/lib/admin/strategyExecutionCatalog'
import {
  evaluatePropertyStrategyStack,
  strategySourceContract,
  type StrategyStackEvidence,
} from '@/lib/admin/strategySourceContracts'
import { upsertLead } from '@/lib/leads/repository'
import { upsertResearchChecklist } from '@/lib/osint/repository'
import type { ResearchFlag, ResearchRecommendedLane, ResearchSourceLink } from '@/lib/osint/types'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'
import { createAdminClient } from '@/lib/supabase/admin'

type PropertySource = {
  source_name?: string | null
  source_type?: string | null
  source_url?: string | null
}

type PropertySourceRow = PropertyIntelligenceRecord & {
  created_at?: string | null
  updated_at?: string | null
  property_intelligence_sources?: PropertySource | null
}

type PropertyStrategyMatch = {
  lane: StrategyLane
  evidence: StrategyStackEvidence
  score: number
}

export type StrategySourceOrchestrationResult = {
  dryRun: boolean
  generatedAt: string
  propertiesSeen: number
  candidatesStacked: number
  researchRowsUpserted: number
  contactReady: number
  contactEnrichmentRequired: number
  sensitiveReview: number
  leadsPromoted: number
  marketsActivated: number
  laneCounts: Record<string, number>
  sourceFamilies: Record<string, number>
  blockers: string[]
  adapterReadiness: Array<{
    provider: string
    runner: string
    ready: boolean
    reason: string
  }>
}

function reportDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

async function hasRecentSourceEvidence(provider: string, hours = 48) {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('strategy_source_events')
    .select('id', { count: 'exact', head: true })
    .eq('provider', provider)
    .eq('status', 'completed')
    .gt('rows_received', 0)
    .gte('occurred_at', cutoff)
  if (error) return false
  return Number(count || 0) > 0
}

function normalizeMarket(city: unknown, state: unknown) {
  const normalizedCity = String(city || '').trim()
  const normalizedState = String(state || '').trim().toUpperCase()
  return normalizedCity && normalizedState ? `${normalizedCity}, ${normalizedState}` : null
}

function safeString(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

function firstField(record: Record<string, unknown>, keys: string[], depth = 0): string | null {
  if (depth > 4) return null
  for (const [key, value] of Object.entries(record)) {
    if (keys.includes(key.toLowerCase()) && typeof value === 'string' && value.trim()) return value.trim()
  }
  for (const value of Object.values(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const nested = firstField(value as Record<string, unknown>, keys, depth + 1)
    if (nested) return nested
  }
  return null
}

function usableEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) return null
  if (/(example|test|demo|sample|noreply|no-reply)@/i.test(email)) return null
  return email
}

function usablePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return normalized.length === 10 ? normalized : null
}

function isBusinessOwner(property: PropertySourceRow) {
  const owner = property.owner_entities
  return Boolean(
    owner?.is_llc ||
      /entity|business|corporation|company|trust|llc/i.test(String(owner?.owner_type || '')) ||
      /\b(llc|inc|corp|company|holdings|properties|trust)\b/i.test(String(owner?.owner_name || ''))
  )
}

function publicBusinessContacts(property: PropertySourceRow) {
  if (!isBusinessOwner(property)) return { email: null, phone: null, website: null }
  const raw = (property.raw_fields || {}) as Record<string, unknown>
  return {
    email: usableEmail(firstField(raw, ['business_email', 'contact_email', 'company_email', 'email'])),
    phone: usablePhone(firstField(raw, ['business_phone', 'contact_phone', 'company_phone', 'phone'])),
    website: safeString(firstField(raw, ['business_website', 'company_website', 'website', 'url'])),
  }
}

function sourceLinks(property: PropertySourceRow): ResearchSourceLink[] {
  const links: ResearchSourceLink[] = []
  const source = property.property_intelligence_sources
  if (source?.source_url) {
    links.push({
      label: source.source_name || 'Property source',
      url: source.source_url,
      sourceType: source.source_type || null,
    })
  }
  for (const signal of property.property_signals || []) {
    if (!signal.source_url) continue
    links.push({ label: signal.source_name || signal.signal_label, url: signal.source_url, sourceType: signal.signal_type })
  }
  return Array.from(new Map(links.map((link) => [link.url, link])).values()).slice(0, 20)
}

function recommendedLane(strategyKey: string): ResearchRecommendedLane {
  if (strategyKey === 'novation-retail-equity') return 'seller_novation'
  if (strategyKey === 'active-stale-lowball') return 'seller_fast_cash'
  return 'seller_creative'
}

function propertyMatches(property: PropertySourceRow) {
  const matches: PropertyStrategyMatch[] = []
  for (const lane of STRATEGY_EXECUTION_LANES.filter(
    (candidate) => candidate.enabled && candidate.sourceProviders.includes('property_intelligence')
  )) {
    const evidence = evaluatePropertyStrategyStack(property, lane.key, property.property_intelligence_sources || undefined)
    if (!evidence.eligible) continue
    matches.push({ lane, evidence, score: Math.min(100, lane.minimumScore + evidence.scoreBonus) })
  }
  return matches.sort((left, right) => right.score - left.score || right.evidence.stackDepth - left.evidence.stackDepth)
}

function riskFlags(property: PropertySourceRow, matches: PropertyStrategyMatch[], contactReady: boolean): ResearchFlag[] {
  const flags: ResearchFlag[] = []
  if (!isBusinessOwner(property)) {
    flags.push({ label: 'Natural-person owner: no automated public-web contact enrichment', severity: 'high' })
  }
  if (!contactReady) flags.push({ label: 'Verified contact required before digital outreach', severity: 'medium' })
  if (matches.some((match) => strategySourceContract(match.lane.key)?.sensitive)) {
    flags.push({ label: 'Sensitive property context requires manual review', severity: 'high' })
  }
  if ((property.property_signals || []).some((signal) => signal.signal_type === 'recent_sale')) {
    flags.push({ label: 'Recent-sale suppression review', severity: 'high' })
  }
  return flags
}

function payloadHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function loadProperties(limit: number): Promise<PropertySourceRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('property_intelligence_records')
    .select('*, owner_entities(*), property_signals(*), deal_scores(*), property_intelligence_sources(source_name,source_type,source_url)')
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(2000, limit)))
  if (error) throw error
  return (data || []) as PropertySourceRow[]
}

async function promoteContactReadyProperty(
  property: PropertySourceRow,
  matches: PropertyStrategyMatch[],
  contacts: { email: string | null; phone: string | null; website: string | null }
) {
  const primary = matches[0]
  const source = property.property_intelligence_sources
  const observedAt = property.updated_at || property.created_at || new Date().toISOString()
  return upsertLead({
    leadType: 'sell_house',
    source: `property_intelligence:${String(source?.source_name || source?.source_type || 'public').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    sourceUrl: source?.source_url || null,
    category: 'seller_lead',
    externalId: `property_intelligence:${property.id}`,
    name: property.owner_entities?.owner_name || null,
    businessName: isBusinessOwner(property) ? property.owner_entities?.owner_name || null : null,
    propertyAddress: property.property_address,
    mailingAddress: property.owner_entities?.mailing_address || null,
    phone: contacts.phone,
    email: contacts.email,
    website: contacts.website,
    city: property.city,
    state: property.state,
    zip: property.zip_code,
    painSignal: primary.evidence.signals.join(', '),
    status: 'new',
    bestOffer: 'Real Estate Seller Lead',
    marketSegment: primary.lane.key,
    niche: `strategy_${primary.lane.key}`,
    campaignName: `property-intelligence-${primary.lane.key}`,
    emailValid: null,
    deliveryStatus: 'not_sent',
    importedAt: observedAt,
    outreachAngle: primary.lane.label,
    contactInfo: {
      contactOrigin: 'public_business_source',
      publicBusinessContact: true,
    },
    metadata: {
      propertyIntelligenceRecordId: property.id,
      strategySourceRecordId: property.id,
      strategySourceContractVersion: 1,
      sourceObservedAt: observedAt,
      strategyStackMatches: matches.map((match) => match.lane.key),
      strategyStackSignals: primary.evidence.signals,
      strategySourceFamilies: primary.evidence.sourceFamilies,
      strategyStackDepth: primary.evidence.stackDepth,
      strategySourceDepth: primary.evidence.sourceDepth,
      strategyPrimary: primary.lane.key,
      requiresHumanReview: matches.some((match) => match.lane.reviewOnly || strategySourceContract(match.lane.key)?.sensitive),
    },
  })
}

export async function runStrategySourceOrchestrator(input: { dryRun?: boolean; limit?: number } = {}): Promise<StrategySourceOrchestrationResult> {
  const dryRun = input.dryRun === true
  const generatedAt = new Date().toISOString()
  const homeHarvestRecent = await hasRecentSourceEvidence('homeharvest')
  const properties = await loadProperties(input.limit || 1000)
  const laneCounts: Record<string, number> = {}
  const sourceFamilies: Record<string, number> = {}
  const marketBuckets = new Map<string, {
    lane: StrategyLane
    market: string
    count: number
    contactReady: number
    latestObservedAt: string
    stackDepthTotal: number
  }>()
  let candidatesStacked = 0
  let researchRowsUpserted = 0
  let contactReady = 0
  let contactEnrichmentRequired = 0
  let sensitiveReview = 0
  let leadsPromoted = 0

  for (const property of properties) {
    const market = normalizeMarket(property.city, property.state)
    if (!market || !property.property_address) continue
    const matches = propertyMatches(property)
    if (!matches.length) continue
    candidatesStacked += 1
    const primary = matches[0]
    const contacts = publicBusinessContacts(property)
    const hasContact = Boolean(contacts.email)
    const requiresSensitiveReview = matches.some(
      (match) => match.lane.reviewOnly || strategySourceContract(match.lane.key)?.sensitive
    )
    if (hasContact) contactReady += 1
    else contactEnrichmentRequired += 1
    if (requiresSensitiveReview) sensitiveReview += 1

    for (const match of matches) {
      laneCounts[match.lane.key] = (laneCounts[match.lane.key] || 0) + 1
      for (const sourceFamily of match.evidence.sourceFamilies) {
        sourceFamilies[sourceFamily] = (sourceFamilies[sourceFamily] || 0) + 1
      }
      const bucketKey = `${match.lane.key}::${market.toLowerCase()}`
      const current = marketBuckets.get(bucketKey) || {
        lane: match.lane,
        market,
        count: 0,
        contactReady: 0,
        latestObservedAt: property.updated_at || property.created_at || generatedAt,
        stackDepthTotal: 0,
      }
      current.count += 1
      current.contactReady += hasContact ? 1 : 0
      current.stackDepthTotal += match.evidence.stackDepth
      const observedAt = property.updated_at || property.created_at || generatedAt
      if (Date.parse(observedAt) > Date.parse(current.latestObservedAt)) current.latestObservedAt = observedAt
      marketBuckets.set(bucketKey, current)
    }

    if (dryRun) continue
    const flags = riskFlags(property, matches, hasContact)
    await upsertResearchChecklist({
      entityType: 'property',
      entityId: property.id,
      sourceType: 'property_intelligence',
      sourceId: property.id,
      propertyAddress: property.property_address,
      city: property.city,
      state: property.state,
      zipCode: property.zip_code,
      ownerName: property.owner_entities?.owner_name || null,
      companyName: isBusinessOwner(property) ? property.owner_entities?.owner_name || null : null,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      website: contacts.website,
      checklist: {
        propertyVerified: true,
        ownerEntityVerified: Boolean(property.owner_entities?.owner_name),
        contactQualityReviewed: hasContact,
        sourceLinksAttached: sourceLinks(property).length > 0,
        fitCriteriaReviewed: true,
        riskReviewed: true,
        nextActionSelected: true,
        strategyStackMatches: matches.map((match) => match.lane.key),
        strategyStackEvidence: matches.map((match) => ({
          strategyKey: match.lane.key,
          score: match.score,
          signals: match.evidence.signals,
          sourceFamilies: match.evidence.sourceFamilies,
          stackDepth: match.evidence.stackDepth,
          sourceDepth: match.evidence.sourceDepth,
        })),
      },
      sourceLinks: sourceLinks(property),
      riskFlags: flags,
      opportunityFlags: matches.map((match) => ({
        label: `${match.lane.label}: ${match.evidence.signals.join(', ')}`,
        severity: 'info',
      })),
      recommendedLane: recommendedLane(primary.lane.key),
      outreachStatus: hasContact ? 'needs_review' : 'not_ready',
      confidenceScore: primary.score,
      researchSummary: `${matches.length} strategy match(es), ${primary.evidence.stackDepth} relevant signals, and ${primary.evidence.sourceDepth} source family/families.`,
      nextAction: hasContact
        ? 'Verify the public business contact and approve one primary strategy message. Do not send duplicate lane messages.'
        : isBusinessOwner(property)
          ? 'Find a public company website/contact path or use a compliant enrichment provider, then verify before outreach.'
          : 'Keep digital outreach blocked. Use lawful mail/manual review or a compliant licensed contact provider.',
    })
    researchRowsUpserted += 1

    if (hasContact) {
      await promoteContactReadyProperty(property, matches, contacts)
      leadsPromoted += 1
    }
  }

  const blockers: string[] = []
  if (!properties.length) blockers.push('No property-intelligence records are available for source orchestration.')
  if (candidatesStacked && !contactReady) {
    blockers.push(`${candidatesStacked} stacked property candidates require compliant contact enrichment or mail/manual review.`)
  }

  if (!dryRun) {
    const admin = createAdminClient()
    const marketRows = [...marketBuckets.values()].map((bucket) => ({
      strategy_key: bucket.lane.key,
      market: bucket.market,
      source_provider: 'property_intelligence',
      status: 'active',
      priority_score: Math.min(100, 40 + bucket.count + bucket.contactReady * 5),
      consecutive_empty_runs: 0,
      last_source_at: bucket.latestObservedAt,
      last_source_success_at: bucket.latestObservedAt,
      last_contact_ready_at: bucket.contactReady ? generatedAt : null,
      next_run_at: generatedAt,
      metrics_json: {
        sourceContractVersion: 'strategy-source-v2',
        propertyCandidates: bucket.count,
        contactReady: bucket.contactReady,
        contactEnrichmentRequired: bucket.count - bucket.contactReady,
        averageStackDepth: Number((bucket.stackDepthTotal / bucket.count).toFixed(2)),
        lastSourceSuccessAt: bucket.latestObservedAt,
        lastOrchestratedAt: generatedAt,
      },
      updated_at: generatedAt,
    }))
    if (marketRows.length) {
      const { error } = await admin.from('strategy_market_state').upsert(marketRows, {
        onConflict: 'strategy_key,market,source_provider',
      })
      if (error) throw error
    }

    const eventPayload = {
      propertiesSeen: properties.length,
      candidatesStacked,
      contactReady,
      contactEnrichmentRequired,
      leadsPromoted,
      marketsActivated: marketBuckets.size,
      laneCounts,
      sourceFamilies,
    }
    const { error: eventError } = await admin.from('strategy_source_events').upsert({
      provider: 'property_intelligence',
      external_event_id: `source-orchestration:${reportDate()}`,
      event_type: 'property_stack_orchestration',
      status: properties.length ? 'completed' : 'blocked',
      payload_hash: payloadHash(eventPayload),
      payload_json: eventPayload,
      rows_received: properties.length,
      rows_ingested: leadsPromoted,
      error_message: properties.length ? null : blockers.join(' ') || null,
      occurred_at: generatedAt,
      processed_at: generatedAt,
      updated_at: generatedAt,
    }, { onConflict: 'provider,external_event_id' })
    if (eventError) throw eventError
  }

  return {
    dryRun,
    generatedAt,
    propertiesSeen: properties.length,
    candidatesStacked,
    researchRowsUpserted,
    contactReady,
    contactEnrichmentRequired,
    sensitiveReview,
    leadsPromoted,
    marketsActivated: marketBuckets.size,
    laneCounts,
    sourceFamilies,
    blockers,
    adapterReadiness: [
      {
        provider: 'property_intelligence',
        runner: 'cloud_database',
        ready: true,
        reason: 'Cloud orchestration promotes verified business contacts and queues contactless properties for research.',
      },
      {
        provider: 'attom',
        runner: 'cloud_database',
        ready: Boolean(process.env.ATTOM_API_KEY),
        reason: process.env.ATTOM_API_KEY ? 'Configured for enrichment of existing property candidates.' : 'ATTOM API key is not configured.',
      },
      {
        provider: 'public_records',
        runner: 'signed_upload',
        ready: true,
        reason: 'County/public CSV and GeoJSON imports can enter the cloud property-intelligence queue without DealMachine.',
      },
      {
        provider: 'homeharvest',
        runner: 'local_mac',
        ready: process.env.VESTBLOCK_MACHINE_MODE === 'primary' || homeHarvestRecent,
        reason: homeHarvestRecent
          ? 'Recent completed HomeHarvest source evidence confirms the Mac Pro runner is active.'
          : process.env.VESTBLOCK_MACHINE_MODE === 'primary'
            ? 'Primary Mac runner is enabled.'
            : 'Listing discovery requires the always-on Mac Pro runner or a separate hosted worker.',
      },
    ],
  }
}
