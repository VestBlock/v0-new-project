import { NextResponse } from "next/server"
import { testOpenAIConnection } from "@/lib/openai-service"
import { getSafeDiagnosticErrorMessage, requireInternalDiagnosticsAccess } from "@/lib/debug/access"

export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireInternalDiagnosticsAccess()
  if (access.error) {
    return access.error
  }

  try {
    const result = await testOpenAIConnection() // This is the direct fetch-based test

    if (result.success) {
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
          error: getSafeDiagnosticErrorMessage("Failed to connect to OpenAI API via service.") || "Failed to connect to OpenAI API via service.",
          details: process.env.NODE_ENV === "production" ? undefined : result.error,
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
        details: process.env.NODE_ENV === "production" ? undefined : error.message || String(error),
      },
      { status: 500 },
    )
  }
}
