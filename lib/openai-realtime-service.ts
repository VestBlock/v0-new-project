/**
 * Real-time OpenAI integration service
 * Exclusively uses live data with zero fallbacks to mock data
 */

import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import { sanitizeForJson } from "./json-utils"
import { RateLimiter } from "./rate-limiter"

// Import the PDF processing service
import { processPDF } from "./pdf-processing-service"

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Constants
const DEFAULT_TIMEOUT_MS = 120000 // 2 minutes
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const MAX_TOKENS = 4096

// Rate limiter to manage API requests
const rateLimiter = new RateLimiter({
  tokensPerInterval: 50, // Adjust based on your OpenAI rate limits
  interval: "minute",
})

// Analysis status enum
export enum AnalysisStatus {
  PROCESSING = "processing",
  COMPLETED = "completed",
  ERROR = "error",
}

// Error types
export enum AnalysisErrorType {
  API_ERROR = "api_error",
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout",
  PARSING_ERROR = "parsing_error",
  VALIDATION_ERROR = "validation_error",
  AUTHENTICATION_ERROR = "authentication_error",
  UNKNOWN_ERROR = "unknown_error",
}

// Analysis result interface
export interface AnalysisResult {
  overview: {
    score: number | null
    summary: string
    positiveFactors: string[]
    negativeFactors: string[]
  }
  disputes: {
    items: Array<{
      bureau: string
      accountName: string
      accountNumber: string
      issueType: string
      recommendedAction: string
    }>
  }
  creditHacks: {
    recommendations: Array<{
      title: string
      description: string
      impact: "high" | "medium" | "low"
      timeframe: string
      steps: string[]
    }>
  }
  creditCards: {
    recommendations: Array<{
      name: string
      issuer: string
      annualFee: string
      apr: string
      rewards: string
      approvalLikelihood: "high" | "medium" | "low"
      bestFor: string
    }>
  }
  sideHustles: {
    recommendations: Array<{
      title: string
      description: string
      potentialEarnings: string
      startupCost: string
      difficulty: "easy" | "medium" | "hard"
      timeCommitment: string
      skills: string[]
    }>
  }
}

// Analysis metrics interface
export interface AnalysisMetrics {
  processingTimeMs: number
  retryCount: number
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  modelUsed: string
  extractionTimeMs: number
  analysisTimeMs: number
}

/**
 * Process a credit report using OpenAI with zero fallbacks to mock data
 * This function will either succeed with real data or fail explicitly
 */
// import { createClient } from "@supabase/supabase-js"
// import { v4 as uuidv4 } from "uuid"
import { extractTextFromFile as extractText } from "./file-extraction-service"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
// const supabase = createClient(supabaseUrl, supabaseServiceKey)
// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Analyze a credit report using OpenAI
 */
export async function analyzeCredit(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  options: {
    signal?: AbortSignal
    priority?: "high" | "normal" | "low"
    notifyUser?: boolean
    fileType?: string | null
  } = {},
) {
  const analysisId = uuidv4()
  const startTime = performance.now()
  const metrics: Record<string, number> = {}

  try {
    console.log(`[OPENAI-REALTIME] Starting credit analysis for user ${userId}`)

    // Create analysis record in database
    await supabase.from("analyses").insert({
      id: analysisId,
      user_id: userId,
      status: "processing",
      file_name: fileName,
      created_at: new Date().toISOString(),
    })

    // Extract text from file
    console.log(`[OPENAI-REALTIME] Extracting text from file: ${fileName}`)
    const extractionStartTime = performance.now()

    const extractionResult = await extractText(fileBuffer, fileName, userId, options.fileType)

    metrics.textExtractionMs = performance.now() - extractionStartTime
    console.log(`[OPENAI-REALTIME] Text extraction completed in ${metrics.textExtractionMs.toFixed(0)}ms`)

    // If text extraction failed and it's not an image file
    if (!extractionResult.success && extractionResult.error?.type !== "image_file") {
      throw new Error(`Failed to extract text: ${extractionResult.error?.message}`)
    }

    // Prepare content for analysis
    let content: string
    let isImageAnalysis = false

    if (extractionResult.success && extractionResult.text) {
      // Use extracted text
      content = extractionResult.text
    } else {
      // For image files or when text extraction fails but we have image data
      isImageAnalysis = true

      // Convert ArrayBuffer to base64 for image analysis
      const base64Data = Buffer.from(fileBuffer).toString("base64")
      const mimeType = options.fileType || "image/jpeg"
      const dataUrl = `data:${mimeType};base64,${base64Data}`

      // We'll handle this differently in the OpenAI call
      content = dataUrl
    }

    // Update analysis status
    await supabase
      .from("analyses")
      .update({
        status: "analyzing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    // Analyze with OpenAI
    console.log(`[OPENAI-REALTIME] Analyzing content with OpenAI (${isImageAnalysis ? "image" : "text"} mode)`)
    const analysisStartTime = performance.now()

    let analysisResult

    if (isImageAnalysis) {
      // Use vision model for images
      analysisResult = await analyzeWithVision(content, options.signal)
    } else {
      // Use text model for text
      analysisResult = await analyzeWithText(content, options.signal)
    }

    metrics.openaiAnalysisMs = performance.now() - analysisStartTime
    console.log(`[OPENAI-REALTIME] OpenAI analysis completed in ${metrics.openaiAnalysisMs.toFixed(0)}ms`)

    // Parse the analysis result
    const result = JSON.parse(analysisResult)

    // Update analysis record with results
    await supabase
      .from("analyses")
      .update({
        status: "completed",
        result: result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    metrics.totalProcessingMs = performance.now() - startTime

    return {
      success: true,
      analysisId,
      result,
      metrics,
    }
  } catch (error) {
    console.error(`[OPENAI-REALTIME] Analysis error:`, error)

    // Update analysis record with error
    try {
      await supabase
        .from("analyses")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysisId)
    } catch (dbError) {
      console.error(`[OPENAI-REALTIME] Failed to update analysis record:`, dbError)
    }

    metrics.totalProcessingMs = performance.now() - startTime

    return {
      success: false,
      analysisId,
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: "analysis_error",
        details: error,
      },
      metrics,
    }
  }
}

/**
 * Analyze text content with OpenAI
 */
async function analyzeWithText(content: string, signal?: AbortSignal): Promise<string> {
  // Truncate content if it's too long
  const maxLength = 100000 // Adjust based on token limits
  const truncatedContent =
    content.length > maxLength ? content.substring(0, maxLength) + "... [Content truncated due to length]" : content

  const response = await openai.chat.completions.create(
    {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a credit report analysis expert. Analyze the provided credit report and extract key information. 
          Format your response as a JSON object with the following structure:
          {
            "overview": {
              "score": number | null,
              "summary": string,
              "key_findings": string[],
              "report_date": string | null
            },
            "accounts": [
              {
                "name": string,
                "type": string,
                "status": string,
                "balance": number | null,
                "payment_history": string,
                "recommendations": string[]
              }
            ],
            "negative_items": [
              {
                "type": string,
                "description": string,
                "impact": string,
                "dispute_recommendation": string,
                "dispute_reason": string
              }
            ],
            "improvement_strategies": [
              {
                "title": string,
                "description": string,
                "impact": string,
                "difficulty": string,
                "timeframe": string
              }
            ],
            "income_opportunities": [
              {
                "title": string,
                "description": string,
                "potential_income": string,
                "requirements": string,
                "getting_started": string
              }
            ]
          }
          
          If you cannot determine a value, use null for numbers and empty strings for text. 
          If the document is not a credit report, make your best effort to extract relevant financial information.
          Ensure your response is valid JSON.`,
        },
        {
          role: "user",
          content: truncatedContent,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    },
    { signal },
  )

  return response.choices[0].message.content || "{}"
}

/**
 * Analyze image content with OpenAI Vision
 */
async function analyzeWithVision(imageDataUrl: string, signal?: AbortSignal): Promise<string> {
  const response = await openai.chat.completions.create(
    {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a credit report analysis expert. Analyze the provided credit report image and extract key information. 
          Format your response as a JSON object with the following structure:
          {
            "overview": {
              "score": number | null,
              "summary": string,
              "key_findings": string[],
              "report_date": string | null
            },
            "accounts": [
              {
                "name": string,
                "type": string,
                "status": string,
                "balance": number | null,
                "payment_history": string,
                "recommendations": string[]
              }
            ],
            "negative_items": [
              {
                "type": string,
                "description": string,
                "impact": string,
                "dispute_recommendation": string,
                "dispute_reason": string
              }
            ],
            "improvement_strategies": [
              {
                "title": string,
                "description": string,
                "impact": string,
                "difficulty": string,
                "timeframe": string
              }
            ],
            "income_opportunities": [
              {
                "title": string,
                "description": string,
                "potential_income": string,
                "requirements": string,
                "getting_started": string
              }
            ]
          }
          
          If you cannot determine a value, use null for numbers and empty strings for text. 
          If the document is not a credit report, make your best effort to extract relevant financial information.
          Ensure your response is valid JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
            {
              type: "text",
              text: "Analyze this credit report image and extract all relevant information.",
            },
          ],
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    },
    { signal },
  )

  return response.choices[0].message.content || "{}"
}

/**
 * Extract text from a file using OpenAI's vision capabilities or PDF processing
 * No fallbacks to mock data - will throw an error if extraction fails
 */
async function extractTextFromFile(dataUri: string, fileName: string, signal?: AbortSignal): Promise<string> {
  const retries = 0

  // Check file type from data URI
  const fileType = dataUri.split(";")[0].split(":")[1]

  // Handle different file types
  if (fileType === "application/pdf") {
    console.log("[OPENAI-REALTIME] PDF detected, using PDF.js for extraction")

    // Convert data URI to buffer
    const base64Data = dataUri.split(",")[1]
    const fileBuffer = Buffer.from(base64Data, "base64")

    // Process the PDF
    const pdfResult = await processPDF(fileBuffer, fileName, "system", {
      extractText: true,
      convertToImages: false, // We'll just extract text for now
      maxPages: 20, // Process more pages for credit reports
    })

    if (!pdfResult.success) {
      throw {
        message: pdfResult.error || "Failed to process PDF",
        type: AnalysisErrorType.PARSING_ERROR,
      }
    }

    if (!pdfResult.text || pdfResult.text.trim().length === 0) {
      // If text extraction failed, try with image conversion
      console.log("[OPENAI-REALTIME] Text extraction yielded no results, trying with image conversion")

      const pdfImageResult = await processPDF(fileBuffer, fileName, "system", {
        extractText: false,
        convertToImages: true,
        maxPages: 10, // Limit pages for image conversion
      })

      if (!pdfImageResult.success || !pdfImageResult.images || pdfImageResult.images.length === 0) {
        throw {
          message: "Failed to extract text or images from PDF",
          type: AnalysisErrorType.PARSING_ERROR,
        }
      }

      // Process the first few images with OpenAI vision
      let combinedText = ""

      // Process up to 3 images to keep token usage reasonable
      const imagesToProcess = pdfImageResult.images.slice(0, 3)

      for (let i = 0; i < imagesToProcess.length; i++) {
        // Wait for rate limiter token
        await rateLimiter.removeTokens(1)

        const imageText = await extractTextFromImage(imagesToProcess[i], signal)
        combinedText += `--- Page ${i + 1} ---\n${imageText}\n\n`
      }

      return combinedText
    }

    return pdfResult.text
  } else if (!fileType.startsWith("image/")) {
    // For non-image, non-PDF files (like text files), extract content directly
    if (fileType === "text/plain") {
      console.log("[OPENAI-REALTIME] Text file detected, extracting content directly")
      try {
        // For text files, decode the base64 content
        const base64Content = dataUri.split(",")[1]
        return Buffer.from(base64Content, "base64").toString("utf-8")
      } catch (error) {
        console.error("[OPENAI-REALTIME] Error extracting text from text file:", error)
        throw {
          message: "Failed to extract text from text file",
          type: AnalysisErrorType.PARSING_ERROR,
        }
      }
    } else {
      throw {
        message: `Unsupported file type: ${fileType}. Only PDF, images, and text files are supported.`,
        type: AnalysisErrorType.VALIDATION_ERROR,
      }
    }
  }

  // For image files, use OpenAI's vision API
  return extractTextFromImage(dataUri, signal)
}

/**
 * Extract text from an image using OpenAI's vision capabilities
 */
async function extractTextFromImage(dataUri: string, signal?: AbortSignal): Promise<string> {
  let retries = 0

  while (retries <= MAX_RETRIES) {
    try {
      // Create a timeout signal
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS)

      // Combine signals if needed
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal

      try {
        console.log(`[OPENAI-REALTIME] Extracting text from image (attempt ${retries + 1}/${MAX_RETRIES + 1})`)

        const prompt =
          "Extract ALL text from this credit report image. Include ALL numbers, account details, and financial information. Format it as plain text with appropriate line breaks. Be thorough and capture every detail visible in the document."

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

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content,
              },
            ],
            temperature: 0.1,
            max_tokens: MAX_TOKENS,
          }),
          signal: combinedSignal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))

          // Determine error type
          let errorType = AnalysisErrorType.API_ERROR
          if (response.status === 429) {
            errorType = AnalysisErrorType.RATE_LIMIT
          } else if (response.status === 401 || response.status === 403) {
            errorType = AnalysisErrorType.AUTHENTICATION_ERROR
          }

          throw {
            message: `OpenAI API error: ${response.status} ${response.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
            type: errorType,
            details: errorData,
          }
        }

        const data = await response.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw {
            message: "Unexpected response format from OpenAI API",
            type: AnalysisErrorType.PARSING_ERROR,
          }
        }

        // Log token usage
        if (data.usage) {
          console.log(`[OPENAI-REALTIME] Token usage for extraction: ${JSON.stringify(data.usage)}`)
        }

        const extractedText = data.choices[0].message.content || ""

        // Validate the extracted text
        if (!extractedText || extractedText.length < 100) {
          throw {
            message: "Extracted text is too short or empty. The document may not contain readable text.",
            type: AnalysisErrorType.VALIDATION_ERROR,
          }
        }

        return extractedText
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error(`[OPENAI-REALTIME] Extraction attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      const shouldRetry = !(
        (error instanceof DOMException && error.name === "AbortError") ||
        signal?.aborted ||
        retries >= MAX_RETRIES ||
        error.type === AnalysisErrorType.AUTHENTICATION_ERROR ||
        error.type === AnalysisErrorType.VALIDATION_ERROR
      )

      if (!shouldRetry) {
        throw error
      }

      // Wait before retrying with exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, retries)
      await new Promise((resolve) => setTimeout(resolve, delay))
      retries++
    }
  }

  throw {
    message: "Failed to extract text after multiple attempts",
    type: AnalysisErrorType.UNKNOWN_ERROR,
  }
}

/**
 * Analyze text using OpenAI
 * No fallbacks to mock data - will throw an error if analysis fails
 */
async function analyzeText(
  text: string,
  signal?: AbortSignal,
): Promise<{
  result: AnalysisResult
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  retryCount: number
  model: string
}> {
  let retries = 0

  // Truncate text if it's too long
  const maxChars = 60000
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text

  while (retries <= MAX_RETRIES) {
    try {
      // Create a timeout signal
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS)

      // Combine signals if needed
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal

      try {
        console.log(`[OPENAI-REALTIME] Analyzing text (attempt ${retries + 1}/${MAX_RETRIES + 1})`)

        const systemPrompt = `
You are an expert credit analyst with deep knowledge of credit repair strategies, financial products, and side hustles.
Your task is to analyze a credit report and provide a comprehensive analysis.
Return ONLY valid JSON without any markdown, code blocks, or explanations.
If you cannot find a credit score in the report, set score to null.
DO NOT make up data. Only use information that is present in the credit report.
If the report doesn't have enough information, acknowledge this in the summary and provide general advice.
`

        const userPrompt = `
Analyze the following credit report text and provide a comprehensive analysis with the following sections:

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
`

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: MAX_TOKENS,
          }),
          signal: combinedSignal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))

          // Determine error type
          let errorType = AnalysisErrorType.API_ERROR
          if (response.status === 429) {
            errorType = AnalysisErrorType.RATE_LIMIT
          } else if (response.status === 401 || response.status === 403) {
            errorType = AnalysisErrorType.AUTHENTICATION_ERROR
          }

          throw {
            message: `OpenAI API error: ${response.status} ${response.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
            type: errorType,
            details: errorData,
          }
        }

        const data = await response.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw {
            message: "Unexpected response format from OpenAI API",
            type: AnalysisErrorType.PARSING_ERROR,
          }
        }

        const responseContent = data.choices[0].message.content || ""

        // Log token usage
        const tokenUsage = {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        }

        console.log(`[OPENAI-REALTIME] Token usage for analysis: ${JSON.stringify(tokenUsage)}`)

        // Parse the JSON response
        try {
          // Extract JSON from the response (in case there's any extra text)
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
          const jsonString = jsonMatch ? jsonMatch[0] : responseContent

          const result = JSON.parse(jsonString)

          // Validate the score is either null or a number between 300-850
          if (result.overview && result.overview.score !== null) {
            const score = Number(result.overview.score)
            if (isNaN(score) || score < 300 || score > 850) {
              console.log(`[OPENAI-REALTIME] Invalid score detected (${result.overview.score}), setting to null`)
              result.overview.score = null
            }
          }

          // Validate the result structure
          validateAnalysisResult(result)

          return {
            result: sanitizeForJson(result),
            tokenUsage,
            retryCount: retries,
            model: data.model || "gpt-4o",
          }
        } catch (parseError) {
          console.error("[OPENAI-REALTIME] Error parsing OpenAI response as JSON:", parseError)
          throw {
            message: "Failed to parse OpenAI response as JSON",
            type: AnalysisErrorType.PARSING_ERROR,
            details: parseError,
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error(`[OPENAI-REALTIME] Analysis attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      const shouldRetry = !(
        (error instanceof DOMException && error.name === "AbortError") ||
        signal?.aborted ||
        retries >= MAX_RETRIES ||
        error.type === AnalysisErrorType.AUTHENTICATION_ERROR ||
        error.type === AnalysisErrorType.VALIDATION_ERROR
      )

      if (!shouldRetry) {
        throw error
      }

      // Wait before retrying with exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, retries)
      await new Promise((resolve) => setTimeout(resolve, delay))
      retries++
    }
  }

  throw {
    message: "Failed to analyze text after multiple attempts",
    type: AnalysisErrorType.UNKNOWN_ERROR,
  }
}

/**
 * Validate the analysis result structure
 */
function validateAnalysisResult(result: any): void {
  // Check if result has all required sections
  const requiredSections = ["overview", "disputes", "creditHacks", "creditCards", "sideHustles"]
  for (const section of requiredSections) {
    if (!result[section]) {
      throw {
        message: `Missing required section: ${section}`,
        type: AnalysisErrorType.VALIDATION_ERROR,
      }
    }
  }

  // Validate overview section
  if (
    typeof result.overview.summary !== "string" ||
    !Array.isArray(result.overview.positiveFactors) ||
    !Array.isArray(result.overview.negativeFactors)
  ) {
    throw {
      message: "Invalid overview section structure",
      type: AnalysisErrorType.VALIDATION_ERROR,
    }
  }

  // Validate disputes section
  if (!Array.isArray(result.disputes.items)) {
    throw {
      message: "Invalid disputes section structure",
      type: AnalysisErrorType.VALIDATION_ERROR,
    }
  }

  // Validate creditHacks section
  if (!Array.isArray(result.creditHacks.recommendations)) {
    throw {
      message: "Invalid creditHacks section structure",
      type: AnalysisErrorType.VALIDATION_ERROR,
    }
  }

  // Validate creditCards section
  if (!Array.isArray(result.creditCards.recommendations)) {
    throw {
      message: "Invalid creditCards section structure",
      type: AnalysisErrorType.VALIDATION_ERROR,
    }
  }

  // Validate sideHustles section
  if (!Array.isArray(result.sideHustles.recommendations)) {
    throw {
      message: "Invalid sideHustles section structure",
      type: AnalysisErrorType.VALIDATION_ERROR,
    }
  }
}

/**
 * Generate chat response using OpenAI
 * No fallbacks to mock data - will throw an error if generation fails
 */
export async function generateChatResponse(
  userId: string,
  analysisId: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  analysisData: any,
): Promise<{
  success: boolean
  response?: string
  error?: {
    message: string
    type: string
  }
  metrics?: {
    tokenUsage: {
      prompt: number
      completion: number
      total: number
    }
    processingTimeMs: number
    model: string
  }
}> {
  const startTime = Date.now()

  try {
    // Verify API key
    if (!OPENAI_API_KEY) {
      throw {
        message: "OpenAI API key is not configured",
        type: AnalysisErrorType.AUTHENTICATION_ERROR,
      }
    }

    // Wait for rate limiter token
    await rateLimiter.removeTokens(1)

    // Create a system prompt with the analysis context
    const systemPrompt = `
You are a helpful credit assistant. You have analyzed the user's credit report and have the following information:

Credit Score: ${analysisData.overview?.score || "Unknown"}
Summary: ${analysisData.overview?.summary || "No summary available"}
Positive Factors: ${JSON.stringify(analysisData.overview?.positiveFactors || [])}
Negative Factors: ${JSON.stringify(analysisData.overview?.negativeFactors || [])}
Disputes: ${JSON.stringify(analysisData.disputes?.items || [])}
Credit Hacks: ${JSON.stringify(analysisData.creditHacks?.recommendations || [])}
Side Hustles: ${JSON.stringify(analysisData.sideHustles?.recommendations || [])}

Use this information to provide helpful, personalized responses to the user's questions about their credit. 
Be concise, friendly, and informative. If you don't know something, admit it rather than making up information.
`

    // Format the conversation history
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ]

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Determine error type
      let errorType = AnalysisErrorType.API_ERROR
      if (response.status === 429) {
        errorType = AnalysisErrorType.RATE_LIMIT
      } else if (response.status === 401 || response.status === 403) {
        errorType = AnalysisErrorType.AUTHENTICATION_ERROR
      }

      throw {
        message: `OpenAI API error: ${response.status} ${response.statusText}${
          errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
        }`,
        type: errorType,
        details: errorData,
      }
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw {
        message: "Unexpected response format from OpenAI API",
        type: AnalysisErrorType.PARSING_ERROR,
      }
    }

    const chatResponse = data.choices[0].message.content || ""

    // Log token usage
    const tokenUsage = {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    }

    console.log(`[OPENAI-REALTIME] Token usage for chat: ${JSON.stringify(tokenUsage)}`)

    // Store the message in the database
    try {
      await supabase.from("chat_messages").insert([
        {
          analysis_id: analysisId,
          user_id: userId,
          role: "user",
          content: message,
        },
        {
          analysis_id: analysisId,
          user_id: userId,
          role: "assistant",
          content: chatResponse,
        },
      ])

      // Log the chat interaction
      await supabase.from("analysis_logs").insert({
        analysis_id: analysisId,
        user_id: userId,
        event: "chat_message",
        details: {
          messageLength: message.length,
          responseLength: chatResponse.length,
          tokenUsage,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (dbError) {
      console.error("Error storing chat messages:", dbError)
      // Continue anyway, we can still return the response
    }

    return {
      success: true,
      response: chatResponse,
      metrics: {
        tokenUsage,
        processingTimeMs: Date.now() - startTime,
        model: data.model || "gpt-4o",
      },
    }
  } catch (error) {
    console.error("Error generating chat response:", error)

    // Log the chat error
    try {
      await supabase.from("analysis_logs").insert({
        analysis_id: analysisId,
        user_id: userId,
        event: "chat_error",
        details: {
          error: error.message || "Unknown error",
          errorType: error.type || AnalysisErrorType.UNKNOWN_ERROR,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (logError) {
      console.error("Error logging chat error:", logError)
    }

    // NO FALLBACK - return the error
    return {
      success: false,
      error: {
        message: error.message || "Unknown error occurred",
        type: error.type || AnalysisErrorType.UNKNOWN_ERROR,
      },
      metrics: {
        tokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
        processingTimeMs: Date.now() - startTime,
        model: "gpt-4o",
      },
    }
  }
}

/**
 * Check OpenAI API connectivity and status
 */
export async function checkOpenAIStatus(): Promise<{
  success: boolean
  message: string
  latencyMs: number
  model?: string
  error?: {
    message: string
    type: string
  }
}> {
  const startTime = Date.now()

  try {
    // Verify API key
    if (!OPENAI_API_KEY) {
      return {
        success: false,
        message: "OpenAI API key is not configured",
        latencyMs: Date.now() - startTime,
        error: {
          message: "OpenAI API key is not configured",
          type: AnalysisErrorType.AUTHENTICATION_ERROR,
        },
      }
    }

    // Simple test request
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Respond with 'OpenAI API is working correctly'" }],
        temperature: 0,
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Determine error type
      let errorType = AnalysisErrorType.API_ERROR
      if (response.status === 429) {
        errorType = AnalysisErrorType.RATE_LIMIT
      } else if (response.status === 401 || response.status === 403) {
        errorType = AnalysisErrorType.AUTHENTICATION_ERROR
      }

      return {
        success: false,
        message: `OpenAI API error: ${response.status} ${response.statusText}`,
        latencyMs: Date.now() - startTime,
        error: {
          message: `OpenAI API error: ${response.status} ${response.statusText}${
            errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
          }`,
          type: errorType,
        },
      }
    }

    const data = await response.json()

    return {
      success: true,
      message: "OpenAI API is working correctly",
      latencyMs: Date.now() - startTime,
      model: data.model || "gpt-3.5-turbo",
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to connect to OpenAI API",
      latencyMs: Date.now() - startTime,
      error: {
        message: error.message || "Unknown error occurred",
        type: error.type || AnalysisErrorType.UNKNOWN_ERROR,
      },
    }
  }
}
