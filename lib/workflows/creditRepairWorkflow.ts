import {
  sendAdminAlertEmail,
  sendAdminAnalysisCompletedEmail,
  sendCreditRepairFailureAlert,
  sendUserAnalysisCompletedEmail,
  sendUserCreditReportReceivedEmail,
} from '@/lib/email/sendEmail';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

export const creditRepairStatuses = [
  'uploaded',
  'extracting_text',
  'text_extracted',
  'analyzing',
  'completed',
  'failed',
  'needs_review',
] as const;

export type CreditRepairStatus = (typeof creditRepairStatuses)[number];

type ReportRecordInput = {
  userId: string;
  userEmail?: string | null;
  fileName: string;
  filePath?: string | null;
  fileUrl?: string | null;
};

async function updateReport(reportId: string, updates: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('credit_reports')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', reportId);

    if (error) {
      console.warn('[credit-workflow] report update skipped:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[credit-workflow] report update unavailable:', message);
    return { ok: false, error: message };
  }
}

export async function createCreditReportRecord(input: ReportRecordInput) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('credit_reports')
    .insert({
      user_id: input.userId,
      user_email: input.userEmail,
      file_name: input.fileName,
      file_path: input.filePath,
      file_url: input.fileUrl,
      status: 'uploaded',
      email_alert_sent: false,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  await logEvent({
    eventType: 'credit_report_uploaded',
    actorUserId: input.userId,
    entityType: 'credit_report',
    entityId: data.id,
    metadata: { fileName: input.fileName, userEmail: input.userEmail },
  });

  await Promise.all([
    sendAdminAlertEmail({
      userEmail: input.userEmail,
      fileName: input.fileName,
      userId: input.userId,
      reportId: data.id,
    }),
    sendUserCreditReportReceivedEmail({
      userEmail: input.userEmail,
      userId: input.userId,
      fileName: input.fileName,
    }),
  ]);

  await updateReport(data.id, { email_alert_sent: true });
  return data.id as string;
}

export async function updateCreditReportStatus(
  reportId: string,
  status: CreditRepairStatus,
  metadata?: Record<string, unknown>
) {
  const result = await updateReport(reportId, { status });
  await logEvent({
    eventType:
      status === 'completed'
        ? 'credit_analysis_completed'
        : status === 'failed'
          ? 'credit_analysis_failed'
          : 'credit_analysis_started',
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { status, ...metadata },
  });
  return result;
}

export async function attachExtractedText(
  reportId: string,
  extractedText: string
) {
  return updateReport(reportId, {
    status: 'text_extracted',
    extracted_text: extractedText,
  });
}

export async function attachAnalysisResult(
  reportId: string,
  analysisJson: unknown,
  details?: { userId?: string | null; userEmail?: string | null }
) {
  const result = await updateReport(reportId, {
    status: 'completed',
    analysis_json: analysisJson,
    completed_at: new Date().toISOString(),
  });

  await Promise.all([
    sendUserAnalysisCompletedEmail({
      userEmail: details?.userEmail,
      userId: details?.userId,
      analysisId: reportId,
    }),
    sendAdminAnalysisCompletedEmail({
      userEmail: details?.userEmail,
      userId: details?.userId,
      analysisId: reportId,
    }),
  ]);
  await logEvent({
    eventType: 'credit_analysis_completed',
    actorUserId: details?.userId,
    entityType: 'credit_report',
    entityId: reportId,
  });
  return result;
}

export async function attachDisputeLetters(
  reportId: string,
  disputeLettersJson: unknown
) {
  return updateReport(reportId, {
    dispute_letters_json: disputeLettersJson,
  });
}

export async function markCreditReportFailed(
  reportId: string,
  error: unknown,
  details?: { userId?: string | null; userEmail?: string | null }
) {
  const message = error instanceof Error ? error.message : String(error);
  await updateReport(reportId, {
    status: 'failed',
    error_message: message,
  });
  await sendCreditRepairFailureAlert({
    userEmail: details?.userEmail,
    userId: details?.userId,
    reportId,
    errorMessage: message,
  });
  await logEvent({
    eventType: 'credit_analysis_failed',
    actorUserId: details?.userId,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { message },
  });
}
