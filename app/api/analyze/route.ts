import type { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { createNotification } from "@/lib/notifications"
import { analyzeCreditReportDirect } from "@/lib/openai-direct"
import { withErrorHandler } from "@/lib/error-handling"
import { createSuccessResponse, createErrorResponse } from "@/lib/api-patterns"

// Add this configuration at the top of the file, after the imports
export const config = {
  runtime: "nodejs",
  maxDuration: 60, // Extends timeout to 60 seconds
}

async function handler(request: NextRequest) {
  console.log("Analyze API called - using direct OpenAI integration")

  // Verify OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key is not configured")
    return createErrorResponse(
      "OpenAI API key is not configured. Please add it to your environment variables.",
      "MISSING_API_KEY",
      null,
      { statusCode: 500 },
    )
  }

  // Get the current user
  const authHeader = request.headers.get("authorization")
  if (!authHeader) {
    console.error("No authorization header provided")
    return createErrorResponse("Unauthorized", "UNAUTHORIZED", null, { statusCode: 401 })
  }

  const token = authHeader.split(" ")[1]
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    console.error("Authentication error:", authError)
    return createErrorResponse("Unauthorized", "UNAUTHORIZED", authError, { statusCode: 401 })
  }

  console.log("User authenticated:", user.id)

  // Get request body
  let body
  try {
    body = await request.json()
  } catch (parseError) {
    console.error("Error parsing request body:", parseError)
    return createErrorResponse("Invalid JSON in request body", "INVALID_JSON", parseError, { statusCode: 400 })
  }

  const { analysisId, text } = body

  // Add a size check after parsing the request body
  if (text && text.length > 1000000) {
    // 1MB text limit
    console.error("Text too large:", text.length, "characters")
    return createErrorResponse(
      "Text too large. Please limit to 1MB.",
      "TEXT_TOO_LARGE",
      { size: text.length },
      { statusCode: 400 },
    )
  }

  if (!text) {
    console.error("Missing required text field")
    return createErrorResponse("Missing required text field", "MISSING_FIELD", null, { statusCode: 400 })
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

  // Process the text directly with OpenAI
  // We'll create a text file buffer from the text
  const textEncoder = new TextEncoder()
  const fileBuffer = textEncoder.encode(text).buffer

  const analysisResult = await analyzeCreditReportDirect(fileBuffer, "manual-text.txt", "text/plain", user.id)

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

    return createErrorResponse(
      "Failed to analyze credit report",
      "ANALYSIS_FAILED",
      { details: analysisResult.error, analysisId: analysisResult.analysisId },
      { statusCode: 500 },
    )
  }

  console.log("Analysis completed successfully")

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
      console.log("Stored credit score in database")
    }
  } catch (scoreError) {
    console.error("Error storing credit score:", scoreError)
  }

  return createSuccessResponse({
    success: true,
    analysisId: analysisResult.analysisId,
    directResult: analysisResult.result,
  })
}

// Wrap the handler with our error handler
export const POST = withErrorHandler(handler)
