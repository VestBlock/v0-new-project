/**
 * Utility functions for consistent API error handling
 */

import { createErrorResponse } from "./json-utils"

/**
 * Wraps an API handler with consistent error handling
 * @param handler The API route handler function
 * @returns A wrapped handler with error handling
 */
export function withErrorHandling(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      console.error("API error:", error)

      // Determine appropriate status code
      let status = 500
      if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
          status = 404
        } else if (error.message.includes("unauthorized") || error.message.includes("not authorized")) {
          status = 401
        } else if (error.message.includes("forbidden")) {
          status = 403
        } else if (error.message.includes("validation") || error.message.includes("invalid")) {
          status = 400
        }
      }

      return createErrorResponse(
        error instanceof Error ? error.message : "Internal server error",
        status,
        process.env.NODE_ENV === "development" ? error : undefined,
      )
    }
  }
}

/**
 * Creates a standardized error object
 * @param message Error message
 * @param code Error code
 * @returns Error object
 */
export function createApiError(message: string, code?: string): Error & { code?: string } {
  const error = new Error(message)
  ;(error as any).code = code
  return error as Error & { code?: string }
}

/**
 * Validates request data against required fields
 * @param data Request data
 * @param requiredFields Array of required field names
 * @throws Error if validation fails
 */
export function validateRequestData(data: any, requiredFields: string[]): void {
  if (!data) {
    throw createApiError("Request data is missing", "MISSING_DATA")
  }

  const missingFields = requiredFields.filter((field) => !(field in data))

  if (missingFields.length > 0) {
    throw createApiError(`Missing required fields: ${missingFields.join(", ")}`, "MISSING_FIELDS")
  }
}
