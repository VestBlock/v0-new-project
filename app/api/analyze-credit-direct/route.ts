import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60 // Set maximum duration to 60 seconds

interface StructuredAnalysisResponse {
  summary: string
  detailedAnalysis: {
    creditScore?: {
      score: number | null
      rating: string
      factors: string[]
    }
    accounts: {
      total: number
      negative: number
      positive: number
      details: any[]
    }
    negativeItems: any[]
    inquiries: any[]
    recommendations: string[]
    roadmap?: {
      timeline: string
      phases: Array<{
        phase: string
        duration: string
        steps: string[]
        milestones: string[]
      }>
    }
  }
  letterContent?: string
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const { reportText, analysisType, generateLetter, letterType, financialGoal } = await req.json()

    // Validate input
    if (!reportText || reportText.trim().length < 10) {
      return NextResponse.json({ error: "Invalid report text. Please provide a valid credit report." }, { status: 400 })
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Create a system message with structured output instructions
    const systemMessage = `You are a credit analysis expert specializing in credit repair and financial planning. 
Analyze the credit report and provide a structured response in the following JSON format:

{
  "summary": "A concise summary of the overall credit situation",
  "detailedAnalysis": {
    "creditScore": {
      "score": 123, // Numeric score if found, or null if not found
      "rating": "Good/Fair/Poor/etc.",
      "factors": ["Factor 1 affecting score", "Factor 2", "..."]
    },
    "accounts": {
      "total": 5, // Total number of accounts
      "negative": 1, // Number of negative accounts
      "positive": 4, // Number of positive accounts
      "details": [
        {
          "creditor": "Bank Name",
          "type": "Credit Card/Loan/etc.",
          "balance": "$1,000",
          "status": "Current/Late/etc.",
          "opened": "Date opened",
          "lastReported": "Date last reported"
        }
      ]
    },
    "negativeItems": [
      {
        "creditor": "Creditor Name",
        "type": "Collection/Late Payment/etc.",
        "details": "Details about the negative item",
        "disputeStrategy": "Recommended strategy for disputing this item"
      }
    ],
    "inquiries": [
      {
        "creditor": "Inquiry Source",
        "date": "Date of inquiry",
        "type": "Hard/Soft"
      }
    ],
    "recommendations": [
      "Recommendation 1",
      "Recommendation 2",
      "..."
    ]
  }
}

If a letter is requested, also include:
{
  "letterContent": "Full text of the requested letter"
}

If information for any field is not available, use reasonable defaults or placeholder values. For credit score, use null if not found.
Ensure your response is valid JSON that can be parsed.`

    // Create a prompt based on the analysis type
    let prompt = `Analyze the following credit report text and provide insights:`

    switch (analysisType) {
      case "comprehensive":
        prompt = `Perform a comprehensive analysis of the following credit report. Include insights about the credit score, accounts, negative items, and recommendations for improvement.`
        break
      case "score-focused":
        prompt = `Analyze the following credit report with a focus on the credit score. Identify the factors affecting the score and provide recommendations to improve it.`
        break
      case "dispute-opportunities":
        prompt = `Analyze the following credit report and identify potential items that could be disputed. Provide strategies for disputing these items.`
        break
      case "improvement-plan":
        prompt = `Create an improvement plan based on the following credit report. Provide actionable steps to improve the credit score and overall financial health.`
        break
    }

    // Add financial goal context if provided
    if (financialGoal) {
      prompt += `\n\nThe user's financial goal is: ${financialGoal.title}${
        financialGoal.customDetails ? ` (${financialGoal.customDetails})` : ""
      }. Tailor your analysis and recommendations to help achieve this goal.`

      // Add roadmap request for financial goals
      prompt += `\n\nAlso include a roadmap section in your response with a timeline and phases to achieve this financial goal.`
    }

    // Add letter generation request if needed
    if (generateLetter) {
      prompt += `\n\nAlso, generate a ${letterType} letter based on the information in the credit report.`
    }

    // Truncate report text if it's too long
    const maxLength = 15000
    const truncatedText =
      reportText.length > maxLength
        ? reportText.substring(0, maxLength) + "... [text truncated due to length]"
        : reportText

    // Append the report text to the prompt
    prompt += `\n\nCREDIT REPORT:\n${truncatedText}`

    // Call the OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    })

    // Check for API errors
    if (!response.ok) {
      const errorText = await response.text()
      console.error("OpenAI API error:", response.status, errorText)
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}`, details: errorText },
        { status: response.status },
      )
    }

    // Parse the response
    const data = await response.json()

    // Extract the analysis from the response
    const analysisText = data.choices[0]?.message?.content || "{}"

    try {
      // Parse the JSON response
      const analysisJson = JSON.parse(analysisText)

      // Return the structured analysis
      return NextResponse.json({
        ...analysisJson,
        tokens: data.usage,
        rawResponse: analysisText,
      })
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError)

      // If JSON parsing fails, create a fallback structured response
      const fallbackResponse: StructuredAnalysisResponse = {
        summary: analysisText.substring(0, 500) + (analysisText.length > 500 ? "..." : ""),
        detailedAnalysis: {
          creditScore: {
            score: null,
            rating: "Unknown",
            factors: ["Unable to extract structured data from the analysis"],
          },
          accounts: {
            total: 0,
            negative: 0,
            positive: 0,
            details: [],
          },
          negativeItems: [],
          inquiries: [],
          recommendations: [
            "Please try again with a more detailed credit report",
            "Consider manually entering your credit score and account information",
            "Contact support if this issue persists",
          ],
        },
      }

      return NextResponse.json({
        ...fallbackResponse,
        tokens: data.usage,
        rawResponse: analysisText,
        parsingError: "Failed to parse structured data from the API response",
      })
    }
  } catch (error) {
    console.error("Error in analyze-credit-direct API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
