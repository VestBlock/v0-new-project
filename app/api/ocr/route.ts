import type { NextRequest } from "next/server"
import { createNotification } from "@/lib/notifications"
import { supabase } from "@/lib/supabase"
import { analyzeCreditReportDirect } from "@/lib/openai-direct"
import { createSuccessResponse, createErrorResponse } from "@/lib/json-utils"

// Set the runtime config for the route
export const config = {
  runtime: "nodejs",
  maxDuration: 60, // Maximum duration allowed by Vercel
}

// Create a fallback analysis result for error cases only
async function createFallbackAnalysis(userId: string, filename: string) {
  try {
    // Log the database schema to help debug
    console.log("[OCR-API] Creating fallback analysis with user_id:", userId)

    // First, check if the analyses table exists and what columns it has
    const { data: tableInfo, error: tableError } = await supabase.from("analyses").select("*").limit(1)

    if (tableError) {
      console.error("[OCR-API] Error checking analyses table:", tableError)
    } else {
      console.log("[OCR-API] Analyses table exists with sample data:", tableInfo)
    }

    // Create a new analysis record in the database
    const { data: analysis, error } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        status: "completed",
        file_path: filename, // Using file_path instead of file_name
        ocr_text: "This is a fallback OCR text for demonstration purposes.", // Required field
        notes: "This is a fallback analysis created when the OpenAI analysis failed.",
        result: {
          overview: {
            score: 650,
            summary: "This is a fallback credit analysis. The actual analysis could not be completed.",
            positiveFactors: ["Regular on-time payments on most accounts"],
            negativeFactors: ["High credit utilization"],
          },
          disputes: {
            items: [
              {
                bureau: "Example Bureau",
                accountName: "Example Bank",
                accountNumber: "XXXX1234",
                issueType: "Late Payment",
                recommendedAction: "Dispute inaccurate information",
              },
            ],
          },
          creditHacks: {
            recommendations: [
              {
                title: "Reduce Credit Utilization",
                description: "Pay down credit card balances to below 30% of your credit limits.",
                impact: "high",
                timeframe: "1-2 months",
                steps: ["Make extra payments", "Ask for credit limit increases"],
              },
            ],
          },
          creditCards: {
            recommendations: [
              {
                name: "Example Card",
                issuer: "Example Bank",
                annualFee: "$0",
                apr: "15.99% - 24.99%",
                rewards: "2% cash back on all purchases",
                approvalLikelihood: "medium",
                bestFor: "Everyday spending",
              },
            ],
          },
          sideHustles: {
            recommendations: [
              {
                title: "Freelance Writing",
                description: "Offer writing services for blogs and websites.",
                potentialEarnings: "$500-$2000/month",
                startupCost: "Low",
                difficulty: "medium",
                timeCommitment: "10-20 hours/week",
                skills: ["Writing", "Research", "SEO knowledge"],
              },
            ],
          },
        },
      })
      .select()
      .single()

    if (error) {
      console.error("[OCR-API] Error creating fallback analysis:", error)

      // Log more details about the error
      if (error.details) console.error("[OCR-API] Error details:", error.details)
      if (error.hint) console.error("[OCR-API] Error hint:", error.hint)
      if (error.code) console.error("[OCR-API] Error code:", error.code)

      return { success: false, error: `Failed to create fallback analysis: ${error.message}`, analysisId: null }
    }

    console.log("[OCR-API] Fallback analysis created successfully:", analysis.id)
    return { success: true, analysisId: analysis.id, result: analysis.result }
  } catch (error) {
    console.error("[OCR-API] Error in createFallbackAnalysis:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to create fallback analysis: ${error.message}`
          : "Unknown error creating fallback analysis",
      analysisId: null,
    }
  }
}

export async function POST(request: NextRequest) {
  console.log("[OCR-API] OCR API called - starting processing")
  const startTime = performance.now()

  // Global error handler to ensure we always return JSON
  try {
    // Authenticate the user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("[OCR-API] Error: No authorization header")
      return createErrorResponse("Unauthorized", 401)
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("[OCR-API] Error: Authentication failed", authError)
      return createErrorResponse("Unauthorized", 401, authError?.message)
    }

    console.log(`[OCR-API] User authenticated successfully: ${user.id}`)

    // Get the file from the request
    let formData
    try {
      formData = await request.formData()
    } catch (formError) {
      console.error("[OCR-API] Error parsing form data:", formError)
      return createErrorResponse(
        "Invalid form data",
        400,
        formError instanceof Error ? formError.message : "Failed to parse form data",
      )
    }

    const file = formData.get("file") as File

    if (!file) {
      console.error("[OCR-API] Error: No file provided")
      return createErrorResponse("No file provided", 400)
    }

    console.log(`[OCR-API] File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes`)

    // Check file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      console.error(`[OCR-API] Error: File size exceeds limit: ${file.size} bytes`)
      return createErrorResponse("File size exceeds 25MB limit", 400)
    }

    // Check file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain"]
    if (!allowedTypes.includes(file.type)) {
      console.error(`[OCR-API] Error: File type not supported: ${file.type}`)
      return createErrorResponse("File type not supported. Please upload a PDF, JPG, PNG, or TXT file", 400)
    }

    // Create a notification for the user that analysis is starting
    try {
      await createNotification({
        userId: user.id,
        title: "Credit Report Analysis Started",
        message: "Your credit report is being analyzed. This may take a minute or two.",
        type: "info",
      })
      console.log("[OCR-API] Start notification created successfully")
    } catch (notificationError) {
      console.error("[OCR-API] Warning: Failed to create start notification", notificationError)
      // Continue processing even if notification fails
    }

    // Convert file to ArrayBuffer for processing
    let fileBuffer
    try {
      console.log("[OCR-API] Converting file to ArrayBuffer...")
      fileBuffer = await file.arrayBuffer()
      console.log(`[OCR-API] File converted to ArrayBuffer (${fileBuffer.byteLength} bytes)`)
    } catch (bufferError) {
      console.error("[OCR-API] Error converting file to ArrayBuffer:", bufferError)
      return createErrorResponse(
        "Failed to process file",
        500,
        bufferError instanceof Error ? bufferError.message : "Error reading file data",
      )
    }

    // Create a fallback analysis immediately as a backup
    console.log("[OCR-API] Creating fallback analysis as backup")
    let fallbackResult
    try {
      fallbackResult = await createFallbackAnalysis(user.id, file.name)

      if (!fallbackResult.success) {
        console.error("[OCR-API] Failed to create fallback analysis:", fallbackResult.error)
        // Continue anyway - we'll try the real analysis
      } else {
        console.log(`[OCR-API] Fallback analysis created with ID: ${fallbackResult.analysisId}`)
      }
    } catch (fallbackError) {
      console.error("[OCR-API] Critical error creating fallback analysis:", fallbackError)
      fallbackResult = {
        success: false,
        error: fallbackError instanceof Error ? fallbackError.message : "Unknown error creating fallback",
        analysisId: null,
      }
      // Continue with the main analysis
    }

    // Process the file with OpenAI - with extended timeout
    console.log("[OCR-API] Calling analyzeCreditReportDirect with extended timeout...")

    // Set a longer timeout for the OpenAI processing
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000) // 55 second timeout

    try {
      // Always use live data - no mock data check
      const analysisResult = await analyzeCreditReportDirect(fileBuffer, file.name, file.type, user.id, {
        signal: controller.signal,
      }).catch((error) => {
        console.error("[OCR-API] Error in analyzeCreditReportDirect:", error)
        // Return a standardized error object
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error in credit report analysis",
          analysisId: null,
        }
      })

      clearTimeout(timeoutId)

      if (!analysisResult.success) {
        console.error(`[OCR-API] Error: Analysis failed: ${analysisResult.error || "Unknown error"}`)

        // Create an error notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Analysis Failed",
            message: `We encountered an error analyzing your credit report: ${
              analysisResult.error || "Unknown error"
            }. Using fallback analysis instead.`,
            type: "warning",
          })
        } catch (notifError) {
          console.error("[OCR-API] Failed to create error notification:", notifError)
        }

        // Use the fallback analysis we created earlier
        if (fallbackResult.success) {
          return createSuccessResponse({
            analysisId: fallbackResult.analysisId,
            directResult: fallbackResult.result,
            fallback: true,
            message: "Analysis failed, but we've created a fallback analysis to demonstrate the interface.",
          })
        } else {
          return createErrorResponse("Failed to analyze credit report and create fallback", 500, {
            details: analysisResult.error,
          })
        }
      }

      console.log(`[OCR-API] Analysis completed successfully with ID: ${analysisResult.analysisId}`)

      // Create a success notification for the user
      try {
        const score = analysisResult.result?.overview?.score

        await createNotification({
          userId: user.id,
          title: "Credit Analysis Complete",
          message:
            score !== null
              ? `Your credit analysis is ready. Your credit score is ${score}.`
              : "Your credit analysis is ready. We couldn't determine a specific score from your report.",
          type: "success",
        })
        console.log("[OCR-API] Success notification created")
      } catch (notificationError) {
        console.error("[OCR-API] Warning: Failed to create success notification", notificationError)
      }

      // Store the credit score in the credit_scores table ONLY if it's a valid score
      try {
        const score = analysisResult.result?.overview?.score

        if (score !== null && score >= 300 && score <= 850) {
          await supabase.from("credit_scores").insert({
            user_id: user.id,
            bureau: "AI Estimate", // Since this is an AI estimate
            score: score,
            date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
            source: "VestBlock Analysis",
            notes: "Score estimated from credit report analysis",
          })
          console.log("[OCR-API] Stored credit score in database")
        }
      } catch (scoreError) {
        console.error("[OCR-API] Warning: Failed to store credit score", scoreError)
      }

      const endTime = performance.now()
      console.log(
        `[OCR-API] Process completed in ${Math.round(endTime - startTime)}ms, returning analysis ID and result`,
      )

      // Return both the analysis ID and the result
      return createSuccessResponse({
        analysisId: analysisResult.analysisId,
        directResult: analysisResult.result,
        processingTime: Math.round(endTime - startTime),
      })
    } catch (timeoutError) {
      clearTimeout(timeoutId)
      if (timeoutError.name === "AbortError") {
        console.error("[OCR-API] Analysis timed out after 55 seconds")

        // Create a timeout notification for the user
        try {
          await createNotification({
            userId: user.id,
            title: "Analysis Taking Longer Than Expected",
            message: "Your credit report analysis is taking longer than expected. Using fallback analysis instead.",
            type: "warning",
          })
        } catch (notifError) {
          console.error("[OCR-API] Failed to create timeout notification:", notifError)
        }

        // Use the fallback analysis we created earlier
        if (fallbackResult.success) {
          return createSuccessResponse({
            analysisId: fallbackResult.analysisId,
            directResult: fallbackResult.result,
            fallback: true,
            message: "Analysis timed out, but we've created a fallback analysis to demonstrate the interface.",
          })
        } else {
          return createSuccessResponse(
            {
              error: "Analysis timed out",
              message: "Your credit report is still being analyzed. Please check back in a few minutes.",
            },
            202, // Accepted but processing
          )
        }
      }

      // Handle other errors
      console.error("[OCR-API] Error during analysis:", timeoutError)

      // Use the fallback analysis we created earlier
      if (fallbackResult.success) {
        return createSuccessResponse({
          analysisId: fallbackResult.analysisId,
          directResult: fallbackResult.result,
          fallback: true,
          message: "Analysis encountered an error, but we've created a fallback analysis to demonstrate the interface.",
        })
      } else {
        return createErrorResponse("Error processing credit report", 500, {
          message: timeoutError instanceof Error ? timeoutError.message : "Unknown error occurred",
          errorDetails: timeoutError instanceof Error ? timeoutError.stack : null,
        })
      }
    }
  } catch (error) {
    console.error("[OCR-API] Unhandled exception:", error)

    // Ensure we always return a proper JSON response, even for unhandled exceptions
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: {
          message: error instanceof Error ? error.message : String(error),
          stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : null) : undefined,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  })
}
