import { safeUrl } from '@/lib/leads/utils'
import type { WebsiteWeaknessReport } from '@/lib/leads/types'

export async function analyzeWebsiteWeakness(website?: string | null): Promise<WebsiteWeaknessReport> {
  const normalized = safeUrl(website)
  if (!normalized) {
    return {
      websiteExists: false,
      responseTimeMs: null,
      hasViewportMeta: false,
      hasChat: false,
      hasOnlineBooking: false,
      hasClearCta: false,
      hasTrustSignals: false,
      hasContactSignals: false,
      isLikelyOutdated: true,
      estimatedSpeed: 'unreachable',
      weakSignals: ['No working website detected'],
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const startedAt = Date.now()

  try {
    const response = await fetch(normalized, {
      headers: {
        'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    const html = await response.text()
    const responseTimeMs = Date.now() - startedAt
    const lower = html.toLowerCase()
    const weakSignals: string[] = []

    const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html)
    const hasChat = /(intercom|drift|tawk\.to|zendesk|chat with us|live chat)/i.test(lower)
    const hasOnlineBooking = /(book now|schedule now|reserve now|appointment|online booking|calendly)/i.test(lower)
    const hasClearCta = /(call now|get quote|book now|schedule|start today|contact us|apply now|request estimate)/i.test(lower)
    const hasTrustSignals =
      /(testimonials|reviews|case stud|why choose us|google reviews|facebook reviews|before and after|licensed|insured)/i.test(
        lower
      )
    const hasContactSignals =
      /(mailto:|tel:|contact us|contact information|call us|visit us)/i.test(lower)
    const isLikelyOutdated =
      /copyright\s*(19|20)\d{2}/i.test(lower) &&
      !new RegExp(`copyright\\s*${new Date().getFullYear()}`, 'i').test(lower)

    if (!hasViewportMeta) weakSignals.push('Missing mobile viewport meta tag')
    if (!hasChat) weakSignals.push('No clear chat or live support signal')
    if (!hasOnlineBooking) weakSignals.push('No online booking or scheduling flow detected')
    if (!hasClearCta) weakSignals.push('No strong call-to-action detected above the fold')
    if (!hasTrustSignals) weakSignals.push('Trust signals or proof elements are hard to find')
    if (!hasContactSignals) weakSignals.push('Contact path is weak or unclear')
    if (isLikelyOutdated) weakSignals.push('Site appears outdated')
    if (responseTimeMs > 2500) weakSignals.push('Slow initial response time')

    const estimatedSpeed =
      responseTimeMs > 2500
        ? 'slow'
        : responseTimeMs > 1200
          ? 'moderate'
          : 'fast'

    return {
      websiteExists: response.ok,
      responseTimeMs,
      hasViewportMeta,
      hasChat,
      hasOnlineBooking,
      hasClearCta,
      hasTrustSignals,
      hasContactSignals,
      isLikelyOutdated,
      estimatedSpeed,
      weakSignals,
    }
  } catch {
    return {
      websiteExists: false,
      responseTimeMs: null,
      hasViewportMeta: false,
      hasChat: false,
      hasOnlineBooking: false,
      hasClearCta: false,
      hasTrustSignals: false,
      hasContactSignals: false,
      isLikelyOutdated: true,
      estimatedSpeed: 'unreachable',
      weakSignals: ['Website could not be reached'],
    }
  } finally {
    clearTimeout(timeout)
  }
}
