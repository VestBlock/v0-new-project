import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { getOpenAIClient } from "@/lib/openai-server"

const _RoadmapPhaseSchema = z.object({
  /* ... */
})
const _BusinessSetupSchema = z.object({
  /* ... */
})
const _FundingOptionSchema = z.object({
  /* ... */
})
const RoadmapSchema = z.object({
  /* ... */
})
const _CreditScoreDetailSchema = z.object({
  /* ... */
})
const _AccountDetailSchema = z.object({
  /* ... */
})
const _NegativeItemSchema = z.object({
  /* ... */
})
const _InquirySchema = z.object({
  /* ... */
})
const _CreditCardRecommendationSchema = z.object({
  /* ... */
})
const _SideHustleRecommendationSchema = z.object({
  /* ... */
})
const DetailedAnalysisSchema = z.object({ roadmap: RoadmapSchema.nullable() /* ... other fields ... */ })
const AiResponseSchema = z.object({ summary: z.string().min(1), detailedAnalysis: DetailedAnalysisSchema /* ... */ })
type BackgroundAiResponse = z.infer<typeof AiResponseSchema> & {
  creditCardRecommendations?: unknown
  sideHustleRecommendations?: unknown
  letterContent?: string
}

async function _extractTextFromServerFile(_file: File): Promise<{ text: string; metadata: any }> {
  /* ... your impl ... */ return { text: "", metadata: {} }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = createClient()
  let jobId: string | null = null

  try {
    const body = await req.json().catch(() => null)
    jobId = body?.jobId

    if (!jobId) {
      const { data: pendingJob, error: fetchError } = await supabase
        .from("analysis_jobs")
        .select("id")
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (fetchError || !pendingJob) {
        return NextResponse.json({ success: true, message: "No pending jobs." })
      }
      jobId = pendingJob.id
    }
    if (!jobId) { 
      return NextResponse.json(
        { success: false, message: "Job ID not provided and no pending jobs found." },
        { status: 400 },
      )
    }

    const { data: job, error: jobFetchError } = await supabase
      .from("analysis_jobs")
      .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "PENDING")
      .select()
      .single()

    if (jobFetchError || !job) {
      console.error(
        `[BG Analyzer] Error fetching/updating job ${jobId} to PROCESSING or job not in PENDING state:`,
        jobFetchError?.message,
      )
      return NextResponse.json(
        { success: false, error: `Job ${jobId} not found or not in PENDING state.` },
        { status: 404 },
      )
    }

    let reportText: string | undefined
    const financialGoal = job.financial_goal_json as { title?: string } | null

    if (job.file_path) {
      try {
        console.warn(
          `[BG Analyzer] File processing skipped for job ${jobId} as Vercel Blob usage was removed. Implement alternative download for ${job.file_path}.`,
        )
        throw new Error("File processing logic needs to be implemented after Vercel Blob removal.")
      } catch (fileError) {
        const message = getErrorMessage(fileError)
        console.error(`[BG Analyzer] File processing error for job ${jobId}:`, message)
        await supabase
          .from("analysis_jobs")
          .update({
            status: "FILE_ERROR",
            error_details_json: {
              message: `File processing failed: ${message}`,
              name: "FileProcessingError",
            },
          })
          .eq("id", jobId)
        return NextResponse.json(
          { success: false, error: `File processing failed for job ${jobId}: ${message}` },
          { status: 500 },
        )
      }
    }

    const goalTitle = financialGoal?.title ?? "Unknown goal"
    const systemPromptContent = `You are an AI financial analyst... Goal: ${goalTitle}`
    const userPromptForObjectGeneration = `User goal: ${goalTitle}. ${reportText ? `Report text: ${reportText.substring(0, 500)}...` : "No report provided or file processing skipped."} Generate analysis...`

    const currentAiSchema = AiResponseSchema

    const openai = getOpenAIClient()
    if (!openai) {
      throw new Error("OpenAI API key is not configured.")
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${systemPromptContent}\n\nReturn only valid JSON.` },
        { role: "user", content: userPromptForObjectGeneration },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    })

    const rawAiContent = completion.choices[0]?.message?.content
    if (!rawAiContent) {
      throw new Error("OpenAI returned an empty analysis response.")
    }

    const parsedJson = JSON.parse(rawAiContent)
    const parsedAiData = currentAiSchema.passthrough().safeParse(parsedJson)
    if (!parsedAiData.success) {
      throw new Error(`OpenAI analysis response did not match the expected shape: ${parsedAiData.error.message}`)
    }

    const aiData = parsedAiData.data as BackgroundAiResponse

    const { data: storedResult, error: resultStoreError } = await supabase
      .from("analysis_results")
      .insert({
        job_id: jobId,
        summary: aiData.summary,
        detailed_analysis_json: aiData.detailedAnalysis,
        credit_card_recommendations_json: aiData.creditCardRecommendations,
        side_hustle_recommendations_json: aiData.sideHustleRecommendations,
        letter_content_text: aiData.letterContent,
        raw_ai_response_json: process.env.NODE_ENV === "development" ? { raw: rawAiContent } : undefined,
      })
      .select("id")
      .single()

    if (resultStoreError) {
      console.error(`[BG Analyzer] Error storing results for job ${jobId}:`, resultStoreError)
      await supabase
        .from("analysis_jobs")
        .update({
          status: "FAILED",
          error_details_json: { message: "Failed to store AI results.", name: "DatabaseResultStoreError" },
        })
        .eq("id", jobId)
      return NextResponse.json(
        { success: false, error: "Failed to store AI results for job " + jobId },
        { status: 500 },
      )
    }

    await supabase
      .from("analysis_jobs")
      .update({ status: "COMPLETED", result_id: storedResult.id, error_details_json: null })
      .eq("id", jobId)
    return NextResponse.json({ success: true, message: `Job ${jobId} completed.` })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error(`[BG Analyzer] General error processing job ${jobId || "unknown"}:`, message)
    if (jobId) {
      await supabase
        .from("analysis_jobs")
        .update({
          status: "FAILED",
          error_details_json: {
            message,
            name: error instanceof Error ? error.name : "GenericError",
            stack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
          },
        })
        .eq("id", jobId)
    }
    return NextResponse.json(
      { success: false, error: `Background analysis failed for job ${jobId || "unknown"}`, details: message },
      { status: 500 },
    )
  }
}
