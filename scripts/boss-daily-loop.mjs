#!/usr/bin/env node

/**
 * Boss daily operating loop runner.
 *
 * Defaults to a safe dry-run. It tries the local command center first, then
 * falls back to configured/live URLs so morning reports do not silently die
 * when the local dev server is not running.
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const reportDir = path.resolve('data/operating-loops')

function has(flag) {
  return args.includes(flag)
}

function cleanBaseUrl(value) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function candidateBaseUrls() {
  const liveCandidates = [
    process.env.VESTBLOCK_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`),
    'https://vestblock.io',
  ].map(cleanBaseUrl)

  if (has('--live')) return unique(liveCandidates)

  return unique([
    cleanBaseUrl(process.env.VESTBLOCK_LOCAL_BASE_URL || 'http://localhost:3001'),
    ...liveCandidates,
  ])
}

const dispatch = has('--dispatch')
const send = has('--send')
const dryRun = !dispatch && !send

const headers = {}
if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`

function buildUrl(baseUrl) {
  const url = new URL('/api/cron/boss-daily-loop', baseUrl)
  url.searchParams.set('dryRun', dryRun ? 'true' : 'false')
  if (dispatch) url.searchParams.set('dispatch', 'true')
  if (send) url.searchParams.set('send', 'true')
  return url
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    return await fetch(url, { headers, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function writeReports(result) {
  fs.mkdirSync(reportDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(reportDir, 'boss-daily-loop-latest.json')
  const markdownPath = path.join(reportDir, 'boss-daily-loop-latest.md')
  const stampedJsonPath = path.join(reportDir, `boss-daily-loop-${stamp}.json`)

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(stampedJsonPath, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(markdownPath, renderMarkdownReport(result))
}

function renderMarkdownReport(result) {
  const lines = [
    '# VestBlock Boss Daily Loop',
    '',
    `- Status: ${result.ok ? 'ok' : 'failed'}`,
    `- Mode: ${dryRun ? 'dry-run' : send ? 'send' : 'dispatch'}`,
    `- Generated: ${result.generatedAt}`,
    `- URL used: ${result.url || 'none'}`,
    '',
    '## Attempts',
    '',
    ...result.attempts.map(
      (attempt) =>
        `- ${attempt.baseUrl}: ${attempt.status || 'network-error'}${
          attempt.error ? ` (${attempt.error})` : ''
        }`
    ),
  ]

  if (result.payload && typeof result.payload === 'object') {
    lines.push('', '## Payload', '', '```json', JSON.stringify(result.payload, null, 2), '```')
  }

  if (result.error) lines.push('', '## Error', '', result.error)

  return `${lines.join('\n')}\n`
}

const attempts = []
let finalResult = null

for (const baseUrl of candidateBaseUrls()) {
  const url = buildUrl(baseUrl)
  console.log(`Boss daily loop: ${url.toString()}`)

  try {
    const response = await fetchWithTimeout(url)
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    const attempt = { baseUrl, url: url.toString(), status: response.status, ok: response.ok }
    attempts.push(attempt)

    if (response.ok) {
      finalResult = {
        ok: true,
        generatedAt: new Date().toISOString(),
        url: url.toString(),
        attempts,
        payload,
      }
      break
    }

    finalResult = {
      ok: false,
      generatedAt: new Date().toISOString(),
      url: url.toString(),
      attempts,
      payload,
      error: `Boss loop returned HTTP ${response.status}.`,
    }

    if (response.status === 401 || response.status === 403) break
  } catch (error) {
    attempts.push({
      baseUrl,
      url: url.toString(),
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

if (!finalResult) {
  finalResult = {
    ok: false,
    generatedAt: new Date().toISOString(),
    url: null,
    attempts,
    error: 'No boss daily loop endpoint responded.',
  }
}

writeReports(finalResult)

if (!finalResult.ok) {
  console.error(JSON.stringify(finalResult, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(finalResult.payload, null, 2))
