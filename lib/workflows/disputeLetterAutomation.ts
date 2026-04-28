import {
  createDisputeBureauResponseTask,
  createDisputeLetterMailingTask,
  createDisputeSecondaryBureauTask,
} from '@/lib/admin/tasks';
import {
  sendAdminDisputeLetterFollowupEmail,
  sendUserDisputeBureauResponseReminderEmail,
  sendUserDisputeLetterMailReminderEmail,
  sendUserDisputeLettersReadyEmail,
  sendUserSecondaryBureauReminderEmail,
} from '@/lib/email/sendEmail';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

export const disputeLetterTiming = {
  firstMailReminderHours: 24,
  secondaryBureauReminderDays: 7,
  bureauResponseReviewDays: 35,
} as const;

type DisputeLetterAutomationRow = {
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

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return addHours(date, days * 24);
}

function iso(date: Date) {
  return date.toISOString();
}

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageHours(value?: string | null) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(
    0,
    Math.round(((Date.now() - date.getTime()) / (60 * 60 * 1000)) * 10) / 10
  );
}

function isDue(value?: string | null) {
  const date = toDate(value);
  return Boolean(date && date.getTime() <= Date.now());
}

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

export function isDisputeLetterGenerated(status?: string | null) {
  const normalized = normalizeStatus(status);
  return ['', 'draft', 'ready', 'generated'].includes(normalized);
}

export function isDisputeLetterMailed(status?: string | null) {
  const normalized = normalizeStatus(status);
  return ['mailed', 'sent'].includes(normalized);
}

export function isDisputeLetterClosed(status?: string | null) {
  const normalized = normalizeStatus(status);
  return ['responded', 'completed', 'closed', 'cancelled', 'canceled'].includes(
    normalized
  );
}

export function getInitialDisputeLetterAutomationFields(generatedAt = new Date()) {
  return {
    workflow_stage: 'generated',
    first_mail_due_at: iso(
      addHours(generatedAt, disputeLetterTiming.firstMailReminderHours)
    ),
    secondary_bureau_due_at: iso(
      addDays(generatedAt, disputeLetterTiming.secondaryBureauReminderDays)
    ),
    next_action_at: iso(
      addHours(generatedAt, disputeLetterTiming.firstMailReminderHours)
    ),
    automation_metadata: {
      firstMailReminderHours: disputeLetterTiming.firstMailReminderHours,
      secondaryBureauReminderDays: disputeLetterTiming.secondaryBureauReminderDays,
      bureauResponseReviewDays: disputeLetterTiming.bureauResponseReviewDays,
    },
  };
}

export function getMailedDisputeLetterAutomationFields(mailedAt = new Date()) {
  const responseDueAt = addDays(
    mailedAt,
    disputeLetterTiming.bureauResponseReviewDays
  );

  return {
    status: 'mailed',
    workflow_stage: 'mailed',
    mailed_at: iso(mailedAt),
    bureau_response_due_at: iso(responseDueAt),
    next_action_at: iso(responseDueAt),
  };
}

export function buildDisputeLetterRoadmap(row: {
  status?: string | null;
  created_at?: string | null;
  mailed_at?: string | null;
  first_mail_due_at?: string | null;
  secondary_bureau_due_at?: string | null;
  bureau_response_due_at?: string | null;
  response_received_at?: string | null;
}) {
  const createdAt = toDate(row.created_at) || new Date();
  const mailedAt = toDate(row.mailed_at || undefined);
  const responseReceivedAt = toDate(row.response_received_at || undefined);

  return [
    {
      key: 'review',
      label: 'Review generated letter',
      status: 'completed',
      dueAt: iso(createdAt),
    },
    {
      key: 'mail',
      label: 'Mail letter with tracking',
      status: mailedAt ? 'completed' : isDue(row.first_mail_due_at) ? 'due' : 'open',
      dueAt:
        row.first_mail_due_at ||
        iso(addHours(createdAt, disputeLetterTiming.firstMailReminderHours)),
    },
    {
      key: 'secondary_bureaus',
      label: 'Check other bureau letters',
      status:
        mailedAt || responseReceivedAt
          ? 'completed'
          : isDue(row.secondary_bureau_due_at)
            ? 'due'
            : 'open',
      dueAt:
        row.secondary_bureau_due_at ||
        iso(addDays(createdAt, disputeLetterTiming.secondaryBureauReminderDays)),
    },
    {
      key: 'response_window',
      label: 'Check bureau response',
      status: responseReceivedAt
        ? 'completed'
        : mailedAt && isDue(row.bureau_response_due_at)
          ? 'due'
          : mailedAt
            ? 'open'
            : 'waiting',
      dueAt:
        row.bureau_response_due_at ||
        (mailedAt
          ? iso(addDays(mailedAt, disputeLetterTiming.bureauResponseReviewDays))
          : null),
    },
  ];
}

export async function notifyDisputeLettersReady(input: {
  reportId: string;
  userId?: string | null;
  userEmail?: string | null;
  generatedLetterCount?: number | null;
}) {
  if (!input.generatedLetterCount) return { skipped: true };

  await Promise.all([
    sendUserDisputeLettersReadyEmail(input),
    logEvent({
      eventType: 'dispute_letters_ready',
      actorUserId: input.userId,
      entityType: 'credit_report',
      entityId: input.reportId,
      metadata: { generatedLetterCount: input.generatedLetterCount },
    }),
  ]);

  return { ok: true };
}

export async function markDisputeLetterMailed(input: {
  letterId: string;
  userId: string;
}) {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('dispute_letters')
    .select('id,user_id,status')
    .eq('id', input.letterId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return { ok: false, status: 404 as const, error: 'Not found' };
  if (row.user_id !== input.userId) {
    return { ok: false, status: 403 as const, error: 'Forbidden' };
  }

  const updates = getMailedDisputeLetterAutomationFields();
  const { data, error: updateError } = await supabase
    .from('dispute_letters')
    .update(updates)
    .eq('id', input.letterId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  await logEvent({
    eventType: 'dispute_letter_status_updated',
    actorUserId: input.userId,
    entityType: 'dispute_letter',
    entityId: input.letterId,
    metadata: { status: 'mailed' },
  });

  return { ok: true, letter: data };
}

export async function runDisputeLetterReminderAutomation(rows: DisputeLetterAutomationRow[]) {
  const results = await Promise.all(
    rows.map(async (row) => {
      if (isDisputeLetterClosed(row.status)) return null;

      const generatedBase =
        row.created_at || row.updated_at || new Date().toISOString();
      const generatedAt = toDate(generatedBase) || new Date();
      const firstMailDueAt =
        row.first_mail_due_at ||
        iso(addHours(generatedAt, disputeLetterTiming.firstMailReminderHours));
      const secondaryDueAt =
        row.secondary_bureau_due_at ||
        iso(addDays(generatedAt, disputeLetterTiming.secondaryBureauReminderDays));

      if (
        isDisputeLetterGenerated(row.status) &&
        isDue(firstMailDueAt) &&
        !row.first_mail_reminder_sent_at
      ) {
        const [taskResult, emailResult] = await Promise.all([
          createDisputeLetterMailingTask({
            letterId: row.id,
            userId: row.user_id,
            userEmail: row.user_email,
            bureau: row.bureau,
            letterType: row.letter_type,
            ageHours: ageHours(generatedBase),
          }),
          sendUserDisputeLetterMailReminderEmail({
            userId: row.user_id,
            userEmail: row.user_email,
            letterId: row.id,
            bureau: row.bureau,
            letterType: row.letter_type,
          }),
        ]);

        await markReminderSent(row.id, {
          first_mail_reminder_sent_at: new Date().toISOString(),
          next_action_at: secondaryDueAt,
        });
        await logEvent({
          eventType: 'dispute_letter_mail_reminder',
          actorUserId: row.user_id,
          entityType: 'dispute_letter',
          entityId: row.id,
          metadata: { bureau: row.bureau, taskResult, emailResult },
        });
        return { type: 'mail_reminder', taskResult, emailResult };
      }

      if (
        isDisputeLetterGenerated(row.status) &&
        isDue(secondaryDueAt) &&
        !row.secondary_bureau_reminder_sent_at
      ) {
        const [taskResult, emailResult] = await Promise.all([
          createDisputeSecondaryBureauTask({
            letterId: row.id,
            userId: row.user_id,
            userEmail: row.user_email,
            bureau: row.bureau,
            ageHours: ageHours(generatedBase),
          }),
          sendUserSecondaryBureauReminderEmail({
            userId: row.user_id,
            userEmail: row.user_email,
            letterId: row.id,
            bureau: row.bureau,
          }),
        ]);

        await markReminderSent(row.id, {
          secondary_bureau_reminder_sent_at: new Date().toISOString(),
        });
        await logEvent({
          eventType: 'dispute_secondary_bureau_reminder',
          actorUserId: row.user_id,
          entityType: 'dispute_letter',
          entityId: row.id,
          metadata: { bureau: row.bureau, taskResult, emailResult },
        });
        return { type: 'secondary_bureau_reminder', taskResult, emailResult };
      }

      const mailedAt = row.mailed_at || (isDisputeLetterMailed(row.status) ? row.updated_at : null);
      const mailedDate = toDate(mailedAt);
      const responseDueAt =
        row.bureau_response_due_at ||
        (mailedDate
          ? iso(addDays(mailedDate, disputeLetterTiming.bureauResponseReviewDays))
          : null);

      if (
        isDisputeLetterMailed(row.status) &&
        responseDueAt &&
        isDue(responseDueAt) &&
        !row.bureau_response_reminder_sent_at
      ) {
        const [taskResult, userEmailResult, adminEmailResult] = await Promise.all([
          createDisputeBureauResponseTask({
            letterId: row.id,
            userId: row.user_id,
            userEmail: row.user_email,
            bureau: row.bureau,
            mailedAt,
            ageHours: ageHours(mailedAt),
          }),
          sendUserDisputeBureauResponseReminderEmail({
            userId: row.user_id,
            userEmail: row.user_email,
            letterId: row.id,
            bureau: row.bureau,
          }),
          sendAdminDisputeLetterFollowupEmail({
            userId: row.user_id,
            userEmail: row.user_email,
            letterId: row.id,
            bureau: row.bureau,
            reason: 'Bureau response review window reached.',
          }),
        ]);

        await markReminderSent(row.id, {
          bureau_response_reminder_sent_at: new Date().toISOString(),
        });
        await logEvent({
          eventType: 'dispute_bureau_response_due',
          actorUserId: row.user_id,
          entityType: 'dispute_letter',
          entityId: row.id,
          metadata: { bureau: row.bureau, taskResult, userEmailResult, adminEmailResult },
        });
        return {
          type: 'bureau_response_due',
          taskResult,
          emailResult: userEmailResult,
        };
      }

      return null;
    })
  );

  return results.filter(Boolean);
}

async function markReminderSent(letterId: string, updates: Record<string, unknown>) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('dispute_letters')
      .update(updates)
      .eq('id', letterId);

    if (error) {
      console.warn('[dispute-letter-automation] update skipped:', error.message);
    }
  } catch (error) {
    console.warn(
      '[dispute-letter-automation] update unavailable:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
