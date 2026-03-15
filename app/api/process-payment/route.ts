import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { amount, userId, reportId } = await req.json()

    if (!amount || !userId) {
      return NextResponse.json({ error: "Amount and userId are required" }, { status: 400 })
    }

    // In a real implementation, you would integrate with PayPal SDK here
    // For now, we'll simulate a successful payment

    const supabase = getSupabaseServer()

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
