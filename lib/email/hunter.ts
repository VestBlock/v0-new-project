import { safeUrl, toTitleCase } from '@/lib/leads/utils'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'

const HUNTER_API_BASE = 'https://api.hunter.io/v2'
const FETCH_TIMEOUT_MS = 12000

type HunterDomainSearchResponse = {
  data?: {
    domain?: string | null
    organization?: string | null
    pattern?: string | null
    emails?: HunterEmailRecord[]
  }
  errors?: Array<{ details?: string; id?: string; code?: string }>
}

type HunterEmailRecord = {
  value?: string | null
  type?: string | null
  confidence?: number | null
  first_name?: string | null
  last_name?: string | null
  position?: string | null
  department?: string | null
  seniority?: string | null
  verification?: {
    status?: string | null
  } | null
  sources?: Array<{
    uri?: string | null
  }> | null
}

export type HunterContactCandidate = {
  email: string
  fullName: string | null
  position: string | null
  department: string | null
  seniority: string | null
  confidence: number
  verificationStatus: string | null
  score: number
  sourceUrls: string[]
}

export type HunterContactLookupResult = {
  status: 'found' | 'not_found' | 'skipped' | 'error'
  domain: string | null
  organization: string | null
  pattern: string | null
  note: string
  primaryCandidate: HunterContactCandidate | null
  candidates: HunterContactCandidate[]
}

function getHunterApiKey() {
  return process.env.HUNTER_API_KEY?.trim() || ''
}

function extractDomain(website?: string | null) {
  const normalized = safeUrl(website)
  if (!normalized) return null

  try {
    return new URL(normalized).host.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function titleCaseName(firstName?: string | null, lastName?: string | null) {
  const fullName = [firstName, lastName]
    .map((value) => toTitleCase(value))
    .filter(Boolean)
    .join(' ')

  return fullName || null
}

function normalizeNameTokens(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2)
}

function isGenericBusinessInbox(email: string) {
  return /^(contact|info|hello|sales|support|office|team|lending|acquisitions)@/i.test(email)
}

function scoreHunterCandidate(
  candidate: Omit<HunterContactCandidate, 'score'>,
  options: {
    requestedName?: string | null
    preferGenericInbox?: boolean
  } = {}
) {
  let score = Math.max(1, Math.min(20, Math.round(candidate.confidence / 5)))
  const localPart = candidate.email.split('@')[0] || ''
  const isGenericInbox = isGenericBusinessInbox(candidate.email)

  if (candidate.verificationStatus === 'valid') score += 8
  else if (candidate.verificationStatus === 'accept_all') score += 3
  else if (candidate.verificationStatus === 'invalid') score -= 10

  if (isGenericInbox) {
    score += 4
  }

  if (options.preferGenericInbox && isGenericInbox) score += 8

  if (candidate.department && /(sales|business|partnership|acquisition|lending|operations|investor)/i.test(candidate.department)) {
    score += 4
  }

  if (candidate.position && /(sales|partner|acquisition|lender|loan|business development|director|manager|owner|founder)/i.test(candidate.position)) {
    score += 5
  }

  if (candidate.fullName && options.requestedName) {
    const requestedTokens = normalizeNameTokens(options.requestedName)
    const candidateTokens = normalizeNameTokens(candidate.fullName)
    if (requestedTokens.length && requestedTokens.every((token) => candidateTokens.includes(token))) {
      score += 12
    }
  }

  if (!candidate.fullName && !isGenericInbox) {
    score -= 2
  }

  if (candidate.sourceUrls.length >= 2) score += 2
  if (/noreply|donotreply|postmaster/i.test(localPart)) score -= 12

  return score
}

async function fetchHunterDomainSearch(domain: string) {
  const apiKey = getHunterApiKey()
  if (!apiKey) {
    return {
      status: 'skipped',
      domain,
      organization: null,
      pattern: null,
      note: 'Hunter API key is not configured.',
      primaryCandidate: null,
      candidates: [],
    } satisfies HunterContactLookupResult
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      domain,
      limit: '10',
    })

    const response = await fetch(`${HUNTER_API_BASE}/domain-search?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)',
      },
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as HunterDomainSearchResponse | null
    if (!response.ok) {
      const detail =
        payload?.errors?.map((item) => item.details || item.code || item.id).filter(Boolean).join('; ') ||
        `Hunter request failed with ${response.status}.`

      return {
        status: response.status === 401 || response.status === 402 || response.status === 429 ? 'error' : 'not_found',
        domain,
        organization: null,
        pattern: null,
        note: detail,
        primaryCandidate: null,
        candidates: [],
      } satisfies HunterContactLookupResult
    }

    const emails = (payload?.data?.emails || [])
      .map((item) => {
        const email = normalizeEmailAddress(item.value)
        if (!isUsableContactEmail(email)) return null

        const candidateBase = {
          email,
          fullName: titleCaseName(item.first_name, item.last_name),
          position: item.position?.trim() || null,
          department: item.department?.trim() || null,
          seniority: item.seniority?.trim() || null,
          confidence: Number.isFinite(item.confidence) ? Number(item.confidence) : 0,
          verificationStatus: item.verification?.status?.trim() || null,
          sourceUrls: Array.from(
            new Set((item.sources || []).map((source) => source.uri?.trim() || '').filter(Boolean))
          ),
        }

        return {
          ...candidateBase,
          score: scoreHunterCandidate(candidateBase),
        } satisfies HunterContactCandidate
      })
      .filter((item): item is HunterContactCandidate => Boolean(item))
      .sort((a, b) => b.score - a.score)

    return {
      status: emails.length ? 'found' : 'not_found',
      domain,
      organization: payload?.data?.organization?.trim() || null,
      pattern: payload?.data?.pattern?.trim() || null,
      note: emails.length
        ? `Hunter found ${emails.length} usable contact candidate(s) for ${domain}.`
        : `Hunter found no usable contact emails for ${domain}.`,
      primaryCandidate: emails[0] || null,
      candidates: emails,
    } satisfies HunterContactLookupResult
  } catch (error) {
    return {
      status: 'error',
      domain,
      organization: null,
      pattern: null,
      note: error instanceof Error ? error.message : 'Hunter lookup failed.',
      primaryCandidate: null,
      candidates: [],
    } satisfies HunterContactLookupResult
  } finally {
    clearTimeout(timeout)
  }
}

export async function enrichContactFromHunter(input: {
  website?: string | null
  contactName?: string | null
  preferGenericInbox?: boolean
}) {
  const domain = extractDomain(input.website)
  if (!domain) {
    return {
      status: 'skipped',
      domain: null,
      organization: null,
      pattern: null,
      note: 'No valid company website/domain available for Hunter enrichment.',
      primaryCandidate: null,
      candidates: [],
    } satisfies HunterContactLookupResult
  }

  const result = await fetchHunterDomainSearch(domain)
  const rescored = result.candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreHunterCandidate(candidate, {
        requestedName: input.contactName,
        preferGenericInbox: input.preferGenericInbox,
      }),
    }))
    .sort((a, b) => b.score - a.score)

  return {
    ...result,
    primaryCandidate: rescored[0] || null,
    candidates: rescored,
  } satisfies HunterContactLookupResult
}
