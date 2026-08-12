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
  ['boss-daily-loop', 'npm', ['run', 'boss:daily-loop']],
  ['instantly-doctor', 'npm', ['run', 'instantly:doctor']],
  ['tax-code-rotation', 'npm', ['run', 'vestblock:tax-code-stack:rotation', '--', '--daily-cap=30']],
  ['sms-review-queue', 'npm', ['run', 'outreach:sms-review', '--', '--limit=100']],
]

const results = steps.map(([name, command, args]) => run(name, command, args))
const summary = {
  createdAt: new Date().toISOString(),
  ok: results.every((result) => result.ok),
  results: results.map((result) => ({
    name: result.name,
    ok: result.ok,
    status: result.status,
    command: result.command,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
  })),
  reportPath: path.relative(ROOT, REPORT_PATH),
}

fs.mkdirSync(REPORT_DIR, { recursive: true })
fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ ...summary, details: results }, null, 2)}\n`)

console.log('=== VestBlock revenue ops start ===')
for (const result of results) {
  console.log(`${result.ok ? 'OK ' : 'ERR'} ${result.name}`)
}
console.log(`Report: ${REPORT_PATH}`)

if (!summary.ok) {
  process.exitCode = 1
}
