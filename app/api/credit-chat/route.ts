import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateChatResponse } from "@/lib/openai-realtime-service"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = performance.now()

  try {
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI API key is not configured",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

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

    // Get request body
    const body = await request.json()

    // Validate input
    if (!body.message || !body.analysisId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: message and analysisId",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Get the analysis data
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("result")
      .eq("id", body.analysisId)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      console.error("Error fetching analysis:", analysisError)
      return NextResponse.json(
        {
          success: false,
          error: "Analysis not found or access denied",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    // Get conversation history
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("analysis_id", body.analysisId)
      .order("created_at", { ascending: true })
      .limit(20)

    if (chatError) {
      console.error("Error fetching chat messages:", chatError)
      // Continue anyway, we can still generate a response without history
    }

    // Format conversation history
    const conversationHistory = (chatMessages || []).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Generate response using our real-time OpenAI integration - NO FALLBACKS TO MOCK DATA
    const chatResult = await generateChatResponse(
      user.id,
      body.analysisId,
      body.message,
      conversationHistory,
      analysis.result,
    )

    if (!chatResult.success) {
      console.error("Chat generation failed:", chatResult.error)
      return NextResponse.json(
        {
          success: false,
          error: chatResult.error.message || "Failed to generate chat response",
          errorType: chatResult.error.type,
          requestId,
          timestamp: new Date().toISOString(),
          processingTimeMs: Math.round(performance.now() - startTime),
        },
        { status: 500 },
      )
    }

    // Get updated messages
    const { data: updatedMessages, error: updatedError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("analysis_id", body.analysisId)
      .order("created_at", { ascending: true })

    if (updatedError) {
      console.error("Error fetching updated messages:", updatedError)
      // Return just the response if we can't get updated messages
      return NextResponse.json({
        success: true,
        response: chatResult.response,
        requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: Math.round(performance.now() - startTime),
      })
    }

    return NextResponse.json({
      success: true,
      response: chatResult.response,
      messages: updatedMessages,
      metrics: chatResult.metrics,
      requestId,
      timestamp: new Date().toISOString(),
      processingTimeMs: Math.round(performance.now() - startTime),
    })
  } catch (error) {
    console.error("Error in credit chat API:", error)
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
