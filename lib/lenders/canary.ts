import type { LenderRecord } from '@/lib/lenders/types'

type DeliveryBreakerMode = 'healthy' | 'controlled_trial' | 'recovery_canary' | 'blocked' | 'unavailable'

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function isVerifiedLenderCanaryCandidate(input: {
  lender: Pick<LenderRecord, 'contact_email' | 'metadata_json'>
  channel: string
  hasPriorInitialSend: boolean
  suppressed: boolean
}) {
  const email = normalizeEmail(input.lender.contact_email)
  if (!email || /\.gov$/i.test(email.split('@')[1] || '')) return false
  if (input.channel !== 'email_followup' || !input.hasPriorInitialSend || input.suppressed) return false

  const hunter = input.lender.metadata_json?.hunterContactEnrichment
  const primary = hunter && typeof hunter === 'object'
    ? (hunter as Record<string, unknown>).primaryCandidate
    : null
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
