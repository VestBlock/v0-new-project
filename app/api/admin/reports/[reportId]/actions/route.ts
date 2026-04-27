import { NextResponse } from 'next/server';
import { createAdminTask } from '@/lib/admin/tasks';
import { checkAdminAccess } from '@/lib/auth/admin';
import {
  sendAdminAlertEmail,
  sendAdminAnalysisCompletedEmail,
  sendUserAnalysisCompletedEmail,
  sendUserCreditReportReceivedEmail,
} from '@/lib/email/sendEmail';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

const actions = [
  'resend_upload_confirmation',
  'resend_analysis_completed',
  'create_followup_task',
] as const;

type AdminReportAction = (typeof actions)[number];

function isReportAction(value: unknown): value is AdminReportAction {
  return actions.includes(value as AdminReportAction);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (!isReportAction(action)) {
    return NextResponse.json({ error: 'Invalid report action.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: report, error } = await supabase
    .from('credit_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  let userEmail = report.user_email;
  if (!userEmail && report.user_id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .or(`id.eq.${report.user_id},user_id.eq.${report.user_id}`)
      .maybeSingle();
    userEmail = profile?.email ?? null;
  }

  if (action === 'resend_upload_confirmation') {
    await Promise.all([
      sendAdminAlertEmail({
        userEmail,
        fileName: report.file_name,
        uploadDate: report.uploaded_at || report.created_at,
        userId: report.user_id,
        reportId,
        dashboardPath: `/admin-panel/reports/${reportId}`,
      }),
      sendUserCreditReportReceivedEmail({
        userEmail,
        userId: report.user_id,
        fileName: report.file_name,
      }),
    ]);
  }

  if (action === 'resend_analysis_completed') {
    await Promise.all([
      sendUserAnalysisCompletedEmail({
        userEmail,
        userId: report.user_id,
        analysisId: reportId,
        dashboardPath: `/credit-dashboard/${reportId}`,
      }),
      sendAdminAnalysisCompletedEmail({
        userEmail,
        userId: report.user_id,
        analysisId: reportId,
      }),
    ]);
  }

  if (action === 'create_followup_task') {
    await createAdminTask({
      title: 'Follow up on credit report',
      description:
        body?.note ||
        'Review this credit report, confirm the customer next step, and update the workflow status if needed.',
      taskType: 'credit_report_manual_followup',
      priority: body?.priority || 'normal',
      userId: report.user_id,
      userEmail,
      entityType: 'credit_report',
      entityId: reportId,
      createdBy: adminCheck.user?.id,
      metadata: {
        source: 'admin_report_detail',
        reportStatus: report.status,
      },
    });
  }

  await logEvent({
    eventType: 'admin_action',
    actorUserId: adminCheck.user?.id,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { action },
  });

  return NextResponse.json({ ok: true, action });
}
