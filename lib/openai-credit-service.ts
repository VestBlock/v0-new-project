/**
 * OpenAI Credit Analysis Service
 *
 * Optimized for Vercel environment with specialized functions for
 * credit report analysis and real-time chat interactions.
 */

import { createClient } from "@supabase/supabase-js"
import pRetry from "p-retry"
import { sanitizeForJson } from "./json-utils"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "./database.types"

// Environment variables with fallbacks
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Performance configuration
const DEFAULT_TIMEOUT_MS = 60000 // 60 seconds
const MAX_CONCURRENT_REQUESTS = 5 // Limit concurrent requests
const CACHE_TTL_MS = 300000 // 5 minutes cache TTL
const MAX_RETRIES = 3 // Maximum retry attempts

// Create a request queue to manage concurrent requests
let activeRequests = 0
const requestQueue: Array<() => Promise<void>> = []

// Create Supabase client with safety checks
let supabase: ReturnType<typeof createClient<Database>> | null = null
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error)
  }
}

// Response cache for frequently requested analyses
const responseCache = new Map<
  string,
  {
    data: any
    timestamp: number
  }
>()

// Error types for better categorization
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

// Request tracking for analytics and debugging
interface RequestMetrics {
  requestId: string
  startTime: number
  endTime?: number
  success: boolean
  model: string
  operation: string
  retryCount: number
  errorType?: OpenAIErrorType
  processingTimeMs?: number
  userId?: string
  cacheHit?: boolean
}

const activeMetrics = new Map<string, RequestMetrics>()

/**
 * Process a credit report PDF using OpenAI's vision capabilities
 * Optimized for credit report analysis with specialized prompting
 */
export async function analyzeCreditReportWithAI(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  options: {
    priority?: boolean
    cacheKey?: string
    signal?: AbortSignal
  } = {},
): Promise<{
  success: boolean
  result?: any
  analysisId: string
  error?: string
  metrics?: {
    processingTimeMs: number
    modelUsed: string
    retryCount: number
    cacheHit: boolean
  }
}> {
  const analysisId = uuidv4()
  const requestId = `credit_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()
  let retryCount = 0
  const cacheHit = false

  // Start tracking metrics
  const metrics: RequestMetrics = {
    requestId,
    startTime,
    success: false,
    model: "gpt-4-vision-preview",
    operation: "credit_analysis",
    retryCount: 0,
    userId,
  }
  activeMetrics.set(requestId, metrics)

  try {
    // Check cache if cacheKey is provided
    if (options.cacheKey) {
      const cached = responseCache.get(options.cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[OPENAI-CREDIT] Cache hit for ${options.cacheKey}`)

        // Update metrics
        metrics.success = true
        metrics.endTime = Date.now()
        metrics.processingTimeMs = metrics.endTime - startTime
        metrics.cacheHit = true

        // Log the cache hit
        await logRequestMetrics(metrics)

        return {
          success: true,
          result: cached.data,
          analysisId,
          metrics: {
            processingTimeMs: Date.now() - startTime,
            modelUsed: "gpt-4-vision-preview",
            retryCount: 0,
            cacheHit: true,
          },
        }
      }
    }

    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured")
    }

    // Process the request through the queue if we're at capacity
    if (activeRequests >= MAX_CONCURRENT_REQUESTS && !options.priority) {
      console.log(`[OPENAI-CREDIT] Queueing request, current active: ${activeRequests}`)
      await new Promise<void>((resolve) => {
        requestQueue.push(async () => {
          resolve()
        })
      })
    }

    // Increment active requests
    activeRequests++

    // Convert ArrayBuffer to Base64
    const base64 = Buffer.from(fileBuffer).toString("base64")
    const dataUri = `data:application/pdf;base64,${base64}`

    // Use retry logic for resilience
    const result = await pRetry(
      async () => {
        const controller = new AbortController()
        // Combine the provided signal with our timeout signal
        const signal = options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(DEFAULT_TIMEOUT_MS)])
          : AbortSignal.timeout(DEFAULT_TIMEOUT_MS)

        try {
          metrics.retryCount = retryCount

          // Specialized prompt for credit report analysis
          const prompt = `
You are a credit analysis expert. Analyze this credit report thoroughly and extract all relevant information.
Focus on:
1. Credit scores from all bureaus
2. Account details (creditor names, account numbers, balances, payment status)
3. Negative items and collections
4. Payment history patterns
5. Credit inquiries
6. Factors affecting the score

Extract ALL text and numbers accurately. Include ALL account details and financial information.
Format as plain text with appropriate structure.
`

          // Correctly format the content array for the message
          const content = [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: dataUri,
                detail: "high",
              },
            },
          ]

          console.log(`[OPENAI-CREDIT] Sending PDF analysis request to OpenAI API`)

          // Use fetch directly to call OpenAI API
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4-vision-preview",
              messages: [
                {
                  role: "user",
                  content,
                },
              ],
              temperature: 0.1,
              max_tokens: 4096,
            }),
            signal,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error(`[OPENAI-CREDIT] API error response:`, errorData)

            throw new Error(
              `OpenAI API error: ${response.status} ${response.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await response.json()

          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error(`[OPENAI-CREDIT] Unexpected API response format:`, data)
            throw new Error("Unexpected response format from OpenAI API")
          }

          const extractedText = data.choices[0].message.content || ""

          // Now analyze the extracted text to get structured data
          const analysisResult = await analyzeExtractedText(extractedText, userId)

          // Cache the result if cacheKey is provided
          if (options.cacheKey) {
            responseCache.set(options.cacheKey, {
              data: analysisResult,
              timestamp: Date.now(),
            })
          }

          return analysisResult
        } catch (error) {
          // Increment retry count
          retryCount++

          // Determine if we should retry
          const shouldRetry =
            retryCount <= MAX_RETRIES &&
            !(error instanceof DOMException && error.name === "AbortError") &&
            !error.message?.includes("quota") &&
            !error.message?.includes("authentication")

          if (!shouldRetry) {
            throw error
          }

          console.log(`[OPENAI-CREDIT] Retrying analysis (${retryCount}/${MAX_RETRIES})`)
          throw error // Rethrow to trigger retry
        }
      },
      {
        retries: MAX_RETRIES,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
        onRetry: (error, attempt) => {
          console.log(`[OPENAI-CREDIT] Retry attempt ${attempt}/${MAX_RETRIES}:`, error.message)
        },
      },
    )

    // Update metrics
    metrics.success = true
    metrics.endTime = Date.now()
    metrics.processingTimeMs = metrics.endTime - startTime

    // Log successful request
    await logRequestMetrics(metrics)

    return {
      success: true,
      result,
      analysisId,
      metrics: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: "gpt-4-vision-preview",
        retryCount,
        cacheHit,
      },
    }
  } catch (error) {
    console.error(`[OPENAI-CREDIT] Error analyzing credit report:`, error)

    // Update metrics
    metrics.success = false
    metrics.endTime = Date.now()
    metrics.processingTimeMs = metrics.endTime - startTime
    metrics.errorType = determineErrorType(error)

    // Log failed request
    await logRequestMetrics(metrics)

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      analysisId,
      metrics: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: "gpt-4-vision-preview",
        retryCount,
        cacheHit,
      },
    }
  } finally {
    // Decrement active requests
    activeRequests--

    // Process next request in queue if any
    if (requestQueue.length > 0) {
      const nextRequest = requestQueue.shift()
      if (nextRequest) {
        nextRequest()
      }
    }

    // Remove from active metrics
    activeMetrics.delete(requestId)
  }
}

/**
 * Analyze extracted text to generate structured credit report analysis
 */
async function analyzeExtractedText(text: string, userId: string): Promise<any> {
  const requestId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()

  // Start tracking metrics
  const metrics: RequestMetrics = {
    requestId,
    startTime,
    success: false,
    model: "gpt-4",
    operation: "text_analysis",
    retryCount: 0,
    userId,
  }
  activeMetrics.set(requestId, metrics)

  try {
    // Check if text is too long and truncate if necessary
    const maxChars = 60000 // Approximate character limit for GPT-4
    let truncatedText = text

    if (text.length > maxChars) {
      console.log(`[OPENAI-CREDIT] Text exceeds ${maxChars} characters, truncating...`)
      truncatedText = text.substring(0, maxChars)
    }

    const prompt = `
You are an expert credit analyst with deep knowledge of credit repair strategies, financial products, and side hustles. Analyze the following credit report text and provide a comprehensive analysis with the following sections:

1. Overview: 
   - IMPORTANT: If the credit report does NOT explicitly mention a credit score, set the score to null.
   - DO NOT make up or estimate a score if one is not clearly stated in the report.
   - If you cannot find a specific credit score number in the report, set score to null.
   - Only provide a score if it is explicitly mentioned in the report.
   - Provide a detailed summary of the credit report, and list positive and negative factors.

2. Disputes: Identify items that could be disputed, including the credit bureau, account name, account number, issue type, and recommended action. Be specific about why each item can be disputed.

3. Credit Hacks: Provide strategic, actionable recommendations to improve the credit score, including the potential impact (high/medium/low) and timeframe. Include specific steps the user should take with measurable outcomes.

4. Credit Card Recommendations: Based on the credit profile, recommend 3-5 specific credit cards that would be appropriate for the user, including details about APR, annual fees, rewards, and approval likelihood.

5. Side Hustles: Suggest diverse and creative income opportunities based on the credit profile, including potential earnings, startup costs, and difficulty level. Include both traditional and innovative options that can help improve financial situation.

Credit Report Text:
${truncatedText}

Format your response as a JSON object with the following structure:
{
  "overview": {
    "score": number | null,
    "summary": string,
    "positiveFactors": string[],
    "negativeFactors": string[]
  },
  "disputes": {
    "items": [
      {
        "bureau": string,
        "accountName": string,
        "accountNumber": string,
        "issueType": string,
        "recommendedAction": string
      }
    ]
  },
  "creditHacks": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "impact": "high" | "medium" | "low",
        "timeframe": string,
        "steps": string[]
      }
    ]
  },
  "creditCards": {
    "recommendations": [
      {
        "name": string,
        "issuer": string,
        "annualFee": string,
        "apr": string,
        "rewards": string,
        "approvalLikelihood": "high" | "medium" | "low",
        "bestFor": string
      }
    ]
  },
  "sideHustles": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "potentialEarnings": string,
        "startupCost": string,
        "difficulty": "easy" | "medium" | "hard",
        "timeCommitment": string,
        "skills": string[]
      }
    ]
  }
}

IMPORTANT: 
- Your response must be ONLY the JSON object. Do not include any explanations, markdown formatting, or code blocks.
- If no credit score is found in the report, set "score" to null, not a number.
- DO NOT MAKE UP DATA. Only use information that is present in the credit report.
- If the report doesn't have enough information, acknowledge this in the summary and provide general advice.
`

    const systemPrompt =
      "You are an expert credit analyst. Return ONLY valid JSON without any markdown, code blocks, or explanations. If you cannot find a credit score in the report, set score to null. DO NOT make up data."

    // Use fetch directly to call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}${
          errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
        }`,
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0].message.content || ""

    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's any extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse

      const result = JSON.parse(jsonString)

      // Validate the score is either null or a number between 300-850
      if (result.overview && result.overview.score !== null) {
        const score = Number(result.overview.score)
        if (isNaN(score) || score < 300 || score > 850) {
          console.log(`[OPENAI-CREDIT] Invalid score detected (${result.overview.score}), setting to null`)
          result.overview.score = null
        }
      }

      // Update metrics
      metrics.success = true
      metrics.endTime = Date.now()
      metrics.processingTimeMs = metrics.endTime - startTime

      // Log successful request
      await logRequestMetrics(metrics)

      return sanitizeForJson(result)
    } catch (parseError) {
      console.error(`[OPENAI-CREDIT] Error parsing OpenAI response as JSON:`, parseError)

      // Update metrics
      metrics.success = false
      metrics.endTime = Date.now()
      metrics.processingTimeMs = metrics.endTime - startTime
      metrics.errorType = OpenAIErrorType.VALIDATION

      // Log failed request
      await logRequestMetrics(metrics)

      // If we can't parse the JSON, create a default structure
      return {
        overview: {
          score: null,
          summary:
            "We were unable to properly analyze your credit report. The system encountered an error processing the data.",
          positiveFactors: ["Unable to determine positive factors due to processing error"],
          negativeFactors: ["Unable to determine negative factors due to processing error"],
        },
        disputes: { items: [] },
        creditHacks: {
          recommendations: [
            {
              title: "Get a free copy of your credit report",
              description:
                "Since we had trouble analyzing your report, we recommend getting a fresh copy from annualcreditreport.com and trying again.",
              impact: "high",
              timeframe: "immediate",
              steps: [
                "Visit annualcreditreport.com",
                "Request your free credit report",
                "Upload the new report to VestBlock",
              ],
            },
          ],
        },
        creditCards: { recommendations: [] },
        sideHustles: { recommendations: [] },
      }
    }
  } catch (error) {
    console.error(`[OPENAI-CREDIT] Error analyzing extracted text:`, error)

    // Update metrics
    metrics.success = false
    metrics.endTime = Date.now()
    metrics.processingTimeMs = metrics.endTime - startTime
    metrics.errorType = determineErrorType(error)

    // Log failed request
    await logRequestMetrics(metrics)

    throw error
  } finally {
    // Remove from active metrics
    activeMetrics.delete(requestId)
  }
}

/**
 * Enhanced chat function for real-time credit insights
 * Optimized for Vercel environment with context-aware responses
 */
export async function generateCreditChatResponse(
  userId: string,
  analysisId: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  analysisResult: any,
): Promise<{
  success: boolean
  response?: string
  error?: string
  metrics?: {
    processingTimeMs: number
    modelUsed: string
    cacheHit: boolean
  }
}> {
  const requestId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()
  let cacheHit = false

  // Start tracking metrics
  const metrics: RequestMetrics = {
    requestId,
    startTime,
    success: false,
    model: "gpt-4o",
    operation: "credit_chat",
    retryCount: 0,
    userId,
  }
  activeMetrics.set(requestId, metrics)

  try {
    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured")
    }

    // Check cache for common questions
    const cacheKey = `${userId}:${analysisId}:${message.substring(0, 50)}`
    const cached = responseCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[OPENAI-CREDIT] Cache hit for chat response`)
      cacheHit = true

      // Update metrics
      metrics.success = true
      metrics.endTime = Date.now()
      metrics.processingTimeMs = metrics.endTime - startTime
      metrics.cacheHit = true

      // Log the cache hit
      await logRequestMetrics(metrics)

      return {
        success: true,
        response: cached.data,
        metrics: {
          processingTimeMs: Date.now() - startTime,
          modelUsed: "gpt-4o",
          cacheHit: true,
        },
      }
    }

    // Process the request through the queue if we're at capacity
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      console.log(`[OPENAI-CREDIT] Queueing chat request, current active: ${activeRequests}`)
      await new Promise<void>((resolve) => {
        requestQueue.push(async () => {
          resolve()
        })
      })
    }

    // Increment active requests
    activeRequests++

    // Sanitize the analysis result to ensure it can be safely serialized
    const sanitizedResult = sanitizeForJson(analysisResult)

    // Create a system prompt with the analysis context
    const systemPrompt = `
You are a helpful credit assistant. You have analyzed the user's credit report and have the following information:

Credit Score: ${sanitizedResult.overview?.score || "Unknown"}
Summary: ${sanitizedResult.overview?.summary || "No summary available"}
Positive Factors: ${JSON.stringify(sanitizedResult.overview?.positiveFactors || [])}
Negative Factors: ${JSON.stringify(sanitizedResult.overview?.negativeFactors || [])}
Disputes: ${JSON.stringify(sanitizedResult.disputes?.items || [])}
Credit Hacks: ${JSON.stringify(sanitizedResult.creditHacks?.recommendations || [])}
Side Hustles: ${JSON.stringify(sanitizedResult.sideHustles?.recommendations || [])}

Use this information to provide helpful, personalized responses to the user's questions about their credit. 
Be concise, friendly, and informative. If you don't know something, admit it rather than making up information.
`

    // Use retry logic for resilience
    const result = await pRetry(
      async () => {
        try {
          // Use fetch directly to call OpenAI API
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{ role: "system", content: systemPrompt }, ...conversationHistory],
              temperature: 0.7,
              max_tokens: 1000,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
              `OpenAI API error: ${response.status} ${response.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await response.json()
          return data.choices[0].message.content || ""
        } catch (error) {
          // Determine if we should retry
          const shouldRetry = !error.message?.includes("quota") && !error.message?.includes("authentication")

          if (!shouldRetry) {
            throw error
          }

          throw error // Rethrow to trigger retry
        }
      },
      {
        retries: 2, // Fewer retries for chat to keep it responsive
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      },
    )

    // Cache the response
    responseCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    // Update metrics
    metrics.success = true
    metrics.endTime = Date.now()
    metrics.processingTimeMs = metrics.endTime - startTime

    // Log successful request
    await logRequestMetrics(metrics)

    return {
      success: true,
      response: result,
      metrics: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: "gpt-4o",
        cacheHit,
      },
    }
  } catch (error) {
    console.error(`[OPENAI-CREDIT] Error generating chat response:`, error)

    // Update metrics
    metrics.success = false
    metrics.endTime = Date.now()
    metrics.processingTimeMs = metrics.endTime - startTime
    metrics.errorType = determineErrorType(error)

    // Log failed request
    await logRequestMetrics(metrics)

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metrics: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: "gpt-4o",
        cacheHit,
      },
    }
  } finally {
    // Decrement active requests
    activeRequests--

    // Process next request in queue if any
    if (requestQueue.length > 0) {
      const nextRequest = requestQueue.shift()
      if (nextRequest) {
        nextRequest()
      }
    }

    // Remove from active metrics
    activeMetrics.delete(requestId)
  }
}

/**
 * Determine the type of error for better categorization
 */
function determineErrorType(error: any): OpenAIErrorType {
  const errorMessage = error?.message?.toLowerCase() || ""

  if (
    errorMessage.includes("api key") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("unauthorized")
  ) {
    return OpenAIErrorType.AUTHENTICATION
  } else if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
    return OpenAIErrorType.RATE_LIMIT
  } else if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
    return OpenAIErrorType.QUOTA_EXCEEDED
  } else if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    (error instanceof DOMException && error.name === "AbortError")
  ) {
    return OpenAIErrorType.TIMEOUT
  } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
    return OpenAIErrorType.CONNECTION
  } else if (errorMessage.includes("invalid") || errorMessage.includes("validation")) {
    return OpenAIErrorType.VALIDATION
  } else if (errorMessage.includes("server error") || errorMessage.includes("500")) {
    return OpenAIErrorType.SERVER
  }

  return OpenAIErrorType.UNKNOWN
}

/**
 * Log request metrics to Supabase for monitoring
 */
async function logRequestMetrics(metrics: RequestMetrics): Promise<void> {
  if (!supabase) {
    console.warn("[OPENAI-CREDIT] Metrics logging skipped: Supabase client not available")
    return
  }

  try {
    await supabase.from("openai_request_metrics").insert({
      request_id: metrics.requestId,
      user_id: metrics.userId,
      operation: metrics.operation,
      model: metrics.model,
      success: metrics.success,
      processing_time_ms: metrics.processingTimeMs,
      retry_count: metrics.retryCount,
      error_type: metrics.errorType,
      cache_hit: metrics.cacheHit,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[OPENAI-CREDIT] Failed to log request metrics:", error)
  }
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): {
  activeRequests: number
  queueLength: number
  cacheSize: number
  activeOperations: Record<string, number>
} {
  // Count operations by type
  const operationCounts: Record<string, number> = {}
  activeMetrics.forEach((metric) => {
    operationCounts[metric.operation] = (operationCounts[metric.operation] || 0) + 1
  })

  return {
    activeRequests,
    queueLength: requestQueue.length,
    cacheSize: responseCache.size,
    activeOperations: operationCounts,
  }
}

/**
 * Clear response cache
 */
export function clearResponseCache(): void {
  responseCache.clear()
  console.log("[OPENAI-CREDIT] Response cache cleared")
}

/**
 * Create necessary database tables for monitoring
 */
export async function ensureMetricsTables(): Promise<void> {
  if (!supabase) {
    console.warn("[OPENAI-CREDIT] Table creation skipped: Supabase client not available")
    return
  }

  try {
    // Check if the table exists
    const { error: checkError } = await supabase.from("openai_request_metrics").select("request_id").limit(1)

    // If the table doesn't exist, create it
    if (checkError && checkError.message.includes("does not exist")) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS openai_request_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          request_id TEXT NOT NULL,
          user_id UUID,
          operation TEXT NOT NULL,
          model TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          processing_time_ms INTEGER,
          retry_count INTEGER,
          error_type TEXT,
          cache_hit BOOLEAN,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_openai_metrics_user_id ON openai_request_metrics(user_id);
        CREATE INDEX IF NOT EXISTS idx_openai_metrics_timestamp ON openai_request_metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_openai_metrics_operation ON openai_request_metrics(operation);
        CREATE INDEX IF NOT EXISTS idx_openai_metrics_success ON openai_request_metrics(success);
      `

      // Execute the SQL using Supabase's rpc
      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.error("Failed to create openai_request_metrics table:", createError)
      } else {
        console.log("Created openai_request_metrics table successfully")
      }
    }
  } catch (error) {
    console.error("Error ensuring metrics tables:", error)
  }
}
