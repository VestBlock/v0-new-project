export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createStalledCreditReportTask } from '@/lib/admin/tasks';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

const monitoredStatuses = [
  'uploaded',
  'extracting_text',
  'text_extracted',
  'analyzing',
] as const;

type MonitoredStatus = (typeof monitoredStatuses)[number];

const staleAfterHours: Record<MonitoredStatus, number> = {
  uploaded: 24,
  extracting_text: 2,
  text_extracted: 4,
  analyzing: 4,
};

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${expected}`;
}

function getAgeHours(row: { updated_at?: string | null; uploaded_at?: string | null; created_at?: string | null }) {
  const timestamp = row.updated_at || row.uploaded_at || row.created_at;
  if (!timestamp) return null;

  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ageMs)) return null;

  return Math.max(0, Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10);
}

function isStalled(row: { status?: string | null; updated_at?: string | null; uploaded_at?: string | null; created_at?: string | null }) {
  const status = String(row.status || 'uploaded') as MonitoredStatus;
  if (!monitoredStatuses.includes(status)) return false;

  const ageHours = getAgeHours(row);
  if (ageHours === null) return false;

  return ageHours >= staleAfterHours[status];
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: reports, error } = await supabase
    .from('credit_reports')
    .select(
      'id,user_id,user_email,file_name,status,created_at,updated_at,uploaded_at'
    )
    .in('status', monitoredStatuses)
    .order('updated_at', { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) {
    await logEvent({
      eventType: 'credit_analysis_stalled',
      entityType: 'credit_report_monitor',
      metadata: { status: 'failed', message: error.message },
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stalledReports = (reports || []).filter(isStalled);
  const taskResults = await Promise.all(
    stalledReports.map(async (report) => {
      const ageHours = getAgeHours(report);
      const status = String(report.status || 'uploaded');
      const reason = `${status} for ${ageHours ?? 'unknown'} hours`;

      await logEvent({
        eventType: 'credit_analysis_stalled',
        actorUserId: report.user_id,
        entityType: 'credit_report',
        entityId: report.id,
        metadata: {
          status,
          ageHours,
          thresholdHours: staleAfterHours[status as MonitoredStatus],
        },
      });

      return createStalledCreditReportTask({
        reportId: report.id,
        status,
        userId: report.user_id,
        userEmail: report.user_email,
        fileName: report.file_name,
        ageHours,
        reason,
      });
    })
  );

  return NextResponse.json({
    ok: true,
    scanned: reports?.length || 0,
    stalled: stalledReports.length,
    tasksCreated: taskResults.filter((result) => result.ok && !result.duplicate)
      .length,
    duplicateTasks: taskResults.filter((result) => result.duplicate).length,
  });
}
