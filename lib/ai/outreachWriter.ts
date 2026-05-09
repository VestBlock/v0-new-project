import { z } from 'zod';

import { buildAiLeadScoreSummary } from '@/lib/ai/leadScoring';
import { logAiAgentStep } from '@/lib/ai/agentLogger';
import { mapLeadOfferToRevenueOffer, recommendRevenueNextAction } from '@/lib/ai/offerMatcher';
import { generateLeadOutreach } from '@/lib/leads/outreach';
import type { LeadRecord, LeadScoreBreakdown } from '@/lib/leads/types';

export const aiOutreachDraftSchema = z.object({
  recommended_offer: z.string().min(1),
  recommended_next_action: z.string().min(1),
  suggested_subject_line: z.string().min(1),
  suggested_email_body: z.string().min(1),
  suggested_sms_body: z.string().min(1),
  suggested_phone_script: z.string().min(1),
  primary_channel: z.enum(['email', 'sms', 'phone_script']),
  generated_with: z.enum(['openai', 'template']),
  language: z.enum(['en', 'es']),
});

export type AiOutreachDraft = z.infer<typeof aiOutreachDraftSchema>;

export async function buildAiOutreachDraft(
  lead: LeadRecord
): Promise<AiOutreachDraft> {
  await logAiAgentStep({
    agentKey: 'outreach_draft_summary',
    step: 'build-draft',
    status: 'started',
    entityType: 'lead',
    entityId: lead.id,
  });

  const scoreSummary = await buildAiLeadScoreSummary(lead);
  const leadWithScore = {
    ...lead,
    lead_score: scoreSummary.score,
    best_offer: scoreSummary.recommended_offer_label,
  } as LeadRecord;
  const bundle = await generateLeadOutreach(leadWithScore);
  const revenueOffer = mapLeadOfferToRevenueOffer(
    leadWithScore.best_offer,
    leadWithScore
  );
  const normalizedScore: LeadScoreBreakdown = {
    score: scoreSummary.score,
    urgencyScore: scoreSummary.score_breakdown.urgency,
    businessAgeScore: scoreSummary.score_breakdown.business_age,
    fundingNeedScore: scoreSummary.score_breakdown.funding_need,
    websiteWeaknessScore: scoreSummary.score_breakdown.website_weakness,
    languageNicheScore: scoreSummary.score_breakdown.language_niche,
    distressSignalScore: scoreSummary.score_breakdown.distress_signal,
    contractFitScore: scoreSummary.score_breakdown.contract_fit,
    contactabilityScore: scoreSummary.score_breakdown.contactability,
    estimatedValueScore: scoreSummary.score_breakdown.estimated_value,
    bestOffer: (leadWithScore.best_offer ?? 'Business Funding') as LeadScoreBreakdown['bestOffer'],
    reasoning: scoreSummary.score_reason,
    urgencyLevel: scoreSummary.urgency_level,
    contactabilityLevel: scoreSummary.contactability_level,
    languageSegment: scoreSummary.language_segment,
    outreachAngle: scoreSummary.outreach_angle,
    estimatedValueLabel: scoreSummary.estimated_value_label,
    breakdown: {},
  };

  const draft = aiOutreachDraftSchema.parse({
    recommended_offer: scoreSummary.recommended_offer_label,
    recommended_next_action: recommendRevenueNextAction({
      lead: leadWithScore,
      score: normalizedScore,
      revenueOffer,
    }),
    suggested_subject_line: bundle.email.subject,
    suggested_email_body: bundle.email.body,
    suggested_sms_body: bundle.sms.body,
    suggested_phone_script: bundle.phone_script.body,
    primary_channel:
      scoreSummary.contactability_level === 'low'
        ? lead.phone
          ? 'phone_script'
          : 'sms'
        : 'email',
    generated_with: bundle.generatedWith,
    language: bundle.email.language,
  });

  await logAiAgentStep({
    agentKey: 'outreach_draft_summary',
    step: 'build-draft',
    status: 'completed',
    entityType: 'lead',
    entityId: lead.id,
    metadata: {
      recommendedOffer: draft.recommended_offer,
      primaryChannel: draft.primary_channel,
      generatedWith: draft.generated_with,
    },
  });

  return draft;
}
