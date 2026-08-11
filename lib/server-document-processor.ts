import { parsePdfBuffer } from "@/lib/pdf/parse"

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
    extractionMethod: "server-buffer-validation",
    warnings: [],
    error: undefined,
    pdfParseImported: false,
    pdfParseIsFunction: false,
    arrayBufferObtained: false,
    bufferConversionSuccessful: false,
    bufferLength: 0,
  }

  void clientUserId;

  if (typeof parsePdfBuffer !== "undefined") {
    metadata.pdfParseImported = true
    if (typeof parsePdfBuffer === "function") {
      metadata.pdfParseIsFunction = true
    } else {
      metadata.warnings.push("pdf-parse imported but is not a function.")
    }
  } else {
    metadata.error = "pdf-parse library failed to import or is undefined."
    return { text: "Error: pdf-parse import failed.", metadata }
  }

  try {
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

    if (metadata.fileType !== "application/pdf" && !metadata.fileName.toLowerCase().endsWith(".pdf")) {
      metadata.warnings.push("Skipped PDF-specific steps for non-PDF file type.")
      return { text: "Skipped PDF-specific steps for non-PDF file.", metadata }
    }

    let arrayBuffer: ArrayBuffer | null = null
    try {
      arrayBuffer = await file.arrayBuffer()
      metadata.arrayBufferObtained = true
      metadata.bufferLength = arrayBuffer?.byteLength
    } catch (abError: any) {
      metadata.error = `Failed to get ArrayBuffer: ${abError.message}`
      return { text: "Error during ArrayBuffer step.", metadata }
    }

    if (arrayBuffer) {
      try {
        const nodeBuffer = Buffer.from(arrayBuffer)
        metadata.bufferConversionSuccessful = true
        metadata.bufferLength = nodeBuffer.length
      } catch (bufferError: any) {
        metadata.error = `Failed to convert to Buffer: ${bufferError.message}`
        return { text: "Error during Buffer conversion step.", metadata }
      }
    }

    const resultText = `Buffer validation results: pdfParseImported=${metadata.pdfParseImported}, pdfParseIsFunction=${metadata.pdfParseIsFunction}, bufferConversionSuccessful=${metadata.bufferConversionSuccessful}, error=${metadata.error || "none"}`
    return { text: resultText, metadata }
  } catch (error: any) {
    metadata.error = `Outer catch: ${error.message || "Unknown error"}`
    return { text: `Outer catch error: ${metadata.error}`, metadata }
  }
}

export function isServerLikelyCreditReport(text: string): boolean {
  return text.trim().length > 0
}
