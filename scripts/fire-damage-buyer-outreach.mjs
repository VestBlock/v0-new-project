/**
 * VestBlock — fire-damage / structural rehab buyer outreach.
 *
 * Dry-run by default. Sends only when --send is passed.
 *
 * Examples:
 *   node --env-file=.env.local scripts/fire-damage-buyer-outreach.mjs
 *   node --env-file=.env.local scripts/fire-damage-buyer-outreach.mjs --send --limit=3
 */

import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'
import { getEmailQualityIssue, normalizeEmailAddress } from './shared-email-quality.mjs'

const args = process.argv.slice(2)
const SEND = args.includes('--send')
const ALLOW_GENERIC = args.includes('--allow-generic')

function getArg(name, fallback = null) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const DEFAULT_CSV = 'data/buyer-outreach/kc-fire-damage-buyers.csv'
const CSV_PATH = getArg('csv', DEFAULT_CSV)
const PROPERTY_ADDRESS = getArg('property', '505 Wallace Ave, Kansas City, MO 64125')
const LIMIT = getArg('limit') ? Number.parseInt(getArg('limit'), 10) : null
const THROTTLE_MS = getArg('throttle') ? Number.parseInt(getArg('throttle'), 10) : 1500
const BCC = getArg('bcc')
const FROM_EMAIL = process.env.FROM_EMAIL || 'acquisitions@vestblock.io'

const SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io\n(414) 687-6923'
const FOOTER =
  'VestBlock coordinates real estate deal flow and buyer relationships. Any opportunity is subject to buyer diligence, title, access, condition verification, and final written agreement. If you would prefer not to receive these messages, reply "unsubscribe" and we will remove you.'

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      if (field !== '' || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
      continue
    }
    field += char
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? '')).join(','))].join('\n')
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildSubject(contact) {
  return `Fire-damaged KC property - buyer criteria?`
}

function buildBody(contact) {
  const company = compact(contact.company_name) || 'your team'
  const opener =
    contact.buyer_type === 'investor_contractor'
      ? `I'm reaching out because ${company} appears to work directly with KC investors on heavier rehab projects.`
      : contact.buyer_type === 'builder_investor_relations' || contact.buyer_type === 'urban_infill_developer'
        ? `I'm reaching out because ${company} appears active around development or investor-backed projects in Kansas City.`
        : `I'm reaching out because ${company} appears to buy difficult as-is properties in Kansas City.`

  return [
    `Hi ${company} team,`,
    '',
    opener,
    '',
    `I'm checking buyer fit on a fire-damaged property near ${PROPERTY_ADDRESS}. It is not a normal cosmetic rehab, so I'm only trying to route it to groups that actually buy fire-damaged or structural-heavy projects.`,
    '',
    'Before I send anything over, can you let me know:',
    '- Do you buy fire-damaged houses or burned shells in Kansas City?',
    '- Do you buy assignments, or only direct purchases?',
    '- What minimum spread or max purchase price makes a fire-damage project worth reviewing?',
    '- What do you need first: photos, access, inspection report, city/code history, insurance scope, or title details?',
    '',
    'If this is not your lane but you know a reliable KC buyer who takes these on, I would appreciate the referral.',
    '',
    'Best,',
    SIGNATURE,
    '',
    '-',
    FOOTER,
  ].join('\n')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendWithResend(resend, draft) {
  const payload = {
    from: FROM_EMAIL,
    to: draft.email,
    subject: draft.subject,
    text: draft.body,
  }
  if (BCC) payload.bcc = BCC
  const { data, error } = await resend.emails.send(payload)
  if (error) return { ok: false, error: error.message || 'Resend send failed.' }
  return { ok: true, id: data?.id || null }
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`)

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
  const headers = rows[0].map((header) => header.trim())
  const records = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])))

  const drafts = []
  const manual = []
  const seen = new Set()

  for (const record of records) {
    const email = normalizeEmailAddress(record.email)
    const qualityIssue = email ? getEmailQualityIssue(email) : 'missing'
    const base = {
      ...record,
      property_address: PROPERTY_ADDRESS,
      email,
      email_issue: qualityIssue || '',
      subject: buildSubject(record),
      body: buildBody(record),
    }

    const genericAllowed = ALLOW_GENERIC && qualityIssue === 'blocked_local_part'
    if (!email || (qualityIssue && !genericAllowed)) {
      manual.push(base)
      continue
    }
    if (seen.has(email)) continue
    seen.add(email)
    drafts.push(base)
  }

  const selected = LIMIT ? drafts.slice(0, LIMIT) : drafts
  const dateStamp = new Date().toISOString().slice(0, 10)
  const outDir = path.join(process.cwd(), 'artifacts', 'buyer-outreach', 'fire-damage', dateStamp)
  fs.mkdirSync(outDir, { recursive: true })

  const columns = [
    'market',
    'company_name',
    'buyer_type',
    'email',
    'phone',
    'website',
    'source_url',
    'fit_notes',
    'contact_status',
    'property_address',
    'email_issue',
    'subject',
    'body',
  ]

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(path.join(outDir, `fire-damage-buyer-drafts-${stamp}.csv`), `${toCsv(selected, columns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, `fire-damage-buyer-manual-${stamp}.csv`), `${toCsv(manual, columns)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(outDir, `fire-damage-buyer-review-${stamp}.txt`),
    selected
      .map((draft, index) =>
        [
          `#${index + 1} ${draft.company_name} <${draft.email}>`,
          `SOURCE: ${draft.source_url}`,
          `SUBJECT: ${draft.subject}`,
          '',
          draft.body,
          '',
          '='.repeat(100),
          '',
        ].join('\n')
      )
      .join('\n'),
    'utf8'
  )

  console.log('VestBlock Fire-Damage Buyer Outreach')
  console.log('====================================')
  console.log(`CSV:          ${CSV_PATH}`)
  console.log(`Property:     ${PROPERTY_ADDRESS}`)
  console.log(`Mode:         ${SEND ? 'LIVE SEND (Resend)' : 'DRY RUN (no emails sent)'}`)
  console.log(`Email drafts: ${selected.length}`)
  console.log(`Manual queue: ${manual.length}`)
  console.log(`Artifacts:    ${outDir}`)

  if (!SEND) {
    console.log('\nDry run complete. Review artifacts, then rerun with --send.')
    return
  }
  if (!process.env.RESEND_API_KEY || !FROM_EMAIL) throw new Error('Missing RESEND_API_KEY or FROM_EMAIL for live send.')

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results = []
  for (let index = 0; index < selected.length; index += 1) {
    const draft = selected[index]
    const result = await sendWithResend(resend, draft)
    results.push({
      company_name: draft.company_name,
      email: draft.email,
      ok: result.ok,
      id: result.id || null,
      error: result.error || null,
    })
    console.log(`${result.ok ? '✓' : '✗'} ${index + 1}/${selected.length} ${draft.company_name} <${draft.email}> ${result.ok ? result.id : result.error}`)
    if (index < selected.length - 1) await sleep(THROTTLE_MS)
  }

  fs.writeFileSync(path.join(outDir, `fire-damage-buyer-results-${stamp}.json`), `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  const sentCount = results.filter((row) => row.ok).length
  console.log(`\nLive send complete. Sent: ${sentCount} | Failed: ${results.length - sentCount}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
