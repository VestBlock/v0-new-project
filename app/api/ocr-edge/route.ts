import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Define response types
type OCRSuccessResponse = {
  success: true
  text: string
  metadata: {
    processingTimeMs: number
    fileType: string
    fileSize: number
    model: string
  }
}

type OCRErrorResponse = {
  success: false
  error: string
  code: string
  details?: any
}

/**
 * Process a file with OCR using OpenAI's Vision model
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Check for valid OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI API key is not configured",
          code: "missing_api_key",
        } as OCRErrorResponse,
        { status: 500 },
      )
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Get form data from request
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (error) {
      console.error("Failed to parse form data:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse form data",
          code: "invalid_form_data",
        } as OCRErrorResponse,
        { status: 400 },
      )
    }

    const file = formData.get("file") as File | null

    // Validate file
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
          code: "missing_file",
        } as OCRErrorResponse,
        { status: 400 },
      )
    }

    // Check file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "File size exceeds 25MB limit",
          code: "file_too_large",
        } as OCRErrorResponse,
        { status: 400 },
      )
    }

    // Check file type
    const fileType = file.type || "application/octet-stream"
    const fileName = file.name || "unknown"
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || ""

    // Determine file type from extension if MIME type is not available
    const effectiveFileType =
      fileType !== "application/octet-stream"
        ? fileType
        : fileExtension === "pdf"
          ? "application/pdf"
          : fileExtension === "jpg" || fileExtension === "jpeg"
            ? "image/jpeg"
            : fileExtension === "png"
              ? "image/png"
              : fileExtension === "txt"
                ? "text/plain"
                : "application/octet-stream"

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "text/plain"]

    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "txt"]

    if (!allowedTypes.includes(effectiveFileType) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type not supported. Please upload a PDF, JPG, PNG, GIF, WebP, or TXT file. Received: ${fileType}, Extension: ${fileExtension}`,
          code: "unsupported_file_type",
          details: { fileType, fileExtension, fileName },
        } as OCRErrorResponse,
        { status: 400 },
      )
    }

    // Convert file to array buffer
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      console.error("Failed to read file:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to read file",
          code: "file_read_error",
          details: { error: String(error) },
        } as OCRErrorResponse,
        { status: 500 },
      )
    }

    // For text files, just decode and return the content
    if (effectiveFileType === "text/plain") {
      try {
        const textContent = new TextDecoder().decode(arrayBuffer)

        return NextResponse.json({
          success: true,
          text: textContent,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            fileType: effectiveFileType,
            fileSize: file.size,
            model: "direct-text-extraction",
          },
        } as OCRSuccessResponse)
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to decode text file",
            code: "text_decode_error",
            details: { error: String(error) },
          } as OCRErrorResponse,
          { status: 500 },
        )
      }
    }

    // For PDFs and images, use OpenAI Vision
    try {
      // Convert to base64
      const buffer = Buffer.from(arrayBuffer)
      const base64Data = buffer.toString("base64")
      const dataUri = `data:${effectiveFileType};base64,${base64Data}`

      // Process with OpenAI Vision model
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an OCR assistant. Extract ALL text from the provided image or PDF, preserving formatting where possible. Include ALL numbers, account details, and financial information. Format as plain text with appropriate line breaks.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this document. Be thorough and capture every detail visible in the document, including headers, footers, tables, and any small print.",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUri,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      })

      // Extract the text from the response
      const extractedText = response.choices[0]?.message?.content || ""

      // Return the extracted text
      return NextResponse.json({
        success: true,
        text: extractedText,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          fileType: effectiveFileType,
          fileSize: file.size,
          model: "gpt-4o",
        },
      } as OCRSuccessResponse)
    } catch (error) {
      console.error("OpenAI API error:", error)

      // Handle OpenAI API errors
      let errorMessage = "Failed to process with OpenAI"
      let errorCode = "openai_api_error"

      if (error instanceof Error) {
        errorMessage = error.message

        if (error.message.includes("API key")) {
          errorCode = "invalid_api_key"
        } else if (error.message.includes("rate limit")) {
          errorCode = "rate_limit_exceeded"
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: errorCode,
          details: { error: String(error) },
        } as OCRErrorResponse,
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("OCR Function error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred during OCR processing",
        code: "unknown_error",
        details: { error: String(error) },
      } as OCRErrorResponse,
      { status: 500 },
    )
  }
}
