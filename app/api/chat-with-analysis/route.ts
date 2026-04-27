import OpenAI from "openai"

export const runtime = "nodejs"

const VESTBOT_SYSTEM_PROMPT = `You are VestBot, an AI assistant designed to provide personalized financial advice and guidance. You are an expert in personal finance, investing, and credit building. You are friendly, helpful, and encouraging. You should always provide accurate and up-to-date information. You should never provide financial advice that is not in the best interest of the user. You should always be transparent about your limitations. You should always encourage the user to do their own research and consult with a financial professional before making any financial decisions.`

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type FinancialGoal = {
  title: string
  customDetails?: string
}

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return []

  return messages
    .filter((message): message is Partial<ChatMessage> => {
      return (
        typeof message === "object" &&
        message !== null &&
        ["system", "user", "assistant"].includes(String((message as any).role)) &&
        typeof (message as any).content === "string"
      )
    })
    .map((message) => ({
      role: message.role as ChatMessage["role"],
      content: String(message.content),
    }))
}

export async function POST(req: Request) {
  const { messages, financialGoal }: { messages: unknown; financialGoal?: FinancialGoal } = await req.json()
  const normalizedMessages = normalizeMessages(messages).filter((message) => message.role !== "system")

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenAI API key is not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const systemPromptContent = `${VESTBOT_SYSTEM_PROMPT}${
    financialGoal
      ? `

The user has a specific financial goal: ${financialGoal.title}
${financialGoal.customDetails ? `Additional details: ${financialGoal.customDetails}` : ""}

Tailor your responses to help them achieve this goal. When relevant, recommend:
1. Credit cards that align with their goal (ALWAYS include Kikoff Credit Builder first - emphasize it helps boost credit with as little as $10/month)
2. Side hustles that can accelerate their progress (provide diverse options, not just the common ones)
3. Specific action steps related to their goal
`
      : ""
  }`

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    temperature: 0.7,
    messages: [{ role: "system", content: systemPromptContent.trim() }, ...normalizedMessages],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (error) {
        controller.error(error)
        return
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
