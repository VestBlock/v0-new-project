import 'server-only'

import { createHash } from 'node:crypto'

import { syncDealMachineLeadSource, type DealMachineSyncResult } from '@/lib/dealmachine/api'
import { hasDealMachineCredentials } from '@/lib/dealmachine/v2-client.mjs'
import { createAdminClient } from '@/lib/supabase/admin'

type SourceEventRow = {
  id: string
  status: string | null
  rows_received: number | null
  rows_ingested: number | null
  payload_json: Record<string, unknown> | null
}

export type N8nDealMachineAcquisitionResult = {
  ok: boolean
  duplicate: boolean
  deferred: boolean
  date: string
  slot: number
  creditBudget: {
    dailyCap: number
    usedBeforeRun: number
    remainingBeforeRun: number
    runCap: number
    usedThisRun: number
  }
  source: {
    fetched: number
    ingested: number
    contactable: number
    contactless: number
    strategiesAttempted: number
    strategiesCompleted: number
    nextCursor: number
  }
  blocker: string | null
}

function envInt(name: string, fallback: number, maximum: number) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? Math.min(value, maximum) : fallback
}

function reportDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function centralHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return Number.parseInt(hour, 10) || 0
}

function centralDateStart(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  let guess = new Date(Date.UTC(year, month - 1, day, 6, 0, 0))
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(guess)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
    const zonedAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
    guess = new Date(Date.UTC(year, month - 1, day) - (zonedAsUtc - guess.getTime()))
  }
  return guess
}

function dayBounds(date: string) {
  const start = centralDateStart(date)
  const [year, month, day] = date.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
  const endDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrow)
  return { start: start.toISOString(), end: centralDateStart(endDate).toISOString() }
}

function numericValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function sourceEventCredits(row: SourceEventRow) {
  const payload = row.payload_json || {}
  return numericValue(payload.creditsReserved ?? payload.creditsUsed ?? payload.credits_used)
}

function safeStatus(result: DealMachineSyncResult) {
  return result.ok || result.fetched > 0 || result.ingested > 0 ? 'completed' : 'blocked'
}

function compactResult(input: {
  ok: boolean
  duplicate?: boolean
  deferred?: boolean
  date: string
  slot: number
  dailyCap: number
  usedBeforeRun: number
  runCap: number
  result?: DealMachineSyncResult
  blocker?: string | null
}): N8nDealMachineAcquisitionResult {
  const source = input.result
  return {
    ok: input.ok,
    duplicate: Boolean(input.duplicate),
    deferred: Boolean(input.deferred),
    date: input.date,
    slot: input.slot,
    creditBudget: {
      dailyCap: input.dailyCap,
      usedBeforeRun: input.usedBeforeRun,
      remainingBeforeRun: Math.max(0, input.dailyCap - input.usedBeforeRun),
      runCap: input.runCap,
      usedThisRun: source?.creditsReserved || 0,
    },
    source: {
      fetched: source?.fetched || 0,
      ingested: source?.ingested || 0,
      contactable: source?.contactable || 0,
      contactless: source?.contactless || 0,
      strategiesAttempted: source?.strategyRuns.length || 0,
      strategiesCompleted: source?.strategyRuns.filter((run) => run.status === 'searched').length || 0,
      nextCursor: source?.nextAfter || 0,
    },
    blocker: input.blocker ?? source?.blockedReason ?? null,
  }
}

async function loadCursor() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_source_events')
    .select('payload_json')
    .eq('provider', 'dealmachine')
    .eq('external_event_id', 'n8n-v2-source-cursor')
    .maybeSingle()
  if (error) throw error
  const value = Number((data?.payload_json as Record<string, unknown> | null)?.nextAfter || 0)
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

async function saveCursor(nextAfter: number, date: string, slot: number) {
  const admin = createAdminClient()
  const payload = { nextAfter, date, slot, updatedAt: new Date().toISOString() }
  const { error } = await admin.from('strategy_source_events').upsert({
    provider: 'dealmachine',
    external_event_id: 'n8n-v2-source-cursor',
    event_type: 'cursor_checkpoint',
    status: 'completed',
    payload_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    payload_json: payload,
    rows_received: 0,
    rows_ingested: 0,
    processed_at: payload.updatedAt,
    updated_at: payload.updatedAt,
  }, { onConflict: 'provider,external_event_id' })
  if (error) throw error
}

/** Discovers and ingests sourced leads only; never drafts or sends outreach. */
export async function runN8nDealMachineSourceAcquisition(now = new Date()): Promise<N8nDealMachineAcquisitionResult> {
  const date = reportDate(now)
  const slotHours = envInt('N8N_DEALMACHINE_SOURCE_SLOT_HOURS', 4, 24)
  const slot = Math.floor(centralHour(now) / slotHours)
  const externalEventId = `n8n-v2-source-acquisition:${date}:${slot}`
  const dailyCap = envInt(
    'DEALMACHINE_AUTOMATION_DAILY_CREDIT_CAP',
    envInt('DEALMACHINE_DAILY_CREDIT_BUDGET', 250, 5_000),
    5_000
  )
  const defaultRunCap = Math.max(1, Math.floor(dailyCap / Math.max(1, Math.floor(24 / slotHours))))
  const configuredRunCap = envInt('N8N_DEALMACHINE_SOURCE_CREDIT_CAP_PER_RUN', defaultRunCap, dailyCap)

  if (!hasDealMachineCredentials()) {
    return compactResult({ ok: false, date, slot, dailyCap, usedBeforeRun: 0, runCap: 0, blocker: 'DEALMACHINE_API_KEY is not configured with a full official v2 secret.' })
  }

  const admin = createAdminClient()
  const existing = await admin
    .from('strategy_source_events')
    .select('id,status,rows_received,rows_ingested,payload_json')
    .eq('provider', 'dealmachine')
    .eq('external_event_id', externalEventId)
    .maybeSingle<SourceEventRow>()
  if (existing.error) throw existing.error
  if (existing.data) {
    const payload = existing.data.payload_json || {}
    const previous = payload.result as DealMachineSyncResult | undefined
    return compactResult({
      ok: ['completed', 'partial'].includes(String(existing.data.status || '')),
      duplicate: true,
      deferred: payload.deferred === true,
      date,
      slot,
      dailyCap,
      usedBeforeRun: numericValue(payload.usedBeforeRun),
      runCap: numericValue(payload.runCap),
      blocker: typeof payload.blocker === 'string' ? payload.blocker : null,
      result: previous,
    })
  }

  const bounds = dayBounds(date)
  const today = await admin
    .from('strategy_source_events')
    .select('id,status,rows_received,rows_ingested,payload_json')
    .eq('provider', 'dealmachine')
    .gte('occurred_at', bounds.start)
    .lt('occurred_at', bounds.end)
  if (today.error) throw today.error
  const usedBeforeRun = ((today.data as SourceEventRow[] | null) || []).reduce((sum, row) => sum + sourceEventCredits(row), 0)
  const runCap = Math.min(configuredRunCap, Math.max(0, dailyCap - usedBeforeRun))
  const receivedAt = new Date().toISOString()
  const receivedPayload = { trigger: 'n8n', date, slot, dailyCap, usedBeforeRun, runCap, startedAt: receivedAt }
  const { error: insertError } = await admin.from('strategy_source_events').insert({
    provider: 'dealmachine',
    external_event_id: externalEventId,
    event_type: 'n8n_official_v2_source_acquisition',
    status: 'received',
    payload_hash: createHash('sha256').update(JSON.stringify(receivedPayload)).digest('hex'),
    payload_json: receivedPayload,
    rows_received: 0,
    rows_ingested: 0,
    occurred_at: receivedAt,
    updated_at: receivedAt,
  })
  if (insertError?.code === '23505') return runN8nDealMachineSourceAcquisition(now)
  if (insertError) throw insertError

  if (runCap < 1) {
    const blocker = 'Daily DealMachine credit cap has been reached; the next source slot will resume after the Central-time reset.'
    const payload = { ...receivedPayload, deferred: true, blocker, completedAt: new Date().toISOString() }
    const { error } = await admin.from('strategy_source_events').update({
      status: 'completed',
      payload_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      payload_json: payload,
      processed_at: payload.completedAt,
      updated_at: payload.completedAt,
    }).eq('provider', 'dealmachine').eq('external_event_id', externalEventId)
    if (error) throw error
    return compactResult({ ok: true, deferred: true, date, slot, dailyCap, usedBeforeRun, runCap, blocker })
  }

  const cursor = await loadCursor()
  const result = await syncDealMachineLeadSource({
    dryRun: false,
    maxPages: envInt('N8N_DEALMACHINE_SOURCE_STRATEGIES_PER_RUN', 4, 17),
    pageSize: envInt('DEALMACHINE_DAILY_ROWS_PER_STRATEGY', 10, 50),
    maxCredits: runCap,
    startAfter: cursor,
    includeLowball: true,
    maxLowballShare: 0.05,
  })
  const completedAt = new Date().toISOString()
  const payload = {
    ...receivedPayload,
    cursorBeforeRun: cursor,
    result: {
      configured: result.configured,
      ok: result.ok,
      blocker: result.blockedReason,
      fetched: result.fetched,
      contactable: result.contactable,
      contactless: result.contactless,
      ingested: result.ingested,
      creditsReserved: result.creditsReserved,
      nextAfter: result.nextAfter,
      strategyRuns: result.strategyRuns,
    },
    completedAt,
  }
  const { error: completionError } = await admin.from('strategy_source_events').update({
    status: safeStatus(result),
    rows_received: result.fetched,
    rows_ingested: result.ingested,
    error_message: result.blockedReason,
    payload_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    payload_json: payload,
    processed_at: completedAt,
    updated_at: completedAt,
  }).eq('provider', 'dealmachine').eq('external_event_id', externalEventId)
  if (completionError) throw completionError
  if (result.creditsReserved > 0 || result.fetched > 0) await saveCursor(result.nextAfter, date, slot)

  return compactResult({ ok: result.ok, date, slot, dailyCap, usedBeforeRun, runCap, result })
}
