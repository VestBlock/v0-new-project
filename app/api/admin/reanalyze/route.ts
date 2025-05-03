import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeCredit } from "@/lib/openai-realtime-service"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Admin secret key for authorization
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  const startTime = performance.now()

  try {
    // Verify admin authorization
    const authHeader = request.headers.get("authorization")
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET_KEY}`) {
      console.error("Unauthorized admin access attempt")
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      )
    }

    // Get request body
    const body = await request.json()

    // Validate input
    if (!body.analysisId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: analysisId",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Get the analysis
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("id, user_id, ocr_text")
      .eq("id", body.analysisId)
      .single()

    if (analysisError || !analysis) {
      console.error("Error fetching analysis:", analysisError)
      return NextResponse.json(
        {
          success: false,
          error: "Analysis not found",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    // Check if OCR text is available
    if (!analysis.ocr_text) {
      return NextResponse.json(
        {
          success: false,
          error: "No OCR text available for re-analysis",
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Update analysis status to processing
    await supabase
      .from("analyses")
      .update({
        status: "processing",
        notes: "Re-analyzing with real-time OpenAI data...",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis.id)

    // Log the re-analysis start
    await supabase.from("analysis_logs").insert({
      analysis_id: analysis.id,
      user_id: analysis.user_id,
      event: "reanalysis_started",
      details: {
        requestedBy: "admin",
        timestamp: new Date().toISOString(),
      },
    })

    // Convert text to buffer
    const textEncoder = new TextEncoder()
    const fileBuffer = textEncoder.encode(analysis.ocr_text).buffer

    // Re-analyze
    const result = await analyzeCredit(fileBuffer, "reanalyzed-text.txt", analysis.user_id, {
      priority: body.priority || "normal",
    })

    // Log the result
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

    return NextResponse.json({
      success: result.success,
      analysisId: analysis.id,
      result: result.success ? result.result : null,
      error: result.success ? null : result.error,
      metrics: result.metrics,
      requestId,
      timestamp: new Date().toISOString(),
      processingTimeMs: Math.round(performance.now() - startTime),
    })
  } catch (error) {
    console.error("Error in re-analysis API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: Math.round(performance.now() - startTime),
      },
      { status: 500 },
    )
  }
}
