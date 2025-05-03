import { NextResponse, type NextRequest } from "next/server"
import { verifyOpenAIResponse } from "@/lib/api-verification"
import { logApiVerificationToDb } from "@/lib/api-verification-db"

/**
 * Middleware to verify API responses
 * This can be applied to specific API routes
 */
export async function verifyApiResponse(request: NextRequest, response: NextResponse, endpoint: string) {
  // Skip verification in production unless explicitly enabled
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_API_VERIFICATION !== "true") {
    return response
  }

  try {
    // Get the response data
    const responseData = await response.json()

    // Verify the response
    const startTime = Date.now()
    const verificationResult = await verifyOpenAIResponse(responseData)
    const verificationTime = Date.now() - startTime

    // Extract user ID from auth if available
    let userId: string | undefined
    try {
      // This assumes you have auth info in the request
      // Adjust based on your actual auth implementation
      const authHeader = request.headers.get("authorization")
      if (authHeader && authHeader.startsWith("Bearer ")) {
        // You would need to implement token verification here
        // userId = getUserIdFromToken(authHeader.substring(7))
      }
    } catch (error) {
      console.error("Error extracting user ID:", error)
    }

    // Log the verification result to the database
    await logApiVerificationToDb({
      endpoint,
      userId,
      isValid: verificationResult.isValid,
      isMockData: verificationResult.mockDataAnalysis.isMockData,
      mockConfidence: verificationResult.mockDataAnalysis.confidence,
      issues: verificationResult.issues,
      responseTimeMs: verificationTime,
    })

    // If mock data is detected with high confidence, add a warning header
    if (verificationResult.mockDataAnalysis.confidence > 80) {
      const newResponse = NextResponse.json(responseData, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          "X-Mock-Data-Warning": "true",
          "X-Mock-Data-Confidence": verificationResult.mockDataAnalysis.confidence.toString(),
          "X-Mock-Data-Reasons": verificationResult.mockDataAnalysis.reasons.join("; "),
        },
      })

      return newResponse
    }

    return response
  } catch (error) {
    console.error("Error in API verification middleware:", error)
    return response
  }
}
