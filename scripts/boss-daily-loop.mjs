#!/usr/bin/env node

/**
 * Boss daily operating loop runner.
 *
 * Defaults to a safe dry-run. Use --dispatch to create directive tasks.
 * Live sends require both --send and BOSS_DAILY_LOOP_ENABLE_SEND=true.
 */

const args = process.argv.slice(2)

function has(flag) {
  return args.includes(flag)
}

function baseUrl() {
  return (
    process.env.VESTBLOCK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    'http://localhost:3001'
  ).replace(/\/+$/, '')
}

const dispatch = has('--dispatch')
const send = has('--send')
const dryRun = !dispatch && !send
const url = new URL('/api/cron/boss-daily-loop', baseUrl())
url.searchParams.set('dryRun', dryRun ? 'true' : 'false')
if (dispatch) url.searchParams.set('dispatch', 'true')
if (send) url.searchParams.set('send', 'true')

const headers = {}
if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`

console.log(`Boss daily loop: ${url.toString()}`)

const response = await fetch(url, { headers })
const payload = await response.json().catch(() => ({}))

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(payload, null, 2))
