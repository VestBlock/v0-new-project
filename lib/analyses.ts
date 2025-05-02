import { supabase } from "./supabase"
import type { Analysis } from "./supabase"
import { sanitizeForJson, memoizedJsonParse } from "./json-utils"

// Cache for analyses to reduce database queries
const analysisCache = new Map<string, { analysis: Analysis; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute cache TTL

export async function getAnalysis(analysisId: string, userId: string): Promise<Analysis | null> {
  try {
    // Check cache first
    const cacheKey = `${userId}:${analysisId}`
    const cachedItem = analysisCache.get(cacheKey)

    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
      console.log(`Using cached analysis for ${analysisId}`)
      return cachedItem.analysis
    }

    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single()

    if (error) {
      console.error("Error getting analysis:", error)
      return null
    }

    // Check if data exists
    if (!data) {
      console.error("Analysis not found")
      return null
    }

    // Process the result field if it exists
    if (data.result) {
      // If result is a string, try to parse it
      if (typeof data.result === "string") {
        data.result = memoizedJsonParse(data.result)
      }

      // Sanitize the result to ensure it can be safely serialized
      data.result = sanitizeForJson(data.result)
    }

    // Check if result exists and create default if needed
    if (data.status === "completed" && !data.result) {
      console.warn("Analysis is marked as completed but has no result data")

      // Create a default result structure
      const defaultResult = {
        overview: {
          score: null,
          summary: "Analysis data is not available. This could be due to an incomplete processing or a system error.",
          positiveFactors: [],
          negativeFactors: [],
        },
        disputes: { items: [] },
        creditHacks: { recommendations: [] },
        creditCards: { recommendations: [] },
        sideHustles: { recommendations: [] },
      }

      // Update the analysis with the default result
      const { error: updateError } = await supabase
        .from("analyses")
        .update({ result: defaultResult })
        .eq("id", analysisId)

      if (updateError) {
        console.error("Error updating analysis with default result:", updateError)
      } else {
        // Update the local data object with the default result
        data.result = defaultResult
      }
    }

    // Cache the result
    analysisCache.set(cacheKey, {
      analysis: data as Analysis,
      timestamp: Date.now(),
    })

    return data as Analysis
  } catch (error) {
    console.error("Error getting analysis:", error)
    return null
  }
}

// Clear cache for a specific analysis
export function invalidateAnalysisCache(analysisId: string, userId: string): void {
  const cacheKey = `${userId}:${analysisId}`
  analysisCache.delete(cacheKey)
}

// Clear entire cache
export function clearAnalysisCache(): void {
  analysisCache.clear()
}

export async function getUserAnalyses(userId: string): Promise<Analysis[]> {
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Process each analysis result
    return (data as Analysis[]).map((analysis) => {
      // Process the result field if it exists
      if (analysis.result) {
        // If result is a string, try to parse it
        if (typeof analysis.result === "string") {
          try {
            analysis.result = JSON.parse(analysis.result)
          } catch (parseError) {
            console.error(`Error parsing result for analysis ${analysis.id}:`, parseError)
            analysis.result = null
          }
        }

        // Sanitize the result to ensure it can be safely serialized
        analysis.result = sanitizeForJson(analysis.result)
      }

      return analysis
    })
  } catch (error) {
    console.error("Error getting user analyses:", error)
    return []
  }
}

export async function searchAnalyses(userId: string, query: string): Promise<Analysis[]> {
  try {
    // Optimize the query by adding a limit
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .or(`notes.ilike.%${query}%,ocr_text.ilike.%${query}%,extracted_text.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(50) // Limit to 50 results for better performance

    if (error) throw error

    // Process each analysis result
    return (data as Analysis[]).map((analysis) => {
      // Process the result field if it exists
      if (analysis.result) {
        // If result is a string, try to parse it
        if (typeof analysis.result === "string") {
          try {
            analysis.result = JSON.parse(analysis.result)
          } catch (parseError) {
            console.error(`Error parsing result for analysis ${analysis.id}:`, parseError)
            analysis.result = null
          }
        }

        // Sanitize the result to ensure it can be safely serialized
        analysis.result = sanitizeForJson(analysis.result)
      }

      return analysis
    })
  } catch (error) {
    console.error("Error searching analyses:", error)
    return []
  }
}

export async function updateAnalysisNotes(analysisId: string, notes: string) {
  try {
    const { error } = await supabase.from("analyses").update({ notes }).eq("id", analysisId)

    if (error) throw error

    // Invalidate cache for this analysis
    invalidateAnalysisCache(analysisId, "any") // We don't know the userId here, so we use a placeholder

    return { success: true }
  } catch (error) {
    console.error("Error updating analysis notes:", error)
    return { success: false, error }
  }
}

// New function to batch fetch analyses for better performance
export async function batchGetAnalyses(analysisIds: string[], userId: string): Promise<Record<string, Analysis>> {
  if (!analysisIds.length) return {}

  try {
    const { data, error } = await supabase.from("analyses").select("*").eq("user_id", userId).in("id", analysisIds)

    if (error) throw error

    // Convert to a map for easy lookup
    const analysesMap: Record<string, Analysis> = {}

    // Process each analysis result
    data.forEach((analysis) => {
      // Process the result field if it exists
      if (analysis.result) {
        // If result is a string, try to parse it
        if (typeof analysis.result === "string") {
          try {
            analysis.result = JSON.parse(analysis.result)
          } catch (parseError) {
            console.error(`Error parsing result for analysis ${analysis.id}:`, parseError)
            analysis.result = null
          }
        }

        // Sanitize the result to ensure it can be safely serialized
        analysis.result = sanitizeForJson(analysis.result)
      }

      analysesMap[analysis.id] = analysis as Analysis
    })

    return analysesMap
  } catch (error) {
    console.error("Error batch getting analyses:", error)
    return {}
  }
}

// New function to get analysis statistics
export async function getAnalysisStatistics(userId: string): Promise<{
  total: number
  completed: number
  processing: number
  error: number
  averageScore: number | null
}> {
  try {
    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from("analyses")
      .select("status, count(*)")
      .eq("user_id", userId)
      .group("status")

    if (statusError) throw statusError

    // Get average score
    const { data: scoreData, error: scoreError } = await supabase
      .from("credit_scores")
      .select("score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5)

    if (scoreError) throw scoreError

    // Calculate statistics
    const counts = {
      total: 0,
      completed: 0,
      processing: 0,
      error: 0,
    }

    statusCounts.forEach((item: any) => {
      counts.total += item.count
      if (item.status === "completed") counts.completed += item.count
      if (item.status === "processing" || item.status === "queued") counts.processing += item.count
      if (item.status === "error") counts.error += item.count
    })

    // Calculate average score
    let averageScore = null
    if (scoreData.length > 0) {
      const sum = scoreData.reduce((acc, item) => acc + item.score, 0)
      averageScore = Math.round(sum / scoreData.length)
    }

    return {
      total: counts.total,
      completed: counts.completed,
      processing: counts.processing,
      error: counts.error,
      averageScore,
    }
  } catch (error) {
    console.error("Error getting analysis statistics:", error)
    return {
      total: 0,
      completed: 0,
      processing: 0,
      error: 0,
      averageScore: null,
    }
  }
}
