export const OUTREACH_RAMP_PROMOTION_COOLDOWN_MS = 15 * 60 * 1_000

export type RampPromotionGuardInput = {
  currentEffectiveCap: number
  proposedEffectiveCap: number
  snapshotEvidenceWatermark: number | null | undefined
  currentEvidenceWatermark: number
  snapshotObservedAt: Date
  currentStateTransitionedAt: Date
  lastConservativeDecisionAt?: Date
  now: Date
  cooldownMs?: number
}

export type RampPromotionGuardDecision = {
  allowed: boolean
  promotion: boolean
  reason:
    | 'conservative_transition'
    | 'promotion_evidence_watermark_missing'
    | 'promotion_evidence_changed'
    | 'promotion_evidence_predates_lower_state'
    | 'promotion_cooldown_active'
    | 'promotion_validated'
}

/**
 * Pure contract mirrored by record_outreach_sender_ramp_decision in Postgres.
 * The database remains authoritative; this helper makes the fail-closed race
 * rules deterministic and regression-testable without a live database.
 */
export function evaluateRampPromotionGuard(
  input: RampPromotionGuardInput
): RampPromotionGuardDecision {
  if (input.proposedEffectiveCap <= input.currentEffectiveCap) {
    return { allowed: true, promotion: false, reason: 'conservative_transition' }
  }

  const snapshotWatermark = input.snapshotEvidenceWatermark
  if (!Number.isSafeInteger(snapshotWatermark) || Number(snapshotWatermark) < 0) {
    return { allowed: false, promotion: true, reason: 'promotion_evidence_watermark_missing' }
  }
  if (snapshotWatermark !== input.currentEvidenceWatermark) {
    return { allowed: false, promotion: true, reason: 'promotion_evidence_changed' }
  }
  const latestLowerDecisionAt = Math.max(
    input.currentStateTransitionedAt.getTime(),
    input.lastConservativeDecisionAt?.getTime() ?? Number.NEGATIVE_INFINITY
  )
  if (input.snapshotObservedAt.getTime() <= latestLowerDecisionAt) {
    return { allowed: false, promotion: true, reason: 'promotion_evidence_predates_lower_state' }
  }

  const cooldownMs = Math.max(0, input.cooldownMs ?? OUTREACH_RAMP_PROMOTION_COOLDOWN_MS)
  if (input.now.getTime() < input.currentStateTransitionedAt.getTime() + cooldownMs) {
    return { allowed: false, promotion: true, reason: 'promotion_cooldown_active' }
  }

  return { allowed: true, promotion: true, reason: 'promotion_validated' }
}
