#!/usr/bin/env node

/**
 * Enrich business CSVs with public website contact emails.
 *
 * Input should include website/email/company_name/lane/market columns. The script
 * preserves all columns, fills email when it can find a usable public contact
 * email, and writes an enriched CSV plus a summary JSON.
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

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
  return {
    headers: normalizedHeaders,
    rows: body
      .filter((values) => values.some((value) => String(value || '').trim()))
      .map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] || '']))),
  }
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(filePath, headers, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const body = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))]
  fs.writeFileSync(filePath, `${body.join('\n')}\n`)
}

function normalizeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).toString()
  } catch {
    return ''
  }
}

function sameHostname(left, right) {
  try {
    const l = new URL(left).hostname.replace(/^www\./, '')
    const r = new URL(right).hostname.replace(/^www\./, '')
    return l === r
  } catch {
    return false
  }
}

function contactUrls(homeUrl) {
  const url = new URL(homeUrl)
  const root = `${url.protocol}//${url.host}`
  return [
    homeUrl,
    `${root}/contact`,
    `${root}/contact-us`,
    `${root}/about`,
    `${root}/about-us`,
  ]
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#64;|&commat;/gi, '@')
    .replace(/&#46;|&period;/gi, '.')
    .replace(/&amp;/gi, '&')
}

function extractEmails(text) {
  const decoded = decodeEntities(text)
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
    .replace(/\s+dot\s+/gi, '.')
  const emails = decoded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) || []
  return Array.from(new Set(emails.map(normalizeEmail).filter(isUsableEmail)))
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, '')
    .split(/[?;\s,]+/)[0]
    .replace(/^[("'`<>]+/, '')
    .replace(/[)"'`<>.,]+$/, '')
}

function isUsableEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) return false
  if (/^(example|test|demo|sample)@/i.test(email)) return false
  if (/(example|domain|address)\.(com|org|net)$/i.test(email)) return false
  if (/(email\.com|sentry-next\.wixpress\.com|sentry\.wixpress\.com)$/i.test(email)) return false
  if (/^[a-f0-9]{24,}@/i.test(email)) return false
  if (/^homepage@www\./i.test(email)) return false
  if (/(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster)@/i.test(email)) return false
  if (/\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i.test(email)) return false
  return true
}

function scoreEmail(email, website) {
  let score = 0
  try {
    const domain = email.split('@')[1].replace(/^www\./, '')
    const host = new URL(website).hostname.replace(/^www\./, '')
    if (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`)) score += 20
  } catch {}
  if (/^(info|contact|hello|team|office|sales|admin)@/i.test(email)) score += 8
  if (/^(support|service|customerservice)@/i.test(email)) score += 3
  if (/(gmail|outlook|hotmail|yahoo)\.com$/i.test(email)) score -= 2
  return score
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'user-agent': 'VestBlock/1.0 contact discovery (+https://vestblock.io)',
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  if (!/text|html|xml/i.test(contentType)) return ''
  return (await response.text()).slice(0, 500_000)
}

async function enrichRow(row, options) {
  const currentEmail = normalizeEmail(row.email || row.Email || row.contact_email || '')
  if (isUsableEmail(currentEmail)) {
    return { ...row, email: currentEmail, email_source: 'existing_csv', email_source_url: '' }
  }

  const website = normalizeUrl(row.website || row.Website || row.site || '')
  if (!website) return { ...row, email_source: '', email_source_url: '', enrichment_status: 'missing_website' }

  const found = []
  const urls = contactUrls(website)
  for (const url of urls) {
    try {
      const text = await fetchText(url, options.timeoutMs)
      for (const email of extractEmails(text)) {
        found.push({ email, url, score: scoreEmail(email, website) })
      }

      const mailtos = Array.from(text.matchAll(/mailto:([^"'<>\\s?#]+)/gi)).map((match) => normalizeEmail(match[1]))
      for (const email of mailtos.filter(isUsableEmail)) {
        found.push({ email, url, score: scoreEmail(email, website) + 5 })
      }
    } catch {
      // Keep the enrich run moving; per-row status captures misses.
    }
  }

  const unique = Array.from(new Map(found.map((item) => [item.email, item])).values())
    .filter((item) => sameHostname(item.url, website))
    .sort((a, b) => b.score - a.score)

  if (!unique.length) {
    return { ...row, email_source: '', email_source_url: '', enrichment_status: 'no_public_email_found' }
  }

  return {
    ...row,
    email: unique[0].email,
    email_source: 'website',
    email_source_url: unique[0].url,
    enrichment_status: 'email_found',
    email_candidates: unique.map((item) => item.email).slice(0, 5).join('; '),
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const inputPath = getArg('--input')
  if (!inputPath) throw new Error('Missing --input=/path/to/file.csv')
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`)

  const lane = getArg('--lane', path.basename(path.dirname(inputPath)) || 'business')
  const limit = intArg('--limit', 250, 500)
  const concurrency = intArg('--concurrency', 6, 20)
  const timeoutMs = intArg('--timeout-ms', 8000, 30000)
  const { headers, rows } = parseCsv(fs.readFileSync(inputPath, 'utf8'))
  const limited = rows.slice(0, limit)
  const outDir = path.join(process.cwd(), 'artifacts', 'enriched-business-emails', today(), lane)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outDir, `enriched-${lane}-${stamp}.csv`)
  const summaryPath = path.join(outDir, `enriched-${lane}-${stamp}.json`)

  let processed = 0
  const enriched = await mapConcurrent(limited, concurrency, async (row) => {
    const result = await enrichRow(row, { timeoutMs })
    processed += 1
    if (processed % 10 === 0 || processed === limited.length) {
      console.log(`enriched ${processed}/${limited.length}`)
    }
    return result
  })

  const outputHeaders = Array.from(new Set([
    ...headers,
    'email',
    'email_source',
    'email_source_url',
    'enrichment_status',
    'email_candidates',
  ]))
  writeCsv(outputPath, outputHeaders, enriched)

  const sendable = enriched.filter((row) => isUsableEmail(normalizeEmail(row.email))).length
  const summary = {
    ok: true,
    inputPath,
    outputPath,
    summaryPath,
    lane,
    sourceRows: rows.length,
    processed: limited.length,
    sendable,
    missingWebsite: enriched.filter((row) => row.enrichment_status === 'missing_website').length,
    noPublicEmailFound: enriched.filter((row) => row.enrichment_status === 'no_public_email_found').length,
  }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
