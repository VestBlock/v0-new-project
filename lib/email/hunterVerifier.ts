import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'

const HUNTER_EMAIL_VERIFIER_URL = 'https://api.hunter.io/v2/email-verifier'
const DEFAULT_TIMEOUT_MS = 8_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 15_000

export const HUNTER_EMAIL_VERIFICATION_STATUSES = [
  'valid',
  'invalid',
  'accept_all',
  'unknown',
  'webmail',
  'disposable',
] as const

export type HunterEmailVerificationStatus = (typeof HUNTER_EMAIL_VERIFICATION_STATUSES)[number]

export type HunterEmailVerificationResult = {
  status: HunterEmailVerificationStatus
  checkedAt: string
  cacheable: boolean
  reason: string
}

type HunterEmailVerifierPayload = {
  data?: {
    email?: string | null
    status?: string | null
  } | null
}

function boundedTimeoutMs(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(Number(value))))
}

export function normalizeHunterEmailVerificationStatus(value: unknown): HunterEmailVerificationStatus {
  const normalized = String(value || '').trim().toLowerCase()
  return (HUNTER_EMAIL_VERIFICATION_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as HunterEmailVerificationStatus)
    : 'unknown'
}

export async function verifyEmailWithHunter(input: {
  email: string
  apiKey?: string
  timeoutMs?: number
  now?: Date
  fetchImpl?: typeof fetch
}): Promise<HunterEmailVerificationResult> {
  const checkedAt = (input.now || new Date()).toISOString()
  const email = normalizeEmailAddress(input.email)
  const apiKey = (input.apiKey ?? process.env.HUNTER_API_KEY ?? '').trim()

  if (!isUsableContactEmail(email)) {
    return { status: 'unknown', checkedAt, cacheable: false, reason: 'invalid_email' }
  }
  if (!apiKey) {
    return { status: 'unknown', checkedAt, cacheable: false, reason: 'hunter_api_key_missing' }
  }

  const url = new URL(HUNTER_EMAIL_VERIFIER_URL)
  url.searchParams.set('email', email)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), boundedTimeoutMs(input.timeoutMs))

  try {
    const response = await (input.fetchImpl || fetch)(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'VestBlock Recovery Canary/1.0 (+https://www.vestblock.io)',
        'x-api-key': apiKey,
      },
      signal: controller.signal,
    })

    if (response.status === 202) {
      return { status: 'unknown', checkedAt, cacheable: true, reason: 'hunter_verification_pending' }
    }
    if (!response.ok) {
      return {
        status: 'unknown',
        checkedAt,
        cacheable: false,
        reason: `hunter_http_${response.status}`,
      }
    }

    const payload = (await response.json().catch(() => null)) as HunterEmailVerifierPayload | null
    const returnedEmail = normalizeEmailAddress(payload?.data?.email)
    if (!returnedEmail) {
      return { status: 'unknown', checkedAt, cacheable: false, reason: 'hunter_email_missing' }
    }
    if (returnedEmail !== email) {
      return { status: 'unknown', checkedAt, cacheable: false, reason: 'hunter_email_mismatch' }
    }

    const status = normalizeHunterEmailVerificationStatus(payload?.data?.status)
    return {
      status,
      checkedAt,
      cacheable: true,
      reason: status === 'valid' ? 'hunter_valid' : `hunter_${status}`,
    }
  } catch (error) {
    return {
      status: 'unknown',
      checkedAt,
      cacheable: false,
      reason: error instanceof Error && error.name === 'AbortError'
        ? 'hunter_timeout'
        : 'hunter_request_failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}
