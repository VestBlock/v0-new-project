import { NextResponse } from "next/server"
import { testOpenAIConnection } from "@/lib/openai-service"

export const dynamic = "force-dynamic"

export async function GET() {
  console.log("[API /test-openai-connection] Received request to test OpenAI connection.")

  try {
    const result = await testOpenAIConnection() // This is the direct fetch-based test

    if (result.success) {
      console.log("[API /test-openai-connection] Connection test successful via service:", result)
      return NextResponse.json({
        success: true,
        message: "Successfully connected to OpenAI API and listed models.",
        data: result.data, // Contains modelCount etc.
        status: result.status,
      })
    } else {
      console.error(
        "[API /test-openai-connection] Connection test failed via service. Status:",
        result.status,
        "Error:",
        result.error,
      )
      return NextResponse.json(
        {
          success: false,
          error: "Failed to connect to OpenAI API via service.",
          details: result.error, // This will contain the actual error message from OpenAI or the service
          status: result.status || 500, // Ensure status is passed
        },
        { status: result.status || 500 },
      )
    }
  } catch (error: any) {
    console.error("[API /test-openai-connection] General Error in test route:", error)
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred on the server during the test.",
        details: error.message || String(error),
      },
      { status: 500 },
    )
  }
}
