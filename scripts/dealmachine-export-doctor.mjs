#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ROTATION_PATH = path.join(ROOT, 'data', 'operating-loops', 'tax-code-stack-rotation.json')
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const OUT_PATH = path.join(OUT_DIR, 'dealmachine-export-doctor-latest.json')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function countCsvDataRows(file) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim()
    if (!text) return 0
    const lines = text.split(/\r?\n/).filter(Boolean)
    return Math.max(0, lines.length - 1)
  } catch {
    return null
  }
}

function relative(file) {
  return path.relative(ROOT, file)
}

const rotation = readJson(ROTATION_PATH)
const lanes = Array.isArray(rotation?.lanes) ? rotation.lanes : []
const checks = lanes.map((lane) => {
  const exportCsv = lane.exportCsv ? path.resolve(ROOT, lane.exportCsv) : ''
  const csvExists = exportCsv ? fs.existsSync(exportCsv) : false
  const csvRows = csvExists ? countCsvDataRows(exportCsv) : null
  const status = lane.status === 'csv_ready_for_daily_send'
    ? csvExists && Number(csvRows || 0) > 0
      ? 'ready_verified'
      : 'ready_but_csv_missing_or_empty'
    : lane.status === 'blocked_zero_exportable_contacts'
      ? 'blocked_zero_exportable_contacts'
      : lane.status
  return {
    strategy: lane.strategy,
    market: lane.market,
    status,
    rotationStatus: lane.status,
    knownLeadCount: Number(lane.knownLeadCount || 0),
    latestActualCount: lane.latestActualCount ?? null,
    csvRows,
    exportCsv: lane.exportCsv || '',
    latestExportReport: lane.latestExportReport || '',
    remediationCommand: lane.remediationCommand || '',
    sendCommand: lane.sendCommand || '',
  }
})

const readyVerified = checks.filter((row) => row.status === 'ready_verified')
const readyBroken = checks.filter((row) => row.status === 'ready_but_csv_missing_or_empty')
const blocked = checks.filter((row) => row.status === 'blocked_zero_exportable_contacts')
const waiting = checks.filter((row) => row.status === 'waiting_for_dealmachine_export_email')
const needsContactExport = checks.filter((row) => row.status === 'needs_contact_export')

const nextActions = []
if (readyVerified.length) {
  nextActions.push(`Send from ${readyVerified.length} verified CSV lane(s) at the daily cap, keeping market/strategy copy separated.`)
}
if (blocked.length) {
  nextActions.push(`Rebuild or replace ${blocked.length} zero-export lane(s): ${blocked.map((row) => row.market).join(', ')}.`)
}
if (readyBroken.length) {
  nextActions.push(`Fix ${readyBroken.length} lane(s) marked ready but missing/empty CSV files before sending.`)
}
if (waiting.length) {
  nextActions.push(`Watch email for ${waiting.length} DealMachine export(s), then save and ingest CSVs.`)
}
if (needsContactExport.length) {
  nextActions.push(`Request contact exports for ${needsContactExport.length} lane(s) after dry-run count check.`)
}

const report = {
  ok: readyBroken.length === 0,
  createdAt: new Date().toISOString(),
  sourceRotation: relative(ROTATION_PATH),
  summary: {
    totalLanes: checks.length,
    readyVerified: readyVerified.length,
    readyBroken: readyBroken.length,
    blockedZeroExportable: blocked.length,
    waitingExportEmail: waiting.length,
    needsContactExport: needsContactExport.length,
    verifiedCsvRows: readyVerified.reduce((sum, row) => sum + Number(row.csvRows || 0), 0),
  },
  nextActions,
  checks,
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
