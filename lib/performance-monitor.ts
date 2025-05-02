/**
 * Performance Monitoring Utility
 *
 * Tracks and analyzes performance metrics for OpenAI operations
 * within the Vercel environment.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Environment variables with fallbacks
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create Supabase client with safety checks
let supabase: ReturnType<typeof createClient<Database>> | null = null
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
  } catch (error) {
    console.error("Failed to initialize Supabase client for performance monitoring:", error)
  }
}

// Performance metrics storage
interface PerformanceMetric {
  operation: string
  durationMs: number
  success: boolean
  timestamp: number
  metadata?: Record<string, any>
}

// In-memory metrics storage (for when Supabase is unavailable)
const localMetrics: PerformanceMetric[] = []
const MAX_LOCAL_METRICS = 1000

// Track a performance metric
export async function trackPerformance(
  operation: string,
  durationMs: number,
  success: boolean,
  metadata?: Record<string, any>,
): Promise<void> {
  const metric: PerformanceMetric = {
    operation,
    durationMs,
    success,
    timestamp: Date.now(),
    metadata,
  }

  // Always store locally for immediate access
  if (localMetrics.length >= MAX_LOCAL_METRICS) {
    localMetrics.shift() // Remove oldest entry
  }
  localMetrics.push(metric)

  // Store in database if available
  if (supabase) {
    try {
      await supabase.from("performance_metrics").insert({
        operation,
        duration_ms: durationMs,
        success,
        metadata,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Failed to store performance metric:", error)
    }
  }
}

// Get performance statistics
export function getPerformanceStats(
  operation?: string,
  timeRangeMs?: number,
): {
  totalOperations: number
  successRate: number
  averageDurationMs: number
  p95DurationMs: number
  p99DurationMs: number
  operationCounts: Record<string, number>
} {
  // Filter metrics by operation and time range if specified
  const now = Date.now()
  const filteredMetrics = localMetrics.filter((metric) => {
    const matchesOperation = !operation || metric.operation === operation
    const withinTimeRange = !timeRangeMs || now - metric.timestamp <= timeRangeMs
    return matchesOperation && withinTimeRange
  })

  if (filteredMetrics.length === 0) {
    return {
      totalOperations: 0,
      successRate: 0,
      averageDurationMs: 0,
      p95DurationMs: 0,
      p99DurationMs: 0,
      operationCounts: {},
    }
  }

  // Calculate statistics
  const totalOperations = filteredMetrics.length
  const successfulOperations = filteredMetrics.filter((m) => m.success).length
  const successRate = (successfulOperations / totalOperations) * 100

  // Calculate average duration
  const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.durationMs, 0)
  const averageDurationMs = totalDuration / totalOperations

  // Calculate percentiles
  const sortedDurations = [...filteredMetrics].sort((a, b) => a.durationMs - b.durationMs).map((m) => m.durationMs)
  const p95Index = Math.floor(sortedDurations.length * 0.95)
  const p99Index = Math.floor(sortedDurations.length * 0.99)
  const p95DurationMs = sortedDurations[p95Index] || 0
  const p99DurationMs = sortedDurations[p99Index] || 0

  // Count operations by type
  const operationCounts: Record<string, number> = {}
  filteredMetrics.forEach((metric) => {
    operationCounts[metric.operation] = (operationCounts[metric.operation] || 0) + 1
  })

  return {
    totalOperations,
    successRate,
    averageDurationMs,
    p95DurationMs,
    p99DurationMs,
    operationCounts,
  }
}

// Get recent errors
export async function getRecentErrors(
  limit = 10,
  operation?: string,
): Promise<
  Array<{
    operation: string
    timestamp: string
    metadata?: Record<string, any>
  }>
> {
  if (!supabase) {
    // Return from local metrics if Supabase is unavailable
    return localMetrics
      .filter((m) => !m.success && (!operation || m.operation === operation))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map((m) => ({
        operation: m.operation,
        timestamp: new Date(m.timestamp).toISOString(),
        metadata: m.metadata,
      }))
  }

  try {
    let query = supabase
      .from("performance_metrics")
      .select("*")
      .eq("success", false)
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (operation) {
      query = query.eq("operation", operation)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data.map((item) => ({
      operation: item.operation,
      timestamp: item.timestamp,
      metadata: item.metadata,
    }))
  } catch (error) {
    console.error("Failed to fetch recent errors:", error)
    return []
  }
}

// Create necessary database tables
export async function ensurePerformanceMetricsTables(): Promise<void> {
  if (!supabase) {
    console.warn("Performance metrics table creation skipped: Supabase client not available")
    return
  }

  try {
    // Check if the table exists
    const { error: checkError } = await supabase.from("performance_metrics").select("id").limit(1)

    // If the table doesn't exist, create it
    if (checkError && checkError.message.includes("does not exist")) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          operation TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          metadata JSONB,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_operation ON performance_metrics(operation);
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp ON performance_metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_success ON performance_metrics(success);
      `

      // Execute the SQL using Supabase's rpc
      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.error("Failed to create performance_metrics table:", createError)
      } else {
        console.log("Created performance_metrics table successfully")
      }
    }
  } catch (error) {
    console.error("Error ensuring performance metrics tables:", error)
  }
}
