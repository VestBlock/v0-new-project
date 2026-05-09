import { z } from 'zod'

import type { AiLeadScoreSummary } from '@/lib/ai/leadScoring'
import type { LeadAgentQualification } from '@/lib/ai/leadAgentQualification'
import type { LeadRecord } from '@/lib/leads/types'
import { buildPartnerReferralPath, getPartnerReferralDefinition, type PartnerReferralKey } from '@/lib/partners/referrals'

export const leadAgentActionSchema = z.object({
  action: z.enum(['apply_ai_recommendation', 'approve_outreach', 'route_to_partner']),
})

export type LeadAgentActionInput = z.infer<typeof leadAgentActionSchema>

export type LeadPartnerRouting = {
  routeType: 'external_partner' | 'manual_partner_review'
  partnerKey: PartnerReferralKey | null
  partnerName: string
  partnerPath: string | null
  fitSummary: string
  routeReason: string
}

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

export function chooseLeadPartnerRouting(input: {
  lead: LeadRecord
  qualification: LeadAgentQualification
  scoreSummary: AiLeadScoreSummary
}): LeadPartnerRouting | null {
  const { lead, qualification, scoreSummary } = input
  const combined = [
    lead.category,
    lead.lead_type,
    lead.best_offer,
    lead.niche,
    lead.pain_signal,
    lead.business_name,
    scoreSummary.recommended_offer_label,
    qualification.qualification_reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const realEstateLike = includesAny(combined, [
    /real estate/,
    /seller/,
    /property/,
    /rental/,
    /investor/,
    /flip/,
    /brrrr/,
    /dscr/,
    /bridge/,
  ])

  const commercialLike = includesAny(combined, [/commercial/, /mixed use/, /broker/, /complex/])
  const businessFundingLike = includesAny(combined, [/business funding/, /grant/, /sba/, /capital/, /credit builder/])

  if (realEstateLike) {
    const partnerKey: PartnerReferralKey = commercialLike ? 'rcn' : 'kiavi'
    const partner = getPartnerReferralDefinition(partnerKey)
    if (!partner) return null

    return {
      routeType: 'external_partner',
      partnerKey,
      partnerName: partner.displayName,
      partnerPath: buildPartnerReferralPath({
        partnerKey,
        source: 'lead_agent',
        leadId: lead.id,
        loanType: commercialLike ? 'bridge' : 'dscr',
        service: 'real_estate_funding',
      }),
      fitSummary: partner.fitSummary,
      routeReason:
        qualification.approval_recommendation === 'route_to_partner'
          ? qualification.approval_reason
          : 'This lead reads more like a real-estate capital opportunity than a generic outbound nurture lead.',
    }
  }

  if (businessFundingLike) {
    return {
      routeType: 'manual_partner_review',
      partnerKey: null,
      partnerName: 'Funding partner review',
      partnerPath: null,
      fitSummary:
        'This lead may fit a funding-readiness or lender-routing path, but no single public partner handoff is the right automatic move yet.',
      routeReason:
        qualification.approval_recommendation === 'route_to_partner'
          ? qualification.approval_reason
          : 'The lead looks stronger as a funding review candidate than as a generic marketing follow-up.',
    }
  }

  return null
}
