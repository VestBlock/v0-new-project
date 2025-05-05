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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error in admin users API:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
