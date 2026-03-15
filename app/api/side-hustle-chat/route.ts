import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getOpenAIClient, VESTBOT_SYSTEM_PROMPT } from "@/lib/openai-server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Prepare the system message
    const systemPrompt = `${VESTBOT_SYSTEM_PROMPT}

You are a side hustle advisor specializing in helping people find additional income opportunities.
Your goal is to provide personalized advice on side hustles based on the user's interests, skills, and circumstances.

When providing advice:
1. Be specific and actionable
2. Consider the user's time constraints, skills, and resources
3. Provide realistic income expectations
4. Suggest platforms or websites where they can get started
5. Mention any upfront costs or investments needed
6. Discuss potential challenges and how to overcome them

Side hustle categories you can advise on include:
- Freelancing (writing, design, programming, etc.)
- Gig economy (rideshare, food delivery, etc.)
- E-commerce (dropshipping, Amazon FBA, etc.)
- Content creation (blogging, YouTube, podcasting, etc.)
- Online services (virtual assistant, tutoring, consulting, etc.)
- Passive income (investments, rental properties, etc.)

Always be encouraging but realistic about income potential and time investment.`

    // Prepare the messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.filter((msg: any) => msg.role !== "system"),
      { role: "user", content: message },
    ]

    // Call the OpenAI API
    const openai = getOpenAIClient()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    return NextResponse.json({
      response: aiResponse,
      tokens: {
        prompt: completion.usage?.prompt_tokens,
        completion: completion.usage?.completion_tokens,
        total: completion.usage?.total_tokens,
      },
    })
  } catch (error) {
    console.error("Side hustle chat error:", error)
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
