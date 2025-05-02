import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get the analysis ID from the query parameters
    const url = new URL(request.url)
    const analysisId = url.searchParams.get("analysisId")

    if (!analysisId) {
      return NextResponse.json({ success: false, error: "Missing analysisId parameter" }, { status: 400 })
    }

    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    // If analysisId is "latest", get the latest analysis for this user
    if (analysisId === "latest") {
      const { data: latestAnalysis, error: analysisError } = await supabase
        .from("analyses")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (analysisError || !latestAnalysis) {
        return NextResponse.json({ success: false, error: "No analyses found for this user" }, { status: 404 })
      }

      query = query.eq("analysis_id", latestAnalysis.id)
    } else {
      // Verify the analysis belongs to the user
      const { data: analysis, error: analysisError } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single()

      if (analysisError || !analysis) {
        return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 })
      }

      query = query.eq("analysis_id", analysisId)
    }

    // Get the messages
    const { data: messages, error: messagesError } = await query

    if (messagesError) {
      return NextResponse.json({ success: false, error: "Failed to fetch chat messages" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages,
    })
  } catch (error) {
    console.error("Error fetching chat messages:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
