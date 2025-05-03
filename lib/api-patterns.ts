/**
 * Standardized API patterns for VestBlock
 *
 * This file provides consistent patterns for API calls, error handling,
 * and data transformation across the application.
 */

import { createClient } from "@supabase/supabase-js"
import pRetry from "p-retry"
import type { Database } from "./database.types"
import { sanitizeForJson } from "./json-utils"

// ===== Supabase Patterns =====

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Singleton instance for client-side
let supabaseClientInstance: ReturnType<typeof createClient> | null = null

/**
 * Get the Supabase client (singleton pattern)
 * Use this function for all client-side Supabase operations
 */
export function getSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance

  supabaseClientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseClientInstance
}

/**
 * Get the Supabase admin client with service role
 * Use this function for server-side admin operations
 */
export function getSupabaseAdmin() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Standard error handler for Supabase operations
 */
export async function withSupabaseErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage = "Database operation failed",
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`Supabase error: ${errorMessage}`, error)
    throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// ===== OpenAI Patterns =====

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
 * Standard OpenAI API call with retry logic
 * Use this function for all OpenAI API calls
 */
export async function callOpenAI<T>({
  endpoint = "chat/completions",
  model = "gpt-4o",
  messages,
  temperature = 0.7,
  maxTokens = 1000,
  userId,
  retryAttempts = DEFAULT_RETRY_ATTEMPTS,
}: {
  endpoint?: string
  model?: string
  messages: Array<{ role: string; content: string | Array<any> }>
  temperature?: number
  maxTokens?: number
  userId?: string
  retryAttempts?: number
}): Promise<T> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()
  let retryCount = 0

  // Validate API key before attempting
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please add it to your environment variables.")
  }

  try {
    // Use p-retry for exponential backoff retry logic
    return await pRetry(
      async () => {
        try {
          // Add timeout to the fetch request
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

          // Use fetch directly to call OpenAI API
          const url = `https://api.openai.com/v1/${endpoint}`
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          }

          const body = JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          })

          console.log(`[OPENAI-API] Sending request to ${url} with model ${model}`)

          const fetchResponse = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json().catch(() => ({}))
            console.error(`[OPENAI-API] API error response:`, errorData)

            throw new Error(
              `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await fetchResponse.json()
          return data as T
        } catch (error) {
          // Parse the error
          const parsedError = parseOpenAIError(error)
          console.error(`OpenAI API error (attempt ${retryCount + 1}/${retryAttempts}):`, parsedError)

          // Log the error to Supabase if possible
          try {
            const supabase = getSupabaseAdmin()
            await supabase.from("openai_logs").insert({
              request_id: requestId,
              user_id: userId,
              model,
              prompt_length: JSON.stringify(messages).length,
              success: false,
              error_type: parsedError.type,
              error_message: parsedError.message,
              latency_ms: Date.now() - startTime,
              retry_count: retryCount,
              timestamp: new Date().toISOString(),
            })
          } catch (logError) {
            console.error("Failed to log OpenAI error:", logError)
          }

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
        minTimeout: 1000,
        maxTimeout: MAX_BACKOFF_MS,
        onRetry: (error, attempt) => {
          console.log(`Retrying OpenAI request (${attempt}/${retryAttempts})...`)
        },
      },
    )
  } catch (error) {
    // Final error handling
    const parsedError = parseOpenAIError(error)

    // Log the final failure
    try {
      const supabase = getSupabaseAdmin()
      await supabase.from("openai_logs").insert({
        request_id: requestId,
        user_id: userId,
        model,
        prompt_length: JSON.stringify(messages).length,
        success: false,
        error_type: parsedError.type,
        error_message: parsedError.message,
        latency_ms: Date.now() - startTime,
        retry_count: retryCount,
        timestamp: new Date().toISOString(),
      })
    } catch (logError) {
      console.error("Failed to log final OpenAI error:", logError)
    }

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

// ===== API Response Patterns =====

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
  meta?: {
    requestId?: string
    timestamp?: string
    processingTimeMs?: number
  }
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(data: T, statusCode = 200, meta?: ApiResponse<T>["meta"]): Response {
  return Response.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status: statusCode },
  )
}

/**
 * Create an error API response
 */
export function createErrorResponse<T>(
  message: string,
  statusCode = 500,
  details?: any,
  meta?: ApiResponse<T>["meta"],
): Response {
  return Response.json(
    {
      success: false,
      error: {
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status: statusCode },
  )
}
