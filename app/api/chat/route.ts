import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { callOpenAI } from "@/lib/openai-direct"
import { NextResponse } from "next/server"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Cache for recent chat responses to reduce API calls
const chatResponseCache = new Map<string, { response: string; timestamp: number }>()
const CHAT_CACHE_TTL = 300000 // 5 minutes cache TTL
const MAX_CHAT_CACHE_SIZE = 100 // Maximum number of chat responses to cache

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()

    // Validate input
    if (!body.message) {
      return NextResponse.json({ success: false, error: "Missing message" }, { status: 400 })
    }

    // Optional context from credit report
    const context = body.context || ""

    // System prompt with context if available
    const systemPrompt = context
      ? `You are a helpful credit assistant. Use this context about the user's credit report: ${context}`
      : "You are a helpful credit assistant. Answer questions about credit reports and financial matters."

    // Call OpenAI for chat response
    const response = await callOpenAI({
      prompt: body.message,
      systemPrompt,
      model: "gpt-4o",
      temperature: 0.7,
    })

    // Return the response
    return NextResponse.json({ success: true, response })
  } catch (error) {
    console.error("Error in chat:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
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
