/**
 * Utility functions for document processing with enhanced error handling and logging
 */

// Define supported file types
export const SUPPORTED_FILE_TYPES = {
  pdf: ["application/pdf", ".pdf"],
  images: ["image/jpeg", "image/jpg", "image/png", ".jpg", ".jpeg", ".png"],
  text: ["text/plain", ".txt"],
}

/**
 * Validates if a file is supported
 */
export function isFileSupported(file: File): boolean {
  const fileType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()

  // Check all supported types
  for (const types of Object.values(SUPPORTED_FILE_TYPES)) {
    if (types.some((type) => fileType === type || fileName.endsWith(type))) {
      return true
    }
  }

  return false
}

/**
 * Extracts text from a file with enhanced error handling
 */
export async function extractTextFromFile(file: File): Promise<{
  text: string
  metadata: {
    fileName: string
    fileType: string
    fileSize: number
    extractionMethod: string
    warnings?: string[]
  }
}> {
  const metadata = {
    fileName: file.name,
    fileType: file.type || "unknown",
    fileSize: file.size,
    extractionMethod: "unknown",
    warnings: [] as string[],
  }

  try {
    // Validate file
    if (!isFileSupported(file)) {
      metadata.warnings.push(`Unsupported file type: ${file.type || "unknown"}`)
    }

    // Check file size
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`)
    }

    let text = ""

    // Handle different file types
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      // For PDF files, we need special handling
      // In a real implementation, you'd use a PDF parsing library
      metadata.extractionMethod = "pdf-text-extraction"
      text = await file.text()

      // Check if we got binary data (indicates PDF needs proper parsing)
      if (text.includes("%PDF") || text.charCodeAt(0) === 0x25) {
        metadata.warnings.push("PDF file detected but proper PDF parsing not implemented. Results may be incomplete.")
        // For now, we'll try to extract any readable text
        text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ")
      }
    } else if (
      file.type.startsWith("image/") ||
      [".jpg", ".jpeg", ".png"].some((ext) => file.name.toLowerCase().endsWith(ext))
    ) {
      // For images, we'd typically use OCR
      metadata.extractionMethod = "image-ocr-placeholder"
      metadata.warnings.push("Image file detected. OCR processing would be needed for accurate text extraction.")

      // For now, return a placeholder indicating OCR is needed
      text = `[Image file: ${file.name}. OCR processing required for text extraction.]`
    } else {
      // Default text extraction
      metadata.extractionMethod = "direct-text-read"
      text = await file.text()
    }

    // Clean up the text
    text = cleanExtractedText(text)

    // Validate extraction
    if (!text || text.trim().length === 0) {
      throw new Error("No text could be extracted from the file")
    }

    return { text, metadata }
  } catch (error) {
    console.error("Error extracting text from file:", error)
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Cleans extracted text
 */
export function cleanExtractedText(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, " ")

  // Remove non-printable characters (except newlines and tabs)
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, "")

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  // Remove excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n")

  return cleaned.trim()
}

/**
 * Truncates text to a maximum length while preserving complete sentences
 */
export function truncateText(text: string, maxLength = 15000): string {
  if (text.length <= maxLength) {
    return text
  }

  // Try to truncate at a sentence boundary
  const truncated = text.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf(".")
  const lastNewline = truncated.lastIndexOf("\n")

  const cutPoint = Math.max(lastPeriod, lastNewline)

  if (cutPoint > maxLength * 0.8) {
    return truncated.substring(0, cutPoint + 1) + "\n\n[Document truncated...]"
  }

  return truncated + "... [truncated]"
}

/**
 * Cleans a potentially markdown-formatted JSON response
 * Removes code blocks, backticks, and other markdown formatting
 */
export function cleanJsonResponse(content: string): string {
  // Remove markdown code blocks
  let cleaned = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")

  // Remove any remaining backticks
  cleaned = cleaned.replace(/`/g, "")

  // Remove any markdown formatting
  cleaned = cleaned.replace(/[*_~]/g, "")

  // Trim whitespace
  cleaned = cleaned.trim()

  // Try to extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  // If no match found, try to find array
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    return arrayMatch[0]
  }

  return cleaned
}

/**
 * Validates credit report data
 */
export function validateCreditReportData(data: any): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check credit score
  if (data.creditScore !== null && data.creditScore !== undefined) {
    const score = Number(data.creditScore)
    if (isNaN(score) || score < 300 || score > 850) {
      errors.push(`Invalid credit score: ${data.creditScore}. Must be between 300 and 850.`)
    }
  } else {
    warnings.push("No credit score found in the report.")
  }

  // Check arrays
  const arrayFields = ["negativeItems", "accounts", "inquiries", "publicRecords"]
  for (const field of arrayFields) {
    if (data[field] && !Array.isArray(data[field])) {
      errors.push(`${field} must be an array.`)
    }
  }

  // Check accounts structure
  if (Array.isArray(data.accounts)) {
    data.accounts.forEach((account: any, index: number) => {
      if (!account.creditor) {
        warnings.push(`Account ${index + 1} is missing creditor name.`)
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// Add this improved function to better handle PDF text extraction

/**
 * Enhanced text extraction with better format handling
 */
export async function enhancedTextExtraction(file: File): Promise<{
  text: string
  metadata: {
    fileName: string
    fileType: string
    fileSize: number
    extractionMethod: string
    warnings?: string[]
  }
}> {
  const metadata = {
    fileName: file.name,
    fileType: file.type || "unknown",
    fileSize: file.size,
    extractionMethod: "unknown",
    warnings: [] as string[],
  }

  try {
    // For PDF files, we need special handling
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      metadata.extractionMethod = "pdf-text-extraction"

      // For PDFs, we'll try to extract text directly first
      let text = await file.text()

      // Check if we got binary data (indicates PDF needs proper parsing)
      if (text.includes("%PDF") || text.charCodeAt(0) === 0x25) {
        metadata.warnings.push("PDF file detected. Using fallback text extraction.")

        // For binary PDFs, we'll extract any readable text
        text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ")

        // If text is still mostly unreadable, provide a clear warning
        if (text.length < 100 || text.replace(/[^a-zA-Z0-9]/g, "").length < 50) {
          metadata.warnings.push("Limited text extracted from PDF. Consider converting to text format.")
        }
      }

      return { text, metadata }
    }
    // For images, we'd typically use OCR but we'll return a clear message
    else if (
      file.type.startsWith("image/") ||
      [".jpg", ".jpeg", ".png"].some((ext) => file.name.toLowerCase().endsWith(ext))
    ) {
      metadata.extractionMethod = "image-placeholder"
      metadata.warnings.push("Image file detected. Text extraction from images is limited without OCR.")

      return {
        text: `[This is an image file (${file.name}). For best results, please provide a text-based credit report.]`,
        metadata,
      }
    }
    // For text files, we can extract directly
    else {
      metadata.extractionMethod = "direct-text-read"
      const text = await file.text()
      return { text, metadata }
    }
  } catch (error) {
    console.error("Error in enhanced text extraction:", error)
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : String(error)}`)
  }
}
