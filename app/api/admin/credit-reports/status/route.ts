import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { creditRepairStatuses } from '@/lib/workflows/creditRepairWorkflow';
import { logEvent } from '@/lib/system/logEvent';
import { createNeedsReviewTask } from '@/lib/admin/tasks';

export async function PATCH(request: Request) {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const reportId = body?.reportId as string | undefined;
  const status = body?.status as string | undefined;
  const adminNotes = body?.adminNotes as string | undefined;

  if (!reportId || !status) {
    return NextResponse.json(
      { error: 'reportId and status are required.' },
      { status: 400 }
    );
  }

  if (!creditRepairStatuses.includes(status as any)) {
    return NextResponse.json({ error: 'Invalid report status.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminNotes !== undefined) {
    payload.admin_notes = adminNotes;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('credit_reports')
    .update(payload)
    .eq('id', reportId)
    .select('id,user_id,user_email,status,admin_notes,updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    eventType: 'admin_action',
    actorUserId: adminCheck.user?.id,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { action: 'status_update', status },
  });

  if (status === 'needs_review') {
    await createNeedsReviewTask({
      reportId,
      userId: data.user_id,
      userEmail: data.user_email,
      reason: adminNotes || 'Admin marked this report as needs_review.',
      createdBy: adminCheck.user?.id,
    });
  }

  return NextResponse.json({ report: data });
}
