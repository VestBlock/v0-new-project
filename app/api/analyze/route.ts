import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeCredit } from "@/lib/openai-realtime-service"
import { createNotification } from "@/lib/notifications"
import { NextResponse } from "next/server"

// Configure for longer execution time
export const config = {
  runtime: "nodejs",
  maxDuration: 300, // 5 minutes for thorough analysis
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
  console.log("[ANALYZE] API route called")
  const startTime = performance.now()

  try {
    // Verify Supabase client is available
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 })
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

    console.log("[ANALYZE] User authenticated:", user.id)

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Check if this is a retry of an existing analysis
    if (body.analysisId) {
      console.log(`[ANALYZE] Retrying analysis: ${body.analysisId}`)

      // Get the existing analysis
      const { data: existingAnalysis, error: fetchError } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", body.analysisId)
        .eq("user_id", user.id)
        .single()

      if (fetchError || !existingAnalysis) {
        console.error("Error fetching existing analysis:", fetchError)
        return NextResponse.json({ success: false, error: "Analysis not found or access denied" }, { status: 404 })
      }

      // Create a notification for the user that analysis is restarting
      try {
        await createNotification({
          userId: user.id,
          title: "Analysis Retry Started",
          message: "Your credit report is being re-analyzed with real-time AI.",
          type: "info",
        })
      } catch (notifError) {
        console.error("Failed to create start notification:", notifError)
        // Continue anyway, this is not critical
      }

      // Use the existing OCR text if available
      if (existingAnalysis.ocr_text) {
        const textEncoder = new TextEncoder()
        const fileBuffer = textEncoder.encode(existingAnalysis.ocr_text).buffer
        const fileName = existingAnalysis.file_path || "retry-analysis.txt"

        // Process with our real-time OpenAI service
        const analysisResult = await analyzeCredit(fileBuffer, fileName, user.id, {
          signal: AbortSignal.timeout(280000), // 280 second timeout
        })

        if (!analysisResult.success) {
          console.error("Retry analysis failed:", analysisResult.error)

          // Create an error notification for the user
          try {
            await createNotification({
              userId: user.id,
              title: "Retry Analysis Failed",
              message: `We encountered an error re-analyzing your credit report: ${analysisResult.error.message}. Please try again.`,
              type: "error",
            })
          } catch (notifError) {
            console.error("Failed to create error notification:", notifError)
          }

          return NextResponse.json(
            {
              success: false,
              error: "Failed to re-analyze credit report",
              details: analysisResult.error,
              analysisId: body.analysisId,
            },
            { status: 500 },
          )
        }

        console.log("[ANALYZE] Retry analysis completed successfully")

        // Create a success notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Retry Analysis Complete",
            message: "Your credit report has been re-analyzed successfully.",
            type: "success",
          })
        } catch (notificationError) {
          console.error("Failed to create success notification:", notificationError)
        }

        const endTime = performance.now()

        return NextResponse.json({
          success: true,
          analysisId: body.analysisId,
          result: analysisResult.result,
          metrics: {
            ...analysisResult.metrics,
            totalProcessingTimeMs: Math.round(endTime - startTime),
          },
        })
      } else {
        return NextResponse.json({ success: false, error: "No OCR text available for retry" }, { status: 400 })
      }
    }

    // Handle text input
    if (body.text) {
      console.log("[ANALYZE] Processing text input")

      // Create a notification for the user that  {
      console.log("[ANALYZE] Processing text input")

      // Create a notification for the user that analysis is starting
      try {
        await createNotification({
          userId: user.id,
          title: "Credit Report Analysis Started",
          message: "Your credit report is being analyzed with real-time AI. This may take a few minutes.",
          type: "info",
        })
      } catch (notifError) {
        console.error("Failed to create start notification:", notifError)
        // Continue anyway, this is not critical
      }

      // Convert text to buffer
      const textEncoder = new TextEncoder()
      const fileBuffer = textEncoder.encode(body.text).buffer
      const fileName = "manual-text.txt"

      // Process with our real-time OpenAI service
      const analysisResult = await analyzeCredit(fileBuffer, fileName, user.id, {
        signal: AbortSignal.timeout(280000), // 280 second timeout
      })

      if (!analysisResult.success) {
        console.error("Analysis failed:", analysisResult.error)

        // Create an error notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Analysis Failed",
            message: `We encountered an error analyzing your credit report: ${analysisResult.error.message}. Please try again.`,
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
            analysisId: analysisResult.analysisId,
          },
          { status: 500 },
        )
      }

      console.log("[ANALYZE] Text analysis completed successfully")

      // Create a success notification for the user
      try {
        await createNotification({
          userId: user.id,
          title: "Credit Analysis Complete",
          message: "Your credit report has been analyzed with real-time AI.",
          type: "success",
        })
      } catch (notificationError) {
        console.error("Failed to create success notification:", notificationError)
      }

      const endTime = performance.now()

      return NextResponse.json({
        success: true,
        analysisId: analysisResult.analysisId,
        result: analysisResult.result,
        metrics: {
          ...analysisResult.metrics,
          totalProcessingTimeMs: Math.round(endTime - startTime),
        },
      })
    }

    // If we get here, no valid input was provided
    return NextResponse.json({ success: false, error: "Missing required text field" }, { status: 400 })
  } catch (error) {
    console.error("[ANALYZE] API error:", error)
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
