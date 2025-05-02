import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateCreditChatResponse } from "@/lib/openai-credit-service"

// Configure for quick response time
export const config = {
  runtime: "nodejs",
  maxDuration: 30, // 30 seconds for chat responses
}

// Create Supabase client with safety checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
let supabase: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error)
  }
}

export async function POST(request: NextRequest) {
  console.log("[CREDIT-CHAT] API route called")
  const startTime = performance.now()

  try {
    // Verify Supabase client is available
    if (!supabase) {
      return Response.json({ success: false, error: "Database connection unavailable" }, { status: 500 })
    }

    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return Response.json({ success: false, error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is Pro
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro, role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching user profile:", profileError)
      return Response.json({ success: false, error: "Failed to verify user subscription" }, { status: 500 })
    }

    const isPro = profile?.is_pro || profile?.role === "admin"
    if (!isPro) {
      return Response.json({ success: false, error: "Pro subscription required" }, { status: 403 })
    }

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return Response.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { analysisId, message } = body

    if (!analysisId || !message) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Verify the analysis belongs to the user
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      return Response.json({ success: false, error: "Analysis not found" }, { status: 404 })
    }

    // Save the user message
    const { data: savedMessage, error: saveError } = await supabase
      .from("chat_messages")
      .insert({
        analysis_id: analysisId,
        user_id: user.id,
        role: "user",
        content: message,
      })
      .select()
      .single()

    if (saveError) {
      console.error("Error saving user message:", saveError)
      return Response.json({ success: false, error: "Failed to save message" }, { status: 500 })
    }

    // Get previous chat messages
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (chatError) {
      console.error("Error fetching chat messages:", chatError)
      return Response.json({ success: false, error: "Failed to fetch chat history" }, { status: 500 })
    }

    // Prepare the conversation history for OpenAI
    const conversationHistory = chatMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Generate the AI response using our optimized service
    const result = await generateCreditChatResponse(user.id, analysisId, message, conversationHistory, analysis.result)

    if (!result.success) {
      console.error("Error generating AI response:", result.error)

      // Save an error message in the chat
      await supabase
        .from("chat_messages")
        .insert({
          analysis_id: analysisId,
          user_id: user.id,
          role: "system",
          content: `Error: ${result.error}`,
        })
        .catch((err) => console.error("Failed to save error message:", err))

      return Response.json(
        {
          success: false,
          error: result.error,
          metrics: result.metrics,
        },
        { status: 500 },
      )
    }

    // Save the AI response
    const { error: aiSaveError } = await supabase.from("chat_messages").insert({
      analysis_id: analysisId,
      user_id: user.id,
      role: "assistant",
      content: result.response,
    })

    if (aiSaveError) {
      console.error("Error saving AI response:", aiSaveError)
      return Response.json({ success: false, error: "Failed to save AI response" }, { status: 500 })
    }

    // Get updated chat messages
    const { data: updatedMessages, error: updateError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (updateError) {
      console.error("Error fetching updated chat messages:", updateError)
      return Response.json({ success: false, error: "Failed to fetch updated chat history" }, { status: 500 })
    }

    const endTime = performance.now()

    return Response.json({
      success: true,
      messages: updatedMessages,
      metrics: {
        ...result.metrics,
        totalProcessingTimeMs: Math.round(endTime - startTime),
      },
    })
  } catch (error) {
    console.error("[CREDIT-CHAT] API error:", error)
    return Response.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
