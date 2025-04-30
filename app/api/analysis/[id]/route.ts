import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get the analysis from the database
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()

    if (error || !analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    // If the analysis is still processing, return the status
    if (analysis.status === "processing") {
      return NextResponse.json({ status: "processing" })
    }

    // If the analysis failed, return the error
    if (analysis.status === "error") {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
    }

    // Return the analysis result
    return NextResponse.json({
      id: analysis.id,
      ...analysis.result,
    })
  } catch (error) {
    console.error("Get analysis error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
