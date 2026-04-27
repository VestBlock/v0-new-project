export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  createLeadFollowupTask,
  createPaidCustomerNoUploadTask,
  createSignupNoUploadTask,
} from '@/lib/admin/tasks';
import {
  sendAdminLeadFollowupEmail,
  sendPaidCustomerUploadReminderEmail,
  sendUserUploadReminderEmail,
} from '@/lib/email/sendEmail';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/system/cronAuth';
import { logEvent } from '@/lib/system/logEvent';

const signupNoUploadAfterHours = 48;
const paidNoUploadAfterHours = 24;
const leadFollowupAfterHours = 24;

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  is_subscribed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReportRow = {
  user_id?: string | null;
  uploaded_at?: string | null;
  updated_at?: string | null;
};

type PaymentRow = {
  id: string;
  user_id?: string | null;
  amount?: string | number | null;
  status?: string | null;
  created_at?: string | null;
  paypal_transaction_id?: string | null;
};

type LeadRow = {
  id: string;
  lead_type?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LifecycleEmailType =
  | 'user_upload_reminder'
  | 'user_paid_upload_reminder'
  | 'admin_lead_followup';

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: any }>,
  label: string
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    await logEvent({
      eventType: 'admin_action',
      entityType: 'lifecycle_monitor',
      metadata: { status: 'partial_failure', source: label, message: error.message },
    });
    return [];
  }
  return data ?? [];
}

function ageHours(timestamp?: string | null) {
  if (!timestamp) return null;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ageMs)) return null;
  return Math.max(0, Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10);
}

function latestPaymentByUser(payments: PaymentRow[]) {
  const byUser = new Map<string, PaymentRow>();

  payments
    .filter((payment) => String(payment.status || '').toLowerCase() === 'completed')
    .forEach((payment) => {
      if (!payment.user_id) return;
      const existing = byUser.get(payment.user_id);
      const currentTime = new Date(payment.created_at || 0).getTime();
      const existingTime = new Date(existing?.created_at || 0).getTime();
      if (!existing || currentTime > existingTime) {
        byUser.set(payment.user_id, payment);
      }
    });

  return byUser;
}

async function hasLifecycleEmailEvent(input: {
  eventType: LifecycleEmailType;
  userId?: string | null;
  userEmail?: string | null;
}) {
  if (!input.userId && !input.userEmail) return false;

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from('email_events')
      .select('id,status')
      .eq('event_type', input.eventType)
      .in('status', ['sent', 'skipped'])
      .limit(1);

    if (input.userId) {
      query = query.eq('user_id', input.userId);
    } else if (input.userEmail) {
      query = query.eq('user_email', input.userEmail);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

async function sendLifecycleEmailOnce(input: {
  eventType: LifecycleEmailType;
  userId?: string | null;
  userEmail?: string | null;
  send: () => Promise<unknown>;
}) {
  const alreadySent = await hasLifecycleEmailEvent(input);
  if (alreadySent) return { skipped: true, reason: 'existing_email_event' };

  await input.send();
  return { skipped: false };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [profiles, reports, payments, leads] = await Promise.all([
    safeRows<ProfileRow>(
      supabase
        .from('user_profiles')
        .select('id,email,full_name,is_subscribed,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(500),
      'user_profiles'
    ),
    safeRows<ReportRow>(
      supabase
        .from('credit_reports')
        .select('user_id,uploaded_at,updated_at')
        .limit(1000),
      'credit_reports'
    ),
    safeRows<PaymentRow>(
      supabase
        .from('payments')
        .select('id,user_id,amount,status,created_at,paypal_transaction_id')
        .order('created_at', { ascending: false })
        .limit(500),
      'payments'
    ),
    safeRows<LeadRow>(
      supabase
        .from('leads')
        .select('id,lead_type,status,name,email,created_at,updated_at')
        .eq('status', 'new')
        .order('created_at', { ascending: true })
        .limit(250),
      'leads'
    ),
  ]);

  const reportUserIds = new Set(
    reports.map((report) => report.user_id).filter(Boolean) as string[]
  );
  const paidByUser = latestPaymentByUser(payments);

  const userTaskResults = await Promise.all(
    profiles.map(async (profile) => {
      const userId = profile.id;
      if (!userId || reportUserIds.has(userId)) return null;

      const latestPayment = paidByUser.get(userId);
      const paidAt = latestPayment?.created_at;
      const paidAgeHours = ageHours(paidAt);
      const profileAgeHours = ageHours(profile.created_at);
      const isPaid = Boolean(profile.is_subscribed || latestPayment);

      if (
        isPaid &&
        (paidAgeHours ?? profileAgeHours ?? 0) >= paidNoUploadAfterHours
      ) {
        const [result, emailResult] = await Promise.all([
          createPaidCustomerNoUploadTask({
            userId,
            userEmail: profile.email,
            amount: latestPayment?.amount,
            paymentId: latestPayment?.paypal_transaction_id || latestPayment?.id,
            paidAt,
            ageHours: paidAgeHours ?? profileAgeHours,
          }),
          sendLifecycleEmailOnce({
            eventType: 'user_paid_upload_reminder',
            userId,
            userEmail: profile.email,
            send: () =>
              sendPaidCustomerUploadReminderEmail({
                userId,
                userEmail: profile.email,
                amount: latestPayment?.amount,
              }),
          }),
        ]);

        if (result.ok && !result.duplicate) {
          await logEvent({
            eventType: 'paid_customer_no_upload',
            actorUserId: userId,
            entityType: 'user',
            entityId: userId,
            metadata: {
              ageHours: paidAgeHours ?? profileAgeHours,
              emailReminder: emailResult,
            },
          });
        }

        return { ...result, emailResult };
      }

      if ((profileAgeHours ?? 0) >= signupNoUploadAfterHours) {
        const [result, emailResult] = await Promise.all([
          createSignupNoUploadTask({
            userId,
            userEmail: profile.email,
            fullName: profile.full_name,
            ageHours: profileAgeHours,
          }),
          sendLifecycleEmailOnce({
            eventType: 'user_upload_reminder',
            userId,
            userEmail: profile.email,
            send: () =>
              sendUserUploadReminderEmail({
                userId,
                userEmail: profile.email,
                fullName: profile.full_name,
              }),
          }),
        ]);

        if (result.ok && !result.duplicate) {
          await logEvent({
            eventType: 'signup_no_upload',
            actorUserId: userId,
            entityType: 'user',
            entityId: userId,
            metadata: {
              ageHours: profileAgeHours,
              emailReminder: emailResult,
            },
          });
        }

        return { ...result, emailResult };
      }

      return null;
    })
  );

  const leadTaskResults = await Promise.all(
    leads.map(async (lead) => {
      const createdAgeHours = ageHours(lead.created_at);
      if ((createdAgeHours ?? 0) < leadFollowupAfterHours) return null;

      const [result, emailResult] = await Promise.all([
        createLeadFollowupTask({
          leadId: lead.id,
          leadType: lead.lead_type,
          name: lead.name,
          email: lead.email,
          ageHours: createdAgeHours,
        }),
        sendLifecycleEmailOnce({
          eventType: 'admin_lead_followup',
          userEmail: lead.email || lead.id,
          send: () =>
            sendAdminLeadFollowupEmail({
              leadId: lead.id,
              leadType: lead.lead_type,
              name: lead.name,
              email: lead.email,
              ageHours: createdAgeHours,
            }),
        }),
      ]);

      if (result.ok && !result.duplicate) {
        await logEvent({
          eventType: 'lead_followup_needed',
          entityType: 'lead',
          entityId: lead.id,
          metadata: {
            leadType: lead.lead_type,
            ageHours: createdAgeHours,
            emailReminder: emailResult,
          },
        });
      }

      return { ...result, emailResult };
    })
  );

  const taskResults = [...userTaskResults, ...leadTaskResults].filter(Boolean) as Array<{
    ok?: boolean;
    duplicate?: boolean;
    emailResult?: { skipped?: boolean; reason?: string };
  }>;

  return NextResponse.json({
    ok: true,
    scanned: {
      users: profiles.length,
      reports: reports.length,
      payments: payments.length,
      leads: leads.length,
    },
    candidates: {
      usersWithoutUploads: profiles.filter((profile) => !reportUserIds.has(profile.id)).length,
      newLeads: leads.length,
    },
    tasksCreated: taskResults.filter((result) => result.ok && !result.duplicate).length,
    duplicateTasks: taskResults.filter((result) => result.duplicate).length,
    lifecycleEmailsAttempted: taskResults.filter(
      (result) => result.emailResult && !result.emailResult.skipped
    ).length,
    lifecycleEmailsSkipped: taskResults.filter(
      (result) => result.emailResult?.skipped
    ).length,
  });
}
