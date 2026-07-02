import { createLeadFollowupTask } from '@/lib/admin/tasks';
import { sendNewLeadAlertEmail } from '@/lib/email/sendEmail';
import { logEvent } from '@/lib/system/logEvent';

type NewLeadAutomationInput = {
  leadId?: string | null;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  propertyAddress?: string | null;
  city?: string | null;
  state?: string | null;
  ownerUserId?: string | null;
  sourcePath?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * When true, send the admin intake alert email (ADMIN_ALERT_EMAIL via Resend).
   * Only public inbound-form routes should set this — bulk import/scoring paths
   * stay silent so batch runs never flood the inbox.
   */
  sendIntakeAlert?: boolean;
};

export async function runNewLeadAutomation(input: NewLeadAutomationInput) {
  const leadId = input.leadId || null;
  const hasDirectContact = Boolean(
    String(input.email || '').trim() || String(input.phone || '').trim()
  );
  const [emailResult, taskResult, logResult] = await Promise.allSettled([
    input.sendIntakeAlert
      ? sendNewLeadAlertEmail({
          leadId,
          leadType: input.leadType,
          name: input.name,
          email: input.email,
          phone: input.phone,
          propertyAddress: input.propertyAddress,
          city: input.city,
          state: input.state,
          sourcePath: input.sourcePath,
          summary: input.summary,
        })
      : Promise.resolve({
          ok: true,
          skipped: true,
          reason: 'intake_alert_not_requested',
        }),
    leadId
      ? hasDirectContact
        ? createLeadFollowupTask({
          leadId,
          leadType: input.leadType,
          name: input.name,
          email: input.email,
          phone: input.phone,
          propertyAddress: input.propertyAddress,
          city: input.city,
          state: input.state,
          summary: input.summary,
          assignedTo: input.ownerUserId || null,
          sourcePath: input.sourcePath,
          immediate: true,
        })
        : Promise.resolve({
            ok: true,
            skipped: true,
            reason: 'missing_direct_contact_path',
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
        propertyAddress: input.propertyAddress,
        city: input.city,
        state: input.state,
        sourcePath: input.sourcePath,
        summary: input.summary,
        ...input.metadata,
      },
    }),
  ]);

  return { emailResult, taskResult, logResult };
}
