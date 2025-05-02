import { v4 as uuidv4 } from "uuid"
import { createClient } from "@supabase/supabase-js"
import { extractJsonFromText, sanitizeForJson } from "@/lib/json-utils"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Constants for configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const TIMEOUT_MS = 50000

/**
 * Direct OpenAI integration with no mock data
 * Simple, reliable implementation for Vercel
 */

// Use native fetch for simplicity and reliability
export async function callOpenAI({
  prompt,
  model = "gpt-4o",
  temperature = 0.7,
  maxTokens = 1000,
  systemPrompt,
}: {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}) {
  // Verify API key exists
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined in environment variables")
  }

  try {
    const messages = []

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt })
    }

    // Add user prompt
    messages.push({ role: "user", content: prompt })

    // Call OpenAI API directly
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error("OpenAI API call failed:", error)
    throw error
  }
}

// Function to analyze credit report text
export async function analyzeCreditReport(text: string) {
  const systemPrompt =
    "You are a credit analysis expert. Provide detailed, accurate analysis based only on the provided information."

  const prompt = `
Analyze the following credit report text and provide insights:

${text}

Focus on:
1. Credit scores
2. Account details
3. Negative items
4. Recommendations for improvement
`

  return callOpenAI({
    prompt,
    model: "gpt-4o",
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt,
  })
}

// Function to check if OpenAI API is working
export async function testOpenAIConnection() {
  try {
    const result = await callOpenAI({
      prompt: "Respond with 'OpenAI connection successful' if you receive this message.",
      model: "gpt-3.5-turbo",
      maxTokens: 20,
    })

    return {
      success: true,
      message: result,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Directly analyze a credit report using OpenAI
 */
export async function analyzeCreditReportDirect(
  fileBuffer: ArrayBuffer,
  fileName: string,
  fileType: string,
  userId: string,
  options: {
    signal?: AbortSignal
  } = {},
): Promise<{
  success: boolean
  analysisId?: string
  result?: any
  error?: string
}> {
  console.log(`[OPENAI-DIRECT] Starting direct analysis for file: ${fileName}`)

  // Create a new analysis record in the database first
  const analysisId = uuidv4()

  try {
    // Insert the analysis record with "processing" status
    const { error: insertError } = await supabase.from("analyses").insert({
      id: analysisId,
      user_id: userId,
      status: "processing",
      file_name: fileName,
      notes: "Processing credit report...",
    })

    if (insertError) {
      console.error("[OPENAI-DIRECT] Error creating analysis record:", insertError)
      return {
        success: false,
        error: "Failed to create analysis record",
      }
    }

    console.log(`[OPENAI-DIRECT] Created analysis record with ID: ${analysisId}`)

    // Convert ArrayBuffer to Base64
    const base64 = Buffer.from(fileBuffer).toString("base64")
    const dataUri = fileType.startsWith("image/")
      ? `data:${fileType};base64,${base64}`
      : fileType === "application/pdf"
        ? `data:application/pdf;base64,${base64}`
        : `data:text/plain;base64,${base64}`

    // Extract text from the file
    console.log(`[OPENAI-DIRECT] Extracting text from ${fileType} file...`)

    let extractedText: string

    try {
      // For text files, just decode the base64
      if (fileType === "text/plain") {
        extractedText = Buffer.from(fileBuffer).toString("utf-8")
        console.log(`[OPENAI-DIRECT] Extracted ${extractedText.length} characters from text file`)
      } else {
        // For PDFs and images, use OpenAI to extract text
        extractedText = await extractTextWithRetry(dataUri, fileType, options.signal)
        console.log(`[OPENAI-DIRECT] Extracted ${extractedText.length} characters from ${fileType} file`)
      }

      // Update the analysis record with the extracted text
      await supabase
        .from("analyses")
        .update({
          notes: `Extracted ${extractedText.length} characters. Analyzing...`,
        })
        .eq("id", analysisId)
    } catch (extractError) {
      console.error("[OPENAI-DIRECT] Error extracting text:", extractError)

      // Update the analysis record with the error
      await supabase
        .from("analyses")
        .update({
          status: "error",
          notes: `Error extracting text: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
        })
        .eq("id", analysisId)

      return {
        success: false,
        analysisId,
        error: `Failed to extract text from file: ${
          extractError instanceof Error ? extractError.message : "Unknown error"
        }`,
      }
    }

    // Analyze the extracted text
    console.log(`[OPENAI-DIRECT] Analyzing extracted text...`)

    try {
      const analysisResult = await analyzeTextWithRetry(extractedText, options.signal)
      console.log(`[OPENAI-DIRECT] Analysis complete`)

      // Update the analysis record with the result
      const { error: updateError } = await supabase
        .from("analyses")
        .update({
          status: "completed",
          notes: "Analysis completed successfully",
          result: analysisResult,
        })
        .eq("id", analysisId)

      if (updateError) {
        console.error("[OPENAI-DIRECT] Error updating analysis record:", updateError)
        // Continue anyway - we have the result
      }

      return {
        success: true,
        analysisId,
        result: analysisResult,
      }
    } catch (analysisError) {
      console.error("[OPENAI-DIRECT] Error analyzing text:", analysisError)

      // Update the analysis record with the error
      await supabase
        .from("analyses")
        .update({
          status: "error",
          notes: `Error analyzing text: ${analysisError instanceof Error ? analysisError.message : "Unknown error"}`,
        })
        .eq("id", analysisId)

      return {
        success: false,
        analysisId,
        error: `Failed to analyze text: ${analysisError instanceof Error ? analysisError.message : "Unknown error"}`,
      }
    }
  } catch (error) {
    console.error("[OPENAI-DIRECT] Unhandled error in analyzeCreditReportDirect:", error)

    // Try to update the analysis record with the error
    try {
      await supabase
        .from("analyses")
        .update({
          status: "error",
          notes: `Unhandled error: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
        .eq("id", analysisId)
    } catch (updateError) {
      console.error("[OPENAI-DIRECT] Error updating analysis record with error:", updateError)
    }

    return {
      success: false,
      analysisId,
      error: `Unhandled error: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Extract text from a file using OpenAI with retry logic
 */
async function extractTextWithRetry(dataUri: string, fileType: string, signal?: AbortSignal): Promise<string> {
  let retries = 0
  let lastError: any = null

  while (retries < MAX_RETRIES) {
    try {
      console.log(`[OPENAI-DIRECT] Extracting text attempt ${retries + 1}/${MAX_RETRIES}`)

      const controller = new AbortController()
      // Use the provided signal or create a new one
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const prompt =
          fileType === "application/pdf"
            ? "Extract ALL text from this credit report PDF. Include ALL numbers, account details, and financial information. Format it as plain text with appropriate line breaks."
            : "Extract ALL text from this credit report image. Include ALL numbers, account details, and financial information. Format it as plain text with appropriate line breaks."

        // Use fetch directly to call OpenAI API
        const url = "https://api.openai.com/v1/chat/completions"
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        }

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
          model: "gpt-4o", // Use GPT-4o which supports vision
          messages: [
            {
              role: "user",
              content,
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        })

        console.log(`[OPENAI-DIRECT] Sending request to OpenAI API with model gpt-4-vision-preview`)

        const fetchResponse = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json().catch(() => ({}))
          console.error(`[OPENAI-DIRECT] API error response:`, errorData)

          throw new Error(
            `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
          )
        }

        const data = await fetchResponse.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error(`[OPENAI-DIRECT] Unexpected API response format:`, data)
          throw new Error("Unexpected response format from OpenAI API")
        }

        return data.choices[0].message.content || ""
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error) {
      lastError = error
      console.error(`[OPENAI-DIRECT] Extraction attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      if (error.name === "AbortError" || signal?.aborted) {
        throw new Error("Operation aborted or timed out")
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)))
      retries++
    }
  }

  throw lastError || new Error("Failed to extract text after multiple attempts")
}

/**
 * Analyze text using OpenAI with retry logic
 */
async function analyzeTextWithRetry(text: string, signal?: AbortSignal): Promise<any> {
  let retries = 0
  let lastError: any = null

  // Truncate text if it's too long
  const maxChars = 60000
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text

  if (text.length > maxChars) {
    console.log(`[OPENAI-DIRECT] Text truncated from ${text.length} to ${truncatedText.length} characters`)
  }

  while (retries < MAX_RETRIES) {
    try {
      console.log(`[OPENAI-DIRECT] Analyzing text attempt ${retries + 1}/${MAX_RETRIES}`)

      const controller = new AbortController()
      const combinedSignal = signal
        ? { signal: AbortSignal.any([signal, controller.signal]) }
        : { signal: controller.signal }

      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
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
        const url = "https://api.openai.com/v1/chat/completions"
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        }

        const body = JSON.stringify({
          model: "gpt-4o", // Use GPT-4o for text analysis
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        })

        console.log(`[OPENAI-DIRECT] Sending request to OpenAI API with model gpt-4`)

        const fetchResponse = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json().catch(() => ({}))
          console.error(`[OPENAI-DIRECT] API error response:`, errorData)

          throw new Error(
            `OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
          )
        }

        const data = await fetchResponse.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error(`[OPENAI-DIRECT] Unexpected API response format:`, data)
          throw new Error("Unexpected response format from OpenAI API")
        }

        const responseContent = data.choices[0].message.content || ""

        // Parse the result as JSON
        try {
          // Use our enhanced JSON extraction function
          const jsonResult = extractJsonFromText(responseContent)

          if (!jsonResult) {
            throw new Error("Failed to extract valid JSON from response")
          }

          console.log(`[OPENAI-DIRECT] Successfully parsed JSON response`)

          // Validate the score is either null or a number between 300-850
          if (jsonResult.overview && jsonResult.overview.score !== null) {
            const score = Number(jsonResult.overview.score)
            if (isNaN(score) || score < 300 || score > 850) {
              console.log(`[OPENAI-DIRECT] Invalid score detected (${jsonResult.overview.score}), setting to null`)
              jsonResult.overview.score = null
            } else {
              console.log(`[OPENAI-DIRECT] Valid credit score found: ${score}`)
            }
          } else {
            console.log(`[OPENAI-DIRECT] No credit score found in report, score is null`)
          }

          // Sanitize the result to ensure it can be safely serialized
          return sanitizeForJson(jsonResult)
        } catch (parseError) {
          console.error(`[OPENAI-DIRECT] Error parsing OpenAI response as JSON:`, parseError)

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
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error) {
      lastError = error
      console.error(`[OPENAI-DIRECT] Analysis attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      if (error.name === "AbortError" || signal?.aborted) {
        throw new Error("Operation aborted or timed out")
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)))
      retries++
    }
  }

  // If we've exhausted all retries, return a fallback analysis
  console.error(`[OPENAI-DIRECT] Failed to analyze text after ${MAX_RETRIES} attempts, using fallback`)

  return {
    overview: {
      score: null,
      summary: "We were unable to properly analyze your credit report after multiple attempts.",
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

/**
 * Check if OpenAI API is working
 */
export async function checkOpenAIDirectConnection(): Promise<{
  success: boolean
  message: string
  latencyMs?: number
}> {
  const startTime = Date.now()

  try {
    // Try a simple request to verify the API works
    const url = "https://api.openai.com/v1/chat/completions"
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    }

    const body = JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say 'OpenAI API is working'" }],
      max_tokens: 10,
    })

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
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
    const latencyMs = Date.now() - startTime

    return {
      success: true,
      message: "OpenAI API is accessible and working",
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime

    return {
      success: false,
      message: `OpenAI API check failed: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs,
    }
  }
}
