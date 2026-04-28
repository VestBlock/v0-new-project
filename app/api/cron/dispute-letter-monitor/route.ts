export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/system/cronAuth';
import { runDisputeLetterReminderAutomation } from '@/lib/workflows/disputeLetterAutomation';

type LetterRow = {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  bureau?: string | null;
  letter_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  mailed_at?: string | null;
  response_received_at?: string | null;
  first_mail_due_at?: string | null;
  first_mail_reminder_sent_at?: string | null;
  secondary_bureau_due_at?: string | null;
  secondary_bureau_reminder_sent_at?: string | null;
  bureau_response_due_at?: string | null;
  bureau_response_reminder_sent_at?: string | null;
};

function isMissingAutomationColumns(error: { message?: string; code?: string } | null) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    message.includes('column') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('dispute_letters')
    .select(
      [
        'id',
        'user_id',
        'user_email',
        'bureau',
        'letter_type',
        'status',
        'created_at',
        'updated_at',
        'mailed_at',
        'response_received_at',
        'first_mail_due_at',
        'first_mail_reminder_sent_at',
        'secondary_bureau_due_at',
        'secondary_bureau_reminder_sent_at',
        'bureau_response_due_at',
        'bureau_response_reminder_sent_at',
      ].join(',')
    )
    .order('created_at', { ascending: true })
    .limit(250);

  if (error) {
    if (isMissingAutomationColumns(error)) {
      return NextResponse.json({
        ok: false,
        migrationRequired: true,
        message:
          'Run db/migrations/027-dispute-letter-automation.sql before dispute-letter reminder automation can scan live rows.',
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown) as LetterRow[];
  const missingEmailUserIds = Array.from(
    new Set(rows.filter((row) => row.user_id && !row.user_email).map((row) => row.user_id as string))
  );

  let emailByUserId = new Map<string, string | null>();
  if (missingEmailUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id,user_id,email')
      .in('id', missingEmailUserIds);

    emailByUserId = new Map(
      (profiles ?? []).flatMap((profile: any) => {
        const values: Array<[string, string | null]> = [];
        if (profile.id) values.push([profile.id, profile.email ?? null]);
        if (profile.user_id) values.push([profile.user_id, profile.email ?? null]);
        return values;
      })
    );
  }

  const hydratedRows = rows.map((row) => ({
    ...row,
    user_email: row.user_email || (row.user_id ? emailByUserId.get(row.user_id) : null),
  }));

  const results = await runDisputeLetterReminderAutomation(hydratedRows);

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    remindersTriggered: results.length,
    mailReminders: results.filter((result: any) => result.type === 'mail_reminder').length,
    secondaryBureauReminders: results.filter(
      (result: any) => result.type === 'secondary_bureau_reminder'
    ).length,
    responseWindowReminders: results.filter(
      (result: any) => result.type === 'bureau_response_due'
    ).length,
  });
}
