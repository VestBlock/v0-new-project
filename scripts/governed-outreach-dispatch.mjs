#!/usr/bin/env node

/**
 * Canonical CLI entry point for governed outreach delivery.
 *
 * It never calls an email provider directly. The production route owns the
 * delivery circuit breaker, central strategy budget, reservation ledger,
 * idempotency, suppression, and provider call.
 */

const args = process.argv.slice(2)

function hasFlag(name) {
  return args.includes(name)
}

function getArg(name, fallback = '') {
  const prefix = `${name}=`
  const inline = [...args].reverse().find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.lastIndexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

function positiveInt(name, fallback, maximum) {
  const parsed = Number.parseInt(getArg(name), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, parsed) : fallback
}

function cleanBaseUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(withProtocol)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Dispatch base URL must use HTTP or HTTPS.')
  return url.toString().replace(/\/$/, '')
}

function configuredBaseUrl() {
  return cleanBaseUrl(
    getArg('--base-url') ||
      process.env.VESTBLOCK_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://vestblock.io'
  )
}

async function main() {
  const live = hasFlag('--send')
  const forcedDryRun = hasFlag('--dry-run')
  if (live && forcedDryRun) throw new Error('Choose either --send or --dry-run, not both.')

  const baseUrl = configuredBaseUrl()
  const route = new URL('/api/cron/outreach-dispatch', baseUrl)
  const limit = positiveInt('--limit', 30, 50)
  route.searchParams.set('limit', String(limit))
  if (!live) route.searchParams.set('dryRun', 'true')

  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  const localTarget = ['localhost', '127.0.0.1', '::1'].includes(route.hostname)
  if (!cronSecret && !localTarget) {
    throw new Error('CRON_SECRET is required to invoke the governed outreach dispatcher outside local development.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300_000)
  let response
  try {
    response = await fetch(route, {
      method: 'GET',
      headers: cronSecret ? { authorization: `Bearer ${cronSecret}` } : {},
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`Governed outreach dispatcher returned HTTP ${response.status}: ${payload?.error || text || 'unknown error'}`)
  }
  if (live && !payload?.skipped && (payload?.dryRun !== false || payload?.liveEnabled !== true)) {
    throw new Error(
      'The governed dispatcher responded in dry-run mode. Enable OUTREACH_DISPATCH_CRON_SEND in production before requesting live delivery.'
    )
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: live ? 'governed_live_dispatch' : 'governed_dry_run',
        legacyEntry: getArg('--legacy-entry') || null,
        url: route.toString(),
        payload,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      null,
      2
    )
  )
  process.exit(1)
})
