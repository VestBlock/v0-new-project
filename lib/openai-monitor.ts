import { supabase } from "./supabase"

// OpenAI monitoring interface
export interface OpenAIMonitoringStats {
  totalRequests: number
  successRate: number
  averageLatency: number
  errorBreakdown: Record<string, number>
  requestsPerDay: { date: string; count: number }[]
  costEstimate: number
}

/**
 * Get OpenAI usage statistics
 */
export async function getOpenAIStats(days = 30): Promise<OpenAIMonitoringStats> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Get all logs for the period
    const { data: logs, error } = await supabase
      .from("openai_logs")
      .select("*")
      .gte("timestamp", startDateStr)
      .order("timestamp", { ascending: false })

    if (error) {
      throw error
    }

    // Calculate statistics
    const totalRequests = logs.length
    const successfulRequests = logs.filter((log) => log.success).length
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

    // Calculate average latency
    const totalLatency = logs.reduce((sum, log) => sum + (log.latency_ms || 0), 0)
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0

    // Error breakdown
    const errorLogs = logs.filter((log) => !log.success)
    const errorBreakdown: Record<string, number> = {}

    errorLogs.forEach((log) => {
      const errorType = log.error_type || "unknown"
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1
    })

    // Requests per day
    const requestsByDay: Record<string, number> = {}
    logs.forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split("T")[0]
      requestsByDay[date] = (requestsByDay[date] || 0) + 1
    })

    const requestsPerDay = Object.entries(requestsByDay)
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Rough cost estimate (assuming GPT-4 Vision at $0.01 per 1K tokens)
    // This is a very rough estimate
    const totalTokens = logs.reduce((sum, log) => {
      // Rough estimate: 1 token ≈ 4 characters for English text
      const promptTokens = Math.ceil((log.prompt_length || 0) / 4)
      const responseTokens = Math.ceil((log.response_length || 0) / 4)
      return sum + promptTokens + responseTokens
    }, 0)

    const costEstimate = (totalTokens / 1000) * 0.01

    return {
      totalRequests,
      successRate,
      averageLatency,
      errorBreakdown,
      requestsPerDay,
      costEstimate,
    }
  } catch (error) {
    console.error("Error getting OpenAI stats:", error)
    throw error
  }
}

/**
 * Get recent OpenAI errors
 */
export async function getRecentOpenAIErrors(limit = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("openai_logs")
      .select("*")
      .eq("success", false)
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error getting recent OpenAI errors:", error)
    throw error
  }
}

/**
 * Get OpenAI usage by user
 */
export async function getOpenAIUsageByUser(
  days = 30,
): Promise<{ user_id: string; request_count: number; success_rate: number }[]> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Get usage stats grouped by user
    const { data, error } = await supabase.rpc("get_openai_usage_by_user", {
      days_ago: days,
    })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error getting OpenAI usage by user:", error)
    throw error
  }
}
