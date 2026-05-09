export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import { fundingApplicationStatusSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getStatusTimestamps(status: string, now: string) {
  if (status === 'opened') return { opened_at: now };
  if (status === 'applied') return { applied_at: now };
  if (status === 'approved') return { approved_at: now };
  if (status === 'denied') return { denied_at: now };
  return {};
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = fundingApplicationStatusSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid application update.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const now = new Date().toISOString();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('funding_sequence_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: 'Funding application step not found.' },
      { status: 404 }
    );
  }

  const updatePayload = {
    status: parsed.data.status,
    user_notes: parsed.data.user_notes ?? existing.user_notes ?? null,
    screenshot_url: parsed.data.screenshot_url ?? existing.screenshot_url ?? null,
    ...getStatusTimestamps(parsed.data.status, now),
  };

  const { data, error } = await supabase
    .from('funding_sequence_items')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) {
    console.error('[funding-applications] update failed:', error);
    return NextResponse.json(
      { error: 'Unable to update funding application step.' },
      { status: 500 }
    );
  }

  await recordFundingEvent({
    userId: user.id,
    eventType: 'application_status_updated',
    adminEventType: 'funding_application_status_updated',
    entityId: data.id,
    metadata: {
      status: parsed.data.status,
      recommendationId: data.recommendation_id,
      productId: data.product_id,
    },
  });

  return NextResponse.json({ sequenceItem: data });
}
