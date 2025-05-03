import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create a singleton instance for server-side usage
let supabaseAdmin: ReturnType<typeof createClient> | null = null

// Get the admin client (server-side only)
export function getSupabaseAdmin() {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdmin
}

/**
 * Logs API verification results to the database
 */
export async function logApiVerificationToDb({
  endpoint,
  userId,
  requestId,
  isValid,
  isMockData,
  mockConfidence,
  issues,
  responseTimeMs,
}: {
  endpoint: string
  userId?: string
  requestId?: string
  isValid: boolean
  isMockData: boolean
  mockConfidence: number
  issues: string[]
  responseTimeMs?: number
}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error("Failed to initialize Supabase admin client for API verification logging")
    return { success: false, error: "Database connection failed" }
  }

  try {
    const { error } = await supabase.from("api_verification_logs").insert({
      id: uuidv4(),
      endpoint,
      user_id: userId || null,
      request_id: requestId || uuidv4(),
      is_valid: isValid,
      is_mock_data: isMockData,
      mock_confidence: mockConfidence,
      issues: issues,
      response_time_ms: responseTimeMs || null,
      timestamp: new Date().toISOString(),
    })

    if (error) {
      console.error("Error logging API verification:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to log API verification:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Retrieves recent API verification logs
 */
export async function getRecentApiVerificationLogs(limit = 50) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error("Failed to initialize Supabase admin client for API verification retrieval")
    return { success: false, error: "Database connection failed", logs: [] }
  }

  try {
    const { data, error } = await supabase
      .from("api_verification_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error retrieving API verification logs:", error)
      return { success: false, error: error.message, logs: [] }
    }

    return { success: true, logs: data }
  } catch (error) {
    console.error("Failed to retrieve API verification logs:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      logs: [],
    }
  }
}

/**
 * Gets summary statistics for API verification logs
 */
export async function getApiVerificationStats(timeframe: "day" | "week" | "month" = "day") {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error("Failed to initialize Supabase admin client for API verification stats")
    return { success: false, error: "Database connection failed" }
  }

  try {
    // Calculate the date range based on timeframe
    const now = new Date()
    let startDate: Date

    switch (timeframe) {
      case "week":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        break
      case "day":
      default:
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 1)
        break
    }

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from("api_verification_logs")
      .select("*", { count: "exact", head: true })
      .gte("timestamp", startDate.toISOString())

    if (countError) {
      throw new Error(`Error getting count: ${countError.message}`)
    }

    // Get mock data count
    const { count: mockDataCount, error: mockCountError } = await supabase
      .from("api_verification_logs")
      .select("*", { count: "exact", head: true })
      .eq("is_mock_data", true)
      .gte("timestamp", startDate.toISOString())

    if (mockCountError) {
      throw new Error(`Error getting mock count: ${mockCountError.message}`)
    }

    // Get endpoint stats
    const { data: endpointData, error: endpointError } = await supabase
      .from("api_verification_logs")
      .select("endpoint")
      .gte("timestamp", startDate.toISOString())

    if (endpointError) {
      throw new Error(`Error getting endpoint stats: ${endpointError.message}`)
    }

    // Calculate endpoint distribution
    const endpointCounts: Record<string, number> = {}
    endpointData.forEach((log) => {
      endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1
    })

    return {
      success: true,
      stats: {
        totalRequests: totalCount || 0,
        mockDataCount: mockDataCount || 0,
        mockDataPercentage: totalCount ? ((mockDataCount || 0) / totalCount) * 100 : 0,
        endpointDistribution: endpointCounts,
        timeframe,
      },
    }
  } catch (error) {
    console.error("Failed to get API verification stats:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
