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

    // Get all analyses
    const { data: analyses, error: analysesError } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })

    if (analysesError) {
      console.error("Error fetching analyses:", analysesError)
      return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 })
    }

    return NextResponse.json(analyses)
  } catch (error) {
    console.error("Error in admin analyses API:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
