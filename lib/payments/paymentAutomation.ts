import { createPaidCustomerOnboardingTask } from '@/lib/admin/tasks';
import { sendNewPaidCustomerAlert } from '@/lib/email/sendEmail';
import { logEvent } from '@/lib/system/logEvent';

type PaymentCompletedAutomationInput = {
  paymentId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  amount?: string | number | null;
  provider?: string | null;
  transactionId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export async function runPaymentCompletedAutomation(
  input: PaymentCompletedAutomationInput
) {
  const paymentId = input.paymentId || input.transactionId || null;

  const [emailResult, taskResult, logResult] = await Promise.allSettled([
    sendNewPaidCustomerAlert({
      userId: input.userId,
      userEmail: input.userEmail,
      amount: input.amount,
      provider: input.provider || 'PayPal',
      transactionId: input.transactionId,
    }),
    paymentId
      ? createPaidCustomerOnboardingTask({
          paymentId,
          userId: input.userId,
          userEmail: input.userEmail,
          amount: input.amount,
          provider: input.provider,
          transactionId: input.transactionId,
        })
      : Promise.resolve({ ok: false, skipped: true, error: 'Missing payment id.' }),
    logEvent({
      eventType: 'payment_completed',
      actorUserId: input.userId,
      entityType: 'payment',
      entityId: paymentId,
      metadata: {
        provider: input.provider || 'PayPal',
        amount: input.amount,
        transactionId: input.transactionId,
        source: input.source,
        userEmail: input.userEmail,
        ...input.metadata,
      },
    }),
  ]);

  return { emailResult, taskResult, logResult };
}
