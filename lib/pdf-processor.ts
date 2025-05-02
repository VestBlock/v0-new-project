import { createClient } from "@supabase/supabase-js"
import pRetry from "p-retry"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "./supabase"
import { extractJsonFromText, sanitizeForJson } from "./json-utils"

// Configuration constants
const MAX_PDF_SIZE_MB = 25 // Maximum PDF size in MB
const MAX_CHUNK_SIZE_MB = 4 // Maximum chunk size for processing
const MAX_TOKENS = 4096 // Maximum tokens for GPT-4 vision
const PDF_EXTRACTION_TIMEOUT_MS = 45000 // 45 seconds timeout for PDF extraction
const DEFAULT_RETRY_ATTEMPTS = 3 // Default number of retry attempts
const RETRY_BACKOFF_MS = 1000 // Initial retry backoff in ms

// Create Supabase admin client for logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Process a PDF file with OpenAI
 * @param fileBuffer The PDF file buffer
 * @param fileName Original file name
 * @param userId User ID for tracking
 * @returns Processing result with extracted text and analysis
 */
export async function processPDF(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
): Promise<{
  success: boolean
  extractedText?: string
  analysis?: any
  error?: string
  processingId: string
  metrics?: {
    extractionTimeMs: number
    analysisTimeMs: number
    totalTimeMs: number
    fileSize: number
    textLength: number
  }
}> {
  const processingId = uuidv4()
  const requestId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = Date.now()
  let extractionStartTime = 0
  let extractionEndTime = 0
  let analysisStartTime = 0
  let analysisEndTime = 0

  try {
    console.log(`[PDF-PROCESSOR] Starting PDF processing for file: ${fileName}`)
    console.log(`[PDF-PROCESSOR] File size: ${(fileBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB`)

    // Check file size
    const fileSizeMB = fileBuffer.byteLength / (1024 * 1024)
    if (fileSizeMB > MAX_PDF_SIZE_MB) {
      throw new Error(`PDF file exceeds maximum size of ${MAX_PDF_SIZE_MB}MB`)
    }

    // Log processing start
    await logProcessingEvent({
      processingId,
      userId,
      fileName,
      fileSize: fileBuffer.byteLength,
      event: "processing_started",
      details: `Started processing ${fileName} (${fileSizeMB.toFixed(2)}MB)`,
    })

    // 1. Extract text from PDF
    extractionStartTime = Date.now()
    console.log(`[PDF-PROCESSOR] Extracting text from PDF...`)

    let extractedText: string
    if (fileSizeMB > MAX_CHUNK_SIZE_MB) {
      console.log(`[PDF-PROCESSOR] Large PDF detected, using chunked processing`)
      extractedText = await processLargePDF(fileBuffer, processingId, userId)
    } else {
      extractedText = await extractTextFromPDF(fileBuffer, processingId, userId)
    }

    extractionEndTime = Date.now()
    console.log(`[PDF-PROCESSOR] Text extraction complete: ${extractedText.length} characters`)

    // Log extraction completion
    await logProcessingEvent({
      processingId,
      userId,
      event: "text_extraction_complete",
      details: `Extracted ${extractedText.length} characters in ${extractionEndTime - extractionStartTime}ms`,
    })

    // 2. Analyze the extracted text
    analysisStartTime = Date.now()
    console.log(`[PDF-PROCESSOR] Analyzing extracted text...`)

    const analysis = await analyzeText(extractedText, userId, requestId)

    analysisEndTime = Date.now()
    console.log(`[PDF-PROCESSOR] Analysis complete`)

    // Log analysis completion
    await logProcessingEvent({
      processingId,
      userId,
      event: "analysis_complete",
      details: `Completed analysis in ${analysisEndTime - analysisStartTime}ms`,
    })

    // 3. Store processing metrics
    const metrics = {
      extractionTimeMs: extractionEndTime - extractionStartTime,
      analysisTimeMs: analysisEndTime - analysisStartTime,
      totalTimeMs: Date.now() - startTime,
      fileSize: fileBuffer.byteLength,
      textLength: extractedText.length,
    }

    await supabase.from("pdf_processing_metrics").insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.byteLength,
      extraction_time_ms: metrics.extractionTimeMs,
      analysis_time_ms: metrics.analysisTimeMs,
      total_time_ms: metrics.totalTimeMs,
      text_length: extractedText.length,
      timestamp: new Date().toISOString(),
    })

    return {
      success: true,
      extractedText,
      analysis,
      processingId,
      metrics,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[PDF-PROCESSOR] Error processing PDF:`, error)

    // Log error
    await logProcessingEvent({
      processingId,
      userId,
      event: "processing_error",
      details: errorMessage,
      error: error instanceof Error ? error : new Error(errorMessage),
    })

    return {
      success: false,
      error: errorMessage,
      processingId,
      metrics: {
        extractionTimeMs: extractionEndTime - extractionStartTime,
        analysisTimeMs: analysisEndTime - analysisStartTime,
        totalTimeMs: Date.now() - startTime,
        fileSize: fileBuffer.byteLength,
        textLength: 0,
      },
    }
  }
}

/**
 * Extract text from a PDF using OpenAI's vision capabilities
 */
async function extractTextFromPDF(fileBuffer: ArrayBuffer, processingId: string, userId: string): Promise<string> {
  // Convert ArrayBuffer to Base64
  const base64 = Buffer.from(fileBuffer).toString("base64")
  const dataUri = `data:application/pdf;base64,${base64}`

  try {
    // Log extraction attempt
    await logProcessingEvent({
      processingId,
      userId,
      event: "extraction_attempt",
      details: `Attempting to extract text from PDF with OpenAI vision`,
    })

    // Use retry logic for resilience
    const result = await pRetry(
      async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), PDF_EXTRACTION_TIMEOUT_MS)

        try {
          // Use fetch directly to call OpenAI API
          const url = "https://api.openai.com/v1/chat/completions"
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          }

          const prompt =
            "Extract ALL text from this credit report PDF. Include ALL numbers, account details, and financial information. " +
            "Format it as plain text with appropriate line breaks. " +
            "Be thorough and extract EVERY piece of text visible in the document, including headers, footers, and tables. " +
            "Do not summarize or interpret the content - extract the raw text exactly as it appears."

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

          const body = JSON.stringify({
            model: "gpt-4-vision-preview", // Use vision model for PDF analysis
            messages: [
              {
                role: "user",
                content,
              },
            ],
            temperature: 0.1,
            max_tokens: MAX_TOKENS,
          })

          console.log(`[PDF-PROCESSOR] Sending request to OpenAI API with model gpt-4-vision-preview`)

          const fetchResponse = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json().catch(() => ({}))
            console.error(`[PDF-PROCESSOR] API error response:`, errorData)

            throw new Error(
              `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await fetchResponse.json()

          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error(`[PDF-PROCESSOR] Unexpected API response format:`, data)
            throw new Error("Unexpected response format from OpenAI API")
          }

          return data.choices[0].message.content || ""
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      },
      {
        retries: DEFAULT_RETRY_ATTEMPTS,
        factor: 2,
        minTimeout: RETRY_BACKOFF_MS,
        onRetry: (error, attempt) => {
          console.log(`[PDF-PROCESSOR] Retrying text extraction (${attempt}/${DEFAULT_RETRY_ATTEMPTS})...`)
          logProcessingEvent({
            processingId,
            userId,
            event: "extraction_retry",
            details: `Retry attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS}`,
            error,
          })
        },
      },
    )

    // Log successful extraction
    await logProcessingEvent({
      processingId,
      userId,
      event: "extraction_success",
      details: `Successfully extracted ${result.length} characters`,
    })

    return result
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Failed to extract text from PDF after multiple attempts:`, error)

    // Try fallback approach with different prompt
    try {
      console.log(`[PDF-PROCESSOR] Attempting fallback extraction...`)

      await logProcessingEvent({
        processingId,
        userId,
        event: "extraction_fallback",
        details: `Attempting fallback extraction method`,
      })

      // Use fetch directly to call OpenAI API
      const url = "https://api.openai.com/v1/chat/completions"
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      }

      const prompt = "This is a PDF of a credit report. Please extract all the text you can see, page by page."

      // Correctly format the content array for the message
      const content = [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: dataUri,
            detail: "low", // Use lower detail for fallback to reduce token usage
          },
        },
      ]

      const body = JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        temperature: 0.1,
        max_tokens: MAX_TOKENS,
      })

      console.log(`[PDF-PROCESSOR] Sending fallback request to OpenAI API`)

      const fetchResponse = await fetch(url, {
        method: "POST",
        headers,
        body,
      })

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}))
        throw new Error(
          `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
            errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
          }`,
        )
      }

      const data = await fetchResponse.json()
      const response = data.choices[0].message.content || ""

      await logProcessingEvent({
        processingId,
        userId,
        event: "extraction_fallback_success",
        details: `Fallback extraction succeeded with ${response.length} characters`,
      })

      return response
    } catch (fallbackError) {
      console.error(`[PDF-PROCESSOR] Fallback extraction also failed:`, fallbackError)

      await logProcessingEvent({
        processingId,
        userId,
        event: "extraction_fallback_failed",
        details: `Fallback extraction also failed`,
        error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
      })

      throw new Error(
        `Failed to extract text from PDF after multiple attempts: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}

/**
 * Process a large PDF by using a more focused extraction approach
 */
async function processLargePDF(fileBuffer: ArrayBuffer, processingId: string, userId: string): Promise<string> {
  console.log(`[PDF-PROCESSOR] Processing large PDF with optimized approach`)

  // Convert ArrayBuffer to Base64
  const base64 = Buffer.from(fileBuffer).toString("base64")
  const dataUri = `data:application/pdf;base64,${base64}`

  try {
    // Log large PDF processing
    await logProcessingEvent({
      processingId,
      userId,
      event: "large_pdf_processing",
      details: `Processing large PDF with focused extraction`,
    })

    // Use fetch directly to call OpenAI API
    const url = "https://api.openai.com/v1/chat/completions"
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    }

    const prompt =
      "This is a credit report PDF. Extract the MOST IMPORTANT information only:\n" +
      "1. Credit scores (with bureau names)\n" +
      "2. Account information (creditor names, account numbers, balances, payment status)\n" +
      "3. Negative items or collections\n" +
      "4. Payment history\n" +
      "5. Credit inquiries\n\n" +
      "Format as plain text, focusing on facts and numbers. Be thorough with account details."

    // Correctly format the content array for the message
    const content = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: {
          url: dataUri,
          detail: "low", // Use lower detail for large PDFs to reduce token usage
        },
      },
    ]

    const body = JSON.stringify({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
    })

    console.log(`[PDF-PROCESSOR] Sending large PDF request to OpenAI API`)

    const fetchResponse = await fetch(url, {
      method: "POST",
      headers,
      body,
    })

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json().catch(() => ({}))
      throw new Error(
        `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
          errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
        }`,
      )
    }

    const data = await fetchResponse.json()
    const response = data.choices[0].message.content || ""

    await logProcessingEvent({
      processingId,
      userId,
      event: "large_pdf_extraction_complete",
      details: `Extracted ${response.length} characters from large PDF`,
    })

    return response
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Error processing large PDF:`, error)

    await logProcessingEvent({
      processingId,
      userId,
      event: "large_pdf_extraction_failed",
      details: `Failed to extract text from large PDF`,
      error: error instanceof Error ? error : new Error(String(error)),
    })

    throw error
  }
}

/**
 * Analyze extracted text with OpenAI
 */
async function analyzeText(text: string, userId: string, requestId: string): Promise<any> {
  console.log(`[PDF-PROCESSOR] Analyzing text (${text.length} characters)`)

  // Check if text is too long and truncate if necessary
  const maxChars = 60000 // Approximate character limit for GPT-4
  let truncatedText = text

  if (text.length > maxChars) {
    console.log(`[PDF-PROCESSOR] Text exceeds ${maxChars} characters, truncating...`)
    truncatedText = text.substring(0, maxChars)
    console.log(`[PDF-PROCESSOR] Truncated to ${truncatedText.length} characters`)
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

  try {
    // Use retry logic for resilience
    const result = await pRetry(
      async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 50000) // 50 second timeout

        try {
          // Use fetch directly to call OpenAI API
          const url = "https://api.openai.com/v1/chat/completions"
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          }

          const body = JSON.stringify({
            model: "gpt-4", // Use standard GPT-4 for text analysis
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
          })

          console.log(`[PDF-PROCESSOR] Sending analysis request to OpenAI API with model gpt-4`)

          const fetchResponse = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json().catch(() => ({}))
            console.error(`[PDF-PROCESSOR] API error response:`, errorData)

            throw new Error(
              `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
                errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
              }`,
            )
          }

          const data = await fetchResponse.json()

          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error(`[PDF-PROCESSOR] Unexpected API response format:`, data)
            throw new Error("Unexpected response format from OpenAI API")
          }

          return { text: data.choices[0].message.content || "" }
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      },
      {
        retries: DEFAULT_RETRY_ATTEMPTS,
        factor: 2,
        minTimeout: RETRY_BACKOFF_MS,
        onRetry: (error, attempt) => {
          console.log(`[PDF-PROCESSOR] Retrying analysis (${attempt}/${DEFAULT_RETRY_ATTEMPTS})...`)
        },
      },
    )

    // Parse the result as JSON
    try {
      // Use our enhanced JSON extraction function
      const jsonResult = extractJsonFromText(result.text)

      if (!jsonResult) {
        throw new Error("Failed to extract valid JSON from response")
      }

      console.log(`[PDF-PROCESSOR] Successfully parsed JSON response`)

      // Validate the score is either null or a number between 300-850
      if (jsonResult.overview && jsonResult.overview.score !== null) {
        const score = Number(jsonResult.overview.score)
        if (isNaN(score) || score < 300 || score > 850) {
          console.log(`[PDF-PROCESSOR] Invalid score detected (${jsonResult.overview.score}), setting to null`)
          jsonResult.overview.score = null
        } else {
          console.log(`[PDF-PROCESSOR] Valid credit score found: ${score}`)
        }
      } else {
        console.log(`[PDF-PROCESSOR] No credit score found in report, score is null`)
      }

      // Sanitize the result to ensure it can be safely serialized
      return sanitizeForJson(jsonResult)
    } catch (parseError) {
      console.error(`[PDF-PROCESSOR] Error parsing OpenAI response as JSON:`, parseError)

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
    console.error(`[PDF-PROCESSOR] Error calling OpenAI for analysis:`, error)
    throw error
  }
}

/**
 * Log a PDF processing event
 */
async function logProcessingEvent({
  processingId,
  userId,
  fileName,
  fileSize,
  event,
  details,
  error,
}: {
  processingId: string
  userId: string
  fileName?: string
  fileSize?: number
  event: string
  details: string
  error?: Error
}) {
  try {
    // Sanitize error object for safe storage
    const sanitizedError = error ? sanitizeForJson(error) : null

    await supabase.from("pdf_processing_logs").insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size: fileSize,
      event,
      details,
      error_message: sanitizedError?.message,
      error_stack: sanitizedError?.stack,
      timestamp: new Date().toISOString(),
    })
  } catch (logError) {
    console.error(`[PDF-PROCESSOR] Failed to log processing event:`, logError)
    // Don't throw - logging should never break the main flow
  }
}

/**
 * Create the necessary database tables for PDF processing
 */
export async function ensurePDFProcessingTables() {
  try {
    // Check if tables exist
    const { error: checkError } = await supabase.from("pdf_processing_metrics").select("processing_id").limit(1)

    if (checkError && checkError.message.includes("does not exist")) {
      // Create metrics table
      const createMetricsSQL = `
        CREATE TABLE IF NOT EXISTS pdf_processing_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          processing_id UUID NOT NULL,
          user_id UUID REFERENCES auth.users(id),
          file_name TEXT,
          file_size_bytes INTEGER,
          extraction_time_ms INTEGER,
          analysis_time_ms INTEGER,
          total_time_ms INTEGER,
          text_length INTEGER,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pdf_metrics_user_id ON pdf_processing_metrics(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_metrics_timestamp ON pdf_processing_metrics(timestamp);
      `

      // Create logs table
      const createLogsSQL = `
        CREATE TABLE IF NOT EXISTS pdf_processing_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          processing_id UUID NOT NULL,
          user_id UUID REFERENCES auth.users(id),
          file_name TEXT,
          file_size INTEGER,
          event TEXT NOT NULL,
          details TEXT,
          error_message TEXT,
          error_stack TEXT,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_processing_id ON pdf_processing_logs(processing_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_user_id ON pdf_processing_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_event ON pdf_processing_logs(event);
        CREATE INDEX IF NOT EXISTS idx_pdf_logs_timestamp ON pdf_processing_logs(timestamp);
      `

      // Execute the SQL
      const { error: createMetricsError } = await supabase.rpc("exec_sql", { sql: createMetricsSQL })
      if (createMetricsError) {
        console.error("Failed to create pdf_processing_metrics table:", createMetricsError)
      }

      const { error: createLogsError } = await supabase.rpc("exec_sql", { sql: createLogsSQL })
      if (createLogsError) {
        console.error("Failed to create pdf_processing_logs table:", createLogsError)
      }

      console.log("Created PDF processing tables successfully")
    }
  } catch (error) {
    console.error("Error ensuring PDF processing tables:", error)
  }
}
