import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_CLOCK_SKEW_SECONDS = 5 * 60

export type CallbackVerification =
  | { ok: true; timestamp: number }
  | { ok: false; reason: string }

export function createResearchCallbackSignature(secret: string, timestamp: number, rawBody: string) {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
}

function safeEqual(left: string, right: string) {
  const actual = Buffer.from(left)
  const expected = Buffer.from(right)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function verifyResearchCallback(input: {
  secret: string | undefined
  rawBody: string
  timestampHeader: string | null
  signatureHeader: string | null
  now?: number
}): CallbackVerification {
  const secret = String(input.secret || '').trim()
  if (!secret) return { ok: false, reason: 'RESEARCH_WORKER_CALLBACK_SECRET is not configured.' }

  const timestamp = Number(input.timestampHeader)
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return { ok: false, reason: 'Invalid callback timestamp.' }
  }

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000)
  if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'Expired callback timestamp.' }
  }

  const provided = String(input.signatureHeader || '').trim()
  const expected = createResearchCallbackSignature(secret, timestamp, input.rawBody)
  if (!safeEqual(provided, expected)) return { ok: false, reason: 'Invalid callback signature.' }

  return { ok: true, timestamp }
}
