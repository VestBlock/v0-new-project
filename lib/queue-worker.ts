import { createClient } from "@supabase/supabase-js"
import {
  getNextQueueItem,
  updateQueueItemStatus,
  incrementQueueItemAttempts,
  processLargeTextWithOpenAI,
  ProcessingStatus,
} from "./openai-service"
import { createNotification } from "./notifications"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuration
const WORKER_INTERVAL_MS = 10000 // 10 seconds
const MAX_CONCURRENT_JOBS = 2

// Track running jobs
let runningJobs = 0
let isWorkerRunning = false

/**
 * Starts the queue worker
 */
export function startQueueWorker() {
  if (isWorkerRunning) {
    console.log("Queue worker is already running")
    return
  }

  isWorkerRunning = true
  console.log("Starting OpenAI processing queue worker")

  // Process the queue at regular intervals
  setInterval(processQueue, WORKER_INTERVAL_MS)

  // Start processing immediately
  processQueue()
}

/**
 * Processes the next items in the queue
 */
async function processQueue() {
  // If we're at max capacity, don't process more
  if (runningJobs >= MAX_CONCURRENT_JOBS) {
    return
  }

  // Process as many jobs as we can up to MAX_CONCURRENT_JOBS
  const availableSlots = MAX_CONCURRENT_JOBS - runningJobs

  for (let i = 0; i < availableSlots; i++) {
    const queueItem = await getNextQueueItem()

    if (!queueItem) {
      // No more items to process
      break
    }

    // Increment running jobs counter
    runningJobs++

    // Process the item in the background
    processQueueItem(queueItem)
      .catch((error) => {
        console.error(`Error processing queue item ${queueItem.id}:`, error)
      })
      .finally(() => {
        // Decrement running jobs counter
        runningJobs--
      })
  }
}

/**
 * Processes a single queue item
 */
async function processQueueItem(queueItem: any) {
  console.log(`Processing queue item ${queueItem.id} for analysis ${queueItem.analysisId}`)

  try {
    // Update status to processing
    await updateQueueItemStatus(queueItem.id, ProcessingStatus.PROCESSING)

    // Increment attempt counter
    await incrementQueueItemAttempts(queueItem.id)

    // Get the analysis data
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", queueItem.analysisId)
      .single()

    if (analysisError || !analysis) {
      throw new Error(`Analysis not found: ${analysisError?.message || "Unknown error"}`)
    }

    // Update analysis status
    await supabase.from("analyses").update({ status: "processing" }).eq("id", queueItem.analysisId)

    // Get the text to analyze
    const textToAnalyze = analysis.ocr_text || analysis.manual_text || ""

    if (!textToAnalyze) {
      throw new Error("No text to analyze")
    }

    // Define the analysis prompt
    const prompt = `
You are an expert credit analyst with deep knowledge of credit repair strategies, financial products, and side hustles. Analyze the following credit report text and provide a comprehensive analysis with the following sections:

1. Overview: 
   - IMPORTANT: If the credit report does NOT explicitly mention a credit score, set the score to null.
   - DO NOT make up or estimate a score if one is not clearly stated in the report.
   - If you cannot find a specific credit score number in the report, set score to null.
   - Only provide a score if it is explicitly mentioned in the report.
   - Provide a detailed summary of the credit report, and list positive and negative factors.

2. Disputes: Identify items that could be disputed, including the credit bureau, account name, account number, issue type, and recommended action. Be specific about why each item can be disputed.

3. Credit Hacks: Provide strategic, actionable recommendations to improve the credit score, including the potential impact (high/medium/low) and timeframe. Include specific steps the user should take with measurable outcomes.

4. Credit Card Recommendations: Based on the credit profile, recommend 3-5 specific credit cards that would be appropriate for the user, including details about APR, annual fees, rewards, and approval likelihood.

5. Side Hustles: Suggest diverse and creative income opportunities based on the credit profile, including potential earnings, startup costs, and difficulty level. Include both traditional and innovative options that can help improve financial situation.

Format your response as a JSON object with the following structure:
{
  "overview": {
    "score": number | null,
    "summary": string,
    "positiveFactors": string[],
    "negativeFactors": string[]
  },
  "disputes": {
    "items": [
      {
        "bureau": string,
        "accountName": string,
        "accountNumber": string,
        "issueType": string,
        "recommendedAction": string
      }
    ]
  },
  "creditHacks": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "impact": "high" | "medium" | "low",
        "timeframe": string,
        "steps": string[]
      }
    ]
  },
  "creditCards": {
    "recommendations": [
      {
        "name": string,
        "issuer": string,
        "annualFee": string,
        "apr": string,
        "rewards": string,
        "approvalLikelihood": "high" | "medium" | "low",
        "bestFor": string
      }
    ]
  },
  "sideHustles": {
    "recommendations": [
      {
        "title": string,
        "description": string,
        "potentialEarnings": string,
        "startupCost": string,
        "difficulty": "easy" | "medium" | "hard",
        "timeCommitment": string,
        "skills": string[]
      }
    ]
  }
}

IMPORTANT: 
- Your response must be ONLY the JSON object. Do not include any explanations, markdown formatting, or code blocks.
- If no credit score is found in the report, set "score" to null, not a number.
- DO NOT MAKE UP DATA. Only use information that is present in the credit report.
- If the report doesn't have enough information, acknowledge this in the summary and provide general advice.
`

    // Process the text with OpenAI
    const systemPrompt =
      "You are an expert credit analyst. Return ONLY valid JSON without any markdown, code blocks, or explanations. If you cannot find a credit score in the report, set score to null. DO NOT make up data."

    const result = await processLargeTextWithOpenAI(textToAnalyze, prompt, queueItem.userId, queueItem.id, {
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 4000,
      systemPrompt,
    })

    // Parse the result
    let analysisResult
    try {
      analysisResult = JSON.parse(result)
      console.log("Successfully parsed AI response as JSON")
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError)
      console.error("Raw AI response:", result)
      throw new Error("Failed to parse AI response as JSON. Please try again.")
    }

    // Validate the score is either null or a number between 300-850
    if (analysisResult.overview && analysisResult.overview.score !== null) {
      const score = Number(analysisResult.overview.score)
      if (isNaN(score) || score < 300 || score > 850) {
        console.log("Invalid score detected, setting to null", analysisResult.overview.score)
        analysisResult.overview.score = null
      }
    }

    // Update the analysis with the result
    await supabase
      .from("analyses")
      .update({
        status: "completed",
        result: analysisResult,
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueItem.analysisId)

    // Create a notification for the user
    await createNotification({
      userId: queueItem.userId,
      title: "Credit Analysis Complete",
      message:
        analysisResult.overview.score !== null
          ? `Your credit analysis is ready. Your estimated credit score is ${analysisResult.overview.score}.`
          : "Your credit analysis is ready. We couldn't determine a specific score from your report.",
      type: "success",
    })

    // Store the credit score in the credit_scores table ONLY if it's a valid score
    if (
      analysisResult.overview.score !== null &&
      analysisResult.overview.score >= 300 &&
      analysisResult.overview.score <= 850
    ) {
      await supabase.from("credit_scores").insert({
        user_id: queueItem.userId,
        bureau: "AI Estimate", // Since this is an AI estimate
        score: analysisResult.overview.score,
        date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
        source: "VestBlock Analysis",
        notes: "Score estimated from credit report analysis",
      })
    }

    // Update queue item status to completed
    await updateQueueItemStatus(queueItem.id, ProcessingStatus.COMPLETED)

    console.log(`Successfully processed queue item ${queueItem.id} for analysis ${queueItem.analysisId}`)
  } catch (error) {
    console.error(`Error processing queue item ${queueItem.id}:`, error)

    // Check if we've reached max attempts
    if (queueItem.attempts >= queueItem.max_attempts - 1) {
      // Mark as failed
      await updateQueueItemStatus(
        queueItem.id,
        ProcessingStatus.FAILED,
        error instanceof Error ? error.message : String(error),
      )

      // Update analysis status to error
      await supabase
        .from("analyses")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.analysisId)

      // Create an error notification for the user
      await createNotification({
        userId: queueItem.userId,
        title: "Analysis Failed",
        message:
          "We encountered an error analyzing your credit report. Please try again or contact support if the issue persists.",
        type: "error",
      })
    } else {
      // Requeue for retry
      await updateQueueItemStatus(
        queueItem.id,
        ProcessingStatus.QUEUED,
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}
