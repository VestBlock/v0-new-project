import type { LeadRecord } from '@/lib/leads/types'
import { evaluateLeadStrategyStack } from '@/lib/admin/strategySourceContracts'

export type StrategySourceProvider = 'dealmachine' | 'homeharvest' | 'public_records' | 'property_intelligence'

export type StrategyLane = {
  key: string
  label: string
  sourceProviders: StrategySourceProvider[]
  markets: string[]
  minimumScore: number
  reviewOnly: boolean
  lowball: boolean
  enabled: boolean
  minMarketPool: number
  maxLeadAgeDays: number
}

const CORE_MARKETS = [
  'Milwaukee, WI',
  'Detroit, MI',
  'Cleveland, OH',
  'Toledo, OH',
  'Buffalo, NY',
  'Kansas City, MO',
  'Memphis, TN',
  'Tulsa, OK',
  'Little Rock, AR',
  'Indianapolis, IN',
  'Louisville, KY',
  'Cincinnati, OH',
  'Columbus, OH',
  'Pittsburgh, PA',
  'Atlanta, GA',
  'Charlotte, NC',
  'Jacksonville, FL',
  'Phoenix, AZ',
  'San Antonio, TX',
]

export const STRATEGY_EXECUTION_LANES: StrategyLane[] = [
  {
    key: 'preforeclosure-equity',
    label: 'Preforeclosure creative options',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: ['Kansas City, MO', 'Tulsa, OK', 'Memphis, TN', 'Little Rock, AR', 'Indianapolis, IN'],
    minimumScore: 75,
    reviewOnly: true,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 30,
  },
  {
    key: 'tax-code-stack',
    label: 'Tax delinquent and code stack',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Toledo, OH', 'Kansas City, MO', 'Wichita, KS'],
    minimumScore: 70,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'tax-remote-equity-rotation',
    label: 'Tax delinquent remote owner',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: ['Milwaukee, WI', 'Cleveland, OH', 'Detroit, MI', 'Buffalo, NY', 'Kansas City, MO'],
    minimumScore: 68,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'lien-equity',
    label: 'Lien with equity',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 68,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'probate-vacant-equity',
    label: 'Probate or inherited vacant property',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: ['Milwaukee, WI', 'Detroit, MI', 'Cleveland, OH', 'Buffalo, NY', 'Kansas City, MO', 'Louisville, KY'],
    minimumScore: 72,
    reviewOnly: true,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 180,
  },
  {
    key: 'portfolio-landlord',
    label: 'Portfolio landlord',
    sourceProviders: ['dealmachine', 'property_intelligence'],
    markets: ['Memphis, TN', 'Kansas City, MO', 'Cleveland, OH', 'Toledo, OH', 'Indianapolis, IN', 'Louisville, KY'],
    minimumScore: 65,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 180,
  },
  {
    key: 'small-multifamily-portfolio',
    label: 'Small multifamily or portfolio breakup',
    sourceProviders: ['dealmachine', 'homeharvest', 'property_intelligence'],
    markets: ['Kansas City, MO', 'Memphis, TN', 'Indianapolis, IN', 'Louisville, KY', 'Cleveland, OH', 'Toledo, OH'],
    minimumScore: 65,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'builder-infill-teardown',
    label: 'Builder infill and teardown',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: ['Kansas City, MO', 'Detroit, MI', 'Cleveland, OH', 'Indianapolis, IN', 'Memphis, TN'],
    minimumScore: 64,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'land-wholesale',
    label: 'Land and buildable lot',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: ['Kansas City, MO', 'Memphis, TN', 'Cleveland, OH', 'Detroit, MI', 'Indianapolis, IN', 'Louisville, KY'],
    minimumScore: 62,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 180,
  },
  {
    key: 'vacant-equity',
    label: 'Vacant property with equity',
    sourceProviders: ['dealmachine', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 65,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'seller-finance-free-clear',
    label: 'Free-and-clear seller finance',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 78,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'subject-to-low-equity',
    label: 'Subject-to low-equity review',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 82,
    reviewOnly: true,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 60,
  },
  {
    key: 'hybrid-equity-bridge',
    label: 'Hybrid cash and terms',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 78,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'novation-retail-equity',
    label: 'Novation retail-equity review',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 80,
    reviewOnly: true,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 90,
  },
  {
    key: 'absentee-equity-creative',
    label: 'Absentee-owner creative options',
    sourceProviders: ['dealmachine', 'homeharvest', 'public_records', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 76,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 1,
    maxLeadAgeDays: 120,
  },
  {
    key: 'active-stale-creative',
    label: 'On-market creative finance',
    sourceProviders: ['dealmachine', 'homeharvest', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 60,
    reviewOnly: false,
    lowball: false,
    enabled: true,
    minMarketPool: 3,
    maxLeadAgeDays: 14,
  },
  {
    key: 'active-stale-lowball',
    label: 'On-market conditional cash review',
    sourceProviders: ['dealmachine', 'homeharvest', 'property_intelligence'],
    markets: CORE_MARKETS,
    minimumScore: 76,
    reviewOnly: true,
    lowball: true,
    enabled: false,
    minMarketPool: 5,
    maxLeadAgeDays: 14,
  },
]

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function boolValue(value: unknown) {
  return value === true || /^(1|true|yes|y)$/i.test(String(value || '').trim())
}

export type StrategyLeadFreshness = {
  fresh: boolean
  observedAt: string | null
  ageDays: number | null
  maxAgeDays: number
  reason: string | null
}

function firstValidTimestamp(values: unknown[]) {
  for (const value of values) {
    const parsed = Date.parse(String(value || ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function getStrategyLeadFreshness(
  lead: LeadRecord,
  lane: Pick<StrategyLane, 'key' | 'maxLeadAgeDays'>,
  now = new Date()
): StrategyLeadFreshness {
  const metadata = lead.metadata_json || {}
  const form = lead.form_data || {}
  const observedAtMs = firstValidTimestamp([
    metadata.sourceObservedAt,
    metadata.attomEnrichedAt,
    metadata.source_observed_at,
    metadata.listingFetchedAt,
    metadata.importedAt,
    form.sourceObservedAt,
    form.source_observed_at,
    lead.imported_at,
    lead.created_at,
  ])

  if (observedAtMs === null) {
    return {
      fresh: false,
      observedAt: null,
      ageDays: null,
      maxAgeDays: lane.maxLeadAgeDays,
      reason: `source freshness: ${lane.key} is missing a trustworthy source timestamp`,
    }
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - observedAtMs) / (24 * 60 * 60 * 1000)))
  const fresh = ageDays <= lane.maxLeadAgeDays
  return {
    fresh,
    observedAt: new Date(observedAtMs).toISOString(),
    ageDays,
    maxAgeDays: lane.maxLeadAgeDays,
    reason: fresh
      ? null
      : `source freshness: ${lane.key} record is ${ageDays} days old; maximum is ${lane.maxLeadAgeDays}`,
  }
}

function leadSignalText(lead: LeadRecord) {
  return [
    lead.source,
    lead.niche,
    lead.market_segment,
    lead.pain_signal,
    lead.outreach_angle,
    lead.notes,
    JSON.stringify(lead.metadata_json || {}),
    JSON.stringify(lead.form_data || {}),
    JSON.stringify(lead.contact_info || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isUncontacted(lead: LeadRecord) {
  if (['contacted', 'replied', 'interested', 'qualified', 'closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'].includes(lead.status)) {
    return false
  }
  if (['sent', 'do_not_contact'].includes(String(lead.outreach_status || ''))) return false
  return !['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'suppressed', 'failed'].includes(
    String(lead.delivery_status || '')
  )
}

function providerMatches(lead: LeadRecord, provider: StrategySourceProvider) {
  const source = String(lead.source || '').toLowerCase()
  if (provider === 'homeharvest') return source.includes('homeharvest') || source.includes('listing')
  if (provider === 'dealmachine') return source.includes('dealmachine')
  if (provider === 'property_intelligence') return source.includes('property_intelligence') || source.includes('attom')
  return source.includes('county') || source.includes('public') || source.includes('court') || source.includes('code')
}

export type StrategyQualification = {
  eligible: boolean
  score: number
  reasons: string[]
  reviewOnly: boolean
}

export function qualifyLeadForStrategy(
  lead: LeadRecord,
  lane: StrategyLane,
  provider: StrategySourceProvider
): StrategyQualification {
  const text = leadSignalText(lead)
  const metadata = lead.metadata_json || {}
  const form = lead.form_data || {}
  const sourceMatched = providerMatches(lead, provider)
  const stack = evaluateLeadStrategyStack(lead, lane.key)
  const reasons: string[] = []
  let score = 0

  if (!lane.enabled || !isUncontacted(lead) || !sourceMatched || !lead.email || lead.email_valid === false || !stack.eligible) {
    if (!stack.eligible && stack.missingGroups.length) {
      reasons.push(...stack.missingGroups.map((group) => `missing required stack signal: ${group.join(' or ')}`))
    }
    return { eligible: false, score: 0, reasons, reviewOnly: lane.reviewOnly }
  }

  const freshness = getStrategyLeadFreshness(lead, lane)
  if (!freshness.fresh) {
    return { eligible: false, score: 0, reasons: [freshness.reason!], reviewOnly: lane.reviewOnly }
  }

  const equityPercent = numberValue(metadata.equityPercent || form.equityPercent)
  const equityAmount = numberValue(metadata.equityAmount || form.equityAmount)
  const ltvPercent = numberValue(metadata.ltvPercent || form.ltvPercent)
  const loanBalance = numberValue(metadata.estimatedLoanBalance || form.estimatedLoanBalance)
  const freeAndClear = boolValue(metadata.freeAndClear || form.freeAndClear)
  const portfolioCount = numberValue(metadata.portfolioCount || form.portfolioCount)
  const units = numberValue(metadata.units || form.units)
  const listPrice = numberValue(form.listPrice || metadata.listPrice || metadata.currentListingPrice)
  const daysOnMarket = numberValue(form.daysOnMarket || metadata.daysOnMarket)
  const propertyType = String(form.style || form.propertyType || metadata.propertyType || '').toLowerCase()
  const hasEquity = equityPercent >= 20 || equityAmount >= 30_000 || /high.?equity|equity/.test(text)
  const isVacant = boolValue(metadata.isVacant || form.isVacant) || /\bvacant\b|boarded|unoccupied/.test(text)
  const isTax = /tax.?delinquent|past.?due.?tax|tax.?lien/.test(text)
  const isCode = /code.?violation|city.?pressure|nuisance|boarded|unsafe.?structure/.test(text)
  const isLien = boolValue(metadata.activeLien || form.activeLien) || /active.?lien|multiple.?liens|water.?lien|hoa.?lien/.test(text)
  const isRemote = /out.?of.?state|absentee|remote.?owner/.test(text)
  const isPreforeclosure = /pre.?foreclosure|auction.?date|notice.?of.?default|lis.?pendens/.test(text)
  const isProbate = /\bprobate\b|\binherit(?:ed|ance)?\b|\bestate (?:of|sale)\b|\bdeceased\b|\bheirs?\b/.test(text)
  const isLand = /\bland\b|vacant.?lot|buildable.?lot|acreage|parcel/.test(text) || propertyType.includes('land')
  const isBuilder = /teardown|infill|fire.?damage|boarded|unsafe.?structure|stuck.?rehab/.test(text)
  const isMultifamily = (units >= 2 && units <= 20) || /duplex|triplex|fourplex|multifamily|multi.?family/.test(text)
  const isPortfolio = portfolioCount >= 4 || /portfolio|multiple.?properties|landlord/.test(text)

  if (lead.email) score += 25
  if (lead.email_valid === true) score += 10
  if (lead.property_address) score += 10
  if (lead.city && lead.state) score += 5
  score += stack.scoreBonus
  reasons.push(`verified stack depth ${stack.stackDepth}; source depth ${stack.sourceDepth}`)

  switch (lane.key) {
    case 'preforeclosure-equity':
      if (isPreforeclosure) {
        score += 45
        reasons.push('preforeclosure signal')
      }
      if (hasEquity) {
        score += 15
        reasons.push('equity signal')
      }
      break
    case 'tax-code-stack':
      if (isTax) {
        score += 25
        reasons.push('tax delinquency signal')
      }
      if (isCode) {
        score += 30
        reasons.push('code or condition signal')
      }
      break
    case 'tax-remote-equity-rotation':
      if (isTax) {
        score += 25
        reasons.push('tax delinquency signal')
      }
      if (isRemote) {
        score += 25
        reasons.push('remote owner signal')
      }
      if (hasEquity) score += 10
      break
    case 'lien-equity':
      if (isLien) {
        score += 35
        reasons.push('lien signal')
      }
      if (hasEquity) {
        score += 20
        reasons.push('equity signal')
      }
      break
    case 'probate-vacant-equity':
      if (isProbate) {
        score += 35
        reasons.push('probate or inherited signal')
      }
      if (isVacant) {
        score += 20
        reasons.push('vacancy signal')
      }
      if (hasEquity) score += 10
      break
    case 'portfolio-landlord':
      if (isPortfolio) {
        score += 35
        reasons.push('portfolio or landlord signal')
      }
      if (isRemote) score += 10
      break
    case 'small-multifamily-portfolio':
      if (isMultifamily) {
        score += 35
        reasons.push('2-20 unit signal')
      }
      if (isPortfolio) score += 15
      break
    case 'builder-infill-teardown':
      if (isBuilder) {
        score += 35
        reasons.push('builder, infill, or teardown signal')
      }
      if (isLand) score += 15
      break
    case 'land-wholesale':
      if (isLand) {
        score += 40
        reasons.push('land or lot signal')
      }
      break
    case 'vacant-equity':
      if (isVacant) {
        score += 35
        reasons.push('vacancy signal')
      }
      if (hasEquity) {
        score += 20
        reasons.push('equity signal')
      }
      break
    case 'seller-finance-free-clear':
      if (freeAndClear || /free.?and.?clear|seller-finance-free-clear/.test(text)) {
        score += 45
        reasons.push('free-and-clear signal')
      }
      break
    case 'subject-to-low-equity':
      if ((ltvPercent >= 80 && loanBalance > 1_000) || /subject-to-low-equity/.test(text)) {
        score += 45
        reasons.push('active loan with limited estimated equity')
      }
      break
    case 'hybrid-equity-bridge':
      if ((equityPercent >= 20 && equityPercent < 80 && loanBalance > 1_000) || /hybrid-equity-bridge/.test(text)) {
        score += 40
        reasons.push('equity and debt support a hybrid structure review')
      }
      break
    case 'novation-retail-equity':
      if ((equityPercent >= 35 && equityAmount >= 40_000) || /novation-retail-equity/.test(text)) {
        score += 42
        reasons.push('estimated retail equity spread')
      }
      break
    case 'absentee-equity-creative':
      if (isRemote && hasEquity) {
        score += 42
        reasons.push('absentee owner with estimated equity')
      }
      break
    case 'active-stale-creative':
      if (daysOnMarket >= 30) {
        score += Math.min(30, 15 + Math.floor(daysOnMarket / 15))
        reasons.push(`${daysOnMarket} days on market`)
      }
      if (listPrice >= 50_000 && listPrice <= 1_000_000) {
        score += 20
        reasons.push('price within creative-finance lane')
      }
      if (/as.?is|price.?cut|back.?on.?market|motivated|seller|tlc|repair|investor/.test(text)) score += 10
      if (isLand) score -= 30
      break
    case 'active-stale-lowball':
      if (daysOnMarket >= 90) score += 25
      if (/as.?is|cash.?only|major.?repair|fire.?damage|teardown/.test(text)) score += 25
      break
  }

  if (isPreforeclosure && !reasons.includes('preforeclosure signal')) {
    reasons.push('sensitive preforeclosure context')
  }
  if (isProbate && !reasons.includes('probate or inherited signal')) {
    reasons.push('sensitive probate or estate-sale context')
  }

  return {
    eligible: reasons.length > 0 && score >= lane.minimumScore,
    score,
    reasons,
    reviewOnly: lane.reviewOnly || isPreforeclosure || isProbate,
  }
}

export function marketLabel(lead: Pick<LeadRecord, 'city' | 'state'>) {
  const city = String(lead.city || '').trim()
  const state = String(lead.state || '').trim().toUpperCase()
  return city && state ? `${city}, ${state}` : null
}

export function splitMarket(market: string) {
  const pieces = market.split(',').map((part) => part.trim())
  return { city: pieces[0] || '', state: (pieces[1] || '').toUpperCase() }
}
