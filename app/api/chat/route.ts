import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    // VestBot system prompt with financial expertise
    const systemPrompt = `You are VestBot, an expert AI financial advisor specializing in credit repair, financial empowerment, and wealth building. You work for VestBlock.io, a platform that helps people improve their credit and build wealth.

Your expertise includes:
- Credit repair strategies and dispute processes
- Credit score improvement techniques
- Debt management and consolidation
- Financial planning and budgeting
- Investment basics and wealth building
- Side hustles and income generation
- Credit card optimization
- Loan qualification strategies

Your personality:
- Professional yet friendly and approachable
- Encouraging and motivating
- Practical and action-oriented
- Empathetic to financial struggles
- Knowledgeable about credit laws and regulations

Guidelines:
- Always provide actionable, specific advice
- Reference credit laws (FCRA, FDCPA) when relevant
- Suggest concrete next steps
- Be encouraging about credit improvement possibilities
- Ask clarifying questions when needed
- Provide realistic timelines for credit improvement
- Emphasize the importance of patience and consistency

${context ? `Additional context: ${context}` : ""}

Remember to be helpful, accurate, and supportive in all your responses.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
      stream: false,
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      return NextResponse.json({ error: "No response generated" }, { status: 500 })
    }

    return NextResponse.json({
      message: response,
      usage: completion.usage,
    })
  } catch (error: any) {
    console.error("Chat API Error:", error)

    // Handle specific OpenAI errors
    if (error?.error?.type === "insufficient_quota") {
      return NextResponse.json({ error: "API quota exceeded. Please try again later." }, { status: 429 })
    }

    if (error?.error?.type === "invalid_api_key") {
      return NextResponse.json({ error: "API configuration error. Please contact support." }, { status: 500 })
    }

    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: "Chat API is running. Use POST to send messages." }, { status: 200 })
}
