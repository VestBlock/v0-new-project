// Using the new openai-service.ts for direct fetch calls
import { createChatCompletion, type OpenAIChatMessage } from "@/lib/openai-service"
import { VESTBOT_SYSTEM_PROMPT } from "@/lib/openai-server" // Still useful for the base system prompt

export const dynamic = "force-dynamic" // Ensures fresh execution

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[API /chat-direct] FATAL - OPENAI_API_KEY is not set.")
    return new Response(JSON.stringify({ error: "Server Configuration Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let requestBody
  try {
    requestBody = await req.json()
  } catch (parseError) {
    const message = getErrorMessage(parseError)
    console.error("[API /chat-direct] Invalid JSON in request:", message)
    return new Response(JSON.stringify({ error: "Invalid request format." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { messages: clientMessages, reportText, analysisContext, financialGoal } = requestBody

    let systemPrompt = VESTBOT_SYSTEM_PROMPT
    let dynamicContext = "\n\nRelevant user context for this conversation:"
    let contextAdded = false

    if (reportText && typeof reportText === "string" && reportText.trim().length > 0) {
      // Increased context window for more detailed report text
      const summarizedReportText = reportText.length > 8000 ? reportText.substring(0, 7997) + "..." : reportText
      dynamicContext += `\n\n---BEGIN FULL CREDIT REPORT TEXT---\n${summarizedReportText}\n---END FULL CREDIT REPORT TEXT---`
      contextAdded = true
    }

    if (analysisContext && typeof analysisContext === "string" && analysisContext.trim().length > 0) {
      // Increased context window for more detailed analysis context
      const summarizedAnalysisContext =
        analysisContext.length > 8000 ? analysisContext.substring(0, 7997) + "..." : analysisContext
      dynamicContext += `\n\n---BEGIN INITIAL AI ANALYSIS OF THE REPORT---\n${summarizedAnalysisContext}\n---END INITIAL AI ANALYSIS OF THE REPORT---`
      contextAdded = true
    }

    if (financialGoal && typeof financialGoal === "object" && financialGoal.title) {
      dynamicContext += `\n- User's Selected Financial Goal: ${financialGoal.title}`
      if (financialGoal.description) dynamicContext += ` (${financialGoal.description})`
      if (financialGoal.customDetails) dynamicContext += ` Additional Details: ${financialGoal.customDetails}.`
      contextAdded = true
    }

    if (contextAdded) {
      systemPrompt += dynamicContext
    } else {
      systemPrompt +=
        "\n- No specific credit report or financial goal context provided. Engage in general financial conversation."
    }
    systemPrompt +=
      "\n\nIMPORTANT: Base your answers PRIMARILY on the provided credit report text and its initial AI analysis if available. If the user asks a question that cannot be answered from this context, state that clearly. Do not invent information not present in these contexts. Be helpful and empathetic."

    const allMessages: OpenAIChatMessage[] = [{ role: "system", content: systemPrompt }]

    // Filter out any potentially problematic messages from client
    if (Array.isArray(clientMessages)) {
      const validClientMessages = clientMessages.filter(
        (m: any) =>
          m.role && (m.role === "user" || m.role === "assistant") && m.content && typeof m.content === "string",
      )
      allMessages.push(...validClientMessages)
    }

    const streamResponse = await createChatCompletion(allMessages, true, { temperature: 0.5 })
    return streamResponse
  } catch (error) {
    console.error("[API /chat-direct] Request failed:", getErrorMessage(error))
    return new Response(
      JSON.stringify({
        error: "Internal Server Chat Error",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : getErrorMessage(error) || "An unexpected error occurred.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
