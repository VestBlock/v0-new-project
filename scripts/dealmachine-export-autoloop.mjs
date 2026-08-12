#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const LOOP_DIR = path.join(ROOT, 'data', 'operating-loops')
const REPORT_DIR = path.join(ROOT, 'reports', 'dealmachine-v2')
const STATE_FILE = path.join(LOOP_DIR, 'dealmachine-export-autoloop-state.json')

function flag(name) {
  return args.includes(`--${name}`)
}

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return [...args].reverse().find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback
}

function intOption(name, fallback, min, max) {
  const value = Number.parseInt(option(name), 10)
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function runNode(script, scriptArgs = []) {
  const result = spawnSync(process.execPath, ['--env-file=.env.local', script, ...scriptArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  return {
    ok: result.status === 0,
    exitCode: result.status,
    output: String(result.stdout || '').trim(),
    error: String(result.stderr || '').trim() || null,
  }
}

function newestReport(mode, date) {
  if (!fs.existsSync(REPORT_DIR)) return null
  const file = fs.readdirSync(REPORT_DIR)
    .filter((name) => name.startsWith(`${date}-${mode}-`) && name.endsWith('.json'))
    .map((name) => ({ file: path.join(REPORT_DIR, name), mtimeMs: fs.statSync(path.join(REPORT_DIR, name)).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.file
  return file ? readJson(file, null) : null
}

async function runCycle(config) {
  const date = config.date || new Date().toISOString().slice(0, 10)
  const acquisition = runNode('scripts/dealmachine-export-orchestrator.mjs', [
    ...(config.acquire ? ['--apply'] : []),
  ])
  const acquisitionReport = newestReport(config.acquire ? 'search' : 'plan', date)
  const actions = [{ type: 'acquisition', ...acquisition }]

  if (config.send && acquisition.ok) {
    actions.push({
      type: 'initial_outreach',
      ...runNode('scripts/seller-outreach-autopilot.mjs', [
        '--send',
        `--date=${date}`,
        `--daily-cap=${config.dailyCap}`,
        `--throttle=${config.throttleMs}`,
      ]),
    })
    actions.push({
      type: 'followup_outreach',
      ...runNode('scripts/dealmachine-export-followup.mjs', [
        '--send',
        `--limit=${config.dailyCap}`,
        `--min-age-days=${config.followupMinAgeDays}`,
        `--throttle=${config.throttleMs}`,
      ]),
    })
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    date,
    apiFamily: 'official-v2',
    acquire: config.acquire,
    send: config.send,
    dailyCap: config.dailyCap,
    lowballEnabled: false,
    machineDependency: 'none',
    acquisitionReport: acquisitionReport ? {
      totals: acquisitionReport.totals,
      budget: acquisitionReport.budget,
      reportPath: acquisitionReport.reportPath || null,
    } : null,
    actions,
    ok: actions.every((action) => action.ok),
  }
  fs.mkdirSync(LOOP_DIR, { recursive: true })
  const reportPath = path.join(LOOP_DIR, `dealmachine-export-autoloop-${Date.now()}.json`)
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`)
  const state = readJson(STATE_FILE, { contractVersion: 2, cycles: [] })
  state.updatedAt = summary.generatedAt
  state.lastCycle = { ...summary, reportPath }
  state.cycles = [...(state.cycles || []), state.lastCycle].slice(-100)
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
  return { ...summary, reportPath }
}

async function main() {
  const loop = flag('loop')
  const iterations = intOption('iterations', loop ? Number.MAX_SAFE_INTEGER : 1, 1, Number.MAX_SAFE_INTEGER)
  const sleepSeconds = intOption('sleep-seconds', 86_400, 3_600, 86_400)
  const config = {
    acquire: flag('acquire') || flag('send'),
    send: flag('send'),
    date: option('date'),
    dailyCap: intOption('daily-cap', Number(process.env.SELLER_OUTREACH_DAILY_CAP || 500), 1, 500),
    followupMinAgeDays: intOption('followup-min-age-days', 2, 1, 30),
    throttleMs: intOption('throttle', 1_800, 250, 30_000),
  }

  let cycle = 0
  while (cycle < iterations) {
    cycle += 1
    const summary = await runCycle(config)
    console.log(JSON.stringify(summary, null, 2))
    if (!loop || cycle >= iterations) break
    await sleep(sleepSeconds * 1_000)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
