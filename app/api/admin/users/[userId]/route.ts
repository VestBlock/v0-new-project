import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

async function safeMaybeSingle<T>(
  query: PromiseLike<{ data: T | null; error: any }>,
  label: string
) {
  const { data, error } = await query;
  if (error) {
    console.warn(`[admin-user-detail] ${label} unavailable:`, error.message);
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
    console.warn(`[admin-user-detail] ${label} unavailable:`, error.message);
    return [];
  }
  return data ?? [];
}

function buildOrFilter(filters: Array<string | false | null | undefined>) {
  return filters.filter(Boolean).join(',');
}

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const supabase = createAdminClient();
  const profile = await safeMaybeSingle<any>(
    supabase
      .from('user_profiles')
      .select('*')
      .or(`id.eq.${params.userId},user_id.eq.${params.userId}`)
      .maybeSingle(),
    'user_profiles'
  );
  const userEmail = profile?.email || '';
  const userId = profile?.user_id || profile?.id || params.userId;
  const emailFilter = buildOrFilter([
    userId && `user_id.eq.${userId}`,
    userEmail && `user_email.eq.${userEmail}`,
  ]);
  const activityFilter = buildOrFilter([
    userId && `actor_user_id.eq.${userId}`,
    userId && `entity_id.eq.${userId}`,
  ]);

  const [reports, jobs, letters, payments, emailEvents, activity, leads] =
    await Promise.all([
      safeRows<any>(
        supabase
          .from('credit_reports')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        'credit_reports'
      ),
      safeRows<any>(
        supabase
          .from('analysis_jobs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        'analysis_jobs'
      ),
      safeRows<any>(
        supabase
          .from('dispute_letters')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        'dispute_letters'
      ),
      safeRows<any>(
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        'payments'
      ),
      safeRows<any>(
        (
          emailFilter
            ? supabase.from('email_events').select('*').or(emailFilter)
            : supabase.from('email_events').select('*').eq('id', '__none__')
        )
          .order('created_at', { ascending: false })
          .limit(100),
        'email_events'
      ),
      safeRows<any>(
        (
          activityFilter
            ? supabase.from('admin_activity').select('*').or(activityFilter)
            : supabase.from('admin_activity').select('*').eq('id', '__none__')
        )
          .order('created_at', { ascending: false })
          .limit(100),
        'admin_activity'
      ),
      safeRows<any>(
        supabase
          .from('leads')
          .select('*')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(50),
        'leads'
      ),
    ]);

  return NextResponse.json({
    profile,
    reports,
    jobs,
    letters,
    payments,
    emailEvents,
    activity,
    leads,
  });
}
