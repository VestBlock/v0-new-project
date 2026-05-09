export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';
import { saveServiceDeliverable } from '@/lib/services/aiServiceDeliverables';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFundingProducts } from '@/lib/funding/repository';
import { generatePublicFundingRecommendation } from '@/lib/funding/publicFundingRecommendation';
import { captureServerEvent } from '@/lib/analytics/server';
import { analyticsEvents } from '@/lib/analytics/events';

const fundingLeadSchema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  business_type: z.string().trim().min(2).max(140),
  funding_amount: z.string().trim().min(1).max(80),
  credit_score: z.string().trim().min(2).max(20),
  message: z.string().trim().max(1600).optional().or(z.literal('')),
  eligibilitySnapshot: z
    .object({
      businessStage: z.string().trim().max(80).optional().or(z.literal('')),
      businessAgeMonths: z.coerce.number().min(0).max(600).optional(),
      monthlyRevenue: z.coerce.number().min(0).max(100000000).optional(),
      personalCreditScore: z.string().trim().max(40).optional().or(z.literal('')),
      currentUtilization: z.string().trim().max(40).optional().or(z.literal('')),
      recentInquiries: z.string().trim().max(40).optional().or(z.literal('')),
      hasEin: z.boolean().optional(),
      hasBusinessBank: z.boolean().optional(),
      hasBusinessCreditCard: z.boolean().optional(),
      requestedFundingAmount: z.coerce.number().min(0).max(10000000).optional(),
      useOfFunds: z.string().trim().max(1600).optional().or(z.literal('')),
    })
    .optional(),
});

export async function POST(req: Request) {
  const parsed = fundingLeadSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Check the funding form and try again.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = createAdminClient();
  const summary = `Business funding lead for ${data.business_type}; requested ${data.funding_amount}; credit score ${data.credit_score}.`;
  const products = await getFundingProducts(supabase);
  const fundingPlan = generatePublicFundingRecommendation(
    {
      businessType: data.business_type,
      requestedFundingAmount: data.funding_amount,
      creditScore: data.credit_score,
      notes: data.message || '',
      snapshot: data.eligibilitySnapshot || null,
    },
    products
  );

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      lead_type: 'business_funding',
      status: 'new',
      source: 'funding_form',
      source_url: '/funding',
      category: 'business_funding',
      name: data.name,
      email: data.email,
      phone: data.phone,
      best_offer: 'Business Funding',
      pain_signal: `Funding request ${data.funding_amount}; credit ${data.credit_score}; business type ${data.business_type}.`,
      contact_info: {
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
      form_data: {
        ...data,
        packageKey: 'funding_readiness_snapshot',
        packageTitle: 'Funding Prep Snapshot',
        packagePrice: '$149',
        packageDeliverables: [
          'Funding-prep score and risk notes',
          'Document checklist',
          'Next best funding path recommendation',
          'Admin follow-up task for VestBlock review',
        ],
        complianceNote:
          'Does not guarantee approval, terms, limits, or funding availability.',
      },
      market_segment: 'business_funding',
      outreach_angle: 'Funding preparation and capital access',
      notes: data.message || summary,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[funding-lead] insert failed:', error);
    return NextResponse.json(
      { error: 'Unable to submit funding lead.' },
      { status: 500 }
    );
  }

  void runNewLeadAutomation({
    leadId: lead.id,
    leadType: 'business_funding',
    name: data.name,
    email: data.email,
    phone: data.phone,
    sourcePath: '/funding',
    summary,
    metadata: {
      businessType: data.business_type,
      fundingAmount: data.funding_amount,
      creditScore: data.credit_score,
    },
  }).catch((automationError) => {
    console.error('[funding-lead] follow-up automation failed:', automationError);
  });

  void saveServiceDeliverable({
    leadId: lead.id,
    packageKey: 'funding_readiness_snapshot',
    status: 'ready_for_review',
    title: fundingPlan.deliverable.title,
    summary: fundingPlan.deliverable.summary,
    previewText: fundingPlan.strategy.strategySummary,
    deliverableJson: fundingPlan.deliverable,
    deliverableMarkdown: null,
    generatedAt: new Date().toISOString(),
  }).catch((deliverableError) => {
    console.error('[funding-lead] deliverable save failed:', deliverableError);
  });

  void captureServerEvent({
    distinctId: data.email,
    event: analyticsEvents.fundingLeadSubmitted,
    properties: {
      leadId: lead.id,
      businessType: data.business_type,
      fundingAmount: data.funding_amount,
      creditScore: data.credit_score,
      hasEligibilitySnapshot: Boolean(data.eligibilitySnapshot),
      sourcePath: '/funding',
    },
  });

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    fundingPlan: {
      confidence: fundingPlan.confidence,
      readiness: fundingPlan.readiness,
      strategy: {
        recommendedPath: fundingPlan.strategy.recommendedPath,
        estimatedFundingMin: fundingPlan.strategy.estimatedFundingMin,
        estimatedFundingMax: fundingPlan.strategy.estimatedFundingMax,
        strategySummary: fundingPlan.strategy.strategySummary,
        warnings: fundingPlan.strategy.warnings,
      },
      recommendedProducts: fundingPlan.recommendedProducts.slice(0, 3),
    },
  });
}
