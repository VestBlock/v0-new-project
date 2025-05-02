import { type NextRequest, NextResponse } from "next/server"
import { chatWithAI } from "@/lib/openai-minimal"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    if (!data.message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 })
    }

    // Get chat history if provided
    const history = data.history || []

    // Call OpenAI for chat
    const response = await chatWithAI(data.message, history)

    return NextResponse.json({
      success: true,
      response,
      history: [...history, { role: "user", content: data.message }, { role: "assistant", content: response }],
    })
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
