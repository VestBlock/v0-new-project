/**
 * This script processes analyses marked for re-analysis
 * Run with: npx ts-node scripts/batch-reanalyze.ts
 */

import { createClient } from "@supabase/supabase-js"
import { analyzeCredit } from "@/lib/openai-realtime-service"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials. Please check your environment variables.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuration
const BATCH_SIZE = 5
const MAX_ANALYSES = 50
const DELAY_BETWEEN_ANALYSES_MS = 5000

async function batchReanalyze() {
  console.log("Starting batch re-analysis...")

  try {
    // Get analyses marked for re-analysis
    const { data: analyses, error } = await supabase
      .from("analyses")
      .select("id, user_id, ocr_text")
      .eq("status", "needs_reanalysis")
      .order("created_at", { ascending: true })
      .limit(MAX_ANALYSES)

    if (error) {
      throw error
    }

    if (!analyses || analyses.length === 0) {
      console.log("No analyses found that need re-analysis. Exiting.")
      return
    }

    console.log(`Found ${analyses.length} analyses that need re-analysis`)

    // Confirm before proceeding
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    readline.question(
      `Ready to re-analyze ${analyses.length} analyses. This will use OpenAI API credits. Proceed? (y/n) `,
      async (answer: string) => {
        if (answer.toLowerCase() === "y") {
          console.log("Starting re-analysis...")

          // Process in batches
          for (let i = 0; i < analyses.length; i += BATCH_SIZE) {
            const batch = analyses.slice(i, i + BATCH_SIZE)
            console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(analyses.length / BATCH_SIZE)}`)

            // Process each analysis in the batch
            for (const analysis of batch) {
              try {
                console.log(`Re-analyzing analysis ${analysis.id}...`)

                // Skip if no OCR text
                if (!analysis.ocr_text) {
                  console.log(`Skipping analysis ${analysis.id} - no OCR text available`)

                  await supabase
                    .from("analyses")
                    .update({
                      status: "error",
                      notes: "Re-analysis skipped - no OCR text available",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", analysis.id)

                  continue
                }

                // Convert text to buffer
                const textEncoder = new TextEncoder()
                const fileBuffer = textEncoder.encode(analysis.ocr_text).buffer

                // Re-analyze
                const result = await analyzeCredit(fileBuffer, "reanalyzed-text.txt", analysis.user_id, {
                  priority: "low",
                })

                console.log(`Re-analysis of ${analysis.id} ${result.success ? "succeeded" : "failed"}`)

                // Log the re-analysis
                await supabase.from("analysis_logs").insert({
                  analysis_id: analysis.id,
                  user_id: analysis.user_id,
                  event: result.success ? "reanalysis_completed" : "reanalysis_failed",
                  details: {
                    success: result.success,
                    error: result.error,
                    metrics: result.metrics,
                    timestamp: new Date().toISOString(),
                  },
                })
              } catch (analysisError) {
                console.error(`Error re-analyzing ${analysis.id}:`, analysisError)

                // Update analysis with error
                await supabase
                  .from("analyses")
                  .update({
                    status: "error",
                    notes: `Re-analysis failed: ${analysisError instanceof Error ? analysisError.message : "Unknown error"}`,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", analysis.id)
              }

              // Wait between analyses to avoid rate limiting
              if (analysis !== batch[batch.length - 1]) {
                console.log(`Waiting ${DELAY_BETWEEN_ANALYSES_MS / 1000} seconds before next analysis...`)
                await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_ANALYSES_MS))
              }
            }
          }

          console.log("Batch re-analysis complete!")
        } else {
          console.log("Operation cancelled.")
        }

        readline.close()
      },
    )
  } catch (error) {
    console.error("Error in batch re-analysis:", error)
  }
}

// Run the batch re-analysis
batchReanalyze()
