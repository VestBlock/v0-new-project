import dns from 'node:dns/promises'
import fs from 'node:fs/promises'
import path from 'node:path'

import { getEmailQualityIssue, normalizeEmailAddress } from './shared-email-quality.mjs'

const DEFAULT_INSTITUTIONAL_CSV =
  '/Users/mrsanders/Library/Mobile Documents/com~apple~CloudDocs/vestblock_hedge_fund_institutional_buyers.csv'
const DEFAULT_WHOLESALE_CSV =
  '/Users/mrsanders/Library/Mobile Documents/com~apple~CloudDocs/vestblock_wholesale_buyers_4cities.csv'

const REVIEW_HOLD_RE = /paused|restructur|terminated|laid off|bankrupt|receivership|lawsuit|inactive/i
const ROLE_BUYER_RE = /^(acquisitions?|portfolio|portfolioacquisitions|investor|investors|deals?|buy|buyer|partners?|partnerships?)@/i
const BUYER_ROLE_LOCAL_PARTS = new Set([
  'acquisition',
  'acquisitions',
  'portfolio',
  'portfolioacquisitions',
  'investor',
  'investors',
  'deals',
  'offers',
  'buy',
  'buyers',
  'info',
  'contact',
  'support',
  'office',
  'team',
  'sales',
])
const mxCache = new Map()

function argValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(argValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
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
    .map((cols) => {
      const record = {}
      headers.forEach((header, colIndex) => {
        record[header] = String(cols[colIndex] || '').trim()
      })
      return record
    })
}

async function readCsv(filePath) {
  return parseCsv(await fs.readFile(filePath, 'utf8'))
}

function normalizeWebsite(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).href
  } catch {
    return raw
  }
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buyerTeamName(row) {
  const contact = compact(row.contact_name)
  if (!contact) return `${row.company_name} team`
  if (/team|desk|acquisition|office|care|routing|contact/i.test(contact)) return contact
  return contact.split(/\s+/)[0] || `${row.company_name} team`
}

function scoreBuyer(row) {
  let score = 0
  const notes = `${row.notes} ${row.source_notes}`
  const emailLocal = row.email.split('@')[0] || ''

  if (row.email_status === 'sendable') score += 40
  if (ROLE_BUYER_RE.test(row.email)) score += 12
  if (emailLocal && !/info|support|contact|office/i.test(emailLocal)) score += 6
  if (row.source_type === 'institutional') score += 10
  if (/tier 1/i.test(row.tier)) score += 10
  if (/yes/i.test(row.wholesale_friendly)) score += 20
  if (/yes/i.test(row.buys_from_wholesalers)) score += 25
  if (/sometimes/i.test(row.buys_from_wholesalers)) score += 10
  if (/both/i.test(row.portfolio_only)) score += 8
  if (/no minimum|all sizes/i.test(row.minimum_deal_size)) score += 8
  if (row.target_markets || row.city) score += 5
  if (row.contact_name && !/team|desk|contact|routing/i.test(row.contact_name)) score += 6
  if (REVIEW_HOLD_RE.test(notes)) score -= 35

  return Math.max(0, Math.min(100, score))
}

function mapInstitutional(row) {
  return {
    source_type: 'institutional',
    tier: compact(row.tier),
    company_name: compact(row.company_name),
    buyer_type: compact(row.buyer_type),
    contact_name: compact(row.acquisition_contact),
    contact_title: compact(row.contact_title),
    phone: compact(row.phone),
    email: normalizeEmailAddress(row.email),
    website: normalizeWebsite(row.website),
    market: compact(row.target_markets),
    target_markets: compact(row.target_markets),
    wholesale_friendly: compact(row.buys_from_wholesalers),
    buys_from_wholesalers: compact(row.buys_from_wholesalers),
    portfolio_only: compact(row.portfolio_only),
    minimum_deal_size: compact(row.minimum_deal_size),
    estimated_volume: compact(row.properties_owned || row.aum_or_scale),
    notes: compact(row.notes),
    source_url: compact(row.source_url),
  }
}

function mapWholesale(row) {
  return {
    source_type: 'wholesale_4cities',
    tier: 'local_wholesale_buyer',
    company_name: compact(row.company_name),
    buyer_type: compact(row.buyer_type),
    contact_name: compact(row.contact_person),
    contact_title: '',
    phone: compact(row.phone),
    email: normalizeEmailAddress(row.email),
    website: normalizeWebsite(row.website),
    market: compact(row.city),
    target_markets: compact(row.city),
    wholesale_friendly: compact(row.wholesale_friendly),
    buys_from_wholesalers: compact(row.wholesale_friendly),
    portfolio_only: '',
    minimum_deal_size: '',
    estimated_volume: compact(row.estimated_volume),
    notes: compact(row.notes),
    source_url: '',
  }
}

async function enrichEmailStatus(row) {
  if (!row.email) return { ...row, email_status: 'missing_email', email_issue: 'missing' }
  const issue = await getBuyerDeliverabilityIssue(row.email)
  return {
    ...row,
    email_status: issue ? 'review_hold' : 'sendable',
    email_issue: issue || '',
  }
}

async function hasMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain)
  try {
    const records = await dns.resolveMx(domain)
    const ok = records.length > 0
    mxCache.set(domain, ok)
    return ok
  } catch {
    mxCache.set(domain, false)
    return false
  }
}

async function getBuyerDeliverabilityIssue(value) {
  const email = normalizeEmailAddress(value)
  const qualityIssue = getEmailQualityIssue(email)
  if (!qualityIssue) {
    const domain = email.split('@')[1] || ''
    return domain && (await hasMx(domain)) ? null : 'missing_mx_records'
  }

  const [localPart, domain] = email.split('@')
  if (qualityIssue === 'blocked_local_part' && BUYER_ROLE_LOCAL_PARTS.has(localPart) && domain) {
    return (await hasMx(domain)) ? null : 'missing_mx_records'
  }

  return qualityIssue
}

function statusFor(row) {
  if (row.email_status !== 'sendable') return row.email_status
  if (REVIEW_HOLD_RE.test(`${row.notes} ${row.source_notes}`)) return 'review_hold'
  return 'draft_ready'
}

function subjectFor(row) {
  const market = row.market || row.target_markets || 'SFR'
  if (row.source_type === 'institutional') return `Off-market SFR criteria for ${row.company_name}`
  return `${market} buyer criteria + VestBlock deal flow`
}

function bodyFor(row) {
  const hello = buyerTeamName(row)
  const marketLine = row.target_markets
    ? `Your listed markets/notes point to ${row.target_markets}.`
    : `Your team looks active in ${row.market || 'the market'}.`
  const volumeLine = row.estimated_volume ? ` I also saw ${row.estimated_volume} noted in the buyer research.` : ''

  return `Hi ${hello},

I’m reaching out from VestBlock. We are organizing off-market and wholesale-friendly residential opportunities and want to route deals only where they fit a buyer's real criteria.

${marketLine}${volumeLine}

Could you share your current buy box or preferred submission process?

A few quick criteria we would like to confirm:
- target markets or zip codes
- property type and occupancy
- price range, ARV, and discount requirements
- rehab tolerance
- close timeline and proof-of-funds requirements
- whether you review singles, small packages, or portfolios

If it helps, we can send a small sample first instead of adding you to a broad list.

If this is not relevant, reply no and I will not follow up.

Best,
Robert Sanders
VestBlock
contact@vestblock.io`
}

function draftMarkdown(row) {
  return `To: ${row.email}
Subject: ${subjectFor(row)}
Market: ${row.market || row.target_markets}
Website: ${row.website}
Company: ${row.company_name}
Source: ${row.source_type}

${bodyFor(row)}
`
}

async function writeDrafts(rows, draftsDir, limit) {
  await fs.mkdir(draftsDir, { recursive: true })
  const existing = await fs.readdir(draftsDir).catch(() => [])
  await Promise.all(
    existing
      .filter((entry) => entry.toLowerCase().endsWith('.md'))
      .map((entry) => fs.unlink(path.join(draftsDir, entry)).catch(() => {}))
  )
  const written = []
  for (const row of rows.slice(0, limit)) {
    const filename = `${String(written.length + 1).padStart(2, '0')}-${slugify(row.company_name)}.md`
    const filePath = path.join(draftsDir, filename)
    await fs.writeFile(filePath, draftMarkdown(row), 'utf8')
    written.push(filePath)
  }
  return written
}

async function main() {
  const date = argValue('--date', new Date().toISOString().slice(0, 10))
  const institutionalPath = argValue('--institutional', DEFAULT_INSTITUTIONAL_CSV)
  const wholesalePath = argValue('--wholesale', DEFAULT_WHOLESALE_CSV)
  const dailyTarget = intArg('--daily-target', 25, 50)
  const draftLimit = intArg('--draft-limit', dailyTarget, 50)
  const artifactDir = argValue('--artifact-dir', path.join(process.cwd(), 'artifacts', 'offline-automation', 'kimi-buyers', date))
  const draftsDir = argValue(
    '--drafts-dir',
    path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-drafts', date, 'buyers', 'kimi')
  )

  const institutional = (await readCsv(institutionalPath)).map(mapInstitutional)
  const wholesale = (await readCsv(wholesalePath)).map(mapWholesale)
  const deduped = []
  const seen = new Set()

  for (const row of [...institutional, ...wholesale]) {
    const key = row.email || `${row.company_name.toLowerCase()}|${row.market.toLowerCase()}`
    if (!row.company_name || seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  const enriched = []
  for (const row of deduped) {
    const emailRow = await enrichEmailStatus(row)
    const scored = { ...emailRow, fit_score: scoreBuyer(emailRow) }
    enriched.push({ ...scored, outreach_status: statusFor(scored), subject: subjectFor(scored) })
  }

  enriched.sort((left, right) => right.fit_score - left.fit_score || left.company_name.localeCompare(right.company_name))

  const draftReady = enriched.filter((row) => row.outreach_status === 'draft_ready')
  const draftFiles = await writeDrafts(draftReady, draftsDir, draftLimit)
  const columns = [
    'outreach_status',
    'fit_score',
    'source_type',
    'tier',
    'company_name',
    'buyer_type',
    'contact_name',
    'contact_title',
    'email',
    'email_status',
    'email_issue',
    'phone',
    'website',
    'market',
    'target_markets',
    'wholesale_friendly',
    'buys_from_wholesalers',
    'portfolio_only',
    'minimum_deal_size',
    'estimated_volume',
    'subject',
    'notes',
    'source_url',
  ]

  await fs.mkdir(artifactDir, { recursive: true })
  await fs.writeFile(path.join(artifactDir, 'buyer-outreach-queue.csv'), `${toCsv(enriched, columns)}\n`, 'utf8')
  await fs.writeFile(path.join(artifactDir, 'draft-ready-buyers.csv'), `${toCsv(draftReady, columns)}\n`, 'utf8')
  await fs.writeFile(
    path.join(artifactDir, 'summary.json'),
    `${JSON.stringify(
      {
        ok: true,
        date,
        generatedAt: new Date().toISOString(),
        institutionalRows: institutional.length,
        wholesaleRows: wholesale.length,
        uniqueBuyers: enriched.length,
        draftReady: draftReady.length,
        draftsWritten: draftFiles.length,
        dailyTarget,
        targetHit: draftFiles.length >= dailyTarget,
        missingEmail: enriched.filter((row) => row.outreach_status === 'missing_email').length,
        reviewHold: enriched.filter((row) => row.outreach_status === 'review_hold').length,
        artifactDir,
        draftsDir,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        date,
        uniqueBuyers: enriched.length,
        draftReady: draftReady.length,
        draftsWritten: draftFiles.length,
        dailyTarget,
        targetHit: draftFiles.length >= dailyTarget,
        artifactDir,
        draftsDir,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
