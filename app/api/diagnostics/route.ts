import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkOpenAIDirectConnection } from "@/lib/openai-direct"
import { sanitizeForJson } from "@/lib/json-utils"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  // Only allow in development or with admin token
  const isAdmin = request.headers.get("x-admin-token") === process.env.ADMIN_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: "running",
    tests: {},
  }

  try {
    // Test 1: OpenAI Connection
    results.tests.openai = await testOpenAIConnection()

    // Test 2: Supabase Connection
    results.tests.supabase = await testSupabaseConnection()

    // Test 3: API Endpoints
    results.tests.endpoints = await testAPIEndpoints()

    // Test 4: Mock Data Detection
    results.tests.mockDataDetection = await detectMockData()

    // Overall status
    results.status = "completed"
    const hasErrors = Object.values(results.tests).some((test: any) => test.status === "error")
    results.overallStatus = hasErrors ? "error" : "success"

    return NextResponse.json(results)
  } catch (error) {
    console.error("Diagnostics error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

async function testOpenAIConnection() {
  try {
    const startTime = Date.now()
    const result = await checkOpenAIDirectConnection()
    const duration = Date.now() - startTime

    return {
      status: result.success ? "success" : "error",
      message: result.message,
      latencyMs: result.latencyMs || duration,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }
  }
}

async function testSupabaseConnection() {
  try {
    const startTime = Date.now()
    const { data, error } = await supabase.from("analyses").select("count").limit(1)
    const duration = Date.now() - startTime

    if (error) {
      return {
        status: "error",
        message: error.message,
        details: error,
        latencyMs: duration,
        timestamp: new Date().toISOString(),
      }
    }

    return {
      status: "success",
      message: "Successfully connected to Supabase",
      latencyMs: duration,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }
  }
}

async function testAPIEndpoints() {
  const results: Record<string, any> = {}
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Test health endpoint
  try {
    const startTime = Date.now()
    const response = await fetch(`${baseUrl}/api/health`)
    const duration = Date.now() - startTime
    const data = await response.json()

    results.health = {
      status: response.ok ? "success" : "error",
      statusCode: response.status,
      latencyMs: duration,
      data: sanitizeForJson(data),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    results.health = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }
  }

  // Add more endpoint tests as needed

  return results
}

async function detectMockData() {
  const results: Record<string, any> = {}

  // Check for mock data in recent analyses
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("id, result, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      return {
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      }
    }

    const mockDataIndicators = [
      "This is mock data",
      "Sample analysis",
      "Example credit report",
      "Test data",
      "Dummy data",
    ]

    const suspiciousAnalyses = data.filter((analysis) => {
      if (!analysis.result) return false

      const resultStr = typeof analysis.result === "string" ? analysis.result : JSON.stringify(analysis.result)

      return mockDataIndicators.some((indicator) => resultStr.toLowerCase().includes(indicator.toLowerCase()))
    })

    results.recentAnalyses = {
      status: suspiciousAnalyses.length > 0 ? "warning" : "success",
      message:
        suspiciousAnalyses.length > 0
          ? `Found ${suspiciousAnalyses.length} analyses with potential mock data`
          : "No mock data detected in recent analyses",
      suspiciousIds: suspiciousAnalyses.map((a) => a.id),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    results.recentAnalyses = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }
  }

  return results
}
