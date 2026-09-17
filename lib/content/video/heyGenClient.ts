import 'server-only'

const HEYGEN_API_BASE_URL = 'https://api.heygen.com'
const DEFAULT_TIMEOUT_MS = 15_000

export type HeyGenAgentStatus =
  | 'thinking'
  | 'generating'
  | 'reviewing'
  | 'waiting_for_input'
  | 'completed'
  | 'failed'
  | 'unknown'
export type HeyGenVideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type HeyGenVideoAgentSession = {
  sessionId: string
  status: HeyGenAgentStatus
  videoId: string | null
  progress: number | null
  failureMessage: string | null
}

export type HeyGenVideo = {
  videoId: string
  status: HeyGenVideoStatus
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  failureMessage: string | null
}

export class HeyGenApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, input: { status: number; code?: string | null }) {
    super(message)
    this.name = 'HeyGenApiError'
    this.status = input.status
    this.code = input.code || null
  }
}

type HeyGenClientOptions = {
  apiKey: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boundedProviderMessage(value: unknown, fallback: string) {
  const message = asString(value) || fallback
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function parseAgentStatus(value: unknown): HeyGenAgentStatus {
  return value === 'thinking' ||
    value === 'generating' ||
    value === 'reviewing' ||
    value === 'waiting_for_input' ||
    value === 'completed' ||
    value === 'failed'
    ? value
    : 'unknown'
}

function parseVideoStatus(value: unknown, videoUrl: string | null): HeyGenVideoStatus {
  if (value === 'pending' || value === 'processing' || value === 'completed' || value === 'failed') {
    return value
  }
  return videoUrl ? 'completed' : 'processing'
}

async function parseResponseJson(response: Response): Promise<JsonObject> {
  const text = await response.text()
  if (!text) return {}
  try {
    return asObject(JSON.parse(text))
  } catch {
    return {}
  }
}

async function heyGenRequest(
  path: string,
  init: RequestInit,
  options: HeyGenClientOptions
): Promise<JsonObject> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('HEYGEN_API_KEY is required for video rendering.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS)

  let response: Response
  try {
    response = await (options.fetchImpl || fetch)(`${HEYGEN_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('HeyGen request timed out.')
    }
    throw new Error('HeyGen request failed before a response was received.')
  } finally {
    clearTimeout(timeout)
  }

  const payload = await parseResponseJson(response)
  if (!response.ok) {
    const providerError = asObject(payload.error)
    throw new HeyGenApiError(
      boundedProviderMessage(
        providerError.message,
        `HeyGen returned HTTP ${response.status}.`
      ),
      {
        status: response.status,
        code: asString(providerError.code),
      }
    )
  }

  return payload
}

export async function createHeyGenVideoAgent(input: {
  apiKey: string
  prompt: string
  orientation: 'portrait' | 'landscape'
  styleId?: string | null
  callbackId: string
  idempotencyKey: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<HeyGenVideoAgentSession> {
  const prompt = input.prompt.trim()
  if (!prompt || prompt.length > 10_000) {
    throw new Error('HeyGen renderer prompts must contain between 1 and 10,000 characters.')
  }
  const idempotencyKey = input.idempotencyKey.trim()
  if (!idempotencyKey || idempotencyKey.length > 255) {
    throw new Error('A valid HeyGen idempotency key is required.')
  }

  const payload = await heyGenRequest(
    '/v3/video-agents',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        prompt,
        mode: 'generate',
        orientation: input.orientation,
        style_id: input.styleId || undefined,
        callback_id: input.callbackId,
        // HeyGen defaults Video Agent sessions to team visibility. The content
        // lane is a private review queue, so both settings are explicit.
        visibility: 'private',
        incognito_mode: true,
      }),
    },
    input
  )
  const data = asObject(payload.data)
  const sessionId = asString(data.session_id)
  if (!sessionId) throw new Error('HeyGen accepted the request without returning a session ID.')

  return {
    sessionId,
    status: parseAgentStatus(data.status),
    videoId: asString(data.video_id),
    progress: asNumber(data.progress),
    failureMessage: asString(data.failure_message),
  }
}

export async function getHeyGenVideoAgentSession(input: {
  apiKey: string
  sessionId: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<HeyGenVideoAgentSession> {
  const sessionId = encodeURIComponent(input.sessionId.trim())
  if (!sessionId) throw new Error('A HeyGen session ID is required.')
  const payload = await heyGenRequest(
    `/v3/video-agents/${sessionId}`,
    { method: 'GET' },
    input
  )
  const data = asObject(payload.data)

  return {
    sessionId: asString(data.session_id) || input.sessionId,
    status: parseAgentStatus(data.status),
    videoId: asString(data.video_id),
    progress: asNumber(data.progress),
    failureMessage: asString(data.failure_message) || asString(data.error),
  }
}

export async function getHeyGenVideo(input: {
  apiKey: string
  videoId: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<HeyGenVideo> {
  const videoId = encodeURIComponent(input.videoId.trim())
  if (!videoId) throw new Error('A HeyGen video ID is required.')
  const payload = await heyGenRequest(`/v3/videos/${videoId}`, { method: 'GET' }, input)
  const data = asObject(payload.data)
  const videoUrl = asString(data.video_url) || asString(data.url)

  return {
    videoId: asString(data.id) || asString(data.video_id) || input.videoId,
    status: parseVideoStatus(data.status, videoUrl),
    videoUrl,
    thumbnailUrl: asString(data.thumbnail_url),
    durationSeconds: asNumber(data.duration),
    failureMessage: asString(data.failure_message) || asString(data.error),
  }
}
