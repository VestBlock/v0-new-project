/**
 * DealMachine export orchestration loop for VestBlock.
 *
 * Purpose:
 * - Sync the latest export-request package into a persistent job ledger
 * - Auto-ingest fresh DealMachine Contacts exports from the shared incoming lane
 * - Optionally run the hardened Atlas/private-contact fallback for stale jobs
 * - Write one summary file so automations can act like loops instead of monitors
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-export-orchestrator.mjs
 *   node --env-file=.env.local scripts/dealmachine-export-orchestrator.mjs --apply
 *   node --env-file=.env.local scripts/dealmachine-export-orchestrator.mjs --apply --private-fallback
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

import {
  loadExportJobState,
  saveExportJobState,
  syncExportJobsFromRequestSummary,
  loadExportJobSummary,
  markSourceFileRejected,
  markJobsExportRejected,
} from "./lib/dealmachine-export-jobs.mjs"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const PRIVATE_FALLBACK = args.includes("--private-fallback")
const INCLUDE_DOWNLOADS = args.includes("--include-downloads")
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const ROOT = process.cwd()
const DOWNLOADS = path.join(os.homedir(), "Downloads")
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const INCOMING_EXPORTS = path.join(DM_EXPORT_DIR, "incoming")
const DISTRESS_DIR = path.join(ROOT, "data", "distress-leads")
const OUT_DIR = path.join(ROOT, "data", "operating-loops")
const SUMMARY_FILE = path.join(OUT_DIR, "dealmachine-export-orchestrator-summary.json")
const STALE_HOURS = getArg("stale-hours") ? Number.parseInt(getArg("stale-hours"), 10) : 12
const PRIVATE_LIMIT = getArg("private-limit") ? Number.parseInt(getArg("private-limit"), 10) : 25
const ENFORCE_PRIMARY = APPLY || PRIVATE_FALLBACK

const DM_EXPORT_PATTERNS = [
  /^dealmachine[-_]contacts[-_]/i,
  /^contacts[-_]export[-_]/i,
  /^dealmachine[-_]export[-_]/i,
  /^dealmachine.*\.csv$/i,
]

function newestLocalFile(dir, prefix, suffix = ".json") {
  if (!fs.existsSync(dir)) return null
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => {
      const file = path.join(dir, name)
      return { name, file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function loadLatestRequestSummary() {
  const latest = newestLocalFile(DISTRESS_DIR, "dealmachine-contact-export-request-summary-")
  if (!latest) return null
  const parsed = readJson(latest.file, null)
  if (!parsed) return null
  return { ...parsed, _meta: latest }
}

function loadLatestSavedListExportRows() {
  const outreachDir = path.join(ROOT, "tmp", "outreach")
  if (!fs.existsSync(outreachDir)) return []
  const latest = fs.readdirSync(outreachDir)
    .filter((name) => /^dealmachine-saved-list-export-.*\.json$/i.test(name))
    .map((name) => {
      const file = path.join(outreachDir, name)
      return { file, name, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
  if (!latest) return []
  const parsed = readJson(latest.file, null)
  const rows = Array.isArray(parsed?.results) ? parsed.results : []
  return rows
    .filter((row) => row?.requested && row?.listId && !row?.exportBlocked)
    .map((row) => ({
      sourceReport: latest.file,
      listId: String(row.listId),
      market: normalizeSlug(row.market || [row.city, row.state].filter(Boolean).join("-")),
      strategyKey: normalizeSlug(row.strategyKey || row.strategy || "unknown"),
      title: String(row.title || ""),
      effectiveCount: Number(row.effectiveCount || row.actualCount || row.estimatedCount || 0),
    }))
    .filter((row) => row.market && row.strategyKey && row.effectiveCount > 0)
}

function listCsvsInDir(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".csv"))
    .filter((name) => dir === INCOMING_EXPORTS || DM_EXPORT_PATTERNS.some((pattern) => pattern.test(name)))
    .map((name) => {
      const file = path.join(dir, name)
      return { name, file, dir, mtimeMs: fs.statSync(file).mtimeMs }
    })
}

function listFreshDownloads() {
  const primary = listCsvsInDir(INCOMING_EXPORTS)
  const fallback = INCLUDE_DOWNLOADS ? listCsvsInDir(DOWNLOADS) : []
  return [...primary, ...fallback].sort((a, b) => b.mtimeMs - a.mtimeMs)
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

function classifyExportCsv(file) {
  const text = fs.readFileSync(file, "utf8")
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || ""
  const header = parseCsvHeaderLine(firstLine)
  const normalized = header.map((item) => item.toLowerCase())
  const rowCount = Math.max(0, text.trim().split(/\r?\n/).length - 1)
  const hasAddress = normalized.some((name) => /address/.test(name))
  const hasContact = normalized.some((name) => /email|phone/.test(name))
  const hasOnlyShellContactFields =
    normalized.includes("contact_id") &&
    normalized.includes("associated_property_address_full") &&
    !hasContact

  if (!hasAddress) {
    return { ok: false, reason: "missing_address_columns", header, rowCount }
  }
  if (hasOnlyShellContactFields) {
    return { ok: false, reason: "lead_shell_export_missing_email_phone_columns", header, rowCount }
  }
  if (!hasContact) {
    return { ok: false, reason: "missing_email_phone_columns", header, rowCount }
  }
  return { ok: true, reason: null, header, rowCount }
}

function inferMarketFromCsv(file) {
  const text = fs.readFileSync(file, "utf8")
  const sample = text.split(/\r?\n/).slice(0, 100).join(" ").toLowerCase()
  const cityState = sample.match(/,\s*([a-z .'-]+),\s*([a-z]{2})\s+\d{5}/i)
  if (!cityState) return ""
  return normalizeSlug(`${cityState[1]}-${cityState[2]}`)
}

function ingestDownload(file) {
  const command = ["scripts/dealmachine-ingest-export.mjs", `--file=${file}`, "--split-by-market"]
  if (APPLY) command.push("--apply")
  return execFileSync("node", command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function ingestDownloadSafely(file) {
  try {
    return { ok: true, output: ingestDownload(file) }
  } catch (error) {
    return {
      ok: false,
      output: String(error.stdout || "").trim(),
      error: String(error.stderr || error.message || error).trim(),
    }
  }
}

function runPrivateFallback(job) {
  const command = [
    "scripts/dealmachine-private-contact-export.mjs",
    `--market=${job.market}`,
    `--limit=${PRIVATE_LIMIT}`,
  ]
  return execFileSync("node", command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  })
}

function main() {
  if (ENFORCE_PRIMARY) {
    execFileSync("node", ["scripts/require-primary-machine.mjs"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: process.env,
    })
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const actions = []

  const latestRequest = loadLatestRequestSummary()
  if (latestRequest) {
    syncExportJobsFromRequestSummary(latestRequest, {
      summaryFile: latestRequest._meta?.name || null,
      requestRunId: latestRequest._meta?.name || latestRequest.createdAt,
    })
    actions.push({
      type: "sync_request_summary",
      summaryFile: latestRequest._meta?.name || null,
      rows: Number(latestRequest.totalRows || 0),
    })
  }

  let state = loadExportJobState()
  const processedSources = new Set((state.sourceFiles || []).map((row) => path.resolve(String(row.sourceFile || ""))))
  const freshDownloads = listFreshDownloads()

  for (const item of freshDownloads) {
    const resolved = path.resolve(item.file)
    if (processedSources.has(resolved)) continue
    const classification = classifyExportCsv(item.file)
    if (!classification.ok) {
      const inferredMarket = inferMarketFromCsv(item.file)
      markSourceFileRejected(item.file, {
        reason: classification.reason,
        schema: classification.header,
        rowCount: classification.rowCount,
      })
      const touchedJobs = markJobsExportRejected({
        market: inferredMarket,
        sourceFile: item.file,
        reason: classification.reason,
        schema: classification.header,
        rowCount: classification.rowCount,
      })
      actions.push({
        type: "ingest_download_rejected",
        sourceFile: item.file,
        sourceDir: item.dir,
        reason: classification.reason,
        rowCount: classification.rowCount,
        schema: classification.header,
        touchedJobs,
      })
      if (PRIVATE_FALLBACK && classification.reason === "lead_shell_export_missing_email_phone_columns") {
        actions.push({
          type: "private_shell_fallback_skipped",
          sourceFile: item.file,
          market: inferredMarket || null,
          reason: "lead_shell_contact_ids_are_not_property_deal_ids",
          nextMove: "request_or_download_dealmachine_contacts_export",
        })
      }
      continue
    }
    const result = ingestDownloadSafely(item.file)
    actions.push({
      type: result.ok ? "ingest_download" : "ingest_download_blocked",
      sourceFile: item.file,
      sourceDir: item.dir,
      applied: APPLY,
      output: result.output,
      error: result.error || null,
    })
  }

  state = loadExportJobState()
  if (PRIVATE_FALLBACK) {
    const listRows = loadLatestSavedListExportRows()
    for (const row of listRows) {
      actions.push({
        type: "private_list_fallback_skipped",
        reason: "public_list_id_endpoint_not_strategy_safe",
        market: row.market,
        strategyKey: row.strategyKey,
        listId: row.listId,
        nextMove: "use_dealmachine_contacts_export_request_and_schema_checked_download",
      })
    }

    const staleThreshold = Date.now() - STALE_HOURS * 60 * 60 * 1000
    const staleJobs = (state.jobs || [])
      .filter((job) => ["requested", "downloaded", "waiting_for_export", "ready_for_download"].includes(String(job.status || "")))
      .filter((job) => {
        const requestedAt = Date.parse(String(job.requestedAt || ""))
        return Number.isFinite(requestedAt) ? requestedAt <= staleThreshold : true
      })
      .sort((a, b) => Date.parse(String(a.requestedAt || "")) - Date.parse(String(b.requestedAt || "")))

    const markets = [...new Set(staleJobs.map((job) => normalizeSlug(job.market)).filter(Boolean))]
    for (const market of markets) {
      const firstJob = staleJobs.find((job) => normalizeSlug(job.market) === market)
      if (!firstJob) continue
      try {
        const output = runPrivateFallback(firstJob)
        actions.push({
          type: "private_fallback",
          market,
          output,
        })
      } catch (error) {
        actions.push({
          type: "private_fallback_failed",
          market,
          error: String(error.stderr || error.message || error).trim(),
        })
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    privateFallback: PRIVATE_FALLBACK,
    includeDownloadsFallback: INCLUDE_DOWNLOADS,
    preferredExecutor: "pro-browser-session-primary",
    preferredIngestLane: path.relative(ROOT, INCOMING_EXPORTS),
    actions,
    exportJobs: loadExportJobSummary(),
  }

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main()
