export const DEALMACHINE_V2_BASE_URL = 'https://api.v2.dealmachine.com/v1'

const DEFAULT_TIMEOUT_MS = 30_000
const EXPORT_TIMEOUT_MS = 120_000
const MIN_REQUEST_INTERVAL_MS = 1_050
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanPath(path) {
  const value = String(path || '').trim()
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

function safeJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function errorDetail(payload, text) {
  return String(
    payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      text ||
      'Unknown DealMachine API error'
  ).slice(0, 500)
}

function retryAfterMs(response, attempt) {
  const raw = response.headers.get('retry-after')
  if (raw) {
    const seconds = Number(raw)
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000)
    const date = Date.parse(raw)
    if (Number.isFinite(date)) return Math.max(1_000, date - Date.now())
  }
  return Math.min(30_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 250)
}

function normalizeDownloadUrls(payload) {
  const candidates = payload?.download_urls || payload?.data?.download_urls || []
  return (Array.isArray(candidates) ? candidates : [])
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return { filename: `dealmachine-export-${index + 1}.csv.gz`, url: entry, size: null }
      }
      if (!entry || typeof entry !== 'object') return null
      const url = String(entry.url || '').trim()
      if (!url) return null
      return {
        filename: String(entry.filename || `dealmachine-export-${index + 1}.csv.gz`),
        url,
        size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : null,
      }
    })
    .filter(Boolean)
}

export class DealMachineApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'DealMachineApiError'
    this.status = options.status || null
    this.code = options.code || null
    this.requestId = options.requestId || null
    this.retryable = Boolean(options.retryable)
    this.details = options.details || null
  }
}

export function dealMachineApiKey(env = process.env) {
  return String(env.DEALMACHINE_API_KEY || env.DEALMACHINE_API_TOKEN || '').trim()
}

export function isDealMachineCredentialFormat(value) {
  return /^dm_(?:sk|at)_live_\S+$/.test(String(value || '').trim())
}

export function hasDealMachineCredentials(env = process.env) {
  return isDealMachineCredentialFormat(dealMachineApiKey(env))
}

export function createDealMachineV2Client(options = {}) {
  const apiKey = String(options.apiKey || dealMachineApiKey()).trim()
  const baseUrl = String(options.baseUrl || DEALMACHINE_V2_BASE_URL).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const maxRetries = Math.max(0, Math.min(6, Number(options.maxRetries ?? 4)))
  const minRequestIntervalMs = Math.max(0, Number(options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS))
  const userAgent = String(options.userAgent || 'VestBlock DealMachine v2/2.0 (+https://vestblock.io)')
  let lastRequestAt = 0
  let rateLimit = null
  let pacingChain = Promise.resolve()

  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.')

  function pace() {
    const turn = pacingChain.then(async () => {
      const waitMs = minRequestIntervalMs - (Date.now() - lastRequestAt)
      if (waitMs > 0) await sleep(waitMs)
      lastRequestAt = Date.now()
    })
    pacingChain = turn.catch(() => undefined)
    return turn
  }

  async function request(path, requestOptions = {}) {
    if (!isDealMachineCredentialFormat(apiKey)) {
      throw new DealMachineApiError('DEALMACHINE_API_KEY must be a full official dm_sk_live_* or dm_at_live_* credential.', {
        code: apiKey ? 'invalid_api_key_format' : 'missing_api_key',
      })
    }

    const method = String(requestOptions.method || 'GET').toUpperCase()
    const timeoutMs = Math.max(
      1_000,
      Number(requestOptions.timeoutMs || (cleanPath(path).includes('/export') ? EXPORT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS))
    )
    const url = new URL(`${baseUrl}${cleanPath(path)}`)
    for (const [key, value] of Object.entries(requestOptions.query || {})) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await pace()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(url, {
          method,
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'user-agent': userAgent,
            ...requestOptions.headers,
          },
          body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timer)

        rateLimit = {
          limit: Number(response.headers.get('x-ratelimit-limit')) || null,
          remaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
          reset: response.headers.get('x-ratelimit-reset') || null,
        }
        const text = await response.text()
        const payload = safeJson(text)
        if (response.ok && !payload?.error) return payload

        const retryable = RETRYABLE_STATUS_CODES.has(response.status)
        if (retryable && attempt < maxRetries) {
          await sleep(retryAfterMs(response, attempt))
          continue
        }
        throw new DealMachineApiError(
          `DealMachine v2 HTTP ${response.status}: ${errorDetail(payload, text)}`,
          {
            status: response.status,
            code: payload?.error?.code || null,
            requestId: payload?.error?.request_id || response.headers.get('x-request-id') || null,
            retryable,
            details: payload?.error?.details || null,
          }
        )
      } catch (error) {
        clearTimeout(timer)
        const aborted = error?.name === 'AbortError'
        if ((aborted || error instanceof TypeError) && attempt < maxRetries) {
          await sleep(Math.min(30_000, 1_000 * 2 ** attempt))
          continue
        }
        if (aborted) {
          throw new DealMachineApiError(`DealMachine v2 request timed out after ${timeoutMs}ms.`, {
            code: 'request_timeout',
            retryable: true,
          })
        }
        throw error
      }
    }
    throw new DealMachineApiError('DealMachine v2 request failed after retries.', {
      code: 'retry_exhausted',
      retryable: true,
    })
  }

  async function collect(path, query = {}) {
    const rows = []
    let page = 1
    while (page <= 100) {
      const payload = await request(path, { query: { ...query, page, per_page: 250 } })
      rows.push(...(Array.isArray(payload?.data) ? payload.data : []))
      if (!payload?.pagination?.has_next_page && page >= Number(payload?.pagination?.total_pages || page)) break
      page += 1
    }
    return rows
  }

  async function resolveCity(city, state) {
    const payload = await request('/locations', {
      query: { q: city, type: 'city', state, page: 1, per_page: 25 },
    })
    const rows = Array.isArray(payload?.data) ? payload.data : []
    const normalizedCity = String(city || '').replace(/^st[.]?\s+/i, 'saint ').toLowerCase()
    const exact = rows.find((row) => {
      const rowName = String(row.name || '').replace(/^st[.]?\s+/i, 'saint ').toLowerCase()
      return rowName === normalizedCity && String(row.state || '').toUpperCase() === String(state || '').toUpperCase()
    })
    const match = exact || rows.find((row) => String(row.state || '').toUpperCase() === String(state || '').toUpperCase())
    if (!match?.code) {
      throw new DealMachineApiError(`DealMachine city location was not found for ${city}, ${state}.`, {
        code: 'location_not_found',
      })
    }
    return match
  }

  return {
    request,
    account: () => request('/account'),
    usage: () => request('/usage'),
    listFilters: (sourceType) => collect('/filters', { source_type: sourceType }),
    listFields: (sourceType) => collect('/fields', { source_type: sourceType }),
    searchLocations: (query) => request('/locations', { query }),
    resolveCity,
    countProperties: (body) => request('/properties/search/count', { method: 'POST', body }),
    searchProperties: (body) => request('/properties/search', { method: 'POST', body }),
    estimatePropertySearch: (body) => request('/properties/search', {
      method: 'POST',
      body: { ...body, estimate_cost: true },
    }),
    exportProperties: (body) => request('/properties/export', {
      method: 'POST',
      body,
      timeoutMs: EXPORT_TIMEOUT_MS,
    }),
    listLists: (query = {}) => request('/lists', { query: { page: 1, per_page: 100, ...query } }),
    createList: (body) => request('/lists', { method: 'POST', body }),
    getList: (listId) => request(`/lists/${encodeURIComponent(listId)}`),
    exportList: (listId, body = {}) => request(`/lists/${encodeURIComponent(listId)}/export`, {
      method: 'POST',
      body,
      timeoutMs: EXPORT_TIMEOUT_MS,
    }),
    listExports: (query = {}) => request('/exports', { query }),
    getExport: (exportId) => request(`/exports/${encodeURIComponent(exportId)}`),
    downloadUrls: normalizeDownloadUrls,
    getRateLimit: () => rateLimit,
  }
}

export async function downloadDealMachineExportFile(download, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs || EXPORT_TIMEOUT_MS))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(download.url, { signal: controller.signal })
    if (!response.ok) throw new Error(`DealMachine export download HTTP ${response.status}.`)
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}
