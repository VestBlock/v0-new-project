#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const INCLUDE_DOWNLOADS = args.includes('--include-downloads')
const PRIVATE_FALLBACK_REQUESTED = args.includes('--private-fallback')
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const INCOMING_DIR = path.join(ROOT, 'data', 'dm-exports', 'incoming')
const SUMMARY_FILE = path.join(OUT_DIR, 'dealmachine-export-orchestrator-summary.json')

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

function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => path.join(dir, name))
}

function legacyIncomingFiles() {
  const files = listCsvFiles(INCOMING_DIR)
  if (INCLUDE_DOWNLOADS) {
    files.push(...listCsvFiles(path.join(os.homedir(), 'Downloads')).filter((file) => /dealmachine|contacts[-_ ]export/i.test(path.basename(file))))
  }
  return files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const actions = []
  if (PRIVATE_FALLBACK_REQUESTED) {
    actions.push({
      type: 'private_fallback_blocked',
      reason: 'DealMachine legacy/private endpoints are permanently disabled.',
      replacement: 'official_v2_strategy_runner',
    })
  }

  const runnerArgs = [`--mode=${APPLY ? 'search' : 'plan'}`]
  if (APPLY) runnerArgs.push('--apply')
  const v2 = runNode('scripts/dealmachine-v2-strategy-run.mjs', runnerArgs)
  actions.push({ type: 'official_v2_strategy_run', applied: APPLY, ...v2 })

  for (const file of legacyIncomingFiles()) {
    const result = runNode('scripts/dealmachine-ingest-export.mjs', [
      `--file=${file}`,
      '--split-by-market',
      ...(APPLY ? ['--apply'] : []),
    ])
    actions.push({
      type: result.ok ? 'legacy_download_ingest' : 'legacy_download_ingest_blocked',
      sourceFile: file,
      applied: APPLY,
      ...result,
    })
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    apiFamily: 'official-v2',
    apply: APPLY,
    privateFallback: false,
    privateFallbackRequested: PRIVATE_FALLBACK_REQUESTED,
    includeDownloadsFallback: INCLUDE_DOWNLOADS,
    machineDependency: 'none',
    preferredExecutor: 'official-v2-api',
    actions,
  }
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (!v2.ok) process.exitCode = 1
}

main()
