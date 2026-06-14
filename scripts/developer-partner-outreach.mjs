/**
 * VestBlock developer / builder partner outreach generator.
 *
 * Dry run by default. Creates review artifacts and a send-ready subset.
 * Use --send only after reviewing the generated copy.
 *
 * Examples:
 *   node --env-file=.env.local scripts/developer-partner-outreach.mjs --csv="/path/to/vestblock_developers_master.csv"
 *   node --env-file=.env.local scripts/developer-partner-outreach.mjs --csv="/path/to/vestblock_developers_master.csv" --market="Cleveland"
 *   node --env-file=.env.local scripts/developer-partner-outreach.mjs --csv="/path/to/vestblock_developers_master.csv" --send --limit=20
 */

import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'
import { formatScriptError, getEmailQualityIssue, isUsableContactEmail, normalizeEmailAddress } from './shared-email-quality.mjs'

const args = process.argv.slice(2)
const SEND = args.includes('--send')

function getArg(name, fallback = null) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const CSV_PATH = getArg('csv')
const MARKET_FILTER = getArg('market')
const LIMIT = getArg('limit') ? Number.parseInt(getArg('limit'), 10) : null
const THROTTLE_MS = getArg('throttle') ? Number.parseInt(getArg('throttle'), 10) : 1500
const BCC = getArg('bcc')
const ALLOW_GENERIC = args.includes('--allow-generic')

const SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io\n(414) 687-6923'
const FOOTER =
  'VestBlock coordinates real estate deal flow, builder and developer relationships, and capital introductions. ' +
  'Any opportunity, funding path, or assignment is subject to diligence, underwriting, title, and final agreement by the parties involved. ' +
  'If you would prefer not to receive these messages, reply "unsubscribe" and we will remove you.'

const PHASE_ONE_MARKETS = new Set([
  'Toledo, OH',
  'Cleveland, OH',
  'Columbus, OH',
  'Milwaukee, WI',
  'Memphis, TN',
  'Racine, WI',
  'Kenosha, WI',
])

const MARKET_LOOKUP = {
  Cleveland: 'Cleveland, OH',
  Columbus: 'Columbus, OH',
  Toledo: 'Toledo, OH',
  Milwaukee: 'Milwaukee, WI',
  Memphis: 'Memphis, TN',
  Atlanta: 'Atlanta, GA',
  'New Orleans': 'New Orleans, LA',
}

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

function normalizeMarket(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (MARKET_LOOKUP[raw]) return MARKET_LOOKUP[raw]
  if (raw === 'Milwaukee WI') return 'Milwaukee, WI'
  if (raw === 'Memphis TN') return 'Memphis, TN'
  const match = raw.match(/^(.+?)\s+([A-Z]{2})$/)
  if (match) return `${match[1].trim()}, ${match[2].trim()}`
  return raw
}

function normalizeCompanyType(value) {
  return String(value || '').trim()
}

function compactSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstNameOrFallback(contactPerson, companyName) {
  const raw = String(contactPerson || '').trim()
  if (!raw || /contact via|team|office|department/i.test(raw)) return `${companyName} team`
  return raw.split(/\s+/)[0]
}

function classifyPartner(row) {
  const haystack = [
    row.Company_Type,
    row.Buy_Box,
    row.Recent_Projects,
    row.Markets_Active,
    row.Company_Name,
  ]
    .join(' ')
    .toLowerCase()

  if (/affordable|multifamily|mixed-use|apartment/.test(haystack)) {
    return {
      lane: 'multifamily_developer',
      label: 'Multifamily / mixed-use developer',
      subjectNoun: 'development criteria',
      projectFocus: 'multifamily, mixed-use, and larger redevelopment opportunities',
    }
  }

  if (/lot|land|infill|spec home|ground up|teardown/.test(haystack)) {
    return {
      lane: 'infill_builder',
      label: 'Infill / lot / ground-up builder',
      subjectNoun: 'builder buy box',
      projectFocus: 'teardown, infill lot, ground-up, and redevelopment opportunities',
    }
  }

  if (/construction|contractor|rehab|renovation/.test(haystack)) {
    return {
      lane: 'construction_partner',
      label: 'Construction / rehab partner',
      subjectNoun: 'construction buy box',
      projectFocus: 'heavy rehab, value-add, and construction-backed acquisition opportunities',
    }
  }

  return {
    lane: 'developer_partner',
    label: 'Developer partner',
    subjectNoun: 'development buy box',
    projectFocus: 'off-market redevelopment, entitlement, and value-add opportunities',
  }
}

function derivePriority(row, market, emailIssue, segment) {
  let score = 50
  if (PHASE_ONE_MARKETS.has(market)) score += 18
  if (/yes/i.test(String(row.Off_Market_Friendly || ''))) score += 12
  if (!emailIssue) score += 12
  if (/national|atlanta|cleveland|columbus|memphis|milwaukee|toledo/i.test(`${row.Markets_Active || ''} ${market}`)) score += 8
  if (/10m|25m|50m|100m|\+/.test(String(row.Deal_Size || '').toLowerCase())) score += 6
  if (segment.lane === 'multifamily_developer' || segment.lane === 'infill_builder') score += 6

  if (score >= 85) return 'high'
  if (score >= 68) return 'medium'
  return 'normal'
}

function recommendedChannel(row, emailIssue) {
  if (!emailIssue) return 'email'
  if (String(row.Source_URL || '').trim()) return 'contact_form_or_manual_email'
  if (String(row.Phone || '').trim()) return 'phone_or_manual_research'
  return 'manual_research'
}

function buildQuestions(segment, market) {
  const marketSuffix = market ? ` in ${market}` : ''
  const base = [
    `Which neighborhoods${marketSuffix} are active for you right now?`,
    'Do you prefer teardown, infill, heavy rehab, adaptive reuse, or ground-up opportunities?',
    'What is your target acquisition size and your usual all-in basis or project budget range?',
  ]

  if (segment.lane === 'multifamily_developer') {
    base.push('What unit count, density, zoning, or mixed-use profile is most attractive right now?')
  } else {
    base.push('What lot size, frontage, square-foot minimums, zoning, or entitlement conditions matter most?')
  }

  base.push('What close speed, inspection window, title conditions, and hard no-go items should we know up front?')
  return base
}

function buildSubject(row, market, segment) {
  if (market) return `${segment.subjectNoun.replace(/^./, (char) => char.toUpperCase())} for ${market}`
  return `${segment.subjectNoun.replace(/^./, (char) => char.toUpperCase())} with VestBlock`
}

function buildBody(row, market, segment) {
  const companyName = compactSentence(row.Company_Name) || 'your team'
  const contactLabel = firstNameOrFallback(row.Contact_Person, companyName)
  const buyBox = compactSentence(row.Buy_Box)
  const recentProjects = compactSentence(row.Recent_Projects)
  const marketsActive = compactSentence(row.Markets_Active) || market
  const questions = buildQuestions(segment, market)
  const proofLine = recentProjects
    ? `I noticed ${companyName} is active around ${recentProjects}.`
    : marketsActive
      ? `I noticed ${companyName} is active across ${marketsActive}.`
      : `I came across ${companyName} while mapping active developer and builder partners.`
  const buyBoxLine = buyBox
    ? `Your public profile looks aligned with ${buyBox.toLowerCase()}.`
    : `We are trying to understand your real acquisition and project criteria before we route anything over.`

  return [
    `Hi ${contactLabel},`,
    '',
    `I’m reaching out from VestBlock. We are building a developer and builder partner lane so seller opportunities with teardown, infill, redevelopment, creative, and heavy-rehab potential get routed to groups with real criteria instead of generic blasts.`,
    '',
    proofLine,
    buyBoxLine,
    '',
    `Rather than send random properties, we want your actual buy box first. The most useful things for us to understand are:`,
    ...questions.map((question) => `- ${question}`),
    '',
    `We also have capital relationships for bridge, fix-and-flip, DSCR, and ground-up files when a project needs the right funding path, so the conversation can stay practical once a fit shows up.`,
    '',
    `If your team already has a buy box, acquisition criteria sheet, land criteria sheet, or intake form, send it over and we will align to it.`,
    '',
    `Best,`,
    SIGNATURE,
    '',
    '—',
    FOOTER,
  ].join('\n')
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? '')).join(',')),
  ].join('\n')
}

function priorityScore(priority) {
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  return 1
}

function dedupeByEmail(rows) {
  const byEmail = new Map()

  for (const row of rows) {
    const key = String(row.email || '').toLowerCase()
    if (!key) continue

    const existing = byEmail.get(key)
    if (!existing) {
      byEmail.set(key, {
        ...row,
        duplicate_email_rows: 1,
        related_markets: row.market ? [row.market] : [],
        related_companies: row.company_name ? [row.company_name] : [],
      })
      continue
    }

    existing.duplicate_email_rows += 1
    if (row.market && !existing.related_markets.includes(row.market)) existing.related_markets.push(row.market)
    if (row.company_name && !existing.related_companies.includes(row.company_name)) existing.related_companies.push(row.company_name)

    const replace =
      priorityScore(row.priority) > priorityScore(existing.priority) ||
      (priorityScore(row.priority) === priorityScore(existing.priority) &&
        String(row.recent_projects || '').length > String(existing.recent_projects || '').length)

    if (replace) {
      byEmail.set(key, {
        ...row,
        duplicate_email_rows: existing.duplicate_email_rows,
        related_markets: existing.related_markets,
        related_companies: existing.related_companies,
      })
    }
  }

  return [...byEmail.values()].map((row) => ({
    ...row,
    related_markets: row.related_markets.join(' | '),
    related_companies: row.related_companies.join(' | '),
  }))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadAlreadySent(outDir) {
  const sent = new Set()
  if (!fs.existsSync(outDir)) return sent
  for (const file of fs.readdirSync(outDir)) {
    if (!file.startsWith('developer-outreach-results-') || !file.endsWith('.json')) continue
    try {
      const payload = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'))
      for (const row of payload) {
        if (row?.ok && row?.email) sent.add(String(row.email).toLowerCase())
      }
    } catch {
      // Ignore malformed history files.
    }
  }
  return sent
}

async function sendWithResend(resend, draft) {
  const payload = {
    from: process.env.FROM_EMAIL || 'acquisitions@vestblock.io',
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
  if (!CSV_PATH) {
    throw new Error('Pass --csv=/absolute/path/to/vestblock_developers_master.csv')
  }
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const parsed = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
  if (!parsed.length) throw new Error('CSV is empty.')

  const headers = parsed[0].map((header) => header.trim())
  const rows = parsed.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])))

  const selectedRows = rows.filter((row) => {
    if (!MARKET_FILTER) return true
    const market = normalizeMarket(row.Market)
    return market.toLowerCase().includes(MARKET_FILTER.toLowerCase())
  })

  const queue = []
  for (const row of selectedRows) {
    const companyName = compactSentence(row.Company_Name)
    if (!companyName) continue

    const market = normalizeMarket(row.Market)
    const segment = classifyPartner(row)
    const email = normalizeEmailAddress(row.Email)
    const emailIssue = email ? getEmailQualityIssue(email) : 'missing'
    const strictSendReady = email ? !emailIssue : false
    const genericEmail = emailIssue === 'blocked_local_part'
    const manualEmailOkay = Boolean(email && genericEmail)
    const recommended = recommendedChannel(row, emailIssue)
    const body = buildBody(row, market, segment)
    const subject = buildSubject(row, market, segment)
    const priority = derivePriority(row, market, strictSendReady ? null : emailIssue, segment)

    queue.push({
      market,
      company_name: companyName,
      company_type: normalizeCompanyType(row.Company_Type),
      segment: segment.label,
      lane: segment.lane,
      contact_person: compactSentence(row.Contact_Person),
      phone: compactSentence(row.Phone),
      email,
      email_issue: emailIssue || '',
      send_ready: strictSendReady ? 'yes' : 'no',
      generic_email_review: manualEmailOkay ? 'yes' : 'no',
      recommended_channel: recommended,
      priority,
      off_market_friendly: compactSentence(row.Off_Market_Friendly),
      buy_box: compactSentence(row.Buy_Box),
      deal_size: compactSentence(row.Deal_Size),
      recent_projects: compactSentence(row.Recent_Projects),
      markets_active: compactSentence(row.Markets_Active),
      source_url: compactSentence(row.Source_URL),
      subject,
      body,
    })
  }

  queue.sort((left, right) => {
    const priorityRank = { high: 0, medium: 1, normal: 2 }
    return (
      priorityRank[left.priority] - priorityRank[right.priority] ||
      String(left.market).localeCompare(String(right.market)) ||
      String(left.company_name).localeCompare(String(right.company_name))
    )
  })

  const limitedQueue = LIMIT ? queue.slice(0, LIMIT) : queue
  const sendReady = dedupeByEmail(limitedQueue.filter((row) => row.send_ready === 'yes'))
  const genericReview = dedupeByEmail(limitedQueue.filter((row) => row.generic_email_review === 'yes'))
  const reviewOnly = limitedQueue.filter((row) => row.send_ready !== 'yes')
  const phaseOneSendReady = sendReady.filter((row) => PHASE_ONE_MARKETS.has(row.market))
  const phaseOneGenericReview = genericReview.filter((row) => PHASE_ONE_MARKETS.has(row.market))

  const dateStamp = new Date().toISOString().slice(0, 10)
  const outDir = path.join(process.cwd(), 'artifacts', 'developer-outreach', dateStamp)
  fs.mkdirSync(outDir, { recursive: true })

  const queueColumns = [
    'market',
    'company_name',
    'company_type',
    'segment',
    'lane',
    'contact_person',
    'phone',
    'email',
    'email_issue',
    'send_ready',
    'generic_email_review',
    'recommended_channel',
    'priority',
    'off_market_friendly',
    'buy_box',
    'deal_size',
    'recent_projects',
    'markets_active',
    'source_url',
    'subject',
    'body',
    'duplicate_email_rows',
    'related_markets',
    'related_companies',
  ]

  fs.writeFileSync(path.join(outDir, 'developer-outreach-queue.csv'), `${toCsv(limitedQueue, queueColumns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'developer-outreach-send-ready.csv'), `${toCsv(sendReady, queueColumns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'developer-outreach-generic-email-review.csv'), `${toCsv(genericReview, queueColumns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'developer-outreach-phase-one-send-ready.csv'), `${toCsv(phaseOneSendReady, queueColumns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'developer-outreach-phase-one-generic-review.csv'), `${toCsv(phaseOneGenericReview, queueColumns)}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'developer-outreach-review.txt'), limitedQueue.map((row, index) => {
    return [
      `#${index + 1} ${row.company_name} [${row.market || 'Unknown market'}]`,
      `TYPE: ${row.company_type || 'Unknown'} | SEGMENT: ${row.segment} | PRIORITY: ${row.priority}`,
      `CONTACT: ${row.contact_person || 'Unknown'} | EMAIL: ${row.email || 'none'} | CHANNEL: ${row.recommended_channel}`,
      `SUBJECT: ${row.subject}`,
      '',
      row.body,
      '',
      '='.repeat(100),
      '',
    ].join('\n')
  }).join('\n'), 'utf8')

  const summary = {
    sourceCsv: CSV_PATH,
    marketFilter: MARKET_FILTER || null,
    totalRows: rows.length,
    selectedRows: selectedRows.length,
    draftedRows: limitedQueue.length,
    sendReadyCount: sendReady.length,
    phaseOneSendReadyCount: phaseOneSendReady.length,
    genericEmailReviewCount: genericReview.length,
    phaseOneGenericReviewCount: phaseOneGenericReview.length,
    manualReviewCount: reviewOnly.length,
    byMarket: Object.entries(limitedQueue.reduce((accumulator, row) => {
      accumulator[row.market || 'Unknown'] = (accumulator[row.market || 'Unknown'] || 0) + 1
      return accumulator
    }, {})).map(([market, count]) => ({ market, count })),
    bySegment: Object.entries(limitedQueue.reduce((accumulator, row) => {
      accumulator[row.segment] = (accumulator[row.segment] || 0) + 1
      return accumulator
    }, {})).map(([segment, count]) => ({ segment, count })),
  }
  fs.writeFileSync(path.join(outDir, 'developer-outreach-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log('VestBlock Developer Outreach')
  console.log('============================')
  console.log(`CSV:                 ${CSV_PATH}`)
  console.log(`Mode:                ${SEND ? 'LIVE SEND (Resend)' : 'DRY RUN (no emails sent)'}`)
  console.log(`Selected rows:       ${selectedRows.length}`)
  console.log(`Drafted rows:        ${limitedQueue.length}`)
  console.log(`Strict send-ready:   ${sendReady.length}`)
  console.log(`Generic email review:${genericReview.length}`)
  console.log(`Manual review:       ${reviewOnly.length}`)
  console.log(`Artifacts:           ${outDir}`)

  if (!SEND) {
    console.log('\nDry run complete. Review the queue and send-ready files before mailing.')
    return
  }

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('Missing RESEND_API_KEY or FROM_EMAIL for live send.')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const alreadySent = loadAlreadySent(outDir)
  const sendPool = ALLOW_GENERIC ? dedupeByEmail([...sendReady, ...genericReview]) : sendReady
  const toSend = sendPool.filter((row) => !alreadySent.has(row.email))

  const results = []
  for (let index = 0; index < toSend.length; index += 1) {
    const row = toSend[index]
    const result = await sendWithResend(resend, row)
    results.push({
      email: row.email,
      company_name: row.company_name,
      market: row.market,
      ok: result.ok,
      id: result.id || null,
      error: result.error || null,
    })
    console.log(`${result.ok ? '✓' : '✗'} ${index + 1}/${toSend.length} ${row.company_name} <${row.email}> ${result.ok ? result.id : result.error}`)
    if (index < toSend.length - 1) await sleep(THROTTLE_MS)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(path.join(outDir, `developer-outreach-results-${stamp}.json`), `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  const sentCount = results.filter((row) => row.ok).length
  console.log(`\nLive send complete. Sent: ${sentCount} | Failed: ${results.length - sentCount}`)
}

main().catch((error) => {
  console.error(formatScriptError(error))
  process.exit(1)
})
