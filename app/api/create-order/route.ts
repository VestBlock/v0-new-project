import axios from 'axios';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import { logEvent } from '@/lib/system/logEvent';

export async function POST(req: Request) {
  const { userId } = await req.json();

  const getData = await generatePaypalAccessToken();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io/credit-upload';

  const orderData = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: '75',
        },
      },
    ],
    application_context: {
      user_action: 'PAY_NOW',
      brand_name: 'VestBlock',
      return_url: siteUrl,
      cancel_url: siteUrl,
    },
  };

  const response = await axios({
    url: getPaypalApiUrl('/v2/checkout/orders'),
    method: 'post',
    data: JSON.stringify(orderData),
    headers: {
      Authorization: `Bearer ${getData.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (userId) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({ paypal_order_id: response?.data?.id })
      .or(`id.eq.${userId},user_id.eq.${userId}`);

    if (error) {
      console.warn('Unable to link PayPal order to profile:', error.message);
    }

    await logEvent({
      eventType: 'checkout_started',
      actorUserId: userId,
      entityType: 'checkout',
      entityId: response?.data?.id,
      metadata: {
        provider: 'PayPal',
        amount: '75',
        status: response?.data?.status,
        source: 'create-order',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: response?.data,
    message: 'Order Id Created',
  });
}
