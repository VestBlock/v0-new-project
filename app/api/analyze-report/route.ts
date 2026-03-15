import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createChatCompletion } from "@/lib/openai-service" // Assuming this is your OpenAI service
import type { Database, RoadmapData } from "@/types/supabase" // Import RoadmapData

export const runtime = "nodejs" // or 'edge' if your OpenAI and Supabase libs support it
export const maxDuration = 60 // Changed from 180 to 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "CRITICAL: Supabase URL or Service Key is not defined in /api/analyze-report. Database operations will fail.",
  )
}

// Helper function to generate the roadmap prompt
function getRoadmapGenerationPrompt(analysisText: string): string {
  return `Based on the following credit report analysis, generate a personalized, actionable credit improvement roadmap.

Credit Report Analysis:
"""
${analysisText}
"""

The roadmap should be structured as a JSON object. The root object should have a key "steps", which is an array of roadmap step objects.
Each step object MUST include the following keys:
- "id": A unique string identifier for the step (e.g., "step_1", "step_2").
- "title": A concise, actionable title for the step (e.g., "Reduce balance on Visa card ending 1234").
- "description": A more detailed explanation of the step, why it's important, and how to approach it.
- "category": One of the following strings: "Credit Utilization", "Debt Management", "Payment History", "Dispute Resolution", "Credit Building", "Credit Mix", "Inquiries".
- "priority": One of the following strings: "High", "Medium", "Low".
- "status": Default this to "Pending".

Example of a single step object:
{
  "id": "step_1",
  "title": "Lower Credit Utilization on Card X",
  "description": "Your Card X (ending 4567) has a utilization of 85% ($4250/$5000). High utilization negatively impacts your score. Aim to pay down the balance to below 30% ($1500). Consider making more than the minimum payment or a lump sum payment if possible.",
  "category": "Credit Utilization",
  "priority": "High",
  "status": "Pending"
}

Generate between 3 to 7 clear and impactful steps. Focus on the most critical areas identified in the analysis.
Ensure the output is ONLY the valid JSON object as described. Do not include any other text or explanations outside the JSON.`
}

export async function POST(request: NextRequest) {
  const supabase = supabaseUrl && supabaseServiceKey ? createClient<Database>(supabaseUrl, supabaseServiceKey) : null
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error: Supabase client could not be initialized." },
      { status: 500 },
    )
  }

  let userIdFromRequest: string | undefined
  let reportRecordId: string | undefined
  let roadmapRecordId: string | undefined

  try {
    const { reportText, question, clientUserId } = await request.json()
    userIdFromRequest = clientUserId

    if (!reportText) {
      return NextResponse.json({ error: "Report text is required" }, { status: 400 })
    }
    if (!question) {
      // This question is for the initial broad analysis
      return NextResponse.json({ error: "An initial question for analysis is required" }, { status: 400 })
    }
    if (!userIdFromRequest) {
      // Make userId mandatory for saving reports and roadmaps
      return NextResponse.json({ error: "User ID (clientUserId) is required" }, { status: 400 })
    }

    console.log(
      `[API /analyze-report] Stage 1: Auto-analyzing credit report for user: ${userIdFromRequest}, Text length: ${reportText.length}`,
    )

    const initialSystemMessage = {
      role: "system",
      content: `You are a credit report analysis expert. Analyze the provided credit report thoroughly.
      Your analysis should be comprehensive, covering:
      1.  A concise overall summary of the credit profile.
      2.  Credit Score (if explicitly mentioned in the report, state the score and bureau. If not, state "Credit score not found in report.").
      3.  Account Summary: Total accounts, number of positive accounts, number of negative/derogatory accounts.
      4.  Negative Items: List all negative items (collections, charge-offs, late payments, bankruptcies, liens, judgments). For each, include creditor name, account number (if available), amount, date of delinquency/status, and current status. If none, state "No negative items found."
      5.  Inquiries: List recent hard inquiries (last 2 years), including creditor name and date. If none, state "No recent hard inquiries found."
      6.  Public Records: List any public records found. If none, state "No public records found."
      7.  Actionable Recommendations: Provide specific, actionable steps the user can take to improve their credit based on THIS report.
      Structure your response clearly with headings for each section (e.g., "## Overall Summary", "## Negative Items"). Be factual and base everything on the provided text. If information is not present for a section, explicitly state that.`,
    }
    const initialUserMessage = {
      role: "user",
      content: `Please analyze the following credit report based on my question.\n\nCredit Report Text:\n"""${reportText}"""\n\nMy Question: """${question}"""`,
    }
    const initialMessages = [initialSystemMessage, initialUserMessage]

    const aiResponse = await createChatCompletion(initialMessages, false, { temperature: 0.2 }) // Lower temp for factual analysis

    if (aiResponse instanceof Response) {
      console.error("[API /analyze-report] Unexpected streaming response from AI service for initial analysis")
      return NextResponse.json({ error: "Unexpected streaming response from AI service" }, { status: 500 })
    }

    const analysisText = aiResponse.choices[0]?.message?.content || "Failed to generate initial analysis."
    if (analysisText === "Failed to generate initial analysis.") {
      throw new Error("Initial AI analysis failed to produce content.")
    }

    console.log(
      `[API /analyze-report] Stage 1: Analysis text generated. Length: ${analysisText.length}. Storing in credit_reports.`,
    )
    const { data: reportDbData, error: reportDbError } = await supabase
      .from("credit_reports")
      .insert({
        user_id: userIdFromRequest, // Ensure user_id is correctly passed and is NOT NULL in your table
        report_text: reportText,
        ai_analysis: analysisText, // This is the general text analysis
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (reportDbError || !reportDbData) {
      console.error("[API /analyze-report] Supabase error storing initial analysis in credit_reports:", reportDbError)
      throw new Error(reportDbError?.message || "Failed to store initial analysis.")
    }
    reportRecordId = reportDbData.id
    console.log(
      `[API /analyze-report] Stage 1: Initial analysis stored in Supabase (credit_reports) for user: ${userIdFromRequest}, DB ID: ${reportRecordId}`,
    )

    // --- Stage 2: Generate Personalized Roadmap ---
    console.log(`[API /analyze-report] Stage 2: Generating personalized roadmap for report ID: ${reportRecordId}`)

    const roadmapPrompt = getRoadmapGenerationPrompt(analysisText)
    const roadmapMessages = [
      {
        role: "system",
        content:
          "You are an expert financial advisor. Your task is to generate a structured JSON roadmap for credit improvement based on the provided analysis. Adhere strictly to the JSON format requested.",
      },
      { role: "user", content: roadmapPrompt },
    ]

    const roadmapAiResponse = await createChatCompletion(roadmapMessages, true, {
      temperature: 0.3,
      response_format: { type: "json_object" },
    }) // Request JSON output

    if (roadmapAiResponse instanceof Response) {
      console.error("[API /analyze-report] Unexpected streaming response from AI service for roadmap generation")
      // Potentially update credit_reports with an error status for roadmap generation
      throw new Error("Unexpected streaming response from AI for roadmap generation.")
    }

    const roadmapJsonString = roadmapAiResponse.choices[0]?.message?.content
    if (!roadmapJsonString) {
      console.error("[API /analyze-report] Roadmap AI response content is empty.")
      throw new Error("Roadmap generation AI returned empty content.")
    }

    let roadmapData: RoadmapData
    try {
      roadmapData = JSON.parse(roadmapJsonString)
      // Basic validation of the parsed JSON structure
      if (!roadmapData.steps || !Array.isArray(roadmapData.steps)) {
        throw new Error("Roadmap JSON is missing 'steps' array or is not valid.")
      }
      // Add more validation for step properties if needed
      roadmapData.steps.forEach((step) => {
        if (!step.id || !step.title || !step.description || !step.category || !step.priority || !step.status) {
          console.warn("[API /analyze-report] A roadmap step is missing required fields:", step)
          // Decide if this should be a hard error or if you can proceed with partial data / defaults
        }
      })
    } catch (parseError: any) {
      console.error("[API /analyze-report] Failed to parse roadmap JSON from AI:", parseError.message)
      console.error("[API /analyze-report] Raw AI response for roadmap:", roadmapJsonString)
      // Potentially update credit_reports with an error status for roadmap generation
      throw new Error(
        `Failed to parse roadmap JSON: ${parseError.message}. Raw response: ${roadmapJsonString.substring(0, 100)}...`,
      )
    }

    console.log(
      `[API /analyze-report] Stage 2: Roadmap JSON generated and parsed. Storing in credit_improvement_roadmaps.`,
    )
    const { data: roadmapDbData, error: roadmapDbError } = await supabase
      .from("credit_improvement_roadmaps")
      .insert({
        user_id: userIdFromRequest,
        credit_report_id: reportRecordId,
        roadmap_data: roadmapData, // Store the parsed JSON object
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (roadmapDbError || !roadmapDbData) {
      console.error("[API /analyze-report] Supabase error storing roadmap:", roadmapDbError)
      // Potentially update credit_reports with an error status for roadmap generation
      throw new Error(roadmapDbError?.message || "Failed to store personalized roadmap.")
    }
    roadmapRecordId = roadmapDbData.id
    console.log(
      `[API /analyze-report] Stage 2: Personalized roadmap stored in Supabase (credit_improvement_roadmaps) for user: ${userIdFromRequest}, DB ID: ${roadmapRecordId}`,
    )

    return NextResponse.json({
      message: "Credit report analyzed and personalized roadmap generated successfully.",
      reportId: reportRecordId, // ID from credit_reports table
      roadmapId: roadmapRecordId, // ID from credit_improvement_roadmaps table
      initialAnalysis: analysisText, // The general text analysis
      // Do NOT return the full roadmapData here to keep response lighter; client will fetch it.
      tokens: {
        // Example, adjust based on your actual token usage tracking
        initialAnalysisPrompt: aiResponse.usage?.prompt_tokens,
        initialAnalysisCompletion: aiResponse.usage?.completion_tokens,
        roadmapPrompt: roadmapAiResponse.usage?.prompt_tokens,
        roadmapCompletion: roadmapAiResponse.usage?.completion_tokens,
      },
    })
  } catch (error: any) {
    console.error("[API /analyze-report] General Error:", error.message, error.stack)
    // If reportRecordId exists but roadmap failed, you might want to log this association or clean up.
    return NextResponse.json(
      { error: "Failed to process credit report and generate roadmap", details: error.message || String(error) },
      { status: 500 },
    )
  }
}
