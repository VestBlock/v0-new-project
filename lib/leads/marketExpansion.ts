import { addDays, differenceInDays } from 'date-fns'
import { DEFAULT_BUYER_DISCOVERY_NICHES } from '@/lib/buyers/constants'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LENDER_DISCOVERY_NICHES } from '@/lib/lenders/constants'
import { findMarketPreset } from '@/lib/leads/marketPresets'
import type { MarketDiscoverySummary, MarketSeed, TargetMarketRecord } from '@/lib/leads/types'

const ROTATING_NICHES = [
  'contractors',
  'roofers',
  'cleaning companies',
  'trucking companies',
  'restaurants',
  'barbershops',
  'salons',
  'auto repair',
  'real estate investors',
  'property managers',
  'tax preparers',
  'insurance agencies',
  'clinics',
  'med spas',
  'law firms',
  'new LLCs',
  'Spanish-speaking businesses',
] as const

const MARKET_SEEDS: MarketSeed[] = [
  { city: 'Milwaukee', state: 'WI', metroArea: 'Milwaukee Metro', population: 561385, primaryNiches: ['contractors', 'restaurants', 'barbershops'] },
  { city: 'Madison', state: 'WI', metroArea: 'Madison Metro', population: 280305, primaryNiches: ['clinics', 'law firms', 'new LLCs'] },
  { city: 'Green Bay', state: 'WI', metroArea: 'Green Bay Metro', population: 107395, primaryNiches: ['roofers', 'auto repair', 'tax preparers'] },
  { city: 'Chicago', state: 'IL', metroArea: 'Chicago Metro', population: 2665000, primaryNiches: ['restaurants', 'salons', 'property managers'] },
  { city: 'Aurora', state: 'IL', metroArea: 'Chicago Metro', population: 180542, primaryNiches: ['cleaning companies', 'contractors', 'Spanish-speaking businesses'] },
  { city: 'Rockford', state: 'IL', metroArea: 'Rockford Metro', population: 146120, primaryNiches: ['roofers', 'auto repair', 'law firms'] },
  { city: 'Indianapolis', state: 'IN', metroArea: 'Indianapolis Metro', population: 879293, primaryNiches: ['trucking companies', 'contractors', 'insurance agencies'] },
  { city: 'Fort Wayne', state: 'IN', metroArea: 'Fort Wayne Metro', population: 269994, primaryNiches: ['cleaning companies', 'clinics', 'new LLCs'] },
  { city: 'Gary', state: 'IN', metroArea: 'Northwest Indiana', population: 68215, primaryNiches: ['property managers', 'roofers', 'real estate investors'] },
  { city: 'Detroit', state: 'MI', metroArea: 'Detroit Metro', population: 633218, primaryNiches: ['auto repair', 'restaurants', 'contractors'] },
  { city: 'Grand Rapids', state: 'MI', metroArea: 'Grand Rapids Metro', population: 198917, primaryNiches: ['med spas', 'law firms', 'cleaning companies'] },
  { city: 'Flint', state: 'MI', metroArea: 'Flint Metro', population: 79854, primaryNiches: ['property managers', 'roofers', 'tax preparers'] },
  { city: 'Columbus', state: 'OH', metroArea: 'Columbus Metro', population: 905748, primaryNiches: ['clinics', 'law firms', 'trucking companies'] },
  { city: 'Cleveland', state: 'OH', metroArea: 'Cleveland Metro', population: 362656, primaryNiches: ['contractors', 'auto repair', 'property managers'] },
  { city: 'Cincinnati', state: 'OH', metroArea: 'Cincinnati Metro', population: 309513, primaryNiches: ['restaurants', 'tax preparers', 'Spanish-speaking businesses'] },
  { city: 'Atlanta', state: 'GA', metroArea: 'Atlanta Metro', population: 510823, primaryNiches: ['clinics', 'med spas', 'insurance agencies'] },
  { city: 'Savannah', state: 'GA', metroArea: 'Savannah Metro', population: 147748, primaryNiches: ['restaurants', 'cleaning companies', 'property managers'] },
  { city: 'Macon', state: 'GA', metroArea: 'Macon Metro', population: 157346, primaryNiches: ['roofers', 'contractors', 'tax preparers'] },
  { city: 'Houston', state: 'TX', metroArea: 'Houston Metro', population: 2304580, primaryNiches: ['trucking companies', 'clinics', 'real estate investors'] },
  { city: 'Dallas', state: 'TX', metroArea: 'Dallas-Fort Worth', population: 1304379, primaryNiches: ['law firms', 'insurance agencies', 'med spas'] },
  { city: 'San Antonio', state: 'TX', metroArea: 'San Antonio Metro', population: 1492510, primaryNiches: ['Spanish-speaking businesses', 'restaurants', 'auto repair'] },
  { city: 'Austin', state: 'TX', metroArea: 'Austin Metro', population: 979882, primaryNiches: ['new LLCs', 'clinics', 'salons'] },
  { city: 'Miami', state: 'FL', metroArea: 'Miami Metro', population: 455924, primaryNiches: ['Spanish-speaking businesses', 'med spas', 'insurance agencies'] },
  { city: 'Orlando', state: 'FL', metroArea: 'Orlando Metro', population: 316081, primaryNiches: ['restaurants', 'property managers', 'cleaning companies'] },
  { city: 'Tampa', state: 'FL', metroArea: 'Tampa Metro', population: 403364, primaryNiches: ['roofers', 'contractors', 'law firms'] },
  { city: 'Nashville', state: 'TN', metroArea: 'Nashville Metro', population: 689447, primaryNiches: ['law firms', 'clinics', 'property managers'] },
  { city: 'Memphis', state: 'TN', metroArea: 'Memphis Metro', population: 618639, primaryNiches: ['trucking companies', 'auto repair', 'tax preparers'] },
  { city: 'Knoxville', state: 'TN', metroArea: 'Knoxville Metro', population: 198162, primaryNiches: ['roofers', 'cleaning companies', 'new LLCs'] },
  { city: 'Charlotte', state: 'NC', metroArea: 'Charlotte Metro', population: 911311, primaryNiches: ['insurance agencies', 'clinics', 'contractors'] },
  { city: 'Raleigh', state: 'NC', metroArea: 'Research Triangle', population: 482295, primaryNiches: ['new LLCs', 'law firms', 'med spas'] },
  { city: 'Greensboro', state: 'NC', metroArea: 'Greensboro Metro', population: 302296, primaryNiches: ['auto repair', 'tax preparers', 'restaurants'] },
  { city: 'Phoenix', state: 'AZ', metroArea: 'Phoenix Metro', population: 1650070, primaryNiches: ['roofers', 'property managers', 'Spanish-speaking businesses'] },
  { city: 'Tucson', state: 'AZ', metroArea: 'Tucson Metro', population: 547239, primaryNiches: ['clinics', 'contractors', 'auto repair'] },
  { city: 'Mesa', state: 'AZ', metroArea: 'Phoenix Metro', population: 511648, primaryNiches: ['salons', 'restaurants', 'insurance agencies'] },
  { city: 'Las Vegas', state: 'NV', metroArea: 'Las Vegas Metro', population: 660929, primaryNiches: ['med spas', 'restaurants', 'property managers'] },
  { city: 'Henderson', state: 'NV', metroArea: 'Las Vegas Metro', population: 337305, primaryNiches: ['law firms', 'clinics', 'roofers'] },
  { city: 'Reno', state: 'NV', metroArea: 'Reno Metro', population: 274915, primaryNiches: ['trucking companies', 'contractors', 'new LLCs'] },
  { city: 'St. Louis', state: 'MO', metroArea: 'St. Louis Metro', population: 281754, primaryNiches: ['property managers', 'law firms', 'auto repair'] },
  { city: 'Kansas City', state: 'MO', metroArea: 'Kansas City Metro', population: 508394, primaryNiches: ['contractors', 'roofers', 'insurance agencies'] },
  { city: 'Springfield', state: 'MO', metroArea: 'Springfield Metro', population: 170188, primaryNiches: ['cleaning companies', 'tax preparers', 'restaurants'] },
  { city: 'Minneapolis', state: 'MN', metroArea: 'Twin Cities Metro', population: 429954, primaryNiches: ['new LLCs', 'clinics', 'property managers'] },
  { city: 'St. Paul', state: 'MN', metroArea: 'Twin Cities Metro', population: 303820, primaryNiches: ['law firms', 'insurance agencies', 'restaurants'] },
  { city: 'Louisville', state: 'KY', metroArea: 'Louisville Metro', population: 622981, primaryNiches: ['contractors', 'roofers', 'auto repair'] },
  { city: 'Birmingham', state: 'AL', metroArea: 'Birmingham Metro', population: 196910, primaryNiches: ['tax preparers', 'clinics', 'property managers'] },
  { city: 'New Orleans', state: 'LA', metroArea: 'New Orleans Metro', population: 364136, primaryNiches: ['restaurants', 'real estate investors', 'insurance agencies'] },
  { city: 'Jacksonville', state: 'FL', metroArea: 'Jacksonville Metro', population: 985843, primaryNiches: ['contractors', 'property managers', 'cleaning companies'] },
  { city: 'Richmond', state: 'VA', metroArea: 'Richmond Metro', population: 230436, primaryNiches: ['new LLCs', 'law firms', 'clinics'] },
  { city: 'Virginia Beach', state: 'VA', metroArea: 'Hampton Roads', population: 457900, primaryNiches: ['restaurants', 'roofers', 'auto repair'] },
  { city: 'Philadelphia', state: 'PA', metroArea: 'Philadelphia Metro', population: 1567442, primaryNiches: ['property managers', 'med spas', 'restaurants'] },
  { city: 'Newark', state: 'NJ', metroArea: 'New York Metro', population: 305344, primaryNiches: ['Spanish-speaking businesses', 'clinics', 'tax preparers'] },
  { city: 'Denver', state: 'CO', metroArea: 'Denver Metro', population: 715522, primaryNiches: ['new LLCs', 'real estate investors', 'law firms'] },
  { city: 'Sacramento', state: 'CA', metroArea: 'Sacramento Metro', population: 528001, primaryNiches: ['property managers', 'contractors', 'clinics'] },
  { city: 'Fresno', state: 'CA', metroArea: 'Central Valley', population: 545716, primaryNiches: ['Spanish-speaking businesses', 'restaurants', 'roofers'] },
]

export type MarketExpansionLane = 'small_business' | 'new_business' | 'buyers' | 'lenders' | 'real_estate'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hash(input: string) {
  let value = 0
  for (let i = 0; i < input.length; i += 1) value = (value << 5) - value + input.charCodeAt(i)
  return Math.abs(value)
}

function classifyMarket(population: number) {
  if (population >= 900000) return 'large'
  if (population >= 250000) return 'mid'
  return 'small'
}

function baseScore(seed: MarketSeed) {
  const populationScore = seed.population >= 1000000 ? 24 : seed.population >= 500000 ? 18 : seed.population >= 200000 ? 13 : 9
  const spanishBoost = /TX|FL|AZ|NV|IL|GA/.test(seed.state) ? 8 : 4
  const fundingNeedScore = seed.population >= 500000 ? 15 : 11
  const aiOpportunityScore = /Milwaukee|Detroit|Cleveland|Memphis|St. Louis|Kansas City|Chicago|Houston|Phoenix/.test(seed.city) ? 15 : 11
  const realEstateScore = /Phoenix|Las Vegas|Tampa|Miami|Atlanta|Charlotte|Nashville|Houston/.test(seed.city) ? 15 : 11
  const newLlcScore = /Austin|Raleigh|Charlotte|Atlanta|Indianapolis|Madison|Dallas/.test(seed.city) ? 16 : 11
  const businessDensityScore = populationScore

  return {
    businessDensityScore,
    newLlcScore,
    fundingNeedScore,
    realEstateScore,
    spanishBoost,
    aiOpportunityScore,
  }
}

async function loadHistoricalPerformance(city: string, state: string) {
  const admin = createAdminClient()
  const { data: leads } = await admin
    .from('leads')
    .select('id,status,delivery_status,best_offer')
    .eq('city', city)
    .eq('state', state)
    .limit(500)

  const leadIds = (leads || []).map((lead) => lead.id).slice(0, 500)
  const sendEvents = leadIds.length
    ? (
        await admin
          .from('outreach_send_events')
          .select('status,error_message')
          .in('lead_id', leadIds)
      ).data
    : []

  const leadCount = leads?.length || 0
  const replied = (leads || []).filter((lead) => ['replied', 'interested', 'qualified', 'closed_won'].includes(lead.status)).length
  const booked = (leads || []).filter((lead) => ['closed_won'].includes(lead.status) || lead.delivery_status === 'booked').length
  const bounced = (leads || []).filter((lead) => lead.delivery_status === 'bounced').length
  const sent = (sendEvents || []).filter((event) => event.status === 'sent').length
  const failed = (sendEvents || []).filter((event) => event.status === 'failed').length

  return {
    leadCount,
    replyRate: sent ? replied / sent : 0,
    bookedRate: sent ? booked / sent : 0,
    bounceRate: sent ? bounced / sent : failed ? failed / Math.max(failed, 1) : 0,
    performanceScore: Math.max(0, Math.round((leadCount > 0 ? 4 : 0) + replied * 5 + booked * 10 - bounced * 4)),
  }
}

function shouldSkipRecent(lastScrapedAt: string | null, performanceScore: number) {
  if (!lastScrapedAt) return false
  const days = differenceInDays(new Date(), new Date(lastScrapedAt))
  if (days >= 30) return false
  return performanceScore < 14
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim())))
}

function rotatedSlice(items: readonly string[], seed: number, count: number) {
  return [...items]
    .sort((a, b) => ((hash(`${a}${seed}`) % 997) - (hash(`${b}${seed}`) % 997)))
    .slice(0, count)
}

function presetIdsForLane(market: Pick<TargetMarketRecord, 'new_llc_score' | 'real_estate_activity_score' | 'spanish_business_score' | 'ai_receptionist_opportunity_score'>, lane: MarketExpansionLane) {
  const ids: string[] = []

  if (lane === 'real_estate' || lane === 'buyers') ids.push('real_estate_money')
  if (lane === 'small_business') ids.push('local_services')
  if (lane === 'new_business') ids.push('new_market_mix')
  if (lane === 'lenders') ids.push('professional_services')

  if (market.new_llc_score >= 15 && lane !== 'buyers') ids.push('new_market_mix')
  if (market.real_estate_activity_score >= 14) ids.push('real_estate_money')
  if (market.spanish_business_score >= 7) ids.push('minority_growth')
  if (market.ai_receptionist_opportunity_score >= 14 && ['small_business', 'new_business'].includes(lane)) ids.push('health_beauty')
  if (lane === 'small_business' || lane === 'lenders') ids.push('professional_services')

  return Array.from(new Set(ids))
}

function laneScore(market: TargetMarketRecord, lane: MarketExpansionLane) {
  switch (lane) {
    case 'new_business':
      return market.final_score + market.new_llc_score * 2.3 + market.funding_need_score * 1.3 + market.spanish_business_score * 0.6
    case 'buyers':
      return market.final_score + market.real_estate_activity_score * 2.7 + market.business_density_score * 1.1
    case 'lenders':
      return market.final_score + market.funding_need_score * 2.2 + market.real_estate_activity_score * 1.5 + market.new_llc_score
    case 'real_estate':
      return market.final_score + market.real_estate_activity_score * 3 + market.business_density_score * 0.9
    case 'small_business':
    default:
      return market.final_score + market.ai_receptionist_opportunity_score * 1.5 + market.business_density_score * 1.2 + market.spanish_business_score * 0.8
  }
}

export function pickNichesForMarket(
  market: Pick<TargetMarketRecord, 'city' | 'state' | 'niche_focus' | 'new_llc_score' | 'real_estate_activity_score' | 'spanish_business_score' | 'ai_receptionist_opportunity_score'>,
  date = new Date(),
  options: { count?: number; lane?: MarketExpansionLane; presetIds?: string[] } = {}
) {
  const seed = hash(`${market.city}-${market.state}-${date.toISOString().slice(0, 10)}`)
  const count = options.count || 4
  const lanePresetIds = options.lane ? presetIdsForLane(market, options.lane) : []
  const presetNiches = uniqueStrings(
    [...(options.presetIds || []), ...lanePresetIds]
      .map((id) => findMarketPreset(id))
      .flatMap((preset) => preset?.niches || [])
  )
  const preferred = market.niche_focus?.length ? market.niche_focus : []
  const rotated = rotatedSlice(ROTATING_NICHES, seed, ROTATING_NICHES.length)
  return uniqueStrings([...preferred, ...presetNiches, ...rotated]).slice(0, count)
}

export function pickDiscoveryTermsForMarket(
  market: Pick<TargetMarketRecord, 'city' | 'state' | 'niche_focus' | 'new_llc_score' | 'real_estate_activity_score' | 'spanish_business_score' | 'ai_receptionist_opportunity_score' | 'funding_need_score'>,
  lane: MarketExpansionLane,
  date = new Date(),
  count = 4
) {
  const seed = hash(`${lane}-${market.city}-${market.state}-${date.toISOString().slice(0, 10)}`)

  if (lane === 'buyers') {
    const boosted = uniqueStrings([
      market.real_estate_activity_score >= 14 ? 'cash home buyer' : null,
      market.real_estate_activity_score >= 14 ? 'fix and flip buyer' : null,
      market.real_estate_activity_score >= 14 ? 'real estate investor' : null,
      market.new_llc_score >= 15 ? 'land buyer' : null,
      ...DEFAULT_BUYER_DISCOVERY_NICHES,
    ])
    return rotatedSlice(boosted, seed, count)
  }

  if (lane === 'lenders') {
    const boosted = uniqueStrings([
      market.real_estate_activity_score >= 14 ? 'DSCR lender' : null,
      market.real_estate_activity_score >= 14 ? 'fix and flip lender' : null,
      market.real_estate_activity_score >= 14 ? 'hard money lender' : null,
      market.funding_need_score >= 13 ? 'small business lender' : null,
      market.funding_need_score >= 13 ? 'SBA lender' : null,
      market.spanish_business_score >= 7 ? 'community development financial institution' : null,
      ...DEFAULT_LENDER_DISCOVERY_NICHES,
    ])
    return rotatedSlice(boosted, seed, count)
  }

  return pickNichesForMarket(market, date, { count, lane })
}

export async function discoverMarkets(): Promise<MarketDiscoverySummary> {
  const admin = createAdminClient()
  const { data: existing } = await admin.from('target_markets').select('*')
  const existingMap = new Map((existing || []).map((market) => [`${market.city}|${market.state}`, market as TargetMarketRecord]))

  const prepared = []
  for (const seed of MARKET_SEEDS) {
    const base = baseScore(seed)
    const historical = await loadHistoricalPerformance(seed.city, seed.state)
    const existingMarket = existingMap.get(`${seed.city}|${seed.state}`)
    const finalScore = Math.round(
      base.businessDensityScore +
      base.newLlcScore +
      base.fundingNeedScore +
      base.realEstateScore +
      base.spanishBoost +
      base.aiOpportunityScore +
      historical.performanceScore
    )

    prepared.push({
      city: seed.city,
      state: seed.state,
      metro_area: seed.metroArea,
      population: seed.population,
      business_density_score: base.businessDensityScore,
      new_llc_score: base.newLlcScore,
      funding_need_score: base.fundingNeedScore,
      real_estate_activity_score: base.realEstateScore,
      spanish_business_score: base.spanishBoost,
      ai_receptionist_opportunity_score: base.aiOpportunityScore,
      final_score: finalScore,
      niche_focus: seed.primaryNiches || [],
      status:
        existingMarket?.status === 'paused'
          ? 'paused'
          : shouldSkipRecent(existingMarket?.last_scraped_at || null, historical.performanceScore)
            ? existingMarket?.status || 'scraped'
            : 'queued',
      last_scraped_at: existingMarket?.last_scraped_at || null,
      performance_json: {
        ...(existingMarket?.performance_json || {}),
        ...historical,
      },
    })
  }

  const { data: upserted, error } = await admin
    .from('target_markets')
    .upsert(prepared, { onConflict: 'city,state' })
    .select('*')

  if (error) throw error

  const queued = (upserted || [])
    .filter((market) => market.status !== 'paused' && !shouldSkipRecent(market.last_scraped_at, Number(market.performance_json?.performanceScore || 0)))
    .sort((a, b) => b.final_score - a.final_score)

  const large = queued.filter((market) => classifyMarket(market.population || 0) === 'large').slice(0, envInt('TARGET_MARKET_ACTIVE_LARGE_COUNT', 4))
  const mid = queued.filter((market) => classifyMarket(market.population || 0) === 'mid').slice(0, envInt('TARGET_MARKET_ACTIVE_MID_COUNT', 6))
  const small = queued.filter((market) => classifyMarket(market.population || 0) === 'small').slice(0, envInt('TARGET_MARKET_ACTIVE_SMALL_COUNT', 8))
  const activeIds = new Set([...large, ...mid, ...small].map((market) => market.id))

  if (activeIds.size) {
    await admin
      .from('target_markets')
      .update({ status: 'queued' })
      .in('status', ['active', 'queued'])

    await admin
      .from('target_markets')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .in('id', Array.from(activeIds))
  }

  return {
    discovered: prepared.length,
    activated: activeIds.size,
    largeMetros: large as TargetMarketRecord[],
    midMarkets: mid as TargetMarketRecord[],
    smallMarkets: small as TargetMarketRecord[],
  }
}

export async function listMarketsForDailyRun() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('target_markets')
    .select('*')
    .in('status', ['active', 'queued'])
    .order('final_score', { ascending: false })
    .limit(envInt('TARGET_MARKET_DAILY_LIMIT', 30))

  if (error) throw error
  return (data || []) as TargetMarketRecord[]
}

export async function listMarketsForExpansionLane(
  lane: MarketExpansionLane,
  options: { limit?: number } = {}
) {
  const markets = await listMarketsForDailyRun()
  const limit = options.limit || envInt(`TARGET_MARKET_${lane.toUpperCase()}_LIMIT`, lane === 'buyers' || lane === 'lenders' ? 4 : 8)
  return [...markets]
    .sort((left, right) => laneScore(right, lane) - laneScore(left, lane))
    .slice(0, limit)
}

export async function markMarketRunResult(marketId: string, foundCount: number) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const status = foundCount > 0 ? 'scraped' : 'exhausted'
  const { data: current } = await admin.from('target_markets').select('performance_json').eq('id', marketId).single()
  const performance = {
    ...(current?.performance_json || {}),
    lastLeadCount: foundCount,
    lastRunAt: now,
  }

  const { data, error } = await admin
    .from('target_markets')
    .update({
      status,
      last_scraped_at: now,
      performance_json: performance,
      updated_at: now,
    })
    .eq('id', marketId)
    .select('*')
    .single()

  if (error) throw error
  return data as TargetMarketRecord
}

export async function updateMarketPerformance() {
  const admin = createAdminClient()
  const { data: markets, error } = await admin.from('target_markets').select('*')
  if (error) throw error

  const updated: TargetMarketRecord[] = []
  for (const market of markets || []) {
    const historical = await loadHistoricalPerformance(market.city, market.state)
    const currentScore = market.final_score - Number(market.performance_json?.performanceScore || 0)
    const nextScore = currentScore + historical.performanceScore
    const status =
      historical.bounceRate >= 0.25
        ? 'paused'
        : historical.replyRate >= 0.08 || historical.bookedRate >= 0.03
          ? 'queued'
          : market.status === 'exhausted'
            ? 'exhausted'
            : market.status

    const { data: saved, error: updateError } = await admin
      .from('target_markets')
      .update({
        final_score: nextScore,
        status,
        performance_json: {
          ...(market.performance_json || {}),
          ...historical,
          nextRecommendedAt:
            status === 'queued'
              ? addDays(new Date(), historical.replyRate >= 0.08 ? 10 : 21).toISOString()
              : null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', market.id)
      .select('*')
      .single()

    if (updateError) throw updateError
    updated.push(saved as TargetMarketRecord)
  }

  return updated
}
