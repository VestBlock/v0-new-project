import { NextResponse } from 'next/server';
import axios from 'axios';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
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
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`,
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
    await supabase
      .from('user_profiles')
      .update({ is_subscribed: true })
      .or(`id.eq.${userId},user_id.eq.${userId}`);

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    const { data: payment } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        status: 'completed',
        payment_method: 'paypal',
        paypal_transaction_id: transactionId,
      })
      .select('id')
      .single();

    await runPaymentCompletedAutomation({
      paymentId: payment?.id || transactionId,
      userId,
      userEmail: authUser?.user?.email,
      amount,
      provider: 'PayPal',
      transactionId,
      source: 'capture-order',
    });

    return NextResponse.json({ success: true, capture });
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
