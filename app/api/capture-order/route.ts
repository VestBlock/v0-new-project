import { NextResponse } from 'next/server';
import axios from 'axios';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createFundingStrategyReviewTask } from '@/lib/admin/tasks';
import { getVestBlockProduct } from '@/lib/payments/products';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';
import { logEvent } from '@/lib/system/logEvent';

export async function POST(req: Request) {
  let orderID: string | null = null;
  let userId: string | null = null;
  let requestId: string | null = null;
  let requestedProductType: string | null = null;

  try {
    const body = await req.json();
    orderID = body.orderID;
    userId = body.userId;
    requestId = body.requestId || null;
    requestedProductType = body.productType || null;

    if (!orderID || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing orderID or userId' },
        { status: 400 }
      );
    }

    // 1) Capture payment
    const token = await generatePaypalAccessToken();
    const { data: capture } = await axios.post(
      getPaypalApiUrl(`/v2/checkout/orders/${orderID}/capture`),
      {},
      { headers: { Authorization: `Bearer ${token?.access_token}` } }
    );

    // 2) Update Supabase immediately
    const status = capture.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    const amount =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '75';
    const transactionId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;
    const supabase = createAdminClient();

    const { data: fundingRequest } = await supabase
      .from('funding_strategy_requests')
      .select(
        'id,user_id,user_email,business_name,readiness_score,readiness_tier,paypal_order_id'
      )
      .or(
        requestId
          ? `id.eq.${requestId},paypal_order_id.eq.${orderID}`
          : `paypal_order_id.eq.${orderID}`
      )
      .maybeSingle();
    const product =
      fundingRequest?.id || requestedProductType === 'funding_strategy_review'
        ? getVestBlockProduct('funding_strategy_review')
        : getVestBlockProduct(requestedProductType);
    requestId = requestId || fundingRequest?.id || null;

    if (status !== 'COMPLETED') {
      await runPaymentFailedAutomation({
        userId,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'capture-order',
        errorMessage: `PayPal capture status was ${status || 'unknown'}.`,
        metadata: { orderID, productType: product.type, requestId },
      });

      return NextResponse.json(
        { success: false, error: 'Payment was not completed.', capture },
        { status: 402 }
      );
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    if (product.type === 'vestblock_pro') {
      const { error: subscriptionError } = await supabase
        .from('user_profiles')
        .update({ is_subscribed: true, paypal_order_product: product.type })
        .or(`id.eq.${userId},user_id.eq.${userId}`);

      if (subscriptionError) {
        await runPaymentFailedAutomation({
          userId,
          userEmail,
          amount,
          provider: 'PayPal',
          transactionId,
          source: 'capture-order',
          errorMessage:
            subscriptionError.message ||
            'Unable to update VestBlock subscription status.',
          metadata: { orderID, productType: product.type, requestId },
        });

        return NextResponse.json(
          { success: false, error: 'Payment captured, but subscription update failed.' },
          { status: 500 }
        );
      }
    }

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('id')
      .eq('paypal_transaction_id', transactionId)
      .maybeSingle();

    if (existingPaymentError) {
      await runPaymentFailedAutomation({
        userId,
        userEmail,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'capture-order',
        errorMessage:
          existingPaymentError.message || 'Unable to check existing PayPal payment.',
        metadata: { orderID, productType: product.type, requestId },
      });

      return NextResponse.json(
        { success: false, error: 'Payment captured, but payment lookup failed.' },
        { status: 500 }
      );
    }

    let paymentId = existingPayment?.id || null;

    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount: Number.parseFloat(amount),
          status: 'completed',
          payment_method: 'paypal',
          paypal_transaction_id: transactionId,
          product_type: product.type,
          metadata_json: {
            orderID,
            requestId,
            productType: product.type,
            productLabel: product.label,
          },
        })
        .select('id')
        .single();

      if (paymentError) {
        await runPaymentFailedAutomation({
          userId,
          userEmail,
          amount,
          provider: 'PayPal',
          transactionId,
          source: 'capture-order',
          errorMessage: paymentError.message || 'Unable to record PayPal payment.',
          metadata: { orderID, productType: product.type, requestId },
        });

        return NextResponse.json(
          { success: false, error: 'Payment captured, but payment record failed.' },
          { status: 500 }
        );
      }

      paymentId = payment?.id || transactionId;

      await runPaymentCompletedAutomation({
        paymentId,
        userId,
        userEmail,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'capture-order',
        metadata: { orderID, productType: product.type, requestId },
      });
    }

    if (product.type === 'funding_strategy_review' && requestId) {
      const { data: updatedRequest, error: requestUpdateError } = await supabase
        .from('funding_strategy_requests')
        .update({
          payment_status: 'paid',
          status: 'paid',
          payment_id: paymentId,
          paypal_order_id: orderID,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('user_id', userId)
        .select(
          'id,user_id,user_email,business_name,readiness_score,readiness_tier'
        )
        .maybeSingle();

      if (requestUpdateError) {
        await runPaymentFailedAutomation({
          userId,
          userEmail,
          amount,
          provider: 'PayPal',
          transactionId,
          source: 'capture-order',
          errorMessage:
            requestUpdateError.message ||
            'Unable to update funding strategy payment status.',
          metadata: { orderID, productType: product.type, requestId, paymentId },
        });

        return NextResponse.json(
          { success: false, error: 'Payment captured, but strategy request update failed.' },
          { status: 500 }
        );
      }

      await Promise.allSettled([
        createFundingStrategyReviewTask({
          requestId,
          userId,
          userEmail: updatedRequest?.user_email || userEmail,
          businessName: updatedRequest?.business_name,
          readinessScore: updatedRequest?.readiness_score,
          readinessTier: updatedRequest?.readiness_tier,
          paid: true,
        }),
        logEvent({
          eventType: 'funding_strategy_paid',
          actorUserId: userId,
          entityType: 'funding_strategy_request',
          entityId: requestId,
          metadata: {
            paymentId,
            transactionId,
            orderID,
            amount,
            productType: product.type,
          },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      duplicate: Boolean(existingPayment?.id),
      productType: product.type,
      requestId,
      capture,
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
      metadata: { orderID, productType: requestedProductType, requestId },
    });

    return NextResponse.json(
      { success: false, error: 'Payment capture failed.' },
      { status: 500 }
    );
  }
}
