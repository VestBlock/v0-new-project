import type { NormalizedLeadInput } from '@/lib/leads/types'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { normalizePhone, safeUrl } from '@/lib/leads/utils'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'

type SearchOutscraperGoogleMapsInput = {
  city: string
  state?: string
  niches: string[]
  limitPerNiche: number
  language?: string
  region?: string
  includeWebsiteAnalysis?: boolean
  requestTimeoutMs?: number
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function pickEmailCandidates(record: Record<string, unknown>) {
  const values: unknown[] = [
    record.email,
    record.email_1,
    record.email_2,
    record.email_3,
    record.email_4,
    record.email_5,
    ...(Array.isArray(record.emails) ? record.emails : []),
  ]

  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (typeof value === 'string') return value.split(/[,\s;]+/)
          if (value && typeof value === 'object' && 'email' in value) {
            return [String((value as { email?: unknown }).email || '')]
          }
          return []
        })
        .map((value) => normalizeEmailAddress(value))
        .filter((value): value is string => Boolean(value && isUsableContactEmail(value)))
    )
  )
}

function sanitizeHeaderToken(value: string | undefined) {
  return value?.replace(/[\r\n\t]/g, '').trim() || ''
}

function normalizeOutscraperRows(response: unknown, niches: string[], queries: string[]) {
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? (response as { data?: unknown }).data
      : response

  if (!Array.isArray(payload)) {
    throw new Error('Outscraper returned an unexpected response shape.')
  }

  const rows: Array<{ record: Record<string, unknown>; niche: string; query: string }> = []
  for (const [index, value] of payload.entries()) {
    if (Array.isArray(value)) {
      for (const row of value) {
        if (row && typeof row === 'object') {
          rows.push({
            record: row as Record<string, unknown>,
            niche: niches[index] || niches[0] || 'small business',
            query: queries[index] || queries[0] || '',
          })
        }
      }
      continue
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const sourceQuery = pickString(record, ['query', 'search_query'])
      const matchedIndex = sourceQuery
        ? queries.findIndex((query) => query.toLowerCase() === sourceQuery.toLowerCase())
        : -1
      rows.push({
        record,
        niche: matchedIndex >= 0 ? niches[matchedIndex] : niches[0] || 'small business',
        query: matchedIndex >= 0 ? queries[matchedIndex] : sourceQuery || queries[0] || '',
      })
    }
  }

  return rows
}

export async function searchOutscraperGoogleMaps(input: SearchOutscraperGoogleMapsInput) {
  const apiKey = sanitizeHeaderToken(process.env.OUTSCRAPER_API_KEY)
  if (!apiKey) {
    throw new Error('OUTSCRAPER_API_KEY is required.')
  }

  const normalizedLeads: NormalizedLeadInput[] = []
  const region = input.region || (input.state?.length === 2 ? 'us' : null)
  const queries = input.niches.map((niche) => `${niche} ${input.city}${input.state ? ` ${input.state}` : ''} usa`)
  const response = await fetch('https://api.app.outscraper.com/maps/search-v3', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      query: queries,
      limit: input.limitPerNiche,
      language: input.language || 'en',
      region,
      async: false,
    }),
    signal: AbortSignal.timeout(input.requestTimeoutMs || 25000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Outscraper Maps request failed with ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  const rows = normalizeOutscraperRows(data, input.niches, queries)

  for (const { record, niche, query } of rows) {
    const website = safeUrl(
      pickString(record, ['website', 'site', 'domain']) ||
        pickString(record, ['booking_appointment_link'])
    )
    const websiteReport =
      input.includeWebsiteAnalysis === false
        ? {
            websiteExists: Boolean(website),
            hasChat: false,
            hasOnlineBooking: false,
            weakSignals: [],
          }
        : await analyzeWebsiteWeakness(website)
    const lowerNiche = niche.toLowerCase()
    const displayName =
      pickString(record, ['name', 'name_for_emails']) ||
      pickString(record, ['owner_title']) ||
      null
    const languageSignal =
      /spanish|immigration/.test(lowerNiche) ||
      /hispan|latino|espanol/i.test(
        `${displayName || ''} ${pickString(record, ['category', 'type']) || ''}`
      )
        ? 'spanish'
        : 'english'
    const websiteWeakness = websiteReport.weakSignals
    const needsBooking =
      /barber|salon|daycare|tax|immigration|auto repair|restaurant|food truck/.test(lowerNiche)
    const category =
      /spanish|immigration/.test(lowerNiche)
        ? 'spanish_business'
        : !websiteReport.websiteExists || websiteWeakness.length >= 4
          ? 'website_upgrade'
          : needsBooking && !websiteReport.hasOnlineBooking
            ? 'appointment_booking'
            : !websiteReport.hasChat
              ? 'ai_receptionist'
              : 'small_business'

    const rating = pickNumber(record, ['rating'])
    const reviewCount = pickNumber(record, ['reviews', 'reviews_count'])
    const address =
      pickString(record, ['full_address', 'address']) ||
      [pickString(record, ['street']), pickString(record, ['city']), pickString(record, ['state'])]
        .filter(Boolean)
        .join(', ') ||
      null
    const emailCandidates = pickEmailCandidates(record)

    normalizedLeads.push({
      leadType: 'google_places',
      source: 'outscraper_google_maps_businesses',
      sourceUrl:
        pickString(record, ['location_link']) ||
        (pickString(record, ['place_id']) ? `https://www.google.com/maps/place/?q=place_id:${pickString(record, ['place_id'])}` : null),
      category,
      externalId: pickString(record, ['place_id', 'google_id', 'cid']),
      name: displayName,
      businessName: displayName,
      propertyAddress: address,
      mailingAddress: address,
      phone: normalizePhone(pickString(record, ['phone', 'phone_1', 'phone_2'])),
      email: emailCandidates[0] || null,
      website,
      city: pickString(record, ['city']) || input.city,
      state: pickString(record, ['state_code', 'state']) || input.state || null,
      zip: pickString(record, ['postal_code']),
      languageSignal,
      painSignal:
        websiteWeakness.length > 0
          ? websiteWeakness.join('; ')
          : `Potential ${niche} lead in ${input.city}`,
      contactInfo: {
        rating,
        reviewCount,
        businessType: pickString(record, ['type', 'category']),
        outscraperEmailCandidates: emailCandidates,
      },
      formData: {
        placeId: pickString(record, ['place_id']),
        googleId: pickString(record, ['google_id']),
        cid: pickString(record, ['cid']),
        rating,
        reviewCount,
        category: pickString(record, ['category']),
        type: pickString(record, ['type']),
      },
      metadata: {
        provider: 'outscraper',
        query,
        niche,
        locationLink: pickString(record, ['location_link']),
        reviewsLink: pickString(record, ['reviews_link', 'location_reviews_link']),
        category: pickString(record, ['category']),
        type: pickString(record, ['type']),
        subtypes: record.subtypes || [],
        rating,
        reviewCount,
        verified: record.verified || null,
        websiteAnalysis: websiteReport,
        needsBooking,
        urbanMarket: true,
      },
    })
  }

  return normalizedLeads
}
