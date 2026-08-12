import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { ingestDealMachineContactsCsv, parseCsvText } from '@/lib/dealmachine/contactExport'
import { dealMachineStrategyProvenance } from '@/lib/dealmachine/strategyProvenance'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function normalizeSlug(value: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function safeInteger(value: string | null, fallback = 0) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const csvContent = await request.text()
  const rows = parseCsvText(csvContent).length
  if (!rows) {
    return NextResponse.json({ ok: false, error: 'The CSV chunk has no data rows.' }, { status: 400 })
  }

  const strategyKey = normalizeSlug(url.searchParams.get('strategyKey')) || null
  const strategy = dealMachineStrategyProvenance(strategyKey)
  const strategyVariant = normalizeSlug(url.searchParams.get('strategyVariant')) || strategy?.variant || null
  const market = normalizeSlug(url.searchParams.get('market')) || null
  const listId = String(url.searchParams.get('listId') || '').trim() || null
  const exportId = String(url.searchParams.get('exportId') || '').trim() || null
  const sourceFile = String(url.searchParams.get('sourceFile') || '').trim().slice(0, 240) || null
  const sourceHash = String(url.searchParams.get('sourceHash') || '').trim() ||
    createHash('sha256').update(csvContent).digest('hex')
  const chunkIndex = safeInteger(url.searchParams.get('chunkIndex'))
  const chunkCount = Math.max(1, safeInteger(url.searchParams.get('chunkCount'), 1))
  const externalEventId = `local-export:${sourceHash}:${chunkIndex}`
  const payloadHash = createHash('sha256').update(csvContent).digest('hex')
  const now = new Date().toISOString()
  const admin = createAdminClient()

  const { data: prior } = await admin
    .from('strategy_source_events')
    .select('id,status,rows_received,rows_ingested,error_message')
    .eq('provider', 'dealmachine')
    .eq('external_event_id', externalEventId)
    .maybeSingle()

  if (prior?.status === 'completed') {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      eventId: externalEventId,
      rowsReceived: prior.rows_received || rows,
      rowsIngested: prior.rows_ingested || 0,
      error: prior.error_message || null,
    })
  }

  const { error: receivedError } = await admin
    .from('strategy_source_events')
    .upsert(
      {
        provider: 'dealmachine',
        external_event_id: externalEventId,
        event_type: 'local_contacts_export_chunk',
        strategy_key: strategyKey,
        market,
        status: 'received',
        payload_hash: payloadHash,
        payload_json: {
          sourceFile,
          sourceHash,
          chunkIndex,
          chunkCount,
          listId,
          exportId,
        },
        rows_received: rows,
        rows_ingested: 0,
        error_message: null,
        occurred_at: now,
        updated_at: now,
      },
      { onConflict: 'provider,external_event_id' }
    )

  if (receivedError) {
    return NextResponse.json({ ok: false, error: receivedError.message }, { status: 500 })
  }

  try {
    const result = await ingestDealMachineContactsCsv({
      csvContent,
      strategyKey,
      matchedStrategyKeys: strategy && !strategy.candidateOnly ? [strategy.key] : [],
      strategySignals: strategy?.signals || [],
      candidateOnly: Boolean(strategy?.candidateOnly),
      candidateReason: strategy?.candidateReason || null,
      reviewOnly: Boolean(strategy?.reviewOnly),
      strategyVariant,
      sourceObservedAt: now,
      sourceFilters: [],
      market,
      listId,
      exportId,
    })
    const { error: completionError } = await admin
      .from('strategy_source_events')
      .update({
        status: 'completed',
        rows_received: result.rows,
        rows_ingested: result.ingested,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('provider', 'dealmachine')
      .eq('external_event_id', externalEventId)
    if (completionError) throw completionError

    return NextResponse.json({
      ok: true,
      duplicate: false,
      eventId: externalEventId,
      strategyKey,
      market,
      ...result,
      leads: undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin
      .from('strategy_source_events')
      .update({ status: 'blocked', error_message: message, updated_at: new Date().toISOString() })
      .eq('provider', 'dealmachine')
      .eq('external_event_id', externalEventId)
    return NextResponse.json({ ok: false, eventId: externalEventId, error: message }, { status: 500 })
  }
}
