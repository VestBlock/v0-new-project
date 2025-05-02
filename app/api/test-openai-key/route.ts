import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "OpenAI API key is not set in environment variables",
      })
    }

    // Test the API key with a simple request
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say test successful" }],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json({
        success: false,
        error: `OpenAI API error: ${response.status} ${response.statusText}`,
        details: error,
      })
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: "OpenAI API key is valid",
      response: data.choices[0].message.content,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
