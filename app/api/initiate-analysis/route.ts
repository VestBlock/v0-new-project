import { type NextRequest, NextResponse } from "next/server"
import type { FinancialGoal, AnalysisJob } from "@/types/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseServer } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  try {
    const formData = await request.formData()
    const clientUserId = formData.get("clientUserId") as string | null
    const financialGoalString = formData.get("financialGoal") as string | null
    const originalFileName = formData.get("originalFileName") as string | null
    const fileType = formData.get("fileType") as string | null
    const fileSizeBytesString = formData.get("fileSizeBytes") as string | null
    const extractedText = formData.get("extractedText") as string | null
    const isLikelyCreditReportString = formData.get("isLikelyCreditReport") as string | null

    if (clientUserId && clientUserId !== user.id) {
      return NextResponse.json({ success: false, message: "User mismatch." }, { status: 403 })
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
    } catch {
      return NextResponse.json({ success: false, message: "Invalid financial goal format." }, { status: 400 })
    }

    const fileSizeBytes = Number.parseInt(fileSizeBytesString, 10)
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json({ success: false, message: "Invalid file size." }, { status: 400 })
    }

    const isLikelyCreditReport = isLikelyCreditReportString === "true"

    const jobDataToInsert: Partial<AnalysisJob> & { user_id: string; status: string } = {
      user_id: user.id,
      original_file_name: originalFileName,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
      financial_goal_title: financialGoal.title,
      financial_goal_details: financialGoal as any,
      extracted_text: extractedText,
      is_likely_credit_report: isLikelyCreditReport,
      status: "pending_ai_analysis",
      text_extraction_completed_at: new Date().toISOString(),
    }

    const { data: newJob, error: dbError } = await supabaseAdmin
      .from("analysis_jobs")
      .insert(jobDataToInsert as any)
      .select("id")
      .single()

    if (dbError) {
      console.error("[API /initiate-analysis] Supabase DB error inserting authorized job:", dbError)
      return NextResponse.json({ success: false, message: `Database error: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message: "Analysis job created. AI processing will begin shortly.",
    })
  } catch (error) {
    console.error("[API /initiate-analysis] Unexpected error:", getErrorMessage(error))
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "An unexpected error occurred.", details: String(error) },
      { status: 500 },
    )
  }
}
