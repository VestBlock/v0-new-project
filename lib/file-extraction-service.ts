import { processPDF, extractTextFromPDFFallback } from "./pdf-processing-service"

/**
 * Extract text from a file based on its type
 */
export async function extractTextFromFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  fileType?: string | null,
): Promise<{
  success: boolean
  text?: string
  error?: {
    message: string
    type: string
    details?: any
  }
}> {
  try {
    console.log(`[FILE-EXTRACTION] Extracting text from ${fileName}, type: ${fileType || "unknown"}`)

    // Determine file type if not provided
    if (!fileType) {
      fileType = determineFileType(fileName)
    }

    // Handle different file types
    if (fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      console.log(`[FILE-EXTRACTION] Processing as PDF`)

      // Try primary PDF extraction
      const pdfResult = await processPDF(fileBuffer, fileName, userId)

      if (pdfResult.success && pdfResult.text && pdfResult.text.length > 100) {
        return {
          success: true,
          text: pdfResult.text,
        }
      }

      // If primary extraction fails or returns too little text, try fallback
      console.log(`[FILE-EXTRACTION] Primary PDF extraction insufficient, trying fallback`)
      const fallbackResult = await extractTextFromPDFFallback(fileBuffer, userId)

      if (fallbackResult.success && fallbackResult.text) {
        return fallbackResult
      }

      // If both methods fail, return error
      return {
        success: false,
        error: {
          message: "Failed to extract text from PDF using multiple methods",
          type: "pdf_extraction_failed",
          details: {
            primaryError: pdfResult.error,
            fallbackError: fallbackResult.error,
          },
        },
      }
    } else if (fileType === "text/plain" || fileName.toLowerCase().endsWith(".txt")) {
      // For text files, just decode the buffer
      const decoder = new TextDecoder("utf-8")
      const text = decoder.decode(fileBuffer)

      return {
        success: true,
        text,
      }
    } else if (
      fileType === "image/jpeg" ||
      fileType === "image/png" ||
      fileType === "image/gif" ||
      /\.(jpe?g|png|gif)$/i.test(fileName)
    ) {
      // For images, we'll need to use OCR or vision API
      // This will be handled by the OpenAI service directly
      return {
        success: false,
        error: {
          message: "Image files should be processed by vision API directly",
          type: "image_file",
          details: { fileType },
        },
      }
    } else {
      // Unsupported file type
      return {
        success: false,
        error: {
          message: `Unsupported file type: ${fileType}`,
          type: "unsupported_file_type",
          details: { fileType },
        },
      }
    }
  } catch (error) {
    console.error(`[FILE-EXTRACTION] Error extracting text:`, error)

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: "extraction_error",
      },
    }
  }
}

/**
 * Determine file type from file name
 */
function determineFileType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "pdf":
      return "application/pdf"
    case "txt":
      return "text/plain"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "gif":
      return "image/gif"
    default:
      return "application/octet-stream"
  }
}
