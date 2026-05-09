import axios from 'axios';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import {
  getVestBlockProduct,
  isVestBlockProductType,
  safeReturnPath,
} from '@/lib/payments/products';
import { logEvent } from '@/lib/system/logEvent';

function getSiteOrigin() {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');

  try {
    return new URL(configured).origin;
  } catch {
    return 'https://www.vestblock.io';
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { success: false, error: 'A valid checkout request is required.' },
      { status: 400 }
    );
  }

  const { userId, productType, requestId, returnPath } = body as {
    userId?: string;
    productType?: string;
    requestId?: string;
    returnPath?: string;
  };

  if (!isVestBlockProductType(productType)) {
    return NextResponse.json(
      { success: false, error: 'Choose a valid VestBlock product before checkout.' },
      { status: 400 }
    );
  }

  const product = getVestBlockProduct(productType);

  const getData = await generatePaypalAccessToken();
  const siteOrigin = getSiteOrigin();
  const checkoutReturnPath = safeReturnPath(returnPath) || product.defaultReturnPath;
  const checkoutUrl = `${siteOrigin}${checkoutReturnPath}`;

  const orderData = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description: product.description,
        custom_id: [product.type, userId || 'guest', requestId || 'none'].join(':'),
        amount: {
          currency_code: 'USD',
          value: product.amount,
        },
      },
    ],
    application_context: {
      user_action: 'PAY_NOW',
      brand_name: 'VestBlock',
      return_url: checkoutUrl,
      cancel_url: checkoutUrl,
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
      .update({
        paypal_order_id: response?.data?.id,
        paypal_order_product: product.type,
      })
      .or(`id.eq.${userId},user_id.eq.${userId}`);

    if (error) {
      console.warn('Unable to link PayPal order to profile:', error.message);
    }

    if (requestId && product.type === 'funding_strategy_review') {
      const { error: requestError } = await supabase
        .from('funding_strategy_requests')
        .update({
          paypal_order_id: response?.data?.id,
          payment_status: 'pending',
          status: 'awaiting_payment',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('user_id', userId);

      if (requestError) {
        console.warn(
          'Unable to link PayPal order to funding strategy request:',
          requestError.message
        );
      }
    }

    await logEvent({
      eventType: 'checkout_started',
      actorUserId: userId,
      entityType: 'checkout',
      entityId: response?.data?.id,
      metadata: {
        provider: 'PayPal',
        amount: product.amount,
        productType: product.type,
        requestId,
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
