import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeCreditReportWithAI } from "@/lib/openai-credit-service"
import { createNotification } from "@/lib/notifications"
import { sanitizeForJson } from "@/lib/json-utils"
import { NextResponse } from "next/server"

// Configure for longer execution time
export const config = {
  runtime: "nodejs",
  maxDuration: 120, // 2 minutes for thorough analysis
}

// Create Supabase client with safety checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
let supabase: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error)
  }
}

export async function POST(request: NextRequest) {
  console.log("[ANALYZE-CREDIT] API route called")
  const startTime = performance.now()

  try {
    // Verify Supabase client is available
    if (!supabase) {
      return Response.json({ success: false, error: "Database connection unavailable" }, { status: 500 })
    }

    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return Response.json({ success: false, error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("[ANALYZE-CREDIT] User authenticated:", user.id)

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return Response.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Validate input
    if (!body.text) {
      const base64Data = body.fileData?.split(";base64,").pop()
      if (!body.fileData) {
        console.error("Missing required file or text field")
        return Response.json({ success: false, error: "Missing required file or text field" }, { status: 400 })
      }
    }

    // Handle file upload or text input
    let fileBuffer: ArrayBuffer
    let fileName: string
    let cacheKey: string | undefined

    if (body.fileData) {
      // Process base64 file data
      try {
        const base64Data = body.fileData.split(";base64,").pop()
        fileBuffer = Buffer.from(base64Data, "base64")
        fileName = body.fileName || "uploaded-file.pdf"

        // Create a hash of the file for caching
        const crypto = require("crypto")
        const fileHash = crypto.createHash("md5").update(Buffer.from(fileBuffer)).digest("hex")
        cacheKey = `${user.id}:file:${fileHash}`
      } catch (fileError) {
        console.error("Error processing file data:", fileError)
        return Response.json({ success: false, error: "Invalid file data" }, { status: 400 })
      }
    } else if (body.text) {
      // Process text input
      const textEncoder = new TextEncoder()
      fileBuffer = textEncoder.encode(body.text).buffer
      fileName = "manual-text.txt"

      // Create a hash of the text for caching
      const crypto = require("crypto")
      const textHash = crypto.createHash("md5").update(body.text).digest("hex")
      cacheKey = `${user.id}:text:${textHash}`
    } else {
      console.error("Missing required file or text field")
      return Response.json({ success: false, error: "Missing required file or text field" }, { status: 400 })
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

    // Process with our optimized OpenAI service
    const analysisResult = await analyzeCreditReportWithAI(fileBuffer, fileName, user.id, {
      cacheKey,
      signal: AbortSignal.timeout(110000), // 110 second timeout (slightly less than route timeout)
    })

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

      return Response.json(
        {
          success: false,
          error: "Failed to analyze credit report",
          details: analysisResult.error,
          analysisId: analysisResult.analysisId,
          metrics: analysisResult.metrics,
        },
        { status: 500 },
      )
    }

    console.log("[ANALYZE-CREDIT] Analysis completed successfully")

    // Store the analysis result in the database
    try {
      await supabase.from("analyses").insert({
        id: analysisResult.analysisId,
        user_id: user.id,
        file_name: fileName,
        status: "completed",
        result: sanitizeForJson(analysisResult.result),
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
        console.log("[ANALYZE-CREDIT] Stored credit score in database")
      }
    } catch (scoreError) {
      console.error("Error storing credit score:", scoreError)
    }

    const endTime = performance.now()

    return Response.json({
      success: true,
      analysisId: analysisResult.analysisId,
      result: analysisResult.result,
      metrics: {
        ...analysisResult.metrics,
        totalProcessingTimeMs: Math.round(endTime - startTime),
      },
    })
  } catch (error) {
    console.error("[ANALYZE-CREDIT] API error:", error)
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
