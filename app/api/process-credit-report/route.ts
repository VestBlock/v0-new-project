import { type NextRequest, NextResponse } from "next/server"
import { processCreditReportImage, processCreditReportText, callOpenAI } from "@/lib/openai-minimal"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    // Get the file data from the request
    const data = await request.json()

    if (!data.fileData) {
      return NextResponse.json({ error: "No file data provided" }, { status: 400 })
    }

    let result: string

    // Check if the file is an image or PDF based on the data URL
    if (data.fileData.startsWith("data:image")) {
      // Process image with Vision API
      result = await processCreditReportImage(data.fileData)
    } else if (data.fileData.startsWith("data:application/pdf")) {
      // For PDFs, we can't use the Vision API directly
      // Extract the base64 content without the prefix
      const base64Content = data.fileData.split(",")[1]

      // For this example, we'll just send a message that PDF processing requires text extraction
      result = await callOpenAI(
        "This appears to be a PDF file. To process PDFs, you would need to extract the text first using a PDF parsing library. For this demo, I'll return a sample credit report analysis structure.",
      )
    } else if (data.textContent) {
      // If text content is provided directly
      result = await processCreditReportText(data.textContent)
    } else {
      // Unsupported file type
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload an image (JPEG, PNG) of your credit report.",
        },
        { status: 400 },
      )
    }

    // Try to parse the result as JSON
    let parsedResult
    try {
      parsedResult = JSON.parse(result)
    } catch (e) {
      // If parsing fails, return the raw text
      parsedResult = { rawText: result }
    }

    // Save the result to Supabase if user ID is provided
    if (data.userId) {
      await supabase.from("analyses").insert({
        user_id: data.userId,
        result: parsedResult,
        file_name: data.fileName || "uploaded-report",
        status: "completed",
      })
    }

    return NextResponse.json({ success: true, result: parsedResult })
  } catch (error) {
    console.error("Error processing credit report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
