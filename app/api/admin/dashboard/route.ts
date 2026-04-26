import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: any }>,
  label: string
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.warn(`[admin-dashboard] ${label} unavailable:`, error.message);
    return [];
  }
  return data ?? [];
}

function getDate(row: any) {
  return (
    row?.created_at || row?.uploaded_at || row?.updated_at || new Date(0).toISOString()
  );
}

function countBy<T extends Record<string, any>>(
  rows: T[],
  key: string,
  value: string
) {
  return rows.filter((row) => String(row[key] || '').toLowerCase() === value.toLowerCase()).length;
}

export async function GET() {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const supabase = createAdminClient();

  const [users, reports, jobs, letters, payments, emailEvents, adminActivity, leads] =
    await Promise.all([
      safeRows<any>(
        supabase
          .from('user_profiles')
          .select('id,user_id,email,full_name,role,is_subscribed,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(250),
        'user_profiles'
      ),
      safeRows<any>(
        supabase
          .from('credit_reports')
          .select(
            'id,user_id,user_email,file_name,file_path,file_url,status,email_alert_sent,error_message,admin_notes,created_at,updated_at,uploaded_at,completed_at,analysis_json,dispute_letters_json,ai_analysis'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'credit_reports'
      ),
      safeRows<any>(
        supabase
          .from('analysis_jobs')
          .select(
            'id,user_id,status,original_file_name,file_path,error_message,created_at,updated_at,text_extraction_completed_at,ai_analysis_completed_at'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'analysis_jobs'
      ),
      safeRows<any>(
        supabase
          .from('dispute_letters')
          .select(
            'id,user_id,status,letter_type,creditor_name,account_name,pdf_url,pdf_path,created_at,updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(250),
        'dispute_letters'
      ),
      safeRows<any>(
        supabase
          .from('payments')
          .select('id,user_id,amount,status,payment_method,paypal_transaction_id,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'payments'
      ),
      safeRows<any>(
        supabase
          .from('email_events')
          .select('id,user_id,user_email,event_type,subject,status,provider_message_id,error_message,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'email_events'
      ),
      safeRows<any>(
        supabase
          .from('admin_activity')
          .select('id,actor_user_id,action_type,entity_type,entity_id,metadata_json,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'admin_activity'
      ),
      safeRows<any>(
        supabase
          .from('leads')
          .select('id,lead_type,status,name,email,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(100),
        'leads'
      ),
    ]);

  const reportCountByUser = new Map<string, number>();
  reports.forEach((report) =>
    reportCountByUser.set(report.user_id, (reportCountByUser.get(report.user_id) || 0) + 1)
  );

  const analysisCountByUser = new Map<string, number>();
  jobs.forEach((job) =>
    analysisCountByUser.set(job.user_id, (analysisCountByUser.get(job.user_id) || 0) + 1)
  );

  const usersById = new Map<string, any>();
  users.forEach((user) => {
    usersById.set(user.user_id || user.id, user);
  });

  const creditReports = reports.map((report) => {
    const profile = usersById.get(report.user_id);
    return {
      id: report.id,
      userId: report.user_id,
      userEmail: report.user_email || profile?.email || null,
      userName: profile?.full_name || null,
      fileName: report.file_name || report.original_file_name || 'Credit report',
      filePath: report.file_path || report.file_url || null,
      uploadedAt: report.uploaded_at || report.created_at,
      updatedAt: report.updated_at,
      completedAt: report.completed_at,
      status:
        report.status ||
        (report.ai_analysis || report.analysis_json ? 'completed' : 'uploaded'),
      disputeLettersGenerated:
        Boolean(report.dispute_letters_json) ||
        letters.some((letter) => letter.user_id === report.user_id),
      emailAlertSent:
        Boolean(report.email_alert_sent) ||
        emailEvents.some(
          (event) =>
            event.user_id === report.user_id &&
            String(event.event_type).includes('credit_report')
        ),
      errorMessage: report.error_message,
      adminNotes: report.admin_notes,
      analysisUrl: `/admin-panel/reports/${report.id}`,
    };
  });

  const userManagement = users.map((user) => {
    const userId = user.user_id || user.id;
    return {
      id: userId,
      profileId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role || 'user',
      createdAt: user.created_at,
      subscriptionStatus: user.is_subscribed ? 'paid' : 'free',
      uploads: reportCountByUser.get(userId) || 0,
      analyses: analysisCountByUser.get(userId) || 0,
      lastActivity:
        [
          user.updated_at,
          ...reports.filter((report) => report.user_id === userId).map(getDate),
          ...jobs.filter((job) => job.user_id === userId).map(getDate),
        ]
          .filter(Boolean)
          .sort()
          .at(-1) || user.created_at,
    };
  });

  const completedAnalyses =
    jobs.filter((job) => ['completed', 'COMPLETED'].includes(String(job.status))).length +
    creditReports.filter((report) => report.status === 'completed').length;
  const pendingAnalyses =
    jobs.filter((job) =>
      [
        'pending_ai_analysis',
        'pending_review',
        'uploaded',
        'extracting_text',
        'analyzing',
        'PENDING',
        'PROCESSING',
      ].includes(String(job.status))
    ).length +
    creditReports.filter((report) =>
      ['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'needs_review'].includes(
        String(report.status)
      )
    ).length;

  const recentActivity = [
    ...creditReports.slice(0, 20).map((report) => ({
      id: `report-${report.id}`,
      type: 'credit_report_uploaded',
      label: `Credit report uploaded${report.userEmail ? ` by ${report.userEmail}` : ''}`,
      createdAt: report.uploadedAt,
      href: report.analysisUrl,
    })),
    ...jobs.slice(0, 20).map((job) => ({
      id: `job-${job.id}`,
      type: 'analysis_job',
      label: `Analysis job ${job.status}`,
      createdAt: job.updated_at || job.created_at,
      href: `/analysis/results/${job.id}`,
    })),
    ...emailEvents.slice(0, 20).map((event) => ({
      id: `email-${event.id}`,
      type: event.status === 'failed' ? 'email_failed' : 'email_sent',
      label: `${event.subject} (${event.status})`,
      createdAt: event.created_at,
    })),
    ...payments.slice(0, 20).map((payment) => ({
      id: `payment-${payment.id}`,
      type: 'payment',
      label: `Payment ${payment.status} ${payment.amount ? `$${payment.amount}` : ''}`,
      createdAt: payment.created_at,
    })),
    ...adminActivity.slice(0, 20).map((activity) => ({
      id: `activity-${activity.id}`,
      type: activity.action_type,
      label: `${activity.action_type} ${activity.entity_type || ''}`.trim(),
      createdAt: activity.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 30);

  return NextResponse.json({
    overview: {
      totalUsers: users.length,
      totalCreditReportsUploaded: creditReports.length,
      totalAnalysesCompleted: completedAnalyses,
      totalPendingAnalyses: pendingAnalyses,
      totalDisputeLettersGenerated: letters.length,
      totalPaidUsers: users.filter((user) => Boolean(user.is_subscribed)).length,
      totalCompletedPayments: countBy(payments, 'status', 'completed'),
      totalFundingLeads: leads.length,
    },
    creditReports,
    users: userManagement,
    alerts: {
      emailEvents,
      failedEmailEvents: emailEvents.filter((event) => event.status === 'failed'),
      newReportAlerts: emailEvents.filter(
        (event) => event.event_type === 'admin_credit_report_uploaded'
      ),
      systemErrors: [
        ...emailEvents.filter((event) => event.status === 'failed'),
        ...creditReports.filter((report) => report.status === 'failed'),
      ].slice(0, 30),
    },
    payments,
    leads,
    recentActivity,
  });
}
