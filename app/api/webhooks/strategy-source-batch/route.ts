export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { buildImportPreview, normalizePropertyRow, parsePropertyImport } from '@/lib/property-intelligence/import'
import { importPropertyIntelligenceRows } from '@/lib/property-intelligence/repository'
import {
  normalizeSourceBatchChunk,
  sourceBatchChunkContractIssue,
  sourceBatchProcessingState,
} from '@/lib/property-intelligence/sourceBatchChunks.mjs'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'

type SourceBatchPayload = {
  batchId?: string
  parentBatchId?: string
  offset?: number
  chunkSize?: number
  sourceName?: string
  sourceUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  confidenceLevel?: number
  apply?: boolean
  content?: string
  rows?: Array<Record<string, unknown>>
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Source batch import failed.')
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function completedEventResponse(existing: Record<string, any>) {
  const metadata = recordValue(existing.payload_json)
  const result = recordValue(metadata.result)
  return NextResponse.json({
    success: true,
    applied: true,
    duplicate: true,
    eventId: existing.id,
    status: existing.status,
    rowsReceived: existing.rows_received,
    rowsIngested: existing.rows_ingested,
    processedAt: existing.processed_at,
    parentBatchId: metadata.parentBatchId,
    offset: metadata.offset,
    chunkSize: metadata.chunkSize,
    totalRows: metadata.totalRows,
    nextOffset: metadata.nextOffset,
    hasMore: metadata.hasMore,
    ...result,
  })
}

function inProgressResponse(existing: Record<string, any> | null, externalEventId: string) {
  const metadata = recordValue(existing?.payload_json)
  return NextResponse.json({
    success: true,
    applied: true,
    inProgress: true,
    eventId: existing?.id || null,
    externalEventId,
    parentBatchId: metadata.parentBatchId,
    offset: metadata.offset,
    chunkSize: metadata.chunkSize,
    totalRows: metadata.totalRows,
    nextOffset: metadata.nextOffset,
    hasMore: metadata.hasMore,
  }, {
    status: 202,
    headers: { 'retry-after': '30' },
  })
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  let rawBody = ''
  let eventId: string | null = null
  try {
    rawBody = await request.text()
    if (Buffer.byteLength(rawBody) > 8_000_000) {
      return NextResponse.json({ success: false, error: 'Source batch exceeds the 8 MB limit.' }, { status: 413 })
    }

    const payload = JSON.parse(rawBody || '{}') as SourceBatchPayload
    const sourceName = clean(payload.sourceName)
    const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 5000) : []
    const content = typeof payload.content === 'string' ? payload.content : ''
    if (!sourceName) return NextResponse.json({ success: false, error: 'sourceName is required.' }, { status: 400 })
    if (!rows.length && !content.trim()) {
      return NextResponse.json({ success: false, error: 'Provide rows or CSV/GeoJSON content.' }, { status: 400 })
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex')
    const externalEventId = `source-batch:${clean(payload.batchId) || payloadHash}`
    const admin = createAdminClient()
    const { data: existing, error: existingError } = await admin
      .from('strategy_source_events')
      .select('id,status,rows_received,rows_ingested,processed_at,updated_at,payload_json')
      .eq('provider', 'public_records')
      .eq('external_event_id', externalEventId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === 'completed') {
      return completedEventResponse(existing)
    }
    if (sourceBatchProcessingState(existing) === 'in_progress') {
      return inProgressResponse(existing, externalEventId)
    }

    const confidenceLevel = Number.isFinite(Number(payload.confidenceLevel))
      ? Math.max(1, Math.min(100, Number(payload.confidenceLevel)))
      : 70
    const allRows = rows.length
      ? buildImportPreview(rows.map((row) => normalizePropertyRow(row, {
          sourceName,
          sourceUrl: payload.sourceUrl || null,
          fileName: payload.fileName || null,
          confidenceLevel,
        })))
      : parsePropertyImport(content, {
          sourceName,
          sourceUrl: payload.sourceUrl || null,
          fileName: payload.fileName || 'source-batch.csv',
          fileType: payload.fileType || null,
          confidenceLevel,
        }).slice(0, 5000)

    if (!allRows.length) {
      return NextResponse.json({ success: false, error: 'The source batch has no importable rows.' }, { status: 400 })
    }

    let chunk: ReturnType<typeof normalizeSourceBatchChunk> | null = null
    if (payload.apply === true) {
      try {
        const contractIssue = sourceBatchChunkContractIssue({
          apply: true,
          batchId: payload.batchId,
          parentBatchId: payload.parentBatchId,
          offset: payload.offset,
          chunkSize: payload.chunkSize,
          totalRows: allRows.length,
        })
        if (contractIssue) {
          return NextResponse.json({ success: false, error: contractIssue }, { status: 400 })
        }
        chunk = normalizeSourceBatchChunk({
          offset: payload.offset,
          chunkSize: payload.chunkSize,
          totalRows: allRows.length,
        })
      } catch (error) {
        return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 400 })
      }
    }
    const preview = chunk ? allRows.slice(chunk.offset, chunk.endOffset) : allRows
    const parentBatchId = clean(payload.parentBatchId) || clean(payload.batchId) || payloadHash
    const eventPayload = {
      sourceName,
      sourceUrl: payload.sourceUrl || null,
      fileName: payload.fileName || null,
      confidenceLevel,
      apply: payload.apply === true,
      parentBatchId,
      offset: chunk?.offset ?? 0,
      chunkSize: chunk?.chunkSize ?? preview.length,
      totalRows: allRows.length,
      nextOffset: chunk?.nextOffset ?? allRows.length,
      hasMore: chunk?.hasMore ?? false,
    }

    const now = new Date().toISOString()
    const eventWrite = {
      provider: 'public_records',
      external_event_id: externalEventId,
      event_type: 'signed_source_batch',
      status: payload.apply === true ? 'processing' : 'received',
      payload_hash: payloadHash,
      payload_json: eventPayload,
      rows_received: preview.length,
      rows_ingested: 0,
      error_message: null,
      occurred_at: now,
      processed_at: null,
      updated_at: now,
    }
    let event: { id: string } | null = null
    if (existing) {
      const { data: reclaimed, error: reclaimError } = await admin
        .from('strategy_source_events')
        .update(eventWrite)
        .eq('id', existing.id)
        .eq('status', existing.status)
        .eq('updated_at', existing.updated_at)
        .select('id')
        .maybeSingle()
      if (reclaimError) throw reclaimError
      if (!reclaimed) return inProgressResponse(existing, externalEventId)
      event = reclaimed
    } else {
      const { data: created, error: createError } = await admin
        .from('strategy_source_events')
        .insert({
          ...eventWrite,
          provider: 'public_records',
          external_event_id: externalEventId,
          event_type: 'signed_source_batch',
        })
        .select('id')
        .maybeSingle()
      if (createError?.code === '23505') return inProgressResponse(null, externalEventId)
      if (createError) throw createError
      event = created
    }
    if (!event) throw new Error('Failed to acquire the source batch processing lease.')
    eventId = event.id

    if (payload.apply !== true) {
      return NextResponse.json({
        success: true,
        applied: false,
        eventId,
        summary: {
          rows: preview.length,
          highScore: preview.filter((row) => row.dealScore.score >= 75).length,
          vacantLots: preview.filter((row) => row.vacantLotConfidence >= 50).length,
          signals: preview.reduce((sum, row) => sum + row.signals.length, 0),
        },
        preview: preview.slice(0, 10),
      })
    }

    const result = await importPropertyIntelligenceRows({
      rows: preview,
      sourceName,
      sourceUrl: payload.sourceUrl || null,
      fileName: payload.fileName || 'source-batch.csv',
      confidenceLevel,
      limit: preview.length,
    })
    const { error: completionError } = await admin
      .from('strategy_source_events')
      .update({
        status: 'completed',
        rows_ingested: result.imported,
        processed_at: new Date().toISOString(),
        payload_json: {
          ...eventPayload,
          result,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
    if (completionError) throw completionError

    return NextResponse.json({
      success: true,
      applied: true,
      eventId,
      rowsReceived: preview.length,
      ...eventPayload,
      ...result,
    })
  } catch (error) {
    if (eventId) {
      const admin = createAdminClient()
      await admin.from('strategy_source_events').update({
        status: 'failed',
        error_message: errorMessage(error),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', eventId)
    }
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 })
  }
}
