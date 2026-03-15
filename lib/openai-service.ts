/**
 * OpenAI Service - Uses fetch API directly
 * This service provides functions to interact with OpenAI API without using the SDK
 */

type Message = {
  role: "system" | "user" | "assistant"
  content: string
}

type CompletionRequest = {
  model: string
  messages: Message[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  // Add other OpenAI parameters as needed, e.g., top_p
}

type CompletionResponse = {
  id: string
  choices: {
    message: {
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  // Add other fields from OpenAI response if necessary
}

/**
 * Creates a chat completion using the OpenAI API
 */
export async function createChatCompletion(
  messages: Message[],
  stream = false,
  options: Partial<CompletionRequest & { timeout?: number }> = {}, // Allow overriding model, temperature, timeout etc.
): Promise<Response | CompletionResponse> {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[OpenAI Service] API key is missing")
      throw new Error("OpenAI API key is not configured")
    }

    const { timeout = 55000, ...restOfOptions } = options // Default timeout 55 seconds, slightly less than 60s maxDuration

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const requestBody: CompletionRequest = {
      model: restOfOptions.model || "gpt-4o",
      messages,
      stream,
      temperature: restOfOptions.temperature ?? 0.7,
      max_tokens: restOfOptions.max_tokens,
      ...restOfOptions,
    }

    let response: Response
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal, // Add AbortController signal
      })
    } finally {
      clearTimeout(timeoutId) // Clear the timeout whether fetch succeeded or failed
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[OpenAI Service] Raw API error response (status ${response.status}): ${errorText}`)
      let detailedMessage = errorText
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson && errorJson.error && errorJson.error.message) {
          detailedMessage = errorJson.error.message
        }
      } catch (jsonParseError) {
        // errorText was not JSON
      }
      throw new Error(`OpenAI API Error (${response.status}): ${detailedMessage}`)
    }

    if (stream) {
      return response
    }

    const data = await response.json()
    return data as CompletionResponse
  } catch (error) {
    const { timeout } = options
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[OpenAI Service] OpenAI request timed out after", timeout, "ms")
      throw new Error(`OpenAI request timed out after ${timeout / 1000} seconds.`)
    }
    console.error(
      "[OpenAI Service] Error in createChatCompletion:",
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }
}

/**
 * Lists available models from OpenAI API
 */
export async function listModels() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OpenAI API key is not configured")
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) {
      const errorText = await response.text()
      // Similar refined error handling for listModels
      console.error(`[OpenAI Service] Raw API error response (listModels, status ${response.status}): ${errorText}`)
      let detailedMessage = errorText
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson && errorJson.error && errorJson.error.message) {
          detailedMessage = errorJson.error.message
        }
      } catch (jsonParseError) {
        // errorText was not JSON
      }
      throw new Error(`OpenAI API Error (listModels, ${response.status}): ${detailedMessage}`)
    }
    return response.json()
  } catch (error) {
    console.error("[OpenAI Service] List models error:", error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Tests the OpenAI connection by trying to list models.
 * Returns a more detailed object for better diagnostics.
 */
export async function testOpenAIConnection(): Promise<{
  success: boolean
  status?: number
  error?: string
  data?: any
}> {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[OpenAI Service] testOpenAIConnection: API key is missing")
      return { success: false, error: "OpenAI API key is not configured in environment variables." }
    }

    const controller = new AbortController()
    const timeout = 10000 // 10 seconds timeout for connection test
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let response: Response
    try {
      response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[OpenAI Service] testOpenAIConnection: Raw API error ${response.status} - ${errorText}`)
      let errorMessage = errorText
      let errorData: any = null
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorText
        errorData = errorJson
      } catch (e) {
        // errorText was not JSON
      }
      return {
        success: false,
        status: response.status,
        error: errorMessage,
        data: errorData,
      }
    }

    const data = await response.json()
    console.log("[OpenAI Service] testOpenAIConnection: Successfully fetched models.")
    return {
      success: true,
      status: response.status,
      data: { modelCount: data.data?.length || 0, firstModelId: data.data?.[0]?.id },
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("[OpenAI Service] testOpenAIConnection: Request timed out.")
      return { success: false, error: "OpenAI connection test timed out." }
    }
    console.error("[OpenAI Service] testOpenAIConnection: General error -", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred during the connection test.",
      data: error.cause ? { cause: error.cause } : undefined,
    }
  }
}
