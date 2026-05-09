import { withTimeout } from '@/lib/utils/async'
import type { PrTargetRecord } from '@/lib/pr/types'

type DestinationDiscoveryResult = {
  destination: string | null
  audienceUrl: string | null
  submissionUrl: string | null
  contactEmail: string | null
  contactPageUrl: string | null
  sourceQuery: string | null
  provider: 'google_places' | 'bing_rss'
}

type PlacesCandidate = {
  name: string
  websiteUrl: string | null
  formattedAddress: string | null
  primaryType: string | null
}

type MetadataMap = Record<string, unknown>

const CONTACT_KEYWORDS = ['contact', 'about', 'team', 'advertise', 'submit', 'contribute', 'pitch', 'newsletter']
const BLOCKED_HOST_PATTERNS = [
  'google.com',
  'duckduckgo.com',
  'bing.com',
  'visit',
  'wikipedia.org',
]

function safeUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeExternalUrl(value: string | null | undefined) {
  const url = safeUrl(value)
  if (!url) return null
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (BLOCKED_HOST_PATTERNS.some((pattern) => host.includes(pattern))) return null
  if (!/^https?:$/i.test(url.protocol)) return null
  return url.toString()
}

function extractMetadata(target: PrTargetRecord) {
  return (target.metadata_json || {}) as MetadataMap
}

function normalizeQueryText(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.replace(/["“”]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || null
}

function extractSourceQuery(target: PrTargetRecord) {
  const metadata = extractMetadata(target)
  const metadataQuery =
    typeof metadata.searchQuery === 'string' && metadata.searchQuery.trim()
      ? metadata.searchQuery.trim()
      : typeof metadata.sourceQuery === 'string' && metadata.sourceQuery.trim()
        ? metadata.sourceQuery.trim()
        : null

  return normalizeQueryText(target.source_query || metadataQuery || target.label || null)
}

function extractSeedKey(target: PrTargetRecord) {
  const metadata = extractMetadata(target)
  return typeof metadata.seedKey === 'string' ? metadata.seedKey : null
}

function locationLabel(target: PrTargetRecord) {
  return [target.city, target.state].filter(Boolean).join(' ').trim()
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function buildPlacesQueries(target: PrTargetRecord) {
  const location = locationLabel(target)
  const seedKey = extractSeedKey(target)
  const fallbackLabel = normalizeQueryText(target.label)
  const sourceQuery = extractSourceQuery(target)
  const city = target.city || ''
  const state = target.state || ''
  const category = target.target_category
  const type = target.target_type

  const queries: Array<string | null> = []

  if (seedKey === 'local-chamber' || type === 'chamber' || category === 'chamber') {
    queries.push(`${city} ${state} chamber of commerce`)
    queries.push(`${city} chamber of commerce`)
  }

  if (seedKey === 'small-business-newsletter' || (type === 'newsletter' && category === 'local_small_business')) {
    queries.push(`${city} ${state} small business center`)
    queries.push(`${city} ${state} business journal`)
    queries.push(`${city} ${state} small business program`)
  }

  if (category === 'minority_business') {
    queries.push(`${city} ${state} minority business organization`)
    queries.push(`${city} ${state} minority supplier development council`)
  }

  if (category === 'hispanic_business') {
    queries.push(`${city} ${state} hispanic chamber of commerce`)
    queries.push(`${city} ${state} latino business organization`)
  }

  if (category === 'black_business') {
    queries.push(`${city} ${state} black chamber of commerce`)
    queries.push(`${city} ${state} black business association`)
  }

  if (category === 'women_owned_business') {
    queries.push(`${city} ${state} women business center`)
    queries.push(`${city} ${state} women business organization`)
  }

  if (category === 'immigrant_business') {
    queries.push(`${city} ${state} immigrant business organization`)
    queries.push(`${city} ${state} refugee business organization`)
  }

  if (type === 'podcast') {
    queries.push(`${city} ${state} business podcast`)
  }

  if (type === 'journalist') {
    queries.push(`${city} ${state} business publication`)
    queries.push(`${city} ${state} startup publication`)
  }

  if (type === 'community' || type === 'group') {
    queries.push(`${city} ${state} business association`)
    queries.push(`${city} ${state} business community`)
  }

  queries.push(fallbackLabel)
  queries.push(sourceQuery)
  if (location && fallbackLabel && !fallbackLabel.toLowerCase().includes(location.toLowerCase())) {
    queries.push(`${location} ${fallbackLabel}`)
  }

  return uniqueStrings(queries)
}

function scorePlacesCandidate(target: PrTargetRecord, candidate: PlacesCandidate) {
  const lowerName = candidate.name.toLowerCase()
  const lowerType = (candidate.primaryType || '').toLowerCase()
  const lowerWebsite = (candidate.websiteUrl || '').toLowerCase()
  const city = (target.city || '').toLowerCase()
  let score = 0

  if (candidate.websiteUrl) score += 25
  if (city && lowerName.includes(city)) score += 10
  if (city && lowerWebsite.includes(city.replace(/\s+/g, ''))) score += 5

  if (target.target_type === 'chamber' || target.target_category === 'chamber') {
    if (lowerName.includes('chamber')) score += 40
    if (lowerType.includes('association') || lowerType.includes('organization')) score += 8
  }

  if (target.target_type === 'newsletter') {
    if (/(journal|newsletter|business|center|program|incubator)/.test(lowerName)) score += 24
    if (lowerWebsite.includes('bizjournals')) score += 28
  }

  if (target.target_category === 'hispanic_business' && /(hispanic|latino)/.test(lowerName)) score += 32
  if (target.target_category === 'minority_business' && /(minority|supplier development)/.test(lowerName)) score += 32
  if (target.target_category === 'black_business' && /black/.test(lowerName)) score += 32
  if (target.target_category === 'women_owned_business' && /(women|woman)/.test(lowerName)) score += 32
  if (target.target_category === 'immigrant_business' && /(immigrant|refugee|international)/.test(lowerName)) score += 28

  if (/(visit|tourism|airport|wikipedia|city of )/.test(lowerName)) score -= 60
  if (/(visit|tourism|airport|wikipedia)/.test(lowerWebsite)) score -= 60

  return score
}

async function searchGooglePlaces(query: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []

  const response = await withTimeout(
    fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.websiteUri,places.primaryType',
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
        regionCode: 'US',
      }),
    }),
    12000,
    `Google Places search for ${query}`
  )

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return ((data.places || []) as Array<Record<string, unknown>>).map((place) => ({
    name: String((place.displayName as { text?: string } | undefined)?.text || query),
    websiteUrl: normalizeExternalUrl(String(place.websiteUri || '')),
    formattedAddress: typeof place.formattedAddress === 'string' ? place.formattedAddress : null,
    primaryType: typeof place.primaryType === 'string' ? place.primaryType : null,
  }))
}

async function discoverViaGooglePlaces(target: PrTargetRecord) {
  let best:
    | {
        candidate: PlacesCandidate
        score: number
        query: string
      }
    | null = null

  for (const query of buildPlacesQueries(target)) {
    const candidates = await searchGooglePlaces(query).catch(() => [])
    for (const candidate of candidates) {
      const score = scorePlacesCandidate(target, candidate)
      if (!best || score > best.score) {
        best = { candidate, score, query }
      }
    }
  }

  if (!best?.candidate.websiteUrl) {
    return null
  }

  return {
    audienceUrl: best.candidate.websiteUrl,
    sourceQuery: best.query,
  }
}

function extractFirstEmail(html: string) {
  const mailtos = Array.from(html.matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi))
  for (const match of mailtos) {
    const candidate = normalizeEmailCandidate(match[1])
    if (candidate) return candidate
  }

  const textEmails = Array.from(html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))
  for (const match of textEmails) {
    const candidate = normalizeEmailCandidate(match[0])
    if (candidate) return candidate
  }

  return null
}

function normalizeEmailCandidate(value: string | null | undefined) {
  const email = value?.trim().toLowerCase()
  if (!email) return null
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return null
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|woff2?)$/i.test(email)) return null
  if (/(example\.com|sentry\.io|wordpress|gravatar)/i.test(email)) return null
  return email
}

function absolutizePath(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function extractPreferredPage(baseUrl: string, html: string) {
  const matches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi))

  for (const match of matches) {
    const href = match[1] || ''
    const text = (match[2] || '').replace(/<[^>]+>/g, ' ').trim().toLowerCase()
    const lowerHref = href.toLowerCase()

    if (!CONTACT_KEYWORDS.some((keyword) => text.includes(keyword) || lowerHref.includes(keyword))) continue

    const full = absolutizePath(baseUrl, href)
    const normalized = normalizeExternalUrl(full)
    if (normalized) return normalized
  }

  return null
}

async function fetchText(url: string) {
  const response = await withTimeout(
    fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; VestBlockBot/1.0; +https://vestblock.io)',
      },
      redirect: 'follow',
    }),
    12000,
    `Fetch ${url}`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return await response.text()
}

export async function discoverPrTargetDestination(
  target: PrTargetRecord
): Promise<DestinationDiscoveryResult | null> {
  const placesDiscovery = await discoverViaGooglePlaces(target).catch(() => null)
  const audienceUrl = placesDiscovery?.audienceUrl || null
  const sourceQuery = placesDiscovery?.sourceQuery || extractSourceQuery(target)

  if (!audienceUrl) {
    return null
  }

  let contactEmail: string | null = null
  let contactPageUrl: string | null = null

  try {
    const homepageHtml = await fetchText(audienceUrl)
    contactEmail = extractFirstEmail(homepageHtml)
    contactPageUrl = extractPreferredPage(audienceUrl, homepageHtml)

    if (!contactEmail && contactPageUrl && contactPageUrl !== audienceUrl) {
      const contactHtml = await fetchText(contactPageUrl)
      contactEmail = extractFirstEmail(contactHtml)
    }
  } catch {
    // Keep the discovered website even if page-level enrichment fails.
  }

  const submissionUrl = contactPageUrl
  const destination = contactEmail || submissionUrl || audienceUrl

  return {
    destination,
    audienceUrl,
    submissionUrl,
    contactEmail,
    contactPageUrl,
    sourceQuery,
    provider: 'google_places',
  }
}
