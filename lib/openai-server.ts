import "server-only" // Ensures this module is never bundled with client code
import OpenAI from "openai"

let openai: OpenAI | undefined
let openAIInitializationError: string | null = null

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  const errorMessage =
    "OpenAI API key (OPENAI_API_KEY) is not configured in environment variables. OpenAI functionalities will be disabled."
  console.warn(`[OpenAI Server Lib] ${errorMessage}`)
  openAIInitializationError = errorMessage
} else {
  try {
    console.log("[OpenAI Server Lib] Attempting to initialize OpenAI client...")
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Add this line
    })
    console.log("[OpenAI Server Lib] OpenAI client initialized successfully (with dangerouslyAllowBrowser: true).")
  } catch (e: any) {
    // This catch might not even be reached if the constructor itself throws the specific "browser-like" error
    // before this point, but it's good practice.
    const errorMessage = `[OpenAI Server Lib] Failed to initialize OpenAI client: ${e.message}`
    console.error(errorMessage, e)
    openAIInitializationError = e.message || "Unknown error during OpenAI client initialization."
    openai = undefined // Ensure openai is undefined on error
  }
}

export { openai, openAIInitializationError }

export function getOpenAIClient(): OpenAI | undefined {
  if (openAIInitializationError) {
    console.warn(`[OpenAI Server Lib] getOpenAIClient called, but initialization failed: ${openAIInitializationError}`)
    // For critical operations, you might want to throw new Error(`OpenAI client is not available: ${openAIInitializationError}`);
    return undefined
  }
  if (!openai) {
    // This case should ideally not be hit if apiKey is present and initialization didn't set an error,
    // but it's a safeguard.
    console.warn(
      `[OpenAI Server Lib] getOpenAIClient called, but OpenAI client is unexpectedly undefined. Check API key and server logs.`,
    )
    return undefined
  }
  return openai
}

// VESTBOT_SYSTEM_PROMPT (Example - you might have this in a separate constants file)
export const VESTBOT_SYSTEM_PROMPT = `You are VestBot, an expert AI financial advisor specializing in credit repair, financial planning, and income generation strategies for VestBlock.io.
Your goal is to provide clear, actionable, and empathetic guidance.
Users may provide you with context from their credit analysis, including summaries, detailed roadmap steps, credit card recommendations, and side hustle ideas.
When context is provided, leverage it deeply to answer follow-up questions, clarify points, and offer further personalized advice.
If the user asks a general question, provide helpful financial information.
Be encouraging and break down complex topics into understandable steps.
Always prioritize the user's financial well-being and empowerment.
Do not give specific investment advice (stocks, crypto etc) unless it's about very general concepts like diversification or risk management in the context of savings.
Focus on credit building, debt management, budgeting, saving, and income strategies.
If asked about something outside your expertise, politely say so.
When providing lists or steps, use clear formatting (markdown if appropriate).
You are integrated into a results page that has already displayed a detailed analysis. Your role is to elaborate and assist further.
`
