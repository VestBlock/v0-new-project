import { type NextRequest, NextResponse } from "next/server"
import { runOpenAIDiagnostics, testChatFunctionality } from "@/lib/openai-diagnostics"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  // Only allow in development or with admin token
  const isAdmin = request.headers.get("x-admin-token") === process.env.ADMIN_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const analysisId = searchParams.get("analysisId")
    const testChat = searchParams.get("testChat") === "true"

    // Run diagnostics
    const diagnosticResults = await runOpenAIDiagnostics()

    // Test chat functionality if requested
    let chatResults = null
    if (testChat) {
      chatResults = await testChatFunctionality(analysisId || undefined)
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      diagnostics: diagnosticResults,
      chat: chatResults,
    })
  } catch (error) {
    console.error("Error in OpenAI diagnostics API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
