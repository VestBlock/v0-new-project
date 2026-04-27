import { NextResponse } from 'next/server';
import axios from 'axios';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from '@/lib/payments/paymentAutomation';

export async function POST(req: Request) {
  let orderID: string | null = null;
  let userId: string | null = null;

  try {
    const body = await req.json();
    orderID = body.orderID;
    userId = body.userId;

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

    if (status !== 'COMPLETED') {
      await runPaymentFailedAutomation({
        userId,
        amount,
        provider: 'PayPal',
        transactionId,
        source: 'capture-order',
        errorMessage: `PayPal capture status was ${status || 'unknown'}.`,
        metadata: { orderID },
      });

      return NextResponse.json(
        { success: false, error: 'Payment was not completed.', capture },
        { status: 402 }
      );
    }

    const supabase = createAdminClient();
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    const { error: subscriptionError } = await supabase
      .from('user_profiles')
      .update({ is_subscribed: true })
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
        metadata: { orderID },
      });

      return NextResponse.json(
        { success: false, error: 'Payment captured, but subscription update failed.' },
        { status: 500 }
      );
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
        metadata: { orderID },
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
          metadata: { orderID },
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
        metadata: { orderID },
      });
    }

    return NextResponse.json({
      success: true,
      duplicate: Boolean(existingPayment?.id),
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
      metadata: { orderID },
    });

    return NextResponse.json(
      { success: false, error: 'Payment capture failed.' },
      { status: 500 }
    );
  }
}
