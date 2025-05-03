/**
 * Client utility for interacting with the OCR API
 */

// Response types
export type OCRSuccessResponse = {
  success: true
  text: string
  metadata: {
    processingTimeMs: number
    fileType: string
    fileSize: number
    confidence?: number
    model: string
    tokenUsage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }
}

export type OCRErrorResponse = {
  success: false
  error: string
  code: string
  details?: any
}

export type OCRResponse = OCRSuccessResponse | OCRErrorResponse

/**
 * Process a file with OCR using the API
 */
export async function processFileWithOCR(
  file: File,
  options: {
    onProgress?: (progress: number) => void
    abortSignal?: AbortSignal
  } = {},
): Promise<OCRResponse> {
  const { onProgress, abortSignal } = options

  try {
    // Create form data
    const formData = new FormData()
    formData.append("file", file)

    // If progress tracking is needed, use XMLHttpRequest
    if (onProgress) {
      return new Promise<OCRResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // Set up progress tracking
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress(progress)
          }
        }

        xhr.open("POST", "/api/ocr-edge")

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response as OCRResponse)
            } catch (error) {
              // If we can't parse the response as JSON, it's likely an HTML error page
              reject({
                success: false,
                error: "Server returned an invalid response format",
                code: "invalid_response_format",
                details: {
                  responsePreview: xhr.responseText.substring(0, 200),
                  status: xhr.status,
                },
              } as OCRErrorResponse)
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText)
              reject(errorResponse)
            } catch (error) {
              // If we can't parse the error as JSON, it's likely an HTML error page
              reject({
                success: false,
                error: `Server error (${xhr.status})`,
                code: "server_error",
                details: {
                  status: xhr.status,
                  responsePreview: xhr.responseText.substring(0, 200),
                },
              } as OCRErrorResponse)
            }
          }
        }

        xhr.onerror = () => {
          reject({
            success: false,
            error: "Network error occurred",
            code: "network_error",
          } as OCRErrorResponse)
        }

        xhr.ontimeout = () => {
          reject({
            success: false,
            error: "Request timed out",
            code: "timeout",
          } as OCRErrorResponse)
        }

        // Handle abort signal
        if (abortSignal) {
          abortSignal.addEventListener("abort", () => {
            xhr.abort()
            reject({
              success: false,
              error: "Request was aborted",
              code: "aborted",
            } as OCRErrorResponse)
          })
        }

        // Send the request
        xhr.send(formData)
      })
    } else {
      // If no progress tracking is needed, use fetch API with better error handling
      try {
        const response = await fetch("/api/ocr-edge", {
          method: "POST",
          body: formData,
          signal: abortSignal,
        })

        // Check if the response is successful
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || ""

          // Try to get the response text for better error reporting
          const responseText = await response.text()

          // If we got HTML instead of JSON, provide a clearer error
          if (
            contentType.includes("text/html") ||
            responseText.trim().startsWith("<!DOCTYPE html>") ||
            responseText.trim().startsWith("<html")
          ) {
            return {
              success: false,
              error: `Server error: ${response.status} ${response.statusText}`,
              code: "server_error",
              details: {
                status: response.status,
                statusText: response.statusText,
                contentType: contentType,
                responsePreview: responseText.substring(0, 200),
              },
            } as OCRErrorResponse
          }

          // Try to parse as JSON error
          try {
            const errorData = JSON.parse(responseText)
            return errorData as OCRErrorResponse
          } catch (parseError) {
            // If we can't parse as JSON, return a generic error
            return {
              success: false,
              error: `Server error: ${response.status} ${response.statusText}`,
              code: "server_error",
              details: {
                status: response.status,
                statusText: response.statusText,
                responsePreview: responseText.substring(0, 200),
              },
            } as OCRErrorResponse
          }
        }

        // Get response text
        const responseText = await response.text()

        // Try to parse as JSON
        try {
          const data = JSON.parse(responseText)
          return data as OCRResponse
        } catch (error) {
          // If response is not valid JSON, return a clear error
          return {
            success: false,
            error: "Server returned an invalid JSON response",
            code: "invalid_json",
            details: { responsePreview: responseText.substring(0, 200) },
          } as OCRErrorResponse
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: "Request was aborted",
            code: "aborted",
          } as OCRErrorResponse
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown fetch error",
          code: "fetch_error",
          details: { error: String(error) },
        } as OCRErrorResponse
      }
    }
  } catch (error) {
    // Ensure we always return a structured error response
    if (error && typeof error === "object" && "success" in error && error.success === false) {
      return error as OCRErrorResponse
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      code: "client_error",
      details: { error: String(error) },
    } as OCRErrorResponse
  }
}

/**
 * Process text content with OCR
 * This is useful for processing text that's already been extracted
 */
export async function processTextWithOCR(
  text: string,
  options: {
    abortSignal?: AbortSignal
  } = {},
): Promise<OCRResponse> {
  try {
    // Create a text file from the string
    const file = new File([text], "content.txt", { type: "text/plain" })

    // Process the file
    return await processFileWithOCR(file, options)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      code: "client_error",
      details: { error: String(error) },
    } as OCRErrorResponse
  }
}
