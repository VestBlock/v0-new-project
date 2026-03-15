import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const event = JSON.parse(body)

    console.log("PayPal webhook received:", event.event_type)

    // Handle successful payment completion
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const payment = event.resource
      const payerEmail = payment.payer?.email_address
      const amount = payment.amount?.value

      if (payerEmail && amount === "75.00") {
        const supabase = getSupabaseServer()

        // Find user by email and update their payment status
        const { data: userProfile, error: userError } = await supabase
          .from("user_profiles")
          .select("user_id")
          .eq("email", payerEmail)
          .single()

        if (userProfile && !userError) {
          // Record the payment
          const { error: paymentError } = await supabase.from("payments").insert({
            user_id: userProfile.user_id,
            amount: Number.parseFloat(amount),
            status: "completed",
            payment_method: "paypal",
            paypal_transaction_id: payment.id,
          })

          if (!paymentError) {
            console.log(`Payment recorded for user: ${payerEmail}`)
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
