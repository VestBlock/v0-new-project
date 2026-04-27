import { createAdminClient } from '@/lib/supabase/admin';

export const adminTaskStatuses = [
  'open',
  'in_progress',
  'waiting',
  'completed',
  'dismissed',
] as const;

export const adminTaskPriorities = ['low', 'normal', 'high', 'urgent'] as const;

export type AdminTaskStatus = (typeof adminTaskStatuses)[number];
export type AdminTaskPriority = (typeof adminTaskPriorities)[number];

type CreateAdminTaskInput = {
  title: string;
  description?: string | null;
  taskType?: string;
  status?: AdminTaskStatus;
  priority?: AdminTaskPriority;
  assignedTo?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sourceEventId?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

function addHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export const adminTaskDueDates = {
  now: () => new Date().toISOString(),
  hours: addHours,
  days: (days: number) => addHours(days * 24),
};

export async function createAdminTask(input: CreateAdminTaskInput) {
  const taskType = input.taskType || 'admin_followup';
  const status = input.status || 'open';
  const priority = input.priority || 'normal';

  try {
    const admin = createAdminClient();

    if (input.entityType && input.entityId) {
      const { data: existing, error: lookupError } = await admin
        .from('admin_tasks')
        .select('id,status')
        .eq('task_type', taskType)
        .eq('entity_type', input.entityType)
        .eq('entity_id', input.entityId)
        .in('status', ['open', 'in_progress', 'waiting'])
        .limit(1)
        .maybeSingle();

      if (!lookupError && existing?.id) {
        return { ok: true, task: existing, duplicate: true };
      }
    }

    const { data, error } = await admin
      .from('admin_tasks')
      .insert({
        title: input.title,
        description: input.description ?? null,
        task_type: taskType,
        status,
        priority,
        assigned_to: input.assignedTo ?? null,
        user_id: input.userId ?? null,
        user_email: input.userEmail ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        source_event_id: input.sourceEventId ?? null,
        due_at: input.dueAt ?? null,
        metadata_json: input.metadata ?? {},
        created_by: input.createdBy ?? null,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .select('id,status')
      .single();

    if (error) {
      console.warn('[admin-task] insert skipped:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, task: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[admin-task] unavailable:', message);
    return { ok: false, error: message };
  }
}

export async function createCreditReportReviewTask(input: {
  reportId: string;
  userId?: string | null;
  userEmail?: string | null;
  fileName?: string | null;
}) {
  return createAdminTask({
    title: 'Review new credit report upload',
    description:
      'A customer uploaded a credit report. Confirm analysis status, generated dispute letters, and whether follow-up is needed.',
    taskType: 'credit_report_review',
    priority: 'normal',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'credit_report',
    entityId: input.reportId,
    dueAt: adminTaskDueDates.days(1),
    metadata: { fileName: input.fileName },
  });
}

export async function createCreditAnalysisFailureTask(input: {
  reportId: string;
  userId?: string | null;
  userEmail?: string | null;
  errorMessage?: string | null;
}) {
  return createAdminTask({
    title: 'Fix failed credit analysis',
    description:
      'A credit repair analysis failed. Review the report, error details, and decide whether to rerun analysis or contact the customer.',
    taskType: 'credit_analysis_failure',
    priority: 'urgent',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'credit_report',
    entityId: input.reportId,
    dueAt: adminTaskDueDates.now(),
    metadata: { errorMessage: input.errorMessage },
  });
}

export async function createCreditAnalysisCompletedTask(input: {
  reportId: string;
  userId?: string | null;
  userEmail?: string | null;
  generatedLetterCount?: number | null;
}) {
  return createAdminTask({
    title: 'Follow up on completed credit analysis',
    description:
      'A credit analysis completed. Check whether dispute letters were generated and whether the customer should receive a next-step follow-up.',
    taskType: 'credit_analysis_followup',
    priority: 'low',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'credit_report',
    entityId: input.reportId,
    dueAt: adminTaskDueDates.days(2),
    metadata: { generatedLetterCount: input.generatedLetterCount },
  });
}

export async function createNeedsReviewTask(input: {
  reportId: string;
  userId?: string | null;
  userEmail?: string | null;
  reason?: string | null;
  createdBy?: string | null;
}) {
  return createAdminTask({
    title: 'Credit report needs manual review',
    description:
      'This credit report was marked as needing review. Inspect the analysis record, customer history, and any admin notes before follow-up.',
    taskType: 'credit_report_needs_review',
    priority: 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'credit_report',
    entityId: input.reportId,
    dueAt: adminTaskDueDates.now(),
    metadata: { reason: input.reason },
    createdBy: input.createdBy,
  });
}

export async function createStalledCreditReportTask(input: {
  reportId: string;
  status?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  fileName?: string | null;
  ageHours?: number | null;
  reason?: string | null;
}) {
  return createAdminTask({
    title: 'Review stalled credit report workflow',
    description:
      'A credit report has been sitting in a processing status longer than expected. Check extraction, analysis, generated letters, and customer follow-up needs.',
    taskType: 'credit_report_stalled',
    priority: 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'credit_report',
    entityId: input.reportId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      status: input.status,
      fileName: input.fileName,
      ageHours: input.ageHours,
      reason: input.reason,
    },
  });
}

export async function createSignupNoUploadTask(input: {
  userId: string;
  userEmail?: string | null;
  fullName?: string | null;
  ageHours?: number | null;
}) {
  return createAdminTask({
    title: 'Help new user upload a credit report',
    description:
      'A user signed up but has not uploaded a credit report yet. Follow up with a simple next-step reminder or check whether onboarding is blocked.',
    taskType: 'signup_no_upload',
    priority: 'normal',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'user',
    entityId: input.userId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      fullName: input.fullName,
      ageHours: input.ageHours,
      nextAction: 'Send upload reminder or verify onboarding path.',
    },
  });
}

export async function createPaidCustomerNoUploadTask(input: {
  userId: string;
  userEmail?: string | null;
  amount?: string | number | null;
  paymentId?: string | null;
  paidAt?: string | null;
  ageHours?: number | null;
}) {
  return createAdminTask({
    title: 'Onboard paid customer with no report upload',
    description:
      'A paid customer does not have a credit report upload yet. Follow up quickly so the customer can reach the credit analysis workflow.',
    taskType: 'paid_customer_no_upload',
    priority: 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'user',
    entityId: input.userId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      amount: input.amount,
      paymentId: input.paymentId,
      paidAt: input.paidAt,
      ageHours: input.ageHours,
      nextAction: 'Send paid onboarding reminder and confirm upload instructions.',
    },
  });
}

export async function createPaidCustomerOnboardingTask(input: {
  paymentId: string;
  userId?: string | null;
  userEmail?: string | null;
  amount?: string | number | null;
  provider?: string | null;
  transactionId?: string | null;
}) {
  return createAdminTask({
    title: 'Onboard new paid customer',
    description:
      'A payment completed. Confirm the customer can access the dashboard, upload their credit report, and understands the next step.',
    taskType: 'paid_customer_onboarding',
    priority: 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'payment',
    entityId: input.paymentId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      amount: input.amount,
      provider: input.provider,
      transactionId: input.transactionId,
      nextAction: 'Confirm subscription access and prompt credit report upload.',
    },
  });
}

export async function createPaymentFailureTask(input: {
  paymentId: string;
  userId?: string | null;
  userEmail?: string | null;
  amount?: string | number | null;
  provider?: string | null;
  transactionId?: string | null;
  errorMessage?: string | null;
  source?: string | null;
}) {
  return createAdminTask({
    title: 'Review failed payment',
    description:
      'A payment attempt failed or could not be recorded. Review the provider response, customer account, and checkout path before following up.',
    taskType: 'payment_failure',
    priority: 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'payment',
    entityId: input.paymentId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      amount: input.amount,
      provider: input.provider,
      transactionId: input.transactionId,
      errorMessage: input.errorMessage,
      source: input.source,
      nextAction: 'Check payment provider status and contact customer if needed.',
    },
  });
}

export async function createAbandonedCheckoutTask(input: {
  checkoutId: string;
  userId?: string | null;
  userEmail?: string | null;
  ageHours?: number | null;
  source?: string | null;
}) {
  return createAdminTask({
    title: 'Follow up on abandoned checkout',
    description:
      'A PayPal order was created but the user has not completed payment. Review the account and decide whether a helpful follow-up is appropriate.',
    taskType: 'abandoned_checkout',
    priority: 'normal',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'checkout',
    entityId: input.checkoutId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      ageHours: input.ageHours,
      source: input.source,
      nextAction: 'Review checkout status and follow up if the user still needs help.',
    },
  });
}

export async function createLeadFollowupTask(input: {
  leadId: string;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  ageHours?: number | null;
  sourcePath?: string | null;
  immediate?: boolean;
}) {
  return createAdminTask({
    title: input.immediate ? 'Contact new lead' : 'Follow up with new lead',
    description:
      input.immediate
        ? 'A new lead was submitted. Review the source, contact details, and next sales step while intent is fresh.'
        : 'A lead is still marked new after the follow-up window. Review the source, contact details, and next sales step.',
    taskType: 'lead_followup',
    priority: input.immediate ? 'high' : 'normal',
    userEmail: input.email,
    entityType: 'lead',
    entityId: input.leadId,
    dueAt: adminTaskDueDates.now(),
    metadata: {
      leadType: input.leadType,
      name: input.name,
      ageHours: input.ageHours,
      sourcePath: input.sourcePath,
      nextAction: 'Contact lead or update lead status.',
    },
  });
}

export async function createFundingStrategyReviewTask(input: {
  requestId: string;
  userId?: string | null;
  userEmail?: string | null;
  businessName?: string | null;
  readinessScore?: number | null;
  readinessTier?: string | null;
  paid?: boolean;
}) {
  return createAdminTask({
    title: input.paid
      ? 'Complete paid card funding strategy review'
      : 'Review card funding strategy request',
    description:
      'A customer submitted a business credit card funding strategy request. Review credit readiness, business setup, consent, and whether the plan should move to a paid strategy session or preparation work.',
    taskType: input.paid
      ? 'paid_funding_strategy_review'
      : 'funding_strategy_review',
    priority: input.paid ? 'urgent' : 'high',
    userId: input.userId,
    userEmail: input.userEmail,
    entityType: 'funding_strategy_request',
    entityId: input.requestId,
    dueAt: input.paid ? adminTaskDueDates.now() : adminTaskDueDates.days(1),
    metadata: {
      businessName: input.businessName,
      readinessScore: input.readinessScore,
      readinessTier: input.readinessTier,
      paid: Boolean(input.paid),
      nextAction: input.paid
        ? 'Prepare the strategy review, verify documents, and contact the customer.'
        : 'Review readiness score and decide whether to invite payment or recommend prep work.',
    },
  });
}
