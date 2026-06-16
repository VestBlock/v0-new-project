#!/usr/bin/env node

/**
 * VestBlock Instantly demand discovery.
 *
 * This is the revenue-network lane: buyers, lenders, builders/developers,
 * and creative-finance operators. It never sources motivated sellers.
 *
 * Preview by default. Pass --push to create/update an Instantly list from
 * matching workspace leads. If Instantly's public API does not expose direct
 * Lead Finder/SuperSearch discovery, this writes a precise UI export handoff.
 *
 * Examples:
 *   node --env-file=.env.local scripts/instantly-demand-discovery.mjs --lane=buyer-demand-capture --market="Milwaukee, WI|Toledo, OH" --limit=100
 *   node --env-file=.env.local scripts/instantly-demand-discovery.mjs --lane=capital-desk-lender-capture --market="Nationwide" --push
 *   node scripts/instantly-demand-discovery.mjs --self-test
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const API_BASE_URL = String(process.env.INSTANTLY_API_BASE_URL || 'https://api.instantly.ai').replace(/\/+$/, '')
const KEYCHAIN_SERVICE = 'VestBlock Instantly API'
const KEYCHAIN_ACCOUNT = 'acquisitions@vestblock.io'

const DISCOVERY_ENDPOINTS = [
  '/api/v2/lead-finder/search',
  '/api/v2/supersearch/search',
  '/api/v2/database/search',
  '/api/v2/search/leads',
  '/api/v2/leads/search',
]

const LANE_PRESETS = {
  'buyer-demand-capture': {
    label: 'Buyer Demand Capture',
    listPrefix: 'VB Buyer Demand',
    defaultMarkets: ['Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Detroit, MI', 'Indianapolis, IN'],
    titles: [
      'real estate investor',
      'acquisition manager',
      'disposition manager',
      'principal',
      'founder',
      'owner',
      'asset manager',
    ],
    keywords: [
      'real estate investor',
      'cash buyer',
      'wholesale real estate',
      'house buyer',
      'rental property',
      'property acquisitions',
      'investment properties',
      'single family rental',
    ],
    excludeKeywords: ['mortgage', 'insurance', 'title company'],
    fitNotes: 'Capture buyer buy box, markets, funding ability, property type, and minimum spread.',
  },
  'capital-desk-lender-capture': {
    label: 'Capital Desk Lender Capture',
    listPrefix: 'VB Capital Desk',
    defaultMarkets: ['Nationwide', 'Midwest', 'Ohio', 'Michigan', 'Wisconsin'],
    titles: ['loan officer', 'lender', 'managing partner', 'founder', 'principal', 'capital advisor', 'mortgage broker'],
    keywords: [
      'hard money lender',
      'private money lender',
      'DSCR lender',
      'bridge lender',
      'fix and flip lender',
      'construction lender',
      'transactional funding',
      'commercial mortgage',
    ],
    excludeKeywords: ['student loan', 'auto loan', 'payday loan'],
    fitNotes: 'Capture states served, loan products, minimum loan size, leverage rules, and no-go property types.',
  },
  'developer-builder-demand-capture': {
    label: 'Developer Builder Demand Capture',
    listPrefix: 'VB Builder Developer Demand',
    defaultMarkets: ['Kansas City, MO', 'Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Indianapolis, IN'],
    titles: ['developer', 'builder', 'general contractor', 'owner', 'founder', 'land acquisition', 'construction manager'],
    keywords: [
      'real estate developer',
      'home builder',
      'infill developer',
      'land acquisition',
      'general contractor',
      'build to rent',
      'construction company',
      'lot buyer',
    ],
    excludeKeywords: ['software developer', 'web developer', 'app developer'],
    fitNotes: 'Capture build area, lot size, zoning tolerance, fire damage tolerance, teardown appetite, and price bands.',
  },
  'creative-finance-buyer-capture': {
    label: 'Creative Finance Buyer Capture',
    listPrefix: 'VB Creative Finance Buyers',
    defaultMarkets: ['Phoenix, AZ', 'Tampa, FL', 'Dallas, TX', 'Atlanta, GA', 'Kansas City, MO'],
    titles: ['real estate investor', 'acquisition manager', 'owner', 'founder', 'portfolio manager', 'rental operator'],
    keywords: [
      'creative finance',
      'subject to real estate',
      'seller finance',
      'wrap mortgage',
      'lease option',
      'rental property investor',
      'buy and hold investor',
      'real estate acquisition',
    ],
    excludeKeywords: ['mortgage servicing', 'loan modification'],
    fitNotes: 'Capture terms they buy, cash-flow floor, down-payment range, markets, and deal breaker criteria.',
  },
}

function hasFlag(name) {
  return args.includes(name)
}

function getArg(name, fallback = '') {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

function intArg(name, fallback, cap = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, cap)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function getApiKey() {
  const envKey = String(process.env.INSTANTLY_API_KEY || '').trim()
  if (envKey) return envKey
  if (process.platform !== 'darwin') return ''
  try {
    return execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
      '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

async function instantlyRequest(apiKey, endpoint, init = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text ? { raw: text } : null
  }
  return { ok: response.ok, status: response.status, data }
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeEmail(value) {
  return normalizeText(value)
    .replace(/^mailto:/, '')
    .split(/[?;\s,]+/)[0]
    .replace(/^[("'`<>]+/, '')
    .replace(/[)"'`<>.,]+$/, '')
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(normalizeEmail(value))
}

function parseMarkets(raw, preset) {
  return String(raw || '')
    .split('|')
    .map((market) => market.trim())
    .filter(Boolean)
    .concat(raw ? [] : preset.defaultMarkets)
    .filter((market, index, all) => all.indexOf(market) === index)
}

function marketNeedle(market) {
  if (/^nationwide$/i.test(market)) return ''
  return normalizeText(market.replace(',', ' '))
}

function leadCorpus(lead) {
  return [
    lead.first_name,
    lead.last_name,
    lead.company_name,
    lead.company_domain,
    lead.job_title,
    lead.organization,
    lead.payload?.vb_market,
    lead.payload?.market,
    lead.payload?.city,
    lead.payload?.state,
    lead.payload?.vb_niche,
    lead.payload?.source,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')
}

function scoreLeadForLane(lead, preset, markets) {
  const corpus = leadCorpus(lead)
  if (!isValidEmail(lead.email)) return { score: 0, reasons: ['invalid_email'] }
  if (preset.excludeKeywords.some((keyword) => corpus.includes(normalizeText(keyword)))) {
    return { score: 0, reasons: ['excluded_keyword'] }
  }

  const reasons = []
  let score = 0
  const titleHits = preset.titles.filter((title) => corpus.includes(normalizeText(title)))
  const keywordHits = preset.keywords.filter((keyword) => corpus.includes(normalizeText(keyword)))
  const marketHits = markets.filter((market) => {
    const needle = marketNeedle(market)
    return !needle || corpus.includes(needle) || corpus.includes(needle.split(/\s+/)[0])
  })

  if (titleHits.length) {
    score += Math.min(35, titleHits.length * 12)
    reasons.push(`title:${titleHits.slice(0, 2).join('|')}`)
  }
  if (keywordHits.length) {
    score += Math.min(45, keywordHits.length * 10)
    reasons.push(`keyword:${keywordHits.slice(0, 2).join('|')}`)
  }
  if (marketHits.length) {
    score += 15
    reasons.push(`market:${marketHits[0]}`)
  }
  if (lead.company_domain) score += 5
  if (lead.verification_status && /valid|verified/i.test(String(lead.verification_status))) score += 10
  if (!titleHits.length && !keywordHits.length) reasons.push('weak_lane_match')

  return { score: Math.min(100, score), reasons }
}

function toSyncLead(lead, lane, preset, score, reasons, markets) {
  const market = markets.find((item) => reasons.some((reason) => reason.includes(item))) || markets[0] || ''
  return {
    email: normalizeEmail(lead.email),
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    company_name: lead.company_name || '',
    phone: lead.phone || '',
    website: lead.company_domain ? `https://${String(lead.company_domain).replace(/^https?:\/\//, '')}` : '',
    personalization: `Reaching out because ${lead.company_name || 'your team'} looks relevant to VestBlock's ${preset.label.toLowerCase()} lane${market ? ` in ${market}` : ''}.`,
    vb_lane: lane,
    vb_market: market,
    vb_niche: preset.label,
    vb_fit_notes: `${preset.fitNotes} Match score ${score}.`,
    vb_next_action: 'Ask for criteria and route replies into buyer/lender/builder memory before sending property packets.',
    vb_match_reasons: reasons.join('; '),
  }
}

async function probeDiscovery(apiKey, preset, markets, limit) {
  const query = `${preset.keywords[0]} ${markets[0] || ''}`.trim()
  const payloads = [
    { query, limit, page: 1 },
    { search: query, limit },
    { q: query, limit },
    { filters: { keywords: preset.keywords.slice(0, 3), locations: markets }, limit },
  ]
  const attempts = []
  for (const endpoint of DISCOVERY_ENDPOINTS) {
    for (const body of payloads) {
      const result = await instantlyRequest(apiKey, endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      attempts.push({
        endpoint,
        status: result.status,
        ok: result.ok,
        message: result.data?.message || result.data?.error || null,
        itemCount: Array.isArray(result.data?.items)
          ? result.data.items.length
          : Array.isArray(result.data?.data)
            ? result.data.data.length
            : null,
      })
      if (result.ok) {
        const items = Array.isArray(result.data?.items)
          ? result.data.items
          : Array.isArray(result.data?.data)
            ? result.data.data
            : []
        return { mode: 'direct_api', endpoint, attempts, items }
      }
    }
  }
  return { mode: 'ui_export_required', endpoint: null, attempts, items: [] }
}

async function fetchWorkspaceLeads(apiKey, scanLimit) {
  const leads = []
  let startingAfter = ''
  while (leads.length < scanLimit) {
    const body = { limit: Math.min(100, scanLimit - leads.length) }
    if (startingAfter) body.starting_after = startingAfter
    const result = await instantlyRequest(apiKey, '/api/v2/leads/list', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!result.ok) throw new Error(result.data?.message || `Instantly workspace lead list failed with ${result.status}`)
    leads.push(...(result.data?.items || []))
    if (!result.data?.next_starting_after) break
    startingAfter = result.data.next_starting_after
  }
  return leads
}

function filterWorkspaceLeads(leads, lane, preset, markets, limit) {
  const seen = new Set()
  return leads
    .map((lead) => ({ lead, match: scoreLeadForLane(lead, preset, markets) }))
    .filter(({ lead, match }) => {
      const email = normalizeEmail(lead.email)
      if (seen.has(email) || match.score < 35) return false
      seen.add(email)
      return true
    })
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, limit)
    .map(({ lead, match }) => toSyncLead(lead, lane, preset, match.score, match.reasons, markets))
}

function buildUiExportBrief(lane, preset, markets, limit) {
  const searches = markets.flatMap((market) =>
    preset.keywords.slice(0, 4).map((keyword) => ({
      market,
      query: /^nationwide$/i.test(market) ? keyword : `${keyword} ${market}`,
      titles: preset.titles.slice(0, 5),
    }))
  )
  return {
    lane,
    source: 'Instantly Lead Finder / SuperSearch UI',
    targetCount: limit,
    listName: `${preset.listPrefix} ${today()}`,
    searches: searches.slice(0, 16),
    requiredExportFields: [
      'email',
      'first_name',
      'last_name',
      'company_name',
      'job_title',
      'company_domain',
      'website',
      'city',
      'state',
    ],
    afterExportCommand:
      'pnpm run instantly:push -- --input=/path/to/instantly-export.csv --lane=' +
      lane +
      ` --list-name="${preset.listPrefix} ${today()}" --verify`,
  }
}

function summarizeDiscoveryAttempts(attempts) {
  const byEndpoint = new Map()
  for (const attempt of attempts) {
    const current = byEndpoint.get(attempt.endpoint) || {
      endpoint: attempt.endpoint,
      attempts: 0,
      statuses: new Set(),
      ok: false,
      message: attempt.message || null,
      itemCount: null,
    }
    current.attempts += 1
    current.statuses.add(attempt.status)
    current.ok = current.ok || attempt.ok
    current.itemCount = Number.isFinite(attempt.itemCount) ? attempt.itemCount : current.itemCount
    if (!current.message && attempt.message) current.message = attempt.message
    byEndpoint.set(attempt.endpoint, current)
  }
  return [...byEndpoint.values()].map((item) => ({
    endpoint: item.endpoint,
    attempts: item.attempts,
    statuses: [...item.statuses].filter(Boolean),
    ok: item.ok,
    message: item.message,
    itemCount: item.itemCount,
  }))
}

async function findOrCreateList(apiKey, name, push) {
  const found = await instantlyRequest(apiKey, `/api/v2/lead-lists?limit=100&search=${encodeURIComponent(name)}`)
  if (!found.ok) throw new Error(found.data?.message || `Instantly lead-list lookup failed with ${found.status}`)
  const exact = (found.data?.items || []).find((item) => String(item.name || '').trim().toLowerCase() === name.toLowerCase())
  if (exact) return { id: exact.id, name: exact.name, created: false }
  if (!push) return { id: null, name, created: false }
  const created = await instantlyRequest(apiKey, '/api/v2/lead-lists', {
    method: 'POST',
    body: JSON.stringify({ name, has_enrichment_task: false }),
  })
  if (!created.ok) throw new Error(created.data?.message || `Instantly lead-list create failed with ${created.status}`)
  return { id: created.data.id, name: created.data.name, created: true }
}

async function pushLeads(apiKey, target, leads, verify) {
  if (!leads.length) return []
  const result = await instantlyRequest(apiKey, '/api/v2/leads/add', {
    method: 'POST',
    body: JSON.stringify({
      [target.type === 'campaign' ? 'campaign_id' : 'list_id']: target.id,
      leads: leads.map((lead) => ({
        email: lead.email,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        company_name: lead.company_name || null,
        website: lead.website || null,
        personalization: lead.personalization,
        custom_variables: {
          vb_lane: lead.vb_lane,
          vb_market: lead.vb_market,
          vb_niche: lead.vb_niche,
          vb_fit_notes: lead.vb_fit_notes,
          vb_next_action: lead.vb_next_action,
          vb_match_reasons: lead.vb_match_reasons,
        },
      })),
      verify_leads_on_import: verify,
      skip_if_in_workspace: true,
    }),
  })
  if (!result.ok) throw new Error(result.data?.message || `Instantly lead import failed with ${result.status}`)
  return [result.data]
}

function writeArtifacts({ lane, rows, summary }) {
  const outDir = path.join(process.cwd(), 'artifacts', 'instantly-demand', today(), lane)
  fs.mkdirSync(outDir, { recursive: true })
  const base = `instantly-demand-${lane}-${stamp()}`
  const csvPath = path.join(outDir, `${base}.csv`)
  const summaryPath = path.join(outDir, `${base}.json`)
  const columns = [
    'email',
    'first_name',
    'last_name',
    'company_name',
    'phone',
    'website',
    'personalization',
    'vb_lane',
    'vb_market',
    'vb_niche',
    'vb_fit_notes',
    'vb_next_action',
    'vb_match_reasons',
  ]
  fs.writeFileSync(csvPath, `${toCsv(rows, columns)}\n`)
  fs.writeFileSync(summaryPath, `${JSON.stringify({ ...summary, csvPath, summaryPath }, null, 2)}\n`)
  return { csvPath, summaryPath }
}

function runSelfTest() {
  const preset = LANE_PRESETS['developer-builder-demand-capture']
  const rows = filterWorkspaceLeads(
    [
      {
        email: 'builder@example.com',
        first_name: 'Ava',
        last_name: 'Builds',
        company_name: 'KC Infill Home Builder',
        company_domain: 'kcinfill.test',
        job_title: 'Owner',
        verification_status: 'verified',
      },
      {
        email: 'webdev@example.com',
        company_name: 'Software Developer Studio',
        job_title: 'Founder',
      },
      {
        email: 'bad-email',
        company_name: 'Milwaukee Home Builder',
        job_title: 'Owner',
      },
    ],
    'developer-builder-demand-capture',
    preset,
    ['Kansas City, MO'],
    10
  )
  if (rows.length !== 1) throw new Error(`Expected 1 self-test row, got ${rows.length}`)
  if (rows[0].vb_lane !== 'developer-builder-demand-capture') throw new Error('Self-test lane mapping failed')
  console.log(JSON.stringify({ ok: true, test: 'instantly-demand-discovery' }, null, 2))
}

async function main() {
  if (hasFlag('--self-test')) {
    runSelfTest()
    return
  }

  const lane = getArg('--lane', 'buyer-demand-capture')
  const preset = LANE_PRESETS[lane]
  if (!preset) throw new Error(`Unknown lane "${lane}". Use one of: ${Object.keys(LANE_PRESETS).join(', ')}`)

  const apiKey = getApiKey()
  if (!apiKey) throw new Error(`Missing Instantly API key in env or macOS Keychain service "${KEYCHAIN_SERVICE}".`)

  const limit = intArg('--limit', 100, 1000)
  const scanLimit = intArg('--workspace-scan-limit', Math.max(500, limit * 5), 5000)
  const markets = parseMarkets(getArg('--market'), preset)
  const push = hasFlag('--push')
  const verify = hasFlag('--verify')
  const verbose = hasFlag('--verbose')
  const campaignId = getArg('--campaign-id')
  const listName = getArg('--list-name', `${preset.listPrefix} ${today()}`)

  const discovery = await probeDiscovery(apiKey, preset, markets, Math.min(limit, 100))
  const directRows = discovery.items.length
    ? filterWorkspaceLeads(discovery.items, lane, preset, markets, limit)
    : []
  const workspaceRows = directRows.length
    ? []
    : filterWorkspaceLeads(await fetchWorkspaceLeads(apiKey, scanLimit), lane, preset, markets, limit)
  const rows = directRows.length ? directRows : workspaceRows
  const uiExportBrief = buildUiExportBrief(lane, preset, markets, limit)

  let list = { id: getArg('--list-id') || null, name: listName, created: false }
  let campaign = campaignId ? { id: campaignId } : null
  let importResults = []
  if (push && rows.length) {
    if (campaignId) {
      importResults = await pushLeads(apiKey, { type: 'campaign', id: campaignId }, rows, verify)
    } else {
      if (!list.id) list = await findOrCreateList(apiKey, listName, true)
      importResults = await pushLeads(apiKey, { type: 'list', id: list.id }, rows, verify)
    }
  } else if (!campaignId && !list.id) {
    list = await findOrCreateList(apiKey, listName, false)
  }

  const summary = {
    ok: true,
    dryRun: !push,
    lane,
    laneLabel: preset.label,
    markets,
    limit,
    scanLimit,
    sourceMode: directRows.length ? 'direct_api_discovery' : 'workspace_filter_or_ui_export',
    discoveryEndpoint: discovery.endpoint,
    discoveryProbe: summarizeDiscoveryAttempts(discovery.attempts),
    ...(verbose
      ? {
          discoveryProbeRaw: discovery.attempts.map((attempt) => ({
            endpoint: attempt.endpoint,
            status: attempt.status,
            ok: attempt.ok,
            message: attempt.message,
            itemCount: attempt.itemCount,
          })),
        }
      : {}),
    matchedRows: rows.length,
    list,
    campaign,
    pushedBatches: importResults.length,
    importResults,
    uiExportBrief,
    notes: rows.length
      ? [
          'Matched workspace/API leads were written to CSV.',
          push ? 'Matched leads were pushed into Instantly.' : 'Preview only; re-run with --push after review.',
        ]
      : [
          'No matching workspace/API leads found for this lane.',
          'Use the uiExportBrief searches in Instantly Lead Finder, export CSV, then run instantly:push with that file.',
        ],
  }
  const artifactPaths = writeArtifacts({ lane, rows, summary })
  console.log(JSON.stringify({ ...summary, ...artifactPaths }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
