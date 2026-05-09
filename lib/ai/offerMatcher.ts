import { z } from 'zod';

import type { LeadOffer, LeadRecord, LeadScoreBreakdown } from '@/lib/leads/types';

export const revenueOfferKeySchema = z.enum([
  'dealvault_operator_system',
  'business_funding',
  'business_credit_builder',
  'credit_repair_dispute_letters',
  'ai_receptionist_chatbot',
  'appointment_booking_automation',
  'real_estate_funding',
  'grant_funding_roadmap',
  'website_seo_aeo_growth',
  'business_setup_compliance',
  'gov_contract_readiness',
  'spanish_funding_assistance',
]);

export type RevenueOfferKey = z.infer<typeof revenueOfferKeySchema>;

export const revenueOfferCatalog: Record<
  RevenueOfferKey,
  { label: string; summary: string }
> = {
  dealvault_operator_system: {
    label: 'DealVault',
    summary: 'Agreement tracking, payout accountability, proof records, and milestone audit trails for operator teams.',
  },
  business_funding: {
    label: 'Business Funding',
    summary: 'Funding-readiness support for businesses that may qualify soon.',
  },
  business_credit_builder: {
    label: 'Business Credit Builder',
    summary: 'Business credit foundation work before stronger funding moves.',
  },
  credit_repair_dispute_letters: {
    label: 'Credit Repair / Dispute Letters',
    summary: 'Credit-cleanup support where personal-credit friction is still blocking growth.',
  },
  ai_receptionist_chatbot: {
    label: 'AI Receptionist / Chatbot',
    summary: 'Lead-capture and customer-response automation for service businesses.',
  },
  appointment_booking_automation: {
    label: 'AI Appointment Booking',
    summary: 'Booking and qualification automation for appointment-led businesses.',
  },
  real_estate_funding: {
    label: 'Real Estate Funding / Seller Options',
    summary: 'Real-estate deal, seller, and investor-path support.',
  },
  grant_funding_roadmap: {
    label: 'Grant / Funding Roadmap',
    summary: 'Grant-fit and funding-roadmap support for businesses needing a clearer path.',
  },
  website_seo_aeo_growth: {
    label: 'Website / SEO / AEO Growth',
    summary: 'Website improvement, visibility growth, and answer-engine support.',
  },
  business_setup_compliance: {
    label: 'Business Setup / Compliance',
    summary: 'Entity, EIN, and business-setup support for new operators.',
  },
  gov_contract_readiness: {
    label: 'Gov Contract Readiness',
    summary: 'Government contracting and SAM-readiness help.',
  },
  spanish_funding_assistance: {
    label: 'Spanish Funding Assistance',
    summary: 'Spanish-first funding and growth support.',
  },
};

export function mapLeadOfferToRevenueOffer(
  bestOffer: LeadOffer | string | null | undefined,
  lead?: Pick<LeadRecord, 'category' | 'market_segment' | 'lead_type'>
): RevenueOfferKey {
  const offer = String(bestOffer || '').toLowerCase();
  const category = String(lead?.category || '').toLowerCase();
  const marketSegment = String(lead?.market_segment || '').toLowerCase();
  const leadType = String(lead?.lead_type || '').toLowerCase();

  if (
    offer.includes('dealvault') ||
    offer.includes('operator accountability')
  ) {
    return 'dealvault_operator_system';
  }

  if (
    offer.includes('real estate') ||
    category === 'seller_lead' ||
    category === 'real_estate' ||
    leadType.includes('real_estate') ||
    leadType.includes('sell')
  ) {
    return 'real_estate_funding';
  }

  if (offer.includes('gov contract') || category === 'government_contracts') {
    return 'gov_contract_readiness';
  }

  if (offer.includes('spanish')) {
    return 'spanish_funding_assistance';
  }

  if (
    offer.includes('appointment') ||
    category === 'appointment_booking'
  ) {
    return 'appointment_booking_automation';
  }

  if (
    offer.includes('ai receptionist') ||
    category === 'ai_receptionist'
  ) {
    return 'ai_receptionist_chatbot';
  }

  if (
    offer.includes('website') ||
    marketSegment === 'visibility_expansion' ||
    offer.includes('visibility') ||
    offer.includes('seo') ||
    offer.includes('aeo')
  ) {
    return 'website_seo_aeo_growth';
  }

  if (offer.includes('grant')) {
    return 'grant_funding_roadmap';
  }

  if (offer.includes('credit repair') || offer.includes('dispute')) {
    return 'credit_repair_dispute_letters';
  }

  if (offer.includes('business credit')) {
    return 'business_credit_builder';
  }

  if (
    offer.includes('business setup') ||
    offer.includes('compliance') ||
    category === 'new_business_formation' ||
    category === 'business_setup'
  ) {
    return 'business_setup_compliance';
  }

  return 'business_funding';
}

export function recommendRevenueNextAction(input: {
  lead: LeadRecord;
  score: LeadScoreBreakdown;
  revenueOffer: RevenueOfferKey;
}) {
  const { lead, score, revenueOffer } = input;

  if (['sent', 'followup_due'].includes(String(lead.outreach_status || ''))) {
    return 'Review response activity and schedule the next follow-up instead of generating a new cold draft.';
  }

  if (!lead.email && !lead.phone && !lead.website) {
    return 'Enrich the lead first. There is not enough contact data to justify outreach yet.';
  }

  if (!lead.email && lead.phone) {
    return 'Use a phone-first or contact-form-first path while email enrichment runs in parallel.';
  }

  if (score.contactabilityLevel === 'low') {
    return 'Improve contactability before approval. This lead needs better email, phone, or website signals.';
  }

  if (revenueOffer === 'dealvault_operator_system') {
    return 'Route this lead into the DealVault demo path and frame the conversation around agreement tracking, payout clarity, proof records, and milestone accountability.';
  }

  if (revenueOffer === 'real_estate_funding') {
    return 'Route this lead into the real-estate review path and decide whether seller outreach, buyer matching, or lender follow-up should happen first.';
  }

  if (revenueOffer === 'website_seo_aeo_growth') {
    return 'Generate a growth-focused draft and pair it with a website or visibility preview before human review.';
  }

  if (
    revenueOffer === 'ai_receptionist_chatbot' ||
    revenueOffer === 'appointment_booking_automation'
  ) {
    return 'Generate an automation-focused draft and highlight the missed-lead or booking-conversion angle before outreach approval.';
  }

  if (revenueOffer === 'gov_contract_readiness') {
    return 'Use a qualification-first draft that checks contract fit and readiness before offering deeper support.';
  }

  if (score.score >= 85) {
    return 'Fast-track this lead into priority review. The score is strong enough to justify immediate draft review.';
  }

  return 'Generate a clean draft, confirm the recommended offer still fits, and send it through the normal approval path.';
}
