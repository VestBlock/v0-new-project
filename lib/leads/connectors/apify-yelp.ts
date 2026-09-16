import { z } from 'zod'

import type { NormalizedLeadInput } from '@/lib/leads/types'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { normalizePhone, safeUrl } from '@/lib/leads/utils'
import { buildApifyYelpPaidWorkPlan } from '@/lib/leads/paidSourceBudgetCore'

type SearchApifyYelpInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  proxyCountry?: string
  maxWaitMs?: number
  timeoutSecs?: number
}

const yelpCategorySchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
])

const yelpAddressSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
])

const numberLikeSchema = z.union([z.number(), z.string()])

const yelpItemSchema = z.object({
  id: z.string().optional().nullable(),
  bizId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  directUrl: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: yelpAddressSchema.optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  rating: numberLikeSchema.optional().nullable(),
  aggregatedRating: numberLikeSchema.optional().nullable(),
  reviewCount: numberLikeSchema.optional().nullable(),
  categories: z.array(yelpCategorySchema).optional().nullable(),
  price: z.string().optional().nullable(),
  priceRange: z.string().optional().nullable(),
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

function envNumber(name: string) {
  return Number.parseInt(process.env[name] || '', 10)
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
    if (category && typeof category === 'object') {
      if (typeof category.title === 'string' && category.title.trim()) return category.title.trim()
      if (typeof category.alias === 'string' && category.alias.trim()) return category.alias.trim()
    }
  }
  return null
}

function trimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = trimmedString(value)
    if (normalized) return normalized
  }
  return null
}

function finiteNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeStructuredAddress(
  address: z.infer<typeof yelpAddressSchema> | null | undefined,
  fallbackCity: string,
  fallbackState?: string
) {
  if (typeof address === 'string') {
    return {
      addressLine: trimmedString(address),
      city: fallbackCity,
      state: trimmedString(fallbackState),
      zip: null,
    }
  }

  const structured = address && typeof address === 'object' ? address : {}
  const addressLine = [
    firstString(structured.addressLine1, structured.streetAddress, structured.address1, structured.line1),
    firstString(structured.addressLine2, structured.address2, structured.line2),
    firstString(structured.addressLine3, structured.address3, structured.line3),
  ].filter((value): value is string => Boolean(value)).join(', ') || null

  return {
    addressLine,
    city: firstString(structured.city, structured.addressLocality) || fallbackCity,
    state: firstString(structured.regionCode, structured.addressRegion, structured.state) || trimmedString(fallbackState),
    zip: firstString(structured.postalCode, structured.zipCode, structured.zip),
  }
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

export function normalizeApifyYelpDatasetItem(
  item: unknown,
  fallback: { city: string; state?: string }
) {
  const parsed = yelpItemSchema.safeParse(item)
  if (!parsed.success) return null

  const record = parsed.data
  const directoryUrl = firstString(record.directUrl, record.url)
  const address = normalizeStructuredAddress(record.address, fallback.city, fallback.state)
  const structuredAddress = record.address && typeof record.address === 'object'
    ? record.address
    : null
  const city = firstString(
    structuredAddress?.city,
    structuredAddress?.addressLocality,
    record.city,
    address.city
  ) || fallback.city
  const state = firstString(
    structuredAddress?.regionCode,
    structuredAddress?.addressRegion,
    structuredAddress?.state,
    record.state,
    address.state
  )
  const zip = firstString(
    structuredAddress?.postalCode,
    structuredAddress?.zipCode,
    structuredAddress?.zip,
    record.zip,
    record.postalCode,
    address.zip
  )

  return {
    businessName: trimmedString(record.name),
    sourceUrl: safeUrl(directoryUrl),
    // The directory listing identifies the source record, but it is not the
    // business's own website. Keeping these fields separate prevents contact
    // enrichment and recipient-evidence checks from ever treating a Yelp-owned
    // address as the local business's canonical public site.
    website: safeUrl(record.website),
    externalId: extractExternalId(directoryUrl, firstString(record.bizId, record.id)),
    phone: normalizePhone(record.phone),
    addressLine: address.addressLine,
    city,
    state,
    zip,
    rating: finiteNumber(record.aggregatedRating ?? record.rating),
    reviewCount: finiteNumber(record.reviewCount),
    price: firstString(record.priceRange, record.price),
    businessType: pickCategory(record.categories),
    categories: record.categories ?? [],
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
  const workPlan = buildApifyYelpPaidWorkPlan({
    niches: input.niches,
    limitPerNiche: input.limitPerNiche,
    memoryMbytes: envNumber('APIFY_YELP_MEMORY_MBYTES'),
    timeoutSecs: input.timeoutSecs ?? envNumber('APIFY_YELP_TIMEOUT_SECS'),
    maxWaitMs: input.maxWaitMs ?? envNumber('APIFY_YELP_MAX_WAIT_MS'),
    maxConcurrency: envNumber('APIFY_YELP_MAX_CONCURRENCY'),
    proxyCountry: input.proxyCountry || process.env.APIFY_PROXY_COUNTRY || 'US',
  })
  if (workPlan.estimatedBillableUnits <= 0) {
    throw new Error('Apify Yelp run has no work inside the enforced resource and result limits.')
  }
  const normalizedLeads: NormalizedLeadInput[] = []
  const location = `${input.city}${input.state ? `, ${input.state}` : ''}`
  const runResult = runSchema.parse(
    await apifyRequest(`/acts/${apifyActorPath(actorId)}/runs?memory=${workPlan.memoryMbytes}&timeout=${workPlan.timeoutSecs}`, {
      method: 'POST',
      body: JSON.stringify({
        searchTerms: workPlan.niches,
        locations: [location],
        searchLimit: workPlan.limitPerNiche,
        useApifyProxy: true,
        apifyProxyCountry: workPlan.proxyCountry,
        maxRequestRetries: 0,
        maxConcurrency: workPlan.maxConcurrency,
      }),
    })
  )

  const completed = await waitForRunCompletion(
    runResult.data.id,
    workPlan.maxWaitMs
  )
  const datasetId = completed.defaultDatasetId || runResult.data.defaultDatasetId
  if (!datasetId) {
    throw new Error(`Apify actor ${actorId} did not return a dataset id.`)
  }

  const items = (await fetchDatasetItems(datasetId)).slice(0, workPlan.resultUnits)

  for (const item of items) {
    const record = normalizeApifyYelpDatasetItem(item, { city: input.city, state: input.state })
    if (!record) continue

    const website = record.website
    const websiteReport = await analyzeWebsiteWeakness(website)
    const categoryLabel = record.businessType?.toLowerCase() || ''
    const businessLabel = `${record.businessName || ''} ${categoryLabel}`.toLowerCase()
    const matchedNiche =
      workPlan.niches.find((niche) =>
        niche
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part.length > 3 && businessLabel.includes(part))
      ) || workPlan.niches[0]
    const lowerNiche = matchedNiche.toLowerCase()
    const weakSignals = websiteReport.weakSignals
    const category = inferCategory(lowerNiche, weakSignals, websiteReport.hasOnlineBooking, websiteReport.hasChat)
    const searchString = `${matchedNiche} ${input.city}${input.state ? ` ${input.state}` : ''}`.trim()

    normalizedLeads.push({
      leadType: 'directory_business',
      source: 'apify_yelp_businesses',
      sourceUrl: record.sourceUrl,
      category,
      externalId: record.externalId,
      name: null,
      businessName: record.businessName,
      propertyAddress: [record.addressLine, record.city, record.state, record.zip].filter(Boolean).join(', ') || null,
      mailingAddress: [record.addressLine, record.city, record.state, record.zip].filter(Boolean).join(', ') || null,
      phone: record.phone,
      email: null,
      website,
      city: record.city,
      state: record.state,
      zip: record.zip,
      languageSignal: /spanish|immigration/.test(lowerNiche) ? 'spanish' : 'english',
      painSignal:
        weakSignals.length > 0 ? weakSignals.join('; ') : `Potential ${matchedNiche} Yelp lead in ${input.city}`,
      contactInfo: {
        rating: record.rating ?? null,
        reviewCount: record.reviewCount ?? null,
        price: record.price ?? null,
        businessType: record.businessType,
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
