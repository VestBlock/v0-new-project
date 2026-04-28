import { createFundingStrategyReviewTask } from '@/lib/admin/tasks';
import { sendNewLeadAlertEmail } from '@/lib/email/sendEmail';
import { logEvent } from '@/lib/system/logEvent';

type FundingStrategyAutomationInput = {
  requestId: string;
  userId?: string | null;
  userEmail?: string | null;
  fullName?: string | null;
  phone?: string | null;
  businessName?: string | null;
  readinessScore?: number | null;
  readinessTier?: string | null;
  summary?: string | null;
  paid?: boolean;
  metadata?: Record<string, unknown>;
};

export async function runFundingStrategySubmittedAutomation(
  input: FundingStrategyAutomationInput
) {
  const [emailResult, taskResult, logResult] = await Promise.allSettled([
    sendNewLeadAlertEmail({
      leadId: input.requestId,
      leadType: 'credit_card_funding_strategy',
      name: input.fullName || input.businessName,
      email: input.userEmail,
      phone: input.phone,
      sourcePath: '/funding/business-funding-strategy',
      summary:
        input.summary ||
        `Readiness score ${input.readinessScore ?? 'n/a'} (${input.readinessTier || 'unknown'}).`,
    }),
    createFundingStrategyReviewTask({
      requestId: input.requestId,
      userId: input.userId,
      userEmail: input.userEmail,
      businessName: input.businessName,
      readinessScore: input.readinessScore,
      readinessTier: input.readinessTier,
      paid: input.paid,
    }),
    logEvent({
      eventType: input.paid
        ? 'funding_strategy_paid'
        : 'funding_strategy_submitted',
      actorUserId: input.userId,
      entityType: 'funding_strategy_request',
      entityId: input.requestId,
      metadata: {
        userEmail: input.userEmail,
        businessName: input.businessName,
        readinessScore: input.readinessScore,
        readinessTier: input.readinessTier,
        summary: input.summary,
        paid: Boolean(input.paid),
        ...input.metadata,
      },
    }),
  ]);

  return { emailResult, taskResult, logResult };
}
