import { supabase } from "./supabase-client"

// PayPal API base URLs
const PAYPAL_API_BASE =
  process.env.NODE_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"

// Get PayPal access token
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured")
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Failed to get PayPal access token: ${errorData.error_description}`)
  }

  const data = await response.json()
  return data.access_token
}

// Create a PayPal order
export async function createPayPalOrder(userId: string): Promise<{ id: string; approvalUrl: string }> {
  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: userId,
          description: "VestBlock Pro Plan",
          custom_id: userId,
          amount: {
            currency_code: "USD",
            value: "75.00",
          },
        },
      ],
      application_context: {
        brand_name: "VestBlock",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-cancel`,
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Failed to create PayPal order: ${errorData.message}`)
  }

  const data = await response.json()

  // Find the approval URL
  const approvalUrl = data.links.find((link: any) => link.rel === "approve").href

  return {
    id: data.id,
    approvalUrl,
  }
}

// Capture a PayPal payment
export async function capturePayPalPayment(orderId: string): Promise<any> {
  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Failed to capture PayPal payment: ${errorData.message}`)
  }

  return response.json()
}

// Verify a PayPal webhook signature
export async function verifyPayPalWebhook(body: string, headers: { [key: string]: string }): Promise<boolean> {
  const accessToken = await getPayPalAccessToken()

  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    throw new Error("PayPal webhook ID is not configured")
  }

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
      transmission_id: headers["paypal-transmission-id"],
      transmission_time: headers["paypal-transmission-time"],
      cert_url: headers["paypal-cert-url"],
      auth_algo: headers["paypal-auth-algo"],
      transmission_sig: headers["paypal-transmission-sig"],
    }),
  })

  if (!response.ok) {
    return false
  }

  const data = await response.json()
  return data.verification_status === "SUCCESS"
}

// Update user to Pro after successful payment
export async function updateUserToPro(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_pro: true }).eq("id", userId)

  if (error) {
    throw new Error(`Failed to update user to Pro: ${error.message}`)
  }
}
