export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { buildImportPreview, normalizePropertyRow, parsePropertyImport } from '@/lib/property-intelligence/import'
import { importPropertyIntelligenceRows } from '@/lib/property-intelligence/repository'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'

type SourceBatchPayload = {
  batchId?: string
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
      .select('id,status,rows_received,rows_ingested,processed_at')
      .eq('provider', 'public_records')
      .eq('external_event_id', externalEventId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === 'completed') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        eventId: existing.id,
        status: existing.status,
        rowsReceived: existing.rows_received,
        rowsIngested: existing.rows_ingested,
        processedAt: existing.processed_at,
      })
    }

    const confidenceLevel = Number.isFinite(Number(payload.confidenceLevel))
      ? Math.max(1, Math.min(100, Number(payload.confidenceLevel)))
      : 70
    const preview = rows.length
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

    const now = new Date().toISOString()
    const { data: event, error: eventError } = await admin
      .from('strategy_source_events')
      .upsert({
        provider: 'public_records',
        external_event_id: externalEventId,
        event_type: 'signed_source_batch',
        status: payload.apply === true ? 'processing' : 'received',
        payload_hash: payloadHash,
        payload_json: {
          sourceName,
          sourceUrl: payload.sourceUrl || null,
          fileName: payload.fileName || null,
          confidenceLevel,
          apply: payload.apply === true,
        },
        rows_received: preview.length,
        occurred_at: now,
        updated_at: now,
      }, { onConflict: 'provider,external_event_id' })
      .select('id')
      .single()
    if (eventError) throw eventError
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
      limit: 5000,
    })
    const { error: completionError } = await admin
      .from('strategy_source_events')
      .update({
        status: 'completed',
        rows_ingested: result.imported,
        processed_at: new Date().toISOString(),
        payload_json: {
          sourceName,
          sourceUrl: payload.sourceUrl || null,
          fileName: payload.fileName || null,
          confidenceLevel,
          apply: true,
          result,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
    if (completionError) throw completionError

    return NextResponse.json({ success: true, applied: true, eventId, ...result })
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
