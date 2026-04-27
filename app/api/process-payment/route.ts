import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runPaymentCompletedAutomation } from "@/lib/payments/paymentAutomation"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { amount, userId, reportId } = await req.json()

    if (!amount || !userId) {
      return NextResponse.json({ error: "Amount and userId are required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Record the payment in the database
    const { data, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        amount: amount,
        status: "completed",
        payment_method: "paypal",
        report_id: reportId || null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error recording payment:", error)
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
    }

    await supabase
      .from("user_profiles")
      .update({ is_subscribed: true })
      .or(`id.eq.${userId},user_id.eq.${userId}`)

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)

    await runPaymentCompletedAutomation({
      paymentId: data.id,
      userId,
      userEmail: authUser?.user?.email,
      amount,
      provider: "PayPal",
      transactionId: data.id,
      source: "process-payment",
      metadata: { reportId: reportId || null },
    })

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      paymentId: data.id,
    })
  } catch (error) {
    console.error("Payment processing error:", error)
    return NextResponse.json(
      {
        error: "Failed to process payment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
