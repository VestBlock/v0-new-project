import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"
import type { TextItem } from "pdfjs-dist/types/src/display/api"

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Configure PDF.js for Node.js environment
const pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.entry")
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Process a PDF file by extracting text
 * This uses PDF.js legacy build which is more compatible with Node.js
 */
export async function processPDF(
  fileBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  options: {
    maxPages?: number
  } = {},
): Promise<{
  success: boolean
  text?: string
  pageCount?: number
  error?: string
  processingId: string
}> {
  const processingId = uuidv4()
  const startTime = Date.now()

  // Default options
  const { maxPages = 20 } = options

  try {
    console.log(`[PDF-PROCESSOR] Starting PDF processing for file: ${fileName}`)

    // Log processing start
    await logProcessingEvent({
      processingId,
      userId,
      fileName,
      fileSize: fileBuffer.byteLength,
      event: "processing_started",
      details: `Started processing ${fileName} (${(fileBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB)`,
    })

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) })
    const pdfDocument = await loadingTask.promise

    const pageCount = pdfDocument.numPages
    console.log(`[PDF-PROCESSOR] PDF has ${pageCount} pages`)

    // Limit pages to process
    const pagesToProcess = Math.min(pageCount, maxPages)

    let extractedText = ""

    // Process each page
    for (let i = 1; i <= pagesToProcess; i++) {
      console.log(`[PDF-PROCESSOR] Processing page ${i}/${pagesToProcess}`)

      const page = await pdfDocument.getPage(i)

      // Extract text
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: TextItem) => item.str).join(" ")

      extractedText += `--- Page ${i} ---\n${pageText}\n\n`

      // Clean up page resources
      page.cleanup()
    }

    // Log completion
    await logProcessingEvent({
      processingId,
      userId,
      event: "processing_complete",
      details: `Processed ${pagesToProcess} pages in ${Date.now() - startTime}ms`,
    })

    return {
      success: true,
      text: extractedText,
      pageCount,
      processingId,
    }
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Error processing PDF:`, error)

    // Log error
    await logProcessingEvent({
      processingId,
      userId,
      event: "processing_error",
      details: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      processingId,
    }
  }
}

/**
 * Fallback method to extract text from PDF using a simpler approach
 */
export async function extractTextFromPDFFallback(
  fileBuffer: ArrayBuffer,
  userId: string,
): Promise<{
  success: boolean
  text?: string
  error?: string
}> {
  try {
    // Use pdf-parse as a fallback
    const pdfParse = require("pdf-parse")

    const dataBuffer = Buffer.from(fileBuffer)
    const data = await pdfParse(dataBuffer)

    return {
      success: true,
      text: data.text,
    }
  } catch (error) {
    console.error(`[PDF-PROCESSOR] Fallback extraction failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Log a PDF processing event
 */
async function logProcessingEvent({
  processingId,
  userId,
  fileName,
  fileSize,
  event,
  details,
  error,
}: {
  processingId: string
  userId: string
  fileName?: string
  fileSize?: number
  event: string
  details: string
  error?: Error
}) {
  try {
    await supabase.from("pdf_processing_logs").insert({
      processing_id: processingId,
      user_id: userId,
      file_name: fileName,
      file_size: fileSize,
      event,
      details,
      error_message: error?.message,
      error_stack: error?.stack,
      timestamp: new Date().toISOString(),
    })
  } catch (logError) {
    console.error(`[PDF-PROCESSOR] Failed to log processing event:`, logError)
    // Don't throw - logging should never break the main flow
  }
}
