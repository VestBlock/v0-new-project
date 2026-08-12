import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'

import { ingestDealMachineContactsCsv } from '@/lib/dealmachine/contactExport'
import { dealMachineStrategyProvenance } from '@/lib/dealmachine/strategyProvenance'

type RawPayload = Record<string, any>

function nowIso() {
  return new Date().toISOString()
}

function normalizeSlug(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function candidateSignatures(secret: string, rawBody: string) {
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest()
  return new Set([
    hmac.toString('hex'),
    hmac.toString('base64'),
    `sha256=${hmac.toString('hex')}`,
    `sha256=${hmac.toString('base64')}`,
  ])
}

export function verifyDealMachineWebhook(rawBody: string, headers: Headers) {
  const secret = String(process.env.DEALMACHINE_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    return {
      ok: false,
      verified: false,
      mode: 'unsigned',
      reason: 'DEALMACHINE_WEBHOOK_SECRET is required.',
    }
  }

  const provided = [
    headers.get('x-dealmachine-signature'),
    headers.get('x-dm-signature'),
    headers.get('x-signature'),
  ].map((value) => String(value || '').trim()).filter(Boolean)

  if (!provided.length) {
    return { ok: false, verified: false, mode: 'hmac_sha256', reason: 'Missing webhook signature header.' }
  }

  const candidates = candidateSignatures(secret, rawBody)
  for (const signature of provided) {
    for (const expected of candidates) {
      if (timingSafeEqualText(signature, expected)) {
        return { ok: true, verified: true, mode: 'hmac_sha256', reason: null }
      }
    }
  }

  return { ok: false, verified: false, mode: 'hmac_sha256', reason: 'Invalid webhook signature.' }
}

function parseListName(listName: string) {
  const text = String(listName || '').trim()
  const match = text.match(/^VB\s+(.+?)\s+([a-z]{2,}(?:-[a-z0-9]+)+)\s+\d{4}-\d{2}-\d{2}$/i)
  if (!match) return { strategyKey: null, market: null }
  return {
    strategyKey: normalizeSlug(match[1]),
    market: normalizeSlug(match[2]),
  }
}

function findStringByKey(obj: unknown, pattern: RegExp, depth = 0): string | null {
  if (depth > 6 || obj == null || typeof obj === 'string') return null
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findStringByKey(item, pattern, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof obj !== 'object') return null

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (pattern.test(key) && typeof value === 'string' && value.trim()) return value.trim()
    const nested = findStringByKey(value, pattern, depth + 1)
    if (nested) return nested
  }
  return null
}

function findAllUrls(obj: unknown, depth = 0, found: string[] = []) {
  if (depth > 6 || obj == null) return found
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj.trim())) found.push(obj.trim())
    return found
  }
  if (Array.isArray(obj)) {
    for (const item of obj) findAllUrls(item, depth + 1, found)
    return found
  }
  if (typeof obj !== 'object') return found
  for (const value of Object.values(obj as Record<string, unknown>)) findAllUrls(value, depth + 1, found)
  return found
}

function extractCsvContent(payload: RawPayload) {
  const direct = findStringByKey(payload, /csv(_content)?$/i) || findStringByKey(payload, /file_content/i)
  return direct && direct.includes(',') && direct.includes('\n') ? direct : null
}

function extractDownloadUrl(payload: RawPayload) {
  const prioritized =
    findStringByKey(payload, /download.*url/i) ||
    findStringByKey(payload, /csv.*url/i) ||
    findStringByKey(payload, /signed.*url/i) ||
    findStringByKey(payload, /file.*url/i)
  if (prioritized) return prioritized
  return findAllUrls(payload).find((value) => /\.csv(?:\.gz)?(\?|$)/i.test(value)) || null
}

function countCsvRows(content: string | null) {
  if (!content) return 0
  return Math.max(0, content.split(/\r?\n/).filter((line) => line.trim()).length - 1)
}

function safeDownloadUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('DealMachine export download must use HTTPS.')
  if (url.username || url.password) throw new Error('DealMachine export download URL cannot contain credentials.')
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error('DealMachine export download URL targets a private network address.')
  }
  return url
}

async function downloadCsv(value: string) {
  let url = safeDownloadUrl(value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    for (let redirect = 0; redirect < 4; redirect += 1) {
      const response = await fetch(url, {
        headers: { accept: 'text/csv,text/plain,application/octet-stream' },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('DealMachine export redirect did not include a destination.')
        url = safeDownloadUrl(new URL(location, url).toString())
        continue
      }
      if (!response.ok) throw new Error(`DealMachine export download failed with HTTP ${response.status}.`)
      const contentLength = Number(response.headers.get('content-length') || 0)
      if (contentLength > 25 * 1024 * 1024) throw new Error('DealMachine export exceeds the 25 MB limit.')
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength > 25 * 1024 * 1024) throw new Error('DealMachine export exceeds the 25 MB limit.')
      const decoded = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer
      const content = decoded.toString('utf8')
      if (!content.includes(',') || !content.includes('\n')) throw new Error('DealMachine export artifact is not a CSV file.')
      return content
    }
    throw new Error('DealMachine export used too many redirects.')
  } finally {
    clearTimeout(timeout)
  }
}

function stripEmbeddedCsv(payload: RawPayload) {
  const clone = JSON.parse(JSON.stringify(payload)) as RawPayload
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 6) return
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/csv(_content)?$|file_content/i.test(key) && typeof item === 'string') {
        ;(value as Record<string, unknown>)[key] = `[removed ${Buffer.byteLength(item)} byte embedded file]`
      } else {
        visit(item, depth + 1)
      }
    }
  }
  visit(clone)
  return clone
}

export function normalizeDealMachineWebhookPayload(payload: RawPayload) {
  const eventType = String(payload.event_type || payload.type || payload.event?.type || payload.name || 'unknown').trim()
  const eventId = String(payload.id || payload.event_id || payload.event?.id || `${eventType}:${Date.now()}`).trim()
  const listName = String(payload.data?.list_name || payload.list_name || payload.list?.name || '').trim()
  const parsedList = parseListName(listName)
  const market = normalizeSlug(payload.data?.market || payload.market || parsedList.market || '') || null
  const strategyKey = normalizeSlug(payload.data?.strategy_key || payload.strategy_key || parsedList.strategyKey || '') || null

  return {
    eventId,
    eventType,
    occurredAt: String(payload.occurred_at || payload.created_at || nowIso()),
    listId: String(payload.data?.list_id || payload.list_id || payload.list?.id || '').trim() || null,
    listName: listName || null,
    exportId: String(payload.data?.export_id || payload.export_id || '').trim() || null,
    market,
    strategyKey,
    csvContent: extractCsvContent(payload),
    downloadUrl: extractDownloadUrl(payload),
    payload,
  }
}

export async function persistDealMachineWebhookEvent(input: {
  payload: RawPayload
  rawBody: string
  headers: Headers
  verification: { ok: boolean; verified: boolean; mode: string; reason: string | null }
}) {
  const normalized = normalizeDealMachineWebhookPayload(input.payload)
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const rowsReceived = countCsvRows(normalized.csvContent)
  const status = /export|enrichment/i.test(normalized.eventType) ? 'received' : 'ignored'
  const payload = {
    listId: normalized.listId,
    listName: normalized.listName,
    exportId: normalized.exportId,
    verified: input.verification.verified,
    verificationMode: input.verification.mode,
    contentType: input.headers.get('content-type'),
    userAgent: input.headers.get('user-agent'),
    embeddedCsvRows: rowsReceived,
    raw: stripEmbeddedCsv(normalized.payload),
  }
  const { data, error } = await admin
    .from('strategy_source_events')
    .upsert(
      {
        provider: 'dealmachine',
        external_event_id: normalized.eventId,
        event_type: normalized.eventType,
        strategy_key: normalized.strategyKey,
        market: normalized.market,
        status,
        payload_hash: crypto.createHash('sha256').update(input.rawBody).digest('hex'),
        payload_json: payload,
        download_url: normalized.downloadUrl,
        rows_received: rowsReceived,
        occurred_at: normalized.occurredAt,
        updated_at: nowIso(),
      },
      { onConflict: 'provider,external_event_id' }
    )
    .select('id,status')
    .single()
  if (error) throw error

  if (status === 'ignored') {
    return {
      receivedAt: nowIso(),
      databaseId: data.id,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      occurredAt: normalized.occurredAt,
      listId: normalized.listId,
      listName: normalized.listName,
      exportId: normalized.exportId,
      market: normalized.market,
      strategyKey: normalized.strategyKey,
      artifactFile: null,
      downloadUrl: normalized.downloadUrl,
      rowsReceived,
      rowsIngested: 0,
      status: data.status,
      error: null,
      verified: input.verification.verified,
      verificationMode: input.verification.mode,
    }
  }

  let ingestion: Awaited<ReturnType<typeof ingestDealMachineContactsCsv>> | null = null
  let ingestionError: string | null = null
  try {
    const csvContent = normalized.csvContent ||
      (normalized.downloadUrl ? await downloadCsv(normalized.downloadUrl) : null)
    if (!csvContent) {
      throw new Error('Export event did not include embedded CSV content or a signed download URL.')
    }
    const strategy = dealMachineStrategyProvenance(normalized.strategyKey)
    ingestion = await ingestDealMachineContactsCsv({
      csvContent,
      strategyKey: normalized.strategyKey,
      matchedStrategyKeys: strategy && !strategy.candidateOnly ? [strategy.key] : [],
      strategySignals: strategy?.signals || [],
      candidateOnly: Boolean(strategy?.candidateOnly),
      candidateReason: strategy?.candidateReason || null,
      reviewOnly: Boolean(strategy?.reviewOnly),
      strategyVariant: strategy?.variant || null,
      sourceObservedAt: normalized.occurredAt,
      sourceFilters: [],
      market: normalized.market,
      listId: normalized.listId,
      exportId: normalized.exportId,
    })
  } catch (processingError) {
    ingestionError = processingError instanceof Error ? processingError.message : String(processingError)
  }

  const finalStatus = ingestionError ? 'blocked' : 'completed'
  const { error: completionError } = await admin
    .from('strategy_source_events')
    .update({
      status: finalStatus,
      rows_received: ingestion?.rows || rowsReceived,
      rows_ingested: ingestion?.ingested || 0,
      error_message: ingestionError,
      processed_at: nowIso(),
      payload_json: {
        ...payload,
        ingestion: ingestion
          ? {
              rows: ingestion.rows,
              withEmail: ingestion.withEmail,
              withPhone: ingestion.withPhone,
              ingested: ingestion.ingested,
              rejected: ingestion.rejected,
              rejectionReasons: ingestion.rejectionReasons,
            }
          : null,
      },
      updated_at: nowIso(),
    })
    .eq('id', data.id)
  if (completionError) throw completionError

  return {
    receivedAt: nowIso(),
    databaseId: data.id,
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    occurredAt: normalized.occurredAt,
    listId: normalized.listId,
    listName: normalized.listName,
    exportId: normalized.exportId,
    market: normalized.market,
    strategyKey: normalized.strategyKey,
    artifactFile: null,
    downloadUrl: normalized.downloadUrl,
    rowsReceived: ingestion?.rows || rowsReceived,
    rowsIngested: ingestion?.ingested || 0,
    status: finalStatus,
    error: ingestionError,
    verified: input.verification.verified,
    verificationMode: input.verification.mode,
  }
}

export async function readDealMachineWebhookSummary() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_source_events')
    .select('id,external_event_id,event_type,strategy_key,market,status,download_url,rows_received,rows_ingested,error_message,occurred_at,created_at')
    .eq('provider', 'dealmachine')
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) throw error
  return {
    updatedAt: nowIso(),
    totalRecent: data?.length || 0,
    recent: data || [],
  }
}
