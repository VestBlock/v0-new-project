#!/usr/bin/env node

/**
 * Compare lead-source quality without exposing contacts.
 *
 * This intentionally avoids printing emails or API keys. It checks:
 * - Instantly API lead-management access
 * - Whether obvious SuperSearch/Lead Finder endpoints are exposed
 * - Workspace lead field completeness
 * - A local CSV source artifact such as DataPipe/Outscraper output
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const INSTANTLY_API_BASE_URL = String(process.env.INSTANTLY_API_BASE_URL || 'https://api.instantly.ai').replace(/\/+$/, '')
const KEYCHAIN_SERVICE = 'VestBlock Instantly API'
const KEYCHAIN_ACCOUNT = 'acquisitions@vestblock.io'

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

function getInstantlyApiKey() {
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
  const response = await fetch(`${INSTANTLY_API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  return { ok: response.ok, status: response.status, data }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
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
    } else if (char !== '\r') cell += char
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

function pick(row, keys) {
  for (const key of keys) {
    const value = String(row?.[key] || '').trim()
    if (value) return value
  }
  return ''
}

function hasEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(String(value || '').trim())
}

function pct(count, total) {
  return total ? Number(((count / total) * 100).toFixed(1)) : 0
}

function scoreCompleteness(rows, source) {
  const total = rows.length
  const metrics = {
    total,
    hasEmail: rows.filter((row) => hasEmail(pick(row, ['email', 'Email', 'owner_email', 'contact_email']))).length,
    hasPersonName: rows.filter((row) => pick(row, ['first_name', 'First Name', 'firstname']) || pick(row, ['last_name', 'Last Name', 'lastname'])).length,
    hasJobTitle: rows.filter((row) => pick(row, ['job_title', 'Job Title', 'title'])).length,
    hasCompany: rows.filter((row) => pick(row, ['company_name', 'business_name', 'name', 'Company', 'company'])).length,
    hasWebsiteOrDomain: rows.filter((row) => pick(row, ['website', 'Website', 'site', 'domain', 'company_domain'])).length,
    hasPhone: rows.filter((row) => pick(row, ['phone', 'phone_1', 'Phone', 'mobile'])).length,
    hasMarket: rows.filter((row) => pick(row, ['market', 'Market', 'city_state', 'city'])).length,
    hasSourceUrl: rows.filter((row) => pick(row, ['source_url', 'url', 'listing_url'])).length,
  }
  const score =
    pct(metrics.hasEmail, total) * 0.28 +
    pct(metrics.hasCompany, total) * 0.16 +
    pct(metrics.hasWebsiteOrDomain, total) * 0.14 +
    pct(metrics.hasPersonName, total) * 0.12 +
    pct(metrics.hasJobTitle, total) * 0.12 +
    pct(metrics.hasPhone, total) * 0.08 +
    pct(metrics.hasMarket, total) * 0.06 +
    pct(metrics.hasSourceUrl, total) * 0.04

  return {
    source,
    score: Number(score.toFixed(1)),
    metrics,
    percentages: Object.fromEntries(
      Object.entries(metrics)
        .filter(([key]) => key !== 'total')
        .map(([key, value]) => [key, pct(value, total)])
    ),
  }
}

function normalizeInstantlyLead(lead) {
  return {
    email: lead.email || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    company_name: lead.company_name || '',
    job_title: lead.job_title || '',
    website: lead.website || '',
    phone: lead.phone || '',
    company_domain: lead.company_domain || '',
    market: lead.payload?.vb_market || '',
    source_url: lead.payload?.vb_source_url || '',
  }
}

async function probeInstantly(apiKey) {
  const endpoints = [
    ['/api/v2/leads/list', { limit: 5 }],
    ['/api/v2/lead-finder/search', { limit: 5, query: 'real estate investor Milwaukee' }],
    ['/api/v2/supersearch/search', { limit: 5, query: 'real estate investor Milwaukee' }],
    ['/api/v2/database/search', { limit: 5, query: 'real estate investor Milwaukee' }],
    ['/api/v2/search/leads', { limit: 5, query: 'real estate investor Milwaukee' }],
    ['/api/v2/leads/search', { limit: 5, query: 'real estate investor Milwaukee' }],
  ]

  const results = []
  for (const [endpoint, body] of endpoints) {
    const result = await instantlyRequest(apiKey, endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    results.push({
      endpoint,
      status: result.status,
      ok: result.ok,
      message: result.data?.message || result.data?.error || null,
      itemCount: Array.isArray(result.data?.items) ? result.data.items.length : Array.isArray(result.data?.data) ? result.data.data.length : null,
    })
  }
  return results
}

async function main() {
  const apiKey = getInstantlyApiKey()
  if (!apiKey) throw new Error(`Missing Instantly API key in env or macOS Keychain service "${KEYCHAIN_SERVICE}".`)

  const limit = intArg('--limit', 100, 1000)
  const csvPath = getArg('--csv')
  const sourceLabel = getArg('--source-label', csvPath ? path.basename(path.dirname(csvPath)) : 'csv_source')

  const probe = await probeInstantly(apiKey)
  const leadList = await instantlyRequest(apiKey, '/api/v2/leads/list', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  })
  if (!leadList.ok) throw new Error(leadList.data?.message || `Instantly lead list failed with ${leadList.status}`)

  const instantlyRows = (leadList.data?.items || []).map(normalizeInstantlyLead)
  const comparisons = [scoreCompleteness(instantlyRows, 'instantly_workspace_api')]

  if (csvPath) {
    if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
    comparisons.push(scoreCompleteness(parseCsv(fs.readFileSync(csvPath, 'utf8')).slice(0, limit), sourceLabel))
  }

  const recommendation = (() => {
    const instantlyLeadFinderApi = probe.some((item) => item.endpoint !== '/api/v2/leads/list' && item.ok)
    if (instantlyLeadFinderApi) {
      return 'Instantly can be tested as a direct API lead source; run a small SuperSearch-style pull before paying for more map scraping.'
    }
    if (comparisons.length > 1 && comparisons[0].score > comparisons[1].score + 10) {
      return 'Instantly workspace leads are cleaner than the compared CSV sample, but the current public API still does not expose SuperSearch discovery.'
    }
    return 'Use Instantly for verified people/contact outreach when exported from its UI; keep DataPipe/Outscraper for local company discovery, phones, websites, and map/source coverage.'
  })()

  const output = {
    generatedAt: new Date().toISOString(),
    probe,
    comparisons,
    recommendation,
    notes: [
      'No emails or raw contacts are printed in this report.',
      'A 404 on SuperSearch-like endpoints means the documented API manages leads but does not expose that database search path.',
    ],
  }

  const outDir = path.join(process.cwd(), 'artifacts', 'lead-source-shootout', today())
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `lead-source-shootout-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify({ ...output, outputPath: outPath }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
