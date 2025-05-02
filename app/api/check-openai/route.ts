import { NextResponse } from "next/server"
import { verifyOpenAIKey } from "@/lib/openai-check"

export async function GET() {
  try {
    // Check if the OpenAI API key is valid
    const { valid, error } = await verifyOpenAIKey()

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          message: "OpenAI API key is not working",
          error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "OpenAI API key is working correctly",
    })
  } catch (error) {
    console.error("Error checking OpenAI API key:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error checking OpenAI API key",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
