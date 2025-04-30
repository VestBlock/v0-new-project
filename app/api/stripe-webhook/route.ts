import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    // Get the Stripe signature from the request headers
    const signature = request.headers.get("stripe-signature")
    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 })
    }

    // Get the request body
    const body = await request.text()

    // In a real implementation, this would verify the Stripe signature and parse the event
    // For now, we'll simulate a successful payment event
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            user_id: "user_123",
          },
        },
      },
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const userId = event.data.object.metadata.user_id

      // Update the user's profile to Pro
      const { error } = await supabase.from("profiles").update({ is_pro: true }).eq("id", userId)

      if (error) {
        console.error("Update profile error:", error)
        return NextResponse.json({ error: "Failed to update user profile" }, { status: 500 })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
