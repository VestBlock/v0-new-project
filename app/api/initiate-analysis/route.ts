import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database, FinancialGoal, AnalysisJob } from "@/types/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30 // Reduced duration as no external PDF processing

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  console.log("[API /initiate-analysis] Request received for client-side extracted text.")
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  try {
    const formData = await request.formData()
    const clientUserId = formData.get("clientUserId") as string | null
    const financialGoalString = formData.get("financialGoal") as string | null
    const originalFileName = formData.get("originalFileName") as string | null
    const fileType = formData.get("fileType") as string | null
    const fileSizeBytesString = formData.get("fileSizeBytes") as string | null
    const extractedText = formData.get("extractedText") as string | null
    const isLikelyCreditReportString = formData.get("isLikelyCreditReport") as string | null

    if (!clientUserId) {
      return NextResponse.json({ success: false, message: "User ID is required." }, { status: 401 })
    }
    if (!financialGoalString) {
      return NextResponse.json({ success: false, message: "Financial goal is required." }, { status: 400 })
    }
    if (!originalFileName || !fileType || !fileSizeBytesString) {
      return NextResponse.json({ success: false, message: "File metadata is required." }, { status: 400 })
    }
    if (!extractedText) {
      return NextResponse.json({ success: false, message: "Extracted text is required." }, { status: 400 })
    }

    let financialGoal: FinancialGoal
    try {
      financialGoal = JSON.parse(financialGoalString) as FinancialGoal
    } catch (e) {
      return NextResponse.json({ success: false, message: "Invalid financial goal format." }, { status: 400 })
    }

    const fileSizeBytes = Number.parseInt(fileSizeBytesString, 10)
    const isLikelyCreditReport = isLikelyCreditReportString === "true"

    console.log(
      `[API /initiate-analysis] User: ${clientUserId}, File: ${originalFileName}, Goal: ${financialGoal.title}, Text length: ${extractedText.length}`,
    )

    const jobDataToInsert: Partial<AnalysisJob> & { user_id: string; status: string } = {
      user_id: clientUserId,
      original_file_name: originalFileName,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
      financial_goal_title: financialGoal.title,
      financial_goal_details: financialGoal as any,
      extracted_text: extractedText,
      is_likely_credit_report: isLikelyCreditReport,
      status: "pending_ai_analysis", // Ready for AI analysis by the job-status poller
      text_extraction_completed_at: new Date().toISOString(), // Text extraction happened client-side
    }

    const { data: newJob, error: dbError } = await supabase
      .from("analysis_jobs")
      .insert(jobDataToInsert as any)
      .select("id")
      .single()

    if (dbError) {
      console.error("[API /initiate-analysis] Supabase DB error inserting job:", dbError)
      return NextResponse.json({ success: false, message: `Database error: ${dbError.message}` }, { status: 500 })
    }

    console.log(
      `[API /initiate-analysis] New analysis job created in DB. Job ID: ${newJob.id}. Status: pending_ai_analysis`,
    )
    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message: "Analysis job created. AI processing will begin shortly.",
    })
  } catch (error: any) {
    console.error("[API /initiate-analysis] CATCH BLOCK ERROR:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred.", details: String(error) },
      { status: 500 },
    )
  }
}
