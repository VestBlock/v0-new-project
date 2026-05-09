import { z } from 'zod';

import { logAiAgentStep } from '@/lib/ai/agentLogger';
import {
  mapLeadOfferToRevenueOffer,
  recommendRevenueNextAction,
  revenueOfferCatalog,
  revenueOfferKeySchema,
} from '@/lib/ai/offerMatcher';
import { scoreLead } from '@/lib/leads/scoring';
import type { LeadRecord } from '@/lib/leads/types';

export const aiLeadScoreSummarySchema = z.object({
  score: z.number().int().min(0).max(100),
  score_reason: z.string().min(1),
  recommended_offer: revenueOfferKeySchema,
  recommended_offer_label: z.string().min(1),
  recommended_next_action: z.string().min(1),
  urgency_level: z.enum(['low', 'medium', 'high']),
  contactability_level: z.enum(['low', 'medium', 'high']),
  language_segment: z.enum(['english', 'spanish', 'bilingual']),
  outreach_angle: z.string().min(1),
  estimated_value_label: z.enum(['low', 'medium', 'high', 'premium']),
  score_breakdown: z.object({
    urgency: z.number().int(),
    business_age: z.number().int(),
    funding_need: z.number().int(),
    website_weakness: z.number().int(),
    language_niche: z.number().int(),
    distress_signal: z.number().int(),
    contract_fit: z.number().int(),
    contactability: z.number().int(),
    estimated_value: z.number().int(),
  }),
});

export type AiLeadScoreSummary = z.infer<typeof aiLeadScoreSummarySchema>;

export async function buildAiLeadScoreSummary(
  lead: LeadRecord,
  options: { refreshWebsiteAudit?: boolean } = {}
): Promise<AiLeadScoreSummary> {
  await logAiAgentStep({
    agentKey: 'lead_scoring_summary',
    step: 'score-lead',
    status: 'started',
    entityType: 'lead',
    entityId: lead.id,
    metadata: {
      refreshWebsiteAudit: Boolean(options.refreshWebsiteAudit),
    },
  });

  const score = await scoreLead(lead, options);
  const recommendedOffer = mapLeadOfferToRevenueOffer(score.bestOffer, lead);

  const summary = aiLeadScoreSummarySchema.parse({
    score: score.score,
    score_reason: score.reasoning,
    recommended_offer: recommendedOffer,
    recommended_offer_label: revenueOfferCatalog[recommendedOffer].label,
    recommended_next_action: recommendRevenueNextAction({
      lead,
      score,
      revenueOffer: recommendedOffer,
    }),
    urgency_level: score.urgencyLevel,
    contactability_level: score.contactabilityLevel,
    language_segment: score.languageSegment,
    outreach_angle: score.outreachAngle,
    estimated_value_label: score.estimatedValueLabel,
    score_breakdown: {
      urgency: score.urgencyScore,
      business_age: score.businessAgeScore,
      funding_need: score.fundingNeedScore,
      website_weakness: score.websiteWeaknessScore,
      language_niche: score.languageNicheScore,
      distress_signal: score.distressSignalScore,
      contract_fit: score.contractFitScore,
      contactability: score.contactabilityScore,
      estimated_value: score.estimatedValueScore,
    },
  });

  await logAiAgentStep({
    agentKey: 'lead_scoring_summary',
    step: 'score-lead',
    status: 'completed',
    entityType: 'lead',
    entityId: lead.id,
    metadata: {
      score: summary.score,
      recommendedOffer: summary.recommended_offer,
      urgencyLevel: summary.urgency_level,
      contactabilityLevel: summary.contactability_level,
    },
  });

  return summary;
}
