import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const rateBuckets = new Map<string, number[]>()

export function createLifecycleToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashLifecycleToken(token) }
}

export function hashLifecycleToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeAttribution(input: Record<string, string>) {
  const allowed = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landing_path'])
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => allowed.has(key) && value.trim()).map(([key, value]) => [key, value.trim().slice(0, 500)]))
}

export function isSameOriginPublicMutation(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false

  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export function checkNextMoveRateLimit(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const identity = forwarded || request.headers.get('x-real-ip') || 'local'
  const key = createHash('sha256').update(identity).digest('hex')
  const now = Date.now()
  const active = (rateBuckets.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS)

  if (active.length >= RATE_MAX) {
    rateBuckets.set(key, active)
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - active[0])) / 1000)) }
  }

  active.push(now)
  rateBuckets.set(key, active)
  if (rateBuckets.size > 2_000) {
    for (const [bucketKey, timestamps] of rateBuckets) {
      if (!timestamps.some((time) => now - time < RATE_WINDOW_MS)) rateBuckets.delete(bucketKey)
    }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}
