export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import axios from 'axios';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import { createAdminClient } from '@/lib/supabase/admin';

const failedPaypalEvents = new Set([
  'PAYMENT.CAPTURE.DENIED',
  'CHECKOUT.ORDER.VOIDED',
]);

type PaypalEvent = {
  id?: string;
  event_type?: string;
  resource?: any;
};

async function logPaymentFailure(input: {
  eventId?: string | null;
  eventType?: string | null;
  orderId?: string | null;
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
    transactionId: input.transactionId || input.orderId || input.eventId,
    source: 'webhook',
    errorMessage: input.errorMessage,
    metadata: {
      eventId: input.eventId,
      eventType: input.eventType,
      orderId: input.orderId,
    },
  });
}

export async function POST(request: Request) {
  let eventId: string | null = null;
  let eventType: string | null = null;
  let orderId: string | null = null;

  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody) as PaypalEvent;
    eventId = event.id || null;
    eventType = event.event_type || null;

    console.info('[paypal-webhook] Event received:', {
      eventType,
      eventId,
    });

    const headers = request.headers;
    const transmissionId = headers.get('paypal-transmission-id');
    const transmissionTime = headers.get('paypal-transmission-time');
    const certUrl = headers.get('paypal-cert-url');
    const authAlgo = headers.get('paypal-auth-algo');
    const transmissionSig = headers.get('paypal-transmission-sig');
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig ||
      !webhookId ||
      !clientId ||
      !secret
    ) {
      console.error('[paypal-webhook] Missing PayPal webhook verification config or headers.');
      return new Response('Webhook verification is not configured', {
        status: 400,
      });
    }

    const verifyRes = await axios.post(
      getPaypalApiUrl('/v1/notifications/verify-webhook-signature'),
      {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
      {
        auth: {
          username: clientId,
          password: secret,
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (verifyRes.data.verification_status !== 'SUCCESS') {
      console.error('Invalid PayPal webhook signature:', verifyRes.data);
      return new Response('Invalid signature', { status: 400 });
    }

    const resource = event.resource;
    orderId =
      resource?.supplementary_data?.related_ids?.order_id || resource?.id || null;

    let capturedResource = resource;

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      if (orderId) {
        const getData = await generatePaypalAccessToken();
        const { data: captureData } = await axios.post(
          getPaypalApiUrl(`/v2/checkout/orders/${orderId}/capture`),
          {},
          { headers: { Authorization: `Bearer ${getData.access_token}` } }
        );

        capturedResource = {
          ...resource,
          id: captureData.id || resource?.id,
          purchase_units: captureData.purchase_units,
          status: captureData.status || resource?.status,
        };
      } else {
        await logPaymentFailure({
          eventId,
          eventType,
          errorMessage: 'PayPal approval webhook did not include an order ID.',
        });
      }
    }

    if (
      eventType === 'PAYMENT.CAPTURE.COMPLETED' ||
      eventType === 'CHECKOUT.ORDER.APPROVED'
    ) {
      const capture =
        capturedResource?.purchase_units?.[0]?.payments?.captures?.[0] || null;
      const captureStatus =
        eventType === 'PAYMENT.CAPTURE.COMPLETED'
          ? resource?.status
          : capture?.status;
      const transactionId =
        eventType === 'PAYMENT.CAPTURE.COMPLETED'
          ? resource?.id
          : capture?.id || orderId;
      const amount =
        eventType === 'PAYMENT.CAPTURE.COMPLETED'
          ? resource?.amount?.value
          : capture?.amount?.value;

      console.info('[paypal-webhook] Capture event received:', {
        captureStatus,
        orderId,
        transactionId,
      });

      if (captureStatus === 'COMPLETED' && orderId) {
        const supabase = createAdminClient();
        const { data: userProfile, error: userError } = await supabase
          .from('user_profiles')
          .select('id,user_id,email')
          .eq('paypal_order_id', orderId)
          .maybeSingle();

        if (userError || !userProfile) {
          await logPaymentFailure({
            eventId,
            eventType,
            orderId,
            transactionId,
            amount,
            userEmail: userProfile?.email,
            errorMessage:
              userError?.message ||
              'No VestBlock user profile found for PayPal order ID.',
          });
          return new Response('User profile not found', { status: 500 });
        }

        const userId = userProfile.user_id || userProfile.id;
        const paymentAmount = amount ? Number.parseFloat(amount) : null;
        let paymentRecord: { id: string } | null = null;
        let duplicatePayment = false;

        if (transactionId) {
          const { data: existingPayment, error: existingPaymentError } =
            await supabase
              .from('payments')
              .select('id')
              .eq('paypal_transaction_id', transactionId)
              .maybeSingle();

          if (existingPaymentError) {
            await logPaymentFailure({
              eventId,
              eventType,
              orderId,
              transactionId,
              amount,
              userId,
              userEmail: userProfile.email,
              errorMessage:
                existingPaymentError.message ||
                'Unable to check existing PayPal payment.',
            });
            return new Response('DB lookup failed', { status: 500 });
          }

          if (existingPayment?.id) {
            paymentRecord = existingPayment;
            duplicatePayment = true;
          }
        }

        const { data: insertedPayment, error: paymentError } = paymentRecord
          ? { data: paymentRecord, error: null }
          : await supabase
              .from('payments')
              .insert({
                user_id: userId,
                amount: paymentAmount,
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
            orderId,
            transactionId,
            amount,
            userId,
            userEmail: userProfile.email,
            errorMessage:
              paymentError.message || 'Unable to record PayPal payment.',
          });
          return new Response('DB insert failed', { status: 500 });
        }

        paymentRecord = insertedPayment;

        const { error: subscriptionError } = await supabase
          .from('user_profiles')
          .update({ is_subscribed: true })
          .or(`id.eq.${userId},user_id.eq.${userId}`);

        if (subscriptionError) {
          await logPaymentFailure({
            eventId,
            eventType,
            orderId,
            transactionId,
            amount,
            userId,
            userEmail: userProfile.email,
            errorMessage:
              subscriptionError.message ||
              'Unable to update VestBlock subscription status.',
          });
          return new Response('DB update failed', { status: 500 });
        }

        if (!duplicatePayment) {
          await runPaymentCompletedAutomation({
            paymentId: paymentRecord?.id || transactionId,
            userId,
            userEmail: userProfile.email,
            amount,
            provider: 'PayPal',
            transactionId,
            source: 'webhook',
            metadata: {
              eventId,
              eventType,
              orderId,
            },
          });
        }
      } else if (captureStatus && captureStatus !== 'COMPLETED') {
        await logPaymentFailure({
          eventId,
          eventType,
          orderId,
          transactionId,
          amount,
          errorMessage: `PayPal capture status was ${captureStatus}.`,
        });
      }
    }

    if (eventType && failedPaypalEvents.has(eventType)) {
      await logPaymentFailure({
        eventId,
        eventType,
        orderId,
        transactionId: resource?.id || orderId,
        amount: resource?.amount?.value,
        userEmail: resource?.payer?.email_address,
        errorMessage: `PayPal webhook event ${eventType}.`,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook handler error:', errorMessage);
    await logPaymentFailure({
      eventId,
      eventType,
      orderId,
      errorMessage,
    });

    return new Response('Webhook processing error', { status: 500 });
  }
}
