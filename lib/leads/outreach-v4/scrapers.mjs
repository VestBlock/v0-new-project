import { V4_VERTICALS } from './config.mjs'
import { hashString, normalizeKey } from './utils.mjs'

const SAMPLE_BUSINESS_STEMS = [
  'Summit',
  'Harbor',
  'Northline',
  'Ironwood',
  'ClearPath',
  'Keystone',
  'Riverbend',
  'Blue Oak',
  'Anchor',
  'Evergreen',
  'Cornerstone',
  'Frontier',
]

const SAMPLE_DOMAINS = ['co', 'group', 'services', 'pros', 'works']

function businessName({ market, niche, index }) {
  const stem = SAMPLE_BUSINESS_STEMS[(hashString(`${market.city}-${niche}-${index}`) + index) % SAMPLE_BUSINESS_STEMS.length]
  const cleanedNiche = niche
    .replace(/\bcompanies\b/gi, '')
    .replace(/\bbusinesses\b/gi, '')
    .replace(/\bcontractors\b/gi, 'Contractors')
    .trim()
  return `${stem} ${cleanedNiche}`.replace(/\s+/g, ' ')
}

function emailFor(name, market, include = true) {
  if (!include) return null
  const slug = normalizeKey(name).replace(/-/g, '')
  const tld = SAMPLE_DOMAINS[hashString(`${name}-${market.city}`) % SAMPLE_DOMAINS.length]
  const local = hashString(name) % 5 === 0 ? 'info' : 'team'
  return `${local}@${slug}.${tld}`
}

function websiteFor(name, include = true) {
  if (!include) return null
  const slug = normalizeKey(name)
  const tld = SAMPLE_DOMAINS[hashString(name) % SAMPLE_DOMAINS.length]
  return `https://${slug}.${tld}`
}

function makeBusinessLead({ vertical, market, niche, index, date }) {
  const name = businessName({ market, niche, index })
  const hasWebsite = vertical.id !== 'no_website' && hashString(`${name}-website`) % 9 !== 0
  const hasEmail = vertical.id !== 'distressed_house' && hashString(`${name}-email`) % 7 !== 0
  const weakSignals = []

  if (vertical.id === 'ai_receptionist') weakSignals.push('missing_chat_or_receptionist', 'after_hours_lead_capture_gap')
  if (vertical.id === 'search_visibility') weakSignals.push('unclear_service_pages', 'weak_ai_search_readiness')
  if (vertical.id === 'dealvault') weakSignals.push('agreement_or_milestone_recordkeeping_need', 'partner_or_vendor_coordination')
  if (vertical.id === 'funding_prep') weakSignals.push('business_profile_and_document_readiness_gap')
  if (vertical.id === 'no_website') weakSignals.push('no_website_listed', 'weak_search_presence')
  if (vertical.id === 'weak_website') weakSignals.push('missing_clear_cta', 'weak_contact_path')
  if (vertical.id === 'contractors_home_services') weakSignals.push('real_estate_referral_fit', 'contractor_partner_fit')
  if (vertical.id === 'real_estate_partners') weakSignals.push('buyer_seller_lender_partner_fit', 'buy_box_or_lending_criteria_needed')

  return {
    id: `v4_${vertical.id}_${normalizeKey(market.city)}_${normalizeKey(niche)}_${index}`,
    scrapedAt: `${date}T12:00:00.000Z`,
    source: `outreach_v4_${vertical.id}_dry_run`,
    sourceType: 'dry_run_vertical_scraper',
    vertical: vertical.id,
    verticalLabel: vertical.label,
    businessName: name,
    propertyAddress: null,
    website: websiteFor(name, hasWebsite),
    email: emailFor(name, market, hasEmail),
    phone: `414-555-${String(1000 + ((hashString(name) + index) % 8999)).padStart(4, '0')}`,
    city: market.city,
    state: market.state,
    niche,
    serviceFit: vertical.offer,
    painSignal: weakSignals.join('; '),
    outreachAngle: weakSignals.slice(0, 2).join(' + '),
    evidence: weakSignals,
    confidenceScore: 65 + (hashString(`${name}-${vertical.id}`) % 26),
    homeownerContact: false,
    contactPaths: hasWebsite ? ['website', 'email'] : ['phone'],
    metadata: {
      marketKey: market.marketKey,
      selectedReason: market.selectedReason,
      dryRun: true,
      scraperVersion: 'v4',
    },
  }
}

function propertyAddress(market, index) {
  const streetNames = ['Maple', 'Center', 'Walnut', 'Lincoln', 'Garfield', 'Prospect', 'Sherman', 'Grant']
  const street = streetNames[(hashString(`${market.city}-${index}`) + index) % streetNames.length]
  return `${1200 + index * 17} ${street} Ave`
}

function distressedSignalsFor(market, index) {
  const mix = market.signalMix || ['vacant_property', 'code_violation', 'investor_partner']
  return Array.from(new Set([mix[index % mix.length], mix[(index + 1) % mix.length]]))
}

function makeDistressedLead({ vertical, market, index, date }) {
  const signals = distressedSignalsFor(market, index)
  const partner = signals.some((signal) => /partner|investor|contractor|property_manager/.test(signal))
  const name = partner
    ? businessName({ market, niche: signals.includes('contractor_partner') ? 'property contractor partner' : 'real estate investor partner', index })
    : propertyAddress(market, index)

  return {
    id: `v4_distressed_${normalizeKey(market.city)}_${index}`,
    scrapedAt: `${date}T12:00:00.000Z`,
    source: 'outreach_v4_distressed_house_dry_run',
    sourceType: 'dry_run_distressed_house_pipeline',
    vertical: vertical.id,
    verticalLabel: vertical.label,
    businessName: partner ? name : null,
    propertyAddress: partner ? null : `${name}, ${market.city}, ${market.state}`,
    website: partner ? websiteFor(name, true) : null,
    email: partner ? emailFor(name, market, true) : null,
    phone: partner ? `414-555-${String(5000 + index * 13).padStart(4, '0')}` : null,
    city: market.city,
    state: market.state,
    niche: partner ? 'real estate partner target' : 'distressed property opportunity',
    serviceFit: partner ? 'DealVault Real Estate Partner Records' : 'Distressed Property Opportunity Review',
    painSignal: signals.join('; '),
    outreachAngle: partner
      ? 'B2B partner coordination and DealVault proof-record fit'
      : 'manual-review property opportunity only; no homeowner auto-send',
    evidence: signals,
    distressedSignals: signals,
    confidenceScore: partner ? 76 : 68,
    homeownerContact: !partner,
    manualReviewOnly: true,
    contactPaths: partner ? ['website', 'email'] : ['public_record_review'],
    metadata: {
      marketKey: market.marketKey,
      selectedReason: market.selectedReason,
      dryRun: true,
      scraperVersion: 'v4',
      outputBucket: partner ? 'real_estate_partner_targets' : 'distressed_property_opportunities',
    },
  }
}

export function runVerticalScraperDryRun(verticalPlan, options = {}) {
  const vertical = V4_VERTICALS.find((item) => item.id === verticalPlan.verticalId)
  if (!vertical) throw new Error(`Unknown V4 vertical: ${verticalPlan.verticalId}`)

  const date = options.date || new Date().toISOString().slice(0, 10)
  const perMarketLimit = Number.isFinite(options.perMarketLimit) ? options.perMarketLimit : 2
  const leads = []

  for (const market of verticalPlan.markets) {
    if (vertical.id === 'distressed_house') {
      for (let index = 0; index < perMarketLimit + 1; index += 1) {
        leads.push(makeDistressedLead({ vertical, market, index, date }))
      }
      continue
    }

    const niches = verticalPlan.niches.slice(0, Math.max(1, perMarketLimit))
    niches.forEach((niche, index) => {
      leads.push(makeBusinessLead({ vertical, market, niche, index, date }))
    })
  }

  return {
    verticalId: vertical.id,
    label: vertical.label,
    rawFound: leads.length,
    leads,
  }
}
