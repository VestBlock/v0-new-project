import { createHash } from 'node:crypto'

export const MARKETING_CONSENT_SOURCES = ['next_move_questionnaires'] as const
export type MarketingConsentSource = (typeof MARKETING_CONSENT_SOURCES)[number]

export type DurableMarketingConsentReference = {
  source: MarketingConsentSource
  recordId: string
}

export type DurableMarketingConsentEvidence = DurableMarketingConsentReference & {
  status: 'current'
  consentedAt: string
  verifiedAt: string
  revokedAt: null
  recipientHash: string
}

export type DurableMarketingConsentAssessment =
  | { valid: true; evidence: DurableMarketingConsentEvidence }
  | {
      valid: false
      reason:
        | 'evidence_missing'
        | 'source_unsupported'
        | 'record_id_invalid'
        | 'recipient_mismatch'
        | 'consent_not_current'
        | 'consent_timestamp_invalid'
        | 'verification_stale'
    }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/
const MAX_VERIFICATION_AGE_MS = 5 * 60 * 1_000
const FUTURE_SKEW_MS = 60 * 1_000

export function hashMarketingConsentRecipient(email: string) {
  return createHash('sha256')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex')
}

/**
 * Validates evidence loaded from a durable consent record immediately before
 * delivery. A bare boolean, form field, or stale snapshot can never satisfy
 * this contract.
 */
export function assessDurableMarketingConsentEvidence(input: {
  evidence?: unknown
  recipientEmail?: string | null
  now?: Date
}): DurableMarketingConsentAssessment {
  if (!input.evidence || typeof input.evidence !== 'object' || Array.isArray(input.evidence)) {
    return { valid: false, reason: 'evidence_missing' }
  }

  const candidate = input.evidence as Record<string, unknown>
  if (!MARKETING_CONSENT_SOURCES.includes(candidate.source as MarketingConsentSource)) {
    return { valid: false, reason: 'source_unsupported' }
  }
  if (typeof candidate.recordId !== 'string' || !UUID_PATTERN.test(candidate.recordId)) {
    return { valid: false, reason: 'record_id_invalid' }
  }
  if (
    candidate.status !== 'current' ||
    candidate.revokedAt !== null
  ) {
    return { valid: false, reason: 'consent_not_current' }
  }

  const recipientEmail = String(input.recipientEmail || '').trim().toLowerCase()
  const recipientHash = typeof candidate.recipientHash === 'string'
    ? candidate.recipientHash
    : ''
  if (
    !recipientEmail ||
    !HASH_PATTERN.test(recipientHash) ||
    recipientHash !== hashMarketingConsentRecipient(recipientEmail)
  ) {
    return { valid: false, reason: 'recipient_mismatch' }
  }

  const now = input.now || new Date()
  const consentedAtMs = Date.parse(
    typeof candidate.consentedAt === 'string' ? candidate.consentedAt : ''
  )
  const verifiedAtMs = Date.parse(
    typeof candidate.verifiedAt === 'string' ? candidate.verifiedAt : ''
  )
  if (
    !Number.isFinite(consentedAtMs) ||
    consentedAtMs > now.getTime() + FUTURE_SKEW_MS
  ) {
    return { valid: false, reason: 'consent_timestamp_invalid' }
  }
  if (
    !Number.isFinite(verifiedAtMs) ||
    verifiedAtMs > now.getTime() + FUTURE_SKEW_MS ||
    verifiedAtMs < now.getTime() - MAX_VERIFICATION_AGE_MS
  ) {
    return { valid: false, reason: 'verification_stale' }
  }

  return {
    valid: true,
    evidence: {
      source: candidate.source as MarketingConsentSource,
      recordId: candidate.recordId,
      status: 'current',
      consentedAt: new Date(consentedAtMs).toISOString(),
      verifiedAt: new Date(verifiedAtMs).toISOString(),
      revokedAt: null,
      recipientHash,
    },
  }
}
