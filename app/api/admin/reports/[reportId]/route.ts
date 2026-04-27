import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/auth/admin';
import {
  buildCreditReportTimeline,
  summarizeCreditReportOperations,
} from '@/lib/admin/reportTimeline';
import { createAdminClient } from '@/lib/supabase/admin';

async function safeMaybeSingle<T>(
  query: PromiseLike<{ data: T | null; error: any }>,
  label: string
) {
  const { data, error } = await query;
  if (error) {
    console.warn(`[admin-report-detail] ${label} unavailable:`, error.message);
    return null;
  }
  return data;
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: any }>,
  label: string
) {
  const { data, error } = await query;
  if (error) {
    console.warn(`[admin-report-detail] ${label} unavailable:`, error.message);
    return [];
  }
  return data ?? [];
}

function buildOrFilter(filters: Array<string | false | null | undefined>) {
  return filters.filter(Boolean).join(',');
}

export async function GET(
  _request: Request,
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

  const supabase = createAdminClient();
  const report = await safeMaybeSingle<any>(
    supabase.from('credit_reports').select('*').eq('id', reportId).maybeSingle(),
    'credit_reports'
  );

  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  const userId = report.user_id;
  const profileFilter = buildOrFilter([
    userId && `id.eq.${userId}`,
    userId && `user_id.eq.${userId}`,
    report.user_email && `email.eq.${report.user_email}`,
  ]);
  const profile = profileFilter
    ? await safeMaybeSingle<any>(
        supabase
          .from('user_profiles')
          .select('*')
          .or(profileFilter)
          .maybeSingle(),
        'user_profiles'
      )
    : null;
  const userEmail = report.user_email || profile?.email || '';
  const letterFilter = buildOrFilter([
    userId && `user_id.eq.${userId}`,
    report.file_path && `source_report_path.eq.${report.file_path}`,
  ]);
  const emailFilter = buildOrFilter([
    userId && `user_id.eq.${userId}`,
    userEmail && `user_email.eq.${userEmail}`,
  ]);
  const activityFilter = buildOrFilter([
    `entity_id.eq.${reportId}`,
    userId && `actor_user_id.eq.${userId}`,
  ]);
  const taskFilter = buildOrFilter([
    `entity_id.eq.${reportId}`,
    userId && `user_id.eq.${userId}`,
    userEmail && `user_email.eq.${userEmail}`,
  ]);

  const [letters, jobs, emailEvents, activity, tasks] = await Promise.all([
    safeRows<any>(
      (
        letterFilter
          ? supabase.from('dispute_letters').select('*').or(letterFilter)
          : supabase.from('dispute_letters').select('*').eq('id', '__none__')
      )
        .order('created_at', { ascending: false })
        .limit(100),
      'dispute_letters'
    ),
    safeRows<any>(
      supabase
        .from('analysis_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      'analysis_jobs'
    ),
    safeRows<any>(
      (
        emailFilter
          ? supabase.from('email_events').select('*').or(emailFilter)
          : supabase.from('email_events').select('*').eq('id', '__none__')
      )
        .order('created_at', { ascending: false })
        .limit(50),
      'email_events'
    ),
    safeRows<any>(
      supabase
        .from('admin_activity')
        .select('*')
        .or(activityFilter)
        .order('created_at', { ascending: false })
        .limit(50),
      'admin_activity'
    ),
    safeRows<any>(
      (
        taskFilter
          ? supabase.from('admin_tasks').select('*').or(taskFilter)
          : supabase.from('admin_tasks').select('*').eq('id', '__none__')
      )
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50),
      'admin_tasks'
    ),
  ]);

  let signedFileUrl: string | null = null;
  if (report.file_path) {
    const { data } = await supabase.storage
      .from('credit-reports')
      .createSignedUrl(report.file_path, 3600);
    signedFileUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({
    report,
    profile,
    letters,
    jobs,
    emailEvents,
    activity,
    tasks,
    timeline: buildCreditReportTimeline({
      report,
      jobs,
      letters,
      emailEvents,
      activity,
      tasks,
    }),
    operationalSummary: summarizeCreditReportOperations({
      report,
      letters,
      emailEvents,
      tasks,
    }),
    signedFileUrl,
  });
}
