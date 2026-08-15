export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'

import { syncDealMachineLeadSource } from '@/lib/dealmachine/api'
import { hasDealMachineCredentials, isDealMachineSourceEnabled } from '@/lib/dealmachine/v2-client.mjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function reportDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function envInt(name: string, fallback: number, max: number) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? Math.min(max, value) : fallback
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDealMachineSourceEnabled()) {
    return NextResponse.json({
      ok: false,
      configured: hasDealMachineCredentials(),
      enabled: false,
      error: 'DealMachine native synchronization is intentionally inactive.',
    }, { status: 503 })
  }
  if (!hasDealMachineCredentials()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: 'DEALMACHINE_API_KEY is not configured with a full official v2 secret.',
    }, { status: 503 })
  }

  const date = reportDate()
  const externalEventId = `official-v2-daily-acquisition:${date}`
  const admin = createAdminClient()
  const { data: prior, error: priorError } = await admin
    .from('strategy_source_events')
    .select('id,status,rows_received,rows_ingested,error_message,payload_json')
    .eq('provider', 'dealmachine')
    .eq('external_event_id', externalEventId)
    .maybeSingle()
  if (priorError) throw priorError
  if (prior?.status === 'completed') {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      date,
      rowsReceived: prior.rows_received || 0,
      rowsIngested: prior.rows_ingested || 0,
      report: prior.payload_json || {},
    })
  }

  const now = new Date().toISOString()
  const { error: receivedError } = await admin.from('strategy_source_events').upsert({
    provider: 'dealmachine',
    external_event_id: externalEventId,
    event_type: 'official_v2_daily_strategy_acquisition',
    status: 'received',
    payload_json: { date, apiFamily: 'official-v2', startedAt: now },
    rows_received: 0,
    rows_ingested: 0,
    occurred_at: now,
    updated_at: now,
  }, { onConflict: 'provider,external_event_id' })
  if (receivedError) throw receivedError

  const result = await syncDealMachineLeadSource({
    dryRun: false,
    maxPages: 17,
    pageSize: envInt('DEALMACHINE_DAILY_ROWS_PER_STRATEGY', 10, 50),
    maxCredits: envInt('DEALMACHINE_DAILY_CREDIT_BUDGET', 250, 5_000),
    startAfter: 0,
    includeLowball: true,
    maxLowballShare: 0.05,
  })
  const status = result.ingested > 0 || result.ok ? 'completed' : 'blocked'
  const report = {
    date,
    apiFamily: 'official-v2',
    lowballEnabled: true,
    lowballReviewOnly: true,
    lowballMaxAcquisitionShare: 0.05,
    strategiesPlanned: result.strategyRuns.length,
    strategyRuns: result.strategyRuns,
    creditsReserved: result.creditsReserved,
    fetched: result.fetched,
    contactable: result.contactable,
    contactless: result.contactless,
    ingested: result.ingested,
    blocker: result.blockedReason,
    completedAt: new Date().toISOString(),
  }
  const { error: completionError } = await admin.from('strategy_source_events').update({
    status,
    rows_received: result.fetched,
    rows_ingested: result.ingested,
    error_message: result.blockedReason,
    payload_json: report,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('provider', 'dealmachine').eq('external_event_id', externalEventId)
  if (completionError) throw completionError

  return NextResponse.json({ ok: status === 'completed', duplicate: false, configured: true, ...report })
}
