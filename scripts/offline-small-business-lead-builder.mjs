import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'

import { getEmailDeliverabilityIssue, normalizeEmailAddress } from './shared-email-quality.mjs'

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const HUNTER_API_BASE = 'https://api.hunter.io/v2'
const USER_AGENT = 'VestBlockSmallBusinessLeadBuilder/1.0 (+https://www.vestblock.io)'
const ROLE_LOCAL_PARTS = new Set([
  'info',
  'hello',
  'contact',
  'support',
  'admin',
  'office',
  'sales',
  'management',
  'manager',
  'media',
  'press',
  'pr',
  'reservations',
  'reservation',
  'events',
  'catering',
  'guestservice',
  'online',
  'orders',
  'team',
  'customerservice',
  'service',
  'accounts',
  'accounting',
  'billing',
  'careers',
  'employment',
  'hiring',
  'hr',
  'jobs',
  'dispatch',
  'operations',
  'it',
  'safety',
  'csr',
  'customersuccess',
  'loyalty',
  'marketing',
  'nfo',
])
const BAD_EMAIL_PATTERNS = [
  /example\./i,
  /domain\.com/i,
  /sentry/i,
  /wixpress/i,
  /\.(png|jpe?g|svg|webp|gif)$/i,
  /^(noreply|no-reply|donotreply|do-not-reply|postmaster|mailer-daemon)@/i,
]

const DEFAULT_MARKETS = [
  'Milwaukee, WI',
  'Chicago, IL',
  'Indianapolis, IN',
  'Columbus, OH',
  'Cleveland, OH',
  'Cincinnati, OH',
  'Nashville, TN',
  'Atlanta, GA',
  'Charlotte, NC',
  'Dallas, TX',
  'Houston, TX',
  'Phoenix, AZ',
]

const QUERY_SETS = {
  ai_receptionist: [
    'roofing contractor',
    'HVAC contractor',
    'plumbing contractor',
    'water damage restoration',
    'med spa',
    'dental clinic',
    'auto repair shop',
    'home remodeling contractor',
    'pest control company',
    'landscaping company',
  ],
  funding_prep: [
    'trucking company',
    'construction company',
    'restaurant',
    'child care center',
    'beauty salon',
    'auto repair shop',
    'commercial cleaning company',
    'landscaping company',
    'medical practice',
    'minority owned business',
  ],
  spanish_funding: [
    'Mexican restaurant',
    'Taqueria',
    'Panaderia',
    'Carniceria',
    'Latino grocery store',
    'Mercado latino',
    'Spanish speaking tax preparer',
    'Latino construction company',
    'Latino restaurant',
    'Hispanic trucking company',
    'Latino beauty salon',
    'Spanish speaking insurance agency',
    'Spanish speaking cleaning company',
  ],
}

function argValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function hasArg(name) {
  const prefix = `${name}=`
  return process.argv.some((arg) => arg === name || arg.startsWith(prefix))
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(argValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function listArg(name, fallback = []) {
  const value = argValue(name, '')
  if (!value) return fallback
  return value.split('|').flatMap((part) => part.split(',')).map((item) => item.trim()).filter(Boolean)
}

function marketListArg(name, fallback = []) {
  const value = argValue(name, '')
  if (!value) return fallback
  return value.split('|').map((item) => item.trim()).filter(Boolean)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeMarketKey(market) {
  return String(market || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hashString(value) {
  let hash = 2166136261
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function readMarketHistory(historyPath) {
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'))
  } catch {
    return { version: 1, runs: [] }
  }
}

function daysBetween(leftIso, rightIso) {
  const left = new Date(leftIso)
  const right = new Date(rightIso)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return 999
  return Math.floor(Math.abs(right.getTime() - left.getTime()) / 86400000)
}

function selectMarkets({ requestedMarkets, date, verticals, marketCount, explicitMarkets, historyPath }) {
  const markets = Array.from(new Set(requestedMarkets.map((market) => market.trim()).filter(Boolean)))
  if (!markets.length) return []
  const history = readMarketHistory(historyPath)
  const cooldownDays = explicitMarkets ? 3 : 10
  const recentKeys = new Set(
    (history.runs || [])
      .filter((run) => verticals.includes(run.vertical) && daysBetween(run.date, date) < cooldownDays)
      .map((run) => run.marketKey)
  )
  const freshMarkets = markets.filter((market) => !recentKeys.has(normalizeMarketKey(market)))
  const pool = freshMarkets.length >= marketCount ? freshMarkets : markets
  const seed = hashString(`${date}:${verticals.join(',')}:${markets.join('|')}`)
  const rotated = [...pool]
  for (let index = rotated.length - 1; index > 0; index -= 1) {
    const swapIndex = (seed + index * 31) % (index + 1)
    ;[rotated[index], rotated[swapIndex]] = [rotated[swapIndex], rotated[index]]
  }
  return rotated.slice(0, Math.min(marketCount, rotated.length))
}

function selectPlacesForAudit(items, markets, limit, queryOrder = []) {
  if (!Array.isArray(items) || !items.length) return []
  if (!Number.isFinite(limit) || limit <= 0) return []
  if (items.length <= limit) return items

  const buckets = new Map()
  for (const item of items) {
    const market = item.market || ''
    const query = item.query || ''
    const key = `${market}||${query}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }

  const orderedMarkets = Array.isArray(markets) && markets.length ? markets : Array.from(new Set(items.map((item) => item.market || '')))
  const orderedQueries = Array.isArray(queryOrder) && queryOrder.length ? queryOrder : Array.from(new Set(items.map((item) => item.query || '')))
  const result = []

  while (result.length < limit) {
    let progressed = false
    for (const market of orderedMarkets) {
      for (const query of orderedQueries) {
        const bucket = buckets.get(`${market}||${query}`)
        if (!bucket?.length) continue
        result.push(bucket.shift())
        progressed = true
        if (result.length >= limit) break
      }
      if (result.length >= limit) break
    }
    if (!progressed) break
  }

  if (result.length < limit) {
    for (const bucket of buckets.values()) {
      while (bucket.length && result.length < limit) result.push(bucket.shift())
      if (result.length >= limit) break
    }
  }

  return result
}

function persistMarketHistory({ historyPath, date, markets, verticals }) {
  const history = readMarketHistory(historyPath)
  const existing = new Set((history.runs || []).map((run) => `${run.date}:${run.vertical}:${run.marketKey}`))
  const runs = [...(history.runs || [])]
  for (const vertical of verticals) {
    for (const market of markets) {
      const marketKey = normalizeMarketKey(market)
      const key = `${date}:${vertical}:${marketKey}`
      if (existing.has(key)) continue
      existing.add(key)
      runs.push({ date, vertical, market, marketKey })
    }
  }
  fs.mkdirSync(path.dirname(historyPath), { recursive: true })
  fs.writeFileSync(historyPath, `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), runs }, null, 2)}\n`)
}

function safeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).href
  } catch {
    return ''
  }
}

function hostFor(value) {
  try {
    return new URL(safeUrl(value)).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractEmails(text) {
  const raw = String(text || '')
  const deobfuscated = raw
    .replace(/\s*(?:\[at\]|\(at\)|\sat\s)\s*/gi, '@')
    .replace(/\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*/gi, '.')
  const matches = deobfuscated.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []
  return Array.from(new Set(matches.map(normalizeEmailAddress))).filter((email) => !BAD_EMAIL_PATTERNS.some((pattern) => pattern.test(email)))
}

function hrefsFromHtml(html, baseUrl) {
  const links = []
  const re = /href=["']([^"']+)["']/gi
  for (const match of String(html || '').matchAll(re)) {
    try {
      links.push(new URL(match[1], baseUrl).href)
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return Array.from(new Set(links))
}

function contactUrlsFromHtml(html, baseUrl) {
  return hrefsFromHtml(html, baseUrl)
    .filter((url) => /contact|quote|estimate|schedule|book|appointment|request|consultation|get-started|intake/i.test(url))
    .slice(0, 6)
}

function hasContactForm(html) {
  const lower = String(html || '').toLowerCase()
  return /<form\b/.test(lower) && /(name|email|phone|message|quote|appointment|contact)/i.test(lower)
}

function detectSignals(html, url) {
  const text = stripHtml(html).toLowerCase()
  return {
    hasChat: /intercom|drift|tawk|zendesk|livechat|chat widget|botpress|olark|crisp/i.test(html),
    hasOnlineBooking: /book online|schedule online|appointment|calendly|acuity|squareup|booking|request appointment/i.test(text),
    hasClearCta: /call|contact|quote|estimate|schedule|book|request|consultation/i.test(text),
    hasTrustProof: /review|testimonial|licensed|insured|gallery|case study|before and after|years in business/i.test(text),
    hasContactForm: hasContactForm(html),
    weakSignals: [
      !/intercom|drift|tawk|zendesk|livechat|chat widget|botpress|olark|crisp/i.test(html) ? 'missing_chat_or_ai_receptionist' : null,
      !/book online|schedule online|appointment|calendly|acuity|squareup|booking|request appointment/i.test(text) ? 'missing_online_booking' : null,
      !/call|contact|quote|estimate|schedule|book|request|consultation/i.test(text) ? 'unclear_cta' : null,
      !/review|testimonial|licensed|insured|gallery|case study|before and after|years in business/i.test(text) ? 'weak_trust_proof' : null,
      !hasContactForm(html) ? 'no_contact_form_seen' : null,
      url.includes('facebook.com') || url.includes('instagram.com') ? 'social_profile_instead_of_site' : null,
    ].filter(Boolean),
  }
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    return { ok: response.ok, status: response.status, finalUrl: response.url, html: '' }
  }
  return { ok: response.ok, status: response.status, finalUrl: response.url, html: await response.text() }
}

async function auditWebsite(website, { timeoutMs = 10000, contactPageLimit = 3 } = {}) {
  const url = safeUrl(website)
  if (!url) {
    return {
      websiteOk: false,
      websiteStatus: 'missing_website',
      emails: [],
      readyEmails: [],
      roleEmails: [],
      contactUrls: [],
      pagesChecked: [],
      weakSignals: ['missing_website'],
      hasContactForm: false,
    }
  }

  const pagesChecked = []
  const emails = new Set()
  const contactUrls = new Set()
  let combinedSignals = []
  let hasAnyContactForm = false
  let websiteOk = false
  let websiteStatus = 'unknown'

  try {
    const home = await fetchText(url, timeoutMs)
    pagesChecked.push(home.finalUrl || url)
    websiteOk = home.ok
    websiteStatus = home.ok ? 'ok' : `http_${home.status}`
    for (const email of extractEmails(home.html)) emails.add(email)
    for (const contactUrl of contactUrlsFromHtml(home.html, home.finalUrl || url)) contactUrls.add(contactUrl)
    const signals = detectSignals(home.html, home.finalUrl || url)
    combinedSignals = combinedSignals.concat(signals.weakSignals)
    hasAnyContactForm = hasAnyContactForm || signals.hasContactForm

    for (const contactUrl of Array.from(contactUrls).slice(0, contactPageLimit)) {
      try {
        await sleep(150)
        const page = await fetchText(contactUrl, timeoutMs)
        pagesChecked.push(page.finalUrl || contactUrl)
        for (const email of extractEmails(page.html)) emails.add(email)
        const contactSignals = detectSignals(page.html, page.finalUrl || contactUrl)
        combinedSignals = combinedSignals.concat(contactSignals.weakSignals)
        hasAnyContactForm = hasAnyContactForm || contactSignals.hasContactForm
      } catch {
        pagesChecked.push(`${contactUrl}#fetch_failed`)
      }
    }
  } catch (error) {
    websiteStatus = error instanceof Error ? `fetch_failed:${error.message.slice(0, 80)}` : 'fetch_failed'
    combinedSignals.push('website_unreachable')
  }

  const uniqueEmails = Array.from(emails)
  const classified = await classifyEmails(uniqueEmails, hostFor(url))
  return {
    websiteOk,
    websiteStatus,
    emails: uniqueEmails,
    readyEmails: classified.readyEmails,
    roleEmails: classified.roleEmails,
    rejectedEmails: classified.rejectedEmails,
    contactUrls: Array.from(contactUrls),
    pagesChecked: Array.from(new Set(pagesChecked)),
    weakSignals: Array.from(new Set(combinedSignals)),
    hasContactForm: hasAnyContactForm,
  }
}

async function hasMx(domain) {
  try {
    const records = await dns.resolveMx(domain)
    return records.length > 0
  } catch {
    return false
  }
}

function isSameBusinessDomain(emailDomain, expectedDomain) {
  if (!emailDomain || !expectedDomain) return true
  return emailDomain === expectedDomain || emailDomain.endsWith(`.${expectedDomain}`)
}

function isRoleLocalPart(localPart) {
  const value = String(localPart || '').trim().toLowerCase()
  if (!value) return false
  if (ROLE_LOCAL_PARTS.has(value)) return true

  const parts = value.split(/[._+-]+/).filter(Boolean)
  for (const part of parts) {
    if (ROLE_LOCAL_PARTS.has(part)) return true
  }

  const prefixTokens = [
    'info',
    'contact',
    'support',
    'sales',
    'billing',
    'accounts',
    'accounting',
    'careers',
    'employment',
    'hiring',
    'dispatch',
    'operations',
    'customerservice',
    'guestservice',
    'frontdesk',
    'helpdesk',
    'safety',
    'csr',
  ]
  if (prefixTokens.some((token) => value.startsWith(token))) return true

  const substringTokens = ['dispatch', 'operations', 'customerservice', 'customer-service', 'guestservice', 'frontdesk', 'helpdesk']
  return substringTokens.some((token) => value.includes(token))
}

async function classifyEmails(emails, expectedDomain = '') {
  const readyEmails = []
  const roleEmails = []
  const rejectedEmails = []

  for (const email of Array.from(new Set(emails.map(normalizeEmailAddress)))) {
    const localPart = email.split('@')[0] || ''
    const domain = email.split('@')[1] || ''
    if (!domain || BAD_EMAIL_PATTERNS.some((pattern) => pattern.test(email))) {
      rejectedEmails.push({ email, issue: 'blocked_pattern' })
      continue
    }
    if (!isSameBusinessDomain(domain, expectedDomain)) {
      roleEmails.push({ email, issue: `off_domain_review:${domain}` })
      continue
    }
    if (isRoleLocalPart(localPart)) {
      roleEmails.push({ email, issue: (await hasMx(domain)) ? 'role_email_review' : 'role_email_no_mx' })
      continue
    }
    const issue = await getEmailDeliverabilityIssue(email)
    if (issue) rejectedEmails.push({ email, issue })
    else readyEmails.push(email)
  }

  return { readyEmails, roleEmails, rejectedEmails }
}

async function hunterDomainSearch(domain, timeoutMs) {
  const apiKey = String(process.env.HUNTER_API_KEY || '').trim()
  if (!apiKey || !domain) return { status: 'skipped', reason: 'missing_hunter_or_domain', candidates: [] }
  const params = new URLSearchParams({ api_key: apiKey, domain, limit: '10' })
  try {
    const response = await fetch(`${HUNTER_API_BASE}/domain-search?${params.toString()}`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { status: 'error', reason: `hunter_http_${response.status}`, candidates: [] }
    const candidates = (payload?.data?.emails || [])
      .map((item) => ({
        email: normalizeEmailAddress(item.value),
        fullName: [item.first_name, item.last_name].filter(Boolean).join(' '),
        position: item.position || '',
        department: item.department || '',
        confidence: Number(item.confidence || 0),
        verificationStatus: item.verification?.status || '',
        sourceUrls: Array.isArray(item.sources) ? item.sources.map((source) => source.uri).filter(Boolean).slice(0, 3) : [],
      }))
      .filter((candidate) => candidate.email && !BAD_EMAIL_PATTERNS.some((pattern) => pattern.test(candidate.email)))
      .sort((left, right) => candidateScore(right) - candidateScore(left))
    return { status: candidates.length ? 'found' : 'not_found', reason: candidates.length ? 'hunter_found' : 'hunter_no_email', candidates }
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message.slice(0, 120) : 'hunter_failed', candidates: [] }
  }
}

function candidateScore(candidate) {
  let score = Math.min(30, Math.max(0, Math.round(candidate.confidence / 3)))
  if (candidate.verificationStatus === 'valid') score += 20
  if (candidate.verificationStatus === 'accept_all') score += 5
  if (/(owner|founder|ceo|president|manager|director|operations|sales|business development)/i.test(`${candidate.position} ${candidate.department}`)) score += 15
  if (ROLE_LOCAL_PARTS.has((candidate.email.split('@')[0] || '').toLowerCase())) score -= 20
  return score
}

async function searchGooglePlaces(query, market, limit, timeoutMs) {
  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim()
  if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY')
  const response = await fetch(GOOGLE_PLACES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.types',
    },
    body: JSON.stringify({
      textQuery: `${query} in ${market}`,
      pageSize: limit,
      languageCode: 'en',
      regionCode: 'US',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Google Places ${response.status}: ${JSON.stringify(payload).slice(0, 180)}`)
  return payload?.places || []
}

function fitForVertical(vertical, audit, place) {
  let score = 45
  if (place.websiteUri) score += 8
  if (place.nationalPhoneNumber) score += 6
  if ((place.userRatingCount || 0) >= 10) score += 8
  if (audit.readyEmails.length) score += 20
  if (audit.roleEmails.length) score += 8
  if (audit.hasContactForm) score += 5

  if (vertical === 'ai_receptionist') {
    if (audit.weakSignals.includes('missing_chat_or_ai_receptionist')) score += 15
    if (audit.weakSignals.includes('missing_online_booking')) score += 10
    if (audit.weakSignals.includes('unclear_cta')) score += 8
  }

  if (vertical === 'funding_prep') {
    if (/(trucking|construction|restaurant|child|salon|auto|cleaning|landscaping|medical|clinic|contractor)/i.test(place.displayName?.text || '')) score += 8
    if ((place.userRatingCount || 0) >= 25) score += 6
  }

  if (vertical === 'spanish_funding') {
    const text = `${place.displayName?.text || ''} ${place.formattedAddress || ''} ${audit.pagesChecked.join(' ')} ${audit.weakSignals.join(' ')}`
    if (/(latino|latina|hispanic|mexican|spanish|espanol|español|taqueria|panaderia|mercado|tienda|carniceria)/i.test(text)) score += 14
    if ((place.userRatingCount || 0) >= 15) score += 6
    if (audit.readyEmails.length || audit.roleEmails.length) score += 4
    if (isPartnerOrgForSpanishFunding(place)) score -= 30
  }

  return Math.min(100, score)
}

function outreachAngle(vertical, place, audit) {
  if (vertical === 'ai_receptionist') {
    const problems = audit.weakSignals.filter((signal) =>
      ['missing_chat_or_ai_receptionist', 'missing_online_booking', 'unclear_cta', 'no_contact_form_seen'].includes(signal)
    )
    return problems.length
      ? `AI receptionist fit: ${problems.slice(0, 3).join(', ')}`
      : 'AI receptionist fit: service business with active customer inquiry path.'
  }

  if (vertical === 'spanish_funding') {
    return 'Spanish funding fit: likely Latino/Hispanic-owned or Spanish-speaking small business for bilingual funding-prep outreach, document readiness, and grant/funding profile support.'
  }

  return 'Funding prep fit: small business where documents, business profile, credit/funding readiness, or grant-readiness review may be useful.'
}

function isPartnerOrgForSpanishFunding(place) {
  return /(chamber|c[áa]mara|c[áa]mara de comercio|union|organization|organisation|organizacion|organizaci[óo]n|arts|foundation|fundacion|fundaci[óo]n|association|asociacion|asociaci[óo]n|council|consejo|nonprofit|non-profit|network|community center|centro comunitario|sin fines de lucro)/i.test(
    place.displayName?.text || ''
  )
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeCsv(filePath, rows, columns) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${toCsv(rows, columns)}\n`)
}

async function buildLeadFromPlace({ place, market, query, vertical, websiteTimeoutMs, hunterTimeoutMs, enrich }) {
  const website = safeUrl(place.websiteUri)
  const audit = await auditWebsite(website, { timeoutMs: websiteTimeoutMs })
  let hunter = { status: 'skipped', reason: 'not_needed', candidates: [] }
  if (enrich && !audit.readyEmails.length && website) {
    hunter = await hunterDomainSearch(hostFor(website), hunterTimeoutMs)
    const hunterEmails = hunter.candidates.map((candidate) => candidate.email)
    const classified = await classifyEmails([...audit.emails, ...hunterEmails], hostFor(website))
    audit.readyEmails = classified.readyEmails
    audit.roleEmails = classified.roleEmails
    audit.rejectedEmails = [...(audit.rejectedEmails || []), ...classified.rejectedEmails]
  }

  const bestEmail = audit.readyEmails[0] || ''
  const partnerOrgReview = vertical === 'spanish_funding' && isPartnerOrgForSpanishFunding(place)
  const status = bestEmail && !partnerOrgReview
    ? 'direct_email_ready'
    : audit.roleEmails.length
      ? 'role_email_review'
      : partnerOrgReview && bestEmail
        ? 'role_email_review'
        : audit.contactUrls.length || audit.hasContactForm
          ? 'contact_form_only'
          : 'needs_manual_research'

  return {
    id: `sb_${vertical}_${place.id}`,
    scraped_at: new Date().toISOString(),
    vertical,
    market,
    query,
    business_name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    phone: normalizePhone(place.nationalPhoneNumber),
    website,
    website_host: hostFor(website),
    email: bestEmail,
    role_emails: audit.roleEmails.map((row) => `${row.email}:${row.issue}`),
    rejected_emails: (audit.rejectedEmails || []).map((row) => `${row.email}:${row.issue}`),
    contact_urls: audit.contactUrls,
    pages_checked: audit.pagesChecked,
    status,
    fit_score: fitForVertical(vertical, audit, place),
    outreach_angle: outreachAngle(vertical, place, audit),
    weak_signals: audit.weakSignals,
    review_flags: partnerOrgReview ? ['partner_org_not_small_business_owner'] : [],
    rating: place.rating || '',
    review_count: place.userRatingCount || 0,
    source_url: place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : '',
    hunter_status: hunter.status,
    hunter_reason: hunter.reason,
    hunter_candidates: hunter.candidates.slice(0, 5),
    website_status: audit.websiteStatus,
  }
}

async function main() {
  const date = argValue('--date', new Date().toISOString().slice(0, 10))
  const verticals = listArg('--verticals', ['ai_receptionist', 'funding_prep']).filter((vertical) => QUERY_SETS[vertical])
  const explicitMarkets = hasArg('--markets')
  const requestedMarkets = marketListArg('--markets', DEFAULT_MARKETS)
  const defaultMarketCount = explicitMarkets ? requestedMarkets.length : 4
  const marketCount = intArg('--market-count', defaultMarketCount, 12)
  const isLatinoFundingRun = verticals.length > 0 && verticals.every((vertical) => vertical === 'spanish_funding')
  const laneDirName = isLatinoFundingRun ? 'latino-funding' : 'small-business-leads'
  const historyPath = path.join(process.cwd(), 'artifacts', 'offline-automation', laneDirName, 'market-history.json')
  const markets = selectMarkets({ requestedMarkets, date, verticals, marketCount, explicitMarkets, historyPath })
  const queriesPerVertical = intArg('--queries-per-vertical', 4, 10)
  const perQuery = intArg('--per-query', 3, 10)
  const websiteLimit = intArg('--website-limit', 30, 120)
  const googleTimeoutMs = intArg('--google-timeout-ms', 18000, 60000)
  const websiteTimeoutMs = intArg('--website-timeout-ms', 9000, 25000)
  const hunterTimeoutMs = intArg('--hunter-timeout-ms', 10000, 25000)
  const enrich = !process.argv.includes('--no-enrich')
  const artifactDir = path.join(process.cwd(), 'artifacts', 'offline-automation', laneDirName, date)

  const places = []
  const attempts = []
  for (const vertical of verticals) {
    for (const market of markets) {
      for (const query of QUERY_SETS[vertical].slice(0, queriesPerVertical)) {
        try {
          const found = await searchGooglePlaces(query, market, perQuery, googleTimeoutMs)
          attempts.push({ vertical, market, query, ok: true, found: found.length })
          for (const place of found) places.push({ vertical, market, query, place })
        } catch (error) {
          attempts.push({ vertical, market, query, ok: false, error: error instanceof Error ? error.message : String(error) })
        }
        await sleep(150)
      }
    }
  }

  const seen = new Set()
  const uniquePlaces = []
  for (const item of places) {
    const key = item.place.id || `${item.place.displayName?.text}:${item.place.formattedAddress}`
    if (seen.has(key)) continue
    seen.add(key)
    uniquePlaces.push(item)
  }

  const queryOrder =
    verticals.length === 1 && QUERY_SETS[verticals[0]] ? QUERY_SETS[verticals[0]].slice(0, queriesPerVertical) : []
  const auditQueue = selectPlacesForAudit(uniquePlaces, markets, websiteLimit, queryOrder)

  const leads = []
  for (const item of auditQueue) {
    leads.push(await buildLeadFromPlace({ ...item, websiteTimeoutMs, hunterTimeoutMs, enrich }))
    await sleep(200)
  }

  leads.sort((left, right) =>
    (right.status === 'direct_email_ready') - (left.status === 'direct_email_ready') ||
    right.fit_score - left.fit_score ||
    Number(right.review_count || 0) - Number(left.review_count || 0)
  )

  const columns = [
    'status',
    'vertical',
    'fit_score',
    'business_name',
    'market',
    'query',
    'email',
    'role_emails',
    'phone',
    'website',
    'contact_urls',
    'outreach_angle',
    'weak_signals',
    'review_flags',
    'rating',
    'review_count',
    'source_url',
    'website_status',
    'hunter_status',
    'hunter_reason',
  ]
  const summary = {
    ok: true,
    date,
    generatedAt: new Date().toISOString(),
    markets,
    verticals,
    attempts,
    placesFound: places.length,
    uniquePlaces: uniquePlaces.length,
    leadsAudited: leads.length,
    directEmailReady: leads.filter((lead) => lead.status === 'direct_email_ready').length,
    roleEmailReview: leads.filter((lead) => lead.status === 'role_email_review').length,
    contactFormOnly: leads.filter((lead) => lead.status === 'contact_form_only').length,
    needsManualResearch: leads.filter((lead) => lead.status === 'needs_manual_research').length,
    byVertical: Object.fromEntries(verticals.map((vertical) => [vertical, leads.filter((lead) => lead.vertical === vertical).length])),
    artifactDir,
    marketRotation: {
      explicitMarkets,
      requestedMarkets,
      selectedMarkets: markets,
      marketCount,
      historyPath,
    },
  }

  writeJson(path.join(artifactDir, 'summary.json'), summary)
  writeJson(path.join(artifactDir, 'leads.json'), leads)
  writeCsv(path.join(artifactDir, 'leads.csv'), leads, columns)
  writeCsv(path.join(artifactDir, 'direct-email-ready.csv'), leads.filter((lead) => lead.status === 'direct_email_ready'), columns)
  writeCsv(path.join(artifactDir, 'role-email-review.csv'), leads.filter((lead) => lead.status === 'role_email_review'), columns)
  writeCsv(path.join(artifactDir, 'contact-form-only.csv'), leads.filter((lead) => lead.status === 'contact_form_only'), columns)
  writeCsv(path.join(artifactDir, 'manual-research.csv'), leads.filter((lead) => lead.status === 'needs_manual_research'), columns)
  persistMarketHistory({ historyPath, date, markets, verticals })

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
