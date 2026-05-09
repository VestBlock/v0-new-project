export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import {
  getLatestFundingProfile,
  getLatestFundingRecommendation,
} from '@/lib/funding/repository';
import { fundingPaymentPlanSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { getFundingPaymentPlans } from '@/lib/funding/payment-plans';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = fundingPaymentPlanSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payment plan request.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const profile = await getLatestFundingProfile(supabase, user.id);

  let recommendation = null;
  if (parsed.data.recommendation_id) {
    const { data } = await supabase
      .from('funding_recommendations')
      .select('*')
      .eq('id', parsed.data.recommendation_id)
      .eq('user_id', user.id)
      .maybeSingle();
    recommendation = data;
  } else {
    recommendation = await getLatestFundingRecommendation(supabase, user.id);
  }

  const planResponse = getFundingPaymentPlans({
    profile,
    recommendation,
  });

  let paymentRecord = null;
  if (parsed.data.selected_plan && recommendation?.id) {
    const selectedPlan = planResponse.plans.find(
      (plan) => plan.id === parsed.data.selected_plan
    );

    if (selectedPlan) {
      const amountDue =
        selectedPlan.discountedPrice ?? selectedPlan.price ?? 0;

      const { data: existing } = await supabase
        .from('funding_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('recommendation_id', recommendation.id)
        .eq('payment_plan', selectedPlan.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data } = await supabase
          .from('funding_payments')
          .update({
            standard_fee: selectedPlan.price,
            discounted_fee: selectedPlan.discountedPrice ?? null,
            amount_due: amountDue,
            status: 'not_started',
          })
          .eq('id', existing.id)
          .select('*')
          .maybeSingle();
        paymentRecord = data;
      } else {
        const { data } = await supabase
          .from('funding_payments')
          .insert({
            user_id: user.id,
            recommendation_id: recommendation.id,
            payment_plan: selectedPlan.id,
            standard_fee: selectedPlan.price,
            discounted_fee: selectedPlan.discountedPrice ?? null,
            amount_due: amountDue,
            amount_paid: 0,
            status: 'not_started',
          })
          .select('*')
          .maybeSingle();
        paymentRecord = data;
      }
    }
  }

  await recordFundingEvent({
    userId: user.id,
    eventType: 'payment_plan_viewed',
    adminEventType: 'funding_payment_plan_requested',
    entityId: recommendation?.id ?? null,
    metadata: {
      recommendedPlanId: planResponse.recommendedPlanId,
      selectedPlan: parsed.data.selected_plan ?? null,
      recommendationId: recommendation?.id ?? null,
    },
  });

  return NextResponse.json({
    ...planResponse,
    paymentRecord,
  });
}
