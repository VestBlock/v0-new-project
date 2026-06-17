#!/usr/bin/env node

/**
 * Boss daily operating loop runner.
 *
 * Defaults to a safe dry-run against the local command center. Use --live to
 * call the deployed site, and --dispatch to create directive tasks.
 * Live sends require both --send and BOSS_DAILY_LOOP_ENABLE_SEND=true.
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

function has(flag) {
  return args.includes(flag)
}

function baseUrl() {
  const live = has('--live')
  if (!live) {
    return (process.env.VESTBLOCK_LOCAL_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
  }

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


function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function latestJson(dir, pattern) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => ({ file: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]?.file || null
  } catch {
    return null
  }
}

function offlineDryRunPayload(error) {
  const root = process.cwd()
  const rotation = readJson(path.join(root, 'data', 'operating-loops', 'tax-code-stack-rotation.json'))
  const smsFile = latestJson(path.join(root, 'tmp', 'outreach'), /^sms-review-queue-.*\.json$/)
  const sms = smsFile ? readJson(smsFile) : null
  const lanes = Array.isArray(rotation?.lanes) ? rotation.lanes : []
  const readyLanes = lanes.filter((lane) => lane.status === 'csv_ready_for_daily_send')
  const waitingLanes = lanes.filter((lane) => lane.status === 'waiting_for_dealmachine_export_email')
  return {
    success: true,
    dryRun: true,
    dispatch: false,
    send: false,
    mode: 'offline-local-snapshot',
    generatedAt: new Date().toISOString(),
    warning: `Command-center API was unreachable, so this is a local dry-run snapshot: ${error instanceof Error ? error.message : String(error)}`,
    boss: {
      focusKey: 'tax-code-stack-rotation',
      focusName: waitingLanes.length ? 'Load DealMachine export rotation' : 'Prepare next outreach lane',
      challengerKey: 'sms-review-queue',
      challengerName: 'Manual SMS review queue',
    },
    telemetry: {
      taxCodeLaneCount: lanes.length,
      taxCodeReadyLanes: readyLanes.length,
      taxCodeWaitingExportLanes: waitingLanes.length,
      smsAcceptedCount: sms?.acceptedCount || 0,
      smsRequestedLimit: sms?.requestedLimit || 0,
    },
    dispatchResult: {
      attempted: false,
      dispatched: 0,
      skipped: lanes.length,
      message: 'Offline dry run only; no Boss directives dispatched.',
    },
    sendAttempt: {
      attempted: false,
      ok: true,
      message: 'Offline dry run only; no sends attempted.',
    },
    exactNextActions: [
      waitingLanes.length
        ? `Watch for ${waitingLanes.length} DealMachine export email(s), ingest those CSVs, then run the listed send commands at the daily cap.`
        : 'Run a fresh DealMachine stack/export build for the next markets.',
      sms?.acceptedCount
        ? `Review ${sms.acceptedCount} SMS candidates before any manual text outreach.`
        : 'No SMS candidates are ready; download/import newer phone exports before texting.',
    ],
  }
}

const headers = {}
if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`

console.log(`Boss daily loop: ${url.toString()}`)

let response
try {
  response = await fetch(url, { headers })
} catch (error) {
  if (dryRun && !dispatch && !send) {
    console.log(JSON.stringify(offlineDryRunPayload(error), null, 2))
    process.exit(0)
  }
  throw error
}

const payload = await response.json().catch(() => ({}))

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(payload, null, 2))
