import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

type EmailEventType =
  | 'admin_credit_report_uploaded'
  | 'user_credit_report_received'
  | 'user_analysis_completed'
  | 'admin_analysis_completed'
  | 'credit_analysis_failed'
  | 'new_paid_customer'
  | 'admin_payment_failed'
  | 'admin_abandoned_checkout'
  | 'admin_new_lead'
  | 'user_upload_reminder'
  | 'user_paid_upload_reminder'
  | 'admin_lead_followup'
  | 'user_dispute_letters_ready'
  | 'user_dispute_letter_mail_reminder'
  | 'user_dispute_secondary_bureau_reminder'
  | 'user_dispute_bureau_response_reminder'
  | 'admin_dispute_letter_followup';

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
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');

  try {
    return new URL(configured).origin;
  } catch {
    return 'https://www.vestblock.io';
  }
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

export async function sendPaymentFailureAlert(details: {
  userEmail?: string | null;
  userId?: string | null;
  amount?: string | number | null;
  provider?: string;
  transactionId?: string | null;
  source?: string | null;
  errorMessage?: string | null;
}) {
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Payment Needs Review',
    eventType: 'admin_payment_failed',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Payment needs review',
      `
      <p>A payment attempt failed or could not be recorded. Review the checkout/provider status before following up.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || details.userId || 'Unknown')}<br />
      <strong>Amount:</strong> ${escapeHtml(String(details.amount || 'Unknown'))}<br />
      <strong>Provider:</strong> ${escapeHtml(details.provider || 'PayPal')}<br />
      <strong>Transaction/order:</strong> ${escapeHtml(details.transactionId || 'Unknown')}<br />
      <strong>Source:</strong> ${escapeHtml(details.source || 'Unknown')}<br />
      <strong>Error:</strong> ${escapeHtml(details.errorMessage || 'Unknown error')}</p>
    `
    ),
  });
}

export async function sendAdminAbandonedCheckoutEmail(details: {
  checkoutId: string;
  userEmail?: string | null;
  userId?: string | null;
  ageHours?: number | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Checkout Needs Follow-Up',
    eventType: 'admin_abandoned_checkout',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Checkout follow-up needed',
      `
      <p>A PayPal order was created but no completed payment has been recorded yet.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || details.userId || 'Unknown')}<br />
      <strong>Checkout/order ID:</strong> ${escapeHtml(details.checkoutId)}<br />
      <strong>Age:</strong> ${escapeHtml(String(details.ageHours || 'Unknown'))} hours</p>
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}

export async function sendNewLeadAlertEmail(details: {
  leadId?: string | null;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  sourcePath?: string | null;
  summary?: string | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'New VestBlock Lead Submitted',
    eventType: 'admin_new_lead',
    userEmail: details.email,
    html: shell(
      'New lead submitted',
      `
      <p>A new VestBlock lead was submitted and is ready for follow-up.</p>
      <p><strong>Name:</strong> ${escapeHtml(details.name || 'Unknown')}<br />
      <strong>Email:</strong> ${escapeHtml(details.email || 'Unknown')}<br />
      <strong>Phone:</strong> ${escapeHtml(details.phone || 'Unknown')}<br />
      <strong>Lead type:</strong> ${escapeHtml(details.leadType || 'Unknown')}<br />
      <strong>Source:</strong> ${escapeHtml(details.sourcePath || 'Unknown')}<br />
      <strong>Lead ID:</strong> ${escapeHtml(details.leadId || 'Unknown')}</p>
      ${
        details.summary
          ? `<p><strong>Summary:</strong><br />${escapeHtml(details.summary)}</p>`
          : ''
      }
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}

export async function sendUserUploadReminderEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  fullName?: string | null;
}) {
  const uploadUrl = `${getSiteUrl()}/credit-upload`;
  const greeting = details.fullName
    ? `Hi ${escapeHtml(details.fullName)},`
    : 'Hi,';

  return sendEmail({
    to: details.userEmail,
    subject: 'Ready for your VestBlock credit analysis?',
    eventType: 'user_upload_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Your credit analysis starts with an upload',
      `
      <p>${greeting}</p>
      <p>Your VestBlock account is ready. The next step is uploading a recent credit report so we can start the credit analysis and dispute-letter workflow.</p>
      <p><a href="${uploadUrl}" style="color:#67e8f9;">Upload your credit report</a></p>
      <p>If you already uploaded a report, you can ignore this message and check your dashboard for status updates.</p>
    `
    ),
  });
}

export async function sendPaidCustomerUploadReminderEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  amount?: string | number | null;
}) {
  const uploadUrl = `${getSiteUrl()}/credit-upload`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Next step: upload your credit report',
    eventType: 'user_paid_upload_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Let’s start your VestBlock credit workflow',
      `
      <p>Thanks for joining VestBlock. Your next step is to upload your credit report so we can begin analysis and prepare dispute-letter support where appropriate.</p>
      <p><strong>Payment:</strong> ${escapeHtml(String(details.amount || 'Completed'))}</p>
      <p><a href="${uploadUrl}" style="color:#67e8f9;">Upload your credit report</a></p>
      <p>Once uploaded, you will be able to track the report status from your dashboard.</p>
    `
    ),
  });
}

export async function sendAdminLeadFollowupEmail(details: {
  leadId: string;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  ageHours?: number | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Lead Needs Follow-Up',
    eventType: 'admin_lead_followup',
    userEmail: details.email,
    html: shell(
      'Lead follow-up needed',
      `
      <p>A lead is still marked new after the follow-up window.</p>
      <p><strong>Name:</strong> ${escapeHtml(details.name || 'Unknown')}<br />
      <strong>Email:</strong> ${escapeHtml(details.email || 'Unknown')}<br />
      <strong>Lead type:</strong> ${escapeHtml(details.leadType || 'Unknown')}<br />
      <strong>Lead ID:</strong> ${escapeHtml(details.leadId)}<br />
      <strong>Age:</strong> ${escapeHtml(String(details.ageHours || 'Unknown'))} hours</p>
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}

export async function sendUserDisputeLettersReadyEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  reportId?: string | null;
  generatedLetterCount?: number | null;
}) {
  const lettersUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Your VestBlock dispute letters are ready',
    eventType: 'user_dispute_letters_ready',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Your dispute letters are ready',
      `
      <p>Your VestBlock dispute-letter PDFs are ready to review. Download each letter, review it for accuracy, attach supporting documents, and mail it using a trackable method when you are comfortable.</p>
      <p><strong>Letters generated:</strong> ${escapeHtml(String(details.generatedLetterCount || 'Available in dashboard'))}<br />
      <strong>Report ID:</strong> ${escapeHtml(details.reportId || 'Available in dashboard')}</p>
      <p><a href="${lettersUrl}" style="color:#67e8f9;">Open your dispute letters</a></p>
      <p>Keep your mailing receipts and bureau responses. VestBlock can help you track the next review window from your dashboard.</p>
    `
    ),
  });
}

export async function sendUserDisputeLetterMailReminderEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  letterId?: string | null;
  bureau?: string | null;
  letterType?: string | null;
}) {
  const lettersUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Reminder: mail your VestBlock dispute letter',
    eventType: 'user_dispute_letter_mail_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Mail your dispute letter when ready',
      `
      <p>Your generated dispute letter is still waiting for the mailing step. Review the PDF, include copies of any supporting documents, and use a trackable mailing method so you can document when it was sent.</p>
      <p><strong>Bureau/recipient:</strong> ${escapeHtml(details.bureau || 'See letter PDF')}<br />
      <strong>Letter type:</strong> ${escapeHtml(details.letterType || 'Dispute letter')}<br />
      <strong>Letter ID:</strong> ${escapeHtml(details.letterId || 'Available in dashboard')}</p>
      <p><a href="${lettersUrl}" style="color:#67e8f9;">Open dispute letters</a></p>
    `
    ),
  });
}

export async function sendUserSecondaryBureauReminderEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  letterId?: string | null;
  bureau?: string | null;
}) {
  const lettersUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Check your remaining bureau dispute letters',
    eventType: 'user_dispute_secondary_bureau_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Check the other bureau letters',
      `
      <p>If this issue appears on more than one credit bureau report, make sure each relevant bureau letter is reviewed and mailed separately. Do not assume one bureau dispute updates every file automatically.</p>
      <p><strong>Current letter:</strong> ${escapeHtml(details.bureau || 'Credit bureau letter')}<br />
      <strong>Letter ID:</strong> ${escapeHtml(details.letterId || 'Available in dashboard')}</p>
      <p><a href="${lettersUrl}" style="color:#67e8f9;">Review dispute letters</a></p>
    `
    ),
  });
}

export async function sendUserDisputeBureauResponseReminderEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  letterId?: string | null;
  bureau?: string | null;
}) {
  const dashboardUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  return sendEmail({
    to: details.userEmail,
    subject: 'Check for your credit bureau response',
    eventType: 'user_dispute_bureau_response_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Check for the bureau response',
      `
      <p>Your dispute-letter response window is ready for review. Check your mail, email, and bureau account for investigation results, then save the response for your records.</p>
      <p><strong>Bureau/recipient:</strong> ${escapeHtml(details.bureau || 'See letter PDF')}<br />
      <strong>Letter ID:</strong> ${escapeHtml(details.letterId || 'Available in dashboard')}</p>
      <p><a href="${dashboardUrl}" style="color:#67e8f9;">Update your dispute-letter status</a></p>
    `
    ),
  });
}

export async function sendAdminDisputeLetterFollowupEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  letterId?: string | null;
  bureau?: string | null;
  reason?: string | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Dispute Letter Follow-Up Needed',
    eventType: 'admin_dispute_letter_followup',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Dispute-letter follow-up needed',
      `
      <p>A dispute-letter workflow needs review or customer follow-up.</p>
      <p><strong>User:</strong> ${escapeHtml(details.userEmail || details.userId || 'Unknown')}<br />
      <strong>Bureau/recipient:</strong> ${escapeHtml(details.bureau || 'Unknown')}<br />
      <strong>Letter ID:</strong> ${escapeHtml(details.letterId || 'Unknown')}<br />
      <strong>Reason:</strong> ${escapeHtml(details.reason || 'Reminder threshold reached')}</p>
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}
