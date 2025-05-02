import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function GET() {
  try {
    // Check if the OpenAI API key is set
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: "OpenAI API key is not set in environment variables",
        apiKey: "NOT_SET",
      })
    }

    // Check if the API key is valid by making a simple request
    try {
      console.log("Testing OpenAI API key with a simple request...")

      const { text } = await generateText({
        model: openai("gpt-3.5-turbo"),
        prompt: "Say 'OpenAI API key is working'",
        maxTokens: 10,
      })

      console.log("OpenAI API response:", text)

      return NextResponse.json({
        success: true,
        message: "OpenAI API key is working correctly",
        apiKey: `SET (${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)})`,
        response: text,
      })
    } catch (apiError) {
      console.error("Error testing OpenAI API key:", apiError)

      return NextResponse.json({
        success: false,
        message: "OpenAI API key is set but not working",
        error: apiError instanceof Error ? apiError.message : "Unknown API error",
        apiKey: `SET_BUT_INVALID (${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)})`,
      })
    }
  } catch (error) {
    console.error("Error checking OpenAI API key:", error)

    return NextResponse.json({
      success: false,
      message: "Error checking OpenAI API key",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
