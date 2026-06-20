#!/usr/bin/env node

/**
 * VestBlock -> Instantly lead sync.
 *
 * Preview by default. Use --push to create/update Instantly lead lists or campaigns.
 *
 * Examples:
 *   node --env-file=.env.local scripts/instantly-lead-sync.mjs --doctor
 *   node --env-file=.env.local scripts/instantly-lead-sync.mjs --input=artifacts/outscraper/2026-06-16/fire-damage-builders/file.csv --lane=fire-damage-builders
 *   node --env-file=.env.local scripts/instantly-lead-sync.mjs --push --input=... --lane=fire-damage-builders --list-name="VB Fire Damage Buyers - KC"
 *   node --env-file=.env.local scripts/instantly-lead-sync.mjs --push --input=... --lane=buyer-developers --campaign-id=...
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const API_BASE_URL = String(process.env.INSTANTLY_API_BASE_URL || 'https://api.instantly.ai').replace(/\/+$/, '')
const KEYCHAIN_SERVICE = 'VestBlock Instantly API'
const KEYCHAIN_ACCOUNT = 'acquisitions@vestblock.io'

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
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.message || data?.error || text || `Instantly request failed with ${response.status}`
    throw new Error(`${response.status} ${message}`)
  }
  return data
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const [headers = [], ...body] = rows
  const normalizedHeaders = headers.map((header) => String(header || '').trim())
  return body
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] || ''])))
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
}

function normalizeEmail(value) {
  let email = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, '')
    .split(/[?;\s,]+/)[0]
    .replace(/^[("'`<>]+/, '')
    .replace(/[)"'`<>.,]+$/, '')

  try {
    email = decodeURIComponent(email)
  } catch {}

  return email
    .trim()
    .replace(/^mailto:/, '')
    .replace(/^[\s\u00a0%]+/, '')
    .replace(/[\s\u00a0%]+$/, '')
}

function getEmailIssue(value) {
  const email = normalizeEmail(value)
  if (!email) return 'missing_email'
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) return 'invalid_email'
  if (/^(example|test|demo|sample)@/i.test(email)) return 'placeholder_email'
  if (/(example|domain|address)\.(com|org|net)$/i.test(email)) return 'placeholder_email'
  if (/(email\.com|sentry-next\.wixpress\.com|sentry\.wixpress\.com)$/i.test(email)) return 'placeholder_email'
  if (/^[a-f0-9]{24,}@/i.test(email)) return 'non_contact_email'
  if (/^homepage@www\./i.test(email)) return 'non_contact_email'
  if (/(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster)@/i.test(email)) return 'non_contact_email'
  if (/\.(png|jpg|jpeg|svg|webp)$/i.test(email)) return 'asset_email'
  return null
}

function pick(row, keys) {
  for (const key of keys) {
    const value = String(row[key] || '').trim()
    if (value) return value
  }
  return ''
}

function leadNameFromCompany(companyName) {
  const cleaned = String(companyName || '').replace(/\b(llc|inc|co|company|group|properties|realty|homes?)\b\.?/gi, '').trim()
  const first = cleaned.split(/\s+/).find(Boolean)
  return first && first.length > 1 ? first : null
}

function normalizeLead(row, input) {
  const email = normalizeEmail(pick(row, ['email', 'Email', 'owner_email', 'contact_email']))
  const companyName = pick(row, ['company_name', 'business_name', 'name', 'Company', 'company'])
  const phone = pick(row, ['phone', 'phone_1', 'Phone', 'mobile'])
  const website = pick(row, ['website', 'Website', 'site', 'domain'])
  const market = pick(row, ['market', 'Market', 'city_state', 'city'])
  const firstName = pick(row, ['first_name', 'First Name', 'firstname']) || leadNameFromCompany(companyName)
  const lastName = pick(row, ['last_name', 'Last Name', 'lastname'])
  const issue = getEmailIssue(email)

  return {
    issue,
    lead: {
      email: issue ? null : email,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
      phone: phone || null,
      website: website || null,
      personalization: buildPersonalization(row, input),
      custom_variables: {
        vb_lane: input.lane,
        vb_market: market,
        vb_niche: pick(row, ['niche', 'category', 'Category']),
        vb_source_url: pick(row, ['source_url', 'url', 'listing_url']),
        vb_source_file: input.sourceFile,
        vb_fit_notes: pick(row, ['fit_notes', 'notes', 'pain_signal']),
        vb_next_action: pick(row, ['next_action', 'recommended_next_step']),
        vb_address: pick(row, ['address', 'property_address', 'full_address']),
        vb_rating: pick(row, ['rating']),
        vb_reviews: pick(row, ['reviews']),
      },
    },
  }
}

function buildPersonalization(row, input) {
  const company = pick(row, ['company_name', 'business_name', 'name', 'Company', 'company']) || 'your team'
  const market = pick(row, ['market', 'Market', 'city_state', 'city']) || 'your market'
  const niche = pick(row, ['niche', 'category', 'Category'])
  const lane = input.lane.replaceAll('-', ' ')
  return `Reaching out because ${company} looks relevant to our ${lane} lane in ${market}${niche ? ` (${niche})` : ''}.`
}

function uniqueValidLeads(rows, input) {
  const seen = new Set()
  const accepted = []
  const rejected = []

  for (const [index, row] of rows.entries()) {
    const normalized = normalizeLead(row, input)
    if (normalized.issue) {
      rejected.push({ index, reason: normalized.issue, email: pick(row, ['email', 'Email', 'owner_email', 'contact_email']) })
      continue
    }
    const email = normalized.lead.email
    if (seen.has(email)) {
      rejected.push({ index, reason: 'duplicate_in_file', email })
      continue
    }
    seen.add(email)
    accepted.push(normalized.lead)
  }

  return { accepted, rejected }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writePreviewCsv(filePath, leads) {
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
    'vb_source_url',
    'vb_fit_notes',
    'vb_next_action',
  ]
  const rows = leads.map((lead) => ({
    ...lead,
    ...lead.custom_variables,
  }))
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${toCsv(rows, columns)}\n`)
}

async function findOrCreateList(apiKey, name, push) {
  const found = await instantlyRequest(apiKey, `/api/v2/lead-lists?limit=100&search=${encodeURIComponent(name)}`)
  const exact = (found?.items || []).find((item) => String(item.name || '').trim().toLowerCase() === name.toLowerCase())
  if (exact) return { id: exact.id, name: exact.name, created: false }
  if (!push) return { id: null, name, created: false }
  const created = await instantlyRequest(apiKey, '/api/v2/lead-lists', {
    method: 'POST',
    body: JSON.stringify({ name, has_enrichment_task: false }),
  })
  return { id: created.id, name: created.name, created: true }
}

async function addLeadsToTarget(apiKey, target, leads, options) {
  const batches = []
  const batchSize = Math.min(Math.max(options.batchSize, 1), 1000)
  for (let index = 0; index < leads.length; index += batchSize) {
    const batch = leads.slice(index, index + batchSize)
    const result = await instantlyRequest(apiKey, '/api/v2/leads/add', {
      method: 'POST',
      body: JSON.stringify({
        [target.type === 'campaign' ? 'campaign_id' : 'list_id']: target.id,
        leads: batch,
        verify_leads_on_import: options.verify,
        skip_if_in_workspace: true,
      }),
    })
    batches.push(result)
  }
  return batches
}

async function runDoctor(apiKey) {
  const [accounts, lists, campaigns] = await Promise.all([
    instantlyRequest(apiKey, '/api/v2/accounts?limit=100'),
    instantlyRequest(apiKey, '/api/v2/lead-lists?limit=20'),
    instantlyRequest(apiKey, '/api/v2/campaigns?limit=20'),
  ])

  return {
    ok: true,
    apiBaseUrl: API_BASE_URL,
    accounts: (accounts?.items || []).map((account) => ({
      email: account.email,
      status: account.status,
      warmup_status: account.warmup_status,
    })),
    leadLists: (lists?.items || []).map((list) => ({ id: list.id, name: list.name })),
    campaigns: (campaigns?.items || []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      daily_limit: campaign.daily_limit,
    })),
  }
}

async function main() {
  const apiKey = getApiKey()
  if (hasFlag('--doctor')) {
    if (!apiKey) {
      throw new Error(`Missing INSTANTLY_API_KEY. Add it to .env.local or macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}".`)
    }
    console.log(JSON.stringify(await runDoctor(apiKey), null, 2))
    return
  }

  const inputPath = getArg('--input')
  if (!inputPath) throw new Error('Missing --input=/path/to/leads.csv')
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`)

  const push = hasFlag('--push')
  if (push && !apiKey) {
    throw new Error(`Missing INSTANTLY_API_KEY. Add it to .env.local or macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}".`)
  }
  const lane = getArg('--lane', path.basename(path.dirname(inputPath)) || 'manual')
  const limit = intArg('--limit', 1000, 1000)
  const batchSize = intArg('--batch-size', 500, 1000)
  const verify = hasFlag('--verify')
  const listName = getArg('--list-name', `VestBlock ${lane} ${today()}`)
  const campaignId = getArg('--campaign-id')
  const rows = parseCsv(fs.readFileSync(inputPath, 'utf8'))
  const { accepted, rejected } = uniqueValidLeads(rows, { lane, sourceFile: inputPath })
  const limited = accepted.slice(0, limit)
  const outDir = path.join(process.cwd(), 'artifacts', 'instantly', today(), lane)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const previewCsvPath = path.join(outDir, `instantly-${lane}-preview-${stamp}.csv`)
  const summaryPath = path.join(outDir, `instantly-${lane}-${push ? 'push' : 'preview'}-${stamp}.json`)

  writePreviewCsv(previewCsvPath, limited)

  let list = { id: getArg('--list-id') || null, name: listName, created: false }
  let campaign = campaignId ? { id: campaignId } : null
  let importResults = []
  if (push) {
    if (campaignId) {
      importResults = await addLeadsToTarget(apiKey, { type: 'campaign', id: campaignId }, limited, { batchSize, verify })
    } else {
      if (!list.id) list = await findOrCreateList(apiKey, listName, true)
      importResults = await addLeadsToTarget(apiKey, { type: 'list', id: list.id }, limited, { batchSize, verify })
    }
  } else if (!campaignId && !list.id && apiKey) {
    list = await findOrCreateList(apiKey, listName, false)
  }

  const summary = {
    ok: true,
    dryRun: !push,
    lane,
    inputPath,
    list,
    campaign,
    sourceRows: rows.length,
    accepted: accepted.length,
    limitedTo: limited.length,
    rejected: rejected.length,
    rejectedByReason: rejected.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1
      return acc
    }, {}),
    pushedBatches: importResults.length,
    importResults,
    previewCsvPath,
    summaryPath,
    notes: push
      ? 'Leads were pushed into Instantly. Campaign activation should still be controlled after sender/deliverability review.'
      : 'Preview only. Re-run with --push after reviewing the CSV and Instantly sender setup.',
  }
  writeJson(summaryPath, summary)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
