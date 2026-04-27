import { NextResponse } from 'next/server';
import axios from 'axios';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPaymentCompletedAutomation } from '@/lib/payments/paymentAutomation';

export async function POST(req: Request) {
  const { orderID, userId } = await req.json();
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
  const status = capture.purchase_units[0].payments.captures[0].status;
  if (status === 'COMPLETED') {
    const supabase = createAdminClient();
    await supabase
      .from('user_profiles')
      .update({ is_subscribed: true })
      .or(`id.eq.${userId},user_id.eq.${userId}`);

    const amount =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '75';
    const transactionId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;
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
  }

  return NextResponse.json({ success: true, capture });
}
