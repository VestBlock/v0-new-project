import axios from 'axios';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const generatePaypalAccessToken = async () => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured.');
  }

  const response = await axios({
    url: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    method: 'post',
    data: 'grant_type=client_credentials',
    auth: {
      username: process.env.PAYPAL_CLIENT_ID as string,
      password: process.env.PAYPAL_CLIENT_SECRET as string,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
};

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
    url: 'https://api-m.sandbox.paypal.com/v2/checkout/orders',
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
      .eq('id', userId);

    if (error) {
      console.warn('Unable to link PayPal order to profile:', error.message);
    }
  }

  return NextResponse.json({
    success: true,
    data: response?.data,
    message: 'Order Id Created',
  });
}
