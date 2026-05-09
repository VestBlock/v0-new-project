import { createHash } from 'node:crypto'
import { parsePdfBuffer } from '@/lib/pdf/parse'
import type { SamOpportunitySearchInput } from '@/lib/sam/types'

type JsonObject = Record<string, any>

const samResponseCache = new Map<string, { expiresAt: number; value: unknown }>()

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getCacheTtlMs() {
  return envInt('SAM_API_CACHE_TTL_SECONDS', 900) * 1000
}

function getRetryLimit() {
  return envInt('SAM_API_RETRY_LIMIT', 3)
}

function getSamApiKey() {
  const key = process.env.SAM_GOV_API_KEY
  if (!key) {
    throw new Error('SAM_GOV_API_KEY is not configured.')
  }
  return key
}

function toMmDdYyyy(value: string) {
  if (!value) return value
  if (value.includes('/')) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
}

function withApiKey(url: string, apiKey: string) {
  const nextUrl = new URL(url)
  if (!nextUrl.searchParams.get('api_key')) {
    nextUrl.searchParams.set('api_key', apiKey)
  }
  return nextUrl.toString()
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchSamJson<T>(url: string, label: string, options?: { cacheTtlMs?: number }) {
  const cacheKey = `${label}:${url}`
  const cached = samResponseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < getRetryLimit(); attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'VestBlock Government Intelligence/1.0 (+https://www.vestblock.io)',
        },
      })

      if (response.status === 401 || response.status === 403) {
        const body = await response.text()
        throw new Error(`${label} unauthorized (${response.status}): ${body || 'Access denied.'}`)
      }

      if (response.status === 429 || response.status >= 500) {
        const body = await response.text()
        throw new Error(`${label} temporary failure (${response.status}): ${body || 'Retry later.'}`)
      }

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`${label} failed (${response.status}): ${body || 'Request failed.'}`)
      }

      const data = (await response.json()) as T
      samResponseCache.set(cacheKey, {
        expiresAt: Date.now() + (options?.cacheTtlMs ?? getCacheTtlMs()),
        value: data,
      })
      return data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < getRetryLimit() - 1) {
        await sleep((attempt + 1) * 800)
        continue
      }
    }
  }

  throw lastError || new Error(`${label} failed.`)
}

function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, T>()
  for (const row of rows) {
    map.set(keyFn(row), row)
  }
  return Array.from(map.values())
}

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(input: string, max = 4000) {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`
}

function isLikelyPdf(contentType: string, url: string) {
  return contentType.toLowerCase().includes('pdf') || url.toLowerCase().includes('.pdf')
}

async function extractResponseText(input: {
  response: Response
  sourceUrl: string
}) {
  const contentType = input.response.headers.get('content-type') || ''
  const arrayBuffer = await input.response.arrayBuffer()
  const byteLength = arrayBuffer.byteLength

  if (isLikelyPdf(contentType, input.sourceUrl)) {
    const parsed = await parsePdfBuffer(Buffer.from(arrayBuffer))
    return {
      rawText: parsed.text || '',
      contentType: contentType || 'application/pdf',
      length: byteLength,
      pageCount: parsed.numpages || null,
      info: parsed.info || null,
      metadata: parsed.metadata || null,
    }
  }

  const rawText = Buffer.from(arrayBuffer).toString('utf8')
  return {
    rawText,
    contentType,
    length: byteLength,
    pageCount: null,
    info: null,
    metadata: null,
  }
}

export async function searchSamOpportunitiesApi(input: SamOpportunitySearchInput) {
  const apiKey = getSamApiKey()
  const baseUrl = 'https://api.sam.gov/opportunities/v2/search'
  const keywords = input.keywords?.filter(Boolean).slice(0, 5) || ['']
  const naicsCodes = input.naicsCodes?.filter(Boolean).slice(0, 5) || ['']
  const maxPages = envInt('SAM_API_MAX_PAGES', 2)
  const pageLimit = Math.min(Math.max(input.limit || 25, 1), 100)
  const allRows: JsonObject[] = []

  for (const keyword of keywords) {
    for (const naicsCode of naicsCodes) {
      for (let page = 0; page < maxPages; page += 1) {
        const params = new URLSearchParams({
          api_key: apiKey,
          postedFrom: toMmDdYyyy(input.postedFrom),
          postedTo: toMmDdYyyy(input.postedTo),
          limit: String(pageLimit),
          offset: String(page * pageLimit),
        })

        if (keyword) params.set('title', keyword)
        if (naicsCode) params.set('ncode', naicsCode)
        if (input.state) params.set('state', input.state)
        if (input.zip) params.set('zip', input.zip)
        if (input.responseDeadlineFrom) params.set('rdlfrom', toMmDdYyyy(input.responseDeadlineFrom))
        if (input.responseDeadlineTo) params.set('rdlto', toMmDdYyyy(input.responseDeadlineTo))
        if (input.solicitationTypes?.length) params.set('ptype', input.solicitationTypes[0] || '')
        if (input.setAsideCodes?.length) params.set('typeOfSetAside', input.setAsideCodes[0] || '')
        if (input.organizationCodes?.length) params.set('organizationCode', input.organizationCodes[0] || '')
        if (input.agencyCodes?.length) params.set('organizationCode', input.agencyCodes[0] || '')

        const data = await fetchSamJson<{ opportunitiesData?: JsonObject[] }>(
          `${baseUrl}?${params.toString()}`,
          'SAM opportunities'
        )

        const rows = data.opportunitiesData || []
        allRows.push(...rows)
        if (rows.length < pageLimit) break
      }
    }
  }

  return dedupeByKey(allRows, (row) =>
    String(row.noticeId || row.solicitationNumber || `${row.title || 'opportunity'}:${row.postedDate || ''}`)
  )
}

export async function searchSamEntitiesApi(input: {
  ueis?: string[]
  legalBusinessNames?: string[]
  includeSections?: string[]
}) {
  const apiKey = getSamApiKey()
  const baseUrl = 'https://api.sam.gov/entity-information/v4/entities'
  const includeSections = input.includeSections?.length
    ? input.includeSections.join(',')
    : 'entityRegistration,coreData,integrityInformation'
  const terms = [
    ...(input.ueis?.filter(Boolean).map((value) => ({ key: 'ueiSAM', value })) || []),
    ...(input.legalBusinessNames?.filter(Boolean).map((value) => ({ key: 'legalBusinessName', value })) || []),
  ].slice(0, 10)

  const entities: JsonObject[] = []
  for (const term of terms) {
    const params = new URLSearchParams({
      api_key: apiKey,
      includeSections,
      [term.key]: term.value,
    })
    const data = await fetchSamJson<{ entityData?: JsonObject[] }>(
      `${baseUrl}?${params.toString()}`,
      'SAM entity management'
    )
    entities.push(...(data.entityData || []))
  }

  return dedupeByKey(entities, (row) =>
    String(row.entityRegistration?.ueiSAM || row.entityRegistration?.legalBusinessName || JSON.stringify(row).slice(0, 120))
  )
}

export async function searchSamExclusionsApi(input: {
  exclusionName?: string
  ueiSAM?: string
  classification?: string
  exclusionType?: string
  limit?: number
}) {
  const apiKey = getSamApiKey()
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(Math.min(Math.max(input.limit || 10, 1), 100)),
    offset: '0',
  })

  if (input.exclusionName) params.set('exclusionName', input.exclusionName)
  if (input.ueiSAM) params.set('ueiSAM', input.ueiSAM)
  if (input.classification) params.set('classification', input.classification)
  if (input.exclusionType) params.set('exclusionType', input.exclusionType)

  const data = await fetchSamJson<{ exclusionData?: JsonObject[] }>(
    `https://api.sam.gov/entity-information/v4/exclusions?${params.toString()}`,
    'SAM exclusions'
  )

  return data.exclusionData || []
}

export async function searchSamAssistanceListingsApi(input: {
  status?: 'Active' | 'Inactive' | 'All'
  organizationCodes?: string[]
  organizationLevel?: 'Department' | 'Agency' | 'Office'
  applicantTypes?: string[]
  beneficiaryTypes?: string[]
  assistanceTypes?: string[]
  publishedDateFrom?: string
  publishedDateTo?: string
  pageSize?: number
}) {
  const apiKey = getSamApiKey()
  const params = new URLSearchParams({
    api_key: apiKey,
    pageSize: String(Math.min(Math.max(input.pageSize || 25, 1), 1000)),
    pageNumber: '0',
    status: input.status || 'Active',
  })

  if (input.organizationCodes?.length) params.set('organizationCodes', input.organizationCodes.join(','))
  if (input.organizationLevel) params.set('organizationLevel', input.organizationLevel)
  if (input.applicantTypes?.length) params.set('applicantTypes', input.applicantTypes.join(','))
  if (input.beneficiaryTypes?.length) params.set('beneficiaryTypes', input.beneficiaryTypes.join(','))
  if (input.assistanceTypes?.length) params.set('assistanceTypes', input.assistanceTypes.join(','))
  if (input.publishedDateFrom) params.set('publishedDateFrom', input.publishedDateFrom)
  if (input.publishedDateTo) params.set('publishedDateTo', input.publishedDateTo)

  const data = await fetchSamJson<{ assistanceListingsData?: JsonObject[] }>(
    `https://api.sam.gov/assistance-listings/v1/search?${params.toString()}`,
    'SAM assistance listings'
  )

  return data.assistanceListingsData || []
}

export async function searchFederalHierarchyApi(input: {
  agencyCode?: string
  organizationName?: string
  limit?: number
}) {
  const apiKey = getSamApiKey()
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(Math.min(Math.max(input.limit || 20, 1), 100)),
  })

  if (input.agencyCode) params.set('agencycode', input.agencyCode)
  if (input.organizationName) params.set('fhorgname', input.organizationName)

  const data = await fetchSamJson<{ orglist?: JsonObject[] }>(
    `https://api.sam.gov/prod/federalorganizations/v1/orgs?${params.toString()}`,
    'SAM federal hierarchy'
  )

  return data.orglist || []
}

export async function fetchSamOpportunityDocument(input: {
  sourceUrl: string
  title?: string | null
  documentType: 'description' | 'attachment' | 'additional_info'
}) {
  const apiKey = getSamApiKey()
  const url = withApiKey(input.sourceUrl, apiKey)
  const response = await fetch(url, {
    headers: {
      accept: 'text/plain, text/html, application/json, */*',
      'user-agent': 'VestBlock Government Intelligence/1.0 (+https://www.vestblock.io)',
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Document access unauthorized (${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(`Document fetch failed (${response.status}).`)
  }

  const extracted = await extractResponseText({
    response,
    sourceUrl: input.sourceUrl,
  })
  const normalizedText =
    extracted.contentType.includes('html')
      ? stripHtml(extracted.rawText)
      : extracted.contentType.includes('json')
        ? truncate(extracted.rawText, 12000)
        : extracted.rawText
  const contentText = truncate(normalizedText, 12000)

  return {
    title: input.title || null,
    sourceUrl: input.sourceUrl,
    documentType: input.documentType,
    fetchStatus: contentText ? 'fetched' : 'skipped',
    contentText,
    contentJson: {
      contentType: extracted.contentType,
      length: extracted.length,
      pageCount: extracted.pageCount,
      info: extracted.info,
      metadata: extracted.metadata,
    },
    contentSha256: createHash('sha256').update(contentText).digest('hex'),
  }
}
