import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-client"

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    // Get the current user session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ isAdmin: false, error: "Not authenticated" }, { status: 401 })
    }

    // Get the user profile
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()

    if (error || !profile) {
      return NextResponse.json({ isAdmin: false, error: "Profile not found" }, { status: 404 })
    }

    // Check if the user is an admin
    const isAdmin = profile.role === "admin"

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error("Error checking admin status:", error)
    return NextResponse.json({ isAdmin: false, error: "Server error" }, { status: 500 })
  }
}
