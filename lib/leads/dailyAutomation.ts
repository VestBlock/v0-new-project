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
import { searchWeakWebPresenceBusinesses } from '@/lib/leads/connectors/weak-web-presence'
import { searchWisconsinBusinesses } from '@/lib/leads/connectors/wisconsin-dfi'
import { getOutboundProviderReadiness, sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { buildOutreachV2EmailDraft, getOutreachV2DailyTarget, isOutreachV2Enabled } from '@/lib/leads/outreachV2'
import { classifyLeadRevenueCampaign, getRevenueCampaignAllocation, REVENUE_CAMPAIGN_ORDER, validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { buildSourceFamilyFilters } from '@/lib/leads/source-keys'
import { discoverMarkets, markMarketRunResult, pickDiscoveryTermsForMarket, updateMarketPerformance } from '@/lib/leads/marketExpansion'
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
import type { LeadRecord, TargetMarketRecord } from '@/lib/leads/types'
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
  lastScrapedAt?: string | null
  performanceScore?: number
}

type LeadAutomationOptions = {
  dryRun?: boolean
  scrapeLimitPerSource?: number
  outreachGenerationLimit?: number
  sendLimit?: number
  budgetMs?: number
  startedAtMs?: number
  emailReadyRefillOnly?: boolean
  allowImmediateAutoSendDuringOutreachGeneration?: boolean
  refillMarketCount?: number
  refillMarketOffset?: number
  refillNicheCount?: number
  refillMapTimeoutMs?: number
  weakWebPresenceOnly?: boolean
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
  { city: 'Phoenix', state: 'AZ', language: 'en', region: 'US' },
  { city: 'Houston', state: 'TX', language: 'en', region: 'US' },
  { city: 'Dallas', state: 'TX', language: 'en', region: 'US' },
  { city: 'Atlanta', state: 'GA', language: 'en', region: 'US' },
  { city: 'San Antonio', state: 'TX', language: 'en', region: 'US' },
  { city: 'Charlotte', state: 'NC', language: 'en', region: 'US' },
  { city: 'Austin', state: 'TX', language: 'en', region: 'US' },
  { city: 'Las Vegas', state: 'NV', language: 'en', region: 'US' },
  { city: 'Indianapolis', state: 'IN', language: 'en', region: 'US' },
  { city: 'Nashville', state: 'TN', language: 'en', region: 'US' },
  { city: 'Tampa', state: 'FL', language: 'en', region: 'US' },
  { city: 'Miami', state: 'FL', language: 'en', region: 'US' },
  { city: 'Raleigh', state: 'NC', language: 'en', region: 'US' },
  { city: 'St. Louis', state: 'MO', language: 'en', region: 'US' },
  { city: 'Cleveland', state: 'OH', language: 'en', region: 'US' },
]

const LOW_EMAIL_YIELD_NICHE_TERMS = [
  'bar',
  'cafe',
  'coffee',
  'food truck',
  'immigration',
  'pizza',
  'restaurant',
  'salon',
]

const EMAIL_REFILL_PRIORITY_NICHES = [
  'commercial restoration companies',
  'insurance restoration contractors',
  'residential remodeling companies',
  'design-build remodelers',
  'construction project management companies',
  'commercial roofing companies',
  'public adjusters',
  'business funding brokers',
  'equipment finance brokers',
  'invoice factoring companies',
  'recruiting agencies',
  'property management companies',
  'restoration companies',
  'general contractors',
  'commercial renovation contractors',
  'roofing contractors',
  'HVAC contractors',
  'plumbing contractors',
  'law firms',
  'dental clinics',
  'medical spas',
  'tax services',
  'insurance agencies',
  'hard money lenders',
  'private lenders',
  'business funding brokers',
  'staffing agencies',
  'marketing agencies',
  'commercial cleaning companies',
  'sign installation companies',
  'permit expediting services',
  'owner representative firms',
]

const WEAK_WEB_PRESENCE_NICHES = [
  'med spas',
  'dental clinics',
  'chiropractors',
  'salons',
  'barbershops',
  'auto repair shops',
  'tax preparers',
  'insurance agencies',
  'roofing contractors',
  'HVAC contractors',
  'plumbing contractors',
  'cleaning companies',
  'landscaping companies',
  'general contractors',
  'home remodeling companies',
  'property management companies',
]

const LOW_QUALITY_REFILL_PATTERNS = [
  'department of',
  'public school',
  'university',
  'college',
  'church',
  'nonprofit',
  'non-profit',
  'charity',
  'immigration services',
  'city of ',
  'county of ',
  'state of ',
  '.gov',
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

function envNonNegativeInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function getLeadDailyTarget() {
  if (isOutreachV2Enabled()) {
    return getOutreachV2DailyTarget()
  }
  return envInt('LEADS_TARGET_EMAILS_PER_DAY', envInt('LEADS_DAILY_SEND_LIMIT', 100))
}

async function getLeadEmailSentCountLast24h() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('outreach_send_events')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .eq('status', 'sent')
    .gte('created_at', since)

  if (error) throw error
  return count || 0
}

function isLeadEmailReady(lead: LeadRecord | null | undefined) {
  return Boolean(lead && lead.email_valid !== false && isUsableContactEmail(lead.email))
}

function getLeadThroughputTargetPerRun() {
  const dailyTarget = getLeadDailyTarget()
  return envInt('LEADS_THROUGHPUT_SEND_LIMIT_PER_RUN', Math.min(dailyTarget, 35))
}

function shouldRunRefillDuringDryRun() {
  return envBool('LEADS_THROUGHPUT_DRY_RUN_REFILL', true)
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function rotateStrings(values: string[], offset: number) {
  if (!values.length) return []
  const normalizedOffset = Math.max(0, offset) % values.length
  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)]
}

function normalizeEmailRefillNiches(niches: string[], count = 4, offset = 0) {
  const seen = new Set<string>()
  const cleaned = [...niches, ...EMAIL_REFILL_PRIORITY_NICHES].filter((niche) => {
    const normalized = niche.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return !LOW_EMAIL_YIELD_NICHE_TERMS.some((term) => normalized.includes(term))
  })

  return rotateStrings(cleaned, offset).slice(0, count)
}

function shouldSkipLowQualityRefillLead(lead: {
  businessName?: string | null
  name?: string | null
  website?: string | null
  category?: string | null
  niche?: string | null
}) {
  const haystack = [lead.businessName, lead.name, lead.website, lead.category, lead.niche]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return LOW_QUALITY_REFILL_PATTERNS.some((pattern) => haystack.includes(pattern))
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

function getEmailRefillMarketOffset(now = new Date()) {
  const dayStart = Date.UTC(now.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - dayStart) / 86400000)
  const cronSlot = Math.floor(now.getUTCHours() / 2)
  return envNonNegativeInt('LEADS_THROUGHPUT_REFILL_MARKET_OFFSET', dayOfYear * 3 + cronSlot)
}

function rotateMarketConfigs<T extends MarketConfig>(configs: T[], offset: number, limit: number) {
  if (!configs.length) return []
  const normalizedOffset = Math.max(0, offset) % configs.length
  return [...configs.slice(normalizedOffset), ...configs.slice(0, normalizedOffset)].slice(0, limit)
}

function marketScrapeAgeDays(market: MarketConfig) {
  if (!market.lastScrapedAt) return Number.POSITIVE_INFINITY
  const lastScrapedMs = Date.parse(market.lastScrapedAt)
  if (!Number.isFinite(lastScrapedMs)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((Date.now() - lastScrapedMs) / 86400000))
}

function sortMarketsForRotation<T extends MarketConfig>(configs: T[]) {
  return [...configs].sort((left, right) => {
    const leftAge = marketScrapeAgeDays(left)
    const rightAge = marketScrapeAgeDays(right)
    const leftFresh = leftAge < 7
    const rightFresh = rightAge < 7
    if (leftFresh !== rightFresh) return leftFresh ? 1 : -1

    const performanceDelta = (right.performanceScore || 0) - (left.performanceScore || 0)
    if (performanceDelta !== 0) return performanceDelta

    return `${left.city}:${left.state}`.localeCompare(`${right.city}:${right.state}`)
  })
}

function marketLanguage(market: Pick<TargetMarketRecord, 'spanish_business_score'>) {
  if (!envBool('LEADS_ENABLE_SPANISH_MARKET_REFILL', false)) return 'en'
  return Number(market.spanish_business_score || 0) >= 7 ? 'es' : 'en'
}

function marketToRefillConfig(market: TargetMarketRecord): MarketConfig {
  return {
    id: market.id,
    city: market.city,
    state: market.state,
    language: marketLanguage(market),
    region: 'US',
    preferredNiches: normalizeEmailRefillNiches(pickDiscoveryTermsForMarket(market, 'small_business')),
    lastScrapedAt: market.last_scraped_at,
    performanceScore: Number(market.performance_json?.performanceScore || 0),
  }
}

async function listMarketsForOutreachRefill(limit: number) {
  const admin = createAdminClient()
  const fetchLimit = Math.min(Math.max(limit * 20, 80), 250)
  const { data, error } = await admin
    .from('target_markets')
    .select('*')
    .neq('status', 'paused')
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .order('final_score', { ascending: false, nullsFirst: false })
    .limit(fetchLimit)

  if (error) throw error

  return ((data || []) as TargetMarketRecord[])
    .filter((market) => market.city && market.state && market.status !== 'paused')
    .map(marketToRefillConfig)
}

async function buildDailyBusinessMarketConfigs(limit: number, offset = 0) {
  const activeMarkets = await listMarketsForOutreachRefill(limit).catch(() => [])

  if (activeMarkets.length) {
    const seen = new Set(activeMarkets.map((market) => `${market.city}:${market.state}:${market.language || 'en'}`.toLowerCase()))
    const spanishRefillEnabled = envBool('LEADS_ENABLE_SPANISH_MARKET_REFILL', false)
    const fallbackConfigs = DEFAULT_MARKETS.filter((market) => {
      if (!spanishRefillEnabled && market.language === 'es') return false
      const key = `${market.city}:${market.state}:${market.language || 'en'}`.toLowerCase()
      return !seen.has(key)
    }).map((market) => ({
      ...market,
      preferredNiches:
        market.language === 'es'
          ? ['spanish-speaking contractors', 'spanish-speaking tax services', 'spanish-speaking insurance agencies', 'spanish-speaking property managers']
          : normalizeEmailRefillNiches(DEFAULT_GOOGLE_PLACES_NICHES, 6),
    }))
    const orderedConfigs = sortMarketsForRotation([...activeMarkets, ...fallbackConfigs])

    return rotateMarketConfigs(orderedConfigs, offset, limit)
  }

  const fallbackMarkets = envBool('LEADS_ENABLE_SPANISH_MARKET_REFILL', false)
    ? DEFAULT_MARKETS
    : DEFAULT_MARKETS.filter((market) => market.language !== 'es')

  return rotateMarketConfigs(fallbackMarkets, offset, limit).map((market) => ({
    ...market,
    preferredNiches:
      market.language === 'es'
        ? ['spanish-speaking contractors', 'spanish-speaking tax services', 'spanish-speaking insurance agencies', 'spanish-speaking property managers']
        : normalizeEmailRefillNiches(DEFAULT_GOOGLE_PLACES_NICHES, 6),
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

function getVerifiedPublicEmailCandidate(lead: LeadRecord) {
  const email = String(lead.email || '').trim().toLowerCase()
  if (!email) return null

  const candidates = Array.isArray(lead.contact_info?.publicEmailCandidates)
    ? (lead.contact_info.publicEmailCandidates as Array<Record<string, unknown>>)
    : []
  const enrichment =
    lead.contact_info?.publicEmailEnrichment &&
    typeof lead.contact_info.publicEmailEnrichment === 'object'
      ? (lead.contact_info.publicEmailEnrichment as Record<string, unknown>)
      : null
  const confidence = String(enrichment?.confidence || '').toLowerCase()

  if (!['medium', 'high'].includes(confidence)) return null

  return (
    candidates.find((candidate) => {
      const candidateEmail = String(candidate.email || '').trim().toLowerCase()
      const reason = String(candidate.reason || '').toLowerCase()
      const score = Number(candidate.score || 0)
      const sourceUrl = String(candidate.sourceUrl || '')

      return (
        candidateEmail === email &&
        score >= 5 &&
        sourceUrl.length > 0 &&
        /contact|about|team|homepage|internal/.test(reason)
      )
    }) || null
  )
}

function shouldAllowMismatchedPublicEmail(lead: LeadRecord, decisionReason: string | null) {
  return decisionReason === 'mismatched_domain' && Boolean(getVerifiedPublicEmailCandidate(lead))
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

function getLeadMarketKey(lead: LeadRecord | null | undefined) {
  const city = String(lead?.city || '').trim()
  const state = String(lead?.state || '').trim()
  return city || state ? [city, state].filter(Boolean).join(', ') : 'Unknown market'
}

function getLeadSourceKey(lead: LeadRecord | null | undefined) {
  return String(lead?.source || 'unknown_source').trim() || 'unknown_source'
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

function balanceEmailQueueByMarket<T extends { leads: LeadRecord | null }>(rows: T[], limit: number) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = getLeadMarketKey(row.leads)
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }

  const orderedKeys = Array.from(groups.entries())
    .sort((left, right) => right[1].length - left[1].length)
    .map(([key]) => key)
  const balanced: T[] = []

  while (balanced.length < limit && orderedKeys.some((key) => (groups.get(key)?.length || 0) > 0)) {
    for (const key of orderedKeys) {
      const next = groups.get(key)?.shift()
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
  const emailReadyRefillOnly = Boolean(options.emailReadyRefillOnly)
  const weakWebPresenceOnly = Boolean(options.weakWebPresenceOnly)
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const results: Array<{ source: string; count: number; status: 'completed' | 'skipped' | 'failed'; detail?: string }> = []
  const admin = createAdminClient()
  const expansionBatchId = `exp-${new Date().toISOString().slice(0, 10)}`
  const marketSummary: Array<{ city: string; state: string; niches: string[]; count: number }> = []

  try {
    if (weakWebPresenceOnly) {
      results.push({
        source: 'discover_markets',
        count: 0,
        status: 'skipped',
        detail: 'Skipped during weak-web-only scraping so the run can test website/opportunity prospects quickly.',
      })
    } else {
      await discoverMarkets()
    }
  } catch (error) {
    results.push({
      source: 'discover_markets',
      count: 0,
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  if (emailReadyRefillOnly || weakWebPresenceOnly) {
    results.push({
      source: 'public_record_sources',
      count: 0,
      status: 'skipped',
      detail: weakWebPresenceOnly
        ? 'Skipped during weak-web-only scraping so the run focuses on businesses with poor or missing websites.'
        : 'Skipped during throughput refill so the run focuses on business sources with websites and email-enrichment potential.',
    })
  } else {
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
  }

  const mapsProvider = resolveDailyMapsProvider()
  if (weakWebPresenceOnly) {
    results.push({
      source: 'maps_businesses',
      count: 0,
      status: 'skipped',
      detail: 'Skipped normal maps scraping because weak-web-only mode runs the website-opportunity lane directly.',
    })
  } else if (!mapsProvider) {
    results.push({
      source: 'maps_businesses',
      count: 0,
      status: 'skipped',
      detail: isLegacyGooglePlacesPhaseOutEnabled()
        ? 'Daily maps scraping now requires OUTSCRAPER_API_KEY. Google Places remains stored as a legacy source only.'
        : 'Add OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY to enable daily maps scraping.',
    })
  } else {
    const refillMarketOffset = emailReadyRefillOnly
      ? options.refillMarketOffset ?? getEmailRefillMarketOffset()
      : 0
    const marketConfigs: MarketConfig[] = await buildDailyBusinessMarketConfigs(
      emailReadyRefillOnly
        ? options.refillMarketCount || envInt('LEADS_THROUGHPUT_REFILL_MARKET_COUNT', 1)
        : envInt('LEADS_DAILY_MARKET_COUNT', 6),
      refillMarketOffset
    )

    for (const market of marketConfigs) {
      if (shouldStopForBudget(startedAtMs, budgetMs, emailReadyRefillOnly ? 18000 : 6000)) {
        results.push({
          source: `maps:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'skipped',
          detail: 'Skipped to keep the cron run within its serverless time budget.',
        })
        break
      }

      try {
        const baseNiches = market.preferredNiches?.length
          ? market.preferredNiches
          : market.language === 'es'
            ? ['spanish-speaking contractors', 'spanish-speaking tax services', 'spanish-speaking insurance agencies', 'spanish-speaking property managers']
            : DEFAULT_GOOGLE_PLACES_NICHES.slice(0, 6)
        const niches = emailReadyRefillOnly
          ? normalizeEmailRefillNiches(
              baseNiches,
              options.refillNicheCount || envInt('LEADS_THROUGHPUT_REFILL_NICHE_COUNT', 2),
              refillMarketOffset
            )
          : baseNiches
        const limitPerNiche = emailReadyRefillOnly
          ? Math.max(1, Math.floor(scrapeLimitPerSource / Math.max(niches.length, 1)))
          : Math.max(3, Math.floor(scrapeLimitPerSource / Math.max(niches.length, 1)))
        const mapSearch =
          mapsProvider === 'outscraper'
            ? searchOutscraperGoogleMaps({
                city: market.city,
                state: market.state,
                language: market.language || 'en',
                region: market.region || 'US',
                niches,
                limitPerNiche,
                includeWebsiteAnalysis: !emailReadyRefillOnly,
                requestTimeoutMs: emailReadyRefillOnly
                  ? options.refillMapTimeoutMs || envMs('LEADS_THROUGHPUT_REFILL_MAPS_TIMEOUT_MS', 12000)
                  : envMs('LEADS_DAILY_MAPS_TIMEOUT_MS', 30000),
              })
            : searchGooglePlaces({
                city: market.city,
                state: market.state,
                language: market.language || 'en',
                region: market.region || 'US',
                niches,
                limitPerNiche,
                includeWebsiteAnalysis: false,
              })
        const leads = await withTimeout(
          mapSearch,
          emailReadyRefillOnly
            ? options.refillMapTimeoutMs || envMs('LEADS_THROUGHPUT_REFILL_MAPS_TIMEOUT_MS', 12000)
            : envMs('LEADS_DAILY_MAPS_TIMEOUT_MS', 30000),
          `${mapsProvider === 'outscraper' ? 'Outscraper Maps' : 'Google Places'} ${market.city}`
        )

        const sourceKey =
          mapsProvider === 'outscraper'
            ? 'outscraper_google_maps_businesses'
            : 'google_places_businesses'
        const stagedLeads = leads
          .map((lead) => ({
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
          .filter((lead) => !shouldSkipLowQualityRefillLead(lead))
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
              { scoreOnIngest: true, autoGenerateOutreach: !emailReadyRefillOnly }
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

  const apifyRefillEnabled = envBool('LEADS_ENABLE_APIFY_YELP_REFILL', true)
  if (
    !weakWebPresenceOnly &&
    (!emailReadyRefillOnly || apifyRefillEnabled) &&
    envBool('LEADS_ENABLE_APIFY_YELP', true) &&
    process.env.APIFY_TOKEN
  ) {
    const apifyMarketOffset = emailReadyRefillOnly
      ? (options.refillMarketOffset ?? getEmailRefillMarketOffset()) +
        (options.refillMarketCount || envInt('LEADS_THROUGHPUT_REFILL_MARKET_COUNT', 1))
      : 0
    const apifyMarketConfigs = await buildDailyBusinessMarketConfigs(
      emailReadyRefillOnly
        ? options.refillMarketCount || envInt('LEADS_THROUGHPUT_REFILL_APIFY_MARKET_COUNT', 1)
        : envInt('LEADS_DAILY_APIFY_MARKET_COUNT', 2),
      apifyMarketOffset
    )
    const apifyPerNicheLimit = emailReadyRefillOnly
      ? envInt('LEADS_THROUGHPUT_REFILL_APIFY_LIMIT_PER_NICHE', Math.max(2, Math.floor(scrapeLimitPerSource / 3)))
      : envInt('LEADS_DAILY_APIFY_YELP_LIMIT_PER_NICHE', Math.max(4, Math.floor(scrapeLimitPerSource / 2)))

    for (const market of apifyMarketConfigs) {
      if (shouldStopForBudget(startedAtMs, budgetMs, emailReadyRefillOnly ? 16000 : 6000)) {
        results.push({
          source: `apify_yelp_businesses:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'skipped',
          detail: 'Skipped to keep the cron run within its serverless time budget.',
        })
        break
      }

      try {
        const nicheCount = emailReadyRefillOnly
          ? options.refillNicheCount || envInt('LEADS_THROUGHPUT_REFILL_APIFY_NICHE_COUNT', 2)
          : envInt('LEADS_DAILY_APIFY_NICHE_COUNT', 2)
        const niches = normalizeEmailRefillNiches(
          market.preferredNiches?.length ? market.preferredNiches : DEFAULT_GOOGLE_PLACES_NICHES,
          nicheCount,
          apifyMarketOffset
        )
        const leads = await searchApifyYelp({
          city: market.city,
          state: market.state,
          niches,
          limitPerNiche: apifyPerNicheLimit,
          proxyCountry: process.env.APIFY_PROXY_COUNTRY || 'US',
        })

        const stagedLeads = leads
          .map((lead) => ({
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
          .filter((lead) => !shouldSkipLowQualityRefillLead(lead))

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
              { scoreOnIngest: true, autoGenerateOutreach: !emailReadyRefillOnly }
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
    const apifySkipDetail = weakWebPresenceOnly
      ? 'Skipped during weak-web-only scraping.'
      : !process.env.APIFY_TOKEN
        ? 'Add APIFY_TOKEN to enable Apify Yelp lead expansion.'
        : emailReadyRefillOnly && !apifyRefillEnabled
          ? 'Apify Yelp refill is disabled by LEADS_ENABLE_APIFY_YELP_REFILL.'
          : 'Apify Yelp expansion is disabled by LEADS_ENABLE_APIFY_YELP.'

    results.push({
      source: 'apify_yelp_businesses',
      count: 0,
      status: 'skipped',
      detail: apifySkipDetail,
    })
  }

  if (
    !emailReadyRefillOnly &&
    (weakWebPresenceOnly || envBool('LEADS_ENABLE_WEAK_WEB_PRESENCE_LANE', false)) &&
    process.env.OUTSCRAPER_API_KEY
  ) {
    const weakMarketOffset = envNonNegativeInt('LEADS_WEAK_WEB_MARKET_OFFSET', getEmailRefillMarketOffset())
    const weakMarketConfigs = await buildDailyBusinessMarketConfigs(
      envInt('LEADS_WEAK_WEB_MARKET_COUNT', 1),
      weakMarketOffset
    )
    const weakNicheCount = envInt('LEADS_WEAK_WEB_NICHE_COUNT', 3)
    const weakLimitPerNiche = envInt('LEADS_WEAK_WEB_LIMIT_PER_NICHE', 3)

    for (const market of weakMarketConfigs) {
      if (shouldStopForBudget(startedAtMs, budgetMs, 18000)) {
        results.push({
          source: `weak_web_presence_businesses:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'skipped',
          detail: 'Skipped to keep the cron run within its serverless time budget.',
        })
        break
      }

      try {
        const niches = normalizeEmailRefillNiches(
          market.preferredNiches?.length ? market.preferredNiches : WEAK_WEB_PRESENCE_NICHES,
          weakNicheCount,
          weakMarketOffset
        )
        const leads = await searchWeakWebPresenceBusinesses({
          city: market.city,
          state: market.state,
          language: market.language || 'en',
          region: market.region || 'US',
          niches,
          limitPerNiche: weakLimitPerNiche,
          requestTimeoutMs: envMs('LEADS_WEAK_WEB_TIMEOUT_MS', 25000),
        })
        const stagedLeads = leads
          .map((lead) => ({
            ...lead,
            niche: lead.niche || niches[0] || null,
            targetMarketId: market.id ?? null,
            expansionBatchId,
            marketSegment: 'weak_web_presence',
            campaignName: 'weak_web_presence_services',
            emailValid: lead.email ? true : null,
            metadata: {
              ...(lead.metadata || {}),
              weakWebPresence: true,
              targetCity: market.city,
              targetState: market.state,
              expansionBatchId,
            },
          }))
          .filter((lead) => !shouldSkipLowQualityRefillLead(lead))
        const saved = options.dryRun
          ? stagedLeads
          : await ingestNormalizedLeads(
              'weak_web_presence_businesses',
              'weak_web_presence_scrape',
              {
                market,
                niches,
                expansionBatchId,
                weakWebPresence: true,
              },
              stagedLeads,
              {
                scoreOnIngest: true,
                autoGenerateOutreach: false,
                sourceDefinition: {
                  name: 'Weak Web Presence Businesses',
                  category: 'website_upgrade',
                  sourceType: 'maps_search',
                  baseUrl: 'https://outscraper.com/google-maps-scraper/',
                  city: market.city,
                  state: market.state,
                  configJson: {
                    weakWebPresence: true,
                    niches,
                    provider: 'outscraper',
                  },
                },
              }
            )

        if (!options.dryRun && market.id) {
          await markMarketRunResult(market.id, saved.length)
        }

        if (!options.dryRun && saved.length) {
          const taskLimit = envInt('LEADS_WEAK_WEB_TASK_LIMIT_PER_MARKET', 10)
          await Promise.all(
            (saved as LeadRecord[]).slice(0, taskLimit).map((lead) =>
              createLeadFollowupTask({
                leadId: lead.id,
                leadType: lead.lead_type,
                name: lead.business_name || lead.name,
                email: lead.email,
                phone: lead.phone,
                city: lead.city,
                state: lead.state,
                sourcePath: lead.source_url || lead.website,
                immediate: false,
                summary:
                  'Weak web presence prospect: review website/contact signals and decide whether to pitch website upgrade, AI receptionist, or search visibility.',
              })
            )
          )
        }

        results.push({
          source: `weak_web_presence_businesses:${market.city}:${market.language || 'en'}`,
          count: saved.length,
          status: saved.length ? 'completed' : 'skipped',
          detail: saved.length
            ? 'Saved weak/no-website prospects for website, AI receptionist, and search visibility follow-up.'
            : 'No weak/no-website prospects found in this market slice.',
        })
      } catch (error) {
        results.push({
          source: `weak_web_presence_businesses:${market.city}:${market.language || 'en'}`,
          count: 0,
          status: 'failed',
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } else if (!emailReadyRefillOnly && (weakWebPresenceOnly || envBool('LEADS_ENABLE_WEAK_WEB_PRESENCE_LANE', false))) {
    results.push({
      source: 'weak_web_presence_businesses',
      count: 0,
      status: 'skipped',
      detail: 'Add OUTSCRAPER_API_KEY to enable the weak/no-website business lane.',
    })
  }

  const samEnabled = !emailReadyRefillOnly && !weakWebPresenceOnly && envBool('LEADS_ENABLE_SAM', false)
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

  if (!options.dryRun) {
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
  }

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

        if (!options.dryRun && currentLead.website) {
          const enrichment = await enrichLeadContactEmail(currentLead).catch(() => null)
          if (enrichment?.lead) {
            currentLead = enrichment.lead
            enrichedEmail = enrichment.updated
          }
        }

        const messages = options.dryRun
          ? []
          : await generateAndStoreOutreachForLead(currentLead, {
              allowImmediateAutoSend: options.allowImmediateAutoSendDuringOutreachGeneration ?? true,
            })
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
  if (!options.dryRun) {
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
  }
  return { ok: true, count: results.length, attempted: leads.length, truncated, results }
}

export async function runDailyLeadSendQueue(options: LeadAutomationOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const dailyTarget = getLeadDailyTarget()
  const requestedSendLimit = options.sendLimit || (isOutreachV2Enabled() ? dailyTarget : envInt('LEADS_DAILY_SEND_LIMIT', 100))
  const sentLast24h = isOutreachV2Enabled() ? await getLeadEmailSentCountLast24h() : 0
  const targetGap24h = isOutreachV2Enabled() ? Math.max(0, dailyTarget - sentLast24h) : requestedSendLimit
  const sendLimit = isOutreachV2Enabled() ? Math.min(requestedSendLimit, targetGap24h) : requestedSendLimit
  const autoSendApproved = envBool('AUTO_SEND_ENABLED', envBool('LEADS_AUTO_SEND_APPROVED', false))
  const queueMultiplier = envInt('LEADS_DAILY_SEND_QUEUE_MULTIPLIER', 10)
  const manualContactFormTaskLimit = envInt('LEADS_CONTACT_FORM_TASK_LIMIT_PER_RUN', 15)
  const providerFailureStopThreshold = envInt('LEADS_PROVIDER_FAILURE_STOP_THRESHOLD', 5)
  const queue = await listEmailOutreachForSendQueue(sendLimit * queueMultiplier)
  const suppressions = await listSuppressions().catch(() => [])
  const autoSendEnabled = autoSendApproved
  const outboundReadiness = getOutboundProviderReadiness()
  const sendResults: Array<{ leadId: string; status: string; provider?: string; detail?: string }> = []
  const skipReasonCounts = new Map<string, number>()
  const sentServiceCounts = new Map<string, number>()
  const emailReadyServiceCounts = new Map<string, number>()
  const emailReadyMarketCounts = new Map<string, number>()
  const emailReadySourceCounts = new Map<string, number>()
  const sentMarketCounts = new Map<string, number>()
  const sentSourceCounts = new Map<string, number>()
  let autoApprovedCount = 0
  let enrichedInQueueCount = 0
  let autoRepairedMessageCount = 0
  let manualContactFormTaskCount = 0
  let providerFailureCount = 0
  let sentCount = 0
  let truncated = false
  let circuitBreakerTripped = false
  const getQueueRowContactFormCount = (lead: LeadRecord | null | undefined) =>
    lead ? getLeadContactFormUrls(lead).length : 0
  const emailReadyQueue = queue.filter((row) => isLeadEmailReady(row.leads))
  const manualContactFormQueue = queue.filter(
    (row) => !isLeadEmailReady(row.leads) && getQueueRowContactFormCount(row.leads) > 0
  )
  const blockedEmailQueue = queue.filter(
    (row) => !isLeadEmailReady(row.leads) && getQueueRowContactFormCount(row.leads) === 0
  )

  if (!options.dryRun && autoSendEnabled && !outboundReadiness.mailingAddressConfigured) {
    await createAdminTask({
      title: 'Add mailing address before outbound email resumes',
      description:
        'Auto-send is enabled, but cold outreach is blocked because no compliant business mailing address is configured. Add OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS in the deployment environment before running prospect sends.',
      taskType: 'lead_outreach_compliance_blocker',
      priority: 'urgent',
      entityType: 'lead_send_queue',
      entityId: 'missing_mailing_address',
      dueAt: adminTaskDueDates.now(),
      metadata: {
        sendLimit,
        emailReadyQueueCount: emailReadyQueue.length,
        blockedReason: 'missing_mailing_address',
        outboundProvider: outboundReadiness.defaultProvider,
      },
    })
  }

  for (const row of emailReadyQueue) {
    incrementCount(emailReadyServiceCounts, classifyOutreachService(row.leads, row.subject || ''))
    incrementCount(emailReadyMarketCounts, getLeadMarketKey(row.leads))
    incrementCount(emailReadySourceCounts, getLeadSourceKey(row.leads))
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

  const balancedEmailQueue = balanceEmailQueueByMarket(
    balanceEmailQueueByService(emailReadyQueue, sendLimit * queueMultiplier),
    sendLimit * queueMultiplier
  )

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
    let allowVerifiedPublicEmail = shouldAllowMismatchedPublicEmail(currentLead, decision.reason)

    if (
      !options.dryRun &&
      (decision.reason === 'missing_email' || decision.reason === 'invalid_email') &&
      currentLead.website
    ) {
      const enrichment = await enrichLeadContactEmail(currentLead).catch(() => null)
      if (enrichment?.updated) {
        currentLead = enrichment.lead
        decision = getLeadEmailAutopilotDecision(currentLead, suppressions)
        allowVerifiedPublicEmail = shouldAllowMismatchedPublicEmail(currentLead, decision.reason)
        enrichedInQueueCount += 1
      }
    }
    const effectiveEligible = decision.eligible || allowVerifiedPublicEmail

    let qualityIssue = validateOutreachMessageQuality({ lead: currentLead, message: currentRow })
    if (qualityIssue && isOutreachV2Enabled()) {
      const draft = buildOutreachV2EmailDraft(currentLead)
      const repairedRow = {
        ...currentRow,
        subject: draft.subject,
        body: draft.body,
        cta: draft.cta,
        compliance_note: draft.complianceNote,
      }
      const repairIssue = validateOutreachMessageQuality({ lead: currentLead, message: repairedRow })
      if (!repairIssue) {
        if (!options.dryRun) {
          const updatedRow = await updateOutreachMessage(currentRow.id, {
            subject: draft.subject,
            body: draft.body,
            cta: draft.cta,
            compliance_note: draft.complianceNote,
            generated_with: 'outreach_v2',
            send_error: null,
            last_generated_at: new Date().toISOString(),
          })
          currentRow = { ...currentRow, ...updatedRow }
        } else {
          currentRow = repairedRow
        }
        autoRepairedMessageCount += 1
        qualityIssue = null
      }
    }
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

    if (
      !options.dryRun &&
      autoSendEnabled &&
      outboundReadiness.mailingAddressConfigured &&
      effectiveEligible &&
      currentRow.status === 'needs_review'
    ) {
      const approvedAt = new Date().toISOString()
      const approvedRow = await updateOutreachMessage(currentRow.id, {
        status: 'approved',
        approved_at: approvedAt,
        approved_by_user_id: null,
        send_error: null,
      })

      await Promise.all([
        updateLeadRecord(currentLead.id, { outreach_status: 'approved' }),
        insertOutreachSendEvent({
          leadId: currentLead.id,
          outreachMessageId: currentRow.id,
          channel: 'email',
          status: 'approved',
          recipient: currentLead.email,
          subject: approvedRow.subject || currentRow.subject,
          metadata: {
            action: 'throughput_safe_auto_approved',
            source: 'runDailyLeadSendQueue',
            leadScore: currentLead.lead_score,
            bounceRiskScore: currentLead.bounce_risk_score,
          },
        }),
        logEvent({
          eventType: 'outreach_approved',
          entityType: 'lead',
          entityId: currentLead.id,
          metadata: {
            autoApproved: true,
            source: 'runDailyLeadSendQueue',
            outreachMessageId: currentRow.id,
            leadScore: currentLead.lead_score,
            bounceRiskScore: currentLead.bounce_risk_score,
          },
        }),
      ])

      currentRow = { ...currentRow, ...approvedRow, status: 'approved' }
      autoApprovedCount += 1
    }

    const canSend =
      autoSendEnabled &&
      !options.dryRun &&
      outboundReadiness.mailingAddressConfigured &&
      effectiveEligible &&
      currentRow.status === 'approved'

    if (!canSend) {
      const contactFormUrls = getLeadContactFormUrls(currentLead)
      const reason =
        !autoSendEnabled
          ? 'auto_send_disabled'
          : options.dryRun
            ? 'dry_run'
            : !outboundReadiness.mailingAddressConfigured
              ? 'missing_mailing_address'
              : decision.reason === 'missing_email' && contactFormUrls.length
                ? 'contact_form_available'
                : currentRow.status !== 'approved'
                  ? decision.reason || 'manual_review_required'
                  : allowVerifiedPublicEmail
                    ? 'verified_public_email_pending_send'
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
      metadata: allowVerifiedPublicEmail
        ? {
            allowedReason: 'verified_public_email_candidate',
            originalGuardrail: decision.reason,
          }
        : undefined,
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
      incrementCount(sentMarketCounts, getLeadMarketKey(currentLead))
      incrementCount(sentSourceCounts, getLeadSourceKey(currentLead))
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

  const sendQueueDigestItems = [
    `Daily email target: ${dailyTarget}`,
    `Already sent in last 24 hours: ${sentLast24h}`,
    `Remaining quality send cap this run: ${sendLimit}`,
    `Email-ready candidates reviewed: ${emailReadyQueue.length}`,
    `Manual contact-form leads routed to tasks: ${manualContactFormQueue.length}${manualContactFormTaskCount ? ` (${manualContactFormTaskCount} new tasks)` : ''}`,
    `Blocked no-email candidates held out of email sending: ${blockedEmailQueue.length}`,
    `Auto-approved by autopilot: ${autoApprovedCount}`,
    `Auto-repaired stale approved copy: ${autoRepairedMessageCount}`,
    `Emails recovered by in-queue enrichment: ${enrichedInQueueCount}`,
    `Emails sent: ${sentCount}`,
    `Provider failures this run: ${providerFailureCount}${circuitBreakerTripped ? ' (send queue stopped by circuit breaker)' : ''}`,
    `Target status: ${sentCount >= sendLimit ? 'hit' : `behind by ${sendLimit - sentCount}`}`,
    `Email-ready service mix: ${formatCountMap(emailReadyServiceCounts)}`,
    `Email-ready city mix: ${formatCountMap(emailReadyMarketCounts)}`,
    `Email-ready source mix: ${formatCountMap(emailReadySourceCounts)}`,
    `Sent service mix: ${formatCountMap(sentServiceCounts)}`,
    `Sent city mix: ${formatCountMap(sentMarketCounts)}`,
    `Sent source mix: ${formatCountMap(sentSourceCounts)}`,
    `Queued for review or skipped: ${sendResults.filter((item) => item.status !== 'sent').length}`,
    `Top skip reasons: ${
      Array.from(skipReasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => `${reason} (${count})`)
        .join(', ') || 'None'
    }`,
    `Auto-send enabled: ${autoSendEnabled ? 'Yes' : 'No'}`,
    `Mailing address configured: ${outboundReadiness.mailingAddressConfigured ? 'Yes' : 'No'}`,
    `Outbound provider: ${outboundReadiness.defaultProvider}`,
  ]

  if (!options.dryRun) {
    await sendAdminDigest(
      'VestBlock outreach send queue report',
      'Send queue summary',
      sendQueueDigestItems,
      'admin_lead_send_daily_report'
    )
  }

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
        dailyTarget,
        sentLast24h,
        targetGap24h,
        sendLimit,
        sentCount,
        emailReadyQueueCount: emailReadyQueue.length,
        manualContactFormQueueCount: manualContactFormQueue.length,
        blockedEmailQueueCount: blockedEmailQueue.length,
        enrichedInQueueCount,
        autoRepairedMessageCount,
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
    dailyTarget,
    sentLast24hBeforeRun: sentLast24h,
    targetGap24hBeforeRun: targetGap24h,
    requestedSendLimit,
    effectiveSendLimit: sendLimit,
    approvedCount: queue.filter((item) => item.status === 'approved').length + autoApprovedCount,
    autoApprovedCount,
    enrichedInQueueCount,
    autoRepairedMessageCount,
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
    mailingAddressConfigured: outboundReadiness.mailingAddressConfigured,
    outboundProvider: outboundReadiness.defaultProvider,
    digestPreview: options.dryRun ? sendQueueDigestItems : undefined,
    sendResults,
  }
}

export async function runLeadThroughputSprint(options: LeadAutomationOptions = {}) {
  const startedAtMs = options.startedAtMs || Date.now()
  const budgetMs = options.budgetMs || envMs('LEADS_CRON_BUDGET_MS', 45000)
  const target = options.sendLimit || getLeadThroughputTargetPerRun()
  const enrichmentBase = envInt('LEADS_DAILY_EMAIL_ENRICH_LIMIT', 250)
  const outreachBase = envInt('LEADS_DAILY_OUTREACH_LIMIT', 300)
  const refillEnabled = envBool('LEADS_THROUGHPUT_REFILL_ENABLED', true)
  const firstOutreachLimit = scaleLeadWorkset(outreachBase, target, 4, 600)
  const fallbackEnrichmentLimit = scaleLeadWorkset(Math.ceil(enrichmentBase / 2), target, 3, 300)
  const refillScrapeLimit = envInt(
    'LEADS_THROUGHPUT_REFILL_SCRAPE_LIMIT_PER_SOURCE',
    Math.min(16, Math.max(6, Math.ceil(target / 2)))
  )

  const firstSend = await runDailyLeadSendQueue({
    ...options,
    sendLimit: target,
    budgetMs,
    startedAtMs,
  })

  const remainingAfterFirstSend = Math.max(0, target - firstSend.sentCount)

  const preDraftEnrichment =
    !options.dryRun &&
    remainingAfterFirstSend > 0 &&
    getRemainingBudgetMs(startedAtMs, budgetMs) > 14000 &&
    !firstSend.truncated
      ? await runDailyLeadEmailEnrichment({
          limit: fallbackEnrichmentLimit,
          dryRun: options.dryRun,
          budgetMs,
          startedAtMs,
        })
      : null

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

  const remainingAfterSecondSend = Math.max(0, target - firstSend.sentCount - (secondSend?.sentCount || 0))

  let refillScrape: Awaited<ReturnType<typeof runDailyLeadScrape>> | null = null
  let refillOutreach: Awaited<ReturnType<typeof runDailyLeadOutreach>> | null = null
  let finalSend: Awaited<ReturnType<typeof runDailyLeadSendQueue>> | null = null

  if (
    (!options.dryRun || shouldRunRefillDuringDryRun()) &&
    refillEnabled &&
    remainingAfterSecondSend > 0 &&
    getRemainingBudgetMs(startedAtMs, budgetMs) > 18000 &&
    !firstSend.truncated &&
    !(secondSend?.truncated)
  ) {
    refillScrape = await runDailyLeadScrape({
      ...options,
      scrapeLimitPerSource: Math.max(options.scrapeLimitPerSource || 0, refillScrapeLimit),
      emailReadyRefillOnly: true,
      dryRun: options.dryRun,
      budgetMs,
      startedAtMs,
    })

    if (getRemainingBudgetMs(startedAtMs, budgetMs) > 10000) {
      refillOutreach = await runDailyLeadOutreach({
        ...options,
        outreachGenerationLimit: Math.max(
          options.outreachGenerationLimit || 0,
          scaleLeadWorkset(outreachBase, remainingAfterSecondSend, 5, 750)
        ),
        budgetMs,
        startedAtMs,
      })
    }

    if (getRemainingBudgetMs(startedAtMs, budgetMs) > 6000) {
      finalSend = await runDailyLeadSendQueue({
        ...options,
        sendLimit: remainingAfterSecondSend,
        budgetMs,
        startedAtMs,
      })
    }
  }

  const sentTotal = firstSend.sentCount + (secondSend?.sentCount || 0) + (finalSend?.sentCount || 0)
  const remainingTarget = Math.max(0, target - sentTotal)

  if (!options.dryRun && remainingTarget > 0 && !firstSend.truncated && !(secondSend?.truncated) && !(finalSend?.truncated)) {
    await createAdminTask({
      title: 'Daily outreach target missed because qualified lead supply is short',
      description: `The throughput sprint could not safely reach the email target.\n\nTarget: ${target}\nSent this sprint: ${sentTotal}\nRemaining gap: ${remainingTarget}\n\nThe system attempted safe send, email enrichment, draft generation, and email-ready lead refill. Keep the send guardrails; fix this by adding better email-ready sources or increasing enrichment coverage, not by sending weak/no-email leads.`,
      taskType: 'lead_throughput_supply_gap',
      priority: remainingTarget >= Math.ceil(target / 2) ? 'urgent' : 'high',
      entityType: 'lead_throughput',
      entityId: `target-gap-${new Date().toISOString().slice(0, 10)}`,
      dueAt: adminTaskDueDates.now(),
      metadata: {
        target,
        sentTotal,
        remainingTarget,
        firstSendCount: firstSend.sentCount,
        secondSendCount: secondSend?.sentCount || 0,
        finalSendCount: finalSend?.sentCount || 0,
        refillCreated: refillScrape?.totalCreated || 0,
        refillEnabled,
      },
    })
  }

  const approvedTotal = firstSend.approvedCount + (secondSend?.approvedCount || 0) + (finalSend?.approvedCount || 0)
  const autoApprovedTotal = firstSend.autoApprovedCount + (secondSend?.autoApprovedCount || 0) + (finalSend?.autoApprovedCount || 0)
  const enrichedInQueueTotal =
    firstSend.enrichedInQueueCount + (secondSend?.enrichedInQueueCount || 0) + (finalSend?.enrichedInQueueCount || 0)

  return {
    ok: true,
    target,
    budgetMs,
    sentTotal,
    remainingTarget,
    approvedTotal,
    autoApprovedTotal,
    enrichedInQueueTotal,
    refillEnabled,
    refillScrapeLimit,
    truncated:
      firstSend.truncated ||
      Boolean(firstOutreach?.truncated) ||
      Boolean(secondSend?.truncated) ||
      Boolean(preDraftEnrichment?.truncated) ||
      Boolean(refillOutreach?.truncated) ||
      Boolean(finalSend?.truncated),
    firstPass: {
      send: firstSend,
      enrichment: preDraftEnrichment,
      outreach: firstOutreach,
    },
    secondPass: secondSend
      ? {
          send: secondSend,
        }
      : null,
    refillPass:
      refillScrape || refillOutreach || finalSend
        ? {
            scrape: refillScrape,
            outreach: refillOutreach,
            send: finalSend,
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
