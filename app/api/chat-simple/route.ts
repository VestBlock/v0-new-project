import { VESTBOT_SYSTEM_PROMPT } from "@/lib/openai-server"
import { NextResponse } from "next/server"
import { createChatCompletion } from "@/lib/openai-service"

export async function POST(req: Request) {
  try {
    const { messages, userData } = await req.json()

    // Prepare user context from userData
    let userContext = ""
    if (userData) {
      userContext = `
🧠 User Context:
• creditScore: ${userData.creditScore || "Unknown"}
• negativeItems: ${userData.negativeItems?.join(", ") || "None provided"}
• goals: ${userData.goals || "Not specified"}
• income: ${userData.income || "Unknown"}
• businessEIN: ${userData.businessEIN || "None"}
• country: ${userData.country || "United States"}
      `
    }

    // Combine system prompt with user context
    const systemPrompt = `${VESTBOT_SYSTEM_PROMPT}\n\n${userContext}`

    // Format messages for OpenAI
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    // Use our direct fetch service instead of the OpenAI SDK
    const response = await createChatCompletion(formattedMessages, false)

    // Extract the content from the response
    const content = (response as any).choices[0].message.content

    return NextResponse.json({
      success: true,
      content,
    })
  } catch (error: any) {
    console.error("Chat simple API error:", error)
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
