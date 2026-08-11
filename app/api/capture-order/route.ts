import axios from 'axios';
import { NextResponse } from 'next/server';

import { analyticsEvents } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { createFundingStrategyReviewTask } from '@/lib/admin/tasks';
import { getServerUser } from '@/lib/auth/admin';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import {
  verifyPaypalCapture,
  verifyPaypalOrderBinding,
} from '@/lib/payments/paypalOrderBinding';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';
import { isSameOriginMutation } from '@/lib/security/request';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

function isPaypalOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9-]{5,64}$/i.test(value);
}

export async function POST(req: Request) {
  let orderID: string | null = null;
  let userId: string | null = null;
  let boundProductType: string | null = null;
  let boundRequestId: string | null = null;

  try {
    if (!isSameOriginMutation(req)) {
      return NextResponse.json({ success: false, error: 'Cross-site payment requests are not allowed.' }, { status: 403 });
    }

    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Sign in before completing checkout.' }, { status: 401 });
    }
    userId = user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !isPaypalOrderId(body.orderID)) {
      return NextResponse.json({ success: false, error: 'A valid PayPal order is required.' }, { status: 400 });
    }
    const verifiedOrderId = body.orderID;
    orderID = verifiedOrderId;

    if (body.userId && body.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Payment account does not match the signed-in user.' }, { status: 403 });
    }

    const token = await generatePaypalAccessToken();
    const authorization = { Authorization: `Bearer ${token.access_token}` };
    const orderUrl = getPaypalApiUrl(`/v2/checkout/orders/${encodeURIComponent(verifiedOrderId)}`);
    const { data: paypalOrder } = await axios.get(orderUrl, {
      headers: authorization,
      timeout: 15_000,
    });
    const { binding, product } = verifyPaypalOrderBinding(paypalOrder, user.id);
    boundProductType = product.type;
    boundRequestId = binding.requestId;

    if (body.productType && body.productType !== product.type) {
      return NextResponse.json({ success: false, error: 'Payment product does not match the original PayPal order.' }, { status: 409 });
    }
    if (body.requestId && body.requestId !== binding.requestId) {
      return NextResponse.json({ success: false, error: 'Payment request does not match the original PayPal order.' }, { status: 409 });
    }

    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id,paypal_order_id,paypal_order_product')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();
    if (
      profileError ||
      !profile ||
      profile.paypal_order_id !== orderID ||
      profile.paypal_order_product !== product.type
    ) {
      return NextResponse.json({ success: false, error: 'PayPal order is not bound to this VestBlock account.' }, { status: 409 });
    }

    let fundingRequest: {
      id: string;
      user_id: string;
      user_email: string | null;
      business_name: string | null;
      readiness_score: number | null;
      readiness_tier: string | null;
      paypal_order_id: string | null;
    } | null = null;

    if (product.type === 'funding_strategy_review' && binding.requestId) {
      const { data, error } = await supabase
        .from('funding_strategy_requests')
        .select('id,user_id,user_email,business_name,readiness_score,readiness_tier,paypal_order_id')
        .eq('id', binding.requestId)
        .eq('user_id', user.id)
        .eq('paypal_order_id', orderID)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Funding review payment is not bound to this request.' }, { status: 409 });
      }
      fundingRequest = data;
    }

    const capturePayload = paypalOrder.status === 'COMPLETED'
      ? paypalOrder
      : (
          await axios.post(
            `${orderUrl}/capture`,
            {},
            { headers: authorization, timeout: 20_000 }
          )
        ).data;
    const verifiedCapture = verifyPaypalCapture(capturePayload, product);
    const transactionId = verifiedCapture.transactionId || orderID;
    const amount = verifiedCapture.amount;

    const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
    const userEmail = authUser?.user?.email || fundingRequest?.user_email || null;

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('id,user_id,product_type')
      .eq('paypal_transaction_id', transactionId)
      .maybeSingle();
    if (existingPaymentError) throw new Error('Unable to verify payment idempotency.');
    if (
      existingPayment &&
      (existingPayment.user_id !== user.id || existingPayment.product_type !== product.type)
    ) {
      throw new Error('Existing payment record does not match the verified PayPal binding.');
    }

    let paymentId = existingPayment?.id || null;
    const duplicate = Boolean(paymentId);

    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: Number.parseFloat(amount),
          status: 'completed',
          payment_method: 'paypal',
          paypal_transaction_id: transactionId,
          product_type: product.type,
          metadata_json: {
            orderID,
            requestId: binding.requestId,
            productType: product.type,
            productLabel: product.label,
            currency: 'USD',
            bindingVersion: binding.version,
          },
        })
        .select('id')
        .single();
      if (paymentError || !payment) throw new Error('Payment captured, but the payment record could not be created.');
      paymentId = payment.id;
    }

    if (product.type === 'vestblock_pro') {
      const { error: subscriptionError } = await supabase
        .from('user_profiles')
        .update({ is_subscribed: true, paypal_order_product: product.type })
        .or(`id.eq.${user.id},user_id.eq.${user.id}`);
      if (subscriptionError) throw new Error('Payment captured, but credit tools access could not be granted.');
    }

    if (product.type === 'funding_strategy_review' && binding.requestId) {
      const { data: updatedRequest, error: requestUpdateError } = await supabase
        .from('funding_strategy_requests')
        .update({
          payment_status: 'paid',
          status: 'paid',
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', binding.requestId)
        .eq('user_id', user.id)
        .eq('paypal_order_id', orderID)
        .select('id,user_id,user_email,business_name,readiness_score,readiness_tier')
        .maybeSingle();
      if (requestUpdateError || !updatedRequest) throw new Error('Payment captured, but the funding review request could not be updated.');

      if (!duplicate) {
        await Promise.allSettled([
          createFundingStrategyReviewTask({
            requestId: binding.requestId,
            userId: user.id,
            userEmail: updatedRequest.user_email || userEmail || undefined,
            businessName: updatedRequest.business_name,
            readinessScore: updatedRequest.readiness_score,
            readinessTier: updatedRequest.readiness_tier,
            paid: true,
          }),
          logEvent({
            eventType: 'funding_strategy_paid',
            actorUserId: user.id,
            entityType: 'funding_strategy_request',
            entityId: binding.requestId,
            metadata: { paymentId, transactionId, orderID, amount, productType: product.type },
          }),
        ]);
      }
    }

    if (!duplicate) {
      await runPaymentCompletedAutomation({
          paymentId,
          userId: user.id,
          userEmail: userEmail || undefined,
          amount,
          provider: 'PayPal',
          transactionId,
          source: 'capture-order',
          metadata: { orderID, productType: product.type, requestId: binding.requestId },
        })
        .catch((automationError) => {
          console.error('Payment completed but follow-up automation failed:', automationError);
        });
    }

    void captureServerEvent({
      distinctId: user.id,
      event: analyticsEvents.paymentCaptureCompleted,
      properties: {
        paymentId,
        amount: Number.parseFloat(amount),
        provider: 'PayPal',
        transactionId,
        orderID,
        productType: product.type,
        requestId: binding.requestId,
        duplicate,
      },
    });

    return NextResponse.json({
      success: true,
      duplicate,
      paymentId,
      productType: product.type,
      requestId: binding.requestId,
      status: 'COMPLETED',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PayPal capture error:', error);

    await runPaymentFailedAutomation({
        userId,
        provider: 'PayPal',
        transactionId: orderID,
        source: 'capture-order',
        errorMessage: message,
        metadata: { orderID, productType: boundProductType, requestId: boundRequestId },
      })
      .catch((automationError) => {
        console.error('Payment failure automation also failed:', automationError);
      });

    if (userId) {
      void captureServerEvent({
        distinctId: userId,
        event: analyticsEvents.paymentCaptureFailed,
        properties: {
          provider: 'PayPal',
          orderID,
          productType: boundProductType,
          requestId: boundRequestId,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Payment capture failed.' }, { status: 502 });
  }
}
