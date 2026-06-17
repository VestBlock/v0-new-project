#!/usr/bin/env node

/**
 * One command to start VestBlock revenue ops in safe mode.
 *
 * It runs non-destructive checks/queues so the team no longer has to
 * rediscover the order for boss loop, sender health, lead rotation, and SMS.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const REPORT_DIR = path.join(ROOT, 'data', 'operating-loops')
const REPORT_PATH = path.join(REPORT_DIR, 'revenue-ops-latest.json')

function run(name, command, args) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  return {
    name,
    command: [command, ...args].join(' '),
    ok: result.status === 0,
    status: result.status,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: String(result.stdout || '').slice(-8000),
    stderr: String(result.stderr || '').slice(-8000),
  }
}

const steps = [
  { name: 'boss-daily-loop', command: 'npm', args: ['run', 'boss:daily-loop'], required: true },
  {
    name: 'instantly-doctor',
    command: 'npm',
    args: ['run', 'instantly:doctor'],
    required: false,
    remediation:
      'Add INSTANTLY_API_KEY to .env.local or the remote Mac keychain before Instantly lead sync/push can run.',
  },
  { name: 'tax-code-rotation', command: 'npm', args: ['run', 'vestblock:tax-code-stack:rotation', '--', '--daily-cap=30'], required: true },
  { name: 'sms-review-queue', command: 'npm', args: ['run', 'outreach:sms-review', '--', '--limit=100'], required: true },
]

const results = steps.map((step) => ({
  ...run(step.name, step.command, step.args),
  required: step.required,
  remediation: step.remediation || null,
}))
const requiredFailures = results.filter((result) => result.required && !result.ok)
const optionalFailures = results.filter((result) => !result.required && !result.ok)
const summary = {
  createdAt: new Date().toISOString(),
  ok: requiredFailures.length === 0,
  requiredFailureCount: requiredFailures.length,
  optionalActionCount: optionalFailures.length,
  results: results.map((result) => ({
    name: result.name,
    ok: result.ok,
    required: result.required,
    status: result.status,
    command: result.command,
    remediation: result.ok ? null : result.remediation,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
  })),
  reportPath: path.relative(ROOT, REPORT_PATH),
}

fs.mkdirSync(REPORT_DIR, { recursive: true })
fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ ...summary, details: results }, null, 2)}\n`)

console.log('=== VestBlock revenue ops start ===')
for (const result of results) {
  const label = result.ok ? 'OK ' : result.required ? 'ERR' : 'ACT'
  console.log(`${label} ${result.name}${result.required ? '' : ' (optional)'}`)
  if (!result.ok && result.remediation) console.log(`    ${result.remediation}`)
}
console.log(`Report: ${REPORT_PATH}`)

if (requiredFailures.length) {
  process.exitCode = 1
}
