import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

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

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })

    // Get pro users count
    const { count: proUsers, error: proUsersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_pro", true)

    // Get total analyses count
    const { count: totalAnalyses, error: analysesError } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })

    // Get recent analyses (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: recentAnalyses, error: recentAnalysesError } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString())

    // Get pending analyses
    const { count: pendingAnalyses, error: pendingAnalysesError } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing")

    if (usersError || proUsersError || analysesError || recentAnalysesError || pendingAnalysesError) {
      console.error("Error fetching stats:", {
        usersError,
        proUsersError,
        analysesError,
        recentAnalysesError,
        pendingAnalysesError,
      })
      return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      proUsers: proUsers || 0,
      totalAnalyses: totalAnalyses || 0,
      recentAnalyses: recentAnalyses || 0,
      pendingAnalyses: pendingAnalyses || 0,
    })
  } catch (error) {
    console.error("Error in admin stats API:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
