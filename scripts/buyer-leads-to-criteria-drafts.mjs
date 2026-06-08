import fs from 'node:fs/promises'
import path from 'node:path'

import { normalizeEmailAddress } from './shared-email-quality.mjs'

function argValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(argValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') inQuotes = true
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
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  if (!rows.length) return []
  const headers = rows[0].map((header) => String(header || '').trim())
  return rows
    .slice(1)
    .filter((cols) => cols.some((value) => String(value || '').trim()))
    .map((cols) => Object.fromEntries(headers.map((header, colIndex) => [header, String(cols[colIndex] || '').trim()])))
}

async function readCsvIfExists(filePath) {
  try {
    return parseCsv(await fs.readFile(filePath, 'utf8'))
  } catch {
    return []
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function firstName(name) {
  const value = String(name || '').trim()
  if (!value) return 'there'
  const first = value.split(/\s+/)[0]
  return /^[a-z]+$/i.test(first) ? first : 'there'
}

function bodyFor(row) {
  const market = row.market || 'your market'
  const proof = row.why_like_brad_or_enrique || row.lead_type || 'your buyer activity'
  return `Hi ${firstName(row.contact_person || row.business_name)},

I’m reaching out from VestBlock. We are organizing seller and investor opportunities and I’m trying to route deals only to buyers whose criteria actually match.

I saw ${proof} in ${market}, so I wanted to ask for your current buy box before sending anything over.

Could you share what you prefer on:
- target ZIPs or neighborhoods
- property type and occupancy
- max purchase price or ARV range
- repair tolerance
- assignment/wholesale comfort
- close timeline and proof-of-funds requirements
- what you need in a deal packet

If it helps, I can send a small sample first instead of adding you to a broad list.

If this is not relevant, reply no and I will not follow up.

Best,
Robert Sanders
VestBlock
contact@vestblock.io`
}

function draftFor(row) {
  return `To: ${normalizeEmailAddress(row.email)}
Subject: ${row.market || 'Buyer'} buy box - quick criteria check
Market: ${row.market || ''}
Website: ${row.website || ''}
Company: ${row.business_name || ''}
Source: buyer-leads

${bodyFor(row)}
`
}

async function clearDraftDir(draftsDir) {
  await fs.mkdir(draftsDir, { recursive: true })
  const entries = await fs.readdir(draftsDir).catch(() => [])
  await Promise.all(entries.filter((entry) => entry.endsWith('.md')).map((entry) => fs.unlink(path.join(draftsDir, entry)).catch(() => {})))
}

async function main() {
  const date = argValue('--date', new Date().toISOString().slice(0, 10))
  const sourceDir = argValue('--source-dir', path.join(process.cwd(), 'artifacts', 'offline-automation', 'buyer-leads', date))
  const draftsDir = argValue('--drafts-dir', path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-drafts', date, 'buyers', 'discovered'))
  const limit = intArg('--limit', 15, 50)
  const includeRoleReview = hasFlag('--include-role-review')
  const directRows = await readCsvIfExists(path.join(sourceDir, 'direct-email-ready.csv'))
  const roleRows = includeRoleReview ? await readCsvIfExists(path.join(sourceDir, 'role-email-review.csv')) : []
  const rows = [...directRows, ...roleRows]
    .filter((row) => normalizeEmailAddress(row.email))
    .sort((left, right) => Number(right.fit_score_total || 0) - Number(left.fit_score_total || 0))

  await clearDraftDir(draftsDir)
  const written = []
  const seen = new Set()
  for (const row of rows) {
    const email = normalizeEmailAddress(row.email)
    if (!email || seen.has(email)) continue
    seen.add(email)
    const filename = `${String(written.length + 1).padStart(2, '0')}-${slugify(row.business_name || email)}.md`
    const filePath = path.join(draftsDir, filename)
    await fs.writeFile(filePath, draftFor(row), 'utf8')
    written.push(filePath)
    if (written.length >= limit) break
  }

  const summary = {
    ok: true,
    date,
    sourceDir,
    draftsDir,
    directRows: directRows.length,
    roleRows: roleRows.length,
    draftsWritten: written.length,
    includeRoleReview,
    written,
  }
  await fs.writeFile(path.join(draftsDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
