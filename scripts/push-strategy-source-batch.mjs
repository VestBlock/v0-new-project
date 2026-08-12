#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // CI and deployed environments provide variables directly.
}

function arg(name) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || ''
}

const input = resolve(arg('input'))
const sourceName = arg('source-name')
const sourceUrl = arg('source-url') || null
const baseUrl = String(process.env.VESTBLOCK_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/+$/, '')
const cronSecret = String(process.env.CRON_SECRET || '').trim()
if (!arg('input')) throw new Error('--input=/absolute/path/to/file.csv is required.')
if (!sourceName) throw new Error('--source-name=County/portal/source is required.')
if (!cronSecret) throw new Error('CRON_SECRET is required.')

const content = await readFile(input, 'utf8')
const batchId = arg('batch-id') || createHash('sha256').update(`${sourceName}\n${content}`).digest('hex')
const payload = {
  batchId,
  sourceName,
  sourceUrl,
  fileName: basename(input),
  fileType: input.toLowerCase().endsWith('.geojson') ? 'application/geo+json' : 'text/csv',
  confidenceLevel: Number(arg('confidence') || 70),
  apply: process.argv.includes('--apply'),
  content,
}

const response = await fetch(`${baseUrl}/api/webhooks/strategy-source-batch`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${cronSecret}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(125000),
})
const text = await response.text()
if (!response.ok) throw new Error(`Source batch HTTP ${response.status}: ${text.slice(0, 600)}`)
if (!(response.headers.get('content-type') || '').includes('application/json')) {
  throw new Error('Source batch endpoint returned non-JSON content. Check deployment protection and routing.')
}
const result = JSON.parse(text)
if (result?.success !== true) throw new Error(`Source batch failed: ${text.slice(0, 600)}`)
console.log(JSON.stringify(result, null, 2))
