export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerUser } from '@/lib/auth/admin';
import {
  evaluateCardFundingReadiness,
  type CreditCardFundingAnswers,
} from '@/lib/funding/cardStacking';
import { runFundingStrategySubmittedAutomation } from '@/lib/funding/fundingStrategyAutomation';
import { createAdminClient } from '@/lib/supabase/admin';

const fundingStrategySchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  businessName: z.string().trim().min(2).max(160),
  businessStage: z.string().trim().min(2).max(80),
  businessAgeMonths: z.coerce.number().int().min(0).max(600).default(0),
  monthlyRevenue: z.coerce.number().min(0).max(100000000).default(0),
  personalCreditScore: z.enum([
    'under_620',
    '620_659',
    '660_699',
    '700_739',
    '740_plus',
  ]),
  currentUtilization: z.enum([
    'under_10',
    '10_29',
    '30_49',
    '50_74',
    '75_plus',
  ]),
  recentInquiries: z.enum(['0_1', '2_3', '4_6', '7_plus']),
  hasEin: z.boolean().default(false),
  hasBusinessBank: z.boolean().default(false),
  hasBusinessCreditCard: z.boolean().default(false),
  requestedFundingAmount: z.coerce.number().min(0).max(10000000).default(0),
  useOfFunds: z.string().trim().min(10).max(1600),
  consentHardInquiries: z.boolean(),
  consentNoGuarantee: z.boolean(),
  consentTermsReview: z.boolean(),
  consentSuccessFee: z.boolean(),
});

export async function POST(req: Request) {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Sign in before submitting a funding strategy request.' },
      { status: 401 }
    );
  }

  const parsed = fundingStrategySchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Check the funding strategy form and try again.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const input = parsed.data;

  if (
    !input.consentHardInquiries ||
    !input.consentNoGuarantee ||
    !input.consentTermsReview ||
    !input.consentSuccessFee
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Please confirm the review terms before submitting a business funding strategy request.',
      },
      { status: 400 }
    );
  }

  const answers: CreditCardFundingAnswers = {
    fullName: input.fullName,
    email: input.email || user.email || '',
    phone: input.phone,
    businessName: input.businessName,
    businessStage: input.businessStage,
    businessAgeMonths: input.businessAgeMonths,
    monthlyRevenue: input.monthlyRevenue,
    personalCreditScore: input.personalCreditScore,
    currentUtilization: input.currentUtilization,
    recentInquiries: input.recentInquiries,
    hasEin: input.hasEin,
    hasBusinessBank: input.hasBusinessBank,
    hasBusinessCreditCard: input.hasBusinessCreditCard,
    requestedFundingAmount: input.requestedFundingAmount,
    useOfFunds: input.useOfFunds,
  };
  const readiness = evaluateCardFundingReadiness(answers);
  const canCheckout = true;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('funding_strategy_requests')
    .insert({
      user_id: user.id,
      user_email: input.email || user.email,
      full_name: input.fullName,
      phone: input.phone || null,
      business_name: input.businessName,
      business_stage: input.businessStage,
      business_age_months: input.businessAgeMonths,
      monthly_revenue: input.monthlyRevenue,
      personal_credit_score: input.personalCreditScore,
      current_utilization: input.currentUtilization,
      recent_inquiries: input.recentInquiries,
      has_ein: input.hasEin,
      has_business_bank: input.hasBusinessBank,
      has_business_credit_card: input.hasBusinessCreditCard,
      requested_funding_amount: input.requestedFundingAmount,
      use_of_funds: input.useOfFunds,
      readiness_score: readiness.score,
      readiness_tier: readiness.tier,
      readiness_summary: readiness.summary,
      strengths_json: readiness.strengths,
      risks_json: readiness.risks,
      next_steps_json: readiness.nextSteps,
      consent_hard_inquiries: input.consentHardInquiries,
      consent_no_guarantee: input.consentNoGuarantee,
      consent_terms_review: input.consentTermsReview,
      consent_success_fee: input.consentSuccessFee,
      success_fee_rate: 0.1,
      status: 'awaiting_payment',
      payment_status: 'unpaid',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[funding-strategy] insert failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to save the funding strategy request.' },
      { status: 500 }
    );
  }

  await runFundingStrategySubmittedAutomation({
    requestId: data.id,
    userId: user.id,
    userEmail: data.user_email,
    fullName: data.full_name,
    phone: data.phone,
    businessName: data.business_name,
    readinessScore: readiness.score,
    readinessTier: readiness.tier,
    summary: readiness.summary,
    metadata: {
      planPurpose:
        readiness.tier === 'needs_prep'
          ? 'eligibility_builder'
          : 'funding_strategy',
      requestedFundingAmount: data.requested_funding_amount,
      businessStage: data.business_stage,
    },
  });

  return NextResponse.json({
    success: true,
    request: data,
    readiness,
    canCheckout,
    checkoutAmount: 300,
  });
}
