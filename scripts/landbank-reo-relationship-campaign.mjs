import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'

const args = process.argv.slice(2)

function getArg(name, fallback = '') {
  const match = args.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : fallback
}

function hasFlag(name) {
  return args.includes(`--${name}`)
}

const SEND = hasFlag('send')
const CSV_PATH = getArg('csv', 'data/relationship-campaigns/landbank-reo-targets.csv')
const STATE_PATH = getArg('state', 'data/relationship-campaigns/landbank-reo-state.json')
const DAILY_CAP = Number.parseInt(getArg('daily-cap', '6'), 10) || 6
const STAGE_OVERRIDE = getArg('stage', 'auto')
const ONLY_TYPES = getArg('only-types', '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)
const THROTTLE_MS = Number.parseInt(getArg('throttle', '1800'), 10) || 1800
const OUT_DIR = getArg(
  'out-dir',
  path.join(
    process.cwd(),
    'artifacts',
    'offline-automation',
    'relationship-campaigns',
    new Date().toISOString().slice(0, 10),
    'landbank-reo'
  )
)
const LEDGER_PATH = path.join(process.cwd(), 'artifacts', 'offline-automation', 'relationship-campaigns', 'landbank-reo-sent-ledger.jsonl')

const REQUIRED_OPTOUT = 'reply no and i will not follow up'
const INITIAL_WAIT_DAYS = 6
const FOLLOWUP_ONE_WAIT_DAYS = 10

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i += 1
      if (field !== '' || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else field += char
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function readCsvTargets(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const headerIndex = (name) => headers.indexOf(name)

  return rows
    .slice(1)
    .filter((row) => row.length)
    .map((row) => ({
      campaignName: row[headerIndex('campaign_name')] || 'landbank_reo_relationships',
      targetType: (row[headerIndex('target_type')] || '').trim().toLowerCase(),
      organizationName: (row[headerIndex('organization_name')] || '').trim(),
      market: (row[headerIndex('market')] || '').trim(),
      region: (row[headerIndex('region')] || '').trim(),
      contactName: (row[headerIndex('contact_name')] || '').trim(),
      contactTitle: (row[headerIndex('contact_title')] || '').trim(),
      email: normalizeEmail(row[headerIndex('email')] || ''),
      website: (row[headerIndex('website')] || '').trim(),
      contactPage: (row[headerIndex('contact_page')] || '').trim(),
      inventoryFocus: (row[headerIndex('inventory_focus')] || '').trim(),
      relationshipAngle: (row[headerIndex('relationship_angle')] || '').trim(),
      notes: (row[headerIndex('notes')] || '').trim(),
      sendAllowed: String(row[headerIndex('send_allowed')] || '').trim().toLowerCase() === 'true',
    }))
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function appendJsonl(filePath, rows) {
  if (!rows.length) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function daysSince(iso) {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = Date.now() - new Date(iso).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

function senderName() {
  return process.env.OUTREACH_SENDER_NAME || 'Robert Sanders'
}

function senderPhone() {
  return process.env.OUTREACH_SENDER_PHONE || '(414) 687-6923'
}

function senderEmail() {
  return process.env.FROM_EMAIL || process.env.GOOGLE_WORKSPACE_SENDER || 'contact@vestblock.io'
}

function resendSender() {
  return process.env.FROM_EMAIL || 'contact@vestblock.io'
}

function outreachMailingAddress() {
  return (
    process.env.OUTREACH_MAILING_ADDRESS ||
    process.env.BUSINESS_MAILING_ADDRESS ||
    process.env.COMPANY_MAILING_ADDRESS ||
    process.env.PUBLIC_BUSINESS_ADDRESS ||
    ''
  ).trim()
}

function hasGmailConfig() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_WORKSPACE_SENDER
  )
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL)
}

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}.`)
  const data = await response.json()
  if (!data.access_token) throw new Error('Google token refresh did not return an access token.')
  return data.access_token
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function ensureComplianceBody(body) {
  const parts = [String(body || '').trim()]
  const normalized = parts[0].toLowerCase()
  if (!normalized.includes(REQUIRED_OPTOUT)) {
    parts.push('If this is not relevant, reply no and I will not follow up.')
  }
  const mailingAddress = outreachMailingAddress()
  if (mailingAddress && !normalized.includes(mailingAddress.toLowerCase())) {
    parts.push(`VestBlock mailing address: ${mailingAddress}`)
  }
  return parts.filter(Boolean).join('\n\n')
}

function signatureBlock() {
  return [senderName(), 'VestBlock', senderEmail(), senderPhone()].join('\n')
}

function typeLabel(targetType) {
  const labels = {
    county_land_bank: 'county land bank',
    municipal_land_bank: 'municipal land bank',
    metro_land_bank: 'metropolitan land bank',
    state_land_bank: 'state land bank',
    land_bank: 'land bank',
    bank_special_assets: 'special assets team',
    reo_asset_manager: 'REO asset management team',
    servicer_disposition: 'servicer disposition team',
  }
  return labels[targetType] || 'real estate disposition team'
}

function stageFor(target, stateEntry) {
  if (STAGE_OVERRIDE !== 'auto') return STAGE_OVERRIDE
  if (!stateEntry || !stateEntry.lastStageSent) return 'initial'
  if (stateEntry.doNotContact || stateEntry.replied) return 'skip'

  if (stateEntry.lastStageSent === 'initial' && daysSince(stateEntry.lastSentAt) >= INITIAL_WAIT_DAYS) {
    return 'followup_1'
  }
  if (stateEntry.lastStageSent === 'followup_1' && daysSince(stateEntry.lastSentAt) >= FOLLOWUP_ONE_WAIT_DAYS) {
    return 'followup_2'
  }
  return 'hold'
}

function subjectFor(target, stage) {
  const org = target.organizationName
  if (stage === 'followup_1') {
    return `Following up on a VestBlock inventory relationship idea for ${org}`
  }
  if (stage === 'followup_2') {
    return `Last follow-up: VestBlock as a qualified acquisition outlet for ${org}`
  }
  if (target.targetType.includes('bank') && !target.targetType.includes('land')) {
    return `VestBlock relationship idea for ${org}'s bank-owned and special-assets inventory`
  }
  return `VestBlock relationship idea for ${org}'s land bank inventory`
}

function introFor(target) {
  const org = target.organizationName
  const market = target.market ? ` in ${target.market}` : ''
  const kind = typeLabel(target.targetType)
  return `I'm reaching out from VestBlock regarding a possible relationship with ${org}${market}. We understand ${org} operates as a ${kind} and works across ${target.inventoryFocus || 'publicly controlled and redevelopment-oriented inventory'}.`
}

function buildInitialBody(target) {
  const relationshipAngle = target.relationshipAngle || 'repeat acquisition and disposition collaboration'
  const notes = target.notes ? `\n\nWhat stood out to us: ${target.notes}` : ''
  return `Hi ${target.contactName || `${target.organizationName} team`},

${introFor(target)}

VestBlock is building a disciplined real estate inventory and partner-routing platform. The goal is not to act like a noisy blast list or a one-off wholesaler. We are trying to build a repeatable channel where:

- properties can be reviewed by actual buy-box fit
- local rehab, rental, and redevelopment operators are matched more intentionally
- funding-ready opportunities can be routed to capital partners when needed
- accountability stays tighter through clear records, proof-of-funds expectations, and post-introduction follow-through

For organizations like yours, we are interested in becoming a useful relationship on the disposition side when there is inventory that needs a serious local buyer, operator, or redevelopment path instead of general noise.

In practical terms, we would like to learn:

- how ${target.organizationName} prefers to handle new buyer / developer / operator relationships
- whether there is a qualification process, approved list, alert list, or intake path we should follow
- what kinds of properties or projects are hardest to move right now
- whether package opportunities, scattered-site inventory, rehab-heavy assets, or smaller-balance properties are part of the conversation

Our aim is straightforward: become a trusted lane for ${relationshipAngle}. We want the buyers, lenders, and operators on our side organized enough to move when something actually fits.
${notes}

If there is a better person for acquisition, disposition, redevelopment, or partnership conversations, I would appreciate the redirect.

Thank you,
${signatureBlock()}`
}

function buildFollowupOneBody(target) {
  return `Hi ${target.contactName || `${target.organizationName} team`},

I wanted to follow up on my note about a possible relationship between ${target.organizationName} and VestBlock.

We are actively building VestBlock around distressed, transitional, and redevelopment-oriented inventory. The lane we are trying to create is simple:

- cleaner buyer and operator criteria
- real proof-of-funds and closing-capacity expectations
- a more serious path for rehab, rental, and redevelopment assets
- lender routing when capital fit is part of the bottleneck

If ${target.organizationName} has a preferred path for introducing new acquisition partners, developer relationships, or qualified local operators, I would be glad to follow it.

Even a short reply with the right contact, submission page, approved-buyer process, or disposition channel would help us line up the relationship the right way.

Best,
${signatureBlock()}`
}

function buildFollowupTwoBody(target) {
  return `Hi ${target.contactName || `${target.organizationName} team`},

This is my last follow-up on the VestBlock relationship idea.

We are building VestBlock to become a more disciplined local routing layer for real estate inventory: matching properties to buyers, operators, lenders, and redevelopment paths based on fit instead of volume. That is especially relevant for land bank and bank-owned inventory that benefits from serious local follow-through.

If there is a standing intake path, approved-buyer process, developer list, or asset-disposition contact we should work through, feel free to point us there. If not, no problem at all.

Thank you for your time,
${signatureBlock()}`
}

function buildDraft(target, stage) {
  const subject = subjectFor(target, stage)
  const body =
    stage === 'followup_1'
      ? buildFollowupOneBody(target)
      : stage === 'followup_2'
        ? buildFollowupTwoBody(target)
        : buildInitialBody(target)

  return {
    campaignName: target.campaignName,
    targetType: target.targetType,
    organizationName: target.organizationName,
    market: target.market,
    email: target.email,
    to: target.email,
    website: target.website,
    contactPage: target.contactPage,
    stage,
    subject,
    body: ensureComplianceBody(body),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendWithGmail({ to, subject, body }) {
  const accessToken = await getGoogleAccessToken()
  const mime = [
    `From: ${senderName()} <${senderEmail()}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(mime) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'gmail',
      error: typeof data?.error?.message === 'string' ? data.error.message : `Gmail send failed with ${response.status}.`,
    }
  }
  return { ok: true, provider: 'gmail', providerMessageId: data.id || null }
}

async function sendWithResend({ to, subject, body }) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: resendSender(),
    to,
    subject,
    text: body,
  })
  if (error) return { ok: false, provider: 'resend', error: error.message || 'Resend send failed.' }
  return { ok: true, provider: 'resend', providerMessageId: data?.id || null }
}

async function sendDraft(draft) {
  if (hasResendConfig()) return sendWithResend(draft)
  if (hasGmailConfig()) return sendWithGmail(draft)
  return { ok: false, provider: 'none', error: 'No Gmail or Resend outbound provider is configured.' }
}

function loadSentEmails(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return new Set()
  return new Set(
    fs
      .readFileSync(ledgerPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeEmail(JSON.parse(line).to)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
  )
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Target CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }

  const targets = readCsvTargets(CSV_PATH)
  const state = readJson(STATE_PATH, {})
  const sentEmails = loadSentEmails(LEDGER_PATH)

  const eligible = targets
    .filter((target) => target.email && target.sendAllowed)
    .filter((target) => (ONLY_TYPES.length ? ONLY_TYPES.includes(target.targetType) : true))
    .map((target) => {
      const stateEntry = state[target.email] || {}
      return {
        target,
        stateEntry,
        stage: stageFor(target, stateEntry),
      }
    })
    .filter((item) => item.stage !== 'skip' && item.stage !== 'hold')
    .filter((item) => !(item.stage === 'initial' && sentEmails.has(item.target.email)))
    .slice(0, DAILY_CAP)

  const drafts = eligible.map(({ target, stage }) => buildDraft(target, stage))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const draftsJsonPath = path.join(OUT_DIR, `landbank-reo-drafts-${stamp}.json`)
  const draftsTxtPath = path.join(OUT_DIR, `landbank-reo-drafts-${stamp}.txt`)
  writeJson(draftsJsonPath, drafts)
  fs.writeFileSync(
    draftsTxtPath,
    drafts
      .map(
        (draft, index) =>
          `#${index + 1} ${draft.organizationName} <${draft.email}> [${draft.stage}]\nSubject: ${draft.subject}\n\n${draft.body}\n\n${'='.repeat(90)}\n`
      )
      .join('\n')
  )

  const summary = {
    csvPath: CSV_PATH,
    mode: SEND ? 'live_send' : 'dry_run',
    totalTargets: targets.length,
    eligibleToday: drafts.length,
    dailyCap: DAILY_CAP,
    stageOverride: STAGE_OVERRIDE,
    draftsJsonPath,
    draftsTxtPath,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (!SEND) return

  const results = []
  const ledgerRows = []
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]
    const result = await sendDraft(draft)
    const row = {
      organizationName: draft.organizationName,
      email: draft.email,
      stage: draft.stage,
      ok: result.ok,
      provider: result.provider,
      providerMessageId: result.providerMessageId || null,
      error: result.error || null,
      sentAt: new Date().toISOString(),
    }
    results.push(row)
    if (result.ok) {
      state[draft.email] = {
        ...(state[draft.email] || {}),
        organizationName: draft.organizationName,
        targetType: draft.targetType,
        lastStageSent: draft.stage,
        lastSentAt: row.sentAt,
        sendCount: Number(state[draft.email]?.sendCount || 0) + 1,
      }
      ledgerRows.push({
        campaign: draft.campaignName,
        to: draft.email,
        organizationName: draft.organizationName,
        stage: draft.stage,
        provider: result.provider,
        providerMessageId: result.providerMessageId || null,
        sentAt: row.sentAt,
      })
    }

    console.log(`${result.ok ? '✓' : '✗'} ${index + 1}/${drafts.length} ${draft.organizationName} <${draft.email}> ${result.ok ? draft.stage : result.error}`)
    if (index < drafts.length - 1) await sleep(THROTTLE_MS)
  }

  writeJson(path.join(OUT_DIR, `landbank-reo-send-results-${stamp}.json`), results)
  writeJson(STATE_PATH, state)
  appendJsonl(LEDGER_PATH, ledgerRows)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
