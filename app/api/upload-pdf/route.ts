import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import { processPDF } from "@/lib/pdf-processor"
import { createNotification } from "@/lib/notifications"


// Configure for longer execution time
export const config = {
  runtime: "nodejs",
  maxDuration: 300, // 5 minutes for thorough processing
}

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  console.log("[UPLOAD-PDF] API route called")
  const startTime = Date.now()

  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("[UPLOAD-PDF] User authenticated:", user.id)

    // Get the form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only PDF files are accepted." },
        { status: 400 },
      )
    }

    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024 // 25MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: "File too large. Maximum size is 25MB." }, { status: 400 })
    }

    console.log(`[UPLOAD-PDF] Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`)

    // Create a notification for the user that processing is starting
    try {
      await createNotification({
        userId: user.id,
        title: "PDF Upload Started",
        message: "Your credit report PDF is being processed. This may take a few minutes.",
        type: "info",
      })
    } catch (notifError) {
      console.error("Failed to create start notification:", notifError)
      // Continue anyway, this is not critical
    }

    // Generate a unique ID for the analysis
    const analysisId = uuidv4()

    // Create an initial analysis record
    const { error: insertError } = await supabase.from("analyses").insert({
      id: analysisId,
      user_id: user.id,
      file_path: file.name,
      ocr_text: "",
      status: "processing",
      notes: "Processing PDF upload",
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("Error creating analysis record:", insertError)
      return NextResponse.json({ success: false, error: "Failed to create analysis record" }, { status: 500 })
    }

    // Convert file to ArrayBuffer for processing
    const fileBuffer = await file.arrayBuffer()

    // Process the PDF file
    const processingResult = await processPDF(fileBuffer, file.name, user.id)
    console.log("🚀 ~ POST ~ processingResult:", processingResult)

    if (!processingResult.success) {
      console.error("PDF processing failed:", processingResult.error)

      // Update the analysis record with the error
      await supabase
        .from("analyses")
        .update({
          status: "error",
          notes: `Error processing PDF: ${processingResult.error}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId)

      // Create an error notification for the user
      try {
        await createNotification({
          userId: user.id,
          title: "PDF Processing Failed",
          message: `We encountered an error processing your PDF: ${processingResult.error}. Please try again.`,
          type: "error",
        })
      } catch (notifError) {
        console.error("Failed to create error notification:", notifError)
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to process PDF",
          details: processingResult.error,
          analysisId,
        },
        { status: 500 },
      )
    }

    console.log("[UPLOAD-PDF] PDF processing completed successfully")

    // Update the analysis record with the extracted text and result
    await supabase
      .from("analyses")
      .update({
        ocr_text: processingResult.extractedText,
        result: processingResult.analysis,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    // Create a success notification for the user
    try {
      await createNotification({
        userId: user.id,
        title: "PDF Processing Complete",
        message: "Your credit report PDF has been processed successfully.",
        type: "success",
      })
    } catch (notificationError) {
      console.error("Failed to create success notification:", notificationError)
    }

    const endTime = performance.now()

    return NextResponse.json({
      success: true,
      analysisId,
      result: processingResult.analysis,
      metrics: {
        ...processingResult.metrics,
        totalProcessingTimeMs: Math.round(endTime - startTime),
      },
    })
  } catch (error) {
    console.error("[UPLOAD-PDF] API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
