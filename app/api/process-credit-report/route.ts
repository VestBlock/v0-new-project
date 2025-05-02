import { type NextRequest, NextResponse } from "next/server"
import { processCreditReportImage } from "@/lib/openai-minimal"
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

    // Process the credit report with OpenAI
    const result = await processCreditReportImage(data.fileData)

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
        file_name: data.fileName || "uploaded-report.pdf",
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
