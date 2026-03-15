import { type NextRequest, NextResponse } from "next/server"
import { createChatCompletion } from "@/lib/openai-service"

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 })
    }

    // Simple test prompt
    const response = await createChatCompletion(
      [
        {
          role: "system",
          content: "Extract any credit score mentioned in the text. Reply with just the number or 'none' if not found.",
        },
        { role: "user", content: text },
      ],
      false,
    )

    const content = (response as any).choices[0].message.content

    return NextResponse.json({
      success: true,
      response: content,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Test analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Analysis failed",
      },
      { status: 500 },
    )
  }
}
