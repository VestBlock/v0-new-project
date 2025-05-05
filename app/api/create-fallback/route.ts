import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"
import { createNotification } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  console.log("[CREATE-FALLBACK] API called")

  // Ensure we always return JSON
  try {
    // Authenticate the user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("[CREATE-FALLBACK] Error: No authorization header")
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: { "Content-Type": "application/json" } },
      )
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("[CREATE-FALLBACK] Error: Authentication failed", authError)
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: authError?.message },
        { status: 401, headers: { "Content-Type": "application/json" } },
      )
    }

    console.log(`[CREATE-FALLBACK] User authenticated: ${user.id}`)

    // Create a fallback analysis
    try {
      // Create a new analysis record in the database
      const { data: analysis, error } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          status: "completed",
          file_path: "sample-report.pdf", // Using file_path instead of file_name
          ocr_text: "This is a sample OCR text for demonstration purposes.", // Required field
          notes: "This is a sample analysis created for demonstration purposes.",
          result: {
            overview: {
              score: 680,
              summary: "This is a sample credit analysis for demonstration purposes.",
              positiveFactors: ["Regular on-time payments on most accounts", "Low credit utilization"],
              negativeFactors: ["Length of credit history", "Recent credit inquiries"],
            },
            disputes: {
              items: [
                {
                  bureau: "Example Bureau",
                  accountName: "Example Bank",
                  accountNumber: "XXXX1234",
                  issueType: "Late Payment",
                  recommendedAction: "Dispute inaccurate information",
                },
                {
                  bureau: "Example Bureau 2",
                  accountName: "Example Credit Card",
                  accountNumber: "XXXX5678",
                  issueType: "Account Not Mine",
                  recommendedAction: "Request account verification",
                },
              ],
            },
            creditHacks: {
              recommendations: [
                {
                  title: "Reduce Credit Utilization",
                  description: "Pay down credit card balances to below 30% of your credit limits.",
                  impact: "high",
                  timeframe: "1-2 months",
                  steps: ["Make extra payments", "Ask for credit limit increases"],
                },
                {
                  title: "Become an Authorized User",
                  description: "Ask a family member with good credit to add you as an authorized user.",
                  impact: "medium",
                  timeframe: "1 month",
                  steps: ["Identify family member with good credit", "Request to be added as authorized user"],
                },
              ],
            },
            creditCards: {
              recommendations: [
                {
                  name: "Example Cash Back Card",
                  issuer: "Example Bank",
                  annualFee: "$0",
                  apr: "15.99% - 24.99%",
                  rewards: "2% cash back on all purchases",
                  approvalLikelihood: "medium",
                  bestFor: "Everyday spending",
                },
                {
                  name: "Example Travel Card",
                  issuer: "Example Credit Union",
                  annualFee: "$95",
                  apr: "16.99% - 23.99%",
                  rewards: "3x points on travel and dining",
                  approvalLikelihood: "high",
                  bestFor: "Travel enthusiasts",
                },
              ],
            },
            sideHustles: {
              recommendations: [
                {
                  title: "Freelance Writing",
                  description: "Offer writing services for blogs and websites.",
                  potentialEarnings: "$500-$2000/month",
                  startupCost: "Low",
                  difficulty: "medium",
                  timeCommitment: "10-20 hours/week",
                  skills: ["Writing", "Research", "SEO knowledge"],
                },
                {
                  title: "Food Delivery",
                  description: "Deliver food with apps like DoorDash or Uber Eats.",
                  potentialEarnings: "$15-$25/hour",
                  startupCost: "Low",
                  difficulty: "low",
                  timeCommitment: "Flexible",
                  skills: ["Driving", "Time management", "Customer service"],
                },
              ],
            },
          },
        })
        .select()
        .single()

      if (error) {
        console.error("[CREATE-FALLBACK] Error creating analysis:", error)
        return NextResponse.json(
          {
            success: false,
            error: `Failed to create analysis: ${error.message}`,
            details: {
              code: error.code,
              hint: error.hint,
              details: error.details,
            },
          },
          { status: 500, headers: { "Content-Type": "application/json" } },
        )
      }

      // Create a notification
      try {
        await createNotification({
          userId: user.id,
          title: "Sample Analysis Created",
          message: "A sample credit analysis has been created for demonstration purposes.",
          type: "info",
        })
      } catch (notifError) {
        console.error("[CREATE-FALLBACK] Failed to create notification:", notifError)
        // Continue even if notification fails
      }

      console.log("[CREATE-FALLBACK] Analysis created successfully:", analysis.id)

      // Return success response
      return NextResponse.json(
        {
          success: true,
          data: {
            analysisId: analysis.id,
            message: "Sample analysis created successfully",
          },
        },
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    } catch (error) {
      console.error("[CREATE-FALLBACK] Error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create sample analysis",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }
  } catch (error) {
    console.error("[CREATE-FALLBACK] Unhandled exception:", error)

    // Ensure we always return JSON
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
