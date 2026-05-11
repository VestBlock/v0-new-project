import { adminTaskDueDates, createAdminTask, createLeadFollowupTask } from '@/lib/admin/tasks'
import { sendEmail, sendLeadOutreachSentAlertEmail } from '@/lib/email/sendEmail'
import { getLeadEmailAutopilotDecision, isLegacyGooglePlacesPhaseOutEnabled } from '@/lib/leads/autopilot'
import { DEFAULT_GOOGLE_PLACES_NICHES } from '@/lib/leads/constants'
import { searchCincinnatiCodeViolations } from '@/lib/leads/connectors/cincinnati-code-enforcement'
import { searchGooglePlaces } from '@/lib/leads/connectors/google-places'
import { searchMilwaukeeAccela } from '@/lib/leads/connectors/milwaukee-accela'
import { searchOutscraperGoogleMaps } from '@/lib/leads/connectors/outscraper-google-maps'
import { searchApifyYelp } from '@/lib/leads/connectors/apify-yelp'
import { searchSamOpportunities } from '@/lib/leads/connectors/sam'
import { searchWisconsinBusinesses } from '@/lib/leads/connectors/wisconsin-dfi'
import { sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { classifyLeadRevenueCampaign, getRevenueCampaignAllocation, REVENUE_CAMPAIGN_ORDER, validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { buildSourceFamilyFilters } from '@/lib/leads/source-keys'
import { discoverMarkets, listMarketsForExpansionLane, listMarketsForDailyRun, markMarketRunResult, pickDiscoveryTermsForMarket, updateMarketPerformance } from '@/lib/leads/marketExpansion'
import {
  insertOutreachSendEvent,
  listEmailOutreachForSendQueue,
  listLeadsForEmailEnrichment,
  listLeadsForScoring,
  listLeadsNeedingFollowup,
  listLeadsNeedingOutreach,
  listSuppressions,
  updateLeadRecord,
  updateOutreachMessage,
} from '@/lib/leads/repository'
import { enrichLeadContactEmail, enrichNormalizedLeadContact, generateAndStoreOutreachForLead, ingestNormalizedLeads, scoreAndPersistLead } from '@/lib/leads/service'
import type { LeadRecord } from '@/lib/leads/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

type MarketConfig = {
  id?: string
  city: string
  state: string
  language?: string
  region?: string
  preferredNiches?: string[]
}

type LeadAutomationOptions = {
  dryRun?: boolean
  scrapeLimitPerSource?: number
  outreachGenerationLimit?: number
  sendLimit?: number
  budgetMs?: number
  startedAtMs?: number
}

type LeadEmailEnrichmentOptions = {
  limit?: number
  dryRun?: boolean
  budgetMs?: number
  startedAtMs?: number
}

const DEFAULT_MARKETS: MarketConfig[] = [
  { city: 'Milwaukee', state: 'WI', language: 'en', region: 'US' },
  { city: 'Milwaukee', state: 'WI', language: 'es', region: 'US' },
  { city: 'Chicago', state: 'IL', language: 'en', region: 'US' },
  { city: 'Chicago', state: 'IL', language: 'es', region: 'US' },
  { city: 'Cincinnati', state: 'OH', language: 'en', region: 'US' },
]

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function envMs(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback
}

function getLeadDailyTarget() {
  return envInt('LEADS_TARGET_EMAILS_PER_DAY', envInt('LEADS_DAILY_SEND_LIMIT', 100))
}

function getLeadThroughputTargetPerRun() {
  const dailyTarget = getLeadDailyTarget()
  return envInt('LEADS_THROUGHPUT_SEND_LIMIT_PER_RUN', Math.min(dailyTarget, 35))
}

function scaleLeadWorkset(base: number, target: number, multiplier: number, cap: number) {
  return Math.max(base, Math.min(cap, Math.ceil(target * multiplier)))
}

function getRemainingBudgetMs(startedAtMs: number, budgetMs: number) {
  return Math.max(0, budgetMs - (Date.now() - startedAtMs))
}

function shouldStopForBudget(startedAtMs: number, budgetMs: number, reserveMs = 1500) {
  return getRemainingBudgetMs(startedAtMs, budgetMs) <= reserveMs
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

function buildLeadDigestHtml(title: string, items: string[]) {
  const rows = items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="color:#fff;">${title}</h2><ul>${rows}</ul></div>`
}

async function buildDailyBusinessMarketConfigs(limit: number) {
  const activeMarkets = await listMarketsForExpansionLane('small_business', {
    limit,
  }).catch(async () => listMarketsForDailyRun().catch(() => []))

  if (activeMarkets.length) {
    return activeMarkets.map((market) => ({
      id: market.id,
      city: market.city,
      state: market.state,
      language: Number(market.spanish_business_score || 0) >= 7 ? 'es' : 'en',
      region: 'US',
      preferredNiches: pickDiscoveryTermsForMarket(market, 'small_business'),
    }))
  }

  return DEFAULT_MARKETS.slice(0, limit).map((market) => ({
    ...market,
    preferredNiches:
      market.language === 'es'
        ? ['spanish-speaking businesses', 'immigration services', 'tax services', 'restaurants']
        : DEFAULT_GOOGLE_PLACES_NICHES.slice(0, 6),
  }))
}

function leadLabel(lead: LeadRecord) {
  return lead.business_name || lead.name || lead.property_address || lead.id
}

function getLeadNiche(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getLeadContactFormUrls(lead: LeadRecord) {
  const urls = lead.contact_info?.contactFormUrls
  if (!Array.isArray(urls)) return []
  return urls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function classifyOutreachService(lead: LeadRecord | null | undefined, subject = '') {
  return classifyLeadRevenueCampaign(lead, subject).label
}

function incrementCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

function formatCountMap(map: Map<string, number>) {
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  return entries.length ? entries.map(([key, count]) => `${key}: ${count}`).join(', ') : 'None'
}

async function persistSkippedSendEvent(input: {
  dryRun?: boolean
  lead: LeadRecord | null | undefined
  outreachMessageId: string
  subject?: string | null
  reason: string
}) {
  if (input.dryRun || !input.lead) return

  await insertOutreachSendEvent({
    leadId: input.lead.id,
    outreachMessageId: input.outreachMessageId,
    channel: 'email',
    status: 'skipped',
    recipient: input.lead.email,
    subject: input.subject || null,
    metadata: {
      skippedReason: input.reason,
      reason: input.reason,
    },
  })
}

function balanceEmailQueueByService<T extends { leads: LeadRecord | null; subject?: string | null }>(
  rows: T[],
  limit: number
) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const service = classifyOutreachService(row.leads, row.subject || '')
    const group = groups.get(service) || []
    group.push(row)
    groups.set(service, group)
  }

  const preferredOrder = REVENUE_CAMPAIGN_ORDER
  const preferredSet = new Set<string>(preferredOrder)
  const allServices = [
    ...preferredOrder.filter((service) => groups.has(service)),
    ...Array.from(groups.keys()).filter((service) => !preferredSet.has(service)),
  ]
  const balanced: T[] = []
  const allocations = getRevenueCampaignAllocation(limit)

  for (const service of preferredOrder) {
    const group = groups.get(service)
    let remainingAllocation = allocations.get(service) || 0
    while (group?.length && remainingAllocation > 0 && balanced.length < limit) {
      const next = group.shift()
      if (next) balanced.push(next)
      remainingAllocation -= 1
    }
  }

  while (balanced.length < limit && allServices.some((service) => (groups.get(service)?.length || 0) > 0)) {
    for (const service of allServices) {
      const next = groups.get(service)?.shift()
      if (next) balanced.push(next)
      if (balanced.length >= limit) break
    }
  }

  return balanced
}

async function sendAdminDigest(
  subject: string,
  title: string,
  items: string[],
  eventType:
    | 'admin_lead_followup'
    | 'admin_lead_run_daily_report'
    | 'admin_lead_scoring_daily_report'
    | 'admin_lead_outreach_daily_report'
    | 'admin_lead_send_daily_report'
) {
  if (!process.env.ADMIN_ALERT_EMAIL || items.length === 0) return
  await sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL,
    subject,
    html: buildLeadDigestHtml(title, items),
    eventType,
  }).catch(() => null)
}

function isInvalidGooglePlacesKeyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Google Places API key is invalid|API_KEY_INVALID|API key not valid/i.test(message)
}

function resolveDailyMapsProvider() {
  if (process.env.OUTSCRAPER_API_KEY) return 'outscraper' as const
  if (process.env.GOOGLE_PLACES_API_KEY && !isLegacyGooglePlacesPhaseOutEnabled()) return 'google' as const
  return null
}

export async function runDailyLeadScrape(options: LeadAutomationOptions = {}) {
  const scrapeLimitPerSource = options.scrapeLimitPerSource || envInt('LEADS_DAILY_SCRAPE_LIMIT_PER_SOURCE', 20)
  const results: Array<{ source: string; count: number; status: 'completed' | 'skipped' | 'failed'; detail?: string }> = []
  const admin = createAdminClient()
  const expansionBatchId = `exp-${new Date().toISOString().slice(0, 10)}`
  const marketSummary: Array<{ city: string; state: string; niches: string[]; count: number }> = []

  try {
    await discoverMarkets()
  } catch (error) {
    results.push({
      source: 'discover_markets',
      count: 0,
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    const newBusinessLeads = await searchWisconsinBusinesses({
      query: 'LLC',
      limit: Math.min(scrapeLimitPerSource, 12),
      daysBack: 45,
    })
    const saved = options.dryRun ? newBusinessLeads : await ingestNormalizedLeads('wisconsin_dfi_new_businesses', 'daily_growth_scrape', { query: 'LLC' }, newBusinessLeads, { scoreOnIngest: true })
    results.push({ source: 'wisconsin_dfi_new_businesses', count: saved.length, status: 'completed' })
  } catch (error) {
    results.push({ source: 'wisconsin_dfi_new_businesses', count: 0, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
  }

  try {
    const cincinnati = await searchCincinnatiCodeViolations({
      limit: Math.min(scrapeLimitPerSource, 20),
      daysBack: 90,
    })
    const saved = options.dryRun ? cincinnati : await ingestNormalizedLeads('cincinnati_code_enforcement', 'daily_growth_scrape', { daysBack: 90 }, cincinnati, { scoreOnIngest: true })
    results.push({ source: 'cincinnati_code_enforcement', count: saved.length, status: 'completed' })
  } catch (error) {
    results.push({ source: 'cincinnati_code_enforcement', count: 0, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
  }

  try {
    const milwaukee = await searchMilwaukeeAccela({
      city: 'Milwaukee',
      state: 'WI',
      limit: Math.min(scrapeLimitPerSource, 16),
    })
    const saved = options.dryRun ? milwaukee : await ingestNormalizedLeads('milwaukee_accela_enforcement', 'daily_growth_scrape', { city: 'Milwaukee', state: 'WI' }, milwaukee, { scoreOnIngest: true })
    results.push({
      source: 'milwaukee_accela_enforcement',
      count: saved.length,
      status: milwaukee.length ? 'completed' : 'skipped',
      detail: milwaukee.length ? undefined : 'Address-driven public search returned no rows without a tighter address seed.',
    })
  } catch (error) {
    results.push({ source: 'milwaukee_accela_enforcement', count: 0, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
  }

  const mapsProvider = resolveDailyMapsProvider()
  if (!mapsProvider) {
    results.push({
      source: 'maps_businesses',
      count: 0,
      status: 'skipped',
      detail: isLegacyGooglePlacesPhaseOutEnabled()
        ? 'Daily maps scraping now requires OUTSCRAPER_API_KEY. Google Places remains stored as a legacy source only.'
        : 'Add OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY to enable daily maps scraping.',
    })
  } else {
    const marketConfigs: MarketConfig[] = await buildDailyBusinessMarketConfigs(envInt('LEADS_DAILY_MARKET_COUNT', 6))

    for (const market of marketConfigs) {
      try {
        const niches = market.preferredNiches?.length
          ? market.preferredNiches
          : market.language === 'es'
            ? ['spanish-speaking businesses', 'immigration services', 'tax services', 'restaurants']
            : DEFAULT_GOOGLE_PLACES_NICHES.slice(0, 6)
        const leads =
          mapsProvider === 'outscraper'
            ? await searchOutscraperGoogleMaps({
                city: market.city,
                state: market.state,
                language: market.language || 'en',
                region: market.region || 'US',
                niches,
                limitPerNiche: Math.max(3, Math.floor(scrapeLimitPerSource / niches.length)),
              })
            : await searchGooglePlaces({
                city: market.city,
                state: market.state,
                language: market.language || 'en',
                region: market.region || 'US',
                niches,
                limitPerNiche: Math.max(3, Math.floor(scrapeLimitPerSource / niches.length)),
                includeWebsiteAnalysis: false,
              })

        const sourceKey =
          mapsProvider === 'outscraper'
            ? 'outscraper_google_maps_businesses'
            : 'google_places_businesses'
        const stagedLeads = leads.map((lead) => ({
          ...lead,
          niche: getLeadNiche(lead.metadata?.niche) || niches[0] || null,
          targetMarketId: market.id ?? null,
          expansionBatchId,
          marketSegment: 'market_expansion',
          emailValid: lead.email ? true : null,
          metadata: {
            ...(lead.metadata || {}),
            marketExpansion: true,
            targetCity: market.city,
            targetState: market.state,
            expansionBatchId,
          },
        }))
        const enrichedLeads = []
        let enrichmentHits = 0
        let contactFormHits = 0

        for (const lead of stagedLeads) {
          if (lead.website && !isUsableContactEmail(lead.email)) {
            const enrichment = await enrichNormalizedLeadContact(lead).catch(() => null)
            const nextLead = enrichment?.lead || lead
            enrichedLeads.push(nextLead)
            if (enrichment?.updated) enrichmentHits += 1
            if (nextLead.contactInfo && nextLead.contactInfo.hasContactForm === true) {
              contactFormHits += 1
            }
            continue
          }

          enrichedLeads.push(lead)
        }
        const saved = options.dryRun
          ? enrichedLeads
          : await ingestNormalizedLeads(
              sourceKey,
              'daily_growth_scrape',
              {
                market,
                niches,
                expansionBatchId,
                mapsProvider,
                immediateEmailEnrichmentHits: enrichmentHits,
                immediateContactFormHits: contactFormHits,
              },
              enrichedLeads,
              { scoreOnIngest: true }
            )

        marketSummary.push({
          city: market.city,
          state: market.state,
          niches,
          count: saved.length,
        })

        if (!options.dryRun && market.id) {
          await markMarketRunResult(market.id, saved.length)
        }

        results.push({
          source: `${sourceKey}:${market.city}:${market.language || 'en'}`,
          count: saved.length,
          status: 'completed',
          detail:
            enrichmentHits || contactFormHits
              ? `Immediate enrichment found ${enrichmentHits} usable email(s) and ${contactFormHits} contact-form fallback(s).`
              : undefined,
        })
      } catch (error) {
        if (mapsProvider === 'google' && isInvalidGooglePlacesKeyError(error)) {
          results.push({
            source: 'google_places_businesses',
            count: 0,
            status: 'failed',
            detail:
              'Google Places API key is invalid or not activated for Places API. Fix the key in Google Cloud and Vercel before retrying daily maps scraping.',
          })
          break
        }

        results.push({
          source: `maps:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'failed',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (envBool('LEADS_ENABLE_APIFY_YELP', true) && process.env.APIFY_TOKEN) {
    const apifyMarketConfigs = await buildDailyBusinessMarketConfigs(envInt('LEADS_DAILY_APIFY_MARKET_COUNT', 2))
    const apifyPerNicheLimit = envInt('LEADS_DAILY_APIFY_YELP_LIMIT_PER_NICHE', Math.max(4, Math.floor(scrapeLimitPerSource / 2)))

    for (const market of apifyMarketConfigs) {
      try {
        const niches = (market.preferredNiches?.length ? market.preferredNiches : DEFAULT_GOOGLE_PLACES_NICHES)
          .slice(0, envInt('LEADS_DAILY_APIFY_NICHE_COUNT', 2))
        const leads = await searchApifyYelp({
          city: market.city,
          state: market.state,
          niches,
          limitPerNiche: apifyPerNicheLimit,
          proxyCountry: process.env.APIFY_PROXY_COUNTRY || 'US',
        })

        const stagedLeads = leads.map((lead) => ({
          ...lead,
          niche: getLeadNiche(lead.metadata?.niche) || niches[0] || null,
          targetMarketId: market.id ?? null,
          expansionBatchId,
          marketSegment: 'market_expansion',
          emailValid: lead.email ? true : null,
          metadata: {
            ...(lead.metadata || {}),
            marketExpansion: true,
            targetCity: market.city,
            targetState: market.state,
            expansionBatchId,
          },
        }))

        const enrichedLeads = []
        let enrichmentHits = 0
        let contactFormHits = 0

        for (const lead of stagedLeads) {
          if (lead.website && !isUsableContactEmail(lead.email)) {
            const enrichment = await enrichNormalizedLeadContact(lead).catch(() => null)
            const nextLead = enrichment?.lead || lead
            enrichedLeads.push(nextLead)
            if (enrichment?.updated) enrichmentHits += 1
            if (nextLead.contactInfo && nextLead.contactInfo.hasContactForm === true) {
              contactFormHits += 1
            }
            continue
          }

          enrichedLeads.push(lead)
        }

        const saved = options.dryRun
          ? enrichedLeads
          : await ingestNormalizedLeads(
              'apify_yelp_businesses',
              'daily_growth_scrape',
              {
                market,
                niches,
                expansionBatchId,
                provider: 'apify',
                actor: process.env.APIFY_YELP_ACTOR_ID || 'tri_angle/yelp-scraper',
                immediateEmailEnrichmentHits: enrichmentHits,
                immediateContactFormHits: contactFormHits,
              },
              enrichedLeads,
              { scoreOnIngest: true }
            )

        results.push({
          source: `apify_yelp_businesses:${market.city}:${market.language || 'en'}`,
          count: saved.length,
          status: 'completed',
          detail:
            enrichmentHits || contactFormHits
              ? `Immediate enrichment found ${enrichmentHits} usable email(s) and ${contactFormHits} contact-form fallback(s).`
              : undefined,
        })
      } catch (error) {
        results.push({
          source: `apify_yelp_businesses:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'failed',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } else {
    results.push({
      source: 'apify_yelp_businesses',
      count: 0,
      status: 'skipped',
      detail: process.env.APIFY_TOKEN
        ? 'Apify Yelp expansion is disabled by LEADS_ENABLE_APIFY_YELP.'
        : 'Add APIFY_TOKEN to enable Apify Yelp lead expansion.',
    })
  }

  const samEnabled = envBool('LEADS_ENABLE_SAM', false)
  if (!samEnabled) {
    results.push({
      source: 'sam_contract_opportunities',
      count: 0,
      status: 'skipped',
      detail: 'SAM.gov matching is disabled in the current rollout.',
    })
  } else if (!process.env.SAM_GOV_API_KEY) {
    results.push({
      source: 'sam_contract_opportunities',
      count: 0,
      status: 'skipped',
      detail: 'Add SAM_GOV_API_KEY to enable SAM.gov opportunity matching.',
    })
  } else {
    try {
      const { data: businessLeads } = await admin
        .from('leads')
        .select('*')
        .or(
          buildSourceFamilyFilters(
            'source',
            isLegacyGooglePlacesPhaseOutEnabled()
              ? ['outscraper_google_maps_businesses', 'wisconsin_dfi_new_businesses', 'apify_yelp_businesses']
              : ['google_places_businesses', 'outscraper_google_maps_businesses', 'wisconsin_dfi_new_businesses', 'apify_yelp_businesses']
          )
        )
        .order('lead_score', { ascending: false })
        .limit(250)

      const result = await searchSamOpportunities({
        keyword: 'construction',
        naicsCodes: ['236220', '541511', '561720'],
        state: 'WI',
        city: 'Milwaukee',
        daysBack: 30,
        limit: Math.min(scrapeLimitPerSource, 25),
        existingBusinessLeads: (businessLeads || []) as LeadRecord[],
      })

      const saved = options.dryRun
        ? result.matchedLeads
        : await ingestNormalizedLeads('sam_contract_opportunities', 'daily_growth_scrape', { keyword: 'construction' }, result.matchedLeads, { scoreOnIngest: true })
      results.push({ source: 'sam_contract_opportunities', count: saved.length, status: 'completed' })
    } catch (error) {
      results.push({ source: 'sam_contract_opportunities', count: 0, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }

  if (process.env.ADMIN_ALERT_EMAIL && !options.dryRun) {
    const bestCity = [...marketSummary].sort((a, b) => b.count - a.count)[0]
    const bestNiche = marketSummary
      .flatMap((item) => item.niches.map((niche) => ({ niche, count: item.count })))
      .sort((a, b) => b.count - a.count)[0]

    await sendEmail({
      to: process.env.ADMIN_ALERT_EMAIL,
      subject: 'VestBlock daily lead run report',
      html: buildLeadDigestHtml('Daily lead run summary', [
        `Cities discovered today: ${marketSummary.length}`,
        `Cities scraped today: ${marketSummary.filter((item) => item.count > 0).length}`,
        `Niches searched: ${Array.from(new Set(marketSummary.flatMap((item) => item.niches))).join(', ') || 'None'}`,
        `Leads found: ${results.reduce((sum, row) => sum + row.count, 0)}`,
        `Best city today: ${bestCity ? `${bestCity.city}, ${bestCity.state} (${bestCity.count})` : 'None'}`,
        `Best niche today: ${bestNiche ? bestNiche.niche : 'None'}`,
        `Tomorrow's recommended cities: ${marketSummary.slice(0, 3).map((item) => `${item.city}, ${item.state}`).join(', ') || 'Pending next discovery run'}`,
      ]),
      eventType: 'admin_lead_run_daily_report',
    }).catch(() => null)
  }

  return {
    ok: true,
    results,
    totalCreated: results.reduce((sum, row) => sum + row.count, 0),
  }
}

export async function runDailyLeadScoring() {
  const leads = await listLeadsForScoring(envInt('LEADS_DAILY_SCORE_LIMIT', 250))
  const results = []
  for (const lead of leads) {
    const score = await scoreAndPersistLead(lead, {
      category: lead.category,
      leadType: lead.lead_type,
      name: lead.name,
      businessName: lead.business_name,
      email: lead.email,
      phone: lead.phone,
      sourceUrl: lead.source_url,
      painSignal: lead.pain_signal,
      source: lead.source || 'lead_intelligence',
    })
    results.push({ leadId: lead.id, score: score.score, offer: score.bestOffer })
  }
  const topOffers = Array.from(
    results.reduce((map, row) => map.set(row.offer, (map.get(row.offer) || 0) + 1), new Map<string, number>())
      .entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([offer, count]) => `${offer}: ${count}`)

  await sendAdminDigest(
    'VestBlock morning lead enrichment report',
    'Morning enrichment summary',
    [
      `Leads enriched and scored: ${results.length}`,
      `High-score leads (85+): ${results.filter((row) => row.score >= 85).length}`,
      `Top offers: ${topOffers.join(', ') || 'None yet'}`,
    ],
    'admin_lead_scoring_daily_report'
  )
  return { ok: true, count: results.length, results }
}

export async function runDailyLeadEmailEnrichment(options: LeadEmailEnrichmentOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const batchSize = envInt('LEADS_DAILY_EMAIL_ENRICH_BATCH_SIZE', 8)
  const leads = await listLeadsForEmailEnrichment(
    options.limit || envInt('LEADS_DAILY_EMAIL_ENRICH_LIMIT', 250)
  )
  const results = []
  let processedCount = 0
  let truncated = false

  for (const batch of chunkArray(leads, Math.max(1, batchSize))) {
    if (shouldStopForBudget(startedAtMs, budgetMs, 2500)) {
      truncated = processedCount < leads.length
      break
    }

    const batchResults = await Promise.all(
      batch.map(async (lead) => {
        const enrichment = options.dryRun
          ? {
              lead,
              updated: false,
              status: 'dry_run',
            }
          : await enrichLeadContactEmail(lead)

        return {
          leadId: lead.id,
          status: enrichment.status,
          updated: enrichment.updated,
          email: enrichment.lead.email,
        }
      })
    )

    results.push(...batchResults)
    processedCount += batch.length
  }

  await sendAdminDigest(
    'VestBlock contact enrichment report',
    'Morning contact enrichment',
    [
      `Leads checked for website and Hunter contact emails: ${results.length}${truncated ? ` of ${leads.length}` : ''}`,
      `New usable emails found: ${results.filter((row) => row.updated).length}`,
      `Still missing contact email: ${results.filter((row) => !row.updated).length}`,
    ],
    'admin_lead_scoring_daily_report'
  )

  return { ok: true, count: results.length, attempted: leads.length, truncated, results }
}

export async function runDailyLeadOutreach(options: LeadAutomationOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const batchSize = envInt('LEADS_DAILY_OUTREACH_BATCH_SIZE', 3)
  const leads = await listLeadsNeedingOutreach(options.outreachGenerationLimit || envInt('LEADS_DAILY_OUTREACH_LIMIT', 300))
  const results = []
  let processedCount = 0
  let truncated = false

  for (const batch of chunkArray(leads, Math.max(1, batchSize))) {
    if (shouldStopForBudget(startedAtMs, budgetMs, 5000)) {
      truncated = processedCount < leads.length
      break
    }

    const batchResults = await Promise.all(
      batch.map(async (lead) => {
        let currentLead = lead
        let enrichedEmail = false

        if (!options.dryRun && !currentLead.email && currentLead.website) {
          const enrichment = await enrichLeadContactEmail(currentLead).catch(() => null)
          if (enrichment?.lead) {
            currentLead = enrichment.lead
            enrichedEmail = enrichment.updated
          }
        }

        const messages = options.dryRun ? [] : await generateAndStoreOutreachForLead(currentLead)
        return {
          leadId: currentLead.id,
          generated: messages.length || 5,
          enrichedEmail,
          email: currentLead.email,
          hasContactForm: getLeadContactFormUrls(currentLead).length > 0,
        }
      })
    )

    results.push(...batchResults)
    processedCount += batch.length
  }
  await sendAdminDigest(
    'VestBlock morning outreach draft report',
    'Outreach drafts generated',
    [
      `Leads with fresh outreach drafts: ${results.length}${truncated ? ` of ${leads.length}` : ''}`,
      `Leads upgraded with a usable email before draft generation: ${results.filter((row) => row.enrichedEmail).length}`,
      `Channels generated per lead: email, SMS, Facebook DM, Instagram DM, phone script`,
    ],
    'admin_lead_outreach_daily_report'
  )
  return { ok: true, count: results.length, attempted: leads.length, truncated, results }
}

export async function runDailyLeadSendQueue(options: LeadAutomationOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const sendLimit = options.sendLimit || envInt('LEADS_DAILY_SEND_LIMIT', 100)
  const autoSendApproved = envBool('AUTO_SEND_ENABLED', envBool('LEADS_AUTO_SEND_APPROVED', false))
  const queueMultiplier = envInt('LEADS_DAILY_SEND_QUEUE_MULTIPLIER', 10)
  const manualContactFormTaskLimit = envInt('LEADS_CONTACT_FORM_TASK_LIMIT_PER_RUN', 15)
  const providerFailureStopThreshold = envInt('LEADS_PROVIDER_FAILURE_STOP_THRESHOLD', 5)
  const queue = await listEmailOutreachForSendQueue(sendLimit * queueMultiplier)
  const suppressions = await listSuppressions().catch(() => [])
  const autoSendEnabled = autoSendApproved
  const sendResults: Array<{ leadId: string; status: string; provider?: string; detail?: string }> = []
  const skipReasonCounts = new Map<string, number>()
  const sentServiceCounts = new Map<string, number>()
  const emailReadyServiceCounts = new Map<string, number>()
  let autoApprovedCount = 0
  let enrichedInQueueCount = 0
  let manualContactFormTaskCount = 0
  let providerFailureCount = 0
  let sentCount = 0
  let truncated = false
  let circuitBreakerTripped = false
  const getQueueRowContactFormCount = (lead: LeadRecord | null | undefined) =>
    lead ? getLeadContactFormUrls(lead).length : 0
  const emailReadyQueue = queue.filter((row) => isUsableContactEmail(row.leads?.email))
  const manualContactFormQueue = queue.filter(
    (row) => !isUsableContactEmail(row.leads?.email) && getQueueRowContactFormCount(row.leads) > 0
  )
  const blockedEmailQueue = queue.filter(
    (row) => !isUsableContactEmail(row.leads?.email) && getQueueRowContactFormCount(row.leads) === 0
  )

  for (const row of emailReadyQueue) {
    incrementCount(emailReadyServiceCounts, classifyOutreachService(row.leads, row.subject || ''))
  }

  if (!options.dryRun) {
    for (const row of manualContactFormQueue.slice(0, manualContactFormTaskLimit)) {
      const lead = row.leads
      if (!lead) continue
      const contactFormUrls = getLeadContactFormUrls(lead)
      const task = await createAdminTask({
        title: 'Review website contact-form outreach',
        description: `This lead does not have a usable email, but its website exposes a contact form.\n\nReview the form path and submit a tailored message if it still fits your outreach rules.\n\nForm URLs:\n${contactFormUrls.join('\n')}`,
        taskType: 'lead_contact_form_outreach',
        priority: 'normal',
        entityType: 'lead',
        entityId: lead.id,
        userEmail: lead.email ?? null,
        dueAt: adminTaskDueDates.hours(8),
        metadata: {
          website: lead.website,
          contactFormUrls,
          outreachMessageId: row.id,
          suggestedSubject: row.subject,
          serviceBucket: classifyOutreachService(lead, row.subject || ''),
        },
      })
      if (task.ok && !task.duplicate) manualContactFormTaskCount += 1
    }
  }

  for (const row of manualContactFormQueue) {
    const lead = row.leads
    if (!lead) continue
    incrementCount(skipReasonCounts, 'contact_form_available')
    await persistSkippedSendEvent({
      dryRun: options.dryRun,
      lead,
      outreachMessageId: row.id,
      subject: row.subject,
      reason: 'contact_form_available',
    })
  }

  for (const row of blockedEmailQueue) {
    const lead = row.leads
    if (!lead) continue
    const reason = getLeadEmailAutopilotDecision(lead, suppressions).reason || 'missing_email'
    incrementCount(skipReasonCounts, reason)
    await persistSkippedSendEvent({
      dryRun: options.dryRun,
      lead,
      outreachMessageId: row.id,
      subject: row.subject,
      reason,
    })
  }

  const balancedEmailQueue = balanceEmailQueueByService(emailReadyQueue, sendLimit * queueMultiplier)

  for (const row of balancedEmailQueue) {
    if (shouldStopForBudget(startedAtMs, budgetMs, 4000)) {
      truncated = true
      break
    }

    const lead = row.leads
    if (!lead) continue

    let currentRow = row
    let currentLead = lead
    let decision = getLeadEmailAutopilotDecision(currentLead, suppressions)

    if (
      !options.dryRun &&
      (decision.reason === 'missing_email' || decision.reason === 'invalid_email') &&
      currentLead.website
    ) {
      const enrichment = await enrichLeadContactEmail(currentLead).catch(() => null)
      if (enrichment?.updated) {
        currentLead = enrichment.lead
        decision = getLeadEmailAutopilotDecision(currentLead, suppressions)
        enrichedInQueueCount += 1
      }
    }

    const qualityIssue = validateOutreachMessageQuality({ lead: currentLead, message: currentRow })
    if (qualityIssue) {
      incrementCount(skipReasonCounts, qualityIssue)
      await persistSkippedSendEvent({
        dryRun: options.dryRun,
        lead: currentLead,
        outreachMessageId: currentRow.id,
        subject: currentRow.subject,
        reason: qualityIssue,
      })
      sendResults.push({
        leadId: currentLead.id,
        status: 'blocked',
        detail: qualityIssue,
      })
      continue
    }

    if (!options.dryRun && row.status === 'needs_review' && decision.eligible) {
      const approvedAt = new Date().toISOString()
      const approvedMessage = await updateOutreachMessage(row.id, {
        status: 'approved',
        approved_at: approvedAt,
        approved_by_user_id: null,
      })
      currentRow = { ...currentRow, ...approvedMessage }
      currentLead = await updateLeadRecord(lead.id, { outreach_status: 'approved' })
      await insertOutreachSendEvent({
        leadId: lead.id,
        outreachMessageId: row.id,
        channel: 'email',
        status: 'approved',
        recipient: lead.email,
        subject: row.subject,
        metadata: {
          action: 'auto_approved_from_send_queue',
          autoApproved: true,
          leadScore: lead.lead_score,
          bounceRiskScore: lead.bounce_risk_score,
        },
      })
      autoApprovedCount += 1
    }

    const canSend =
      autoSendEnabled &&
      !options.dryRun &&
      decision.eligible &&
      currentRow.status === 'approved'

    if (!canSend) {
      const contactFormUrls = getLeadContactFormUrls(currentLead)
      const reason =
        !autoSendEnabled
          ? 'auto_send_disabled'
          : options.dryRun
            ? 'dry_run'
            : decision.reason === 'missing_email' && contactFormUrls.length
              ? 'contact_form_available'
            : currentRow.status !== 'approved'
              ? decision.reason || 'manual_review_required'
              : decision.reason || 'manual_review_required'

      skipReasonCounts.set(reason, (skipReasonCounts.get(reason) || 0) + 1)

      if (!options.dryRun && reason === 'contact_form_available') {
        await createAdminTask({
          title: 'Review website contact-form outreach',
          description: `This lead does not have a usable email, but its website exposes a contact form.\n\nReview the form path and submit a tailored message if it still fits your outreach rules.\n\nForm URLs:\n${contactFormUrls.join('\n')}`,
          taskType: 'lead_contact_form_outreach',
          priority: 'normal',
          entityType: 'lead',
          entityId: currentLead.id,
          userEmail: currentLead.email ?? null,
          dueAt: adminTaskDueDates.hours(8),
          metadata: {
            website: currentLead.website,
            contactFormUrls,
            outreachMessageId: currentRow.id,
            suggestedSubject: currentRow.subject,
          },
        })
      }

      const shouldPersistSkipEvent = currentRow.status === 'approved' || reason === 'auto_send_disabled'

      if (shouldPersistSkipEvent) {
        await persistSkippedSendEvent({
          dryRun: options.dryRun,
          lead: currentLead,
          outreachMessageId: currentRow.id,
          subject: currentRow.subject,
          reason,
        })
      }

      sendResults.push({
        leadId: currentLead.id,
        status: 'approved_pending_send',
        detail: reason,
      })
      continue
    }

    await updateOutreachMessage(currentRow.id, { status: 'queued', send_provider: null, send_error: null })
    await insertOutreachSendEvent({
      leadId: currentLead.id,
      outreachMessageId: currentRow.id,
      channel: 'email',
      status: 'queued',
      recipient: currentLead.email,
      subject: currentRow.subject,
    })

    const sendResult = await sendLeadOutreachEmail({ lead: currentLead, message: currentRow })
    if (sendResult.ok) {
      await Promise.all([
        updateOutreachMessage(currentRow.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          send_provider: sendResult.provider,
          send_error: null,
        }),
        updateLeadRecord(currentLead.id, {
          status: 'contacted',
          outreach_status: 'sent',
          delivery_status: 'sent',
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        insertOutreachSendEvent({
          leadId: currentLead.id,
          outreachMessageId: currentRow.id,
          channel: 'email',
          provider: sendResult.provider,
          status: 'sent',
          recipient: currentLead.email,
          subject: currentRow.subject,
          metadata: { providerMessageId: sendResult.providerMessageId || null },
        }),
        logEvent({
          eventType: 'email_sent',
          entityType: 'lead',
          entityId: currentLead.id,
          metadata: { channel: 'email', provider: sendResult.provider, outreachMessageId: currentRow.id },
        }),
        sendLeadOutreachSentAlertEmail({
          leadId: currentLead.id,
          leadType: currentLead.lead_type,
          name: currentLead.name || currentLead.business_name || null,
          email: currentLead.email,
          provider: sendResult.provider,
          subject: currentRow.subject,
          sourcePath: currentLead.source_url || currentLead.source || null,
          deliveryMode: 'queue',
        }),
      ])
      sendResults.push({ leadId: currentLead.id, status: 'sent', provider: sendResult.provider })
      incrementCount(sentServiceCounts, classifyOutreachService(currentLead, currentRow.subject || ''))
      sentCount += 1
    } else {
      const countsAsProviderFailure =
        sendResult.provider !== 'none' && !/blocked before send/i.test(sendResult.error || '')
      if (countsAsProviderFailure) providerFailureCount += 1
      await updateOutreachMessage(currentRow.id, {
        status: 'failed',
        send_provider: sendResult.provider,
        send_error: sendResult.error || 'Send failed.',
      })
      await updateLeadRecord(currentLead.id, {
        outreach_status: 'failed',
        delivery_status: /bounce/i.test(sendResult.error || '') ? 'bounced' : 'failed',
      })
      await insertOutreachSendEvent({
        leadId: currentLead.id,
        outreachMessageId: currentRow.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'failed',
        recipient: currentLead.email,
        subject: currentRow.subject,
        errorMessage: sendResult.error,
        metadata: { reason: sendResult.error || 'send_failed' },
      })
      sendResults.push({
        leadId: currentLead.id,
        status: 'failed',
        provider: sendResult.provider,
        detail: sendResult.error,
      })
      await logEvent({
        eventType: 'email_failed',
        entityType: 'lead',
        entityId: currentLead.id,
        metadata: { channel: 'email', provider: sendResult.provider, outreachMessageId: currentRow.id, error: sendResult.error },
      })

      if (countsAsProviderFailure && providerFailureCount >= providerFailureStopThreshold) {
        circuitBreakerTripped = true
        truncated = true
        incrementCount(skipReasonCounts, 'provider_failure_circuit_breaker')
        break
      }
    }

    if (sentCount >= sendLimit) break
  }

  await sendAdminDigest(
    'VestBlock outreach send queue report',
    'Send queue summary',
    [
      `Daily email target: ${sendLimit}`,
      `Email-ready candidates reviewed: ${emailReadyQueue.length}`,
      `Manual contact-form leads routed to tasks: ${manualContactFormQueue.length}${manualContactFormTaskCount ? ` (${manualContactFormTaskCount} new tasks)` : ''}`,
      `Blocked no-email candidates held out of email sending: ${blockedEmailQueue.length}`,
      `Auto-approved by autopilot: ${autoApprovedCount}`,
      `Emails recovered by in-queue enrichment: ${enrichedInQueueCount}`,
      `Emails sent: ${sentCount}`,
      `Provider failures this run: ${providerFailureCount}${circuitBreakerTripped ? ' (send queue stopped by circuit breaker)' : ''}`,
      `Target status: ${sentCount >= sendLimit ? 'hit' : `behind by ${sendLimit - sentCount}`}`,
      `Email-ready service mix: ${formatCountMap(emailReadyServiceCounts)}`,
      `Sent service mix: ${formatCountMap(sentServiceCounts)}`,
      `Queued for review or skipped: ${sendResults.filter((item) => item.status !== 'sent').length}`,
      `Top skip reasons: ${
        Array.from(skipReasonCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([reason, count]) => `${reason} (${count})`)
          .join(', ') || 'None'
      }`,
      `Auto-send enabled: ${autoSendEnabled ? 'Yes' : 'No'}`,
    ],
    'admin_lead_send_daily_report'
  )

  const missingEmailSkips = skipReasonCounts.get('missing_email') || 0
  const underfilledQueue = sentCount < sendLimit

  if (!options.dryRun && underfilledQueue) {
    const topSkipReasons = Array.from(skipReasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason} (${count})`)
      .join(', ') || 'none'

    await createAdminTask({
      title: 'Lead send queue underfilled daily send target',
      description: `Email send volume finished below the expected daily cap.\n\nSent: ${sentCount}\nTarget: ${sendLimit}\nRecovered by in-queue enrichment: ${enrichedInQueueCount}\nAuto-approved: ${autoApprovedCount}\nTop skip reasons: ${topSkipReasons}\n\nFix the dominant skip reason before the next send cycle.`,
      taskType: 'lead_send_queue_breach',
      priority: 'urgent',
      entityType: 'lead_send_queue',
      entityId: 'daily_send_target',
      dueAt: adminTaskDueDates.now(),
      metadata: {
        sendLimit,
        sentCount,
        emailReadyQueueCount: emailReadyQueue.length,
        manualContactFormQueueCount: manualContactFormQueue.length,
        blockedEmailQueueCount: blockedEmailQueue.length,
        enrichedInQueueCount,
        autoApprovedCount,
        providerFailureCount,
        circuitBreakerTripped,
        sentServiceCounts: Object.fromEntries(sentServiceCounts.entries()),
        emailReadyServiceCounts: Object.fromEntries(emailReadyServiceCounts.entries()),
        skipReasonCounts: Object.fromEntries(skipReasonCounts.entries()),
      },
    })

    if (missingEmailSkips > 0) {
      await createAdminTask({
        title: 'Lead send queue blocked by missing email coverage',
        description: `A meaningful share of the send queue was blocked by missing emails.\n\nMissing-email skips this run: ${missingEmailSkips}\nTarget send cap: ${sendLimit}\n\nPrioritize enrichment, alternate contact paths, or phone/SMS-first routing for these leads.`,
        taskType: 'lead_send_queue_missing_email',
        priority: 'high',
        entityType: 'lead_send_queue',
        entityId: 'missing_email_blocker',
        dueAt: adminTaskDueDates.now(),
        metadata: {
          sendLimit,
          sentCount,
          missingEmailSkips,
          skipReasonCounts: Object.fromEntries(skipReasonCounts.entries()),
        },
      })
    }
  }

  return {
    ok: true,
    approvedCount: queue.filter((item) => item.status === 'approved').length + autoApprovedCount,
    autoApprovedCount,
    enrichedInQueueCount,
    emailReadyQueueCount: emailReadyQueue.length,
    manualContactFormQueueCount: manualContactFormQueue.length,
    manualContactFormTaskCount,
    blockedEmailQueueCount: blockedEmailQueue.length,
    sentServiceCounts: Object.fromEntries(sentServiceCounts.entries()),
    emailReadyServiceCounts: Object.fromEntries(emailReadyServiceCounts.entries()),
    sentCount: sendResults.filter((item) => item.status === 'sent').length,
    truncated,
    skipReasonCounts: Object.fromEntries(skipReasonCounts.entries()),
    providerFailureCount,
    circuitBreakerTripped,
    sendResults,
  }
}

export async function runLeadThroughputSprint(options: LeadAutomationOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const target = options.sendLimit || getLeadThroughputTargetPerRun()
  const enrichmentBase = envInt('LEADS_DAILY_EMAIL_ENRICH_LIMIT', 250)
  const outreachBase = envInt('LEADS_DAILY_OUTREACH_LIMIT', 300)
  const firstOutreachLimit = scaleLeadWorkset(outreachBase, target, 4, 600)
  const fallbackEnrichmentLimit = scaleLeadWorkset(Math.ceil(enrichmentBase / 2), target, 3, 300)

  const firstSend = await runDailyLeadSendQueue({
    ...options,
    sendLimit: target,
    budgetMs,
    startedAtMs,
  })

  const remainingAfterFirstSend = Math.max(0, target - firstSend.sentCount)
  const firstOutreach =
    remainingAfterFirstSend > 0 && getRemainingBudgetMs(startedAtMs, budgetMs) > 12000
      ? await runDailyLeadOutreach({
          ...options,
          outreachGenerationLimit: Math.max(options.outreachGenerationLimit || 0, firstOutreachLimit),
          budgetMs,
          startedAtMs,
        })
      : null

  const secondSend =
    remainingAfterFirstSend > 0 && getRemainingBudgetMs(startedAtMs, budgetMs) > 8000
      ? await runDailyLeadSendQueue({
          ...options,
          sendLimit: remainingAfterFirstSend,
          budgetMs,
          startedAtMs,
        })
      : null

  const remainingTarget = Math.max(0, target - firstSend.sentCount - (secondSend?.sentCount || 0))

  let fallbackEnrichment: Awaited<ReturnType<typeof runDailyLeadEmailEnrichment>> | null = null

  if (
    !options.dryRun &&
    remainingTarget > 0 &&
    getRemainingBudgetMs(startedAtMs, budgetMs) > 12000 &&
    !firstSend.truncated &&
    !(secondSend?.truncated)
  ) {
    fallbackEnrichment = await runDailyLeadEmailEnrichment({
      limit: fallbackEnrichmentLimit,
      dryRun: options.dryRun,
      budgetMs,
      startedAtMs,
    })
  }

  const sentTotal = firstSend.sentCount + (secondSend?.sentCount || 0)
  const approvedTotal = firstSend.approvedCount + (secondSend?.approvedCount || 0)
  const autoApprovedTotal = firstSend.autoApprovedCount + (secondSend?.autoApprovedCount || 0)
  const enrichedInQueueTotal =
    firstSend.enrichedInQueueCount + (secondSend?.enrichedInQueueCount || 0)

  return {
    ok: true,
    target,
    budgetMs,
    sentTotal,
    remainingTarget: Math.max(0, target - sentTotal),
    approvedTotal,
    autoApprovedTotal,
    enrichedInQueueTotal,
    truncated:
      firstSend.truncated ||
      Boolean(firstOutreach?.truncated) ||
      Boolean(secondSend?.truncated) ||
      Boolean(fallbackEnrichment?.truncated),
    firstPass: {
      send: firstSend,
      outreach: firstOutreach,
    },
    secondPass:
      secondSend || fallbackEnrichment
        ? {
            send: secondSend,
            enrichment: fallbackEnrichment,
          }
        : null,
  }
}

export async function runDailyLeadFollowup(options: LeadAutomationOptions = {}) {
  const dueFollowups = await listLeadsNeedingFollowup(100)
  const followupItems: string[] = []
  for (const lead of dueFollowups.slice(0, envInt('LEADS_DAILY_FOLLOWUP_TASK_LIMIT', 30))) {
    await createLeadFollowupTask({
      leadId: lead.id,
      leadType: lead.lead_type,
      name: lead.name || lead.business_name,
      email: lead.email,
      sourcePath: lead.source_url,
      immediate: true,
    })
    followupItems.push(`${leadLabel(lead)} — ${lead.best_offer || lead.category || lead.lead_type}`)
  }

  if (!options.dryRun) {
    await sendAdminDigest(
      'VestBlock growth follow-up queue',
      'Leads needing follow-up',
      followupItems,
      'admin_lead_followup'
    )
  }

  return {
    ok: true,
    followupCount: followupItems.length,
    followupItems,
  }
}

export async function runDailyMarketPerformanceUpdate() {
  const updated = await updateMarketPerformance()
  return {
    ok: true,
    count: updated.length,
    paused: updated.filter((market) => market.status === 'paused').length,
    requeued: updated.filter((market) => market.status === 'queued').length,
  }
}
