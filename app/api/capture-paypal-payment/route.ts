import { NextResponse } from "next/server"
import { capturePayPalPayment, updateUserToPro } from "@/lib/paypal"
import { supabase } from "@/lib/supabase"
import { createNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    // Get the order ID from the query parameters
    const url = new URL(req.url)
    const orderId = url.searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    // Get the user session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Capture the payment
    const captureData = await capturePayPalPayment(orderId)

    // Update user to Pro
    await updateUserToPro(userId)

    // Create a notification for the user
    await createNotification({
      userId,
      title: "Welcome to VestBlock Pro!",
      message: "Your payment was successful. You now have access to all Pro features.",
      type: "success",
    })

    return NextResponse.json({ success: true, captureData })
  } catch (error) {
    console.error("Error capturing PayPal payment:", error)
    return NextResponse.json({ error: "Failed to capture payment" }, { status: 500 })
  }
}
