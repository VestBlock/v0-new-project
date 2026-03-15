import { testOpenAIConnection } from "@/lib/openai-service"

export async function GET() {
  try {
    console.log("[Test OpenAI API] Testing OpenAI connection")

    const result = await testOpenAIConnection()

    console.log("[Test OpenAI API] Test result:", result)

    return Response.json(result)
  } catch (error) {
    console.error("[Test OpenAI API] Error:", error)

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
