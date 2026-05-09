export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import {
  getFundingProducts,
  getFundingSequenceWithProducts,
  getLatestFundingProfile,
  getLatestFundingRecommendation,
} from '@/lib/funding/repository';
import { recommendationRequestSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { generateFundingStrategy } from '@/lib/funding/strategy-engine';
import { persistBorrowerLenderMatches } from '@/lib/lenders/service';
import { createAdminClient } from '@/lib/supabase/admin';
import { FUNDING_ASSISTANT_DISCLAIMER, type FundingProfile } from '@/lib/funding/types';

function monthsInBusiness(startDate?: string | null) {
  if (!startDate) return null;
  const parsed = Date.parse(startDate);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / (30 * 24 * 60 * 60 * 1000)));
}

export async function GET() {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const supabase = createAdminClient();
  const [recommendation, profile] = await Promise.all([
    getLatestFundingRecommendation(supabase, user.id),
    getLatestFundingProfile(supabase, user.id),
  ]);

  if (!recommendation?.id) {
    return NextResponse.json({
      recommendation: null,
      sequenceItems: [],
      disclaimer: FUNDING_ASSISTANT_DISCLAIMER,
    });
  }

  const sequenceItems = await getFundingSequenceWithProducts(
    supabase,
    recommendation.id
  );

  const lenderMatches = await persistBorrowerLenderMatches({
    userId: user.id,
    fundingProfileId: profile?.id,
    fundingRecommendationId: recommendation.id,
    serviceType: recommendation.recommended_path || 'Funding Prep Plan',
    mode: profile?.mode,
    borrowerState: null,
    businessIndustry: profile?.business_industry || null,
    timeInBusinessMonths: monthsInBusiness(profile?.business_start_date),
    ficoEstimate: profile?.fico_estimate || null,
    fundingGoalAmount: profile?.funding_goal_amount || null,
    languagePreference: 'en',
  });

  return NextResponse.json({
    recommendation,
    sequenceItems,
    lenderMatches,
    disclaimer: FUNDING_ASSISTANT_DISCLAIMER,
  });
}

export async function POST(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = recommendationRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recommendation request.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let profile: FundingProfile | null = null;

  if (parsed.data.profile_id) {
    const { data } = await supabase
      .from('funding_profiles')
      .select('*')
      .eq('id', parsed.data.profile_id)
      .eq('user_id', user.id)
      .maybeSingle();
    profile = (data as FundingProfile | null) ?? null;
  } else {
    profile = await getLatestFundingProfile(supabase, user.id);
  }

  if (!profile?.id) {
    return NextResponse.json(
      { error: 'Create your funding profile before generating a recommendation.' },
      { status: 400 }
    );
  }

  const products = await getFundingProducts(supabase);
  const strategy = generateFundingStrategy(profile, products);

  const { data: recommendation, error: recommendationError } = await supabase
    .from('funding_recommendations')
    .insert({
      user_id: user.id,
      profile_id: profile.id,
      mode: profile.mode,
      recommended_path: strategy.recommendedPath,
      readiness_score: strategy.readinessScore,
      estimated_funding_min: strategy.estimatedFundingMin,
      estimated_funding_max: strategy.estimatedFundingMax,
      strategy_summary: strategy.strategySummary,
      warnings: strategy.warnings,
    })
    .select('*')
    .single();

  if (recommendationError || !recommendation?.id) {
    console.error('[funding-recommendation] save failed:', recommendationError);
    return NextResponse.json(
      { error: 'Unable to store funding recommendation.' },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabase
    .from('funding_profiles')
    .update({
      risk_level: strategy.riskLevel,
      readiness_score: strategy.readinessScore,
    })
    .eq('id', profile.id)
    .eq('user_id', user.id);

  if (profileError) {
    console.warn('[funding-recommendation] profile score update failed:', profileError.message);
  }

  const sequencePayload = strategy.recommendedSequence.map((item) => ({
    recommendation_id: recommendation.id,
    user_id: user.id,
    product_id: item.product_id,
    sequence_order: item.sequence_order,
    recommended_day: item.recommended_day,
    status: 'not_started',
  }));

  const { error: sequenceError } = await supabase
    .from('funding_sequence_items')
    .insert(sequencePayload);

  if (sequenceError) {
    console.error('[funding-recommendation] sequence insert failed:', sequenceError);
    return NextResponse.json(
      { error: 'Recommendation saved, but the funding sequence could not be created.' },
      { status: 500 }
    );
  }

  const hydratedSequence = await getFundingSequenceWithProducts(
    supabase,
    recommendation.id
  );

  const lenderMatches = await persistBorrowerLenderMatches({
    userId: user.id,
    fundingProfileId: profile.id,
    fundingRecommendationId: recommendation.id,
    serviceType: strategy.recommendedPath,
    mode: profile.mode,
    borrowerState: null,
    businessIndustry: profile.business_industry || null,
    timeInBusinessMonths: monthsInBusiness(profile.business_start_date),
    ficoEstimate: profile.fico_estimate || null,
    fundingGoalAmount: profile.funding_goal_amount || null,
    languagePreference: 'en',
  });

  await recordFundingEvent({
    userId: user.id,
    eventType: 'recommendation_generated',
    adminEventType: 'funding_recommendation_generated',
    entityId: recommendation.id,
    metadata: {
      mode: profile.mode,
      recommendedPath: strategy.recommendedPath,
      readinessScore: strategy.readinessScore,
      riskLevel: strategy.riskLevel,
      estimatedFundingMin: strategy.estimatedFundingMin,
      estimatedFundingMax: strategy.estimatedFundingMax,
    },
  });

  return NextResponse.json({
    recommendation: {
      ...recommendation,
      warnings: strategy.warnings,
    },
    sequenceItems: hydratedSequence,
    profile: {
      ...profile,
      risk_level: strategy.riskLevel,
      readiness_score: strategy.readinessScore,
    },
    lenderMatches,
    disclaimer: FUNDING_ASSISTANT_DISCLAIMER,
  });
}
