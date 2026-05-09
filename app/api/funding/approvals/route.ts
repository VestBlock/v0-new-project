export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import { getFundingProgressSummary } from '@/lib/funding/repository';
import { fundingApprovalSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = fundingApprovalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid approval record.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('funding_sequence_items')
    .select('*')
    .eq('id', parsed.data.sequence_item_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: 'Funding application step not found.' },
      { status: 404 }
    );
  }

  const approvedAt =
    parsed.data.approval_date && parsed.data.approval_date.length > 0
      ? new Date(parsed.data.approval_date).toISOString()
      : new Date().toISOString();

  const { data, error } = await supabase
    .from('funding_sequence_items')
    .update({
      status: 'approved',
      approved_limit: parsed.data.approved_limit,
      approved_at: approvedAt,
      user_notes: parsed.data.notes ?? existing.user_notes ?? null,
    })
    .eq('id', parsed.data.sequence_item_id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) {
    console.error('[funding-approvals] update failed:', error);
    return NextResponse.json(
      { error: 'Unable to record approval.' },
      { status: 500 }
    );
  }

  const progress = await getFundingProgressSummary(
    supabase,
    user.id,
    data.recommendation_id
  );

  await recordFundingEvent({
    userId: user.id,
    eventType: 'approval_recorded',
    adminEventType: 'funding_approval_recorded',
    entityId: data.id,
    metadata: {
      recommendationId: data.recommendation_id,
      productId: data.product_id,
      approvedLimit: parsed.data.approved_limit,
    },
  });

  return NextResponse.json({ sequenceItem: data, progress });
}
