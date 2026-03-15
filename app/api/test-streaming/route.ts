import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "OpenAI API key is not configured",
      })
    }

    // Test streaming with a simple prompt
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: "Say 'Hello, streaming is working!' in a friendly way.",
          },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({
        success: false,
        error: "Failed to connect to OpenAI",
        details: error,
      })
    }

    // Read and parse the streaming response
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ""

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((line) => line.trim() !== "")

        for (const line of lines) {
          if (line === "data: [DONE]") continue
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              const content = data.choices[0]?.delta?.content || ""
              fullResponse += content
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Streaming test successful",
      response: fullResponse,
    })
  } catch (error: any) {
    console.error("Streaming test error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to test streaming",
      details: error.message,
    })
  }
}
