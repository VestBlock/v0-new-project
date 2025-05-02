import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "./supabase"
import { extractJsonFromText, sanitizeForJson } from "./json-utils"

// Create Supabase client for logging and queue management
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabaseOld = createClient(supabaseUrl, supabaseServiceKey)

// Configuration
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 120000 // 2 minutes
const MAX_BACKOFF_MS = 60000 // 1 minute max backoff
const MAX_CHUNK_SIZE = 100000 // Maximum characters per chunk

// Report processing status
export enum ProcessingStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  CHUNKING = "chunking",
  ANALYZING = "analyzing",
  MERGING = "merging",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Report processing queue item
interface QueueItem {
  id: string
  analysisId: string
  userId: string
  status: ProcessingStatus
  priority: number
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  attempts: number
  max_attempts: number
}

// Cache for OpenAI responses to reduce API calls
const responseCache = new Map<string, { response: string; timestamp: number }>()
const CACHE_TTL = 300000 // 5 minutes cache TTL

/**
 * Ensures the OpenAI logs table exists in the database
 */
export async function ensureOpenAILogsTable() {
  try {
    console.log("[OPENAI-SERVICE] Checking if openai_logs table exists...")

    // Check if the table exists
    const { data: tableExists, error: checkError } = await supabase.from("openai_logs").select("id").limit(1)

    if (checkError) {
      console.log("[OPENAI-SERVICE] Table check failed, attempting to create table...")

      // Create the table if it doesn't exist
      const { error: createError } = await supabase.rpc("create_openai_logs_table")

      if (createError) {
        console.error("[OPENAI-SERVICE] Failed to create openai_logs table:", createError)
        return false
      }

      console.log("[OPENAI-SERVICE] Successfully created openai_logs table")
      return true
    }

    console.log("[OPENAI-SERVICE] openai_logs table already exists")
    return true
  } catch (error) {
    console.error("[OPENAI-SERVICE] Error ensuring openai_logs table:", error)
    return false
  }
}

/**
 * Gets OpenAI usage statistics for a specific time period
 */
export async function getOpenAIUsageStats(daysAgo = 7) {
  try {
    const { data, error } = await supabase.rpc("get_openai_usage_by_user", { days_ago: daysAgo })

    if (error) {
      console.error("[OPENAI-SERVICE] Error getting OpenAI usage stats:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("[OPENAI-SERVICE] Error getting OpenAI usage stats:", error)
    return null
  }
}

/**
 * Ensures the OpenAI processing queue table exists
 */
export async function ensureProcessingQueueTable() {
  try {
    // Check if the table exists
    const { error: checkError } = await supabaseOld.from("openai_processing_queue").select("id").limit(1)

    // If the table doesn't exist, create it
    if (checkError && checkError.message.includes("does not exist")) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS openai_processing_queue (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          analysis_id UUID NOT NULL,
          user_id UUID NOT NULL,
          status TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          error TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          metadata JSONB
        );
        CREATE INDEX IF NOT EXISTS idx_openai_queue_status ON openai_processing_queue(status);
        CREATE INDEX IF NOT EXISTS idx_openai_queue_analysis_id ON openai_processing_queue(analysis_id);
        CREATE INDEX IF NOT EXISTS idx_openai_queue_user_id ON openai_processing_queue(user_id);
      `

      // Execute the SQL using Supabase's rpc
      const { error: createError } = await supabaseOld.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.error("Failed to create openai_processing_queue table:", createError)
      } else {
        console.log("Created openai_processing_queue table successfully")
      }
    }
  } catch (error) {
    console.error("Error ensuring OpenAI processing queue table:", error)
  }
}

/**
 * Adds a report to the processing queue
 */
export async function addToProcessingQueue(
  analysisId: string,
  userId: string,
  priority = 0,
  maxAttempts = 3,
): Promise<string> {
  const queueId = uuidv4()

  await supabaseOld.from("openai_processing_queue").insert({
    id: queueId,
    analysis_id: analysisId,
    user_id: userId,
    status: ProcessingStatus.QUEUED,
    priority,
    attempts: 0,
    max_attempts: maxAttempts,
  })

  console.log(`Added analysis ${analysisId} to processing queue with ID ${queueId}`)
  return queueId
}

/**
 * Updates the status of a queue item
 */
export async function updateQueueItemStatus(queueId: string, status: ProcessingStatus, error?: string) {
  const updates: any = { status }

  if (status === ProcessingStatus.PROCESSING && !error) {
    updates.started_at = new Date().toISOString()
  } else if (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.FAILED) {
    updates.completed_at = new Date().toISOString()
  }

  if (error) {
    updates.error = error
  }

  await supabaseOld.from("openai_processing_queue").update(updates).eq("id", queueId)

  console.log(`Updated queue item ${queueId} status to ${status}${error ? ` with error: ${error}` : ""}`)
}

/**
 * Increments the attempt counter for a queue item
 */
export async function incrementQueueItemAttempts(queueId: string) {
  await supabaseOld
    .from("openai_processing_queue")
    .update({
      attempts: supabaseOld.rpc("increment", { row_id: queueId, increment_by: 1 }),
    })
    .eq("id", queueId)

  console.log(`Incremented attempts for queue item ${queueId}`)
}

/**
 * Gets the next item from the processing queue
 */
export async function getNextQueueItem(): Promise<QueueItem | null> {
  // Get items that are queued, ordered by priority (higher first) and creation time
  const { data, error } = await supabaseOld
    .from("openai_processing_queue")
    .select("*")
    .eq("status", ProcessingStatus.QUEUED)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    return null
  }

  return data[0] as unknown as QueueItem
}

/**
 * Processes text in chunks to avoid token limits
 */
export async function processLargeTextWithOpenAI(
  text: string,
  prompt: string,
  userId: string,
  queueId: string,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
    cacheKey?: string
  } = {},
): Promise<string> {
  // Default options
  const model = options.model || "gpt-4o"
  const temperature = options.temperature || 0.3
  const maxTokens = options.maxTokens || 4000
  const systemPrompt = options.systemPrompt || "You are an expert analyst. Analyze the provided text thoroughly."
  const cacheKey = options.cacheKey || `${userId}:${prompt.substring(0, 50)}:${text.substring(0, 100)}`

  // Check cache first if caching is enabled
  if (cacheKey) {
    const cachedItem = responseCache.get(cacheKey)
    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
      console.log(`Using cached OpenAI response for ${cacheKey.substring(0, 30)}...`)
      return cachedItem.response
    }
  }

  // If text is small enough, process it directly
  if (text.length <= MAX_CHUNK_SIZE) {
    console.log(`Processing text directly (${text.length} characters)`)

    await updateQueueItemStatus(queueId, ProcessingStatus.ANALYZING)

    // Use fetch directly to call OpenAI API
    const url = "https://api.openai.com/v1/chat/completions"
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    }

    const body = JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${prompt}\n\nText to analyze:\n${text}` },
      ],
      temperature: temperature,
      max_tokens: maxTokens,
    })

    const fetchResponse = await fetch(url, {
      method: "POST",
      headers,
      body,
    })

    if (!fetchResponse.ok) {
      throw new Error(`OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}`)
    }

    const data = await fetchResponse.json()
    const result = data.choices[0].message.content || ""

    // Cache the result if caching is enabled
    if (cacheKey) {
      responseCache.set(cacheKey, {
        response: result,
        timestamp: Date.now(),
      })
    }

    return result
  }

  // For larger texts, split into chunks and process each
  console.log(`Text too large (${text.length} characters), splitting into chunks`)
  await updateQueueItemStatus(queueId, ProcessingStatus.CHUNKING)

  // Split text into chunks
  const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE)
  console.log(`Split text into ${chunks.length} chunks`)

  // Process each chunk
  const chunkResults: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} characters)`)
    await updateQueueItemStatus(queueId, ProcessingStatus.ANALYZING, `Processing chunk ${i + 1}/${chunks.length}`)

    const chunkPrompt = `
${prompt}

This is chunk ${i + 1} of ${chunks.length} from a larger document. Focus on extracting key information from this chunk.

Text to analyze (chunk ${i + 1}/${chunks.length}):
${chunks[i]}
`

    try {
      // Use fetch directly to call OpenAI API
      const url = "https://api.openai.com/v1/chat/completions"
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      }

      const body = JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: chunkPrompt },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      })

      const fetchResponse = await fetch(url, {
        method: "POST",
        headers,
        body,
      })

      if (!fetchResponse.ok) {
        throw new Error(`OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}`)
      }

      const data = await fetchResponse.json()
      const chunkResult = data.choices[0].message.content || ""

      chunkResults.push(chunkResult)
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error)
      throw error
    }
  }

  // If we only have one chunk result, return it directly
  if (chunkResults.length === 1) {
    return chunkResults[0]
  }

  // Merge the results from all chunks
  console.log(`Merging results from ${chunkResults.length} chunks`)
  await updateQueueItemStatus(queueId, ProcessingStatus.MERGING)

  const mergePrompt = `
I have analyzed a document in ${chunkResults.length} separate chunks and need to merge the analysis into a cohesive whole.

Here are the separate analyses:

${chunkResults.map((result, i) => `--- CHUNK ${i + 1} ANALYSIS ---\n${result}`).join("\n\n")}

Please merge these analyses into a single comprehensive analysis, removing any redundancies and ensuring the final result is coherent and complete. The final result should follow the same format as the individual analyses.
`

  // Use fetch directly to call OpenAI API
  const url = "https://api.openai.com/v1/chat/completions"
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  }

  const body = JSON.stringify({
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: mergePrompt },
    ],
    temperature: temperature,
    max_tokens: Math.min(8000, maxTokens * 2), // Allow more tokens for merging
  })

  const fetchResponse = await fetch(url, {
    method: "POST",
    headers,
    body,
  })

  if (!fetchResponse.ok) {
    throw new Error(`OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText}`)
  }

  const data = await fetchResponse.json()
  const mergedResult = data.choices[0].message.content || ""

  // Cache the merged result if caching is enabled
  if (cacheKey) {
    responseCache.set(cacheKey, {
      response: mergedResult,
      timestamp: Date.now(),
    })
  }

  return mergedResult
}

/**
 * Splits text into chunks of approximately equal size
 */
function splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = []

  // Try to split on paragraphs first
  const paragraphs = text.split(/\n\s*\n/)

  let currentChunk = ""

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the chunk size, start a new chunk
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = paragraph
    } else {
      // Otherwise, add to the current chunk
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  // If any chunk is still too large, split it further
  const finalChunks: string[] = []

  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk)
    } else {
      // Split on sentences
      const sentences = chunk.split(/(?<=[.!?])\s+/)
      let currentSubChunk = ""

      for (const sentence of sentences) {
        if (currentSubChunk.length + sentence.length + 1 > maxChunkSize && currentSubChunk.length > 0) {
          finalChunks.push(currentSubChunk)
          currentSubChunk = sentence
        } else {
          currentSubChunk += (currentSubChunk ? " " : "") + sentence
        }
      }

      if (currentSubChunk) {
        finalChunks.push(currentSubChunk)
      }
    }
  }

  return finalChunks
}

/**
 * Clear the response cache
 */
export function clearResponseCache(): void {
  responseCache.clear()
  console.log("OpenAI response cache cleared")
}

/**
 * Get cache statistics
 */
export function getResponseCacheStats(): { size: number; hitRate: number } {
  return {
    size: responseCache.size,
    hitRate: 0, // This would need to be tracked separately
  }
}

/**
 * Process JSON response from OpenAI
 * Handles common issues with JSON parsing from LLM responses
 */
export function processJsonResponse(text: string): any {
  try {
    // Use our enhanced JSON extraction function
    const jsonResult = extractJsonFromText(text)

    if (!jsonResult) {
      throw new Error("Failed to extract valid JSON from response")
    }

    // Sanitize the result to ensure it can be safely serialized
    return sanitizeForJson(jsonResult)
  } catch (error) {
    console.error("Error processing JSON response:", error)
    throw error
  }
}
