import { NextResponse } from 'next/server';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { generatePaypalAccessToken } from '../create-order/route';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  console.debug('🚀 ~ POST ~ capture:', capture);
  // 2) Update Supabase immediately
  const status = capture.purchase_units[0].payments.captures[0].status;
  console.debug('🚀 ~ POST ~ status:', status);
  if (status === 'COMPLETED') {
    await supabase
      .from('user_profiles')
      .update({ is_subscribed: true })
      .eq('id', userId);
  }

  return NextResponse.json({ success: true, capture });
}
