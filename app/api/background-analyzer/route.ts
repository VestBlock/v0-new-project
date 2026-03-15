// This would be your Vercel Background Function
// For Vercel Hobby, you might need to simulate this with a cron job that calls this endpoint
// or use a database trigger (e.g., Supabase Edge Function on table insert).
// If this is a regular API route triggered by cron/webhook:
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server" // Adjust path if needed
// import { get } from "@vercel/blob"; // Removed Vercel Blob import
import { openai } from "@ai-sdk/openai" // Vercel AI SDK
import { generateObject } from "ai" // Vercel AI SDK
import { z } from "zod"
// Import your Zod schemas (AiResponseSchema, etc.) and extractTextFromServerFile
// For brevity, assuming they are defined elsewhere and imported.
// e.g. import { AiResponseSchema, DetailedAnalysisSchema, ... } from "@/lib/ai-schemas";
// e.g. import { extractTextFromServerFile } from "@/lib/server-document-processor";

// --- Zod Schemas (Copy from your existing enhanced-credit-analysis or a shared lib) ---
const RoadmapPhaseSchema = z.object({
  /* ... */
})
const BusinessSetupSchema = z.object({
  /* ... */
})
const FundingOptionSchema = z.object({
  /* ... */
})
const RoadmapSchema = z.object({
  /* ... */
})
const CreditScoreDetailSchema = z.object({
  /* ... */
})
const AccountDetailSchema = z.object({
  /* ... */
})
const NegativeItemSchema = z.object({
  /* ... */
})
const InquirySchema = z.object({
  /* ... */
})
const CreditCardRecommendationSchema = z.object({
  /* ... */
})
const SideHustleRecommendationSchema = z.object({
  /* ... */
})
const DetailedAnalysisSchema = z.object({ roadmap: RoadmapSchema.nullable() /* ... other fields ... */ })
const AiResponseSchema = z.object({ summary: z.string().min(1), detailedAnalysis: DetailedAnalysisSchema /* ... */ })
// --- End Zod Schemas ---
async function extractTextFromServerFile(file: File): Promise<{ text: string; metadata: any }> {
  /* ... your impl ... */ return { text: "", metadata: {} }
}

export const runtime = "nodejs" // Background functions are typically Node.js
export const maxDuration = 60 // Adjusted for Hobby plan limit

// This POST handler would be invoked by your trigger (cron, webhook, or programmatically)
// It could also fetch a batch of PENDING jobs if triggered by cron.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  let jobId: string | null = null

  try {
    const body = await req.json().catch(() => null) // Allow empty body if cron fetches job itself
    jobId = body?.jobId

    if (!jobId) {
      // If no jobId in body, try to fetch one PENDING job (for cron-like behavior)
      console.log("[BG Analyzer] No jobId in body, fetching oldest PENDING job.")
      const { data: pendingJob, error: fetchError } = await supabase
        .from("analysis_jobs")
        .select("id")
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (fetchError || !pendingJob) {
        console.log("[BG Analyzer] No PENDING jobs found or error fetching.", fetchError?.message)
        return NextResponse.json({ success: true, message: "No pending jobs." })
      }
      jobId = pendingJob.id
      console.log(`[BG Analyzer] Picked up PENDING job: ${jobId}`)
    }
    if (!jobId) {
      // Still no jobId
      return NextResponse.json(
        { success: false, message: "Job ID not provided and no pending jobs found." },
        { status: 400 },
      )
    }

    // --- 1. Fetch Job Details & Update Status to PROCESSING ---
    console.log(`[BG Analyzer] Processing job: ${jobId}`)
    const { data: job, error: jobFetchError } = await supabase
      .from("analysis_jobs")
      .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "PENDING") // Ensure we only process PENDING jobs to avoid race conditions
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
    const financialGoal = job.financial_goal_json as any // Cast to your FinancialGoal type

    // --- 2. Download File & Extract Text (if applicable) ---
    if (job.file_path) {
      try {
        console.log(`[BG Analyzer] Attempting to process file from: ${job.file_path}`)
        // TODO: Implement file download logic here.
        // If job.file_path points to a file in Supabase Storage, use the Supabase client:
        // e.g., const { data: blobData, error: downloadError } = await supabase.storage.from('your-bucket-name').download(job.file_path);
        // If it's a publicly accessible URL, you might use fetch().
        // The original code used Vercel Blob:
        // const blobResponse = await get(job.file_path); // This line is now removed/commented.
        // const fileBuffer = await blobResponse.arrayBuffer();
        // const file = new File([fileBuffer], job.original_file_name || "uploaded_file", {
        //   type: blobResponse.contentType || undefined,
        // });
        // const extractionResult = await extractTextFromServerFile(file);
        // if (extractionResult.metadata?.error || !extractionResult.text) {
        //   throw new Error(extractionResult.metadata?.error || "Text extraction failed or yielded no text.");
        // }
        // reportText = extractionResult.text;
        // console.log(`[BG Analyzer] Text extracted. Length: ${reportText.length}`);

        // For now, as Vercel Blob is removed and alternative is not implemented, we'll throw an error if file_path exists.
        // You should replace this with actual download and processing logic.
        console.warn(
          `[BG Analyzer] File processing skipped for job ${jobId} as Vercel Blob usage was removed. Implement alternative download for ${job.file_path}.`,
        )
        // To prevent errors if reportText is expected later, you might set it to an empty string or handle its absence.
        // For demonstration, we'll simulate a file error if a path was provided but not processed.
        throw new Error("File processing logic needs to be implemented after Vercel Blob removal.")
      } catch (fileError: any) {
        console.error(`[BG Analyzer] File processing error for job ${jobId}:`, fileError.message)
        await supabase
          .from("analysis_jobs")
          .update({
            status: "FILE_ERROR",
            error_details_json: {
              message: `File processing failed: ${fileError.message}`,
              name: "FileProcessingError",
            },
          })
          .eq("id", jobId)
        // It's important to decide if a file error should halt the entire analysis or if AI can proceed without file content.
        // For now, we return, assuming file content is critical.
        return NextResponse.json(
          { success: false, error: `File processing failed for job ${jobId}: ${fileError.message}` },
          { status: 500 },
        )
      }
    }

    // --- 3. Construct Prompts & Call AI ---
    // (Logic similar to your existing enhanced-credit-analysis route for system/user prompts)
    const systemPromptContent = `You are an AI financial analyst... Goal: ${financialGoal.title}` // Simplified
    const userPromptForObjectGeneration = `User goal: ${financialGoal.title}. ${reportText ? `Report text: ${reportText.substring(0, 500)}...` : "No report provided or file processing skipped."} Generate analysis...` // Simplified

    const currentAiSchema = AiResponseSchema

    console.log(`[BG Analyzer] Calling OpenAI for job ${jobId}`)
    const aiResult = await generateObject({
      model: openai("gpt-4o"),
      schema: currentAiSchema,
      prompt: userPromptForObjectGeneration,
      system: systemPromptContent,
      temperature: 0.3,
      maxTokens: 4000,
    })

    const aiData = aiResult.object
    console.log(`[BG Analyzer] AI generation successful for job ${jobId}`)

    // --- 4. Store Results & Update Job to COMPLETED ---
    const { data: storedResult, error: resultStoreError } = await supabase
      .from("analysis_results")
      .insert({
        job_id: jobId,
        summary: aiData.summary,
        detailed_analysis_json: aiData.detailedAnalysis,
        credit_card_recommendations_json: aiData.creditCardRecommendations,
        side_hustle_recommendations_json: aiData.sideHustleRecommendations,
        letter_content_text: aiData.letterContent,
        raw_ai_response_json: process.env.NODE_ENV === "development" ? aiResult : undefined,
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
    console.log(`[BG Analyzer] Job ${jobId} COMPLETED successfully. Result ID: ${storedResult.id}`)
    return NextResponse.json({ success: true, message: `Job ${jobId} completed.` })
  } catch (error: any) {
    console.error(`[BG Analyzer] General error processing job ${jobId || "unknown"}:`, error)
    if (jobId) {
      await supabase
        .from("analysis_jobs")
        .update({
          status: "FAILED",
          error_details_json: {
            message: error.message,
            name: error.name || "GenericError",
            stack: error.stack?.substring(0, 1000),
          },
        })
        .eq("id", jobId)
    }
    return NextResponse.json(
      { success: false, error: "Background analysis failed for job " + (jobId || "unknown"), details: error.message },
      { status: 500 },
    )
  }
}
