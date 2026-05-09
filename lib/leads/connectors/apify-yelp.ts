import { z } from 'zod'

import type { NormalizedLeadInput } from '@/lib/leads/types'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { normalizePhone, safeUrl } from '@/lib/leads/utils'

type SearchApifyYelpInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  proxyCountry?: string
}

const yelpItemSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  rating: z.number().optional().nullable(),
  reviewCount: z.number().optional().nullable(),
  categories: z.array(z.union([z.string(), z.object({ title: z.string().optional().nullable() })])).optional().nullable(),
  price: z.string().optional().nullable(),
})

const runSchema = z.object({
  data: z.object({
    id: z.string(),
    defaultDatasetId: z.string().nullable().optional(),
    status: z.string().optional(),
  }),
})

function apifyActorPath(actorId: string) {
  return actorId.replace(/\//g, '~')
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function apifyRequest<T>(path: string, init?: RequestInit) {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN is required.')

  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`https://api.apify.com/v2${path}${separator}token=${encodeURIComponent(token)}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`Apify request failed (${response.status}): ${message || response.statusText}`)
  }

  return (await response.json()) as T
}

async function waitForRunCompletion(runId: string, maxWaitMs = 180000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < maxWaitMs) {
    const result = await apifyRequest<{ data: { status: string; defaultDatasetId?: string | null } }>(
      `/actor-runs/${runId}`
    )
    const status = String(result.data?.status || '')

    if (status === 'SUCCEEDED') return result.data
    if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) {
      throw new Error(`Apify actor run ${runId} ended with status ${status}.`)
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  throw new Error(`Apify actor run ${runId} did not finish within ${Math.round(maxWaitMs / 1000)} seconds.`)
}

async function fetchDatasetItems(datasetId: string) {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN is required.')

  const response = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&format=json&clean=1`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`Apify dataset fetch failed (${response.status}): ${message || response.statusText}`)
  }

  return (await response.json()) as unknown[]
}

function pickCategory(categories: z.infer<typeof yelpItemSchema>['categories']) {
  if (!Array.isArray(categories)) return null
  for (const category of categories) {
    if (typeof category === 'string' && category.trim()) return category.trim()
    if (category && typeof category === 'object' && typeof category.title === 'string' && category.title.trim()) {
      return category.title.trim()
    }
  }
  return null
}

function extractExternalId(urlValue: string | null | undefined, fallbackId: string | null | undefined) {
  if (fallbackId && fallbackId.trim()) return fallbackId.trim()
  if (!urlValue) return null
  try {
    const url = new URL(urlValue)
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.length >= 2 && segments[0] === 'biz' ? segments[1] : null
  } catch {
    return null
  }
}

function inferCategory(lowerNiche: string, weakSignals: string[], hasOnlineBooking: boolean, hasChat: boolean) {
  const needsBooking = /barber|salon|daycare|tax|immigration|auto repair|restaurant|food truck|med spa|dental/i.test(
    lowerNiche
  )
  if (/spanish|immigration/.test(lowerNiche)) return 'spanish_business'
  if (weakSignals.length >= 4) return 'website_upgrade'
  if (needsBooking && !hasOnlineBooking) return 'appointment_booking'
  if (!hasChat) return 'ai_receptionist'
  return 'small_business'
}

export async function searchApifyYelp(input: SearchApifyYelpInput) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is required.')
  }

  const actorId = process.env.APIFY_YELP_ACTOR_ID || 'tri_angle/yelp-scraper'
  const proxyCountry = input.proxyCountry || process.env.APIFY_PROXY_COUNTRY || 'US'
  const memoryMbytes = envInt('APIFY_YELP_MEMORY_MBYTES', 1024)
  const timeoutSecs = envInt('APIFY_YELP_TIMEOUT_SECS', 180)
  const maxConcurrency = envInt('APIFY_YELP_MAX_CONCURRENCY', 3)
  const normalizedLeads: NormalizedLeadInput[] = []
  const location = `${input.city}${input.state ? `, ${input.state}` : ''}`
  const runResult = runSchema.parse(
    await apifyRequest(`/acts/${apifyActorPath(actorId)}/runs?memory=${memoryMbytes}&timeout=${timeoutSecs}`, {
      method: 'POST',
      body: JSON.stringify({
        searchTerms: input.niches,
        locations: [location],
        searchLimit: input.limitPerNiche,
        useApifyProxy: true,
        apifyProxyCountry: proxyCountry,
        maxRequestRetries: 2,
        maxConcurrency,
      }),
    })
  )

  const completed = await waitForRunCompletion(runResult.data.id)
  const datasetId = completed.defaultDatasetId || runResult.data.defaultDatasetId
  if (!datasetId) {
    throw new Error(`Apify actor ${actorId} did not return a dataset id.`)
  }

  const items = await fetchDatasetItems(datasetId)

  for (const item of items) {
    const parsed = yelpItemSchema.safeParse(item)
    if (!parsed.success) continue

    const record = parsed.data
    const website = safeUrl(record.website || record.url)
    const websiteReport = await analyzeWebsiteWeakness(website)
    const categoryLabel = pickCategory(record.categories)?.toLowerCase() || ''
    const businessLabel = `${record.name || ''} ${categoryLabel}`.toLowerCase()
    const matchedNiche =
      input.niches.find((niche) =>
        niche
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part.length > 3 && businessLabel.includes(part))
      ) || input.niches[0]
    const lowerNiche = matchedNiche.toLowerCase()
    const weakSignals = websiteReport.weakSignals
    const category = inferCategory(lowerNiche, weakSignals, websiteReport.hasOnlineBooking, websiteReport.hasChat)
    const externalId = extractExternalId(record.url, record.id)
    const addressLine = record.address?.trim() || null
    const city = record.city?.trim() || input.city
    const state = record.state?.trim() || input.state || null
    const zip = record.zip?.trim() || record.postalCode?.trim() || null
    const searchString = `${matchedNiche} ${input.city}${input.state ? ` ${input.state}` : ''}`.trim()

    normalizedLeads.push({
      leadType: 'directory_business',
      source: 'apify_yelp_businesses',
      sourceUrl: safeUrl(record.url),
      category,
      externalId,
      name: null,
      businessName: record.name?.trim() || null,
      propertyAddress: [addressLine, city, state, zip].filter(Boolean).join(', ') || null,
      mailingAddress: [addressLine, city, state, zip].filter(Boolean).join(', ') || null,
      phone: normalizePhone(record.phone),
      email: null,
      website,
      city,
      state,
      zip,
      languageSignal: /spanish|immigration/.test(lowerNiche) ? 'spanish' : 'english',
      painSignal:
        weakSignals.length > 0 ? weakSignals.join('; ') : `Potential ${matchedNiche} Yelp lead in ${input.city}`,
      contactInfo: {
        rating: record.rating ?? null,
        reviewCount: record.reviewCount ?? null,
        price: record.price ?? null,
        businessType: pickCategory(record.categories),
        sourceDirectory: 'yelp',
      },
      formData: {
        apifyActor: actorId,
        apifySearchString: searchString,
        categories: record.categories ?? [],
      },
      metadata: {
        provider: 'apify',
        actorId,
        directory: 'yelp',
        searchString,
        raw: item,
        websiteAnalysis: websiteReport,
        niche: matchedNiche,
      },
    })
  }

  return normalizedLeads
}
