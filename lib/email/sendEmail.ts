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
  | 'admin_lead_email_sent'
  | 'admin_lead_run_daily_report'
  | 'admin_lead_scoring_daily_report'
  | 'admin_lead_outreach_daily_report'
  | 'admin_lead_send_daily_report'
  | 'user_service_deliverable_ready'
  | 'user_signup_growth_system_ready'
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
        <p style="margin-top:28px;color:#8aa4ad;font-size:12px;line-height:1.5;">VestBlock provides education, workflow tools, partner-intake support, DealVault records, and visibility planning. We do not guarantee funding, approvals, rankings, citations, deal volume, or closed transactions.</p>
      </div>
    </div>
  `;
}

function getDisputeMethodGuidance(letterType?: string | null) {
  const normalized = String(letterType || '').trim().toLowerCase();

  const defaultGuidance = {
    readyTitle: 'Review each letter carefully before mailing.',
    readyBody:
      'Make sure the facts are accurate, attach supporting records where helpful, and keep copies for your own file.',
    mailBody:
      'Review the PDF, attach supporting documents where relevant, and use a trackable mailing method so you can document when it was sent.',
    secondaryBody:
      'If the same reporting issue appears with more than one bureau, make sure each relevant bureau letter is reviewed and mailed separately.',
    responseBody:
      'Check for the bureau response, save the result, and compare it against the exact issue raised in the letter.',
    adminBody:
      'Check whether the customer completed the next step for this dispute method and whether another follow-up round is needed.',
  };

  const guides: Record<string, typeof defaultGuidance> = {
    'direct furnisher dispute': {
      readyTitle: 'Confirm the reporting source details before mailing.',
      readyBody:
        'Direct furnisher disputes work best when the reported balance, dates, payment status, or ownership issue is stated clearly and backed by documents.',
      mailBody:
        'Make sure the letter and attachments clearly show the balance, dates, status, or ownership issue you want the furnisher to investigate.',
      secondaryBody:
        'If the same account is reported across multiple bureaus, confirm whether matching bureau letters also need to be mailed while the furnisher dispute is pending.',
      responseBody:
        'Compare the furnisher or bureau response against the exact balance, status, ownership, or date issue raised in the letter.',
      adminBody:
        'Review whether the furnisher answered the specific reporting problem and whether bureau follow-up or another documentation round is needed.',
    },
    'method of verification': {
      readyTitle: 'Keep the prior dispute result handy with this letter.',
      readyBody:
        'This method works best when the customer is following up after a prior dispute and asking how the information was actually verified.',
      mailBody:
        'Include any prior dispute response if available so the follow-up request is tied to the earlier investigation result.',
      secondaryBody:
        'If multiple bureaus reported the same item after a prior dispute, check whether each bureau still needs its own verification follow-up.',
      responseBody:
        'Look for whether the bureau actually identified the method or source used to verify the reporting, not just a generic conclusion.',
      adminBody:
        'Confirm whether the bureau gave a real verification method and whether the customer needs a more specific follow-up.',
    },
    'statement of dispute': {
      readyTitle: 'Review the unresolved issue summary before mailing.',
      readyBody:
        'This method is meant to preserve the customer’s dispute position when the issue remains unresolved after review.',
      mailBody:
        'Make sure the unresolved issue is summarized clearly so the dispute notation request matches the customer’s actual position.',
      secondaryBody:
        'If the unresolved issue appears across multiple bureaus, confirm whether each file needs its own dispute notation request.',
      responseBody:
        'Check whether the response addresses the notation request or leaves the reporting unresolved without any file notation.',
      adminBody:
        'Review whether the bureau added the dispute notation or whether another customer follow-up is needed.',
    },
    'identity theft block': {
      readyTitle: 'Double-check the fraud documentation before mailing.',
      readyBody:
        'Identity-theft block letters are strongest when they line up with unauthorized activity details and any fraud or police documentation the customer has.',
      mailBody:
        'Make sure the unauthorized-account details and any fraud documentation are attached before mailing this identity-theft block request.',
      secondaryBody:
        'If fraudulent reporting appears across multiple bureaus, confirm whether each bureau received its own block request and supporting documents.',
      responseBody:
        'Check whether the response actually addresses the unauthorized activity and blocking request, not just the account status.',
      adminBody:
        'Review whether the bureau handled the fraud-block request correctly and whether additional documentation is needed quickly.',
    },
    'mixed file': {
      readyTitle: 'Review the wrong-person or merged-file details carefully.',
      readyBody:
        'Mixed-file disputes are strongest when the incorrect identifiers, addresses, or unrelated accounts are called out precisely.',
      mailBody:
        'Make sure the mixed-file details are specific so the bureau can separate unrelated identifiers or accounts from the customer’s file.',
      secondaryBody:
        'If the same merged-file problem appears with other bureaus, make sure those bureau letters are also reviewed and mailed.',
      responseBody:
        'Check whether the bureau corrected the mixed identifiers and removed unrelated accounts, not just whether it replied.',
      adminBody:
        'Review whether the response actually separated the file correctly and whether another correction round is needed.',
    },
    'outdated information': {
      readyTitle: 'Check the reporting dates before mailing.',
      readyBody:
        'Outdated-information disputes work best when the reporting timeline and the reason the item should no longer appear are easy to verify.',
      mailBody:
        'Review the dates and attach any records that help show the reporting timeline before mailing this request.',
      secondaryBody:
        'If the same outdated reporting appears with multiple bureaus, confirm whether each bureau letter has also been reviewed and mailed.',
      responseBody:
        'Check whether the bureau actually corrected or removed the outdated reporting based on the timeline issue raised.',
      adminBody:
        'Review whether the bureau addressed the reporting-period issue directly and whether another follow-up is needed.',
    },
    'personal information correction': {
      readyTitle: 'Confirm the wrong identifiers before mailing.',
      readyBody:
        'This method is strongest when the incorrect names, addresses, or identifiers are precise and tied to the customer’s real information.',
      mailBody:
        'Review the personal-information details closely and attach any records that support the correction request.',
      secondaryBody:
        'If the incorrect identifiers appear on multiple bureau files, make sure each bureau letter is reviewed separately.',
      responseBody:
        'Check whether the bureau corrected the wrong personal information and whether any related accounts still need review.',
      adminBody:
        'Review whether the bureau corrected the identifiers cleanly and whether related account cleanup is still needed.',
    },
  };

  return guides[normalized] || defaultGuidance;
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
  propertyAddress?: string | null;
  city?: string | null;
  state?: string | null;
  sourcePath?: string | null;
  summary?: string | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  const locationLine =
    details.propertyAddress || [details.city, details.state].filter(Boolean).join(', ') || null;
  const detailRows = [
    details.name ? `<strong>Name:</strong> ${escapeHtml(details.name)}` : null,
    details.email ? `<strong>Email:</strong> ${escapeHtml(details.email)}` : null,
    details.phone ? `<strong>Phone:</strong> ${escapeHtml(details.phone)}` : null,
    locationLine ? `<strong>Address:</strong> ${escapeHtml(locationLine)}` : null,
    details.leadType ? `<strong>Lead type:</strong> ${escapeHtml(details.leadType)}` : null,
    details.sourcePath ? `<strong>Source:</strong> ${escapeHtml(details.sourcePath)}` : null,
    details.leadId ? `<strong>Lead ID:</strong> ${escapeHtml(details.leadId)}` : null,
  ].filter(Boolean);
  const directContactCaptured = Boolean(String(details.email || '').trim() || String(details.phone || '').trim());

  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'New VestBlock Lead Submitted',
    eventType: 'admin_new_lead',
    userEmail: details.email,
    html: shell(
      'New lead submitted',
      `
      <p>A new VestBlock lead was submitted and is ready for follow-up.</p>
      ${
        detailRows.length
          ? `<p>${detailRows.join('<br />')}</p>`
          : '<p>No direct lead details were captured in this alert payload.</p>'
      }
      <p><strong>Direct contact captured:</strong> ${directContactCaptured ? 'Yes' : 'No'}</p>
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

export async function sendLeadOutreachSentAlertEmail(details: {
  leadId?: string | null;
  leadType?: string | null;
  name?: string | null;
  email?: string | null;
  provider?: string | null;
  subject?: string | null;
  sourcePath?: string | null;
  deliveryMode?: 'auto' | 'manual' | 'queue' | null;
}) {
  const adminUrl = details.leadId
    ? `${getSiteUrl()}/admin/leads/${details.leadId}`
    : `${getSiteUrl()}/admin/leads`;

  return sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: 'VestBlock Outreach Email Sent',
    eventType: 'admin_lead_email_sent',
    userEmail: details.email,
    html: shell(
      'Lead outreach email sent',
      `
      <p>A lead outreach email was successfully sent.</p>
      <p>
        ${details.name ? `<strong>Name:</strong> ${escapeHtml(details.name)}<br />` : ''}
        ${details.email ? `<strong>Email:</strong> ${escapeHtml(details.email)}<br />` : ''}
        ${details.leadType ? `<strong>Lead type:</strong> ${escapeHtml(details.leadType)}<br />` : ''}
        ${details.provider ? `<strong>Provider:</strong> ${escapeHtml(details.provider)}<br />` : ''}
        ${details.deliveryMode ? `<strong>Send path:</strong> ${escapeHtml(details.deliveryMode)}<br />` : ''}
        ${details.subject ? `<strong>Subject:</strong> ${escapeHtml(details.subject)}<br />` : ''}
        ${details.sourcePath ? `<strong>Source:</strong> ${escapeHtml(details.sourcePath)}<br />` : ''}
        ${details.leadId ? `<strong>Lead ID:</strong> ${escapeHtml(details.leadId)}` : ''}
      </p>
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open lead record</a></p>
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
  const reportUrl = 'https://www.annualcreditreport.com/';
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
      <p>Your VestBlock account is ready. The next step is getting a recent credit report and uploading it so we can start the credit analysis and dispute-letter workflow.</p>
      <p><strong>Official source:</strong> <a href="${reportUrl}" style="color:#67e8f9;">AnnualCreditReport.com</a></p>
      <p><a href="${uploadUrl}" style="color:#67e8f9;">Upload your credit report</a></p>
      <p>If you already uploaded a report, you can ignore this message and check your dashboard for status updates.</p>
    `
    ),
  });
}

export async function sendUserSignupGrowthSystemReadyEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  fullName?: string | null;
}) {
  const servicesUrl = `${getSiteUrl()}/dashboard/services`;
  const getStartedUrl = `${getSiteUrl()}/get-started`;
  const greeting = details.fullName
    ? `Hi ${escapeHtml(details.fullName)},`
    : 'Hi,';

  return sendEmail({
    to: details.userEmail,
    subject: 'Your VestBlock Growth System is ready',
    eventType: 'user_signup_growth_system_ready',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Your VestBlock Growth System is ready',
      `
      <p>${greeting}</p>
      <p>Your VestBlock starter workspace is ready. Use it to choose the right seller, buyer, lender, developer, contractor, operator, or capital-partner path.</p>
      <p>From there, VestBlock can support partnership review, DealVault records, and AEO/SEO Booster planning when the profile is clear enough to build around.</p>
      <p><a href="${servicesUrl}" style="color:#67e8f9;">Open your Growth System dashboard</a></p>
      <p><a href="${getStartedUrl}" style="color:#67e8f9;">Choose your VestBlock path</a></p>
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

export async function sendUserServiceDeliverableReadyEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  packageTitle: string;
  summary: string;
  recommendedActions?: string[];
  customerMessage?: string | null;
}) {
  const servicesUrl = `${getSiteUrl()}/dashboard/services`;
  const actions = (details.recommendedActions || [])
    .slice(0, 5)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  return sendEmail({
    to: details.userEmail,
    subject: `Your ${details.packageTitle} is ready`,
    eventType: 'user_service_deliverable_ready',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      `${details.packageTitle} is ready`,
      `
      <p>Your VestBlock service deliverable is ready to review.</p>
      <p><strong>Service:</strong> ${escapeHtml(details.packageTitle)}</p>
      <p>${escapeHtml(details.summary)}</p>
      ${
        actions
          ? `<p><strong>Recommended next steps:</strong></p><ul>${actions}</ul>`
          : ''
      }
      ${
        details.customerMessage
          ? `<p><strong>VestBlock note:</strong><br />${escapeHtml(details.customerMessage)}</p>`
          : ''
      }
      <p><a href="${servicesUrl}" style="color:#67e8f9;">Open your service dashboard</a></p>
      <p>Only submit truthful, accurate, and documentable information as you move into any next funding, grant, credit, or deal step.</p>
    `
    ),
  });
}

export async function sendUserDisputeLettersReadyEmail(details: {
  userEmail?: string | null;
  userId?: string | null;
  reportId?: string | null;
  generatedLetterCount?: number | null;
  letterTypes?: string[] | null;
}) {
  const lettersUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  const uniqueTypes = Array.from(
    new Set((details.letterTypes || []).map((type) => String(type).trim()).filter(Boolean))
  );
  const methodSummary = uniqueTypes.length
    ? `<p><strong>Methods included:</strong></p><ul>${uniqueTypes
        .slice(0, 6)
        .map((type) => `<li>${escapeHtml(type)}</li>`)
        .join('')}</ul>`
    : '';
  const firstGuide = getDisputeMethodGuidance(uniqueTypes[0] || null);
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
      ${methodSummary}
      <p><strong>VestBlock note:</strong> ${escapeHtml(firstGuide.readyTitle)} ${escapeHtml(firstGuide.readyBody)}</p>
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
  const guide = getDisputeMethodGuidance(details.letterType);
  return sendEmail({
    to: details.userEmail,
    subject: 'Reminder: mail your VestBlock dispute letter',
    eventType: 'user_dispute_letter_mail_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Mail your dispute letter when ready',
      `
      <p>Your generated dispute letter is still waiting for the mailing step. ${escapeHtml(guide.mailBody)}</p>
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
  letterType?: string | null;
}) {
  const lettersUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  const guide = getDisputeMethodGuidance(details.letterType);
  return sendEmail({
    to: details.userEmail,
    subject: 'Check your remaining bureau dispute letters',
    eventType: 'user_dispute_secondary_bureau_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Check the other bureau letters',
      `
      <p>${escapeHtml(guide.secondaryBody)} Do not assume one bureau dispute updates every file automatically.</p>
      <p><strong>Current letter:</strong> ${escapeHtml(details.bureau || 'Credit bureau letter')}<br />
      <strong>Letter type:</strong> ${escapeHtml(details.letterType || 'Dispute letter')}<br />
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
  letterType?: string | null;
}) {
  const dashboardUrl = `${getSiteUrl()}/tools/my-dispute-letters`;
  const guide = getDisputeMethodGuidance(details.letterType);
  return sendEmail({
    to: details.userEmail,
    subject: 'Check for your credit bureau response',
    eventType: 'user_dispute_bureau_response_reminder',
    userId: details.userId,
    userEmail: details.userEmail,
    html: shell(
      'Check for the bureau response',
      `
      <p>Your dispute-letter response window is ready for review. ${escapeHtml(guide.responseBody)}</p>
      <p><strong>Bureau/recipient:</strong> ${escapeHtml(details.bureau || 'See letter PDF')}<br />
      <strong>Letter type:</strong> ${escapeHtml(details.letterType || 'Dispute letter')}<br />
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
  letterType?: string | null;
  reason?: string | null;
}) {
  const adminUrl = `${getSiteUrl()}/admin-panel`;
  const guide = getDisputeMethodGuidance(details.letterType);
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
      <strong>Letter type:</strong> ${escapeHtml(details.letterType || 'Dispute letter')}<br />
      <strong>Letter ID:</strong> ${escapeHtml(details.letterId || 'Unknown')}<br />
      <strong>Reason:</strong> ${escapeHtml(details.reason || 'Reminder threshold reached')}</p>
      <p><strong>Method-aware note:</strong> ${escapeHtml(guide.adminBody)}</p>
      <p><a href="${adminUrl}" style="color:#67e8f9;">Open admin dashboard</a></p>
    `
    ),
  });
}
