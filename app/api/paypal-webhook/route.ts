import { NextResponse } from "next/server"
import { verifyPayPalWebhook, updateUserToPro } from "@/lib/paypal"
import { createNotification } from "@/lib/notifications"

// Disable body parsing, we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: Request) {
  try {
    // Get the raw body as text
    const rawBody = await req.text()

    // Get headers for verification
    const headers: { [key: string]: string } = {}
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    // Verify the webhook signature
    const isValid = await verifyPayPalWebhook(rawBody, headers)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
    }

    // Parse the webhook payload
    const event = JSON.parse(rawBody)

    // Handle different event types
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const userId = event.resource.custom_id

      // Update user to Pro
      await updateUserToPro(userId)

      // Create a notification for the user
      await createNotification({
        userId,
        title: "Welcome to VestBlock Pro!",
        message: "Your payment was successful. You now have access to all Pro features.",
        type: "success",
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing PayPal webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
