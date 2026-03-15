/**
 * Utilities for chunking large documents for processing
 */

// Define optimal chunk sizes
const OPTIMAL_CHUNK_SIZE = 8000 // characters
const MAX_CHUNK_SIZE = 12000 // characters
const MIN_CHUNK_SIZE = 4000 // characters

/**
 * Splits a document into optimal chunks for processing
 */
export function chunkDocument(
  text: string,
  options: {
    maxChunkSize?: number
    overlapSize?: number
    preserveParagraphs?: boolean
  } = {},
): string[] {
  const { maxChunkSize = MAX_CHUNK_SIZE, overlapSize = 500, preserveParagraphs = true } = options

  // If text is small enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + OPTIMAL_CHUNK_SIZE

    // Don't exceed text length
    if (endIndex > text.length) {
      endIndex = text.length
    }
    // Don't exceed max chunk size
    else if (endIndex - startIndex > maxChunkSize) {
      endIndex = startIndex + maxChunkSize
    }
    // Try to break at paragraph if preserving paragraphs
    else if (preserveParagraphs && startIndex + MIN_CHUNK_SIZE < endIndex) {
      // Look for paragraph breaks
      const paragraphBreak = text.lastIndexOf("\n\n", endIndex)
      if (paragraphBreak > startIndex + MIN_CHUNK_SIZE) {
        endIndex = paragraphBreak
      } else {
        // Look for line breaks
        const lineBreak = text.lastIndexOf("\n", endIndex)
        if (lineBreak > startIndex + MIN_CHUNK_SIZE) {
          endIndex = lineBreak
        } else {
          // Look for sentence breaks
          const sentenceBreak = findLastSentenceBreak(text, startIndex, endIndex)
          if (sentenceBreak > startIndex + MIN_CHUNK_SIZE) {
            endIndex = sentenceBreak
          }
        }
      }
    }

    // Extract the chunk
    chunks.push(text.substring(startIndex, endIndex))

    // Move to next chunk with overlap
    startIndex = endIndex - overlapSize

    // Ensure we're making progress
    if (startIndex >= text.length || endIndex === text.length) {
      break
    }
  }

  return chunks
}

/**
 * Finds the last sentence break in a text range
 */
function findLastSentenceBreak(text: string, startIndex: number, endIndex: number): number {
  // Look for common sentence endings
  for (let i = endIndex; i > startIndex + MIN_CHUNK_SIZE; i--) {
    if (
      i < text.length &&
      (text[i] === "." || text[i] === "!" || text[i] === "?") &&
      (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")
    ) {
      return i + 1
    }
  }

  // If no sentence break found, look for space
  const lastSpace = text.lastIndexOf(" ", endIndex)
  if (lastSpace > startIndex + MIN_CHUNK_SIZE) {
    return lastSpace
  }

  // If all else fails, just use the end index
  return endIndex
}

/**
 * Merges analysis results from multiple chunks
 */
export function mergeChunkResults(results: any[]): any {
  if (results.length === 0) return null
  if (results.length === 1) return results[0]

  // Start with the first result as base
  const merged = { ...results[0] }

  // Track the highest confidence credit score
  let highestScoreConfidence = results[0].metadata?.scoreConfidence || 0

  // Merge additional results
  for (let i = 1; i < results.length; i++) {
    const result = results[i]

    // Merge arrays with deduplication
    if (result.negativeItems) {
      merged.negativeItems = [...new Set([...(merged.negativeItems || []), ...result.negativeItems])]
    }

    if (result.accounts) {
      // Deduplicate accounts by account number or creditor name
      const existingAccountIds = new Set(merged.accounts?.map((a: any) => a.accountNumber || a.creditor) || [])

      const newAccounts = result.accounts.filter(
        (account: any) => !existingAccountIds.has(account.accountNumber || account.creditor),
      )

      merged.accounts = [...(merged.accounts || []), ...newAccounts]
    }

    if (result.inquiries) {
      merged.inquiries = [...new Set([...(merged.inquiries || []), ...result.inquiries])]
    }

    if (result.publicRecords) {
      merged.publicRecords = [...new Set([...(merged.publicRecords || []), ...result.publicRecords])]
    }

    // Take the credit score with highest confidence
    if (result.creditScore && (result.metadata?.scoreConfidence || 0) > highestScoreConfidence) {
      merged.creditScore = result.creditScore
      highestScoreConfidence = result.metadata?.scoreConfidence || 0
    }

    // Take the first non-null bureau and report date
    if (!merged.bureau && result.bureau) {
      merged.bureau = result.bureau
    }

    if (!merged.reportDate && result.reportDate) {
      merged.reportDate = result.reportDate
    }
  }

  // Add metadata about the merge
  merged.metadata = {
    ...(merged.metadata || {}),
    mergedChunks: results.length,
    scoreConfidence: highestScoreConfidence,
  }

  return merged
}
