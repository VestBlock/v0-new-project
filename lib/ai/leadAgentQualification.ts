import { z } from 'zod'

import { buildAiLeadScoreSummary, type AiLeadScoreSummary } from '@/lib/ai/leadScoring'
import { buildAiOutreachDraft, type AiOutreachDraft } from '@/lib/ai/outreachWriter'
import { logAiAgentStep } from '@/lib/ai/agentLogger'
import type { LeadNoteRecord, LeadRecord, OutreachSendEventRecord, TargetMarketRecord } from '@/lib/leads/types'
import { getOpenAIClient } from '@/lib/openai-server'

export const leadAgentQualificationSchema = z.object({
  qualification_category: z.enum([
    'qualified_now',
    'follow_up',
    'partner_referral',
    'nurture',
    'manual_review',
    'do_not_contact',
  ]),
  qualification_reason: z.string().min(1),
  research_summary: z.array(z.string().min(1)).min(2).max(5),
  missing_information: z.array(z.string().min(1)).max(5),
  recommended_operator_action: z.string().min(1),
  approval_recommendation: z.enum([
    'approve_outreach',
    'route_to_partner',
    'research_more',
    'hold',
    'do_not_contact',
  ]),
  approval_reason: z.string().min(1),
  best_channel: z.enum(['email', 'sms', 'phone_script', 'partner', 'manual_review']),
  customer_reply_goal: z.string().min(1),
})

export type LeadAgentQualification = z.infer<typeof leadAgentQualificationSchema>

type LeadResearchBundle = {
  lead: LeadRecord
  notes?: LeadNoteRecord[]
  sendEvents?: OutreachSendEventRecord[]
  market?: TargetMarketRecord | null
}

function listResearchFacts(bundle: LeadResearchBundle, scoreSummary: AiLeadScoreSummary, outreachDraft: AiOutreachDraft) {
  const lead = bundle.lead
  const facts = [
    lead.business_name ? `Business name: ${lead.business_name}` : null,
    lead.category ? `Category: ${lead.category}` : null,
    lead.niche ? `Niche: ${lead.niche}` : null,
    lead.city || lead.state ? `Market: ${[lead.city, lead.state].filter(Boolean).join(', ')}` : null,
    lead.website ? `Website present: yes` : 'Website present: no',
    lead.email ? `Usable email on record: ${lead.email}` : 'Usable email on record: no',
    lead.phone ? `Phone on record: ${lead.phone}` : 'Phone on record: no',
    lead.pain_signal ? `Pain signal: ${lead.pain_signal}` : null,
    lead.best_offer ? `Current best offer: ${lead.best_offer}` : null,
    `Lead score: ${scoreSummary.score}`,
    `Recommended revenue offer: ${scoreSummary.recommended_offer_label}`,
    `Urgency: ${scoreSummary.urgency_level}`,
    `Contactability: ${scoreSummary.contactability_level}`,
    `Outreach angle: ${scoreSummary.outreach_angle}`,
    `Primary outreach channel: ${outreachDraft.primary_channel}`,
    bundle.market ? `Target market score: ${bundle.market.final_score}` : null,
    bundle.notes?.length ? `Internal note count: ${bundle.notes.length}` : null,
    bundle.sendEvents?.length ? `Prior send events: ${bundle.sendEvents.length}` : 'Prior send events: 0',
  ]

  return facts.filter((value): value is string => Boolean(value))
}

function buildFallbackQualification(
  bundle: LeadResearchBundle,
  scoreSummary: AiLeadScoreSummary,
  outreachDraft: AiOutreachDraft
): LeadAgentQualification {
  const lead = bundle.lead
  const hasEmail = Boolean(lead.email)
  const hasPhone = Boolean(lead.phone)
  const missingInformation: string[] = []

  if (!lead.website) missingInformation.push('Confirm whether the business has an active website.')
  if (!hasEmail && !hasPhone) missingInformation.push('Find a direct contact path before sending outreach.')
  if (!lead.business_name) missingInformation.push('Confirm the real business name.')
  if (!lead.city || !lead.state) missingInformation.push('Confirm city and state for market-specific messaging.')

  const category =
    scoreSummary.score >= 80 && (hasEmail || hasPhone)
      ? 'qualified_now'
      : scoreSummary.score >= 65
        ? 'follow_up'
        : scoreSummary.recommended_offer === 'real_estate_funding'
          ? 'partner_referral'
          : !hasEmail && !hasPhone
            ? 'manual_review'
            : 'nurture'

  const approvalRecommendation =
    category === 'qualified_now'
      ? 'approve_outreach'
      : category === 'partner_referral'
        ? 'route_to_partner'
        : category === 'manual_review'
          ? 'research_more'
          : category === 'nurture'
            ? 'hold'
            : 'approve_outreach'

  const bestChannel =
    approvalRecommendation === 'route_to_partner'
      ? 'partner'
      : outreachDraft.primary_channel === 'email' && hasEmail
        ? 'email'
        : outreachDraft.primary_channel === 'phone_script' && hasPhone
          ? 'phone_script'
          : hasPhone
            ? 'sms'
            : 'manual_review'

  return leadAgentQualificationSchema.parse({
    qualification_category: category,
    qualification_reason:
      category === 'qualified_now'
        ? 'The lead is commercially relevant, contactable, and strong enough to justify immediate outreach.'
        : category === 'partner_referral'
          ? 'The lead looks more valuable when routed into a funding or real-estate partner path than handled as a generic nurture lead.'
          : category === 'manual_review'
            ? 'The fit may be real, but contactability or lead certainty is too weak for confident autopilot action.'
            : 'The lead shows some fit, but it still needs more context, contactability, or timing before a stronger move.',
    research_summary: [
      `${lead.business_name || lead.name || 'Lead'} maps most strongly to ${scoreSummary.recommended_offer_label}.`,
      `The current lead score is ${scoreSummary.score} with ${scoreSummary.contactability_level} contactability and ${scoreSummary.urgency_level} urgency.`,
      `${outreachDraft.primary_channel === 'email' ? 'Email' : outreachDraft.primary_channel === 'phone_script' ? 'Phone' : 'SMS'} is the best first channel from the current signal set.`,
    ],
    missing_information: missingInformation.slice(0, 5),
    recommended_operator_action:
      approvalRecommendation === 'approve_outreach'
        ? `Approve a ${bestChannel === 'partner' ? 'partner handoff' : bestChannel} touch and watch for response quality.`
        : approvalRecommendation === 'route_to_partner'
          ? 'Route this into the best-fit partner or lender path before generic follow-up.'
          : approvalRecommendation === 'research_more'
            ? 'Enrich the contact record and confirm business context before approving outreach.'
            : 'Hold this lead in nurture until contactability or fit improves.',
    approval_recommendation: approvalRecommendation,
    approval_reason:
      approvalRecommendation === 'approve_outreach'
        ? 'The lead is strong enough and contactable enough to justify immediate action.'
        : approvalRecommendation === 'route_to_partner'
          ? 'A specialized partner path is more likely to monetize this lead than generic outreach.'
          : approvalRecommendation === 'research_more'
            ? 'There is not enough confidence yet to send or route automatically.'
            : 'The lead should not advance until better fit or timing is visible.',
    best_channel: bestChannel,
    customer_reply_goal: scoreSummary.recommended_next_action,
  })
}

export async function buildLeadAgentQualification(
  bundle: LeadResearchBundle,
  dependencies?: {
    scoreSummary?: AiLeadScoreSummary
    outreachDraft?: AiOutreachDraft
  }
): Promise<LeadAgentQualification> {
  const lead = bundle.lead

  await logAiAgentStep({
    agentKey: 'lead_agent_qualification',
    step: 'qualify-lead',
    status: 'started',
    entityType: 'lead',
    entityId: lead.id,
  })

  const scoreSummary = dependencies?.scoreSummary || (await buildAiLeadScoreSummary(lead))
  const outreachDraft = dependencies?.outreachDraft || (await buildAiOutreachDraft(lead))
  const openai = getOpenAIClient()

  if (!openai) {
    const fallback = buildFallbackQualification(bundle, scoreSummary, outreachDraft)
    await logAiAgentStep({
      agentKey: 'lead_agent_qualification',
      step: 'qualify-lead',
      status: 'completed',
      entityType: 'lead',
      entityId: lead.id,
      metadata: {
        fallback: true,
        category: fallback.qualification_category,
        approvalRecommendation: fallback.approval_recommendation,
      },
    })
    return fallback
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a revenue-minded inbound lead qualification agent for VestBlock. Return valid JSON only. Be practical, conservative, and operator-safe. Focus on whether the lead should be pursued now, routed to a partner, held for more research, or deprioritized.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            lead: {
              id: lead.id,
              businessName: lead.business_name,
              name: lead.name,
              source: lead.source,
              category: lead.category,
              niche: lead.niche,
              city: lead.city,
              state: lead.state,
              email: lead.email,
              phone: lead.phone,
              website: lead.website,
              painSignal: lead.pain_signal,
              leadScore: lead.lead_score,
              bestOffer: lead.best_offer,
              contactInfo: lead.contact_info,
              metadata: lead.metadata_json,
            },
            scoreSummary,
            outreachDraft,
            market: bundle.market
              ? {
                  city: bundle.market.city,
                  state: bundle.market.state,
                  metroArea: bundle.market.metro_area,
                  finalScore: bundle.market.final_score,
                }
              : null,
            recentNotes: (bundle.notes || []).slice(0, 3).map((note) => note.note),
            recentSendStatuses: (bundle.sendEvents || []).slice(0, 5).map((event) => event.status),
            researchFacts: listResearchFacts(bundle, scoreSummary, outreachDraft),
            requiredOutput: {
              qualification_category: ['qualified_now', 'follow_up', 'partner_referral', 'nurture', 'manual_review', 'do_not_contact'],
              approval_recommendation: ['approve_outreach', 'route_to_partner', 'research_more', 'hold', 'do_not_contact'],
              best_channel: ['email', 'sms', 'phone_script', 'partner', 'manual_review'],
            },
            rules: [
              'Do not recommend approve_outreach when there is no practical contact path.',
              'Use partner_referral when the lead is better monetized through a funding, lender, buyer, or specialized partner route.',
              'Use manual_review or research_more when fit is plausible but data quality is weak.',
              'Keep research_summary concrete and brief.',
              'Keep missing_information focused on what would unblock action.',
            ],
          }),
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('OpenAI returned no qualification content.')
    const parsed = leadAgentQualificationSchema.parse(JSON.parse(content))

    await logAiAgentStep({
      agentKey: 'lead_agent_qualification',
      step: 'qualify-lead',
      status: 'completed',
      entityType: 'lead',
      entityId: lead.id,
      metadata: {
        fallback: false,
        category: parsed.qualification_category,
        approvalRecommendation: parsed.approval_recommendation,
      },
    })

    return parsed
  } catch {
    const fallback = buildFallbackQualification(bundle, scoreSummary, outreachDraft)
    await logAiAgentStep({
      agentKey: 'lead_agent_qualification',
      step: 'qualify-lead',
      status: 'completed',
      entityType: 'lead',
      entityId: lead.id,
      metadata: {
        fallback: true,
        category: fallback.qualification_category,
        approvalRecommendation: fallback.approval_recommendation,
      },
    })
    return fallback
  }
}
