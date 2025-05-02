import type { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { getServerSession } from "@/lib/auth-provider"
import { createSuccessResponse, createErrorResponse, safeJsonParse, sanitizeForJson } from "@/lib/json-utils"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get the analysis ID from the URL
    const analysisId = params.id

    // Get the user session
    const session = await getServerSession()

    if (!session || !session.user) {
      return createErrorResponse("Unauthorized", 401)
    }

    // Fetch the analysis from the database
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", session.user.id)
      .single()

    if (error) {
      console.error("Error fetching analysis:", error)
      return createErrorResponse("Analysis not found", 404)
    }

    if (!analysis) {
      return createErrorResponse("Analysis not found", 404)
    }

    // If the analysis is still processing, return the status
    if (analysis.status === "processing") {
      return createSuccessResponse({ status: "processing" }, 202)
    }

    // If the analysis failed, return the error
    if (analysis.status === "error") {
      return createErrorResponse("Analysis failed", 500, {
        errorMessage: analysis.error_message || "Unknown error",
      })
    }

    // Check if the analysis has a result
    let result = analysis.result

    // If result is a string, try to parse it as JSON
    if (typeof result === "string") {
      result = safeJsonParse(result)
    }

    // If we still don't have a valid result, create a default one
    if (!result) {
      // Create a default result structure
      const defaultResult = {
        id: analysisId,
        overview: {
          score: null,
          summary: "Analysis data is not available. This could be due to an incomplete processing or a system error.",
          positiveFactors: [],
          negativeFactors: [],
        },
        disputes: { items: [] },
        creditHacks: { recommendations: [] },
        creditCards: { recommendations: [] },
        sideHustles: { recommendations: [] },
      }

      // Update the analysis with the default result
      const { error: updateError } = await supabase
        .from("analyses")
        .update({
          result: defaultResult,
          status: "completed",
        })
        .eq("id", analysisId)

      if (updateError) {
        console.error("Error updating analysis with default result:", updateError)
      }

      return createSuccessResponse({
        id: analysisId,
        ...defaultResult,
      })
    }

    // Sanitize the result to ensure it can be safely serialized
    const sanitizedResult = sanitizeForJson(result)

    // Return the analysis result
    return createSuccessResponse({
      id: analysisId,
      ...sanitizedResult,
    })
  } catch (error) {
    console.error("Error in analysis API:", error)
    return createErrorResponse("An unexpected error occurred while fetching the analysis", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
