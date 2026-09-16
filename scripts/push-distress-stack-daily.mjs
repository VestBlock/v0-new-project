#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { pushSourceBatchInChunks } from './push-strategy-source-batch.mjs'

const MARKET_DETAILS = {
  cincinnati: { city: 'Cincinnati', state: 'OH', county: 'Hamilton', signalTypes: ['tax_delinquent', 'code_violation'] },
  milwaukee: { city: 'Milwaukee', state: 'WI', county: 'Milwaukee', signalTypes: ['tax_delinquent', 'code_violation'] },
  toledo: { city: 'Toledo', state: 'OH', county: 'Lucas', signalTypes: ['tax_delinquent', 'code_violation'] },
  detroit: { city: 'Detroit', state: 'MI', county: 'Wayne', signalTypes: ['code_violation', 'absentee_owner'] },
}

function arg(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || ''
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const input = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      if (field.length || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else {
      field += char
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [headers = [], ...data] = rows
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ''])))
}

function normalizeAddress(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\b(STREET)\b/g, 'ST')
    .replace(/\b(AVENUE)\b/g, 'AVE')
    .replace(/\b(ROAD)\b/g, 'RD')
    .replace(/\b(BOULEVARD)\b/g, 'BLVD')
    .replace(/[^A-Z0-9]/g, '')
}

function numeric(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function rank(row) {
  const text = `${row.violation || ''} ${row.foreclosure_flag || ''} ${row.delinquent_owner || ''}`.toLowerCase()
  const amount = numeric(row.delinquent_amount)
  return 100
    + Math.min(30, Math.log10(Math.max(1, amount)) * 7)
    + (/foreclos/.test(text) ? 25 : 0)
    + (/vacant|blight|nuisance|grass|code/.test(text) ? 18 : 0)
    + (/absentee|mails from/.test(text) ? 14 : 0)
    + (String(row.delinquent_parcel || '').trim() ? 8 : 0)
    + (String(row.violation_date || '').trim() ? 4 : 0)
}

function marketFromFile(file, date) {
  const suffix = `-${date}-BOTH-SIGNALS.csv`
  return file.endsWith(suffix) ? file.slice(0, -suffix.length).toLowerCase() : ''
}

export function loadDailyCandidates({ directory, date }) {
  if (!fs.existsSync(directory)) return []
  const candidates = []
  for (const file of fs.readdirSync(directory).sort()) {
    const market = marketFromFile(file, date)
    if (!market || !MARKET_DETAILS[market]) continue
    const details = MARKET_DETAILS[market]
    for (const row of parseCsv(fs.readFileSync(path.join(directory, file), 'utf8'))) {
      const address = String(row.address || '').trim()
      const isStackMatch = String(row.stack_match || '').toUpperCase() === 'YES'
        || String(row.tax_delinquent_hit || '').toUpperCase() === 'YES'
      if (!address || !isStackMatch) continue
      const city = String(row.city || details.city).trim() || details.city
      const state = String(row.state || details.state).trim().toUpperCase() || details.state
      candidates.push({
        ...row,
        property_address: address,
        city,
        state,
        county: String(row.county || details.county).trim() || details.county,
        parcel_id: String(row.delinquent_parcel || '').trim(),
        owner_name: String(row.delinquent_owner || '').trim(),
        tax_delinquent_hit: details.signalTypes.includes('tax_delinquent') ? row.tax_delinquent_hit : '',
        stack_match: 'YES',
        strategy: 'public-record-distress-stack',
        signal_types: details.signalTypes.join('|'),
        signal_count: details.signalTypes.length,
        source_market: market,
        source_file: file,
        _market: market,
        _score: rank(row),
        _key: `${state}|${city.toUpperCase()}|${normalizeAddress(address)}`,
      })
    }
  }
  return candidates
}

export function selectDailyCandidates(candidates, limit = 500) {
  const deduped = new Map()
  for (const candidate of candidates) {
    const existing = deduped.get(candidate._key)
    if (!existing || candidate._score > existing._score) deduped.set(candidate._key, candidate)
  }
  const sorted = [...deduped.values()].sort((left, right) => right._score - left._score || left._key.localeCompare(right._key))
  if (sorted.length <= limit) return sorted

  // Prevent one city from consuming the entire daily Stack allocation while
  // still backfilling unused capacity when other markets have fewer records.
  const firstPassCap = Math.max(1, Math.ceil(limit * 0.5))
  const counts = new Map()
  const selected = []
  const deferred = []
  for (const row of sorted) {
    const count = counts.get(row._market) || 0
    if (count < firstPassCap && selected.length < limit) {
      selected.push(row)
      counts.set(row._market, count + 1)
    } else {
      deferred.push(row)
    }
  }
  for (const row of deferred) {
    if (selected.length >= limit) break
    selected.push(row)
  }
  return selected
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function toCsv(rows) {
  const columns = [
    'property_address', 'city', 'state', 'county', 'parcel_id', 'owner_name',
    'violation', 'violation_date', 'stack_match', 'tax_delinquent_hit', 'delinquent_amount', 'foreclosure_flag',
    'strategy', 'signal_types', 'signal_count', 'source_market', 'source_file',
  ]
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
}

async function runCli() {
  try {
    process.loadEnvFile?.('.env.local')
  } catch {
    // Hosted or launchd environments may inject variables directly.
  }
  const date = arg('date') || new Date().toISOString().slice(0, 10)
  const requestedLimit = Number(arg('limit') || 500)
  const limit = Math.max(1, Math.min(1000, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 500))
  const apply = process.argv.includes('--apply')
  const root = process.cwd()
  const directory = path.join(root, 'data', 'distress-leads')
  const outputDirectory = path.join(root, 'data', 'operating-loops')
  fs.mkdirSync(outputDirectory, { recursive: true })

  const observed = loadDailyCandidates({ directory, date })
  const selected = selectDailyCandidates(observed, limit)
  if (!selected.length) throw new Error(`No two-signal Stack candidates were found for ${date}.`)

  const csv = toCsv(selected)
  const selectedFile = path.join(outputDirectory, `distress-stack-selected-${date}.csv`)
  fs.writeFileSync(selectedFile, `${csv}\n`)
  const sourceName = 'public_distress_stack:multi-signal'
  // One stable production batch per business date keeps launchd retries from
  // turning the same daily allocation into another 500 sourcing events.
  const batchId = `${date}:distress-stack-top-${limit}`
  let bridge = { success: true, applied: false }
  if (apply) {
    const secret = String(process.env.CRON_SECRET || '').trim()
    if (!secret) throw new Error('CRON_SECRET is required for an applied Stack batch.')
    const baseUrl = String(process.env.VESTBLOCK_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/+$/, '')
    bridge = await pushSourceBatchInChunks({
      endpoint: `${baseUrl}/api/webhooks/strategy-source-batch`,
      authorization: `Bearer ${secret}`,
      payload: {
        batchId,
        sourceName,
        fileName: path.basename(selectedFile),
        fileType: 'text/csv',
        confidenceLevel: 92,
        apply: true,
        content: csv,
      },
    })
  }

  const markets = selected.reduce((result, row) => {
    result[row._market] = (result[row._market] || 0) + 1
    return result
  }, {})
  const report = {
    generatedAt: new Date().toISOString(),
    date,
    apply,
    candidatesObserved: observed.length,
    uniqueCandidates: new Set(observed.map((row) => row._key)).size,
    selected: selected.length,
    limit,
    markets,
    selectedFile,
    bridge,
    contactLookupCountedAsSourcing: false,
  }
  const reportFile = path.join(outputDirectory, 'distress-stack-production-latest.json')
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (invokedUrl === import.meta.url) await runCli()
