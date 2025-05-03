import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "./database.types"

// Create Supabase client with safety checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
let supabase: ReturnType<typeof createClient<Database>> | null = null

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  } catch (error) {
    console.error("Failed to initialize Supabase client for PDF logging:", error)
  }
}

/**
 * Log a PDF processing event to the database
 */
export async function logPdfProcessingEvent(
  userId: string,
  event: string,
  options: {
    processingId?: string
    fileName?: string
    fileSize?: number
    details?: string
    errorMessage?: string
    errorStack?: string
  } = {},
) {
  if (!supabase) {
    console.warn("Cannot log PDF processing event: Supabase client not initialized")
    return null
  }

  try {
    const processingId = options.processingId || uuidv4()

    const { data, error } = await supabase.from("pdf_processing_logs").insert({
      processing_id: processingId,
      user_id: userId,
      file_name: options.fileName,
      file_size: options.fileSize,
      event: event,
      details: options.details,
      error_message: options.errorMessage,
      error_stack: options.errorStack,
      timestamp: new Date().toISOString(),
    })

    if (error) {
      console.error("Error logging PDF processing event:", error)
      return null
    }

    return processingId
  } catch (error) {
    console.error("Failed to log PDF processing event:", error)
    return null
  }
}

/**
 * Get PDF processing logs for a specific processing ID
 */
export async function getPdfProcessingLogs(processingId: string) {
  if (!supabase) {
    console.warn("Cannot get PDF processing logs: Supabase client not initialized")
    return []
  }

  try {
    const { data, error } = await supabase
      .from("pdf_processing_logs")
      .select("*")
      .eq("processing_id", processingId)
      .order("timestamp", { ascending: true })

    if (error) {
      console.error("Error fetching PDF processing logs:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Failed to fetch PDF processing logs:", error)
    return []
  }
}

/**
 * Get recent PDF processing logs for a user
 */
export async function getUserPdfProcessingLogs(userId: string, limit = 50) {
  if (!supabase) {
    console.warn("Cannot get user PDF processing logs: Supabase client not initialized")
    return []
  }

  try {
    const { data, error } = await supabase
      .from("pdf_processing_logs")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching user PDF processing logs:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Failed to fetch user PDF processing logs:", error)
    return []
  }
}
