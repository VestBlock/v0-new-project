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

// Helper function to create standardized error responses
function createErrorResponse(message: string, status: number, details?: any) {
  console.error(`[ANALYZE-CREDIT] Error response: ${message}`, details)
  return new NextResponse(
    JSON.stringify({
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
}

export async function POST(request: NextRequest) {
  console.log("[ANALYZE-CREDIT] API route called")
  const startTime = performance.now()

  try {
    // Verify Supabase client is available
    if (!supabase) {
      return createErrorResponse("Database connection unavailable", 500)
    }

    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return createErrorResponse("OpenAI API key is not configured", 500)
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return createErrorResponse("Unauthorized", 401)
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return createErrorResponse("Unauthorized", 401)
    }

    console.log("[ANALYZE-CREDIT] User authenticated:", user.id)

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return createErrorResponse("Invalid JSON in request body", 400)
    }

    // Validate input
    if (!body.text && !body.fileData) {
      console.error("Missing required file or text field")
      return createErrorResponse("Missing required file or text field", 400)
    }

    // Handle file upload or text input
    let fileBuffer: ArrayBuffer
    let fileName: string
    let fileType: string | null = null

    try {
      if (body.fileData) {
        // Process base64 file data
        try {
          const base64Data = body.fileData.split(";base64,").pop()
          if (!base64Data) {
            throw new Error("Invalid base64 data format")
          }
          fileBuffer = Buffer.from(base64Data, "base64")
          fileName = body.fileName || "uploaded-file.pdf"
          fileType = body.fileType || null

          // Special handling for PDF files
          if (fileType === "application/pdf") {
            console.log("[ANALYZE-CREDIT] PDF file detected, using special handling")
          }
        } catch (fileError) {
          console.error("Error processing file data:", fileError)
          return createErrorResponse(
            "Invalid file data: " + (fileError instanceof Error ? fileError.message : String(fileError)),
            400,
          )
        }
      } else if (body.text) {
        // Process text input
        const textEncoder = new TextEncoder()
        fileBuffer = textEncoder.encode(body.text).buffer
        fileName = "manual-text.txt"
        fileType = "text/plain"
      } else {
        console.error("Missing required file or text field")
        return createErrorResponse("Missing required file or text field", 400)
      }

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

      // Process with our real-time OpenAI service
      try {
        const analysisResult = await analyzeCredit(fileBuffer, fileName, user.id, {
          signal: AbortSignal.timeout(280000), // 280 second timeout (slightly less than route timeout)
          priority: body.priority || "normal",
          notifyUser: body.notifyUser !== false, // Default to true,
          fileType: fileType, // Pass the file type if available
        })

        if (!analysisResult.success) {
          console.error("Analysis failed:", analysisResult.error)

          // Create an error notification for the user
          try {
            await createNotification({
              userId: user.id,
              title: "Analysis Failed",
              message: `We encountered an error analyzing your credit report: ${analysisResult.error?.message || "Unknown error"}. Please try again.`,
              type: "error",
            })
          } catch (notifError) {
            console.error("Failed to create error notification:", notifError)
          }

          // Return detailed error information
          return createErrorResponse("Failed to analyze credit report", 500, {
            message: analysisResult.error?.message || "Unknown error",
            type: analysisResult.error?.type || "unknown",
            additionalInfo: analysisResult.error?.details,
            analysisId: analysisResult.analysisId,
            metrics: analysisResult.metrics,
          })
        }

        console.log("[ANALYZE-CREDIT] Analysis completed successfully")

        // Create a success notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Credit Analysis Complete",
            message:
              analysisResult.result?.overview?.score !== null
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
            analysisResult.result?.overview?.score !== null &&
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

        return new NextResponse(
          JSON.stringify({
            success: true,
            analysisId: analysisResult.analysisId,
            result: analysisResult.result,
            metrics: {
              ...analysisResult.metrics,
              totalProcessingTimeMs: Math.round(endTime - startTime),
            },
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      } catch (processingError) {
        console.error("[ANALYZE-CREDIT] Processing error:", processingError)

        // Create an error notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Analysis Failed",
            message: `We encountered an error processing your credit report: ${processingError instanceof Error ? processingError.message : "Unknown error"}. Please try again.`,
            type: "error",
          })
        } catch (notifError) {
          console.error("Failed to create error notification:", notifError)
        }

        return createErrorResponse("Error processing credit report", 500, {
          message: processingError instanceof Error ? processingError.message : "Unknown error",
          stack:
            process.env.NODE_ENV === "development"
              ? processingError instanceof Error
                ? processingError.stack
                : undefined
              : undefined,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (fileProcessingError) {
      console.error("[ANALYZE-CREDIT] File processing error:", fileProcessingError)
      return createErrorResponse("Error processing file", 500, {
        message: fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown file processing error",
      })
    }
  } catch (error) {
    console.error("[ANALYZE-CREDIT] API error:", error)
    return createErrorResponse("Internal server error", 500, {
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    })
  }
}
