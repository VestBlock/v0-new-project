import { pdfjs } from "react-pdf"

// Hardcode a specific version for both API and worker to ensure they match
const PDFJS_VERSION = "3.4.120"

// Initialize PDF.js worker with the hardcoded version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`

// Force the PDF.js library to use the same version
// This is a workaround to prevent version mismatch errors
if (typeof window !== "undefined") {
  console.log("Initializing PDF.js with version:", PDFJS_VERSION)
}

export interface ExtractionResult {
  text: string
  metadata: {
    pageCount?: number
    extractionMethod: string
    processingTime?: number
    error?: string
    rawResponse?: any
  }
}

/**
 * Extract text from a PDF file using client-side libraries
 */
export async function extractTextWithFallback(file: File): Promise<ExtractionResult> {
  const startTime = Date.now()
  console.log("Starting text extraction for file:", file.name, file.type, file.size)

  try {
    // Check file type
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      // For text files, just read the content directly
      const text = await file.text()
      if (!text || text.trim().length < 100) {
        throw new Error("The text file contains insufficient data for analysis.")
      }
      console.log(`Successfully extracted ${text.length} characters from text file`)
      return {
        text,
        metadata: {
          extractionMethod: "text-file",
          pageCount: 1,
          processingTime: Date.now() - startTime,
        },
      }
    }

    // For PDFs, use PDF.js
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        // Use PDF.js for extraction
        const pdfText = await extractWithPDFJS(file)

        if (pdfText && pdfText.length > 100) {
          console.log(`Successfully extracted ${pdfText.length} characters using PDF.js`)
          return {
            text: pdfText,
            metadata: {
              extractionMethod: "pdf.js",
              pageCount: pdfText.split(/Page \d+:/).length - 1, // Rough estimate of page count
              processingTime: Date.now() - startTime,
            },
          }
        }

        // If PDF.js extraction didn't yield good results, throw an error
        throw new Error("Failed to extract sufficient text from PDF. The file may be image-based or secured.")
      } catch (error) {
        console.error("PDF.js extraction error:", error)
        throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    // For images, provide a clear error
    if (file.type.startsWith("image/")) {
      throw new Error("Image files are not supported. Please convert to text or PDF format first.")
    }

    // For other file types, throw an error
    throw new Error(`Unsupported file type: ${file.type}. Please use PDF or TXT files only.`)
  } catch (error) {
    console.error("Text extraction error:", error)
    throw error
  }
}

/**
 * Extract text from PDF using PDF.js
 */
async function extractWithPDFJS(file: File): Promise<string> {
  try {
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load the PDF document with optional params to handle potential errors
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    })

    const pdf = await loadingTask.promise

    console.log(`PDF loaded with ${pdf.numPages} pages`)

    let extractedText = ""

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      // Concatenate the text items
      const pageText = textContent.items.map((item: any) => item.str).join(" ")

      extractedText += `Page ${i}:\n${pageText}\n\n`
    }

    return extractedText.trim()
  } catch (error) {
    console.error("PDF.js extraction error details:", error)

    // More user-friendly error message for text-based analysis fallback
    if (String(error).includes("version")) {
      throw new Error(
        "PDF processing error: Unable to extract text due to PDF.js version mismatch. Please try entering the text manually.",
      )
    }

    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Helper function to check if a file is likely a credit report
 */
export function isLikelyCreditReport(text: string): boolean {
  const creditKeywords = [
    "credit report",
    "credit score",
    "fico",
    "vantagescore",
    "equifax",
    "experian",
    "transunion",
    "credit inquiry",
    "account history",
    "payment history",
    "credit utilization",
    "collections",
    "charge-off",
    "bankruptcy",
    "credit limit",
  ]

  const lowerText = text.toLowerCase()
  const keywordMatches = creditKeywords.filter((keyword) => lowerText.includes(keyword))

  // Consider it a credit report if we find at least 3 relevant keywords
  return keywordMatches.length >= 3
}
