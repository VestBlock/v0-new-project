import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { markJobsDownloaded } from '../../scripts/lib/dealmachine-export-jobs.mjs'

type RawPayload = Record<string, any>

const ROOT = process.cwd()
const WEBHOOK_DIR = path.join(ROOT, 'data', 'operating-loops')
const DM_INCOMING_DIR = path.join(ROOT, 'data', 'dm-exports', 'incoming')
const EVENTS_FILE = path.join(WEBHOOK_DIR, 'dealmachine-webhook-events.jsonl')
const SUMMARY_FILE = path.join(WEBHOOK_DIR, 'dealmachine-webhook-summary.json')

function ensureDirs() {
  fs.mkdirSync(WEBHOOK_DIR, { recursive: true })
  fs.mkdirSync(DM_INCOMING_DIR, { recursive: true })
}

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

function safeJsonRead(file: string, fallback: any) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function appendJsonl(file: string, row: unknown) {
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8')
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
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        verified: false,
        mode: 'unsigned',
        reason: 'DEALMACHINE_WEBHOOK_SECRET is required in production.',
      }
    }
    return { ok: true, verified: false, mode: 'unsigned', reason: 'No DEALMACHINE_WEBHOOK_SECRET configured.' as string | null }
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
  if (depth > 6 || obj == null) return null
  if (typeof obj === 'string') return null
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
  for (const value of Object.values(obj as Record<string, unknown>)) {
    findAllUrls(value, depth + 1, found)
  }
  return found
}

function extractCsvContent(payload: RawPayload) {
  const direct =
    findStringByKey(payload, /csv(_content)?$/i) ||
    findStringByKey(payload, /file_content/i)
  if (direct && direct.includes(',') && direct.includes('\n')) return direct
  return null
}

function extractDownloadUrl(payload: RawPayload) {
  const prioritized =
    findStringByKey(payload, /download.*url/i) ||
    findStringByKey(payload, /csv.*url/i) ||
    findStringByKey(payload, /signed.*url/i) ||
    findStringByKey(payload, /file.*url/i)
  if (prioritized) return prioritized
  return findAllUrls(payload).find((value) => /\.csv(\?|$)/i.test(value)) || null
}

export function normalizeDealMachineWebhookPayload(payload: RawPayload) {
  const eventType = String(
    payload.event_type ||
    payload.type ||
    payload.event?.type ||
    payload.name ||
    'unknown'
  ).trim()
  const eventId = String(
    payload.id ||
    payload.event_id ||
    payload.event?.id ||
    `${eventType}:${Date.now()}`
  ).trim()
  const listName = String(
    payload.data?.list_name ||
    payload.list_name ||
    payload.list?.name ||
    ''
  ).trim()
  const parsedList = parseListName(listName)
  const market =
    normalizeSlug(
      payload.data?.market ||
      payload.market ||
      parsedList.market ||
      ''
    ) || null
  const strategyKey =
    normalizeSlug(
      payload.data?.strategy_key ||
      payload.strategy_key ||
      parsedList.strategyKey ||
      ''
    ) || null

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

async function writeCsvArtifact(event: ReturnType<typeof normalizeDealMachineWebhookPayload>) {
  ensureDirs()
  let content = event.csvContent
  if (!content && event.downloadUrl) {
    const response = await fetch(event.downloadUrl)
    if (!response.ok) {
      throw new Error(`DealMachine webhook download failed with HTTP ${response.status}.`)
    }
    content = await response.text()
  }
  if (!content) return null

  const base = [
    event.market || 'unknown-market',
    event.strategyKey || 'unknown-strategy',
    normalizeSlug(event.eventType) || 'event',
    new Date().toISOString().replace(/[:.]/g, '-'),
  ].join('-')
  const file = path.join(DM_INCOMING_DIR, `${base}.csv`)
  fs.writeFileSync(file, content, 'utf8')
  if (event.market) {
    markJobsDownloaded({
      market: event.market,
      strategyKey: event.strategyKey,
      sourceFile: file,
    })
  }
  return file
}

function updateSummary(eventRecord: Record<string, any>) {
  ensureDirs()
  const current = safeJsonRead(SUMMARY_FILE, {
    updatedAt: null,
    totalEvents: 0,
    byType: {},
    lastArtifactFile: null,
    recent: [],
  })
  current.updatedAt = nowIso()
  current.totalEvents = Number(current.totalEvents || 0) + 1
  current.byType[eventRecord.eventType] = Number(current.byType[eventRecord.eventType] || 0) + 1
  if (eventRecord.artifactFile) current.lastArtifactFile = eventRecord.artifactFile
  current.recent = [eventRecord, ...(Array.isArray(current.recent) ? current.recent : [])].slice(0, 25)
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(current, null, 2))
}

export async function persistDealMachineWebhookEvent(input: {
  payload: RawPayload
  rawBody: string
  headers: Headers
  verification: { ok: boolean; verified: boolean; mode: string; reason: string | null }
}) {
  ensureDirs()
  const normalized = normalizeDealMachineWebhookPayload(input.payload)
  const artifactFile = /export|enrichment/i.test(normalized.eventType)
    ? await writeCsvArtifact(normalized)
    : null

  const eventRecord = {
    receivedAt: nowIso(),
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    occurredAt: normalized.occurredAt,
    listId: normalized.listId,
    listName: normalized.listName,
    exportId: normalized.exportId,
    market: normalized.market,
    strategyKey: normalized.strategyKey,
    artifactFile,
    downloadUrl: normalized.downloadUrl,
    verified: input.verification.verified,
    verificationMode: input.verification.mode,
    headers: {
      userAgent: input.headers.get('user-agent'),
      contentType: input.headers.get('content-type'),
      signature: input.headers.get('x-dealmachine-signature') || input.headers.get('x-dm-signature') || input.headers.get('x-signature'),
    },
    payload: normalized.payload,
    rawBodySha256: crypto.createHash('sha256').update(input.rawBody).digest('hex'),
  }

  appendJsonl(EVENTS_FILE, eventRecord)
  updateSummary(eventRecord)
  return eventRecord
}

export function readDealMachineWebhookSummary() {
  return safeJsonRead(SUMMARY_FILE, null)
}
