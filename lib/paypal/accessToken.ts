import axios from 'axios';
import { getPaypalApiUrl } from '@/lib/paypal/config';

export async function generatePaypalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured.');
  }

  const response = await axios({
    url: getPaypalApiUrl('/v1/oauth2/token'),
    method: 'post',
    data: 'grant_type=client_credentials',
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}
