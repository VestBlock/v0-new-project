import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { openai } from "@ai-sdk/openai"
import { generateTextWithRetry, OpenAIErrorType } from "@/lib/openai-client"
import { createSuccessResponse, createErrorResponse, sanitizeForJson } from "@/lib/json-utils"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Cache for recent chat responses to reduce API calls
const chatResponseCache = new Map<string, { response: string; timestamp: number }>()
const CHAT_CACHE_TTL = 300000 // 5 minutes cache TTL
const MAX_CHAT_CACHE_SIZE = 100 // Maximum number of chat responses to cache

export async function POST(request: NextRequest) {
  const startTime = performance.now()

  try {
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return createErrorResponse("OpenAI API key is not configured. Please add it to your environment variables.", 500)
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return createErrorResponse("Unauthorized", 401)
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401)
    }

    // Check if user is Pro
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro, role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching user profile:", profileError)
      return createErrorResponse("Failed to verify user subscription", 500)
    }

    const isPro = profile?.is_pro || profile?.role === "admin"
    if (!isPro) {
      return createErrorResponse("Pro subscription required", 403)
    }

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return createErrorResponse("Invalid JSON in request body", 400)
    }

    const { analysisId, message } = body

    if (!analysisId || !message) {
      return createErrorResponse("Missing required fields", 400)
    }

    // Verify the analysis belongs to the user
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      return createErrorResponse("Analysis not found", 404)
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
      return createErrorResponse("Failed to save message", 500)
    }

    // Get previous chat messages
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (chatError) {
      console.error("Error fetching chat messages:", chatError)
      return createErrorResponse("Failed to fetch chat history", 500)
    }

    // Prepare the conversation history for OpenAI
    const conversationHistory = chatMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Check cache first
    const cacheKey = `${user.id}:${analysisId}:${message.substring(0, 50)}`
    const cachedResponse = chatResponseCache.get(cacheKey)

    if (cachedResponse && Date.now() - cachedResponse.timestamp < CHAT_CACHE_TTL) {
      console.log(`Using cached chat response for ${cacheKey.substring(0, 30)}...`)

      // Save the cached AI response
      const { error: aiSaveError } = await supabase.from("chat_messages").insert({
        analysis_id: analysisId,
        user_id: user.id,
        role: "assistant",
        content: cachedResponse.response,
      })

      if (aiSaveError) {
        console.error("Error saving cached AI response:", aiSaveError)
        return createErrorResponse("Failed to save AI response", 500)
      }

      // Get updated chat messages
      const { data: updatedMessages, error: updateError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: true })

      if (updateError) {
        console.error("Error fetching updated chat messages:", updateError)
        return createErrorResponse("Failed to fetch updated chat history", 500)
      }

      const endTime = performance.now()

      return createSuccessResponse({
        messages: updatedMessages,
        cached: true,
        processingTime: Math.round(endTime - startTime),
      })
    }

    // Generate the AI response
    try {
      // Get the analysis result - ensure it's a valid object
      const analysisResult = analysis.result || {}

      // Sanitize the analysis result to ensure it can be safely serialized
      const sanitizedResult = sanitizeForJson(analysisResult)

      const systemPrompt = `
You are a helpful credit assistant. You have analyzed the user's credit report and have the following information:

Credit Score: ${sanitizedResult.overview?.score || "Unknown"}
Summary: ${sanitizedResult.overview?.summary || "No summary available"}
Positive Factors: ${JSON.stringify(sanitizedResult.overview?.positiveFactors || [])}
Negative Factors: ${JSON.stringify(sanitizedResult.overview?.negativeFactors || [])}
Disputes: ${JSON.stringify(sanitizedResult.disputes?.items || [])}
Credit Hacks: ${JSON.stringify(sanitizedResult.creditHacks?.recommendations || [])}
Side Hustles: ${JSON.stringify(sanitizedResult.sideHustles?.recommendations || [])}

Use this information to provide helpful, personalized responses to the user's questions about their credit. 
Be concise, friendly, and informative. If you don't know something, admit it rather than making up information.
`

      // Use our enhanced OpenAI client with retry logic
      const { text: aiResponse } = await generateTextWithRetry({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages: conversationHistory,
        temperature: 0.7,
        maxTokens: 1000,
        userId: user.id, // Pass user ID for logging
        retryOptions: {
          attempts: 2, // Fewer retries for chat to keep it responsive
        },
      })

      // Cache the response
      if (chatResponseCache.size >= MAX_CHAT_CACHE_SIZE) {
        // Remove the oldest entry if cache is full
        const oldestKey = [...chatResponseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
        chatResponseCache.delete(oldestKey)
      }

      chatResponseCache.set(cacheKey, {
        response: aiResponse,
        timestamp: Date.now(),
      })

      // Save the AI response
      const { error: aiSaveError } = await supabase.from("chat_messages").insert({
        analysis_id: analysisId,
        user_id: user.id,
        role: "assistant",
        content: aiResponse,
      })

      if (aiSaveError) {
        console.error("Error saving AI response:", aiSaveError)
        return createErrorResponse("Failed to save AI response", 500)
      }

      // Get updated chat messages
      const { data: updatedMessages, error: updateError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: true })

      if (updateError) {
        console.error("Error fetching updated chat messages:", updateError)
        return createErrorResponse("Failed to fetch updated chat history", 500)
      }

      const endTime = performance.now()

      return createSuccessResponse({
        messages: updatedMessages,
        cached: false,
        processingTime: Math.round(endTime - startTime),
      })
    } catch (error) {
      console.error("Error generating AI response:", error)

      // Determine the error type and create appropriate message
      let errorMessage = "Failed to generate AI response. Please try again."

      if ((error as any).type === OpenAIErrorType.AUTHENTICATION) {
        errorMessage = "API authentication error. Please contact support."
      } else if ((error as any).type === OpenAIErrorType.RATE_LIMIT) {
        errorMessage = "Our AI service is experiencing high demand. Please try again in a few minutes."
      } else if ((error as any).type === OpenAIErrorType.QUOTA_EXCEEDED) {
        errorMessage = "AI service quota exceeded. Please contact support."
      } else if ((error as any).type === OpenAIErrorType.TIMEOUT) {
        errorMessage = "Request timed out. Please try a shorter message."
      } else if ((error as any).type === OpenAIErrorType.CONNECTION) {
        errorMessage = "Connection to AI service failed. Please check your internet connection and try again."
      }

      // Save an error message in the chat
      await supabase
        .from("chat_messages")
        .insert({
          analysis_id: analysisId,
          user_id: user.id,
          role: "system",
          content: `Error: ${errorMessage}`,
        })
        .catch((err) => console.error("Failed to save error message:", err))

      return createErrorResponse(errorMessage, 500, {
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Chat API error:", error)
    return createErrorResponse("Internal server error", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

// Clear chat response cache
export function clearChatResponseCache(): void {
  chatResponseCache.clear()
  console.log("Chat response cache cleared")
}

// Get chat response cache stats
export function getChatResponseCacheStats(): { size: number; hitRate: number } {
  return {
    size: chatResponseCache.size,
    hitRate: 0, // This would need to be tracked separately
  }
}
