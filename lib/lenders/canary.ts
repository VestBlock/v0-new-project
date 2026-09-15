import { createHash } from 'node:crypto'

import type {
  HunterEmailVerificationResult,
  HunterEmailVerificationStatus,
} from '@/lib/email/hunterVerifier'
import type { LenderRecord } from '@/lib/lenders/types'

type DeliveryBreakerMode = 'healthy' | 'controlled_trial' | 'recovery_canary' | 'blocked' | 'unavailable'

const HUNTER_CANARY_CACHE_KEY = 'hunterEmailVerifier'
const DEFAULT_HUNTER_CANARY_CACHE_TTL_HOURS = 24
const MAX_HUNTER_CANARY_CACHE_TTL_HOURS = 168
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function isLenderCanaryPreCandidate(input: {
  lender: Pick<LenderRecord, 'contact_email' | 'metadata_json'>
  channel: string
  hasPriorInitialSend: boolean
  suppressed: boolean
}) {
  const email = normalizeEmail(input.lender.contact_email)
  if (!email || /\.gov$/i.test(email.split('@')[1] || '')) return false
  if (input.channel !== 'email_followup' || !input.hasPriorInitialSend || input.suppressed) return false

  const hunter = input.lender.metadata_json?.hunterContactEnrichment
  if (!hunter || typeof hunter !== 'object') return false
  const hunterMetadata = hunter as Record<string, unknown>

  const acceptedConfidence = Number(hunterMetadata.acceptedConfidence)
  const sanitizedCandidateAccepted = (
    hunterMetadata.accepted === true &&
    String(hunterMetadata.acceptedVerificationStatus || '').trim().toLowerCase() === 'valid' &&
    Number.isFinite(acceptedConfidence) &&
    acceptedConfidence >= 90
  )
  if (sanitizedCandidateAccepted) return true

  const primary = hunterMetadata.primaryCandidate
  if (!primary || typeof primary !== 'object') return false
  const candidate = primary as Record<string, unknown>
  const verificationStatus = String(candidate.verificationStatus || '').trim().toLowerCase()
  const confidence = Number(candidate.confidence)

  return (
    normalizeEmail(candidate.email) === email &&
    verificationStatus === 'valid' &&
    Number.isFinite(confidence) &&
    confidence >= 90
  )
}

/**
 * Backward-compatible name. This only identifies a pre-candidate; every recovery
 * canary recipient must still pass the fresh Hunter Email Verifier preflight.
 */
export const isVerifiedLenderCanaryCandidate = isLenderCanaryPreCandidate

export type HunterCanaryVerificationEvidence = {
  emailHash: string
  status: HunterEmailVerificationStatus
  checkedAt: string
}

export type LenderCanaryHunterPreflightResult = {
  allowed: boolean
  status: HunterEmailVerificationStatus
  checkedAt: string | null
  source: 'cache' | 'hunter' | 'not_checked'
  reason: string
}

export function lenderCanaryVerificationTtlMs() {
  const parsed = Number.parseInt(process.env.HUNTER_CANARY_VERIFICATION_TTL_HOURS || '', 10)
  const hours = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_HUNTER_CANARY_CACHE_TTL_HOURS, parsed)
    : DEFAULT_HUNTER_CANARY_CACHE_TTL_HOURS
  return hours * 60 * 60 * 1000
}

export function lenderCanaryCandidateScanLimit(sendLimit: number) {
  const safeSendLimit = Math.min(5, Math.max(0, Math.floor(sendLimit)))
  if (safeSendLimit === 0) return 0
  return Math.min(25, Math.max(10, safeSendLimit * 4))
}

export function lenderCanaryEmailHash(email: string) {
  return createHash('sha256')
    .update(`vestblock:hunter-email-verifier:${normalizeEmail(email)}`)
    .digest('hex')
}

export function buildHunterCanaryVerificationEvidence(input: {
  email: string
  status: HunterEmailVerificationStatus
  checkedAt: string
}): HunterCanaryVerificationEvidence {
  return {
    emailHash: lenderCanaryEmailHash(input.email),
    status: input.status,
    checkedAt: new Date(input.checkedAt).toISOString(),
  }
}

export function withHunterCanaryVerificationEvidence(
  metadata: Record<string, unknown> | null | undefined,
  evidence: HunterCanaryVerificationEvidence
) {
  return {
    ...(metadata || {}),
    [HUNTER_CANARY_CACHE_KEY]: evidence,
  }
}

export function getFreshHunterCanaryVerificationEvidence(input: {
  email: string
  metadata: Record<string, unknown> | null | undefined
  now?: Date
  ttlMs?: number
}): HunterCanaryVerificationEvidence | null {
  const raw = input.metadata?.[HUNTER_CANARY_CACHE_KEY]
  if (!raw || typeof raw !== 'object') return null
  const evidence = raw as Record<string, unknown>
  const status = String(evidence.status || '').trim().toLowerCase()
  if (!['valid', 'invalid', 'accept_all', 'unknown', 'webmail', 'disposable'].includes(status)) return null
  if (evidence.emailHash !== lenderCanaryEmailHash(input.email)) return null

  const checkedAt = typeof evidence.checkedAt === 'string' ? evidence.checkedAt : ''
  const checkedAtMs = Date.parse(checkedAt)
  if (!Number.isFinite(checkedAtMs)) return null
  const ageMs = (input.now || new Date()).getTime() - checkedAtMs
  const ttlMs = input.ttlMs ?? lenderCanaryVerificationTtlMs()
  if (ageMs < -FUTURE_CLOCK_SKEW_MS || ageMs > ttlMs) return null

  return {
    emailHash: String(evidence.emailHash),
    status: status as HunterEmailVerificationStatus,
    checkedAt: new Date(checkedAtMs).toISOString(),
  }
}

export async function preflightLenderRecoveryCanaryEmail(input: {
  lender: Pick<LenderRecord, 'contact_email' | 'metadata_json'>
  allowLiveLookup: boolean
  reserve?: (email: string) => Promise<{ allowed: boolean; reason: string | null }>
  verify: (email: string) => Promise<HunterEmailVerificationResult>
  persist: (evidence: HunterCanaryVerificationEvidence) => Promise<boolean>
  now?: Date
  ttlMs?: number
}): Promise<LenderCanaryHunterPreflightResult> {
  const email = normalizeEmail(input.lender.contact_email)
  const cached = getFreshHunterCanaryVerificationEvidence({
    email,
    metadata: input.lender.metadata_json,
    now: input.now,
    ttlMs: input.ttlMs,
  })
  if (cached) {
    return {
      allowed: cached.status === 'valid',
      status: cached.status,
      checkedAt: cached.checkedAt,
      source: 'cache',
      reason: cached.status === 'valid' ? 'fresh_hunter_valid' : `fresh_hunter_${cached.status}`,
    }
  }

  if (!input.allowLiveLookup) {
    return {
      allowed: false,
      status: 'unknown',
      checkedAt: null,
      source: 'not_checked',
      reason: 'fresh_hunter_verification_required',
    }
  }

  if (input.reserve) {
    const reservation = await input.reserve(email).catch(() => ({
      allowed: false,
      reason: 'hunter_verification_budget_unavailable',
    }))
    if (!reservation.allowed) {
      return {
        allowed: false,
        status: 'unknown',
        checkedAt: null,
        source: 'not_checked',
        reason: reservation.reason || 'hunter_verification_budget_blocked',
      }
    }
  }

  const verification = await input.verify(email)
  if (!verification.cacheable) {
    return {
      allowed: false,
      status: verification.status,
      checkedAt: verification.checkedAt,
      source: 'hunter',
      reason: verification.reason,
    }
  }

  let evidence: HunterCanaryVerificationEvidence
  try {
    evidence = buildHunterCanaryVerificationEvidence({
      email,
      status: verification.status,
      checkedAt: verification.checkedAt,
    })
  } catch {
    return {
      allowed: false,
      status: 'unknown',
      checkedAt: null,
      source: 'hunter',
      reason: 'hunter_invalid_timestamp',
    }
  }

  const evidenceIsFresh = getFreshHunterCanaryVerificationEvidence({
    email,
    metadata: { [HUNTER_CANARY_CACHE_KEY]: evidence },
    now: input.now,
    ttlMs: input.ttlMs,
  })
  if (!evidenceIsFresh) {
    return {
      allowed: false,
      status: 'unknown',
      checkedAt: evidence.checkedAt,
      source: 'hunter',
      reason: 'hunter_verification_not_fresh',
    }
  }

  const persisted = await input.persist(evidence).catch(() => false)
  if (!persisted) {
    return {
      allowed: false,
      status: evidence.status,
      checkedAt: evidence.checkedAt,
      source: 'hunter',
      reason: 'hunter_verification_cache_write_failed',
    }
  }

  return {
    allowed: evidence.status === 'valid',
    status: evidence.status,
    checkedAt: evidence.checkedAt,
    source: 'hunter',
    reason: evidence.status === 'valid' ? 'hunter_valid' : `hunter_${evidence.status}`,
  }
}

export function deliveryBreakerAllowsLenderCanary(input: {
  mode: DeliveryBreakerMode | null | undefined
  recoveryCanaryAllowed: boolean
}) {
  return input.recoveryCanaryAllowed || input.mode === 'controlled_trial'
}

export function evaluateLenderRecoveryCanaryReadiness(input: {
  explicitlyRequested: boolean
  featureEnabled: boolean
  lenderAutoSendEnabled: boolean
  deliveryCanaryPermitted: boolean
  replyCaptureConfigured: boolean
  mailingAddressConfigured: boolean
  eligibleCandidateCount: number
  remainingCapacity: number
}) {
  const blockedReasons = [
    !input.explicitlyRequested ? 'recovery_canary_not_explicitly_requested' : null,
    !input.featureEnabled ? 'recovery_canary_disabled' : null,
    !input.lenderAutoSendEnabled ? 'lender_auto_send_disabled' : null,
    !input.deliveryCanaryPermitted ? 'delivery_canary_not_permitted' : null,
    !input.replyCaptureConfigured ? 'reply_capture_not_configured' : null,
    !input.mailingAddressConfigured ? 'mailing_address_not_configured' : null,
    input.eligibleCandidateCount < 1 ? 'no_verified_canary_candidates' : null,
    input.remainingCapacity < 1 ? 'daily_canary_cap_reached' : null,
  ].filter((reason): reason is string => Boolean(reason))

  return { allowed: blockedReasons.length === 0, blockedReasons }
}
