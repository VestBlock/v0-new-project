import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if the user is already Pro
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 })
    }

    if (profile && profile.is_pro) {
      return NextResponse.json({ error: "User is already Pro" }, { status: 400 })
    }

    // In a real implementation, this would create a Stripe checkout session
    // For now, we'll return a placeholder URL
    const checkoutUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe-success?user_id=${user.id}`

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error("Create checkout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
