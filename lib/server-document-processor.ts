// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js"; // STAY COMMENTED
import pdfParse from "pdf-parse" // <<< UNCOMMENTED: IMPORT PDF-PARSE

const MAX_FILE_SIZE_MB = 15
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export interface ServerExtractionResult {
  text: string
  metadata: {
    fileName: string
    fileType: string
    fileSize: number
    pageCount?: number
    extractionMethod: string
    warnings: string[]
    error?: string
    pdfParseImported?: boolean // New flag for this test
    pdfParseIsFunction?: boolean // New flag
    arrayBufferObtained?: boolean
    bufferConversionSuccessful?: boolean
    bufferLength?: number
  }
}

export async function processDocumentDirectly(file: File, clientUserId: string): Promise<ServerExtractionResult> {
  const metadata: ServerExtractionResult["metadata"] = {
    fileName: file?.name || "unknown.file",
    fileType: file?.type || "unknown",
    fileSize: file?.size || 0,
    extractionMethod: "pdf-parse_import_test_1.6.6",
    warnings: [],
    error: undefined,
    pdfParseImported: false,
    pdfParseIsFunction: false,
    arrayBufferObtained: false,
    bufferConversionSuccessful: false,
    bufferLength: 0,
  }

  console.log(`[SERVER_DOC_PROCESSOR_1.6.6] processDocumentDirectly CALLED for user: ${clientUserId}`)
  console.log(
    `[SERVER_DOC_PROCESSOR_1.6.6] File: ${metadata.fileName}, Type: ${metadata.fileType}, Size: ${metadata.fileSize} bytes`,
  )

  // Check if pdfParse was imported and is a function
  if (typeof pdfParse !== "undefined") {
    metadata.pdfParseImported = true
    console.log("[SERVER_DOC_PROCESSOR_1.6.6] pdfParse appears to be imported.")
    if (typeof pdfParse === "function") {
      metadata.pdfParseIsFunction = true
      console.log("[SERVER_DOC_PROCESSOR_1.6.6] pdfParse is a function.")
    } else {
      console.warn("[SERVER_DOC_PROCESSOR_1.6.6] pdfParse is imported BUT NOT A FUNCTION. Type:", typeof pdfParse)
      metadata.warnings.push("pdf-parse imported but is not a function.")
    }
  } else {
    console.error("[SERVER_DOC_PROCESSOR_1.6.6] CRITICAL: pdfParse IS UNDEFINED after import attempt!")
    metadata.error = "pdf-parse library failed to import or is undefined."
    // For this test, return immediately if import failed, as further steps are pointless.
    return { text: "Error: pdf-parse import failed.", metadata }
  }

  try {
    console.log("[SERVER_DOC_PROCESSOR_1.6.6] Performing basic file checks...")
    // ... (basic file checks as in 1.6.5 - size, empty) ...
    if (!file) {
      metadata.error = "File object is missing."
      return { text: "Error: File object missing.", metadata }
    }
    if (metadata.fileSize === 0) {
      metadata.error = "File is empty."
      return { text: "Error: File is empty.", metadata }
    }
    if (metadata.fileSize > MAX_FILE_SIZE_BYTES) {
      metadata.error = `File size (${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum of ${MAX_FILE_SIZE_MB}MB.`
      return { text: `Error: ${metadata.error}`, metadata }
    }
    console.log("[SERVER_DOC_PROCESSOR_1.6.6] Basic file checks PASSED.")

    if (metadata.fileType !== "application/pdf" && !metadata.fileName.toLowerCase().endsWith(".pdf")) {
      metadata.warnings.push("Skipped PDF-specific steps for non-PDF file type.")
      return { text: "Skipped PDF-specific steps for non-PDF file.", metadata }
    }

    console.log("[SERVER_DOC_PROCESSOR_1.6.6] PDF path: Attempting ArrayBuffer and Buffer conversion.")
    let arrayBuffer: ArrayBuffer | null = null
    try {
      arrayBuffer = await file.arrayBuffer()
      metadata.arrayBufferObtained = true
      metadata.bufferLength = arrayBuffer?.byteLength
      console.log(`[SERVER_DOC_PROCESSOR_1.6.6] ArrayBuffer obtained. Length: ${arrayBuffer?.byteLength}`)
    } catch (abError: any) {
      metadata.error = `Failed to get ArrayBuffer: ${abError.message}`
      return { text: "Error during ArrayBuffer step.", metadata }
    }

    if (arrayBuffer) {
      try {
        const nodeBuffer = Buffer.from(arrayBuffer)
        metadata.bufferConversionSuccessful = true
        metadata.bufferLength = nodeBuffer.length
        console.log(`[SERVER_DOC_PROCESSOR_1.6.6] Node.js Buffer conversion successful. Length: ${nodeBuffer.length}`)
      } catch (bufferError: any) {
        metadata.error = `Failed to convert to Buffer: ${bufferError.message}`
        return { text: "Error during Buffer conversion step.", metadata }
      }
    }

    // DO NOT CALL pdfParse(buffer) in this test.
    const resultText = `Test 1.6.6 Results: pdfParseImported: ${metadata.pdfParseImported}, pdfParseIsFunction: ${metadata.pdfParseIsFunction}. Buffer operations successful: ${metadata.bufferConversionSuccessful}. Errors: ${metadata.error || "None"}`
    console.log("[SERVER_DOC_PROCESSOR_1.6.6] pdf-parse import test completed. NO PARSING EXECUTED.")
    return { text: resultText, metadata }
  } catch (error: any) {
    console.error("[SERVER_DOC_PROCESSOR_1.6.6] !!!!! OUTER CATCH BLOCK HIT !!!!!")
    metadata.error = `Outer catch: ${error.message || "Unknown error"}`
    return { text: `Outer catch error: ${metadata.error}`, metadata }
  }
}

// isServerLikelyCreditReport function (can be simplified or kept as is for this test)
export function isServerLikelyCreditReport(text: string): boolean {
  console.log(`[ServerDocProcessor_1.6.6] isServerLikelyCreditReport called with text: "${text.substring(0, 100)}..."`)
  return true
}
