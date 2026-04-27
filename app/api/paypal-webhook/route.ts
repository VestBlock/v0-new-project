import { type NextRequest, NextResponse } from 'next/server';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';
import { createFundingStrategyReviewTask } from '@/lib/admin/tasks';
import { logEvent } from '@/lib/system/logEvent';
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
      const orderId = payment?.supplementary_data?.related_ids?.order_id || null;

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
      const { data: fundingRequest } = orderId
        ? await supabase
            .from('funding_strategy_requests')
            .select('id,user_id,user_email,business_name,readiness_score,readiness_tier')
            .eq('paypal_order_id', orderId)
            .maybeSingle()
        : { data: null };
      const productType = fundingRequest?.id
        ? 'funding_strategy_review'
        : 'vestblock_pro';

      const { error: subscriptionError } =
        productType === 'vestblock_pro'
          ? await supabase
              .from('user_profiles')
              .update({ is_subscribed: true, paypal_order_product: productType })
              .or(`id.eq.${userId},user_id.eq.${userId}`)
          : { error: null };

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
          product_type: productType,
          metadata_json: {
            eventId,
            eventType,
            orderId,
            requestId: fundingRequest?.id,
            productType,
          },
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

      if (productType === 'funding_strategy_review' && fundingRequest?.id) {
        const { error: requestUpdateError } = await supabase
          .from('funding_strategy_requests')
          .update({
            payment_status: 'paid',
            status: 'paid',
            payment_id: paymentRecord?.id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', fundingRequest.id);

        if (!requestUpdateError) {
          await Promise.allSettled([
            createFundingStrategyReviewTask({
              requestId: fundingRequest.id,
              userId,
              userEmail: fundingRequest.user_email || userEmail,
              businessName: fundingRequest.business_name,
              readinessScore: fundingRequest.readiness_score,
              readinessTier: fundingRequest.readiness_tier,
              paid: true,
            }),
            logEvent({
              eventType: 'funding_strategy_paid',
              actorUserId: userId,
              entityType: 'funding_strategy_request',
              entityId: fundingRequest.id,
              metadata: {
                paymentId: paymentRecord?.id,
                transactionId,
                orderId,
                amount,
                source: 'paypal-webhook',
              },
            }),
          ]);
        }
      }

      await runPaymentCompletedAutomation({
        paymentId: paymentRecord?.id || transactionId,
        userId,
        userEmail,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'paypal-webhook',
        metadata: { eventId, eventType, orderId, requestId: fundingRequest?.id, productType },
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
