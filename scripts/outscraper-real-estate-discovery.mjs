/**
 * VestBlock — Outscraper real estate discovery.
 *
 * Preview by default. Pass --run to spend Outscraper credits.
 *
 * Examples:
 *   node scripts/outscraper-real-estate-discovery.mjs --lane=fire-damage-builders --market="Kansas City,MO"
 *   node scripts/outscraper-real-estate-discovery.mjs --run --lane=land-developers --market="Toledo,OH|Milwaukee,WI" --limit-per-niche=3
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const RUN = args.includes('--run')
const OUTSCRAPER_API_BASE_URL = String(process.env.OUTSCRAPER_API_BASE_URL || 'https://api.datapipeplatform.cloud').replace(/\/+$/, '')

function getArg(name, fallback = null) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=').trim() : fallback
}

const LANE_PRESETS = {
  'buyer-developer': {
    label: 'Buyer / Developer Partners',
    defaultMarkets: ['Kansas City,MO', 'Milwaukee,WI', 'Toledo,OH', 'Cincinnati,OH'],
    niches: [
      'real estate developer',
      'infill developer',
      'home builder',
      'we buy houses',
      'cash home buyer',
      'house flipper',
      'real estate acquisitions',
      'property management company',
    ],
  },
  'investor-network': {
    label: 'Investor Network Partners',
    defaultMarkets: ['Milwaukee,WI', 'Toledo,OH', 'Dayton,OH', 'Fort Wayne,IN'],
    niches: [
      'real estate investor',
      'real estate investment company',
      'cash home buyer',
      'house flipper',
      'rental property investor',
      'apartment investor',
      'multifamily investor',
      'real estate acquisitions',
    ],
  },
  'lender-network': {
    label: 'Lender / Capital Network',
    defaultMarkets: ['Milwaukee,WI', 'Cleveland,OH', 'Indianapolis,IN', 'Grand Rapids,MI'],
    niches: [
      'hard money lender',
      'private money lender',
      'DSCR lender',
      'bridge lender',
      'fix and flip lender',
      'construction lender',
      'commercial mortgage broker',
      'portfolio lender',
    ],
  },
  'wholesaler-network': {
    label: 'Wholesaler / Disposition Network',
    defaultMarkets: ['Detroit,MI', 'Cincinnati,OH', 'Louisville,KY', 'Memphis,TN'],
    niches: [
      'real estate wholesaler',
      'wholesale real estate company',
      'disposition manager real estate',
      'real estate acquisitions',
      'off market properties',
      'investment property buyers',
    ],
  },
  'acquisition-manager-network': {
    label: 'Acquisition Manager Network',
    defaultMarkets: ['Columbus,OH', 'Charlotte,NC', 'Atlanta,GA', 'Jacksonville,FL'],
    niches: [
      'real estate acquisitions manager',
      'acquisitions real estate investment',
      'land acquisition manager',
      'multifamily acquisitions',
      'single family rental acquisitions',
      'build to rent acquisitions',
    ],
  },
  'property-manager-network': {
    label: 'Property Manager / Operator Network',
    defaultMarkets: ['Dayton,OH', 'Springfield,MO', 'Grand Rapids,MI', 'Fort Wayne,IN'],
    niches: [
      'property management company',
      'rental property management',
      'multifamily property management',
      'section 8 property management',
      'single family rental management',
      'real estate asset management',
    ],
  },
  'fire-damage-builders': {
    label: 'Fire-Damage / Heavy Rehab Buyers',
    defaultMarkets: ['Kansas City,MO', 'St Louis,MO', 'Cincinnati,OH', 'Detroit,MI'],
    niches: [
      'fire damaged house buyer',
      'house flipper',
      'general contractor real estate investor',
      'home builder',
      'real estate developer',
      'we buy houses',
      'fire damage restoration contractor',
    ],
  },
  'land-developers': {
    label: 'Land / Infill Developers',
    defaultMarkets: ['Toledo,OH', 'Milwaukee,WI', 'Cleveland,OH', 'Indianapolis,IN'],
    niches: [
      'land developer',
      'infill home builder',
      'residential developer',
      'custom home builder',
      'real estate development company',
      'lot buyer',
      'build to rent developer',
    ],
  },
  'county-records': {
    label: 'County / Public Record Source Map',
    defaultMarkets: ['Kansas City,MO', 'Milwaukee,WI', 'Toledo,OH', 'Cincinnati,OH'],
    niches: [
      'county recorder',
      'register of deeds',
      'county treasurer tax delinquent',
      'property tax office',
      'code enforcement',
      'building department permits',
      'land bank',
      'sheriff sale foreclosure',
    ],
  },
}

function normalizeMarket(raw) {
  const [cityRaw, stateRaw] = String(raw || '').split(',').map((part) => part.trim())
  if (!cityRaw || !stateRaw) throw new Error(`Invalid market "${raw}". Use City,ST.`)
  return { city: cityRaw, state: stateRaw.toUpperCase(), label: `${cityRaw}, ${stateRaw.toUpperCase()}` }
}

function marketSlug(market) {
  return market.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
}

function pickString(record, keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return ''
}

function extractEmail(record) {
  const candidates = [
    record?.email,
    record?.email_1,
    record?.email_2,
    record?.email_3,
    record?.email_4,
    ...(Array.isArray(record?.emails) ? record.emails : []),
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const email = candidate.split(/[,\s;]+/).find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      if (email) return email.toLowerCase()
    }
    if (candidate && typeof candidate === 'object' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(candidate.email || ''))) {
      return String(candidate.email).toLowerCase()
    }
  }
  return ''
}

function getApiKey() {
  const envKey = String(process.env.OUTSCRAPER_API_KEY || process.env.DATAPIPE_API_KEY || '').trim()
  if (envKey) return envKey
  if (process.platform !== 'darwin') return ''
  try {
    return execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-a',
      'acquisitions@vestblock.io',
      '-s',
      'VestBlock Outscraper API',
      '-w',
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function normalizePayload(payload, niches, queries) {
  const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
  if (!Array.isArray(data)) return []
  const rows = []
  for (const [index, value] of data.entries()) {
    if (Array.isArray(value)) {
      for (const record of value) {
        if (record && typeof record === 'object') {
          rows.push({ record, niche: niches[index] || niches[0], query: queries[index] || queries[0] })
        }
      }
    } else if (value && typeof value === 'object') {
      rows.push({ record: value, niche: niches[index] || niches[0], query: queries[index] || queries[0] })
    }
  }
  return rows
}

function recordToLead({ record, lane, market, niche, query }) {
  const name = pickString(record, ['name', 'name_for_emails'])
  const category = pickString(record, ['category', 'type'])
  const website = pickString(record, ['website', 'site', 'domain'])
  const phone = pickString(record, ['phone', 'phone_1', 'phone_2'])
  const address = pickString(record, ['full_address', 'address'])
  const sourceUrl =
    pickString(record, ['location_link']) ||
    (pickString(record, ['place_id']) ? `https://www.google.com/maps/place/?q=place_id:${pickString(record, ['place_id'])}` : '')

  return {
    lane,
    market: market.label,
    company_name: name,
    category,
    niche,
    email: extractEmail(record),
    phone,
    website,
    address,
    rating: pickNumber(record, ['rating']),
    reviews: pickNumber(record, ['reviews', 'reviews_count']),
    source_url: sourceUrl,
    query,
    fit_notes: buildFitNotes(lane, niche, category, market),
    next_action: lane === 'county-records'
      ? 'Use this public office/source to map tax, deeds, permits, code, land bank, or sheriff sale records before seller outreach.'
      : 'Verify buy box, ask whether they buy assignments, and capture market/property/condition criteria.',
  }
}

function buildFitNotes(lane, niche, category, market) {
  if (lane === 'investor-network') {
    return `Possible ${market.label} investor/buyer network contact. Capture buy box, proof of funds, close speed, preferred asset type, and assignment tolerance.`
  }
  if (lane === 'lender-network') {
    return `Possible ${market.label} capital partner. Capture lending criteria, loan types, leverage limits, minimum deal size, states served, and broker/referral appetite.`
  }
  if (lane === 'wholesaler-network') {
    return `Possible ${market.label} wholesaler/dispo partner. Confirm active buyer list depth, JV rules, assignment tolerance, and markets where they need buyer or seller flow.`
  }
  if (lane === 'acquisition-manager-network') {
    return `Possible ${market.label} acquisition manager. Capture exact acquisition criteria, target basis, asset class, markets, and whether they review off-market assignments.`
  }
  if (lane === 'property-manager-network') {
    return `Possible ${market.label} operator/property manager partner. Capture managed units, investor client profile, owner referrals, and distressed-owner signal awareness.`
  }
  if (lane === 'fire-damage-builders') {
    return `Possible ${market.label} heavy-rehab/fire-damage disposition target. Confirm fire-damage tolerance, structural rehab appetite, assignment acceptance, and minimum spread.`
  }
  if (lane === 'land-developers') {
    return `Possible ${market.label} land/infill buyer. Confirm lot size, zoning, infill neighborhoods, utility requirements, and max basis as a percent of resale value.`
  }
  if (lane === 'county-records') {
    return `Public-record source candidate for ${market.label}: ${niche}${category ? ` (${category})` : ''}.`
  }
  return `Possible ${market.label} buyer/developer partner. Confirm buy box, funding, close speed, assignment tolerance, and deal types.`
}

async function searchOutscraper({ apiKey, lane, market, niches, limitPerNiche, timeoutMs }) {
  const queries = niches.map((niche) => `${niche} ${market.city} ${market.state} usa`)
  const response = await fetch(`${OUTSCRAPER_API_BASE_URL}/google-maps-search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-API-KEY': apiKey.replace(/[\r\n\t]/g, ''),
    },
    body: JSON.stringify({
      query: queries,
      limit: limitPerNiche,
      language: 'en',
      region: 'us',
      async: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Outscraper request failed (${response.status}): ${text.slice(0, 240)}`)
  }

  const payload = await response.json()
  return normalizePayload(payload, niches, queries).map((item) => recordToLead({ ...item, lane, market }))
}

async function main() {
  const lane = getArg('lane', 'buyer-developer')
  const preset = LANE_PRESETS[lane]
  if (!preset) {
    throw new Error(`Unknown lane "${lane}". Use one of: ${Object.keys(LANE_PRESETS).join(', ')}`)
  }

  const markets = String(getArg('market', preset.defaultMarkets.join('|')))
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeMarket)
  const maxNiches = Number.parseInt(getArg('max-niches', String(preset.niches.length)), 10)
  const niches = preset.niches.slice(0, Math.max(1, maxNiches))
  const limitPerNiche = Number.parseInt(getArg('limit-per-niche', '3'), 10)
  const timeoutMs = Number.parseInt(getArg('timeout-ms', '45000'), 10)
  const outDir = path.join(process.cwd(), 'artifacts', 'outscraper', new Date().toISOString().slice(0, 10), lane)
  fs.mkdirSync(outDir, { recursive: true })

  const plan = markets.flatMap((market) => niches.map((niche) => ({
    lane,
    lane_label: preset.label,
    market: market.label,
    niche,
    query: `${niche} ${market.city} ${market.state} usa`,
    planned_limit: limitPerNiche,
  })))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(path.join(outDir, `outscraper-plan-${stamp}.csv`), `${toCsv(plan, ['lane', 'lane_label', 'market', 'niche', 'query', 'planned_limit'])}\n`)

  console.log('VestBlock Outscraper Real Estate Discovery')
  console.log('===========================================')
  console.log(`Lane:       ${lane} (${preset.label})`)
  console.log(`Markets:    ${markets.map((market) => market.label).join(' | ')}`)
  console.log(`Niches:     ${niches.length}`)
  console.log(`Per niche:  ${limitPerNiche}`)
  console.log(`Mode:       ${RUN ? 'LIVE OUTSCRAPER RUN' : 'PREVIEW ONLY (no credits spent)'}`)
  console.log(`Artifacts:  ${outDir}`)

  if (!RUN) {
    console.log('\nPreview complete. Re-run with --run to spend Outscraper credits.')
    return
  }

  const apiKey = getApiKey()
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY or DATAPIPE_API_KEY missing and Keychain fallback was not found.')

  const leads = []
  for (const market of markets) {
    const marketLeads = await searchOutscraper({ apiKey, lane, market, niches, limitPerNiche, timeoutMs })
    leads.push(...marketLeads)
    console.log(`✓ ${market.label}: ${marketLeads.length} raw target(s)`)
  }

  const columns = [
    'lane',
    'market',
    'company_name',
    'category',
    'niche',
    'email',
    'phone',
    'website',
    'address',
    'rating',
    'reviews',
    'source_url',
    'query',
    'fit_notes',
    'next_action',
  ]
  const prefix = `outscraper-${lane}-${markets.map(marketSlug).join('_')}-${stamp}`
  fs.writeFileSync(path.join(outDir, `${prefix}.csv`), `${toCsv(leads, columns)}\n`)
  fs.writeFileSync(path.join(outDir, `${prefix}.json`), JSON.stringify(leads, null, 2))
  console.log(`\nSaved: ${path.join(outDir, `${prefix}.csv`)}`)
  console.log(`Targets: ${leads.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
