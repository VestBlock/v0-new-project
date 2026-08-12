import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'

const args = process.argv.slice(2)
const SEND = args.includes('--send')
const getArg = (name, fallback = '') => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const CSV_PATH = getArg('csv', 'data/institutional-buyers/buybox-targets-2026-07-12.csv')
const LIMIT = Number.parseInt(getArg('limit', '10'), 10) || 10
const THROTTLE_MS = Number.parseInt(getArg('throttle', '1500'), 10) || 1500
const OUT_DIR = path.join(process.cwd(), 'tmp', 'outreach')
const LEDGER_PATH = path.join(OUT_DIR, 'institutional-buybox-sent-ledger.jsonl')

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
      } else if (char === '"') quoted = false
      else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      if (field || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function readTargets(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])))
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getSender() {
  return process.env.OUTREACH_FROM_EMAIL || process.env.FROM_EMAIL || process.env.RESEND_EMAIL || 'acquisitions@vestblock.io'
}

function mailingAddress() {
  return (
    process.env.OUTREACH_MAILING_ADDRESS ||
    process.env.BUSINESS_MAILING_ADDRESS ||
    process.env.COMPANY_MAILING_ADDRESS ||
    process.env.PUBLIC_BUSINESS_ADDRESS ||
    ''
  ).trim()
}

function readSentEmails() {
  if (!fs.existsSync(LEDGER_PATH)) return new Set()
  return new Set(
    fs.readFileSync(LEDGER_PATH, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeEmail(JSON.parse(line).email)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
  )
}

function buildDraft(target) {
  const company = target.company_name || 'your team'
  const role = String(target.contact_role || '').replace(/\s*\/\s*/g, ' ').trim().toLowerCase()
  const possessiveCompany = /s$/i.test(company) ? `${company}'` : `${company}'s`
  const roleLine = role ? `I found this public ${role} path for ${company}, so if this belongs with acquisitions, portfolio growth, investments, or broker relations, I would appreciate the redirect.` : `If this belongs with acquisitions, portfolio growth, investments, or broker relations, I would appreciate the redirect.`
  const subject = `VestBlock deal flow / buy box for ${company}`
  const body = [
    `Hi ${company} team,`,
    '',
    "I'm Robert with VestBlock. We are building active off-market and semi-off-market real estate deal flow and I wanted to find the right person for your acquisition buy box.",
    '',
    roleLine,
    '',
    'The lanes we are sourcing from include:',
    '- tax / code / lien pressure',
    '- vacant equity and absentee-owner files',
    '- portfolio landlords and tired landlords',
    '- preforeclosure / subject-to / seller-finance conversations',
    '- stale on-market creative-finance opportunities',
    '- land, infill, small multifamily, REO, and land-bank relationships',
    '',
    'What we need from your side is simple: markets, asset type, price range, condition, occupancy, minimum rent/yield, closing speed, package size, and any no-go criteria. Once we know the box, we can route only opportunities that have a real chance of fitting instead of sending noise.',
    '',
    `Would you point me to the right person for ${possessiveCompany} SFR, BTR, portfolio, or real estate acquisition criteria?`,
    '',
    'Best,',
    'Robert Sanders',
    'VestBlock',
    'acquisitions@vestblock.io',
    '(414) 687-6923',
    '',
    'VestBlock coordinates real estate deal flow and buyer relationships. We are not a brokerage, lender, attorney, property manager, or closing agent, and we do not guarantee transaction volume, financing, closing, or investment outcomes.',
    'If this is not relevant, reply "unsubscribe" or "remove me" and I will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join('\n')
  return { ...target, email: normalizeEmail(target.email), subject, body }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const sentEmails = readSentEmails()
  const selected = readTargets(CSV_PATH)
    .filter((target) => isEmail(target.email))
    .map(buildDraft)
    .filter((draft) => !sentEmails.has(draft.email))
    .slice(0, LIMIT)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const draftsJsonPath = path.join(OUT_DIR, `institutional-buybox-drafts-${stamp}.json`)
  const draftsTxtPath = path.join(OUT_DIR, `institutional-buybox-drafts-${stamp}.txt`)
  fs.writeFileSync(draftsJsonPath, `${JSON.stringify(selected, null, 2)}\n`)
  fs.writeFileSync(
    draftsTxtPath,
    selected.map((draft, index) => `#${index + 1} ${draft.company_name} <${draft.email}>\nSubject: ${draft.subject}\nSource: ${draft.source_url}\n\n${draft.body}\n\n${'='.repeat(90)}\n`).join('\n')
  )

  console.log(`Mode: ${SEND ? 'LIVE SEND' : 'DRY RUN'}`)
  console.log(`Selected: ${selected.length}`)
  console.log(`Draft review: ${draftsTxtPath}`)

  if (!SEND) return
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY.')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const results = []
  for (let index = 0; index < selected.length; index += 1) {
    const draft = selected[index]
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: draft.email,
      subject: draft.subject,
      text: draft.body,
    })
    const row = {
      company_name: draft.company_name,
      email: draft.email,
      ok: !error,
      resend_id: data?.id || null,
      error: error?.message || null,
      sent_at: new Date().toISOString(),
      source_url: draft.source_url,
    }
    results.push(row)
    console.log(`${row.ok ? 'ok' : 'failed'} ${index + 1}/${selected.length} ${draft.company_name} <${draft.email}> ${row.resend_id || row.error}`)
    if (row.ok) fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(row)}\n`)
    if (index < selected.length - 1) await sleep(THROTTLE_MS)
  }
  const resultsPath = path.join(OUT_DIR, `institutional-buybox-results-${stamp}.json`)
  fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`)
  const sent = results.filter((row) => row.ok).length
  console.log(`Done. Sent ${sent}/${results.length}. Results: ${resultsPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
