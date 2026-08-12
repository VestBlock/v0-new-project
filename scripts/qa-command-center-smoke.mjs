#!/usr/bin/env node

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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function buildHeaders() {
  if (!process.env.CRON_SECRET) return {}
  return { authorization: `Bearer ${process.env.CRON_SECRET}` }
}

async function runChecks(baseUrl) {
  const checks = []

  const adminUrl = new URL('/admin/command-center', baseUrl)
  const admin = await fetchWithTimeout(adminUrl, { redirect: 'manual' })
  checks.push({
    name: 'admin command center gate',
    url: adminUrl.toString(),
    status: admin.status,
    ok: admin.status < 500 && [200, 302, 303, 307, 308, 401, 403].includes(admin.status),
  })

  const loginUrl = new URL('/login?redirect=%2Fadmin%2Fcommand-center', baseUrl)
  const login = await fetchWithTimeout(loginUrl, { redirect: 'manual' })
  checks.push({
    name: 'admin login redirect target',
    url: loginUrl.toString(),
    status: login.status,
    ok: login.status < 500 && [200, 302, 303, 307, 308, 401, 403].includes(login.status),
  })

  const bossUrl = new URL('/api/cron/boss-daily-loop', baseUrl)
  bossUrl.searchParams.set('dryRun', 'true')
  const boss = await fetchWithTimeout(bossUrl, { headers: buildHeaders() })
  let bossPayload = null
  try {
    bossPayload = await boss.json()
  } catch {
    bossPayload = null
  }
  checks.push({
    name: 'boss daily loop endpoint',
    url: bossUrl.toString(),
    status: boss.status,
    ok: boss.status < 500 && [200, 401, 403].includes(boss.status),
    payload: bossPayload,
  })

  return checks
}

function writeReport(result) {
  fs.mkdirSync(reportDir, { recursive: true })
  fs.writeFileSync(
    path.join(reportDir, 'command-center-qa-latest.json'),
    `${JSON.stringify(result, null, 2)}\n`
  )

  const lines = [
    '# VestBlock Command Center QA',
    '',
    `- Status: ${result.ok ? 'ok' : 'failed'}`,
    `- Generated: ${result.generatedAt}`,
    `- Base URL: ${result.baseUrl || 'none'}`,
    '',
    '## Checks',
    '',
    ...result.checks.map(
      (check) =>
        `- ${check.ok ? 'OK' : 'FAIL'} ${check.name}: ${check.status || 'network-error'} (${check.url})`
    ),
  ]

  if (result.error) lines.push('', '## Error', '', result.error)

  fs.writeFileSync(path.join(reportDir, 'command-center-qa-latest.md'), `${lines.join('\n')}\n`)
}

let result = null
const failures = []

for (const baseUrl of candidateBaseUrls()) {
  try {
    const checks = await runChecks(baseUrl)
    const ok = checks.every((check) => check.ok)
    result = {
      ok,
      generatedAt: new Date().toISOString(),
      baseUrl,
      checks,
    }
    if (ok) break
    failures.push(result)
  } catch (error) {
    failures.push({
      ok: false,
      generatedAt: new Date().toISOString(),
      baseUrl,
      checks: [],
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

if (!result || !result.ok) {
  result = failures.at(-1) || {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl: null,
    checks: [],
    error: 'No command center target responded.',
  }
}

writeReport(result)
console.log(JSON.stringify(result, null, 2))

if (!result.ok) process.exit(1)
