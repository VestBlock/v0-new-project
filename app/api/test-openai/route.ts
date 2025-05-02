import { testOpenAIConnection } from "@/lib/openai-direct"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const result = await testOpenAIConnection()

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error("Error testing OpenAI connection:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        apiKey: process.env.OPENAI_API_KEY ? "API key is set" : "API key is missing",
      },
      { status: 500 },
    )
  }
}
