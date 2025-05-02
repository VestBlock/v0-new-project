import { startQueueWorker } from "./queue-worker"
import { ensureProcessingQueueTable, ensureOpenAILogsTable } from "./openai-service"

let isInitialized = false

/**
 * Initializes the background workers and ensures required tables exist
 */
export async function initializeWorkers() {
  if (isInitialized) {
    return
  }

  console.log("Initializing background workers...")

  try {
    // Ensure required tables exist
    await ensureProcessingQueueTable()
    await ensureOpenAILogsTable()

    // Start the queue worker
    startQueueWorker()

    isInitialized = true
    console.log("Background workers initialized successfully")
  } catch (error) {
    console.error("Failed to initialize background workers:", error)
  }
}

// Initialize workers when this module is imported
initializeWorkers().catch(console.error)
