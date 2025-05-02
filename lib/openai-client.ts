import { createClient } from "@supabase/supabase-js"
import pRetry from "p-retry"
import { sanitizeForJson } from "./json-utils"

// Create Supabase client for logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Error types for better handling
export enum OpenAIErrorType {
  AUTHENTICATION = "authentication",
  RATE_LIMIT = "rate_limit",
  QUOTA_EXCEEDED = "quota_exceeded",
  TIMEOUT = "timeout",
  SERVER = "server",
  CONNECTION = "connection",
  VALIDATION = "validation",
  UNKNOWN = "unknown",
}

export interface OpenAIErrorDetails {
  type: OpenAIErrorType
  message: string
  status?: number
  retryable: boolean
  raw?: any
}

// Configuration
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 60000 // 60 seconds
const MAX_BACKOFF_MS = 30000 // 30 seconds max backoff

/**
 * Parses an error from OpenAI to determine the type and if it's retryable
 */
function parseOpenAIError(error: any): OpenAIErrorDetails {
  // Default error details
  const details: OpenAIErrorDetails = {
    type: OpenAIErrorType.UNKNOWN,
    message: error?.message || "Unknown error occurred",
    retryable: false,
    raw: sanitizeForJson(error),
  }

  // Extract status code if available
  if (error?.status) {
    details.status = error.status
  } else if (error?.response?.status) {
    details.status = error.response.status
  }

  // Check for specific error messages
  const errorMessage = error?.message?.toLowerCase() || ""

  // Authentication errors
  if (
    details.status === 401 ||
    errorMessage.includes("api key") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("unauthorized")
  ) {
    details.type = OpenAIErrorType.AUTHENTICATION
    details.message = "Invalid API key or authentication error"
    details.retryable = false
  }
  // Rate limit errors
  else if (
    details.status === 429 ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests")
  ) {
    details.type = OpenAIErrorType.RATE_LIMIT
    details.message = "Rate limit exceeded. Please try again later."
    details.retryable = true
  }
  // Quota exceeded
  else if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
    details.type = OpenAIErrorType.QUOTA_EXCEEDED
    details.message = "API quota exceeded. Please check your billing status."
    details.retryable = false
  }
  // Timeout errors
  else if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    details.type = OpenAIErrorType.TIMEOUT
    details.message = "Request timed out. Please try again."
    details.retryable = true
  }
  // Server errors (5xx)
  else if (details.status && details.status >= 500 && details.status < 600) {
    details.type = OpenAIErrorType.SERVER
    details.message = "OpenAI server error. Please try again later."
    details.retryable = true
  }
  // Connection errors
  else if (
    errorMessage.includes("network") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("econnreset")
  ) {
    details.type = OpenAIErrorType.CONNECTION
    details.message = "Connection error. Please check your internet connection."
    details.retryable = true
  }
  // Validation errors (4xx)
  else if (details.status && details.status >= 400 && details.status < 500) {
    details.type = OpenAIErrorType.VALIDATION
    details.message = "Invalid request parameters"
    details.retryable = false
  }

  return details
}

/**
 * Logs an OpenAI API request to Supabase for monitoring
 */
async function logOpenAIRequest(
  requestId: string,
  options: {
    userId?: string
    model: string
    promptLength: number
    success: boolean
    errorType?: OpenAIErrorType
    errorMessage?: string
    responseLength?: number
    latencyMs?: number
    retryCount?: number
  },
) {
  try {
    // Sanitize data before inserting
    const sanitizedOptions = sanitizeForJson(options)

    await supabase.from("openai_logs").insert({
      request_id: requestId,
      user_id: sanitizedOptions.userId,
      model: sanitizedOptions.model,
      prompt_length: sanitizedOptions.promptLength,
      success: sanitizedOptions.success,
      error_type: sanitizedOptions.errorType,
      error_message: sanitizedOptions.errorMessage,
      response_length: sanitizedOptions.responseLength,
      latency_ms: sanitizedOptions.latencyMs,
      retry_count: sanitizedOptions.retryCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log OpenAI request:", error)
    // Don't throw - logging should never break the main flow
  }
}

/**
 * Enhanced generateText function with robust error handling and retry logic
 */
export async function generateTextWithRetry(options: {
  model: any
  prompt?: string
  messages?: any[]
  system?: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  userId?: string
  retryOptions?: {
    attempts?: number
    initialDelay?: number
    maxDelay?: number
    onRetry?: (error: Error, attempt: number) => void
  }
}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()
  const modelName = typeof options.model === "function" ? options.model.name : String(options.model || "gpt-4o")
  const promptLength = typeof options.prompt === "string" ? options.prompt.length : 0
  let retryCount = 0

  // Validate API key before attempting
  if (!process.env.OPENAI_API_KEY) {
    const error: OpenAIErrorDetails = {
      type: OpenAIErrorType.AUTHENTICATION,
      message: "OpenAI API key is not configured",
      retryable: false,
    }

    await logOpenAIRequest(requestId, {
      userId: options.userId,
      model: modelName,
      promptLength,
      success: false,
      errorType: error.type,
      errorMessage: error.message,
      latencyMs: Date.now() - startTime,
      retryCount: 0,
    })

    throw new Error(`OpenAI API key is not configured. Please add it to your environment variables.`)
  }

  // Configure retry options
  const retryAttempts = options.retryOptions?.attempts || DEFAULT_RETRY_ATTEMPTS
  const initialDelay = options.retryOptions?.initialDelay || 1000
  const maxDelay = options.retryOptions?.maxDelay || MAX_BACKOFF_MS

  try {
    // Use p-retry for exponential backoff retry logic
    const result = await pRetry(
      async () => {
        try {
          // Add timeout to the fetch request
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

          // Prepare the messages array
          const messages = []

          if (options.system) {
            messages.push({ role: "system", content: options.system })
          }

          if (options.messages) {
            // If messages are provided, use them directly
            messages.push(...options.messages)
          } else if (options.prompt) {
            // If only prompt is provided, add it as a user message
            messages.push({ role: "user", content: options.prompt })
          }

          // Ensure we have at least one message
          if (messages.length === 0) {
            throw new Error("No content provided. Either 'prompt' or 'messages' must be specified.")
          }

          // Determine the model to use
          const model = typeof options.model === "function" ? "gpt-4o" : options.model || "gpt-4o"

          // Use fetch directly to call OpenAI API
          const url = "https://api.openai.com/v1/chat/completions"
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          }

          const body = JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1000,
          })

          console.log(`[OPENAI-CLIENT] Sending request to ${url} with model ${model}`)

          const fetchResponse = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json().catch(() => ({}))
            console.error(`[OPENAI-CLIENT] API error response:`, errorData)

            throw new Error(
              `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await fetchResponse.json()

          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error(`[OPENAI-CLIENT] Unexpected API response format:`, data)
            throw new Error("Unexpected response format from OpenAI API")
          }

          return { text: data.choices[0].message.content || "" }
        } catch (error) {
          // Parse the error
          const parsedError = parseOpenAIError(error)
          console.error(`OpenAI API error (attempt ${retryCount + 1}/${retryAttempts}):`, parsedError)

          // Log the error
          await logOpenAIRequest(requestId, {
            userId: options.userId,
            model: modelName,
            promptLength,
            success: false,
            errorType: parsedError.type,
            errorMessage: parsedError.message,
            latencyMs: Date.now() - startTime,
            retryCount: retryCount,
          })

          // Increment retry count
          retryCount++

          // If the error is not retryable, don't retry
          if (!parsedError.retryable) {
            throw new pRetry.AbortError(parsedError.message)
          }

          // Otherwise, throw the error to trigger a retry
          throw new Error(parsedError.message)
        }
      },
      {
        retries: retryAttempts,
        factor: 2,
        minTimeout: initialDelay,
        maxTimeout: maxDelay,
        onRetry: (error, attempt) => {
          console.log(`Retrying OpenAI request (${attempt}/${retryAttempts})...`)
          if (options.retryOptions?.onRetry) {
            options.retryOptions.onRetry(error, attempt)
          }
        },
      },
    )

    // Log successful request
    await logOpenAIRequest(requestId, {
      userId: options.userId,
      model: modelName,
      promptLength,
      success: true,
      responseLength: result.text.length,
      latencyMs: Date.now() - startTime,
      retryCount,
    })

    return result
  } catch (error) {
    // Final error handling
    const parsedError = parseOpenAIError(error)

    // Log the final failure
    await logOpenAIRequest(requestId, {
      userId: options.userId,
      model: modelName,
      promptLength,
      success: false,
      errorType: parsedError.type,
      errorMessage: parsedError.message,
      latencyMs: Date.now() - startTime,
      retryCount,
    })

    // Enhance the error with our parsed details
    const enhancedError = new Error(parsedError.message)
    ;(enhancedError as any).type = parsedError.type
    ;(enhancedError as any).status = parsedError.status
    ;(enhancedError as any).retryable = parsedError.retryable
    ;(enhancedError as any).requestId = requestId

    throw enhancedError
  }
}

/**
 * Checks if the OpenAI API is accessible and working
 */
export async function checkOpenAIConnectivity(): Promise<{
  success: boolean
  message: string
  error?: string
  latencyMs?: number
  apiKeyValid?: boolean
  apiKeyPrefix?: string
}> {
  const startTime = Date.now()

  try {
    // Check if API key is set
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return {
        success: false,
        message: "OpenAI API key is not configured",
        apiKeyValid: false,
      }
    }

    // Get the first few characters of the API key for debugging
    const apiKeyPrefix = apiKey.substring(0, 5) + "..." + apiKey.substring(apiKey.length - 4)

    // Try a simple request to verify the key works
    const { text } = await generateTextWithRetry({
      model: "gpt-3.5-turbo",
      prompt: "Say 'OpenAI API key is working'",
      maxTokens: 10,
      retryOptions: {
        attempts: 1, // Only try once for the connectivity check
      },
    })

    const latencyMs = Date.now() - startTime

    return {
      success: true,
      message: "OpenAI API is accessible and working",
      latencyMs,
      apiKeyValid: true,
      apiKeyPrefix,
    }
  } catch (error) {
    const parsedError = parseOpenAIError(error)
    const latencyMs = Date.now() - startTime

    return {
      success: false,
      message: `OpenAI API check failed: ${parsedError.message}`,
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
      apiKeyValid: parsedError.type !== OpenAIErrorType.AUTHENTICATION,
    }
  }
}

/**
 * Creates the SQL table for OpenAI logs if it doesn't exist
 */
export async function ensureOpenAILogsTable() {
  try {
    // Check if the table exists
    const { error: checkError } = await supabase.from("openai_logs").select("id").limit(1)

    // If the table doesn't exist, create it
    if (checkError && checkError.message.includes("does not exist")) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS openai_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          request_id TEXT NOT NULL,
          user_id UUID,
          model TEXT NOT NULL,
          prompt_length INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          error_type TEXT,
          error_message TEXT,
          response_length INTEGER,
          latency_ms INTEGER,
          retry_count INTEGER,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_openai_logs_user_id ON openai_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_openai_logs_timestamp ON openai_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_openai_logs_success ON openai_logs(success);
      `

      // Execute the SQL using Supabase's rpc
      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.error("Failed to create openai_logs table:", createError)
      } else {
        console.log("Created openai_logs table successfully")
      }
    }
  } catch (error) {
    console.error("Error ensuring OpenAI logs table:", error)
  }
}
