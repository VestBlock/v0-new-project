// Types
export type UploadStage = "preparing" | "uploading" | "processing" | "analyzing" | "complete" | "error"

export interface UploadProgress {
  stage: UploadStage
  percent: number
  message: string
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  priority?: "low" | "normal" | "high"
  maxRetries?: number
  timeout?: number
}

export interface UploadResult {
  success: boolean
  analysisId?: string
  error?: {
    code?: string
    message: string
  }
  debugInfo?: any
}

// Constants
const API_ENDPOINT = "/api/upload-pdf"
const DEFAULT_TIMEOUT = 120000 // 2 minutes
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Uploads a credit report file and returns the analysis ID
 */
export async function uploadCreditReport(
  file: File,
  token: string | null = null,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { onProgress = () => {}, priority = "normal", maxRetries = 2, timeout = DEFAULT_TIMEOUT } = options

  // Validate file
  if (!file) {
    return {
      success: false,
      error: {
        code: "invalid_file",
        message: "No file provided",
      },
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: {
        code: "file_too_large",
        message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      },
    }
  }

  // Check file type
  const validTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain"]
  const fileExtension = file.name.split(".").pop()?.toLowerCase()

  if (!validTypes.includes(file.type) && !["pdf", "jpg", "jpeg", "png", "txt"].includes(fileExtension || "")) {
    return {
      success: false,
      error: {
        code: "invalid_file_type",
        message: "Invalid file type. Please upload a PDF, JPG, PNG, or TXT file.",
      },
    }
  }

  // Create form data
  const formData = new FormData()
  formData.append("file", file)
  formData.append("priority", priority)
  formData.append("clientVersion", "2.0.0") // For tracking API version compatibility

  // Set initial progress
  onProgress({
    stage: "preparing",
    percent: 10,
    message: "Preparing file...",
  })

  // Upload with retries
  let retryCount = 0
  let lastError: any = null

  while (retryCount <= maxRetries) {
    try {
      // Update progress
      onProgress({
        stage: "uploading",
        percent: 20,
        message: retryCount > 0 ? `Uploading file (retry ${retryCount}/${maxRetries})...` : "Uploading file...",
      })

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // Set up headers
      const headers: HeadersInit = {
        Accept: "application/json",
      }

      // Only add Authorization if token is provided
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      // Upload file
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
        credentials: "include", // Include cookies for authentication
      })

      // Clear timeout
      clearTimeout(timeoutId)

      // Update progress
      onProgress({
        stage: "processing",
        percent: 40,
        message: "Processing file...",
      })

      // Check for non-OK response
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status} ${response.statusText}`
        let errorData = null

        try {
          // Try to parse error response as JSON
          errorData = await response.json()
          errorMessage = errorData.error?.message || errorMessage
        } catch (e) {
          // If not JSON, try to get text
          try {
            const textError = await response.text()
            if (textError) errorMessage = textError
          } catch (textError) {
            // Ignore text parsing error
          }
        }

        throw new Error(errorMessage)
      }

      // Parse response
      let responseData
      try {
        responseData = await response.json()
      } catch (error) {
        console.error("Error parsing JSON response:", error)
        throw new Error("Invalid response from server. Could not parse JSON.")
      }

      // Update progress for analysis
      onProgress({
        stage: "analyzing",
        percent: 60,
        message: "Analyzing credit report...",
      })

      // Simulate analysis progress (since the actual analysis happens asynchronously)
      const analysisSteps = [70, 80, 90, 100]
      for (const percent of analysisSteps) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        onProgress({
          stage: percent === 100 ? "complete" : "analyzing",
          percent,
          message: percent === 100 ? "Analysis complete!" : `Analyzing credit report (${percent}%)...`,
        })
      }

      // Return success result
      return {
        success: true,
        analysisId: responseData.analysisId || responseData.id,
      }
    } catch (error) {
      lastError = error
      console.error(`Upload attempt ${retryCount + 1} failed:`, error)

      // Check if we should retry
      if (retryCount < maxRetries) {
        retryCount++

        // Exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000)
        await new Promise((resolve) => setTimeout(resolve, backoffTime))
      } else {
        // Max retries reached
        onProgress({
          stage: "error",
          percent: 0,
          message: error instanceof Error ? error.message : "Upload failed",
        })

        return {
          success: false,
          error: {
            code: "upload_failed",
            message: error instanceof Error ? error.message : "Failed to upload file after multiple attempts",
          },
          debugInfo: {
            error: error instanceof Error ? error.message : String(error),
            retries: retryCount,
          },
        }
      }
    }
  }

  // This should never be reached due to the return in the catch block
  return {
    success: false,
    error: {
      code: "unknown_error",
      message: "An unexpected error occurred",
    },
  }
}

/**
 * Utility function to get file extension from a file object
 */
export function getFileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || ""
}

/**
 * Utility function to check if a file is valid
 */
export function isValidFile(file: File): boolean {
  const validTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain"]
  const validExtensions = ["pdf", "jpg", "jpeg", "png", "txt"]
  const fileExtension = getFileExtension(file)

  return validTypes.includes(file.type) || validExtensions.includes(fileExtension)
}
