#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  SOURCE_BATCH_DEFAULT_CHUNK_SIZE,
  normalizeSourceBatchChunk,
  sourceBatchChunkId,
} from '../lib/property-intelligence/sourceBatchChunks.mjs'

function arg(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || ''
}

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function postSourceBatch({ endpoint, authorization, payload, fetchImpl, timeoutMs }) {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Source batch HTTP ${response.status}: ${text.slice(0, 600)}`)
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('Source batch endpoint returned non-JSON content. Check deployment protection and routing.')
  }
  const result = JSON.parse(text)
  if (result?.success !== true) throw new Error(`Source batch failed: ${text.slice(0, 600)}`)
  return result
}

export async function pushSourceBatchInChunks({
  endpoint,
  authorization,
  payload,
  fetchImpl = globalThis.fetch,
  timeoutMs = 125_000,
  chunkSize = SOURCE_BATCH_DEFAULT_CHUNK_SIZE,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.')
  if (!endpoint) throw new TypeError('endpoint is required.')
  if (!authorization) throw new TypeError('authorization is required.')

  if (payload?.apply !== true) {
    return postSourceBatch({ endpoint, authorization, payload, fetchImpl, timeoutMs })
  }

  const parentBatchId = String(payload.batchId || '').trim()
  if (!parentBatchId) throw new TypeError('payload.batchId is required for an applied source batch.')

  let offset = 0
  let totalRows = null
  let imported = 0
  let merged = 0
  let deduped = 0
  let signalsCreated = 0
  let rowsReceived = 0
  const scoreCounts = { high: 0, medium: 0, low: 0 }
  const chunkResults = []

  while (true) {
    const chunkPayload = {
      ...payload,
      batchId: sourceBatchChunkId(parentBatchId, offset),
      parentBatchId,
      offset,
      chunkSize,
    }
    const result = await postSourceBatch({ endpoint, authorization, payload: chunkPayload, fetchImpl, timeoutMs })
    if (result.inProgress === true) {
      throw new Error(`Source batch chunk ${offset} is already processing. Retry after its processing lease clears.`)
    }

    const responseTotalRows = Number(result.totalRows)
    if (!Number.isInteger(responseTotalRows) || responseTotalRows <= 0) {
      throw new Error(`Source batch chunk ${offset} returned an invalid totalRows value.`)
    }
    if (totalRows === null) totalRows = responseTotalRows
    if (responseTotalRows !== totalRows) {
      throw new Error(`Source batch row count changed from ${totalRows} to ${responseTotalRows} during upload.`)
    }

    const plan = normalizeSourceBatchChunk({ offset, chunkSize, totalRows })
    if (numberValue(result.offset) !== plan.offset || numberValue(result.nextOffset) !== plan.nextOffset) {
      throw new Error(`Source batch chunk ${offset} returned an invalid continuation offset.`)
    }
    if (Boolean(result.hasMore) !== plan.hasMore) {
      throw new Error(`Source batch chunk ${offset} returned an invalid continuation state.`)
    }

    rowsReceived += numberValue(result.rowsReceived)
    imported += numberValue(result.imported)
    merged += numberValue(result.merged)
    deduped += numberValue(result.deduped)
    signalsCreated += numberValue(result.signalsCreated)
    scoreCounts.high += numberValue(result.scoreCounts?.high)
    scoreCounts.medium += numberValue(result.scoreCounts?.medium)
    scoreCounts.low += numberValue(result.scoreCounts?.low)
    chunkResults.push({
      eventId: result.eventId || null,
      batchId: chunkPayload.batchId,
      offset,
      rowsReceived: numberValue(result.rowsReceived),
      imported: numberValue(result.imported),
      merged: numberValue(result.merged),
      deduped: numberValue(result.deduped),
      duplicate: result.duplicate === true,
    })

    if (!plan.hasMore) break
    offset = plan.nextOffset
  }

  return {
    success: true,
    applied: true,
    batchId: parentBatchId,
    chunksCompleted: chunkResults.length,
    totalRows,
    rowsReceived,
    imported,
    merged,
    newlyDiscovered: imported,
    corroborated: merged,
    deduped,
    signalsCreated,
    scoreCounts,
    chunkResults,
  }
}

async function runCli() {
  try {
    process.loadEnvFile?.('.env.local')
  } catch {
    // CI and deployed environments provide variables directly.
  }

  const argv = process.argv.slice(2)
  const inputArg = arg('input', argv)
  const sourceName = arg('source-name', argv)
  const sourceUrl = arg('source-url', argv) || null
  const baseUrl = String(process.env.VESTBLOCK_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/+$/, '')
  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  if (!inputArg) throw new Error('--input=/absolute/path/to/file.csv is required.')
  if (!sourceName) throw new Error('--source-name=County/portal/source is required.')
  if (!cronSecret) throw new Error('CRON_SECRET is required.')

  const input = resolve(inputArg)
  const content = await readFile(input, 'utf8')
  const batchId = arg('batch-id', argv) || createHash('sha256').update(`${sourceName}\n${content}`).digest('hex')
  const payload = {
    batchId,
    sourceName,
    sourceUrl,
    fileName: basename(input),
    fileType: input.toLowerCase().endsWith('.geojson') ? 'application/geo+json' : 'text/csv',
    confidenceLevel: Number(arg('confidence', argv) || 70),
    apply: argv.includes('--apply'),
    content,
  }
  const result = await pushSourceBatchInChunks({
    endpoint: `${baseUrl}/api/webhooks/strategy-source-batch`,
    authorization: `Bearer ${cronSecret}`,
    payload,
  })
  console.log(JSON.stringify(result, null, 2))
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedUrl === import.meta.url) await runCli()
