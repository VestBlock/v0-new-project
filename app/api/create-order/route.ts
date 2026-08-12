import axios from 'axios';
import { NextResponse } from 'next/server';

import { getServerUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePaypalAccessToken } from '@/lib/paypal/accessToken';
import { getPaypalApiUrl } from '@/lib/paypal/config';
import { buildPaypalCustomId } from '@/lib/payments/paypalOrderBinding';
import {
  getVestBlockProduct,
  isVestBlockProductType,
  safeReturnPath,
} from '@/lib/payments/products';
import { isSameOriginMutation } from '@/lib/security/request';
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginMutation(req)) {
      return NextResponse.json({ success: false, error: 'Cross-site checkout requests are not allowed.' }, { status: 403 });
    }

    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Sign in before starting checkout.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'A valid checkout request is required.' }, { status: 400 });
    }

    const { userId: claimedUserId, productType, requestId, returnPath } = body as {
      userId?: string;
      productType?: string;
      requestId?: string;
      returnPath?: string;
    };

    if (claimedUserId && claimedUserId !== user.id) {
      return NextResponse.json({ success: false, error: 'Checkout account does not match the signed-in user.' }, { status: 403 });
    }
    if (!isVestBlockProductType(productType)) {
      return NextResponse.json({ success: false, error: 'Choose a valid VestBlock product before checkout.' }, { status: 400 });
    }

    const product = getVestBlockProduct(productType);
    const boundRequestId: string | null =
      product.type === 'funding_strategy_review' && isUuid(requestId) ? requestId : null;
    if (product.type === 'funding_strategy_review' && !boundRequestId) {
      return NextResponse.json({ success: false, error: 'A valid funding review request is required.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();
    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Your VestBlock profile is not ready for checkout.' }, { status: 409 });
    }

    if (boundRequestId) {
      const { data: fundingRequest, error: fundingError } = await supabase
        .from('funding_strategy_requests')
        .select('id,user_id,payment_status')
        .eq('id', boundRequestId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fundingError || !fundingRequest) {
        return NextResponse.json({ success: false, error: 'Funding review request was not found for this account.' }, { status: 404 });
      }
      if (fundingRequest.payment_status === 'paid') {
        return NextResponse.json({ success: false, error: 'This funding review request is already paid.' }, { status: 409 });
      }
    }

    const token = await generatePaypalAccessToken();
    const siteOrigin = getSiteOrigin();
    const checkoutReturnPath = safeReturnPath(returnPath) || product.defaultReturnPath;
    const checkoutUrl = `${siteOrigin}${checkoutReturnPath}`;
    const customId = buildPaypalCustomId({
      productType: product.type,
      userId: user.id,
      requestId: boundRequestId,
    });

    const { data: order } = await axios({
      url: getPaypalApiUrl('/v2/checkout/orders'),
      method: 'post',
      data: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: product.description,
            custom_id: customId,
            amount: { currency_code: 'USD', value: product.amount },
          },
        ],
        application_context: {
          user_action: 'PAY_NOW',
          brand_name: 'VestBlock',
          return_url: checkoutUrl,
          cancel_url: checkoutUrl,
        },
      },
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });

    if (!order?.id) throw new Error('PayPal did not return an order identifier.');

    const { error: linkError } = await supabase
      .from('user_profiles')
      .update({ paypal_order_id: order.id, paypal_order_product: product.type })
      .or(`id.eq.${user.id},user_id.eq.${user.id}`);
    if (linkError) throw new Error('Unable to bind the PayPal order to the VestBlock profile.');

    if (boundRequestId) {
      const { error: requestError } = await supabase
        .from('funding_strategy_requests')
        .update({
          paypal_order_id: order.id,
          payment_status: 'pending',
          status: 'awaiting_payment',
          updated_at: new Date().toISOString(),
        })
        .eq('id', boundRequestId)
        .eq('user_id', user.id);
      if (requestError) throw new Error('Unable to bind the PayPal order to the funding review request.');
    }

    await logEvent({
      eventType: 'checkout_started',
      actorUserId: user.id,
      entityType: 'checkout',
      entityId: order.id,
      metadata: {
        provider: 'PayPal',
        amount: product.amount,
        currency: 'USD',
        productType: product.type,
        requestId: boundRequestId,
        status: order.status,
        bindingVersion: 'vb2',
        source: 'create-order',
      },
    });

    return NextResponse.json({ success: true, data: order, message: 'Order created.' });
  } catch (error) {
    console.error('PayPal order creation failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to start PayPal checkout.' }, { status: 502 });
  }
}
