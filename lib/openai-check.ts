import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

export async function verifyOpenAIKey(): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log("Verifying OpenAI API key...")

    // Check if the API key is set
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("OpenAI API key is not set in environment variables")
      return { valid: false, error: "API key is not configured" }
    }

    console.log("API key exists, testing with a simple request...")

    // Try a simple request to verify the key works
    const { text } = await generateText({
      model: openai("gpt-3.5-turbo"),
      prompt: "Say 'OpenAI API key is working'",
      maxTokens: 10,
    })

    console.log("OpenAI API response:", text)

    return { valid: true }
  } catch (error) {
    console.error("OpenAI API key verification failed:", error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error verifying API key",
    }
  }
}
