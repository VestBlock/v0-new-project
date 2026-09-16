export const SOURCE_BATCH_DEFAULT_CHUNK_SIZE = 100
export const SOURCE_BATCH_MAX_CHUNK_SIZE = 100
export const SOURCE_BATCH_PROCESSING_LEASE_MS = 10 * 60 * 1000

export function sourceBatchChunkId(parentBatchId, offset) {
  const batchId = String(parentBatchId || '').trim()
  if (!batchId) throw new TypeError('parentBatchId is required.')
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError('offset must be a non-negative integer.')
  return `${batchId}:chunk:${offset}`
}

export function sourceBatchChunkContractIssue({
  apply,
  batchId,
  parentBatchId,
  offset = 0,
  chunkSize = SOURCE_BATCH_DEFAULT_CHUNK_SIZE,
  totalRows,
}) {
  if (apply !== true) return null
  const plan = normalizeSourceBatchChunk({ offset, chunkSize, totalRows })
  const parent = String(parentBatchId || '').trim()
  const current = String(batchId || '').trim()
  if (!parent) {
    return totalRows > SOURCE_BATCH_MAX_CHUNK_SIZE
      ? `Applied source batches larger than ${SOURCE_BATCH_MAX_CHUNK_SIZE} rows require parentBatchId and deterministic chunk batchId metadata.`
      : null
  }
  const expected = sourceBatchChunkId(parent, plan.offset)
  return current === expected
    ? null
    : `Applied source batch chunk ${plan.offset} must use batchId ${expected}.`
}

export function normalizeSourceBatchChunk({
  offset = 0,
  chunkSize = SOURCE_BATCH_DEFAULT_CHUNK_SIZE,
  totalRows,
}) {
  if (!Number.isInteger(totalRows) || totalRows <= 0) {
    throw new RangeError('totalRows must be a positive integer.')
  }
  if (!Number.isInteger(offset) || offset < 0 || offset >= totalRows) {
    throw new RangeError(`offset must be an integer between 0 and ${totalRows - 1}.`)
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > SOURCE_BATCH_MAX_CHUNK_SIZE) {
    throw new RangeError(`chunkSize must be an integer between 1 and ${SOURCE_BATCH_MAX_CHUNK_SIZE}.`)
  }

  const endOffset = Math.min(totalRows, offset + chunkSize)
  return {
    offset,
    chunkSize,
    totalRows,
    endOffset,
    nextOffset: endOffset,
    hasMore: endOffset < totalRows,
  }
}

export function sourceBatchProcessingState(existing, options = {}) {
  if (!existing) return 'new'
  if (existing.status === 'completed') return 'completed'
  if (existing.status !== 'processing') return 'reclaim'

  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now()
  const leaseMs = Number.isFinite(options.leaseMs)
    ? options.leaseMs
    : SOURCE_BATCH_PROCESSING_LEASE_MS
  const updatedAtMs = Date.parse(String(existing.updated_at || ''))
  if (Number.isFinite(updatedAtMs) && nowMs - updatedAtMs < leaseMs) return 'in_progress'
  return 'reclaim'
}
