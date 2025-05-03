/**
 * This script identifies and cleans up mock data in the analyses table
 * Run with: npx ts-node scripts/clean-mock-data.ts
 */

import { createClient } from "@supabase/supabase-js"
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

// Mock data indicators
const MOCK_DATA_INDICATORS = [
  "This is mock data",
  "Sample analysis",
  "Example credit report",
  "Test data",
  "Dummy data",
  "fallback analysis",
  "_isMockData",
  "Unable to determine",
  "Try again later",
  "mock credit report",
  "placeholder data",
  "example data",
  "sample data",
  "default data",
]

async function cleanMockData() {
  console.log("Starting mock data cleanup...")

  try {
    // Get all analyses
    const { data: analyses, error } = await supabase.from("analyses").select("id, result, status")

    if (error) {
      throw error
    }

    console.log(`Found ${analyses.length} total analyses`)

    // Identify analyses with mock data
    const mockAnalyses = analyses.filter((analysis) => {
      if (!analysis.result) return false

      const resultStr = typeof analysis.result === "string" ? analysis.result : JSON.stringify(analysis.result)
      return MOCK_DATA_INDICATORS.some((indicator) => resultStr.toLowerCase().includes(indicator.toLowerCase()))
    })

    console.log(`Found ${mockAnalyses.length} analyses with potential mock data`)

    if (mockAnalyses.length === 0) {
      console.log("No mock data found. Exiting.")
      return
    }

    // Confirm before proceeding
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    readline.question(
      `Found ${mockAnalyses.length} analyses with mock data. Do you want to mark them for re-analysis? (y/n) `,
      async (answer: string) => {
        if (answer.toLowerCase() === "y") {
          console.log("Marking analyses for re-analysis...")

          // Update each analysis with mock data
          for (const analysis of mockAnalyses) {
            const { error: updateError } = await supabase
              .from("analyses")
              .update({
                status: "needs_reanalysis",
                notes: "Marked for re-analysis due to detected mock data",
              })
              .eq("id", analysis.id)

            if (updateError) {
              console.error(`Error updating analysis ${analysis.id}:`, updateError)
            } else {
              console.log(`Marked analysis ${analysis.id} for re-analysis`)

              // Log the action
              await supabase.from("analysis_logs").insert({
                analysis_id: analysis.id,
                event: "marked_for_reanalysis",
                details: {
                  reason: "Mock data detected during cleanup",
                  timestamp: new Date().toISOString(),
                },
              })
            }
          }

          console.log("Mock data cleanup complete!")
        } else {
          console.log("Operation cancelled.")
        }

        readline.close()
      },
    )
  } catch (error) {
    console.error("Error cleaning mock data:", error)
  }
}

// Run the cleanup
cleanMockData()
