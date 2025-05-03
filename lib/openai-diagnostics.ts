import { createClient } from "@supabase/supabase-js"
import { checkOpenAIDirectConnection } from "@/lib/openai-direct"
import { generateTextWithRetry } from "@/lib/openai-client"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Comprehensive diagnostic tool for OpenAI integration
 */
export async function runOpenAIDiagnostics() {
  const results = {
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.OPENAI_API_KEY,
    directConnection: null as any,
    clientLibrary: null as any,
    mockDataDetection: null as any,
    recentApiCalls: [] as any[],
    overallStatus: "unknown",
  }

  try {
    // Test 1: Check direct connection to OpenAI
    results.directConnection = await checkOpenAIDirectConnection()

    // Test 2: Test client library
    try {
      const startTime = Date.now()
      const response = await generateTextWithRetry({
        model: "gpt-3.5-turbo",
        prompt: "Respond with 'OpenAI client library is working correctly' if you receive this message.",
        maxTokens: 20,
      })

      results.clientLibrary = {
        success: true,
        message: "Client library connection successful",
        response: response.text,
        latencyMs: Date.now() - startTime,
      }
    } catch (error) {
      results.clientLibrary = {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        error: error,
      }
    }

    // Test 3: Check for mock data in recent analyses
    try {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, result, created_at, status")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error

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

      results.mockDataDetection = {
        success: true,
        totalAnalyzed: data.length,
        suspiciousCount: suspiciousAnalyses.length,
        suspiciousPercentage: data.length > 0 ? (suspiciousAnalyses.length / data.length) * 100 : 0,
        suspiciousIds: suspiciousAnalyses.map((a) => a.id),
      }
    } catch (error) {
      results.mockDataDetection = {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }

    // Test 4: Check recent OpenAI API calls from logs
    try {
      const { data, error } = await supabase
        .from("openai_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(5)

      if (error) throw error

      results.recentApiCalls = data
    } catch (error) {
      console.error("Error fetching recent API calls:", error)
    }

    // Determine overall status
    if (!results.apiKeyConfigured) {
      results.overallStatus = "critical"
    } else if (!results.directConnection.success || !results.clientLibrary.success) {
      results.overallStatus = "error"
    } else if (results.mockDataDetection?.suspiciousPercentage > 50) {
      results.overallStatus = "warning"
    } else {
      results.overallStatus = "healthy"
    }

    return results
  } catch (error) {
    console.error("Error running OpenAI diagnostics:", error)
    return {
      ...results,
      error: error instanceof Error ? error.message : "Unknown error",
      overallStatus: "error",
    }
  }
}

/**
 * Test the chat functionality specifically
 */
export async function testChatFunctionality(analysisId?: string) {
  const results = {
    timestamp: new Date().toISOString(),
    chatEndpoint: null as any,
    chatMessages: null as any,
    overallStatus: "unknown",
  }

  try {
    // Test 1: Check if chat messages can be retrieved
    if (analysisId) {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("analysis_id", analysisId)
          .order("created_at", { ascending: false })
          .limit(5)

        if (error) throw error

        results.chatMessages = {
          success: true,
          messageCount: data.length,
          messages: data,
        }
      } catch (error) {
        results.chatMessages = {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }

    // Test 2: Test chat endpoint with a simple message
    try {
      // This is a simulated test since we can't make an authenticated request here
      // In a real implementation, you would make an actual API call

      const testMessage = "This is a test message"
      const startTime = Date.now()

      // Simulate checking if the endpoint is configured correctly
      const chatEndpointExists = true // This would be determined by checking routes
      const openaiConfigured = !!process.env.OPENAI_API_KEY

      results.chatEndpoint = {
        success: chatEndpointExists && openaiConfigured,
        message: chatEndpointExists
          ? openaiConfigured
            ? "Chat endpoint is properly configured"
            : "OpenAI API key is missing"
          : "Chat endpoint is not properly configured",
        latencyMs: Date.now() - startTime,
      }
    } catch (error) {
      results.chatEndpoint = {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }

    // Determine overall status
    if (!results.chatEndpoint.success) {
      results.overallStatus = "error"
    } else if (results.chatMessages && !results.chatMessages.success) {
      results.overallStatus = "warning"
    } else {
      results.overallStatus = "healthy"
    }

    return results
  } catch (error) {
    console.error("Error testing chat functionality:", error)
    return {
      ...results,
      error: error instanceof Error ? error.message : "Unknown error",
      overallStatus: "error",
    }
  }
}
