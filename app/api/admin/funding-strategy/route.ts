export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createFundingStrategyReviewTask } from '@/lib/admin/tasks';
import { logEvent } from '@/lib/system/logEvent';
import { createAdminClient } from '@/lib/supabase/admin';

const fundingStrategyStatuses = [
  'submitted',
  'awaiting_payment',
  'paid',
  'in_review',
  'strategy_ready',
  'needs_prep',
  'closed',
] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(fundingStrategyStatuses).optional(),
  adminNotes: z.string().trim().max(5000).optional(),
  createFollowupTask: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const parsed = updateSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid funding strategy update.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined) {
    updateData.admin_notes = parsed.data.adminNotes;
  }

  const { data, error } = await supabase
    .from('funding_strategy_requests')
    .update(updateData)
    .eq('id', parsed.data.id)
    .select(
      'id,user_id,user_email,business_name,readiness_score,readiness_tier,status'
    )
    .single();

  if (error) {
    console.error('[admin-funding-strategy] update failed:', error);
    return NextResponse.json(
      { error: 'Unable to update funding strategy request.' },
      { status: 500 }
    );
  }

  await Promise.allSettled([
    logEvent({
      eventType: 'funding_strategy_status_updated',
      actorUserId: adminCheck.user?.id,
      entityType: 'funding_strategy_request',
      entityId: parsed.data.id,
      metadata: {
        status: parsed.data.status,
        adminNotesUpdated: parsed.data.adminNotes !== undefined,
      },
    }),
    parsed.data.createFollowupTask
      ? createFundingStrategyReviewTask({
          requestId: data.id,
          userId: data.user_id,
          userEmail: data.user_email,
          businessName: data.business_name,
          readinessScore: data.readiness_score,
          readinessTier: data.readiness_tier,
          paid: data.status === 'paid' || data.status === 'in_review',
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ success: true, request: data });
}
