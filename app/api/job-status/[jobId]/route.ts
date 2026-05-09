import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database, AnalysisJob, AiDetailedAnalysis, RoadmapData } from "@/types/supabase"
// Removed PDF.co specific imports: checkPdfCoJobStatus, downloadTextFile
// import { isLikelyCreditReport } from "@/lib/text-utils"; // This is now in pdf-extraction-service or handled client side
import { getComprehensiveAnalysisPrompt } from "@/lib/prompt-utils"
import { getOpenAIClient } from "@/lib/openai-server"
import { enrichCreditAnalysisResults } from "@/lib/credit/recommendation-engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function triggerAiAnalysis(
  job: AnalysisJob,
): Promise<Partial<AnalysisJob>> {
  if (!job.extracted_text) {
    return { status: "failed", error_message: "Cannot perform AI analysis: Extracted text is missing." }
  }

  if (job.is_likely_credit_report === false) {
  }

  const prompt = getComprehensiveAnalysisPrompt({
    extractedText: job.extracted_text,
    userFinancialGoal: job.financial_goal_title || undefined,
    userContext:
      job.is_likely_credit_report === false
        ? "The uploaded document was flagged as not clearly matching a standard credit report. Be careful not to fabricate missing credit report details."
        : undefined,
  })

  try {
    const openai = getOpenAIClient()
    if (!openai) {
      throw new Error("OpenAI API key is not configured.")
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: "You are an expert financial analyst. Output ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const aiResponseContent = completion.choices[0]?.message?.content
    if (!aiResponseContent) {
      throw new Error("AI response content is empty.")
    }

    const parsedAiResponse = JSON.parse(aiResponseContent) as {
      detailedAnalysis: AiDetailedAnalysis
      roadmap: RoadmapData
      summary?: string
      creditCardRecommendations?: any[]
      sideHustleRecommendations?: any[]
    }

    if (!parsedAiResponse.detailedAnalysis || !parsedAiResponse.roadmap || !parsedAiResponse.roadmap.steps) {
      console.error(`[Job ${job.id}] AI response missing critical fields. Raw:`, aiResponseContent.substring(0, 500))
      throw new Error("AI response JSON structure is invalid.")
    }

    const enriched = enrichCreditAnalysisResults({
      extractedText: job.extracted_text,
      financialGoalTitle: job.financial_goal_title,
      detailedAnalysis: parsedAiResponse.detailedAnalysis,
      roadmap: parsedAiResponse.roadmap,
      existingCards: Array.isArray(parsedAiResponse.creditCardRecommendations)
        ? parsedAiResponse.creditCardRecommendations
        : null,
      existingSideHustles: Array.isArray(parsedAiResponse.sideHustleRecommendations)
        ? parsedAiResponse.sideHustleRecommendations
        : null,
    })

    const summaryBase =
      parsedAiResponse.summary || parsedAiResponse.detailedAnalysis.overall_summary || "AI analysis complete."

    return {
      status: "completed",
      ai_summary: `${summaryBase}\n\n${enriched.boostSummaryNote}`,
      ai_detailed_analysis: parsedAiResponse.detailedAnalysis,
      ai_roadmap_data: enriched.roadmap || parsedAiResponse.roadmap,
      ai_credit_card_recommendations: enriched.cards,
      ai_side_hustle_recommendations: enriched.sideHustles,
      ai_analysis_completed_at: new Date().toISOString(),
      error_message: null,
    }
  } catch (aiError) {
    console.error(`[Job ${job.id}] AI analysis failed:`, getErrorMessage(aiError))
    return { status: "failed", error_message: `AI analysis failed: ${getErrorMessage(aiError)}` }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  void request
  const { jobId } = await params
  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .single()

  if (fetchError || !job) {
    console.error(`[API /job-status/${jobId}] Error fetching job:`, fetchError)
    return NextResponse.json({ error: "Job not found or database error." }, { status: 404 })
  }

  let updatedFields: Partial<AnalysisJob> = {}
  let currentJobState = { ...job }

  try {
    if (currentJobState.status === "pending_ai_analysis") {
      updatedFields = { ...updatedFields, status: "ai_processing" }

      const { error: preAiUpdateError } = await supabaseAdmin
        .from("analysis_jobs")
        .update(updatedFields)
        .eq("id", jobId)
      if (preAiUpdateError) throw preAiUpdateError
      currentJobState = { ...currentJobState, ...updatedFields }

      const aiResults = await triggerAiAnalysis(currentJobState)
      updatedFields = { ...updatedFields, ...aiResults }
    }

    if (Object.keys(updatedFields).length > 0 && updatedFields.status && updatedFields.status !== job.status) {
      const { data: finalUpdatedJob, error: updateError } = await supabaseAdmin
        .from("analysis_jobs")
        .update(updatedFields)
        .eq("id", jobId)
        .select("*")
        .single()

      if (updateError) {
        console.error(`[Job ${jobId}] Error updating job in DB after processing:`, updateError)
        return NextResponse.json({ error: `Failed to save final updates: ${updateError.message}` }, { status: 500 })
      }
      currentJobState = finalUpdatedJob || currentJobState
    }

    return NextResponse.json({ job: currentJobState })
  } catch (error) {
    console.error(`[API /job-status/${jobId}] processing failed:`, getErrorMessage(error))
    try {
      await supabaseAdmin
        .from("analysis_jobs")
        .update({ status: "failed", error_message: `Job status processing error: ${getErrorMessage(error)}` })
        .eq("id", jobId)
    } catch (dbUpdateError) {
      console.error(`[API /job-status/${jobId}] Failed to update job status to failed in DB:`, dbUpdateError)
    }
    return NextResponse.json({ error: `Job status processing error: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
