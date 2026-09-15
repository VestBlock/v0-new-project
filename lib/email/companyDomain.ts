import { safeUrl } from '@/lib/leads/utils'

const NON_COMPANY_WEBSITE_HOSTS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'maps.google.com',
  'twitter.com',
  'x.com',
  'yelp.com',
])

export function companyWebsiteDomain(website?: string | null) {
  const normalized = safeUrl(website)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname)) return null
    if (
      NON_COMPANY_WEBSITE_HOSTS.has(hostname) ||
      Array.from(NON_COMPANY_WEBSITE_HOSTS).some((blocked) => hostname.endsWith(`.${blocked}`))
    ) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}
