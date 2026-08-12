#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import {
  createDealMachineV2Client,
  dealMachineApiKey,
  downloadDealMachineExportFile,
  isDealMachineCredentialFormat,
} from '../lib/dealmachine/v2-client.mjs'
import { DEALMACHINE_STRATEGY_FIELDS } from '../lib/dealmachine/v2-strategy-catalog.mjs'

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(`--${name}`)
const getArg = (name) => {
  const hit = [...args].reverse().find((value) => value.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : ''
}

const ROOT = process.cwd()
const QUEUE_CSV = getArg('queue-csv')
const FROM_LATEST_REQUEST = hasFlag('from-latest-request')
const ANCHOR = getArg('anchor') || 'person'
const MAX_LISTS = Math.min(25, Math.max(1, Number.parseInt(getArg('max-lists') || '10', 10)))
const BATCH_SIZE = Math.min(250, Math.max(1, Number.parseInt(getArg('batch-size') || '250', 10)))
const POLL_SECONDS = Math.max(2, Number.parseInt(getArg('poll-seconds') || '8', 10))
const MAX_POLLS = Math.max(1, Number.parseInt(getArg('max-polls') || '45', 10))
const INGEST = hasFlag('ingest')
const APPLY = hasFlag('apply')
const DISTRESS_DIR = path.join(ROOT, 'data', 'distress-leads')
const INCOMING_DIR = path.join(ROOT, 'data', 'dm-exports', 'v2', 'list-exports')
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const SUMMARY_FILE = path.join(OUT_DIR, 'dealmachine-api-list-export-summary.json')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [headers = [], ...body] = rows
  return body.filter((line) => line.some(Boolean)).map((line) =>
    Object.fromEntries(headers.map((header, index) => [String(header || '').trim(), line[index] || '']))
  )
}

function first(row, names) {
  for (const name of names) {
    const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
    if (key && String(row[key] || '').trim()) return String(row[key]).trim()
  }
  return ''
}

function newestFile(dir, prefix) {
  if (!fs.existsSync(dir)) return null
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => ({ file: path.join(dir, name), mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0] || null
}

function buildQueueInputs() {
  if (QUEUE_CSV) {
    const file = path.resolve(ROOT, QUEUE_CSV)
    return [{ file, listName: `VestBlock ${path.basename(file, '.csv')}`, strategyKey: '', market: '' }]
  }
  if (!FROM_LATEST_REQUEST) throw new Error('Pass --queue-csv=... or --from-latest-request.')
  const latest = newestFile(DISTRESS_DIR, 'dealmachine-contact-export-request-summary-')
  if (!latest) return []
  const summary = JSON.parse(fs.readFileSync(latest.file, 'utf8'))
  return (summary.listPackages || []).map((item) => ({
    file: path.resolve(ROOT, item.file || ''),
    listName: item.listName || `${item.strategyKey || 'vestblock'} ${item.market || 'market'}`,
    strategyKey: item.strategyKey || '',
    market: item.market || '',
  })).filter((item) => fs.existsSync(item.file))
}

function collectRecordIds(file) {
  const seen = new Set()
  return parseCsvText(fs.readFileSync(file, 'utf8')).map((row) => first(row, [
    'dm_property_id', 'dealmachine_id', 'property_id', 'record_id', 'id',
  ])).filter((value) => value && !seen.has(value) && seen.add(value))
}

function chunks(values, size) {
  const rows = []
  for (let index = 0; index < values.length; index += size) rows.push(values.slice(index, index + size))
  return rows
}

async function waitForList(client, listId) {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const payload = await client.getList(listId)
    const status = String(payload?.data?.status || payload?.status || '').toLowerCase()
    if (['completed', 'complete', 'ready', 'idle'].includes(status)) return payload
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) throw new Error(`List ${listId} failed with ${status}.`)
    await sleep(POLL_SECONDS * 1_000)
  }
  throw new Error(`Timed out waiting for list ${listId}.`)
}

function ingest(csvPath, manifestPath) {
  const command = [
    'exec', 'ts-node', '-r', 'tsconfig-paths/register', '--compiler-options',
    '{"module":"commonjs","moduleResolution":"node"}',
    'scripts/dealmachine-v2-ingest.ts', `--csv=${csvPath}`, `--manifest=${manifestPath}`,
  ]
  if (!APPLY) command.push('--dry-run')
  const result = spawnSync('pnpm', command, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'List ingestion failed.')
  return JSON.parse(result.stdout)
}

async function main() {
  const key = dealMachineApiKey()
  if (!isDealMachineCredentialFormat(key)) {
    throw new Error('DEALMACHINE_API_KEY must contain a full official dm_sk_live_* or dm_at_live_* credential.')
  }
  fs.mkdirSync(INCOMING_DIR, { recursive: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const client = createDealMachineV2Client({ apiKey: key })
  await client.account()
  const availableFields = new Set((await client.listFields('properties')).map((row) => String(row.field_id || '')))
  const fields = DEALMACHINE_STRATEGY_FIELDS.filter((field) => availableFields.has(field))
  const actions = []

  for (const input of buildQueueInputs().slice(0, MAX_LISTS)) {
    const ids = collectRecordIds(input.file)
    if (!ids.length) {
      actions.push({ inputFile: input.file, status: 'skipped', reason: 'no_property_record_ids' })
      continue
    }
    for (const [index, recordIds] of chunks(ids, BATCH_SIZE).entries()) {
      const listName = `${input.listName}${ids.length > BATCH_SIZE ? ` batch ${index + 1}` : ''}`.slice(0, 255)
      const created = await client.createList({ name: listName, source_type: 'properties', record_ids: recordIds })
      const listId = String(created?.data?.list_id || created?.list_id || '')
      if (!listId) throw new Error(`Create list returned no list_id for ${listName}.`)
      await waitForList(client, listId)
      const exported = await client.exportList(listId, { fields, anchor: ANCHOR })
      const exportId = String(exported?.data?.export_id || exported?.export_id || '')
      const batchDir = path.join(INCOMING_DIR, normalizeSlug(listName), exportId || String(Date.now()))
      fs.mkdirSync(batchDir, { recursive: true })
      const manifestPath = path.join(batchDir, 'manifest.json')
      const manifest = {
        contractVersion: 2,
        provider: 'dealmachine',
        apiFamily: 'official-v2',
        mode: 'saved-list-export',
        strategyKey: input.strategyKey || null,
        variant: 'saved-list',
        signals: [],
        candidateOnly: !input.strategyKey,
        candidateReason: input.strategyKey ? null : 'The source package did not identify a strategy lane.',
        reviewOnly: !input.strategyKey,
        market: input.market || null,
        listId,
        exportId,
        sourceObservedAt: new Date().toISOString(),
        filters: [],
        files: [],
      }
      const downloaded = []
      let ingested = 0
      for (const download of client.downloadUrls(exported)) {
        const gzPath = path.join(batchDir, path.basename(download.filename))
        const gz = await downloadDealMachineExportFile(download)
        fs.writeFileSync(gzPath, gz)
        const csvPath = gzPath.replace(/\.gz$/i, '')
        fs.writeFileSync(csvPath, gunzipSync(gz))
        downloaded.push(csvPath)
        manifest.files.push({ gzPath, csvPath, bytes: gz.length })
      }
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      if (INGEST) {
        for (const csvPath of downloaded) ingested += Number(ingest(csvPath, manifestPath).ingested || 0)
      }
      actions.push({
        inputFile: input.file,
        status: 'exported',
        listName,
        listId,
        exportId,
        recordCount: recordIds.length,
        downloaded,
        ingested,
      })
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    apiFamily: 'official-v2',
    anchor: ANCHOR,
    ingest: INGEST,
    apply: APPLY,
    actions,
  }
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exitCode = 1
})
