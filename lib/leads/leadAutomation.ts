import { createLeadFollowupTask } from '@/lib/admin/tasks';
import { sendNewLeadAlertEmail } from '@/lib/email/sendEmail';
import { logEvent } from '@/lib/system/logEvent';

type NewLeadAutomationInput = {
  leadId?: string | null;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  sourcePath?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function runNewLeadAutomation(input: NewLeadAutomationInput) {
  const leadId = input.leadId || null;

  const [emailResult, taskResult, logResult] = await Promise.allSettled([
    sendNewLeadAlertEmail(input),
    leadId
      ? createLeadFollowupTask({
          leadId,
          leadType: input.leadType,
          name: input.name,
          email: input.email,
          sourcePath: input.sourcePath,
          immediate: true,
        })
      : Promise.resolve({ ok: false, skipped: true, error: 'Missing lead id.' }),
    logEvent({
      eventType: 'lead_created',
      entityType: 'lead',
      entityId: leadId,
      metadata: {
        leadType: input.leadType,
        name: input.name,
        email: input.email,
        phone: input.phone,
        sourcePath: input.sourcePath,
        summary: input.summary,
        ...input.metadata,
      },
    }),
  ]);

  return { emailResult, taskResult, logResult };
}
