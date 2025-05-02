/**
 * Comprehensive OpenAI Credit Report Analysis Service
 * Handles PDF processing, detailed analysis, and structured results
 */

import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "./database.types"

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create Supabase client
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

/**
 * Analyze PDF content using OpenAI
 * This function extracts text from PDF and analyzes it
 */
export async function analyzePdfContent(pdfBase64: string, userId: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  console.log("Starting PDF analysis...")

  // First, we need to extract text from the PDF
  // For PDFs, we'll use a two-step approach:
  // 1. Extract text using GPT-4 Vision
  // 2. Analyze the extracted text with a detailed prompt

  try {
    // Step 1: Extract text from PDF using Vision API
    console.log("Extracting text from PDF...")
    const extractedText = await extractTextFromPdf(pdfBase64)
    console.log("Text extraction complete")

    // Step 2: Analyze the extracted text
    console.log("Analyzing extracted text...")
    const analysis = await analyzeExtractedText(extractedText, userId)
    console.log("Analysis complete")

    return {
      success: true,
      result: analysis,
      analysisId: uuidv4(),
    }
  } catch (error) {
    console.error("Error in PDF analysis:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error in PDF analysis",
    }
  }
}

/**
 * Extract text from PDF using GPT-4 Vision
 */
async function extractTextFromPdf(pdfBase64: string): Promise<string> {
  // For PDFs, we'll use the Vision API to "look" at the PDF and extract text
  try {
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
            role: "system",
            content:
              "You are a specialized OCR system for credit reports. Extract ALL text from the provided PDF, including numbers, account details, and credit scores. Include ALL text visible in the document.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text from this credit report PDF. Include ALL numbers, account details, and credit scores. Don't summarize or analyze, just extract the raw text.",
              },
              {
                type: "image_url",
                image_url: {
                  url: pdfBase64,
                  detail: "high",
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error("Error extracting text from PDF:", error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Analyze extracted text to generate structured credit report analysis
 */
async function analyzeExtractedText(text: string, userId: string): Promise<any> {
  try {
    // Check if text is too long and truncate if necessary
    const maxChars = 60000 // Approximate character limit for GPT-4
    let truncatedText = text

    if (text.length > maxChars) {
      console.log(`Text exceeds ${maxChars} characters, truncating...`)
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

    // Call OpenAI API for analysis
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
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
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
          console.log(`Invalid score detected (${result.overview.score}), setting to null`)
          result.overview.score = null
        }
      }

      return result
    } catch (parseError) {
      console.error(`Error parsing OpenAI response as JSON:`, parseError)

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
    console.error(`Error analyzing extracted text:`, error)
    throw error
  }
}

/**
 * Process image of credit report
 */
export async function analyzeImageContent(imageBase64: string, userId: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  console.log("Starting image analysis...")

  try {
    // For images, we can use the Vision API directly
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
            role: "system",
            content:
              "You are an expert credit analyst. Analyze this credit report image thoroughly and extract all relevant information. Return ONLY valid JSON without any markdown or code blocks.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this credit report image and provide a detailed analysis in the following JSON format:
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

IMPORTANT: If no credit score is found in the report, set "score" to null, not a number. DO NOT MAKE UP DATA.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                  detail: "high",
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
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
          console.log(`Invalid score detected (${result.overview.score}), setting to null`)
          result.overview.score = null
        }
      }

      return {
        success: true,
        result,
        analysisId: uuidv4(),
      }
    } catch (parseError) {
      console.error(`Error parsing OpenAI response as JSON:`, parseError)
      return {
        success: false,
        error: "Failed to parse analysis results",
        rawResponse: aiResponse,
      }
    }
  } catch (error) {
    console.error("Error in image analysis:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error in image analysis",
    }
  }
}

/**
 * Process text content of credit report
 */
export async function analyzeTextContent(text: string, userId: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  console.log("Starting text analysis...")

  try {
    // For text, we can analyze directly
    const analysis = await analyzeExtractedText(text, userId)

    return {
      success: true,
      result: analysis,
      analysisId: uuidv4(),
    }
  } catch (error) {
    console.error("Error in text analysis:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error in text analysis",
    }
  }
}

/**
 * Enhanced chat function for credit insights
 */
export async function generateCreditChatResponse(
  userId: string,
  analysisId: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  analysisResult: any,
) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  try {
    // Create a system prompt with the analysis context
    const systemPrompt = `
You are a helpful credit assistant. You have analyzed the user's credit report and have the following information:

Credit Score: ${analysisResult.overview?.score || "Unknown"}
Summary: ${analysisResult.overview?.summary || "No summary available"}
Positive Factors: ${JSON.stringify(analysisResult.overview?.positiveFactors || [])}
Negative Factors: ${JSON.stringify(analysisResult.overview?.negativeFactors || [])}
Disputes: ${JSON.stringify(analysisResult.disputes?.items || [])}
Credit Hacks: ${JSON.stringify(analysisResult.creditHacks?.recommendations || [])}
Side Hustles: ${JSON.stringify(analysisResult.sideHustles?.recommendations || [])}

Use this information to provide helpful, personalized responses to the user's questions about their credit. 
Be concise, friendly, and informative. If you don't know something, admit it rather than making up information.
`

    // Use fetch to call OpenAI API
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return {
      success: true,
      response: data.choices[0].message.content || "",
    }
  } catch (error) {
    console.error(`Error generating chat response:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
