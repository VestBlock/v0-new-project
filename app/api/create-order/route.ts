import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { getSupabaseClient } from '@/lib/supabase/client';

export const generatePaypalAccessToken = async () => {
  console.log(
    '🚀 ~ generatePaypalAccessToken ~ keys:',
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );

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

  console.log('🚀 ~ generatePaypalAccessToken ~ response:', response);
  return response.data;
};

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

export async function POST(req: Request, res: NextApiResponse) {
  const { userId } = await req.json();
  // const supabase = getSupabaseClient();
  console.debug('🚀 ~ POST ~ userId:', userId);
  // console.debug('🚀 ~ handler ~ req:', req);
  //   if (req.method !== 'POST') return res.status(405).end();

  const getData = await generatePaypalAccessToken();
  // console.debug('🚀 ~ POST ~ getData:', getData);

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
      return_url: process.env.WEB_HOST_URL,
      cancel_url: process.env.WEB_HOST_URL,
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

  console.debug('🚀 ~ POST ~ response:', response?.data);
  console.debug('🚀 ~ POST ~ response?.data:', response?.data?.id);

  // const ress = await supabase
  //   .from('user_profiles')
  //   .update({ paypal_order_id: response?.data?.id })
  //   .eq('id', userId);
  const { data: updatedData, error } = await supabase
    .from('user_profiles')
    .update({ paypal_order_id: response?.data?.id })
    .eq('id', userId)
    .select();

  console.debug('Supabase linkOrder result:', { updatedData, error });
  // console.debug('🚀 ~ POST ~ res:', ress);

  return NextResponse.json({
    success: true,
    data: response?.data,
    message: 'Order Id Created',
  });

  // return res.status(200).json({ success: true, data: response?.data || {} });
}
