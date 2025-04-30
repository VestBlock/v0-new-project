import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const analysisId = params.id
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

    // Delete analysis data in this order to maintain referential integrity
    // 1. Delete chat messages
    await supabase.from("chat_messages").delete().eq("analysis_id", analysisId)

    // 2. Delete dispute letters
    await supabase.from("dispute_letters").delete().eq("analysis_id", analysisId)

    // 3. Delete user notes
    await supabase.from("user_notes").delete().eq("analysis_id", analysisId)

    // 4. Delete the analysis
    const { error: deleteError } = await supabase.from("analyses").delete().eq("id", analysisId)

    if (deleteError) {
      console.error("Error deleting analysis:", deleteError)
      return NextResponse.json({ error: "Failed to delete analysis" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in delete analysis API:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
