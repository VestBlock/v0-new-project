import {
  createPaidCustomerOnboardingTask,
  createPaymentFailureTask,
} from '@/lib/admin/tasks';
import {
  sendNewPaidCustomerAlert,
  sendPaymentFailureAlert,
} from '@/lib/email/sendEmail';
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

type PaymentFailedAutomationInput = PaymentCompletedAutomationInput & {
  errorMessage?: string | null;
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

export async function runPaymentFailedAutomation(input: PaymentFailedAutomationInput) {
  const paymentId =
    input.paymentId ||
    input.transactionId ||
    `payment-failure-${Date.now().toString(36)}`;

  const [emailResult, taskResult, logResult] = await Promise.allSettled([
    sendPaymentFailureAlert({
      userId: input.userId,
      userEmail: input.userEmail,
      amount: input.amount,
      provider: input.provider || 'PayPal',
      transactionId: input.transactionId || paymentId,
      source: input.source,
      errorMessage: input.errorMessage,
    }),
    createPaymentFailureTask({
      paymentId,
      userId: input.userId,
      userEmail: input.userEmail,
      amount: input.amount,
      provider: input.provider,
      transactionId: input.transactionId,
      source: input.source,
      errorMessage: input.errorMessage,
    }),
    logEvent({
      eventType: 'payment_failed',
      actorUserId: input.userId,
      entityType: 'payment',
      entityId: paymentId,
      metadata: {
        provider: input.provider || 'PayPal',
        amount: input.amount,
        transactionId: input.transactionId,
        source: input.source,
        userEmail: input.userEmail,
        errorMessage: input.errorMessage,
        ...input.metadata,
      },
    }),
  ]);

  return { emailResult, taskResult, logResult };
}
