import { normalizeEmail, normalizePhone, normalizeText } from './utils.mjs'

const REAL_SOURCE_VERTICALS = new Set([
  'ai_receptionist',
  'no_website',
  'weak_website',
  'contractors_home_services',
  'real_estate_partners',
])

function timeoutSignal(ms) {
  return AbortSignal.timeout(Math.max(2000, ms))
}

function safeUrl(value) {
  const raw = normalizeText(value)
  if (!raw) return null
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    return url.href
  } catch {
    return null
  }
}

function pickString(record, keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function isUsableEmail(value) {
  const email = normalizeEmail(value)
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(email) &&
    !/(example\.com|domain\.com|facebook\.com|instagram\.com|linkedin\.com)/i.test(email)
}

function extractEmailsFromHtml(html) {
  const matches = String(html || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []
  return Array.from(new Set(matches.map(normalizeEmail))).filter((email) =>
    isUsableEmail(email) &&
    !/@(sentry|wixpress|example|domain)\./i.test(email) &&
    !/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(email)
  )
}

function extractContactUrls(html, baseUrl) {
  const matches = String(html || '').match(/href=["']([^"']+)["']/gi) || []
  const urls = []
  for (const match of matches) {
    const href = match.replace(/^href=["']|["']$/gi, '').trim()
    if (!/contact|quote|estimate|schedule|book|appointment/i.test(href)) continue
    try {
      urls.push(new URL(href, baseUrl).href)
    } catch {
      // Ignore malformed links from scraped sites.
    }
  }
  return Array.from(new Set(urls)).slice(0, 5)
}

function pickEmail(record) {
  const candidates = [
    record?.email,
    record?.email_1,
    record?.email_2,
    record?.email_3,
    record?.email_4,
    ...(Array.isArray(record?.emails) ? record.emails : []),
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const match = candidate.split(/[,\s;]+/).find(isUsableEmail)
      if (match) return normalizeEmail(match)
    }
    if (candidate && typeof candidate === 'object' && isUsableEmail(candidate.email)) {
      return normalizeEmail(candidate.email)
    }
  }
  return null
}

async function lightweightWebsiteAudit(website, timeoutMs) {
  const url = safeUrl(website)
  if (!url) {
    return {
      websiteExists: false,
      hasChat: false,
      hasOnlineBooking: false,
      hasClearCta: false,
      hasContactSignals: false,
      weakSignals: ['no_website_listed'],
    }
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: timeoutSignal(timeoutMs),
      headers: {
        'user-agent': 'VestBlockV4LeadAudit/1.0 (+https://www.vestblock.io)',
      },
    })
    const html = await response.text()
    const lower = html.toLowerCase()
    const hasChat = /chat|intercom|drift|tawk|zendesk|botpress|livechat/.test(lower)
    const hasOnlineBooking = /book online|schedule|appointment|calendly|acuity|booking/.test(lower)
    const hasClearCta = /contact|call|quote|estimate|schedule|book|request/.test(lower)
    const hasContactSignals = /mailto:|tel:|contact/.test(lower)
    const hasTrustSignals = /review|testimonial|licensed|insured|case study|gallery|before/.test(lower)
    const emails = extractEmailsFromHtml(html)
    const contactUrls = extractContactUrls(html, url)
    const weakSignals = [
      response.ok ? null : `website_http_${response.status}`,
      !hasChat ? 'missing_chat_or_receptionist' : null,
      !hasOnlineBooking ? 'missing_online_booking' : null,
      !hasClearCta ? 'missing_clear_cta' : null,
      !hasContactSignals ? 'weak_contact_path' : null,
      !hasTrustSignals ? 'weak_trust_signals' : null,
    ].filter(Boolean)

    return {
      websiteExists: response.ok,
      hasChat,
      hasOnlineBooking,
      hasClearCta,
      hasContactSignals,
      hasTrustSignals,
      emails,
      contactUrls,
      weakSignals,
    }
  } catch (error) {
    return {
      websiteExists: false,
      hasChat: false,
      hasOnlineBooking: false,
      hasClearCta: false,
      hasContactSignals: false,
      weakSignals: ['website_unreachable'],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function normalizeOutscraperPayload(payload, niches, queries) {
  const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
  if (!Array.isArray(data)) return []

  const rows = []
  for (const [index, value] of data.entries()) {
    if (Array.isArray(value)) {
      for (const record of value) {
        if (record && typeof record === 'object') {
          rows.push({ record, niche: niches[index] || niches[0], query: queries[index] || queries[0] })
        }
      }
      continue
    }
    if (value && typeof value === 'object') {
      rows.push({ record: value, niche: niches[0], query: queries[0] })
    }
  }
  return rows
}

async function searchOutscraper({ vertical, market, niches, limitPerNiche, timeoutMs, websiteAuditLimit }) {
  const apiKey = normalizeText(process.env.OUTSCRAPER_API_KEY)
  if (!apiKey) return { provider: 'outscraper', ok: false, skipped: true, reason: 'missing_OUTSCRAPER_API_KEY', leads: [] }

  const queries = niches.map((niche) => `${niche} ${market.city} ${market.state} usa`)
  let response
  try {
    response = await fetch('https://api.app.outscraper.com/maps/search-v3', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-API-KEY': apiKey.replace(/[\r\n\t]/g, ''),
      },
      body: JSON.stringify({
        query: queries,
        limit: limitPerNiche,
        language: 'en',
        region: 'us',
        async: false,
      }),
      signal: timeoutSignal(timeoutMs),
    })
  } catch (error) {
    return {
      provider: 'outscraper',
      ok: false,
      reason: `outscraper_fetch_failed:${error instanceof Error ? error.message : String(error)}`.slice(0, 180),
      leads: [],
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { provider: 'outscraper', ok: false, reason: `outscraper_http_${response.status}:${text.slice(0, 120)}`, leads: [] }
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    return {
      provider: 'outscraper',
      ok: false,
      reason: `outscraper_invalid_json:${error instanceof Error ? error.message : String(error)}`.slice(0, 180),
      leads: [],
    }
  }
  const rows = normalizeOutscraperPayload(payload, niches, queries)
  const leads = []
  for (const [index, { record, niche, query }] of rows.entries()) {
    const name = pickString(record, ['name', 'name_for_emails'])
    if (!name) continue
    const website = safeUrl(pickString(record, ['website', 'site', 'domain']))
    const audit = index < websiteAuditLimit ? await lightweightWebsiteAudit(website, 4500) : { websiteExists: Boolean(website), weakSignals: ['website_audit_deferred'] }
    const providerEmail = pickEmail(record)
    const email = providerEmail || audit.emails?.[0] || null
    const weakSignals = Array.isArray(audit.weakSignals) ? audit.weakSignals : []
    const noWebsite = !website || audit.websiteExists === false
    const sourceUrl = pickString(record, ['location_link']) ||
      (pickString(record, ['place_id']) ? `https://www.google.com/maps/place/?q=place_id:${pickString(record, ['place_id'])}` : null)

    leads.push({
      id: `v4_real_outscraper_${vertical.id}_${pickString(record, ['place_id', 'google_id', 'cid']) || `${market.marketKey}_${index}`}`,
      scrapedAt: new Date().toISOString(),
      source: `outreach_v4_${vertical.id}_outscraper`,
      sourceType: 'real_provider_dry_run',
      sourceUrl,
      vertical: vertical.id,
      verticalLabel: vertical.label,
      businessName: name,
      propertyAddress: pickString(record, ['full_address', 'address']),
      website,
      email,
      phone: normalizePhone(pickString(record, ['phone', 'phone_1', 'phone_2'])),
      city: pickString(record, ['city']) || market.city,
      state: pickString(record, ['state_code', 'state']) || market.state,
      niche,
      serviceFit: vertical.offer,
      painSignal: weakSignals.length ? weakSignals.join('; ') : `${niche} lead in ${market.city}`,
      outreachAngle: noWebsite
        ? 'Business appears to have no working website or web presence.'
        : weakSignals.includes('missing_chat_or_receptionist')
          ? 'Website appears to lack a visible chat or AI receptionist handoff.'
          : 'Local service business may fit lead-capture and visibility support.',
      evidence: [
        noWebsite ? 'no_or_unreachable_website' : null,
        ...weakSignals,
        providerEmail ? 'provider_email_found' : null,
        !providerEmail && audit.emails?.[0] ? 'website_email_found' : null,
        email ? 'public_email_found' : 'email_missing_from_provider_and_site',
      ].filter(Boolean),
      confidenceScore: 70 + Math.min(20, (pickNumber(record, ['reviews', 'reviews_count']) || 0) > 10 ? 10 : 0),
      homeownerContact: false,
      contactPaths: [
        website ? 'website' : null,
        email ? 'email' : null,
        pickString(record, ['phone', 'phone_1', 'phone_2']) ? 'phone' : null,
        ...(audit.contactUrls?.length ? ['contact_form'] : []),
      ].filter(Boolean),
      metadata: {
        provider: 'outscraper',
        query,
        marketKey: market.marketKey,
        selectedReason: market.selectedReason,
        rating: pickNumber(record, ['rating']),
        reviewCount: pickNumber(record, ['reviews', 'reviews_count']),
        websiteAudit: audit,
        websiteEmailFound: audit.emails?.[0] || null,
        contactUrls: audit.contactUrls || [],
        realSourceDryRun: true,
      },
    })
  }

  return { provider: 'outscraper', ok: true, leads }
}

async function searchGooglePlaces({ vertical, market, niches, limitPerNiche, timeoutMs, websiteAuditLimit }) {
  const apiKey = normalizeText(process.env.GOOGLE_PLACES_API_KEY)
  if (!apiKey) return { provider: 'google_places', ok: false, skipped: true, reason: 'missing_GOOGLE_PLACES_API_KEY', leads: [] }

  const leads = []
  for (const niche of niches) {
    const query = `${niche} in ${market.city}, ${market.state}`
    let response
    try {
      response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.types',
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: limitPerNiche,
          languageCode: 'en',
          regionCode: 'US',
        }),
        signal: timeoutSignal(timeoutMs),
      })
    } catch (error) {
      return {
        provider: 'google_places',
        ok: false,
        reason: `google_places_fetch_failed:${error instanceof Error ? error.message : String(error)}`.slice(0, 180),
        leads,
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { provider: 'google_places', ok: false, reason: `google_places_http_${response.status}:${text.slice(0, 120)}`, leads }
    }

    let payload
    try {
      payload = await response.json()
    } catch (error) {
      return {
        provider: 'google_places',
        ok: false,
        reason: `google_places_invalid_json:${error instanceof Error ? error.message : String(error)}`.slice(0, 180),
        leads,
      }
    }
    for (const [index, place] of (payload.places || []).entries()) {
      const name = place.displayName?.text
      if (!name) continue
      const website = safeUrl(place.websiteUri)
      const audit = leads.length < websiteAuditLimit ? await lightweightWebsiteAudit(website, 4500) : { websiteExists: Boolean(website), weakSignals: ['website_audit_deferred'] }
      const email = audit.emails?.[0] || null
      const weakSignals = Array.isArray(audit.weakSignals) ? audit.weakSignals : []
      const noWebsite = !website || audit.websiteExists === false

      leads.push({
        id: `v4_real_google_${vertical.id}_${place.id || `${market.marketKey}_${index}`}`,
        scrapedAt: new Date().toISOString(),
        source: `outreach_v4_${vertical.id}_google_places`,
        sourceType: 'real_provider_dry_run',
        sourceUrl: place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null,
        vertical: vertical.id,
        verticalLabel: vertical.label,
        businessName: name,
        propertyAddress: place.formattedAddress || null,
        website,
        email,
        phone: normalizePhone(place.nationalPhoneNumber),
        city: market.city,
        state: market.state,
        niche,
        serviceFit: vertical.offer,
        painSignal: weakSignals.length ? weakSignals.join('; ') : `${niche} lead in ${market.city}`,
        outreachAngle: noWebsite
          ? 'Business appears to have no working website or web presence.'
          : weakSignals.includes('missing_chat_or_receptionist')
            ? 'Website appears to lack a visible chat or AI receptionist handoff.'
            : 'Local service business may fit lead-capture and visibility support.',
        evidence: [
          noWebsite ? 'no_or_unreachable_website' : null,
          ...weakSignals,
          email ? 'website_email_found' : 'email_not_available_from_google_places_or_site',
        ].filter(Boolean),
        confidenceScore: 64 + Math.min(18, (place.userRatingCount || 0) > 10 ? 8 : 0),
        homeownerContact: false,
        contactPaths: [
          website ? 'website' : null,
          email ? 'email' : null,
          place.nationalPhoneNumber ? 'phone' : null,
          ...(audit.contactUrls?.length ? ['contact_form'] : []),
        ].filter(Boolean),
        metadata: {
          provider: 'google_places',
          query,
          marketKey: market.marketKey,
          selectedReason: market.selectedReason,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          primaryType: place.primaryType || null,
          websiteAudit: audit,
          websiteEmailFound: email,
          contactUrls: audit.contactUrls || [],
          realSourceDryRun: true,
        },
      })
    }
  }

  return { provider: 'google_places', ok: true, leads }
}

function filterForVertical(verticalId, leads) {
  if (verticalId === 'no_website') {
    return leads.filter((lead) => lead.evidence.includes('no_or_unreachable_website'))
  }
  if (verticalId === 'weak_website') {
    return leads.filter((lead) =>
      lead.evidence.some((signal) =>
        ['missing_clear_cta', 'weak_contact_path', 'weak_trust_signals', 'missing_online_booking', 'website_unreachable'].includes(signal)
      )
    )
  }
  if (verticalId === 'ai_receptionist') {
    return leads.filter((lead) =>
      lead.evidence.some((signal) => ['missing_chat_or_receptionist', 'missing_online_booking', 'weak_contact_path'].includes(signal))
    )
  }
  return leads
}

export async function runRealSourceAdapterV4(verticalPlan, options = {}) {
  if (!REAL_SOURCE_VERTICALS.has(verticalPlan.verticalId)) {
    return {
      verticalId: verticalPlan.verticalId,
      label: verticalPlan.label,
      provider: 'none',
      ok: true,
      skipped: true,
      reason: 'vertical_not_enabled_for_first_real_adapter',
      rawFound: 0,
      leads: [],
      attempts: [],
    }
  }

  const vertical = {
    id: verticalPlan.verticalId,
    label: verticalPlan.label,
    offer: verticalPlan.verticalId === 'real_estate_partners'
      ? 'Real Estate Partnership Network'
      : verticalPlan.verticalId === 'contractors_home_services'
        ? 'Real Estate Contractor Referral Partners'
        : verticalPlan.verticalId === 'no_website'
          ? 'Website + AI Receptionist Starter'
          : verticalPlan.verticalId === 'weak_website'
            ? 'Website Upgrade Sprint'
            : 'AI Receptionist Launch',
  }
  const providerPreference = normalizeText(options.provider || 'auto')
  const limitPerNiche = Number.isFinite(options.limitPerNiche) ? options.limitPerNiche : 3
  const nicheLimit = Number.isFinite(options.nicheLimit) ? options.nicheLimit : 2
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 25000
  const websiteAuditLimit = Number.isFinite(options.websiteAuditLimit) ? options.websiteAuditLimit : 4
  const attempts = []
  const leads = []

  for (const market of verticalPlan.markets) {
    const input = {
      vertical,
      market,
      niches: verticalPlan.niches.slice(0, nicheLimit),
      limitPerNiche,
      timeoutMs,
      websiteAuditLimit,
    }
    const providers = providerPreference === 'auto'
      ? ['google_places', 'outscraper']
      : [providerPreference]

    for (const provider of providers) {
      const result = provider === 'google_places'
        ? await searchGooglePlaces(input)
        : await searchOutscraper(input)
      attempts.push({
        market: `${market.city}, ${market.state}`,
        provider: result.provider,
        ok: result.ok,
        skipped: Boolean(result.skipped),
        reason: result.reason || null,
        rawFound: result.leads.length,
      })
      if (result.ok && result.leads.length) {
        leads.push(...filterForVertical(verticalPlan.verticalId, result.leads))
        break
      }
    }
  }

  return {
    verticalId: verticalPlan.verticalId,
    label: verticalPlan.label,
    provider: providerPreference,
    ok: attempts.some((attempt) => attempt.ok),
    rawFound: leads.length,
    leads,
    attempts,
  }
}
