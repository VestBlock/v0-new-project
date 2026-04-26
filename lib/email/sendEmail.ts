import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

type EmailEventType =
  | 'admin_credit_report_uploaded'
  | 'user_credit_report_received'
  | 'user_analysis_completed'
  | 'admin_analysis_completed'
  | 'credit_analysis_failed'
  | 'new_paid_customer';

type SendEmailInput = {
  to?: string | null;
  subject: string;
  html: string;
  eventType: EmailEventType;
  userId?: string | null;
  userEmail?: string | null;
};

function getFromEmail() {
  return process.env.FROM_EMAIL || process.env.RESEND_EMAIL || 'contact@vestblock.io';
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shell(title: string, body: string) {
  return `
    <div style="margin:0;padding:0;background:#080f14;font-family:Arial,sans-serif;color:#eef6f8;">
      <div style="max-width:640px;margin:0 auto;padding:28px;">
        <p style="margin:0 0 18px;color:#67e8f9;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">VestBlock</p>
        <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#ffffff;">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.6;color:#d7e6ea;">${body}</div>
        <p style="margin-top:28px;color:#8aa4ad;font-size:12px;line-height:1.5;">VestBlock provides education, workflow tools, and document support. We do not guarantee credit outcomes.</p>
      </div>
    </div>
  `;
}

async function recordEmailEvent(
  input: SendEmailInput,
  status: 'sent' | 'failed' | 'skipped',
  providerMessageId?: string | null,
  errorMessage?: string | null
) {
  try {
    const admin = createAdminClient();
    await admin.from('email_events').insert({
      user_id: input.userId ?? null,
      user_email: input.userEmail ?? input.to ?? null,
      event_type: input.eventType,
      subject: input.subject,
      status,
      provider_message_id: providerMessageId ?? null,
      error_message: errorMessage ?? null,
    });
  } catch (error) {
    console.warn(
      '[email] email_events insert skipped:',
      error instanceof Error ? error.message : error
    );
  }
}

export async function sendEmail(input: SendEmailInput) {
  if (!input.to) {
    await recordEmailEvent(input, 'skipped', null, 'Missing recipient email.');
    return { ok: false, skipped: true, error: 'Missing recipient email.' };
  }

  if (!process.env.RESEND_API_KEY) {
    await recordEmailEvent(input, 'skipped', null, 'RESEND_API_KEY is not configured.');
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY is not configured.',
    };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      const message = error.message || 'Resend failed to send email.';
      await recordEmailEvent(input, 'failed', null, message);
      await logEvent({
        eventType: 'email_failed',
        actorUserId: input.userId,
        entityType: 'email',
        metadata: { subject: input.subject, eventType: input.eventType, message },
      });
      return { ok: false, error: message };
    }

    await recordEmailEvent(input, 'sent', data?.id ?? null);
    await logEvent({
      eventType: 'email_sent',
      actorUserId: input.userId,
      entityType: 'email',
      entityId: data?.id,
      metadata: {
        subject: input.subject,
        eventType: input.eventType,
        to: input.to,
      },
    });
    return { ok: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordEmailEvent(input, 'failed', null, message);
    await logEvent({
      eventType: 'email_failed',
      actorUserId: input.userId,
      entityType: 'email',
      metadata: { subject: input.subject, eventType: input.eventType, message },
    });
    return { ok: false, error: message };
  }
}

export async function sendAdminAlertEmail(details: {
  userEmail?: string | null;
  fileName?: string | null;
  uploadDate?: string;
  dashboardPath?: string;
  userId?: string | null;
  reportId?: string | null;
}) {
  const dashboardUrl = `${getSiteUrl()}${details.dashboardPath || '/admin-panel'}`;
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'New VestBlock Credit Report Uploaded',
    eventType: 'admin_credit_report_uploaded',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'New credit report uploaded',
      `
      <p>A new credit report was uploaded and is ready for review.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || 'Unknown')}<br />
      <strong>File:</strong> ${escapeHtml(details.fileName || 'Unknown')}<br />
      <strong>Uploaded:</strong> ${escapeHtml(details.uploadDate || new Date().toISOString())}<br />
      <strong>Report ID:</strong> ${escapeHtml(details.reportId || 'Pending')}</p>
      <p><a href="${dashboardUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}

export async function sendUserCreditReportReceivedEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  fileName?: string | null;
}) {
  return sendEmail({
    to: details.userEmail,
    subject: 'We received your credit report',
    eventType: 'user_credit_report_received',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'We received your credit report',
      `
      <p>Your credit report upload was received securely. VestBlock will begin processing it for credit analysis and dispute-letter support.</p>
      <p><strong>File:</strong> ${escapeHtml(details.fileName || 'Credit report')}</p>
      <p>You can return to your dashboard anytime to check your credit repair workflow.</p>
    `
    ),
  });
}

export async function sendUserAnalysisCompletedEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  analysisId?: string | null;
  dashboardPath?: string;
}) {
  const resultsUrl = `${getSiteUrl()}${details.dashboardPath || '/dashboard'}`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Your VestBlock Credit Analysis Is Ready',
    eventType: 'user_analysis_completed',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Your credit analysis is ready',
      `
      <p>Your VestBlock credit analysis has been completed. Review your results and next-step dispute support in your dashboard.</p>
      <p><strong>Analysis ID:</strong> ${escapeHtml(details.analysisId || 'Available in dashboard')}</p>
      <p><a href="${resultsUrl}" style="color:#67e8f9;">Open your dashboard</a></p>
    `
    ),
  });
}

export async function sendAdminAnalysisCompletedEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  analysisId?: string | null;
}) {
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'Credit Analysis Completed',
    eventType: 'admin_analysis_completed',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Credit analysis completed',
      `
      <p>A VestBlock credit analysis completed successfully.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || 'Unknown')}<br />
      <strong>Analysis ID:</strong> ${escapeHtml(details.analysisId || 'Unknown')}</p>
    `
    ),
  });
}

export async function sendCreditRepairFailureAlert(details: {
  userEmail?: string | null;
  userId?: string | null;
  reportId?: string | null;
  errorMessage?: string | null;
}) {
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Credit Analysis Failed',
    eventType: 'credit_analysis_failed',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Credit analysis failed',
      `
      <p>A credit repair workflow needs manual review.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || 'Unknown')}<br />
      <strong>Report ID:</strong> ${escapeHtml(details.reportId || 'Unknown')}<br />
      <strong>Error:</strong> ${escapeHtml(details.errorMessage || 'Unknown error')}</p>
    `
    ),
  });
}

export async function sendNewPaidCustomerAlert(details: {
  userEmail?: string | null;
  userId?: string | null;
  amount?: string | number | null;
  provider?: string;
  transactionId?: string | null;
}) {
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'New VestBlock Paid Customer',
    eventType: 'new_paid_customer',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'New paid customer',
      `
      <p>A customer completed payment and should be visible in the admin dashboard.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || details.userId || 'Unknown')}<br />
      <strong>Amount:</strong> ${escapeHtml(String(details.amount || 'Unknown'))}<br />
      <strong>Provider:</strong> ${escapeHtml(details.provider || 'PayPal')}<br />
      <strong>Transaction:</strong> ${escapeHtml(details.transactionId || 'Unknown')}</p>
    `
    ),
  });
}
