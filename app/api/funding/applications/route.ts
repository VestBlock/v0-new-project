export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import { manualFundingApplicationSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = manualFundingApplicationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid funding application item.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: recommendation } = await supabase
    .from('funding_recommendations')
    .select('id')
    .eq('id', parsed.data.recommendation_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!recommendation) {
    return NextResponse.json(
      { error: 'Recommendation not found.' },
      { status: 404 }
    );
  }

  if (parsed.data.product_id) {
    const { data: product } = await supabase
      .from('funding_products')
      .select('id')
      .eq('id', parsed.data.product_id)
      .maybeSingle();

    if (!product) {
      return NextResponse.json(
        { error: 'Funding product not found.' },
        { status: 404 }
      );
    }
  }

  const { data, error } = await supabase
    .from('funding_sequence_items')
    .insert({
      recommendation_id: parsed.data.recommendation_id,
      user_id: user.id,
      product_id: parsed.data.product_id ?? null,
      sequence_order: parsed.data.sequence_order,
      recommended_day: parsed.data.recommended_day,
      status: 'not_started',
      user_notes: parsed.data.user_notes ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[funding-applications] create failed:', error);
    return NextResponse.json(
      { error: 'Unable to create funding application step.' },
      { status: 500 }
    );
  }

  await recordFundingEvent({
    userId: user.id,
    eventType: 'application_step_created',
    adminEventType: 'funding_application_created',
    entityId: data.id,
    metadata: {
      recommendationId: parsed.data.recommendation_id,
      productId: parsed.data.product_id,
      sequenceOrder: parsed.data.sequence_order,
    },
  });

  return NextResponse.json({ sequenceItem: data });
}
