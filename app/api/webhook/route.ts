export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { generatePaypalAccessToken } from '../create-order/route';

// Supabase Admin client (service-role key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  console.debug('🚀 ~ POST ~ request:', request);
  try {
    // 1) Read raw request body
    // const buf = await getRawBody(request as any);
    // const rawBody = buf.toString('utf8');
    // const event = JSON.parse(rawBody);
    // 1) Read raw body as text
    const rawBody = await request.text();
    console.debug('🚀 ~ POST ~ rawBody:', rawBody);
    const event = JSON.parse(rawBody);
    console.debug('🚀 ~ POST ~ event:', event);

    // 2) Extract PayPal headers for verification
    const headers = request.headers;
    const transmissionId = headers.get('paypal-transmission-id')!;
    const transmissionTime = headers.get('paypal-transmission-time')!;
    const certUrl = headers.get('paypal-cert-url')!;
    const authAlgo = headers.get('paypal-auth-algo')!;
    const transmissionSig = headers.get('paypal-transmission-sig')!;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID!;
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const secret = process.env.PAYPAL_CLIENT_SECRET!;
    console.debug(
      '🚀 ~ POST ~ HEADERS:',
      transmissionId,
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookId,
      clientId,
      secret,
      event
    );

    // 3) Verify webhook signature with PayPal
    const verifyRes = await axios.post(
      'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
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
    console.debug('🚀 ~ POST ~ verifyRes:', verifyRes);

    if (verifyRes.data.verification_status !== 'SUCCESS') {
      console.error('Invalid PayPal webhook signature:', verifyRes.data);
      return new Response('Invalid signature', { status: 400 });
    }

    // 4) Handle PAYMENT.CAPTURE.COMPLETED event
    console.debug('🚀 ~ POST ~ event:', event);
    console.debug('🚀 ~ POST ~ event:', event.event_type);
    const resource = event.resource;
    const orderId =
      resource?.supplementary_data?.related_ids?.order_id || resource?.id;

    // 4a) Handle order approval: capture payment
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      if (orderId) {
        const getData = await generatePaypalAccessToken();
        // capture
        const { data: captureData } = await axios.post(
          `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
          {},
          { headers: { Authorization: `Bearer ${getData.access_token}` } }
        );
        // fall through to subscription update
        resource.purchase_units = captureData.purchase_units;
      }
    }

    // 4b) Handle payment capture completed
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      // detect completed status
      const captureStatus = resource.status;
      console.debug('🚀 ~ POST ~ resource:', resource);
      console.debug('🚀 ~ POST ~ captureStatus:', captureStatus, orderId);
      if (captureStatus === 'COMPLETED' && orderId) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_subscribed: true })
          .eq('paypal_order_id', orderId);

        if (error) {
          console.error('Supabase update error', error);
          return new Response('DB update failed', { status: 500 });
        }
      }
    }

    // 5) Acknowledge
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Webhook handler error:', err.message || err);
    return new Response('Webhook processing error', { status: 500 });
  }
}
