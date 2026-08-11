#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const STATE_DIR = path.join(ROOT, 'data', 'operating-loops')
const STATE_FILE = path.join(STATE_DIR, 'dealmachine-local-export-watcher-state.json')
const REPORT_DIR = path.join(ROOT, 'reports', 'dealmachine-export-watcher')
const DEFAULT_DIRS = [
  path.join(os.homedir(), 'Downloads'),
  path.join(ROOT, 'data', 'dm-exports', 'incoming'),
]
const STRATEGIES = [
  'tax-remote-equity-rotation',
  'small-multifamily-portfolio',
  'buyer-reverse-engineering',
  'probate-vacant-equity',
  'preforeclosure-equity',
  'active-stale-lowball',
  'tax-delinquent-cure',
  'portfolio-landlord',
  'builder-infill-teardown',
  'land-wholesale',
  'vacant-equity',
  'tax-code-stack',
  'lien-equity',
  'expired-lowball',
]

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = [...args].reverse().find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function integerArg(name, fallback, max) {
  const parsed = Number.parseInt(getArg(name), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      if (field || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvText(header, rows) {
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function isContactsExport(header) {
  const normalized = header.map((value) => normalizeSlug(value).replace(/-/g, '_'))
  return normalized.some((value) => /email|phone/.test(value)) &&
    normalized.some((value) => /property.*address|associated.*address|full_address/.test(value))
}

function inferMetadata(file) {
  const name = normalizeSlug(path.basename(file, path.extname(file)))
  const strategyKey = STRATEGIES.find((strategy) => name.includes(strategy)) || null
  let market = null
  if (strategyKey) {
    const afterStrategy = name.slice(name.indexOf(strategyKey) + strategyKey.length + 1)
    const withoutSuffix = afterStrategy
      .replace(/-\d{4}-\d{2}-\d{2}(?:-\d+)?$/, '')
      .replace(/-\d{8}(?:-\d+)?$/, '')
    const parts = withoutSuffix.split('-').filter(Boolean)
    if (parts.length >= 2) market = `${parts.slice(0, -1).join('-')}-${parts.at(-1)}`
  }
  return { strategyKey, market }
}

function candidateFiles(directories, sinceDays) {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
  const seen = new Set()
  const rows = []
  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue
    for (const name of fs.readdirSync(directory)) {
      if (!name.toLowerCase().endsWith('.csv')) continue
      const file = path.join(directory, name)
      const stat = fs.statSync(file)
      if (!stat.isFile() || stat.mtimeMs < cutoff) continue
      const real = fs.realpathSync(file)
      if (seen.has(real)) continue
      seen.add(real)
      rows.push({ file: real, name, mtimeMs: stat.mtimeMs, size: stat.size })
    }
  }
  return rows.sort((a, b) => a.mtimeMs - b.mtimeMs)
}

function endpointUrl(baseUrl, metadata, file, hash, chunkIndex, chunkCount) {
  const url = new URL('/api/cron/dealmachine-export-ingest', baseUrl)
  if (metadata.strategyKey) url.searchParams.set('strategyKey', metadata.strategyKey)
  if (metadata.market) url.searchParams.set('market', metadata.market)
  url.searchParams.set('sourceFile', path.basename(file))
  url.searchParams.set('sourceHash', hash)
  url.searchParams.set('chunkIndex', String(chunkIndex))
  url.searchParams.set('chunkCount', String(chunkCount))
  return url
}

async function postChunk({ baseUrl, secret, metadata, file, hash, chunkIndex, chunkCount, content }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetch(endpointUrl(baseUrl, metadata, file, hash, chunkIndex, chunkCount), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'text/csv; charset=utf-8',
        'user-agent': 'VestBlock-Pro-DealMachine-Watcher/1.0',
      },
      body: content,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function processFile(entry, config) {
  const text = fs.readFileSync(entry.file, 'utf8')
  const parsed = parseCsv(text)
  const header = parsed[0] || []
  const rows = parsed.slice(1).filter((row) => row.some((value) => String(value || '').trim()))
  if (!rows.length || !isContactsExport(header)) {
    return { ...entry, status: 'ignored', reason: 'not_a_contacts_export', rows: rows.length }
  }
  const hash = hashFile(entry.file)
  if (config.state.files[hash]?.status === 'completed') {
    return { ...entry, hash, status: 'duplicate', rows: rows.length }
  }
  const metadata = inferMetadata(entry.file)
  const chunks = []
  for (let start = 0; start < rows.length; start += config.chunkSize) {
    chunks.push(rows.slice(start, start + config.chunkSize))
  }
  const result = {
    ...entry,
    hash,
    status: APPLY ? 'processing' : 'preview',
    strategyKey: metadata.strategyKey,
    market: metadata.market,
    rows: rows.length,
    chunks: chunks.length,
    ingested: 0,
    rejected: 0,
    withEmail: 0,
    withPhone: 0,
    errors: [],
  }
  if (!APPLY) return result

  for (const [index, chunk] of chunks.entries()) {
    try {
      const response = await postChunk({
        baseUrl: config.baseUrl,
        secret: config.secret,
        metadata,
        file: entry.file,
        hash,
        chunkIndex: index,
        chunkCount: chunks.length,
        content: csvText(header, chunk),
      })
      result.ingested += Number(response.ingested || 0)
      result.rejected += Number(response.rejected || 0)
      result.withEmail += Number(response.withEmail || 0)
      result.withPhone += Number(response.withPhone || 0)
    } catch (error) {
      result.errors.push({ chunk: index, error: error instanceof Error ? error.message : String(error) })
      break
    }
  }
  result.status = result.errors.length ? 'blocked' : 'completed'
  config.state.files[hash] = {
    file: entry.file,
    status: result.status,
    rows: result.rows,
    ingested: result.ingested,
    rejected: result.rejected,
    strategyKey: result.strategyKey,
    market: result.market,
    updatedAt: new Date().toISOString(),
    errors: result.errors,
  }
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(config.state, null, 2)}\n`)
  return result
}

async function main() {
  const baseUrl = getArg('base-url', process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io')
  const secret = String(process.env.CRON_SECRET || '').trim()
  const sinceDays = integerArg('since-days', 30, 365)
  const chunkSize = integerArg('chunk-size', 250, 500)
  const maxFiles = integerArg('max-files', 25, 100)
  const directories = getArg('dirs')
    ? getArg('dirs').split('|').map((value) => path.resolve(value.trim())).filter(Boolean)
    : DEFAULT_DIRS
  if (APPLY && !secret) throw new Error('CRON_SECRET is required in --apply mode.')
  const state = readJson(STATE_FILE, { updatedAt: null, files: {} })
  const candidates = candidateFiles(directories, sinceDays).slice(0, maxFiles)
  const results = []
  for (const entry of candidates) {
    results.push(await processFile(entry, { baseUrl, secret, chunkSize, state }))
  }
  const report = {
    ok: !results.some((row) => row.status === 'blocked'),
    mode: APPLY ? 'apply' : 'preview',
    generatedAt: new Date().toISOString(),
    machine: os.hostname(),
    baseUrl,
    directories,
    sinceDays,
    candidates: candidates.length,
    contactsExports: results.filter((row) => !['ignored', 'duplicate'].includes(row.status)).length,
    completed: results.filter((row) => row.status === 'completed').length,
    duplicates: results.filter((row) => row.status === 'duplicate').length,
    ignored: results.filter((row) => row.status === 'ignored').length,
    rows: results.reduce((sum, row) => sum + Number(row.rows || 0), 0),
    ingested: results.reduce((sum, row) => sum + Number(row.ingested || 0), 0),
    results,
  }
  state.updatedAt = report.generatedAt
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportFile = path.join(REPORT_DIR, `dealmachine-export-watcher-${report.generatedAt.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  if (APPLY) fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
  console.log(JSON.stringify({ ...report, results: results.map((row) => ({
    file: row.file,
    status: row.status,
    strategyKey: row.strategyKey || null,
    market: row.market || null,
    rows: row.rows || 0,
    ingested: row.ingested || 0,
    error: row.errors?.[0]?.error || row.reason || null,
  })), reportFile }, null, 2))
  if (!report.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
