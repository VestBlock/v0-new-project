import { createHash } from 'node:crypto'

import type { HunterEmailVerificationStatus } from '@/lib/email/hunterVerifier'
import { normalizeEmailAddress } from '@/lib/outreach/email-quality'

export const HUNTER_SEND_VERIFICATION_CACHE_VERSION = 1
export const HUNTER_SEND_VERIFICATION_DEFAULT_MAX_AGE_MS = 72 * 60 * 60 * 1_000
export const HUNTER_SEND_VERIFICATION_AMBIGUOUS_MAX_AGE_MS = 24 * 60 * 60 * 1_000
export const HUNTER_SEND_VERIFICATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000
export const HUNTER_SEND_VERIFICATION_DAILY_HARD_LIMIT = 1_000

export type HunterSendVerificationCache = {
  schemaVersion: 1
  emailHash: string
  status: HunterEmailVerificationStatus
  checkedAt: string
}

export type HunterSendVerificationCacheAssessment = {
  fresh: boolean
  sendable: boolean
  reason: string
  record: HunterSendVerificationCache | null
}

export type HunterVerificationFailureScope = 'record' | 'global' | 'infrastructure'

export function hashHunterVerificationEmail(email: string) {
  return createHash('sha256').update(normalizeEmailAddress(email)).digest('hex')
}

function isHunterStatus(value: unknown): value is HunterEmailVerificationStatus {
  return ['valid', 'invalid', 'accept_all', 'unknown', 'webmail', 'disposable'].includes(String(value || ''))
}

export function buildHunterSendVerificationCache(input: {
  email: string
  status: HunterEmailVerificationStatus
  checkedAt: string
}): HunterSendVerificationCache {
  return {
    schemaVersion: HUNTER_SEND_VERIFICATION_CACHE_VERSION,
    emailHash: hashHunterVerificationEmail(input.email),
    status: input.status,
    checkedAt: input.checkedAt,
  }
}

export function assessHunterSendVerificationCache(input: {
  metadata: Record<string, unknown> | null | undefined
  email: string
  now?: Date
  maxAgeMs?: number
}): HunterSendVerificationCacheAssessment {
  const raw = input.metadata?.hunterSendVerification
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fresh: false, sendable: false, reason: 'hunter_verification_missing', record: null }
  }

  const candidate = raw as Record<string, unknown>
  const checkedAtMs = Date.parse(String(candidate.checkedAt || ''))
  const nowMs = (input.now || new Date()).getTime()
  const maxAgeMs = Number.isFinite(input.maxAgeMs)
    ? Math.max(1, Number(input.maxAgeMs))
    : HUNTER_SEND_VERIFICATION_DEFAULT_MAX_AGE_MS
  if (
    candidate.schemaVersion !== HUNTER_SEND_VERIFICATION_CACHE_VERSION ||
    typeof candidate.emailHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(candidate.emailHash) ||
    !isHunterStatus(candidate.status) ||
    !Number.isFinite(checkedAtMs)
  ) {
    return { fresh: false, sendable: false, reason: 'hunter_verification_cache_invalid', record: null }
  }

  const record: HunterSendVerificationCache = {
    schemaVersion: HUNTER_SEND_VERIFICATION_CACHE_VERSION,
    emailHash: candidate.emailHash,
    status: candidate.status,
    checkedAt: new Date(checkedAtMs).toISOString(),
  }
  if (record.emailHash !== hashHunterVerificationEmail(input.email)) {
    return { fresh: false, sendable: false, reason: 'hunter_verification_email_changed', record }
  }
  if (checkedAtMs > nowMs + HUNTER_SEND_VERIFICATION_MAX_FUTURE_SKEW_MS) {
    return { fresh: false, sendable: false, reason: 'hunter_verification_timestamp_future', record }
  }
  const statusMaxAgeMs = ['accept_all', 'unknown', 'webmail'].includes(record.status)
    ? Math.min(maxAgeMs, HUNTER_SEND_VERIFICATION_AMBIGUOUS_MAX_AGE_MS)
    : maxAgeMs
  if (nowMs - checkedAtMs > statusMaxAgeMs) {
    return { fresh: false, sendable: false, reason: 'hunter_verification_stale', record }
  }

  return {
    fresh: true,
    sendable: record.status === 'valid',
    reason: record.status === 'valid' ? 'hunter_valid_cached' : `hunter_${record.status}_cached`,
    record,
  }
}

export function deriveHunterSendVerificationLimits(input: {
  effectiveDailyCap: number
  requestedSendLimit: number
  globalRemaining: number
  leadLaneRemaining: number
  configuredDailyLimit?: number | null
  configuredPerRunLimit?: number | null
}) {
  const effectiveDailyCap = Math.min(
    HUNTER_SEND_VERIFICATION_DAILY_HARD_LIMIT,
    Math.max(0, Math.floor(input.effectiveDailyCap))
  )
  const requestedDailyLimit = Number.isFinite(input.configuredDailyLimit)
    ? Math.max(0, Math.floor(Number(input.configuredDailyLimit)))
    : effectiveDailyCap
  const dailyLimit = Math.min(effectiveDailyCap, requestedDailyLimit)
  const sendOpportunity = Math.max(
    0,
    Math.min(
      Math.floor(input.requestedSendLimit),
      Math.floor(input.globalRemaining),
      Math.floor(input.leadLaneRemaining)
    )
  )
  const requestedPerRunLimit = Number.isFinite(input.configuredPerRunLimit)
    ? Math.max(0, Math.floor(Number(input.configuredPerRunLimit)))
    : sendOpportunity

  return {
    dailyLimit,
    perRunLimit: Math.min(dailyLimit, sendOpportunity, requestedPerRunLimit),
  }
}

export function hunterVerificationReplacementScanLimit(sendLimit: number, multiplier = 10) {
  const safeSendLimit = Math.min(1_000, Math.max(0, Math.floor(sendLimit)))
  if (safeSendLimit === 0) return 0
  const safeMultiplier = Math.min(20, Math.max(2, Math.floor(multiplier)))
  return Math.min(1_000, Math.max(safeSendLimit, safeSendLimit * safeMultiplier))
}

export function shouldQuarantineHunterVerificationStatus(status: unknown) {
  return ['invalid', 'disposable', 'accept_all', 'unknown', 'webmail'].includes(
    String(status || '').trim().toLowerCase()
  )
}

export function classifyHunterVerificationFailureScope(reason: unknown): HunterVerificationFailureScope {
  const normalized = String(reason || '').trim().toLowerCase()
  if (/daily_budget_exhausted|budget_contention/.test(normalized)) return 'global'
  if (
    /budget_(?:unavailable|state_invalid|date_invalid|date_future)|api_key_missing|request_failed|timeout|http_|cache_write_failed|safety_unavailable|email_(?:missing|mismatch)|invalid_timestamp/.test(normalized)
  ) return 'infrastructure'
  return 'record'
}
