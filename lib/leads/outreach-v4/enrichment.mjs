import { normalizeEmail, normalizeText, websiteHost } from './utils.mjs'

const HUNTER_API_BASE = 'https://api.hunter.io/v2'
const GENERIC_INBOX_RE = /^(contact|info|hello|sales|support|office|team|lending|acquisitions)@/i

function isUsableEmail(value) {
  const email = normalizeEmail(value)
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(email) &&
    !/(example\.com|domain\.com|facebook\.com|instagram\.com|linkedin\.com|sentry\.io|wixpress\.com)/i.test(email) &&
    !/^(noreply|no-reply|donotreply|postmaster)@/i.test(email)
}

function scoreHunterCandidate(candidate) {
  let score = Math.max(1, Math.min(20, Math.round(Number(candidate.confidence || 0) / 5)))
  if (candidate.verificationStatus === 'valid') score += 8
  if (candidate.verificationStatus === 'accept_all') score += 3
  if (GENERIC_INBOX_RE.test(candidate.email)) score += 8
  if (candidate.department && /(sales|business|partnership|operations|owner)/i.test(candidate.department)) score += 3
  if (candidate.position && /(owner|founder|manager|director|sales|operations|business development)/i.test(candidate.position)) score += 4
  if (candidate.verificationStatus === 'invalid') score -= 12
  return score
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeHunterErrorReason(error) {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  const combined = [name, message].filter(Boolean).join(': ')

  if (/AbortError/i.test(name) || /timeout/i.test(combined)) return 'hunter_timeout'
  if (/fetch failed/i.test(combined)) return 'hunter_fetch_failed'
  if (/ENOTFOUND/i.test(combined)) return 'hunter_dns_error'
  if (/ECONNRESET/i.test(combined)) return 'hunter_conn_reset'
  if (/ETIMEDOUT/i.test(combined)) return 'hunter_tcp_timeout'
  if (/EAI_AGAIN/i.test(combined)) return 'hunter_dns_retry'
  return `hunter_error:${message || 'unknown'}`
}

async function hunterDomainSearch(domain, timeoutMs) {
  const apiKey = normalizeText(process.env.HUNTER_API_KEY)
  if (!apiKey) {
    return {
      status: 'skipped',
      reason: 'missing_HUNTER_API_KEY',
      candidates: [],
    }
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    domain,
    limit: '10',
  })

  const url = `${HUNTER_API_BASE}/domain-search?${params.toString()}`

  async function runFetch() {
    return fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'VestBlockV4LeadAudit/1.0 (+https://www.vestblock.io)',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  }

  try {
    let response
    try {
      response = await runFetch()
    } catch (error) {
      const reason = normalizeHunterErrorReason(error)
      const isRetryable = reason !== 'hunter_timeout'
      if (!isRetryable) throw error
      await sleep(350)
      response = await runFetch()
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        status: 'error',
        reason: `hunter_http_${response.status}`,
        candidates: [],
      }
    }

    const candidates = (payload?.data?.emails || [])
      .map((item) => {
        const email = normalizeEmail(item.value)
        if (!isUsableEmail(email)) return null
        const candidate = {
          email,
          fullName: [item.first_name, item.last_name].filter(Boolean).join(' ') || null,
          position: item.position || null,
          department: item.department || null,
          confidence: Number(item.confidence || 0),
          verificationStatus: item.verification?.status || null,
          sourceUrls: Array.isArray(item.sources)
            ? item.sources.map((source) => normalizeText(source.uri)).filter(Boolean).slice(0, 5)
            : [],
        }
        return { ...candidate, score: scoreHunterCandidate(candidate) }
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)

    return {
      status: candidates.length ? 'found' : 'not_found',
      reason: candidates.length ? `hunter_found_${candidates.length}` : 'hunter_no_usable_email',
      candidates,
    }
  } catch (error) {
    return {
      status: 'error',
      reason: normalizeHunterErrorReason(error),
      candidates: [],
    }
  }
}

export async function enrichMissingEmailsV4(leads, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 25
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 12000
  const concurrency = Math.max(1, Math.min(6, Number.isFinite(options.concurrency) ? options.concurrency : 4))
  const priorityVerticals = Array.isArray(options.priorityVerticals) ? options.priorityVerticals.filter(Boolean) : []
  const priorityIndex = new Map(priorityVerticals.map((vertical, index) => [String(vertical), index]))
  const enriched = [...leads]
  const events = []
  let checked = 0
  const pending = []

  for (const [index, lead] of leads.entries()) {
    if (lead.email || checked >= limit) continue

    const domain = websiteHost(lead.website)
    if (!domain) {
      events.push({
        leadId: lead.id,
        businessName: lead.businessName,
        status: 'skipped',
        reason: 'missing_domain',
      })
      continue
    }

    checked += 1
    pending.push({ index, lead, domain })
  }

  if (priorityIndex.size) {
    pending.sort((left, right) => {
      const leftRank = priorityIndex.has(left.lead.vertical) ? priorityIndex.get(left.lead.vertical) : 999
      const rightRank = priorityIndex.has(right.lead.vertical) ? priorityIndex.get(right.lead.vertical) : 999
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.index - right.index
    })
  }

  for (let offset = 0; offset < pending.length; offset += concurrency) {
    const batch = pending.slice(offset, offset + concurrency)
    const results = await Promise.all(batch.map(async ({ index, lead, domain }) => ({
      index,
      lead,
      domain,
      result: await hunterDomainSearch(domain, timeoutMs),
    })))

    for (const { index, lead, domain, result } of results) {
      const candidate = result.candidates[0] || null
      if (!candidate) {
        enriched[index] = {
          ...lead,
          metadata: {
            ...(lead.metadata || {}),
            v4EmailEnrichment: {
              provider: 'hunter',
              status: result.status,
              reason: result.reason,
              checkedAt: new Date().toISOString(),
            },
          },
        }
        events.push({
          leadId: lead.id,
          businessName: lead.businessName,
          domain,
          status: result.status,
          reason: result.reason,
        })
        continue
      }

      enriched[index] = {
        ...lead,
        email: candidate.email,
        evidence: Array.from(new Set([...(lead.evidence || []), 'hunter_email_found', `hunter_${candidate.verificationStatus || 'verification_unknown'}`])),
        contactPaths: Array.from(new Set([...(lead.contactPaths || []), 'email'])),
        metadata: {
          ...(lead.metadata || {}),
          v4EmailEnrichment: {
            provider: 'hunter',
            status: 'found',
            reason: result.reason,
            checkedAt: new Date().toISOString(),
            selectedEmail: candidate.email,
            verificationStatus: candidate.verificationStatus,
            confidence: candidate.confidence,
            score: candidate.score,
            sourceUrls: candidate.sourceUrls,
          },
        },
      }
      events.push({
        leadId: lead.id,
        businessName: lead.businessName,
        domain,
        status: 'found',
        email: candidate.email,
        verificationStatus: candidate.verificationStatus,
        confidence: candidate.confidence,
        score: candidate.score,
      })
    }
  }

  return {
    leads: enriched,
    events,
    checked,
    found: events.filter((event) => event.status === 'found').length,
    skipped: events.filter((event) => event.status === 'skipped').length,
    failedOrNotFound: events.filter((event) => !['found', 'skipped'].includes(event.status)).length,
  }
}
