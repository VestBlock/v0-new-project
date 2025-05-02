import { type NextRequest, NextResponse } from "next/server"
import { analyzePdfContent, analyzeImageContent, analyzeTextContent } from "@/lib/openai-credit-analyzer"
import { createClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notifications"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  console.log("[ANALYZE-CREDIT-REPORT] API route called")
  const startTime = performance.now()

  try {
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return NextResponse.json({ success: false, error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("[ANALYZE-CREDIT-REPORT] User authenticated:", user.id)

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Create a notification for the user that analysis is starting
    try {
      await createNotification({
        userId: user.id,
        title: "Credit Report Analysis Started",
        message: "Your credit report is being analyzed. This may take a minute or two.",
        type: "info",
      })
    } catch (notifError) {
      console.error("Failed to create start notification:", notifError)
      // Continue anyway, this is not critical
    }

    let analysisResult

    // Handle different input types
    if (body.fileData) {
      const fileData = body.fileData

      // Determine file type from data URL
      if (fileData.startsWith("data:image")) {
        console.log("[ANALYZE-CREDIT-REPORT] Processing image file")
        analysisResult = await analyzeImageContent(fileData, user.id)
      } else if (fileData.startsWith("data:application/pdf")) {
        console.log("[ANALYZE-CREDIT-REPORT] Processing PDF file")
        analysisResult = await analyzePdfContent(fileData, user.id)
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Unsupported file type. Please upload a PDF or image file.",
          },
          { status: 400 },
        )
      }
    } else if (body.textContent) {
      console.log("[ANALYZE-CREDIT-REPORT] Processing text content")
      analysisResult = await analyzeTextContent(body.textContent, user.id)
    } else {
      return NextResponse.json({ success: false, error: "Missing required file or text content" }, { status: 400 })
    }

    if (!analysisResult.success) {
      console.error("Analysis failed:", analysisResult.error)

      // Create an error notification for the user
      try {
        await createNotification({
          userId: user.id,
          title: "Analysis Failed",
          message: `We encountered an error analyzing your credit report: ${analysisResult.error}. Please try again.`,
          type: "error",
        })
      } catch (notifError) {
        console.error("Failed to create error notification:", notifError)
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to analyze credit report",
          details: analysisResult.error,
        },
        { status: 500 },
      )
    }

    console.log("[ANALYZE-CREDIT-REPORT] Analysis completed successfully")

    // Store the analysis result in the database
    try {
      await supabase.from("analyses").insert({
        id: analysisResult.analysisId,
        user_id: user.id,
        file_name: body.fileName || "credit-report",
        status: "completed",
        result: analysisResult.result,
        created_at: new Date().toISOString(),
      })
    } catch (dbError) {
      console.error("Error storing analysis result:", dbError)
      // Continue anyway, we can still return the result to the user
    }

    // Create a success notification for the user
    try {
      await createNotification({
        userId: user.id,
        title: "Credit Analysis Complete",
        message:
          analysisResult.result.overview.score !== null
            ? `Your credit analysis is ready. Your credit score is ${analysisResult.result.overview.score}.`
            : "Your credit analysis is ready. We couldn't determine a specific score from your report.",
        type: "success",
      })
    } catch (notificationError) {
      console.error("Failed to create success notification:", notificationError)
    }

    // Store the credit score in the credit_scores table ONLY if it's a valid score
    try {
      if (
        analysisResult.result.overview.score !== null &&
        analysisResult.result.overview.score >= 300 &&
        analysisResult.result.overview.score <= 850
      ) {
        await supabase.from("credit_scores").insert({
          user_id: user.id,
          bureau: "AI Estimate", // Since this is an AI estimate
          score: analysisResult.result.overview.score,
          date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
          source: "VestBlock Analysis",
          notes: "Score estimated from credit report analysis",
        })
        console.log("[ANALYZE-CREDIT-REPORT] Stored credit score in database")
      }
    } catch (scoreError) {
      console.error("Error storing credit score:", scoreError)
    }

    const endTime = performance.now()

    return NextResponse.json({
      success: true,
      analysisId: analysisResult.analysisId,
      result: analysisResult.result,
      processingTimeMs: Math.round(endTime - startTime),
    })
  } catch (error) {
    console.error("[ANALYZE-CREDIT-REPORT] API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
