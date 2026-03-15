import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Verify API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("[Test] OpenAI API key is missing")
      return NextResponse.json({ success: false, error: "OpenAI API key is not configured" }, { status: 500 })
    }

    const apiKey = process.env.OPENAI_API_KEY

    // Make a simple request with minimal content
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Test] OpenAI API error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error: errorText,
        },
        { status: 500 },
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: data.choices[0].message.content,
      model: data.model,
    })
  } catch (error) {
    console.error("[Test] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
