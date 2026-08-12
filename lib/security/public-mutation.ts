import 'server-only'

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

type PublicMutationOptions = {
  scope: string
  maxRequests?: number
  windowMs?: number
  maxBodyBytes?: number
}

type RateBucket = {
  timestamps: number[]
  lastSeen: number
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_MAX_REQUESTS = 8
const DEFAULT_MAX_BODY_BYTES = 256 * 1024
const MAX_BUCKETS = 4_000
const rateBuckets = new Map<string, RateBucket>()

function isSameOrigin(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false

  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || request.headers.get('host')
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const protocol = forwardedProtocol ? `${forwardedProtocol}:` : requestUrl.protocol

    return originUrl.origin === requestUrl.origin || Boolean(host && originUrl.origin === `${protocol}//${host}`)
  } catch {
    return false
  }
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || request.headers.get('x-real-ip') || 'local'
  return createHash('sha256').update(address).digest('hex')
}

function checkRateLimit(request: Request, options: Required<Pick<PublicMutationOptions, 'scope' | 'maxRequests' | 'windowMs'>>) {
  const now = Date.now()
  const key = `${options.scope}:${requestIdentity(request)}`
  const previous = rateBuckets.get(key)
  const active = (previous?.timestamps || []).filter((timestamp) => now - timestamp < options.windowMs)

  if (active.length >= options.maxRequests) {
    rateBuckets.set(key, { timestamps: active, lastSeen: now })
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((options.windowMs - (now - active[0])) / 1000)),
    }
  }

  active.push(now)
  rateBuckets.set(key, { timestamps: active, lastSeen: now })

  if (rateBuckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.lastSeen >= options.windowMs) rateBuckets.delete(bucketKey)
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

/**
 * Shared guard for browser-originated public JSON submissions.
 * Returns a response when the request must stop, otherwise `null`.
 */
export function guardPublicMutation(request: Request, options: PublicMutationOptions) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-site submissions are not allowed.' },
      { status: 403 }
    )
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() || ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'This endpoint accepts JSON requests only.' },
      { status: 415 }
    )
  }

  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return NextResponse.json(
      { error: 'The submitted request is too large.' },
      { status: 413 }
    )
  }

  const rate = checkRateLimit(request, {
    scope: options.scope,
    maxRequests: options.maxRequests ?? DEFAULT_MAX_REQUESTS,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
  })

  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
      }
    )
  }

  return null
}
