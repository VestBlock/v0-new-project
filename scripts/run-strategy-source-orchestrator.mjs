#!/usr/bin/env node

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // Deployed and CI environments provide variables directly.
}

function intArg(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const baseUrl = String(process.env.VESTBLOCK_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/+$/, '')
const cronSecret = String(process.env.CRON_SECRET || '').trim()
if (!cronSecret) throw new Error('CRON_SECRET is required to invoke the source orchestrator.')

const params = new URLSearchParams({ limit: String(intArg('limit', 1000)) })
if (!process.argv.includes('--apply')) params.set('dryRun', 'true')

const response = await fetch(`${baseUrl}/api/cron/strategy-source-orchestrator?${params}`, {
  headers: { authorization: `Bearer ${cronSecret}` },
  signal: AbortSignal.timeout(125000),
})
const text = await response.text()
if (!response.ok) throw new Error(`Source orchestrator HTTP ${response.status}: ${text.slice(0, 500)}`)
const contentType = response.headers.get('content-type') || ''
if (!contentType.includes('application/json')) {
  throw new Error(`Source orchestrator returned ${contentType || 'an unknown content type'} instead of JSON. The deployment may be protected or misrouted.`)
}
const result = JSON.parse(text)
if (result?.success !== true) throw new Error(`Source orchestrator did not report success: ${text.slice(0, 500)}`)
console.log(JSON.stringify(result, null, 2))
