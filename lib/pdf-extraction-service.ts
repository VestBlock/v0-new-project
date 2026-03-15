import { pdfjs } from "react-pdf"

// The pdfjs object from react-pdf is version "3.11.174".
// We MUST use a worker that matches this version.
const PDFJS_API_VERSION = pdfjs.version || "3.11.174" // Get version from pdfjs object, fallback if undefined
const PDFJS_WORKER_VERSION_TO_LOAD = "3.11.174" // Explicitly set worker to match observed API version

console.log(`PDF.js API version (from react-pdf): ${PDFJS_API_VERSION}`)
console.log(`PDF.js Worker version being loaded: ${PDFJS_WORKER_VERSION_TO_LOAD}`)

// Initialize PDF.js worker with the version that matches the API
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_WORKER_VERSION_TO_LOAD}/pdf.worker.min.js`

export interface ExtractionResult {
  text: string
  metadata: {
    pageCount?: number
    extractionMethod: string
    processingTime?: number
    error?: string
    rawResponse?: any // For debugging
  }
}

/**
 * Extract text from a PDF file using client-side libraries
 */
export async function extractTextWithFallback(file: File): Promise<ExtractionResult> {
  const startTime = Date.now()
  console.log("Starting text extraction for file (pdf-extraction-service.ts):", file.name, file.type, file.size)

  try {
    // Check file type
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
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

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfText = await extractWithPDFJS(file)

        if (pdfText && pdfText.length > 100) {
          console.log(`Successfully extracted ${pdfText.length} characters using PDF.js`)
          return {
            text: pdfText,
            metadata: {
              extractionMethod: "pdf.js",
              pageCount: pdfText.split(/Page \d+:/).length - 1,
              processingTime: Date.now() - startTime,
            },
          }
        }
        throw new Error("Failed to extract sufficient text from PDF. The file may be image-based or secured.")
      } catch (error) {
        console.error("PDF.js extraction error in pdf-extraction-service.ts:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown PDF extraction error"
        // Check if the error is the specific version mismatch error
        if (errorMessage.includes("The API version") && errorMessage.includes("does not match the Worker version")) {
          throw new Error(errorMessage) // Re-throw the original precise error
        }
        throw new Error(`PDF extraction failed: ${errorMessage}`)
      }
    }

    if (file.type.startsWith("image/")) {
      throw new Error("Image files are not supported. Please convert to text or PDF format first.")
    }

    throw new Error(`Unsupported file type: ${file.type}. Please use PDF or TXT files only.`)
  } catch (error) {
    console.error("Text extraction error in pdf-extraction-service.ts (outer):", error)
    throw error
  }
}

/**
 * Extract text from PDF using PDF.js
 */
async function extractWithPDFJS(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_WORKER_VERSION_TO_LOAD}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_WORKER_VERSION_TO_LOAD}/standard_fonts/`,
  })
  const pdf = await loadingTask.promise

  console.log(`PDF loaded with ${pdf.numPages} pages (pdf-extraction-service.ts)`)

  let extractedText = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    extractedText += `Page ${i}:\n${pageText}\n\n`
  }

  return extractedText.trim()
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
  return keywordMatches.length >= 3
}
