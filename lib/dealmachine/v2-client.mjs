import {
  DealMachinePolicyError,
  assertDealMachineDiscoveryEnabled,
  assertDealMachinePaidSearchEnabled,
  assertPaidPropertySearchResponsePayload,
  assertPropertyCountResponsePayload,
  assertPropertyEstimateResponsePayload,
  assertPropertyOnlySearchBody,
  isDealMachineDiscoveryEnabled,
  isDealMachinePaidSearchEnabled,
  isDealMachineSourceEnabled,
} from './v2-policy.mjs'

export {
  DealMachinePolicyError,
  assertDealMachineDiscoveryEnabled,
  assertDealMachinePaidSearchEnabled,
  assertPaidPropertySearchResponsePayload,
  assertPropertyCountResponsePayload,
  assertPropertyEstimateResponsePayload,
  assertPropertyOnlyResponsePayload,
  assertPropertyOnlySearchBody,
  findProhibitedPropertyPayloadPaths,
  isDealMachineDiscoveryEnabled,
  isDealMachinePaidSearchEnabled,
  isDealMachineSourceEnabled,
  validatePropertyOnlySearchBody,
} from './v2-policy.mjs'

export const DEALMACHINE_V2_BASE_URL = 'https://api.v2.dealmachine.com/v1'

const DEFAULT_TIMEOUT_MS = 30_000
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

function safeJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function numericHeader(headers, name) {
  const raw = headers.get(name)
  if (raw === null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function responseRequestId(response, payload) {
  return String(
    payload?.error?.request_id ||
      payload?.request_id ||
      payload?.meta?.request_id ||
      response.headers.get('x-request-id') ||
      ''
  ).trim() || null
}

function rateLimitFromHeaders(headers) {
  return {
    limit: numericHeader(headers, 'x-ratelimit-limit'),
    remaining: numericHeader(headers, 'x-ratelimit-remaining'),
    reset: headers.get('x-ratelimit-reset') || null,
    dayLimit: numericHeader(headers, 'x-ratelimit-day-limit'),
    dayRemaining: numericHeader(headers, 'x-ratelimit-day-remaining'),
    retryAfterSeconds: numericHeader(headers, 'retry-after'),
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
  return String(env.DEALMACHINE_API_KEY || '').trim()
}

export function isDealMachineCredentialFormat(value) {
  return /^dm_(?:sk|at)_live_\S+$/.test(String(value || '').trim())
}

export function hasDealMachineCredentials(env = process.env) {
  return isDealMachineCredentialFormat(dealMachineApiKey(env))
}

function createTransport(options = {}) {
  const env = options.env || process.env
  const apiKey = String(options.apiKey || dealMachineApiKey(env)).trim()
  const baseUrl = String(options.baseUrl || DEALMACHINE_V2_BASE_URL).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const maxRetries = Math.max(0, Math.min(6, Number(options.maxRetries ?? 4)))
  const minRequestIntervalMs = Math.max(0, Number(options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS))
  const userAgent = String(options.userAgent || 'VestBlock DealMachine v2/2.0 (+https://vestblock.io)')
  let lastRequestAt = 0
  let responseMetadata = null
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
    // Metadata belongs to one logical request only. Clear it before validation
    // and retries so a pre-response failure cannot inherit provider evidence
    // from an earlier call made through the same client.
    responseMetadata = null

    if (!isDealMachineCredentialFormat(apiKey)) {
      throw new DealMachineApiError(
        'DEALMACHINE_API_KEY must be a full official dm_sk_live_* or dm_at_live_* credential.',
        { code: apiKey ? 'invalid_api_key_format' : 'missing_api_key' }
      )
    }

    const method = String(requestOptions.method || 'GET').toUpperCase()
    const timeoutMs = Math.max(1_000, Number(requestOptions.timeoutMs || DEFAULT_TIMEOUT_MS))
    const retrySafe = requestOptions.retrySafe === true
    const allowedRetries = retrySafe ? maxRetries : 0
    const url = new URL(`${baseUrl}${cleanPath(path)}`)
    for (const [key, value] of Object.entries(requestOptions.query || {})) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }

    for (let attempt = 0; attempt <= allowedRetries; attempt += 1) {
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
        const text = await response.text()
        const payload = safeJson(text)
        const rateLimit = rateLimitFromHeaders(response.headers)
        const requestId = responseRequestId(response, payload)
        responseMetadata = {
          status: response.status,
          requestId,
          rateLimit,
          receivedAt: new Date().toISOString(),
        }

        if (response.ok && !payload?.error) return payload

        const retryable = RETRYABLE_STATUS_CODES.has(response.status)
        if (retrySafe && retryable && attempt < allowedRetries) {
          await sleep(retryAfterMs(response, attempt))
          continue
        }
        throw new DealMachineApiError(
          `DealMachine v2 HTTP ${response.status}: ${errorDetail(payload, text)}`,
          {
            status: response.status,
            code: payload?.error?.code || null,
            requestId,
            retryable,
            details: payload?.error?.details || null,
          }
        )
      } catch (error) {
        if (error instanceof DealMachineApiError) throw error
        const aborted = error?.name === 'AbortError'
        const networkFailure = error instanceof TypeError
        if (retrySafe && (aborted || networkFailure) && attempt < allowedRetries) {
          await sleep(Math.min(30_000, 1_000 * 2 ** attempt))
          continue
        }
        if (aborted) {
          throw new DealMachineApiError(`DealMachine v2 request timed out after ${timeoutMs}ms.`, {
            code: 'request_timeout',
            retryable: retrySafe,
          })
        }
        if (networkFailure) {
          throw new DealMachineApiError('DealMachine v2 request failed before a response was received.', {
            code: 'network_error',
            retryable: retrySafe,
          })
        }
        throw error
      } finally {
        clearTimeout(timer)
      }
    }
    throw new DealMachineApiError('DealMachine v2 request failed after retries.', {
      code: 'retry_exhausted',
      retryable: true,
    })
  }

  return {
    env,
    request,
    resetResponseMetadata: () => {
      responseMetadata = null
    },
    getRateLimit: () => responseMetadata?.rateLimit || null,
    getLastResponseMetadata: () => responseMetadata,
  }
}

function requirePropertySourceType(sourceType) {
  const value = String(sourceType || 'properties').trim().toLowerCase()
  if (value !== 'properties') {
    throw new DealMachinePolicyError('Only DealMachine property schema may be requested.', {
      code: 'dealmachine_people_schema_blocked',
    })
  }
  return 'properties'
}

/**
 * Free, read-only DealMachine discovery client. Every network method is gated by
 * DEALMACHINE_DISCOVERY_ENABLED. The historical source flag remains separate.
 */
export function createDealMachineV2Client(options = {}) {
  const transport = createTransport(options)

  function ensureEnabled() {
    assertDealMachineDiscoveryEnabled(transport.env)
  }

  async function read(path, requestOptions = {}) {
    transport.resetResponseMetadata()
    ensureEnabled()
    return transport.request(path, { ...requestOptions, retrySafe: true })
  }

  async function collect(path, query = {}) {
    const rows = []
    let page = 1
    while (page <= 100) {
      const payload = await read(path, { query: { ...query, page, per_page: 250 } })
      rows.push(...(Array.isArray(payload?.data) ? payload.data : []))
      const pagination = payload?.pagination || {}
      if (!pagination.has_next_page && page >= Number(pagination.total_pages || page)) break
      page += 1
    }
    return rows
  }

  async function resolveCity(city, state) {
    const payload = await read('/locations', {
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

  return Object.freeze({
    account: () => read('/account'),
    subscription: () => read('/subscription'),
    usage: () => read('/usage'),
    listFilters: (sourceType = 'properties') => {
      transport.resetResponseMetadata()
      return collect('/filters', { source_type: requirePropertySourceType(sourceType) })
    },
    listFields: (sourceType = 'properties') => {
      transport.resetResponseMetadata()
      return collect('/fields', { source_type: requirePropertySourceType(sourceType) })
    },
    searchLocations: (query) => read('/locations', { query }),
    resolveCity,
    countProperties: async (body) => {
      transport.resetResponseMetadata()
      assertPropertyOnlySearchBody(body)
      return assertPropertyCountResponsePayload(
        await read('/properties/search/count', { method: 'POST', body })
      )
    },
    estimatePropertySearch: async (body) => {
      transport.resetResponseMetadata()
      const estimateBody = { ...body, estimate_cost: true }
      assertPropertyOnlySearchBody(estimateBody, { requireFields: true })
      return assertPropertyEstimateResponsePayload(
        await read('/properties/search', { method: 'POST', body: estimateBody })
      )
    },
    getRateLimit: transport.getRateLimit,
    getLastResponseMetadata: transport.getLastResponseMetadata,
  })
}

export const createDealMachineV2DiscoveryClient = createDealMachineV2Client

/**
 * Paid search is deliberately a separate capability. It never automatically
 * retries because the provider does not document idempotency for billable POSTs.
 */
export function createDealMachineV2PaidSearchClient(options = {}) {
  const transport = createTransport(options)

  return Object.freeze({
    searchProperties: async (body) => {
      transport.resetResponseMetadata()
      assertDealMachinePaidSearchEnabled(transport.env)
      if (body?.estimate_cost !== undefined) {
        throw new DealMachinePolicyError('Paid property search cannot include estimate_cost.', {
          code: 'dealmachine_paid_search_estimate_misrouted',
        })
      }
      assertPropertyOnlySearchBody(body, { requireFields: true })
      const payload = await transport.request('/properties/search', {
        method: 'POST',
        body,
        retrySafe: false,
      })
      return assertPaidPropertySearchResponsePayload(payload, {
        maxRows: Number(body?.per_page ?? 250),
        allowedFields: body.fields,
      })
    },
    getRateLimit: transport.getRateLimit,
    getLastResponseMetadata: transport.getLastResponseMetadata,
  })
}

export async function getDealMachineConnectionHealth(options = {}) {
  const env = options.env || process.env
  const apiKey = String(options.apiKey || dealMachineApiKey(env)).trim()
  const checkedAt = new Date().toISOString()
  const enabled = isDealMachineSourceEnabled(env)
  const discoveryEnabled = isDealMachineDiscoveryEnabled(env)
  const paidSearchEnabled = isDealMachinePaidSearchEnabled(env)
  const base = {
    configured: Boolean(apiKey),
    enabled,
    discoveryEnabled,
    paidSearchEnabled,
    checkedAt,
    requestId: null,
    rateLimit: null,
  }

  if (!apiKey) {
    return {
      ...base,
      state: 'not_configured',
      message: 'DEALMACHINE_API_KEY is not configured.',
    }
  }

  if (!isDealMachineCredentialFormat(apiKey)) {
    return {
      ...base,
      state: 'configured_unverified',
      message: 'A DealMachine credential is present but does not match the documented dm_sk_live_* or dm_at_live_* format.',
    }
  }

  if (options.verify !== true) {
    return {
      ...base,
      state: 'configured_unverified',
      message: discoveryEnabled
        ? 'Credential format is valid but the provider connection has not been verified.'
        : 'Credential format is valid; DealMachine discovery remains disabled.',
    }
  }

  if (!discoveryEnabled) {
    return {
      ...base,
      state: 'configured_unverified',
      message: 'Connection verification was not attempted because DealMachine discovery is disabled.',
    }
  }

  const transport = createTransport({
    apiKey,
    env,
    fetchImpl: options.fetchImpl,
    maxRetries: 0,
    minRequestIntervalMs: 0,
  })

  try {
    await transport.request('/account', {
      timeoutMs: options.timeoutMs || 8_000,
      retrySafe: true,
    })
    const metadata = transport.getLastResponseMetadata()
    return {
      ...base,
      state: 'working',
      message: paidSearchEnabled
        ? 'DealMachine authentication is working and paid property search is enabled.'
        : 'DealMachine authentication is working; paid property search remains disabled.',
      requestId: metadata?.requestId || null,
      rateLimit: metadata?.rateLimit || null,
    }
  } catch (error) {
    const status = error instanceof DealMachineApiError ? error.status : null
    const requestId = error instanceof DealMachineApiError ? error.requestId : null
    const rateLimit = transport.getRateLimit()
    if (status === 429) {
      return {
        ...base,
        state: 'rate_limited',
        message: 'DealMachine is rate limiting verification. Honor Retry-After before checking again.',
        requestId,
        rateLimit,
      }
    }
    if (status === 401 || status === 403) {
      return {
        ...base,
        state: 'unauthorized',
        message: 'DealMachine rejected the credential.',
        requestId,
        rateLimit,
      }
    }
    if (
      (typeof status === 'number' && status >= 500) ||
      (error instanceof DealMachineApiError && ['network_error', 'request_timeout', 'retry_exhausted'].includes(String(error.code)))
    ) {
      return {
        ...base,
        state: 'provider_unavailable',
        message: 'DealMachine is unavailable or did not respond within the verification timeout.',
        requestId,
        rateLimit,
      }
    }
    return {
      ...base,
      state: 'configured_unverified',
      message: 'The DealMachine credential is configured, but verification did not complete.',
      requestId,
      rateLimit,
    }
  }
}
