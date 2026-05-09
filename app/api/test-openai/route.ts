import { testOpenAIConnection } from "@/lib/openai-service"
import { getSafeDiagnosticErrorMessage, requireInternalDiagnosticsAccess } from "@/lib/debug/access"

export const dynamic = "force-dynamic"

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function GET() {
  const access = await requireInternalDiagnosticsAccess()
  if (access.error) {
    return access.error
  }

  try {
    const result = await testOpenAIConnection()

    return Response.json(result)
  } catch (error) {
    console.error("[Test OpenAI API] Error:", getErrorMessage(error))

    return Response.json(
      {
        success: false,
        error: getSafeDiagnosticErrorMessage("OpenAI diagnostic request failed.") || getErrorMessage(error),
      },
      { status: 500 },
    )
  }
}
