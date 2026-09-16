export const SOURCE_BATCH_DEFAULT_CHUNK_SIZE: number
export const SOURCE_BATCH_MAX_CHUNK_SIZE: number
export const SOURCE_BATCH_PROCESSING_LEASE_MS: number

export type SourceBatchChunk = {
  offset: number
  chunkSize: number
  totalRows: number
  endOffset: number
  nextOffset: number
  hasMore: boolean
}

export function sourceBatchChunkId(parentBatchId: string, offset: number): string
export function sourceBatchChunkContractIssue(input: {
  apply: boolean
  batchId?: string | null
  parentBatchId?: string | null
  offset?: number
  chunkSize?: number
  totalRows: number
}): string | null

export function normalizeSourceBatchChunk(input: {
  offset?: number
  chunkSize?: number
  totalRows: number
}): SourceBatchChunk

export function sourceBatchProcessingState(
  existing: { status?: string | null; updated_at?: string | null } | null | undefined,
  options?: { nowMs?: number; leaseMs?: number },
): 'new' | 'completed' | 'in_progress' | 'reclaim'
