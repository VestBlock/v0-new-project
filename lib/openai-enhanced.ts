import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import { sanitizeForJson } from "./json-utils"

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Constants
const DEFAULT_TIMEOUT_MS = 60000 // 60 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Enhanced OpenAI integration with robust error handling and fallback mechanisms
 */

/**
 * Process a credit report using OpenAI
 */
export async function processCreditReport(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  options: {
    signal?: AbortSignal
    fallbackToMock?: boolean
  } = {},
): Promise<{
  success: boolean
  analysisId: string
  result?: any
  error?: string
  isMockData?: boolean
  metrics?: {
    processingTimeMs: number
    retryCount: number
  }
}> {
  const analysisId = uuidv4()
  const startTime = Date.now()
  const retryCount = 0
  let isMockData = false

  try {
    // Verify API key
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured")
    }

    // Create analysis record in database
    try {
      await supabase.from("analyses").insert({
        id: analysisId,
        user_id: userId,
        status: "processing",
        file_path: fileName,
        notes: "Processing credit report...",
        created_at: new Date().toISOString(),
      })
    } catch (dbError) {
      console.error("Error creating analysis record:", dbError)
      // Continue anyway - we'll return the analysis ID even if DB insert fails
    }

    // Convert file to base64
    const base64 = Buffer.from(fileBuffer).toString("base64")
    const dataUri = `data:application/pdf;base64,${base64}`

    // Extract text from file
    let extractedText: string
    try {
      extractedText = await extractTextFromFile(dataUri, options.signal)

      // Update analysis with extracted text
      await supabase
        .from("analyses")
        .update({
          ocr_text: extractedText,
          notes: `Extracted ${extractedText.length} characters. Analyzing...`,
        })
        .eq("id", analysisId)
    } catch (extractError) {
      console.error("Error extracting text:", extractError)

      // Update analysis with error
      await supabase
        .from("analyses")
        .update({
          status: "error",
          notes: `Error extracting text: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
        })
        .eq("id", analysisId)

      throw extractError
    }

    // Analyze the extracted text
    let analysisResult: any
    try {
      analysisResult = await analyzeText(extractedText, options.signal)

      // Update analysis with result
      await supabase
        .from("analyses")
        .update({
          status: "completed",
          result: analysisResult,
          notes: "Analysis completed successfully",
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId)
    } catch (analysisError) {
      console.error("Error analyzing text:", analysisError)

      // If fallback is enabled, use mock data
      if (options.fallbackToMock) {
        console.warn("Falling back to mock data due to analysis error")
        analysisResult = generateMockAnalysis(extractedText)
        isMockData = true

        // Update analysis with mock result
        await supabase
          .from("analyses")
          .update({
            status: "completed",
            result: analysisResult,
            notes: "Analysis completed with mock data due to OpenAI error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", analysisId)
      } else {
        // Update analysis with error
        await supabase
          .from("analyses")
          .update({
            status: "error",
            notes: `Error analyzing text: ${analysisError instanceof Error ? analysisError.message : "Unknown error"}`,
          })
          .eq("id", analysisId)

        throw analysisError
      }
    }

    return {
      success: true,
      analysisId,
      result: analysisResult,
      isMockData,
      metrics: {
        processingTimeMs: Date.now() - startTime,
        retryCount,
      },
    }
  } catch (error) {
    console.error("Error processing credit report:", error)

    return {
      success: false,
      analysisId,
      error: error instanceof Error ? error.message : "Unknown error",
      metrics: {
        processingTimeMs: Date.now() - startTime,
        retryCount,
      },
    }
  }
}

/**
 * Extract text from a file using OpenAI's vision capabilities
 */
async function extractTextFromFile(dataUri: string, signal?: AbortSignal): Promise<string> {
  let retries = 0

  while (retries <= MAX_RETRIES) {
    try {
      // Create a timeout signal
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS)

      // Combine signals if needed
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal

      try {
        console.log(`[OPENAI-ENHANCED] Extracting text (attempt ${retries + 1}/${MAX_RETRIES + 1})`)

        const prompt =
          "Extract ALL text from this credit report. Include ALL numbers, account details, and financial information. Format it as plain text with appropriate line breaks."

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
            max_tokens: 4096,
          }),
          signal: combinedSignal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
          )
        }

        const data = await response.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("Unexpected response format from OpenAI API")
        }

        return data.choices[0].message.content || ""
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error(`[OPENAI-ENHANCED] Extraction attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        signal?.aborted ||
        retries >= MAX_RETRIES ||
        error.message?.includes("quota") ||
        error.message?.includes("authentication")
      ) {
        throw error
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retries)))
      retries++
    }
  }

  throw new Error("Failed to extract text after multiple attempts")
}

/**
 * Analyze text using OpenAI
 */
async function analyzeText(text: string, signal?: AbortSignal): Promise<any> {
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
        console.log(`[OPENAI-ENHANCED] Analyzing text (attempt ${retries + 1}/${MAX_RETRIES + 1})`)

        const systemPrompt =
          "You are an expert credit analyst. Return ONLY valid JSON without any markdown, code blocks, or explanations. If you cannot find a credit score in the report, set score to null. DO NOT make up data."

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

IMPORTANT: 
- Your response must be ONLY the JSON object. Do not include any explanations, markdown formatting, or code blocks.
- If no credit score is found in the report, set "score" to null, not a number.
- DO NOT MAKE UP DATA. Only use information that is present in the credit report.
- If the report doesn't have enough information, acknowledge this in the summary and provide general advice.
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
            max_tokens: 4096,
          }),
          signal: combinedSignal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText}${
              errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
            }`,
          )
        }

        const data = await response.json()

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("Unexpected response format from OpenAI API")
        }

        const responseContent = data.choices[0].message.content || ""

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
              console.log(`[OPENAI-ENHANCED] Invalid score detected (${result.overview.score}), setting to null`)
              result.overview.score = null
            }
          }

          return sanitizeForJson(result)
        } catch (parseError) {
          console.error("[OPENAI-ENHANCED] Error parsing OpenAI response as JSON:", parseError)
          throw new Error("Failed to parse OpenAI response as JSON")
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error(`[OPENAI-ENHANCED] Analysis attempt ${retries + 1} failed:`, error)

      // Check if we should retry
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        signal?.aborted ||
        retries >= MAX_RETRIES ||
        error.message?.includes("quota") ||
        error.message?.includes("authentication")
      ) {
        throw error
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retries)))
      retries++
    }
  }

  throw new Error("Failed to analyze text after multiple attempts")
}

/**
 * Generate chat response using OpenAI
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
  error?: string
  isMockData?: boolean
}> {
  try {
    // Verify API key
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured")
    }

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
Be concise, friendly, and informative. If you don't know something, admit it rather than making up information.  friendly, and informative. If you don't know something, admit it rather than making up information.
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
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}${
          errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
        }`,
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Unexpected response format from OpenAI API")
    }

    const chatResponse = data.choices[0].message.content || ""

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
    } catch (dbError) {
      console.error("Error storing chat messages:", dbError)
      // Continue anyway, we can still return the response
    }

    return {
      success: true,
      response: chatResponse,
    }
  } catch (error) {
    console.error("Error generating chat response:", error)

    // Generate a fallback response
    const fallbackResponse =
      "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment."

    // Store the fallback message in the database
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
          role: "system",
          content: fallbackResponse,
        },
      ])
    } catch (dbError) {
      console.error("Error storing fallback chat messages:", dbError)
    }

    return {
      success: false,
      response: fallbackResponse,
      error: error instanceof Error ? error.message : "Unknown error",
      isMockData: true,
    }
  }
}

/**
 * Generate mock analysis data (only used as fallback when OpenAI fails)
 */
function generateMockAnalysis(text: string): any {
  // This is a fallback function that should only be used when OpenAI fails
  // It creates a generic analysis with a clear indication that it's mock data

  return {
    overview: {
      score: null,
      summary:
        "This is a fallback analysis generated due to an issue connecting to our AI service. The actual details of your credit report could not be analyzed at this time.",
      positiveFactors: ["Unable to determine positive factors due to connection issues"],
      negativeFactors: ["Unable to determine negative factors due to connection issues"],
    },
    disputes: {
      items: [],
    },
    creditHacks: {
      recommendations: [
        {
          title: "Try again later",
          description:
            "Our AI service is currently experiencing issues. Please try again later for a complete analysis.",
          impact: "high",
          timeframe: "immediate",
          steps: ["Wait a few minutes", "Refresh the page", "Try uploading your report again"],
        },
        {
          title: "Get a free copy of your credit report",
          description: "You can get a free copy of your credit report from annualcreditreport.com",
          impact: "medium",
          timeframe: "1-2 weeks",
          steps: ["Visit annualcreditreport.com", "Request your free credit report", "Review your report for errors"],
        },
      ],
    },
    creditCards: {
      recommendations: [],
    },
    sideHustles: {
      recommendations: [],
    },
    _isMockData: true,
  }
}
