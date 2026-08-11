/**
 * DealMachine export system test for VestBlock.
 *
 * This is intentionally a verifier, not a sender. It checks the pieces that
 * were previously treated too optimistically:
 *   - saved-list export requests with zero exportable contacts
 *   - tiny/test CSVs being ingested as production exports
 *   - stale requested jobs that still need a real export file
 *
 * Usage:
 *   node scripts/dealmachine-export-system-test.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "data", "operating-loops")
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const INCOMING_DIR = path.join(DM_EXPORT_DIR, "incoming")
const TMP_OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const MIN_ROWS = 10
const EXECUTION_MODE = "pro-browser-session-primary"

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function listFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(predicate)
    .map((name) => {
      const file = path.join(dir, name)
      return { name, file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function csvRowCount(file) {
  const text = fs.readFileSync(file, "utf8").trim()
  if (!text) return 0
  return Math.max(0, text.split(/\r?\n/).length - 1)
}

function parseCsvHeaderLine(line) {
  const cells = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      cells.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function csvSchema(file) {
  const text = fs.readFileSync(file, "utf8")
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || ""
  const header = parseCsvHeaderLine(firstLine)
  const normalized = header.map((item) => item.toLowerCase())
  const hasAddress = normalized.some((name) => /address/.test(name))
  const hasContact = normalized.some((name) => /email|phone/.test(name))
  const isLeadShell =
    normalized.includes("contact_id") &&
    normalized.includes("associated_property_address_full") &&
    !hasContact
  return {
    header,
    hasAddress,
    hasContact,
    isLeadShell,
    contactReady: hasAddress && hasContact && !isLeadShell,
  }
}

function newestSavedListExport() {
  return listFiles(TMP_OUTREACH_DIR, (name) => /^dealmachine-saved-list-export-.*\.json$/i.test(name))[0] || null
}

function chromeStatus() {
  try {
    const url = execFileSync(
      "osascript",
      ["-e", 'tell application "Google Chrome" to if (count windows) > 0 then get URL of active tab of front window'],
      { encoding: "utf8" }
    ).trim()
    return { ok: /app\.dealmachine\.com/i.test(url), url }
  } catch (error) {
    return { ok: false, error: String(error.message || error) }
  }
}

function summarizeLatestExportAttempt(file) {
  if (!file) return null
  const parsed = readJson(file.file, {})
  const rows = parsed.results || []
  return {
    file: path.relative(ROOT, file.file),
    finishedAt: parsed.finishedAt || null,
    mode: parsed.send ? "send" : "dry-run",
    lists: rows.length,
    requested: rows.filter((row) => row.requested).length,
    blocked: rows.filter((row) => row.exportBlocked).length,
    acceptedUnverified: rows.filter((row) => row.acceptedUnverified).length,
    zeroActual: rows.filter((row) => Number(row.actualCount || 0) <= 0).length,
    positiveActual: rows.filter((row) => Number(row.actualCount || 0) > 0).length,
  }
}

function summarizeIncomingExports() {
  return listFiles(INCOMING_DIR, (name) => name.toLowerCase().endsWith(".csv")).map((entry) => {
    const rows = csvRowCount(entry.file)
    const schema = csvSchema(entry.file)
    return {
      file: path.relative(ROOT, entry.file),
      rows,
      productionReady: rows >= MIN_ROWS && schema.contactReady,
      schema,
    }
  })
}

function summarizeJobs() {
  const summary = readJson(path.join(OUT_DIR, "dealmachine-export-jobs-summary.json"), {})
  return {
    totalJobs: summary.totalJobs || 0,
    byStatus: summary.byStatus || {},
    topStrategies: (summary.topStrategies || []).slice(0, 8),
    topMarkets: (summary.topMarkets || []).slice(0, 8),
  }
}

function writeReport(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, "dealmachine-export-system-test.json")
  const mdPath = path.join(OUT_DIR, "dealmachine-export-system-test.md")
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const issues = report.issues.length
    ? report.issues.map((issue) => `- ${issue}`).join("\n")
    : "- No blocking issues detected."
  const incoming = report.incomingExports.length
    ? report.incomingExports.map((row) => `- ${row.productionReady ? "READY" : "BLOCKED"} ${row.file}: ${row.rows} rows, contact schema ${row.schema.contactReady ? "yes" : "no"}`).join("\n")
    : "- No incoming CSV exports found."

  const lines = [
    "# DealMachine Export System Test",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.ok ? "PASS" : "NEEDS ATTENTION"}`,
    "",
    "## Issues",
    "",
    issues,
    "",
    "## Chrome Session",
    "",
    `- DealMachine tab active: ${report.chrome.ok ? "yes" : "no"}`,
    report.chrome.url ? `- URL: ${report.chrome.url}` : "",
    `- Preferred execution mode: ${report.executionMode}`,
    `- Preferred ingest lane: ${report.preferredIngestLane}`,
    "",
    "## Latest Saved-List Export Attempt",
    "",
    report.latestSavedListExport
      ? [
          `- File: ${report.latestSavedListExport.file}`,
          `- Mode: ${report.latestSavedListExport.mode}`,
          `- Requested: ${report.latestSavedListExport.requested}/${report.latestSavedListExport.lists}`,
          `- Blocked: ${report.latestSavedListExport.blocked}`,
          `- Accepted but unverified: ${report.latestSavedListExport.acceptedUnverified}`,
          `- Positive actual counts: ${report.latestSavedListExport.positiveActual}`,
          `- Zero actual counts: ${report.latestSavedListExport.zeroActual}`,
        ].join("\n")
      : "- No saved-list export attempts found.",
    "",
    "## Incoming Exports",
    "",
    incoming,
    "",
    "## Job Ledger",
    "",
    `- Total jobs: ${report.jobs.totalJobs}`,
    `- Statuses: ${JSON.stringify(report.jobs.byStatus)}`,
    "",
    `JSON: ${path.relative(ROOT, jsonPath)}`,
  ].filter(Boolean)

  fs.writeFileSync(mdPath, lines.join("\n"))
  return { jsonPath, mdPath }
}

function main() {
  const latestSavedListExport = summarizeLatestExportAttempt(newestSavedListExport())
  const incomingExports = summarizeIncomingExports()
  const chrome = chromeStatus()
  const jobs = summarizeJobs()
  const issues = []

  if (!chrome.ok) issues.push("Chrome is not currently on app.dealmachine.com, so browser-session exports cannot be tested live.")
  if (latestSavedListExport?.acceptedUnverified) {
    issues.push("Latest saved-list export contains accepted-but-unverified requests; those should not be treated as delivered exports.")
  }
  if (latestSavedListExport && latestSavedListExport.lists > 0 && latestSavedListExport.positiveActual === 0) {
    issues.push("Latest saved-list export attempt had zero exportable contacts; build/contact-hydrate step is still the blocker.")
  }
  for (const incoming of incomingExports) {
    if (incoming.rows < MIN_ROWS) issues.push(`${incoming.file} is below the ${MIN_ROWS}-row production minimum and must stay out of outreach.`)
    if (incoming.schema.isLeadShell) issues.push(`${incoming.file} is a DealMachine lead-shell export missing email/phone columns.`)
    else if (!incoming.schema.contactReady) issues.push(`${incoming.file} is not a contact-ready DealMachine CSV.`)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: issues.length === 0,
    executionMode: EXECUTION_MODE,
    preferredIngestLane: path.relative(ROOT, INCOMING_DIR),
    chrome,
    latestSavedListExport,
    incomingExports,
    jobs,
    issues,
  }
  const outputs = writeReport(report)
  console.log(JSON.stringify({ ...report, report: outputs }, null, 2))
  if (!report.ok) process.exitCode = 1
}

main()
