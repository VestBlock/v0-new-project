import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkOpenAIStatus } from "@/lib/openai-realtime-service"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = performance.now()

  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      )
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      )
    }

    // Check if user is admin for detailed status
    const isAdmin = user.app_metadata?.role === "admin"

    // Check OpenAI status
    const statusResult = await checkOpenAIStatus()

    // Log the status check
    try {
      await supabase.from("system_logs").insert({
        event: "openai_status_check",
        user_id: user.id,
        details: {
          success: statusResult.success,
          latencyMs: statusResult.latencyMs,
          model: statusResult.model,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (logError) {
      console.error("Error logging status check:", logError)
    }

    // Return status with appropriate level of detail
    if (isAdmin) {
      // Admin gets full details
      return NextResponse.json({
        success: statusResult.success,
        message: statusResult.message,
        latencyMs: statusResult.latencyMs,
        model: statusResult.model,
        error: statusResult.error,
        apiKey: process.env.OPENAI_API_KEY
          ? `${process.env.OPENAI_API_KEY.substring(0, 3)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`
          : null,
        requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: Math.round(performance.now() - startTime),
      })
    } else {
      // Regular users get limited details
      return NextResponse.json({
        success: statusResult.success,
        message: statusResult.success
          ? "OpenAI services are operational"
          : "OpenAI services are currently experiencing issues",
        requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: Math.round(performance.now() - startTime),
      })
    }
  } catch (error) {
    console.error("Error checking OpenAI status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: Math.round(performance.now() - startTime),
      },
      { status: 500 },
    )
  }
}
