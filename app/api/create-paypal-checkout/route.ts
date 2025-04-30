import { NextResponse } from "next/server"
import { createPayPalOrder } from "@/lib/paypal"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    // Get the user session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Create a PayPal order
    const { id, approvalUrl } = await createPayPalOrder(userId)

    return NextResponse.json({ id, url: approvalUrl })
  } catch (error) {
    console.error("Error creating PayPal checkout:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
