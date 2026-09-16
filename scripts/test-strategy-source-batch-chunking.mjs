#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  SOURCE_BATCH_MAX_CHUNK_SIZE,
  SOURCE_BATCH_PROCESSING_LEASE_MS,
  normalizeSourceBatchChunk,
  sourceBatchChunkContractIssue,
  sourceBatchChunkId,
  sourceBatchProcessingState,
} from '../lib/property-intelligence/sourceBatchChunks.mjs'
import { pushSourceBatchInChunks } from './push-strategy-source-batch.mjs'

const first = normalizeSourceBatchChunk({ offset: 0, chunkSize: 100, totalRows: 250 })
const second = normalizeSourceBatchChunk({ offset: first.nextOffset, chunkSize: 100, totalRows: 250 })
const third = normalizeSourceBatchChunk({ offset: second.nextOffset, chunkSize: 100, totalRows: 250 })
assert.deepEqual(
  [first, second, third].map(({ offset, endOffset, nextOffset, hasMore }) => ({ offset, endOffset, nextOffset, hasMore })),
  [
    { offset: 0, endOffset: 100, nextOffset: 100, hasMore: true },
    { offset: 100, endOffset: 200, nextOffset: 200, hasMore: true },
    { offset: 200, endOffset: 250, nextOffset: 250, hasMore: false },
  ],
)
assert.equal(sourceBatchChunkId('batch-123', 200), 'batch-123:chunk:200')
assert.match(
  sourceBatchChunkContractIssue({
    apply: true,
    batchId: 'legacy-batch',
    totalRows: 101,
  }),
  /require parentBatchId/i,
  'an oversized legacy one-shot request must fail instead of silently importing only its first chunk'
)
assert.match(
  sourceBatchChunkContractIssue({
    apply: true,
    batchId: 'wrong-id',
    parentBatchId: 'batch-123',
    offset: 100,
    totalRows: 250,
  }),
  /must use batchId batch-123:chunk:100/i
)
assert.equal(
  sourceBatchChunkContractIssue({
    apply: true,
    batchId: 'batch-123:chunk:100',
    parentBatchId: 'batch-123',
    offset: 100,
    totalRows: 250,
  }),
  null
)
assert.throws(
  () => normalizeSourceBatchChunk({ offset: 0, chunkSize: SOURCE_BATCH_MAX_CHUNK_SIZE + 1, totalRows: 250 }),
  /chunkSize/,
)
assert.throws(() => normalizeSourceBatchChunk({ offset: -1, chunkSize: 100, totalRows: 250 }), /offset/)
assert.throws(() => normalizeSourceBatchChunk({ offset: 250, chunkSize: 100, totalRows: 250 }), /offset/)

const nowMs = Date.parse('2026-09-16T12:00:00.000Z')
assert.equal(sourceBatchProcessingState(null, { nowMs }), 'new')
assert.equal(sourceBatchProcessingState({ status: 'completed', updated_at: '2026-09-16T11:00:00.000Z' }, { nowMs }), 'completed')
assert.equal(
  sourceBatchProcessingState({ status: 'processing', updated_at: new Date(nowMs - SOURCE_BATCH_PROCESSING_LEASE_MS + 1).toISOString() }, { nowMs }),
  'in_progress',
)
assert.equal(
  sourceBatchProcessingState({ status: 'processing', updated_at: new Date(nowMs - SOURCE_BATCH_PROCESSING_LEASE_MS).toISOString() }, { nowMs }),
  'reclaim',
)
assert.equal(sourceBatchProcessingState({ status: 'failed', updated_at: '2026-09-16T11:59:00.000Z' }, { nowMs }), 'reclaim')

const requestBodies = []
const perChunk = new Map([
  [0, { imported: 80, merged: 20, deduped: 20, signalsCreated: 40, scoreCounts: { high: 10, medium: 30, low: 40 } }],
  [100, { imported: 90, merged: 10, deduped: 10, signalsCreated: 45, scoreCounts: { high: 20, medium: 30, low: 40 }, duplicate: true }],
  [200, { imported: 5, merged: 0, deduped: 0, signalsCreated: 3, scoreCounts: { high: 1, medium: 2, low: 2 } }],
])
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
  text: async () => JSON.stringify(body),
})
const fetchImpl = async (_url, options) => {
  const body = JSON.parse(options.body)
  requestBodies.push(body)
  const plan = normalizeSourceBatchChunk({ offset: body.offset, chunkSize: body.chunkSize, totalRows: 205 })
  return jsonResponse({
    success: true,
    applied: true,
    eventId: `event-${body.offset}`,
    offset: plan.offset,
    nextOffset: plan.nextOffset,
    hasMore: plan.hasMore,
    totalRows: plan.totalRows,
    rowsReceived: plan.endOffset - plan.offset,
    ...perChunk.get(body.offset),
  })
}

const aggregate = await pushSourceBatchInChunks({
  endpoint: 'https://example.test/api/webhooks/strategy-source-batch',
  authorization: 'Bearer test-only',
  payload: {
    batchId: 'source-file-hash',
    sourceName: 'Test source',
    apply: true,
    content: 'test-only-content',
  },
  fetchImpl,
})
assert.deepEqual(requestBodies.map((body) => body.offset), [0, 100, 200])
assert.deepEqual(requestBodies.map((body) => body.batchId), [
  'source-file-hash:chunk:0',
  'source-file-hash:chunk:100',
  'source-file-hash:chunk:200',
])
assert.ok(requestBodies.every((body) => body.parentBatchId === 'source-file-hash' && body.content === 'test-only-content'))
assert.equal(aggregate.chunksCompleted, 3)
assert.equal(aggregate.totalRows, 205)
assert.equal(aggregate.rowsReceived, 205)
assert.equal(aggregate.imported, 175)
assert.equal(aggregate.newlyDiscovered, 175)
assert.equal(aggregate.merged, 30)
assert.equal(aggregate.corroborated, 30)
assert.equal(aggregate.deduped, 30)
assert.equal(aggregate.signalsCreated, 88)
assert.deepEqual(aggregate.scoreCounts, { high: 31, medium: 62, low: 82 })
assert.equal(aggregate.chunkResults[1].duplicate, true)

await assert.rejects(
  pushSourceBatchInChunks({
    endpoint: 'https://example.test/api/webhooks/strategy-source-batch',
    authorization: 'Bearer test-only',
    payload: { batchId: 'busy-batch', sourceName: 'Test source', apply: true, content: 'test-only-content' },
    fetchImpl: async () => jsonResponse({ success: true, applied: true, inProgress: true }, 202),
  }),
  /already processing/,
)

let previewRequests = 0
const previewResult = await pushSourceBatchInChunks({
  endpoint: 'https://example.test/api/webhooks/strategy-source-batch',
  authorization: 'Bearer test-only',
  payload: { batchId: 'preview', sourceName: 'Test source', apply: false, content: 'test-only-content' },
  fetchImpl: async (_url, options) => {
    previewRequests += 1
    const body = JSON.parse(options.body)
    assert.equal(body.parentBatchId, undefined)
    return jsonResponse({ success: true, applied: false, summary: { rows: 1 } })
  },
})
assert.equal(previewRequests, 1)
assert.equal(previewResult.applied, false)

const [routeSource, repositorySource] = await Promise.all([
  readFile(new URL('../app/api/webhooks/strategy-source-batch/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/property-intelligence/repository.ts', import.meta.url), 'utf8'),
])
assert.match(routeSource, /slice\(chunk\.offset, chunk\.endOffset\)/)
assert.match(routeSource, /sourceBatchChunkContractIssue/)
assert.match(routeSource, /\.eq\('updated_at', existing\.updated_at\)/)
assert.match(routeSource, /createError\?\.code === '23505'/)
assert.match(routeSource, /rows_ingested:\s*result\.imported[,\s]/, 'durable ingestion metrics must count only new property records')
assert.match(repositorySource, /import_status: 'failed'/)
assert.match(repositorySource, /records_created: imported/)
assert.match(repositorySource, /records_deduped: deduped/)
assert.match(repositorySource, /cleanupPartialPropertyImport/)

console.log('strategy source batch chunking tests passed')
