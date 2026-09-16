import { normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { hashHunterVerificationEmail } from '@/lib/outreach/hunterSendVerificationCore'

export const PUBLIC_BUSINESS_WEBSITE_FETCH_TIMEOUT_MS = 8_000
export const PUBLIC_BUSINESS_WEBSITE_MAX_REDIRECTS = 3
export const PUBLIC_BUSINESS_WEBSITE_MAX_PAGES = 3
export const PUBLIC_BUSINESS_WEBSITE_MAX_HTML_BYTES = 1_000_000

const CONTACT_LINK_PATTERN = /(?:contact|about|team|staff|support|office|location)/i
const NON_HTML_PATH_PATTERN = /\.(?:css|js|json|xml|txt|png|jpe?g|gif|webp|svg|pdf|woff2?|ttf|eot)(?:$|\?)/i

export type PublicBusinessWebsiteObservation =
  | {
      status: 'found'
      sourceUrl: string
      attemptedUrls: string[]
    }
  | {
      status: 'not_found' | 'invalid' | 'unavailable'
      attemptedUrls: string[]
      reason: string
    }

type PublicBusinessWebsiteFetchDependencies = {
  fetchImpl: typeof fetch
  validatePublicUrl: (url: string) => Promise<boolean>
}

function httpUrl(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.username || parsed.password) return null
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

export function publicBusinessWebsiteDomain(value: unknown) {
  const url = httpUrl(value)
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null : null
}

export function publicBusinessWebsiteDomainsAlign(leftValue: unknown, rightValue: unknown) {
  const left = String(leftValue || '').trim().toLowerCase().replace(/^www\./, '')
  const right = String(rightValue || '').trim().toLowerCase().replace(/^www\./, '')
  return Boolean(
    left && right &&
    (left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`))
  )
}

function htmlContainsExactRecipient(html: string, recipientEmail: string) {
  const matches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return matches.some((candidate) => normalizeEmailAddress(candidate) === recipientEmail)
}

function collectAlignedContactLinks(pageUrl: string, html: string, businessDomain: string) {
  const links = new Set<string>()
  const hrefPattern = /href=["']([^"'#]+)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefPattern.exec(html))) {
    const href = match[1]
    if (!CONTACT_LINK_PATTERN.test(href) || NON_HTML_PATH_PATTERN.test(href)) continue
    try {
      const resolved = new URL(href, pageUrl)
      resolved.hash = ''
      if (
        (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') ||
        !publicBusinessWebsiteDomainsAlign(resolved.hostname, businessDomain)
      ) continue
      links.add(resolved.toString())
    } catch {
      continue
    }
  }
  return Array.from(links)
}

async function readBoundedHtml(response: Response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return null
  }
  const declaredLength = Number.parseInt(response.headers.get('content-length') || '', 10)
  if (Number.isFinite(declaredLength) && declaredLength > PUBLIC_BUSINESS_WEBSITE_MAX_HTML_BYTES) {
    return null
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let html = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteCount += value.byteLength
    if (byteCount > PUBLIC_BUSINESS_WEBSITE_MAX_HTML_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    html += decoder.decode(value, { stream: true })
  }
  return html + decoder.decode()
}

async function fetchAlignedHtml(input: {
  startUrl: string
  businessDomain: string
  signal: AbortSignal
  dependencies: PublicBusinessWebsiteFetchDependencies
}) {
  let currentUrl = input.startUrl
  for (let redirectCount = 0; redirectCount <= PUBLIC_BUSINESS_WEBSITE_MAX_REDIRECTS; redirectCount += 1) {
    const parsed = httpUrl(currentUrl)
    if (
      !parsed ||
      !publicBusinessWebsiteDomainsAlign(new URL(parsed).hostname, input.businessDomain)
    ) {
      return { status: 'invalid' as const, reason: 'website_url_not_http_or_domain_aligned' }
    }
    let isPublic = false
    try {
      isPublic = await input.dependencies.validatePublicUrl(parsed)
    } catch {
      isPublic = false
    }
    if (!isPublic) {
      return { status: 'unavailable' as const, reason: 'website_url_public_validation_failed' }
    }

    let response: Response
    try {
      response = await input.dependencies.fetchImpl(parsed, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'VestBlock Public Business Contact Verifier/1.0 (+https://www.vestblock.io)',
        },
        redirect: 'manual',
        signal: input.signal,
      })
    } catch {
      return { status: 'unavailable' as const, reason: 'website_fetch_failed' }
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) return { status: 'unavailable' as const, reason: 'website_redirect_missing_location' }
      try {
        currentUrl = new URL(location, parsed).toString()
      } catch {
        return { status: 'invalid' as const, reason: 'website_redirect_invalid' }
      }
      continue
    }

    if (!response.ok) return { status: 'unavailable' as const, reason: `website_http_${response.status}` }
    let html: string | null
    try {
      html = await readBoundedHtml(response)
    } catch {
      return { status: 'unavailable' as const, reason: 'website_html_read_failed' }
    }
    if (html === null) return { status: 'invalid' as const, reason: 'website_response_not_bounded_html' }
    return { status: 'ok' as const, finalUrl: parsed, html }
  }
  return { status: 'invalid' as const, reason: 'website_redirect_limit_exceeded' }
}

export async function observeExactRecipientOnBusinessWebsite(input: {
  website: string | null | undefined
  recipientEmail: string | null | undefined
  dependencies: PublicBusinessWebsiteFetchDependencies
  timeoutMs?: number
}): Promise<PublicBusinessWebsiteObservation> {
  const website = httpUrl(input.website)
  const recipientEmail = normalizeEmailAddress(input.recipientEmail)
  const businessDomain = publicBusinessWebsiteDomain(website)
  if (!website || !recipientEmail || !businessDomain) {
    return { status: 'invalid', attemptedUrls: [], reason: 'website_or_recipient_invalid' }
  }

  const controller = new AbortController()
  const timeoutMs = Math.max(10, Math.min(30_000, input.timeoutMs || PUBLIC_BUSINESS_WEBSITE_FETCH_TIMEOUT_MS))
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const attemptedUrls: string[] = []
  try {
    const pendingUrls = [website]
    const seen = new Set<string>()
    let sawUnavailablePage = false
    while (pendingUrls.length && attemptedUrls.length < PUBLIC_BUSINESS_WEBSITE_MAX_PAGES) {
      const pageUrl = pendingUrls.shift()!
      if (seen.has(pageUrl)) continue
      seen.add(pageUrl)
      attemptedUrls.push(pageUrl)

      const page = await fetchAlignedHtml({
        startUrl: pageUrl,
        businessDomain,
        signal: controller.signal,
        dependencies: input.dependencies,
      })
      if (page.status !== 'ok') {
        if (pageUrl === website || page.status === 'invalid') {
          return { status: page.status, attemptedUrls, reason: page.reason }
        }
        sawUnavailablePage = true
        continue
      }
      if (htmlContainsExactRecipient(page.html, recipientEmail)) {
        return { status: 'found', sourceUrl: page.finalUrl, attemptedUrls }
      }
      for (const link of collectAlignedContactLinks(page.finalUrl, page.html, businessDomain)) {
        if (!seen.has(link) && pendingUrls.length + attemptedUrls.length < PUBLIC_BUSINESS_WEBSITE_MAX_PAGES) {
          pendingUrls.push(link)
        }
      }
    }
    if (sawUnavailablePage) {
      return { status: 'unavailable', attemptedUrls, reason: 'website_contact_page_unavailable' }
    }
    return { status: 'not_found', attemptedUrls, reason: 'exact_recipient_not_found_on_business_website' }
  } finally {
    clearTimeout(timeout)
  }
}

export function buildPublicBusinessWebsiteContactInfo(input: {
  existingContactInfo?: Record<string, unknown> | null
  recipientEmail: string
  sourceUrl: string
  attemptedUrls: string[]
  observedAt: string
}) {
  const recipientEmail = normalizeEmailAddress(input.recipientEmail)
  const recipientHash = hashHunterVerificationEmail(recipientEmail)
  return {
    ...(input.existingContactInfo || {}),
    publicEmailCandidates: [{
      email: recipientEmail,
      score: 10,
      sourceUrl: input.sourceUrl,
      reason: 'exact_recipient_on_business_website',
      observedAt: input.observedAt,
      recipientHash,
    }],
    publicEmailEnrichment: {
      status: 'found',
      provider: 'public_website',
      confidence: 'high',
      checkedAt: input.observedAt,
      sourceUrls: [input.sourceUrl],
      attemptedUrls: input.attemptedUrls,
      exactRecipientMatch: true,
      recipientHash,
    },
  }
}
