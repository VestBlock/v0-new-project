import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const analysisType = formData.get("analysisType") as string
    const generateLetter = formData.get("generateLetter") === "true"
    const letterType = formData.get("letterType") as string
    const prioritizeNegativeRemoval = formData.get("prioritizeNegativeRemoval") === "true"
    const generateRoadmap = formData.get("generateRoadmap") === "true"
    const financialGoalJson = formData.get("financialGoal") as string

    let financialGoal = null
    if (financialGoalJson) {
      try {
        financialGoal = JSON.parse(financialGoalJson)
      } catch (e) {
        console.error("Failed to parse financial goal:", e)
      }
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size (15MB limit for direct upload)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 15MB limit" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Create a comprehensive system prompt (same as the enhanced analysis)
    let systemPrompt = `You are an expert credit analyst and financial advisor specializing in credit repair and financial planning. 
Analyze the provided credit report document and extract key information.

The user has requested a ${analysisType} analysis.
${generateLetter ? `They also want a ${letterType} letter.` : ""}
${prioritizeNegativeRemoval ? "Prioritize identifying negative items that can be removed." : ""}
${financialGoal ? `The user's financial goal is: ${financialGoal.title}. ${financialGoal.customDetails ? `Additional details: ${financialGoal.customDetails}` : ""}` : ""}

Your response must be in JSON format with the following structure:
{
  "summary": "string",
  "detailedAnalysis": {
    "creditScore": {
      "score": number | null,
      "rating": "string",
      "factors": ["string"]
    },
    "accounts": {
      "total": number,
      "positive": number,
      "negative": number,
      "details": [
        {
          "creditor": "string",
          "type": "string",
          "status": "string",
          "balance": "string",
          "opened": "string",
          "lastReported": "string"
        }
      ]
    },
    "negativeItems": [
      {
        "creditor": "string",
        "type": "string",
        "details": "string",
        "disputeStrategy": "string"
      }
    ],
    "inquiries": [
      {
        "creditor": "string",
        "date": "string",
        "impact": "string"
      }
    ],
    "recommendations": ["string"]`

    // Add roadmap generation if requested and financial goal is provided
    if (generateRoadmap && financialGoal) {
      systemPrompt += `,
    "roadmap": {
      "timeline": "string",
      "phases": [
        {
          "phase": "string",
          "duration": "string", 
          "steps": ["string"],
          "milestones": ["string"]
        }
      ]`

      // Add specific sections based on the financial goal
      if (
        financialGoal.id === "real-estate" ||
        financialGoal.id === "start-business" ||
        financialGoal.id === "secure-funding"
      ) {
        systemPrompt += `,
      "fundingOptions": [
        {
          "type": "string",
          "description": "string",
          "requirements": ["string"],
          "pros": ["string"],
          "cons": ["string"]
        }
      ]`
      }

      if (financialGoal.id === "start-business" || financialGoal.id === "real-estate") {
        systemPrompt += `,
      "businessSetup": {
        "steps": ["string"],
        "timeline": "string",
        "benefits": ["string"]
      }`
      }

      systemPrompt += `
    }`
    }

    systemPrompt += `
  }
}`

    // Add letter generation if requested
    if (generateLetter) {
      systemPrompt += `

Additionally, generate a ${letterType} letter based on the credit report. Add this to your JSON response as:
"letterContent": "string"
`
    }

    // Add detailed financial goal specific guidance (same as enhanced analysis)
    if (financialGoal && generateRoadmap) {
      systemPrompt += `

IMPORTANT: Generate a comprehensive roadmap for achieving the goal "${financialGoal.title}". The roadmap should include detailed, actionable steps with specific timelines and funding options.`

      if (financialGoal.id === "real-estate") {
        systemPrompt += `

For real estate investment/purchase, include:
- Conventional, FHA, VA, and hard money loan options
- Business entity setup for real estate (LLC formation, EIN process)
- Business credit establishment strategies
- 0% interest business financing options
- Down payment and closing cost strategies
- Property analysis and investment strategies`
      } else if (financialGoal.id === "start-business") {
        systemPrompt += `

For business startup, include:
- Complete business entity formation process
- EIN application and business registration
- Business credit establishment separate from personal credit
- SBA loans, business credit cards, and alternative funding
- 0% interest business credit options
- Business plan and legal requirements`
      }
    }

    // Convert file to base64 for OpenAI API
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    // Call the OpenAI API with vision capabilities for PDF analysis
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this credit report document and provide a comprehensive analysis based on the requirements.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("OpenAI API error:", errorData)
      return NextResponse.json(
        {
          error: "Failed to analyze PDF directly",
          details: `OpenAI API error: ${response.status}`,
        },
        { status: 500 },
      )
    }

    const data = await response.json()
    const responseContent = data.choices[0]?.message?.content || ""

    try {
      // Parse the JSON response
      const jsonResponse = JSON.parse(responseContent)

      // Return the analysis result
      return NextResponse.json({
        ...jsonResponse,
        rawResponse: responseContent,
        extractedText: "Text extracted directly by OpenAI from PDF",
      })
    } catch (error) {
      console.error("Failed to parse OpenAI response:", error)
      return NextResponse.json(
        {
          error: "Failed to parse analysis result",
          details: "The AI returned an invalid response format",
          rawResponse: responseContent,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Direct PDF analysis error:", error)
    return NextResponse.json(
      {
        error: "Failed to analyze PDF directly",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
