import { enrichContactFromHunter } from '@/lib/email/hunter'
import { decodeHtmlEntities, safeUrl } from '@/lib/leads/utils'

type EmailCandidate = {
  email: string
  score: number
  sourceUrl: string
  reason: string
}

export type LeadEmailEnrichmentResult = {
  primaryEmail: string | null
  candidates: Array<{ email: string; score: number; sourceUrl: string; reason: string }>
  sourceUrls: string[]
  attemptedUrls: string[]
  contactPageUrls: string[]
  contactFormUrls: string[]
  hasContactForm: boolean
  confidence: 'high' | 'medium' | 'low' | 'none'
  status: 'found' | 'not_found' | 'skipped'
  provider: 'public_website' | 'hunter' | 'public_website_plus_hunter' | 'none'
  note: string
}

const FETCH_TIMEOUT_MS = 12000
const MAX_FOLLOWUP_PAGES = 4
const INTERNAL_LINK_KEYWORDS = [
  'contact',
  'about',
  'team',
  'staff',
  'support',
  'location',
  'locations',
  'office',
]

const NON_HTML_ASSET_RE = /\.(css|js|json|xml|txt|png|jpg|jpeg|gif|webp|svg|pdf|woff2?|ttf|eot)(\?.*)?$/i

const BLOCKED_EMAIL_PATTERNS = [
  /example\.(com|org|net)$/i,
  /@\d+x\d+\./i,
  /\.(png|jpg|jpeg|gif|webp|svg)$/i,
  /\.com\.com$/i,
  /\.org\.org$/i,
  /sentry\.io$/i,
  /wixpress\.com$/i,
  /squarespace\.com$/i,
  /godaddy\.com$/i,
  /webador\.com$/i,
  /cloudflare\.com$/i,
  /google\.com$/i,
  /gstatic\.com$/i,
]

const WEBMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com']

function normalizeEmail(value: string) {
  return value.trim().replace(/^mailto:/i, '').toLowerCase()
}

function looksBlocked(email: string) {
  return BLOCKED_EMAIL_PATTERNS.some((pattern) => pattern.test(email))
}

function decodeEmailishContent(input: string) {
  return decodeHtmlEntities(input)
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s+\bat\b\s+/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
    .replace(/\s+\bdot\b\s+/gi, '.')
}

function extractEmailsFromHtml(html: string) {
  const decoded = decodeEmailishContent(html)
  const matches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return Array.from(
    new Set(
      matches
        .map(normalizeEmail)
        .filter((email) => email.includes('@') && !looksBlocked(email))
    )
  )
}

function hasLikelyContactForm(html: string) {
  if (!/<form[\s>]/i.test(html)) return false

  const hasMessageField = /<textarea[\s>]|name=["'][^"']*(message|comments|inquiry|enquiry)[^"']*["']/i.test(html)
  const hasEmailField = /type=["']email["']|name=["'][^"']*email[^"']*["']/i.test(html)
  const hasNameField = /name=["'][^"']*name[^"']*["']/i.test(html)

  return hasMessageField || (hasEmailField && hasNameField)
}

function scoreEmail(email: string, sourceUrl: string, baseHost: string) {
  let score = 1
  const localPart = email.split('@')[0] || ''
  const emailDomain = email.split('@')[1] || ''
  const lowerUrl = sourceUrl.toLowerCase()
  const baseRoot = baseHost.replace(/^www\./i, '').split('.').slice(0, -1).join('.')
  const localTokens = localPart.split(/[._-]+/).filter((token) => token.length >= 4)

  if (emailDomain === baseHost || emailDomain === baseHost.replace(/^www\./i, '')) score += 5
  if (/contact|about|support|team|office|location/.test(lowerUrl)) score += 3
  if (/^(info|hello|contact|office|sales|support|admin)@/i.test(email)) score += 2
  if (!/^(noreply|no-reply|donotreply)@/i.test(email)) score += 1
  if (localTokens.some((token) => baseRoot.includes(token))) score += 4
  if (WEBMAIL_DOMAINS.includes(emailDomain) && localTokens.some((token) => baseRoot.includes(token))) score += 2

  return score
}

async function fetchText(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok) {
      return null
    }

    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function collectInternalLinks(baseUrl: string, html: string) {
  const urls = new Set<string>()
  const base = new URL(baseUrl)
  const hrefRegex = /href=["']([^"'#]+)["']/gi
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(html))) {
    const href = match[1]
    if (!INTERNAL_LINK_KEYWORDS.some((keyword) => href.toLowerCase().includes(keyword))) continue
    if (NON_HTML_ASSET_RE.test(href)) continue

    try {
      const resolved = new URL(href, base)
      if (resolved.host !== base.host) continue
      if (NON_HTML_ASSET_RE.test(resolved.pathname)) continue
      urls.add(resolved.toString())
    } catch {
      continue
    }
  }

  return Array.from(urls).slice(0, MAX_FOLLOWUP_PAGES)
}

async function isRobotsAllowed(url: string) {
  try {
    const parsed = new URL(url)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    const robotsText = await fetchText(robotsUrl)
    if (!robotsText) return true

    const path = parsed.pathname || '/'
    const lines = robotsText.split(/\r?\n/)
    let inGenericBlock = false

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const [directive, valueRaw] = line.split(':', 2)
      if (!directive || !valueRaw) continue
      const value = valueRaw.trim()

      if (/^user-agent$/i.test(directive)) {
        inGenericBlock = value === '*'
        continue
      }

      if (!inGenericBlock) continue

      if (/^disallow$/i.test(directive)) {
        if (value === '/') return false
        if (value && path.startsWith(value)) return false
      }
    }

    return true
  } catch {
    return true
  }
}

async function runPublicWebsiteEmailEnrichment(normalized: string): Promise<LeadEmailEnrichmentResult> {
  if (!(await isRobotsAllowed(normalized))) {
    return {
      primaryEmail: null,
      candidates: [],
      sourceUrls: [],
      attemptedUrls: [normalized],
      contactPageUrls: [],
      contactFormUrls: [],
      hasContactForm: false,
      confidence: 'none',
      status: 'skipped',
      provider: 'none',
      note: 'Website robots.txt does not allow this public enrichment crawl.',
    }
  }

  const homeHtml = await fetchText(normalized)
  if (!homeHtml) {
    return {
      primaryEmail: null,
      candidates: [],
      sourceUrls: [normalized],
      attemptedUrls: [normalized],
      contactPageUrls: [],
      contactFormUrls: [],
      hasContactForm: false,
      confidence: 'none',
      status: 'not_found',
      provider: 'none',
      note: 'Website loaded poorly or exposed no readable HTML.',
    }
  }

  const attemptedUrls = [normalized]
  const candidateMap = new Map<string, EmailCandidate>()
  const contactPageUrls = new Set<string>()
  const contactFormUrls = new Set<string>()
  const baseHost = new URL(normalized).host.replace(/^www\./i, '')

  const addCandidates = (emails: string[], sourceUrl: string, reason: string) => {
    for (const email of emails) {
      const score = scoreEmail(email, sourceUrl, baseHost)
      const existing = candidateMap.get(email)
      if (!existing || existing.score < score) {
        candidateMap.set(email, { email, score, sourceUrl, reason })
      }
    }
  }

  addCandidates(extractEmailsFromHtml(homeHtml), normalized, 'homepage')
  if (hasLikelyContactForm(homeHtml)) {
    contactPageUrls.add(normalized)
    contactFormUrls.add(normalized)
  }

  for (const url of collectInternalLinks(normalized, homeHtml)) {
    contactPageUrls.add(url)
    if (!(await isRobotsAllowed(url))) continue
    attemptedUrls.push(url)
    const html = await fetchText(url)
    if (!html) continue
    addCandidates(extractEmailsFromHtml(html), url, 'internal_contact_page')
    if (hasLikelyContactForm(html)) {
      contactFormUrls.add(url)
    }
  }

  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score)
  const primary = candidates[0] || null
  const confidence =
    !primary ? 'none' : primary.score >= 8 ? 'high' : primary.score >= 5 ? 'medium' : 'low'
  const hasContactForm = contactFormUrls.size > 0

  let note = primary
    ? `Found ${candidates.length} public email candidate(s) from website pages.`
    : 'No public email was detected on the business website or contact pages.'

  if (!primary && hasContactForm) {
    note = `${note} A website contact form is available as a fallback contact path.`
  }

  return {
    primaryEmail: primary?.email || null,
    candidates: candidates.slice(0, 6).map((candidate) => ({
      email: candidate.email,
      score: candidate.score,
      sourceUrl: candidate.sourceUrl,
      reason: candidate.reason,
    })),
    sourceUrls: Array.from(new Set(candidates.map((candidate) => candidate.sourceUrl))),
    attemptedUrls,
    contactPageUrls: Array.from(contactPageUrls),
    contactFormUrls: Array.from(contactFormUrls),
    hasContactForm,
    confidence,
    status: primary ? 'found' : 'not_found',
    provider: primary ? 'public_website' : 'none',
    note,
  }
}

export async function enrichLeadEmailFromWebsite(website?: string | null): Promise<LeadEmailEnrichmentResult> {
  const normalized = safeUrl(website)
  if (!normalized) {
    return {
      primaryEmail: null,
      candidates: [],
      sourceUrls: [],
      attemptedUrls: [],
      contactPageUrls: [],
      contactFormUrls: [],
      hasContactForm: false,
      confidence: 'none',
      status: 'skipped',
      provider: 'none',
      note: 'No working website available for public email enrichment.',
    }
  }

  const publicResult = await runPublicWebsiteEmailEnrichment(normalized)
  if (publicResult.primaryEmail) return publicResult

  const hunterResult = await enrichContactFromHunter({ website: normalized, preferGenericInbox: true })
  const hunterNote = hunterResult.note
  if (!hunterResult.primaryCandidate) {
    return {
      ...publicResult,
      note: hunterResult.status === 'skipped' ? publicResult.note : `${publicResult.note} ${hunterNote}`.trim(),
    }
  }

  const hunterCandidates = hunterResult.candidates.slice(0, 6).map((candidate) => ({
    email: candidate.email,
    score: candidate.score,
    sourceUrl: candidate.sourceUrls[0] || `hunter:${hunterResult.domain || 'unknown'}`,
    reason: 'hunter_domain_search',
  }))

  const primary = hunterCandidates[0] || null
  const confidence =
    !primary ? 'none' : primary.score >= 18 ? 'high' : primary.score >= 10 ? 'medium' : 'low'

  return {
    primaryEmail: primary?.email || null,
    candidates: [...publicResult.candidates, ...hunterCandidates].slice(0, 6),
    sourceUrls: Array.from(
      new Set([
        ...publicResult.sourceUrls,
        ...hunterResult.candidates.flatMap((candidate) => candidate.sourceUrls),
      ])
    ),
    attemptedUrls: [...publicResult.attemptedUrls, `hunter:${hunterResult.domain || 'unknown'}`],
    contactPageUrls: publicResult.contactPageUrls,
    contactFormUrls: publicResult.contactFormUrls,
    hasContactForm: publicResult.hasContactForm,
    confidence,
    status: 'found',
    provider: publicResult.candidates.length ? 'public_website_plus_hunter' : 'hunter',
    note: `${publicResult.note} ${hunterResult.note}`.trim(),
  }
}
