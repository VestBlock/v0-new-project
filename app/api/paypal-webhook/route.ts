import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  runPaymentCompletedAutomation,
  runPaymentFailedAutomation,
} from "@/lib/payments/paymentAutomation"

const failedPaypalEvents = new Set([
  "PAYMENT.CAPTURE.DENIED",
  "CHECKOUT.ORDER.VOIDED",
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const event = JSON.parse(body)

    console.info("[paypal-webhook] Event received:", {
      eventType: event.event_type,
      eventId: event.id,
    })

    // Handle successful payment completion
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const payment = event.resource
      const payerEmail = payment.payer?.email_address
      const amount = payment.amount?.value
      const transactionId = payment.id

      if (payerEmail && amount === "75.00") {
        const supabase = createAdminClient()

        // Find user by email and update their payment status
        const { data: userProfile, error: userError } = await supabase
          .from("user_profiles")
          .select("id,user_id,email")
          .eq("email", payerEmail)
          .single()

        if (userProfile && !userError) {
          const userId = userProfile.user_id || userProfile.id

          // Record the payment
          const { data: paymentRecord, error: paymentError } = await supabase
            .from("payments")
            .insert({
              user_id: userId,
              amount: Number.parseFloat(amount),
              status: "completed",
              payment_method: "paypal",
              paypal_transaction_id: payment.id,
            })
            .select("id")
            .single()

          if (!paymentError) {
            console.info("[paypal-webhook] Payment recorded.", {
              paymentId: payment.id,
            })

            await supabase
              .from("user_profiles")
              .update({ is_subscribed: true })
              .or(`id.eq.${userId},user_id.eq.${userId}`)

            await runPaymentCompletedAutomation({
              paymentId: paymentRecord?.id || payment.id,
              userId,
              userEmail: userProfile.email || payerEmail,
              amount,
              provider: "PayPal",
              transactionId,
              source: "paypal-webhook",
              metadata: { eventId: event.id },
            })
          } else {
            await runPaymentFailedAutomation({
              userId,
              userEmail: userProfile.email || payerEmail,
              amount,
              provider: "PayPal",
              transactionId,
              source: "paypal-webhook",
              errorMessage: paymentError?.message || "Unable to record PayPal payment.",
              metadata: { eventId: event.id },
            })
          }
        } else {
          await runPaymentFailedAutomation({
            userEmail: payerEmail,
            amount,
            provider: "PayPal",
            transactionId,
            source: "paypal-webhook",
            errorMessage: userError?.message || "No VestBlock user profile found for payer email.",
            metadata: { eventId: event.id },
          })
        }
      }
    }

    if (failedPaypalEvents.has(event.event_type)) {
      const payment = event.resource
      await runPaymentFailedAutomation({
        userEmail: payment?.payer?.email_address,
        amount: payment?.amount?.value,
        provider: "PayPal",
        transactionId: payment?.id || event.id,
        source: "paypal-webhook",
        errorMessage: `PayPal webhook event ${event.event_type}.`,
        metadata: { eventId: event.id },
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
