import type { NextRequest } from "next/server"
import { generateTextWithRetry } from "@/lib/openai-client"

export async function GET(request: NextRequest) {
  try {
    // Simple test to verify OpenAI integration
    const result = await generateTextWithRetry({
      model: "gpt-3.5-turbo",
      prompt: "Return only the text 'OpenAI integration is working correctly' without any additional text.",
      maxTokens: 15,
      temperature: 0.1,
      retryOptions: {
        attempts: 2,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: "OpenAI test completed successfully",
        result: result.text,
        working: result.text.includes("working"),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("OpenAI test error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
