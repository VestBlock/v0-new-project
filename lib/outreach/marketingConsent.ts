import 'server-only'

import {
  assessDurableMarketingConsentEvidence,
  hashMarketingConsentRecipient,
  type DurableMarketingConsentEvidence,
  type DurableMarketingConsentReference,
} from '@/lib/outreach/marketingConsentCore'
import { normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type DurableMarketingConsentVerification =
  | { verified: true; evidence: DurableMarketingConsentEvidence }
  | {
      verified: false
      reason:
        | 'reference_invalid'
        | 'record_unavailable'
        | 'recipient_mismatch'
        | 'consent_not_current'
        | 'evidence_invalid'
    }

/**
 * Loads the canonical consent record at send time. At present only the public
 * Next Move intake has both an affirmative flag and a durable timestamp, so
 * boolean-only workspace/capital fields are intentionally not accepted.
 */
export async function verifyDurableMarketingConsent(
  input: {
    reference: DurableMarketingConsentReference
    recipientEmail: string
    now?: Date
  },
  admin: AdminClient = createAdminClient()
): Promise<DurableMarketingConsentVerification> {
  if (input.reference?.source !== 'next_move_questionnaires' || !input.reference.recordId) {
    return { verified: false, reason: 'reference_invalid' }
  }

  const { data, error } = await admin
    .from('next_move_questionnaires')
    .select('id,email,marketing_consent,marketing_consented_at,deleted_at')
    .eq('id', input.reference.recordId)
    .maybeSingle()
  if (error || !data) return { verified: false, reason: 'record_unavailable' }

  const recipientEmail = normalizeEmailAddress(input.recipientEmail)
  if (!recipientEmail || normalizeEmailAddress(data.email) !== recipientEmail) {
    return { verified: false, reason: 'recipient_mismatch' }
  }
  if (
    data.marketing_consent !== true ||
    !data.marketing_consented_at ||
    data.deleted_at
  ) {
    return { verified: false, reason: 'consent_not_current' }
  }

  const now = input.now || new Date()
  const evidence = {
    source: 'next_move_questionnaires',
    recordId: String(data.id),
    status: 'current',
    consentedAt: String(data.marketing_consented_at),
    verifiedAt: now.toISOString(),
    revokedAt: null,
    recipientHash: hashMarketingConsentRecipient(recipientEmail),
  } satisfies DurableMarketingConsentEvidence
  const assessment = assessDurableMarketingConsentEvidence({
    evidence,
    recipientEmail,
    now,
  })
  if (!assessment.valid) return { verified: false, reason: 'evidence_invalid' }
  return { verified: true, evidence: assessment.evidence }
}
