import { streamText, type CoreMessage } from "ai"
import { openai } from "@ai-sdk/openai"

export const runtime = "edge"

const VESTBOT_SYSTEM_PROMPT = `You are VestBot, an AI assistant designed to provide personalized financial advice and guidance. You are an expert in personal finance, investing, and credit building. You are friendly, helpful, and encouraging. You should always provide accurate and up-to-date information. You should never provide financial advice that is not in the best interest of the user. You should always be transparent about your limitations. You should always encourage the user to do their own research and consult with a financial professional before making any financial decisions.`

type FinancialGoal = {
  title: string
  customDetails?: string
}

export async function POST(req: Request) {
  const { messages, financialGoal }: { messages: CoreMessage[]; financialGoal?: FinancialGoal } = await req.json()

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

  const result = await streamText({
    model: openai("gpt-4"),
    system: systemPromptContent.trim(),
    messages: messages,
  })

  return result.toAIStreamResponse()
}
