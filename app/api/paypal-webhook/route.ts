import { type NextRequest, NextResponse } from 'next/server';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';
import { createAdminClient } from '@/lib/supabase/admin';

const failedPaypalEvents = new Set([
  'PAYMENT.CAPTURE.DENIED',
  'CHECKOUT.ORDER.VOIDED',
]);

type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: any;
};

async function logPaymentFailure(input: {
  eventId?: string | null;
  eventType?: string | null;
  transactionId?: string | null;
  amount?: string | number | null;
  userId?: string | null;
  userEmail?: string | null;
  errorMessage: string;
}) {
  await runPaymentFailedAutomation({
    userId: input.userId,
    userEmail: input.userEmail,
    amount: input.amount,
    provider: 'PayPal',
    transactionId: input.transactionId || input.eventId,
    source: 'paypal-webhook',
    errorMessage: input.errorMessage,
    metadata: {
      eventId: input.eventId,
      eventType: input.eventType,
    },
  });
}

export async function POST(req: NextRequest) {
  let eventId: string | null = null;
  let eventType: string | null = null;

  try {
    const body = await req.text();
    const event = JSON.parse(body) as PaypalWebhookEvent;
    eventId = event.id || null;
    eventType = event.event_type || null;

    console.info('[paypal-webhook] Event received:', {
      eventType,
      eventId,
    });

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const payment = event.resource;
      const payerEmail = payment?.payer?.email_address;
      const amount = payment?.amount?.value;
      const transactionId = payment?.id || null;

      if (!payerEmail || !transactionId || !amount) {
        await logPaymentFailure({
          eventId,
          eventType,
          transactionId,
          amount,
          userEmail: payerEmail,
          errorMessage:
            'PayPal completed capture webhook was missing payer email, transaction ID, or amount.',
        });
        return NextResponse.json({ received: true, skipped: true });
      }

      const supabase = createAdminClient();
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id,user_id,email')
        .eq('email', payerEmail)
        .maybeSingle();

      if (userError || !userProfile) {
        await logPaymentFailure({
          eventId,
          eventType,
          userEmail: payerEmail,
          amount,
          transactionId,
          errorMessage:
            userError?.message || 'No VestBlock user profile found for payer email.',
        });
        return NextResponse.json({ received: true, needsReview: true });
      }

      const userId = userProfile.user_id || userProfile.id;
      const userEmail = userProfile.email || payerEmail;

      const { error: subscriptionError } = await supabase
        .from('user_profiles')
        .update({ is_subscribed: true })
        .or(`id.eq.${userId},user_id.eq.${userId}`);

      if (subscriptionError) {
        await logPaymentFailure({
          eventId,
          eventType,
          userId,
          userEmail,
          amount,
          transactionId,
          errorMessage:
            subscriptionError.message ||
            'Unable to update VestBlock subscription status.',
        });
        return NextResponse.json(
          { error: 'Subscription update failed.' },
          { status: 500 }
        );
      }

      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from('payments')
        .select('id')
        .eq('paypal_transaction_id', transactionId)
        .maybeSingle();

      if (existingPaymentError) {
        await logPaymentFailure({
          eventId,
          eventType,
          userId,
          userEmail,
          amount,
          transactionId,
          errorMessage:
            existingPaymentError.message || 'Unable to check existing PayPal payment.',
        });
        return NextResponse.json({ error: 'Payment lookup failed.' }, { status: 500 });
      }

      if (existingPayment?.id) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount: Number.parseFloat(amount),
          status: 'completed',
          payment_method: 'paypal',
          paypal_transaction_id: transactionId,
        })
        .select('id')
        .single();

      if (paymentError) {
        await logPaymentFailure({
          eventId,
          eventType,
          userId,
          userEmail,
          amount,
          transactionId,
          errorMessage: paymentError.message || 'Unable to record PayPal payment.',
        });
        return NextResponse.json({ error: 'Payment record failed.' }, { status: 500 });
      }

      console.info('[paypal-webhook] Payment recorded.', {
        paymentId: paymentRecord?.id || transactionId,
      });

      await runPaymentCompletedAutomation({
        paymentId: paymentRecord?.id || transactionId,
        userId,
        userEmail,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'paypal-webhook',
        metadata: { eventId, eventType },
      });
    }

    if (eventType && failedPaypalEvents.has(eventType)) {
      const payment = event.resource;
      await logPaymentFailure({
        eventId,
        eventType,
        userEmail: payment?.payer?.email_address,
        amount: payment?.amount?.value,
        transactionId: payment?.id || eventId,
        errorMessage: `PayPal webhook event ${eventType}.`,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PayPal webhook error:', message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
