import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database, AnalysisJob, AiDetailedAnalysis, RoadmapData } from "@/types/supabase"
// Removed PDF.co specific imports: checkPdfCoJobStatus, downloadTextFile
// import { isLikelyCreditReport } from "@/lib/text-utils"; // This is now in pdf-extraction-service or handled client side
import { getComprehensiveAnalysisPrompt } from "@/lib/prompt-utils"
import { OpenAI } from "openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiApiKey = process.env.OPENAI_API_KEY!

const openai = new OpenAI({ apiKey: openaiApiKey })

async function triggerAiAnalysis(
  job: AnalysisJob,
  supabaseAdmin: ReturnType<typeof createClient<Database>>,
): Promise<Partial<AnalysisJob>> {
  console.log(`[Job ${job.id}] Triggering AI analysis. Text length: ${job.extracted_text?.length}`)
  if (!job.extracted_text) {
    return { status: "failed", error_message: "Cannot perform AI analysis: Extracted text is missing." }
  }

  // isLikelyCreditReport check is now done client-side and stored in job.is_likely_credit_report
  if (job.is_likely_credit_report === false) {
    // Check boolean false explicitly
    console.log(`[Job ${job.id}] Document was marked as not a likely credit report by client-side check.`)
    // Proceed with analysis but AI prompt might need to be adjusted or expect different results
    // Or, you could choose to return a specific message here.
    // For now, we'll let the AI try, but the prompt might need to be robust.
  }

  const prompt = getComprehensiveAnalysisPrompt(
    job.extracted_text,
    job.financial_goal_title || undefined,
    job.is_likely_credit_report,
  )

  try {
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
      // Add other expected fields like summary, cardRecs, sideHustles if your prompt generates them
      summary?: string
      creditCardRecommendations?: any[] // Define specific types later
      sideHustleRecommendations?: any[] // Define specific types later
    }

    if (!parsedAiResponse.detailedAnalysis || !parsedAiResponse.roadmap || !parsedAiResponse.roadmap.steps) {
      console.error(`[Job ${job.id}] AI response missing critical fields. Raw:`, aiResponseContent.substring(0, 500))
      throw new Error("AI response JSON structure is invalid.")
    }

    console.log(`[Job ${job.id}] AI analysis successful.`)
    return {
      status: "completed",
      ai_summary:
        parsedAiResponse.summary || parsedAiResponse.detailedAnalysis.overall_summary || "AI analysis complete.",
      ai_detailed_analysis: parsedAiResponse.detailedAnalysis,
      ai_roadmap_data: parsedAiResponse.roadmap,
      ai_credit_card_recommendations: parsedAiResponse.creditCardRecommendations || null,
      ai_side_hustle_recommendations: parsedAiResponse.sideHustleRecommendations || null,
      ai_analysis_completed_at: new Date().toISOString(),
      error_message: null,
    }
  } catch (aiError: any) {
    console.error(`[Job ${job.id}] AI Analysis Error:`, aiError)
    return { status: "failed", error_message: `AI analysis failed: ${aiError.message}` }
  }
}

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const jobId = params.jobId
  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
  }
  console.log(`[API /job-status/${jobId}] Request received.`)
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
    // No more PDF.co status check.
    // Directly check if job is pending AI analysis.
    if (currentJobState.status === "pending_ai_analysis") {
      console.log(`[Job ${jobId}] Status is pending_ai_analysis. Triggering AI analysis.`)
      updatedFields = { ...updatedFields, status: "ai_processing" }

      const { error: preAiUpdateError } = await supabaseAdmin
        .from("analysis_jobs")
        .update(updatedFields)
        .eq("id", jobId)
      if (preAiUpdateError) throw preAiUpdateError
      currentJobState = { ...currentJobState, ...updatedFields }

      const aiResults = await triggerAiAnalysis(currentJobState, supabaseAdmin)
      updatedFields = { ...updatedFields, ...aiResults }
      console.log(`[Job ${jobId}] AI analysis attempt completed. New status: ${aiResults.status}`)
    }

    if (Object.keys(updatedFields).length > 0 && updatedFields.status && updatedFields.status !== job.status) {
      console.log(`[Job ${jobId}] Updating job in DB with final results/status:`, Object.keys(updatedFields))
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
  } catch (error: any) {
    console.error(`[API /job-status/${jobId}] CATCH BLOCK ERROR:`, error)
    try {
      await supabaseAdmin
        .from("analysis_jobs")
        .update({ status: "failed", error_message: `Job status processing error: ${error.message}` })
        .eq("id", jobId)
    } catch (dbUpdateError) {
      console.error(`[API /job-status/${jobId}] Failed to update job status to failed in DB:`, dbUpdateError)
    }
    return NextResponse.json({ error: `Job status processing error: ${error.message}` }, { status: 500 })
  }
}
