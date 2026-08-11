import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const STATE_DIR = path.join(ROOT, "data", "operating-loops")
const STATE_FILE = path.join(STATE_DIR, "dealmachine-export-jobs.json")
const SUMMARY_FILE = path.join(STATE_DIR, "dealmachine-export-jobs-summary.json")

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true })
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  ensureStateDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function defaultState() {
  return {
    updatedAt: nowIso(),
    sourceFiles: [],
    jobs: [],
  }
}

export function loadExportJobState() {
  const raw = readJson(STATE_FILE, null)
  if (!raw || typeof raw !== "object") return defaultState()
  return {
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    sourceFiles: safeArray(raw.sourceFiles),
    jobs: safeArray(raw.jobs),
  }
}

function buildJobId(input) {
  return [
    normalizeSlug(input.strategyKey || "unknown"),
    normalizeSlug(input.market || "unknown-market"),
    normalizeSlug(input.requestRunId || input.summaryFile || input.requestedAt || nowIso()),
  ].join(":")
}

function computeSummary(state) {
  const jobs = safeArray(state.jobs)
  const byStatus = {}
  const byStrategy = {}
  const byMarket = {}

  for (const job of jobs) {
    const status = String(job.status || "unknown")
    byStatus[status] = (byStatus[status] || 0) + 1
    if (job.strategyKey) byStrategy[job.strategyKey] = (byStrategy[job.strategyKey] || 0) + 1
    if (job.market) byMarket[job.market] = (byMarket[job.market] || 0) + 1
  }

  return {
    updatedAt: nowIso(),
    totalJobs: jobs.length,
    byStatus,
    topStrategies: Object.entries(byStrategy)
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 12)
      .map(([strategyKey, count]) => ({ strategyKey, count })),
    topMarkets: Object.entries(byMarket)
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 12)
      .map(([market, count]) => ({ market, count })),
    recentlyUpdated: jobs
      .slice()
      .sort((a, b) => Date.parse(String(b.updatedAt || "")) - Date.parse(String(a.updatedAt || "")))
      .slice(0, 25),
  }
}

export function saveExportJobState(state) {
  const next = {
    updatedAt: nowIso(),
    sourceFiles: safeArray(state.sourceFiles),
    jobs: safeArray(state.jobs),
  }
  writeJson(STATE_FILE, next)
  writeJson(SUMMARY_FILE, computeSummary(next))
  return next
}

export function syncExportJobsFromRequestSummary(summary, summaryMeta = {}) {
  if (!summary || typeof summary !== "object") return saveExportJobState(loadExportJobState())

  const state = loadExportJobState()
  const jobs = safeArray(state.jobs)
  const requestRunId =
    normalizeSlug(summaryMeta.requestRunId || summary.createdAt || summaryMeta.summaryFile || "") ||
    normalizeSlug(nowIso())

  for (const item of safeArray(summary.listPackages)) {
    const id = buildJobId({
      strategyKey: item.strategyKey,
      market: item.market,
      requestRunId,
    })
    const existing = jobs.find((job) => job.id === id)
    const next = {
      id,
      strategyKey: String(item.strategyKey || "unknown"),
      strategyName: String(item.strategyName || item.strategyKey || "Unknown strategy"),
      market: String(item.market || "unknown-market"),
      listName: String(item.listName || ""),
      requestedRows: Number(item.rows || 0),
      requestFile: item.file || null,
      requestCsvPath: summary.csvPath || null,
      guidePath: summary.guidePath || null,
      summaryFile: summaryMeta.summaryFile || null,
      requestedAt: summary.createdAt || nowIso(),
      status: "requested",
      source: "dealmachine_contact_export_request",
      updatedAt: nowIso(),
    }

    if (existing) {
      Object.assign(existing, {
        ...existing,
        ...next,
        status: ["ingested", "private_fallback_ready", "csv_ready_for_outreach"].includes(existing.status)
          ? existing.status
          : "requested",
        updatedAt: nowIso(),
      })
    } else {
      jobs.push(next)
    }
  }

  return saveExportJobState({ ...state, jobs })
}

export function markSourceFileProcessed(sourceFile, outputs = []) {
  const state = loadExportJobState()
  const sourceFiles = safeArray(state.sourceFiles)
  const normalizedSource = path.resolve(sourceFile)
  const existing = sourceFiles.find((row) => row.sourceFile === normalizedSource)
  const payload = {
    sourceFile: normalizedSource,
    processedAt: nowIso(),
    outputs: outputs.map((row) => ({
      market: row.market,
      destFile: row.destFile ? path.resolve(row.destFile) : null,
      count: Number(row.count || 0),
    })),
  }
  if (existing) Object.assign(existing, payload)
  else sourceFiles.push(payload)
  return saveExportJobState({ ...state, sourceFiles })
}

export function markSourceFileRejected(sourceFile, rejection = {}) {
  const state = loadExportJobState()
  const sourceFiles = safeArray(state.sourceFiles)
  const normalizedSource = path.resolve(sourceFile)
  const existing = sourceFiles.find((row) => row.sourceFile === normalizedSource)
  const payload = {
    sourceFile: normalizedSource,
    processedAt: nowIso(),
    rejected: true,
    rejectionReason: rejection.reason || "invalid_export_schema",
    schema: rejection.schema || null,
    rowCount: Number(rejection.rowCount || 0),
    outputs: [],
  }
  if (existing) Object.assign(existing, payload)
  else sourceFiles.push(payload)
  return saveExportJobState({ ...state, sourceFiles })
}

export function markJobsIngested(outputs = []) {
  const state = loadExportJobState()
  const jobs = safeArray(state.jobs)
  const touched = []

  for (const output of outputs) {
    const market = normalizeSlug(output.market)
    const destFile = output.destFile ? path.resolve(output.destFile) : null
    const candidates = jobs
      .filter((job) => normalizeSlug(job.market) === market)
      .filter((job) => ["requested", "downloaded", "waiting_for_export", "ready_for_download"].includes(job.status))
      .sort((a, b) => Date.parse(String(b.requestedAt || "")) - Date.parse(String(a.requestedAt || "")))

    for (const job of candidates) {
      job.status = "ingested"
      job.ingestedAt = nowIso()
      job.outputFile = destFile
      job.outputCount = Number(output.count || 0)
      job.updatedAt = nowIso()
      touched.push(job.id)
    }
  }

  saveExportJobState({ ...state, jobs })
  return touched
}

export function markJobsExportRejected(input = {}) {
  const state = loadExportJobState()
  const jobs = safeArray(state.jobs)
  const market = normalizeSlug(input.market || "")
  const sourceFile = input.sourceFile ? path.resolve(input.sourceFile) : null
  const reason = input.reason || "invalid_export_schema"
  if (!market) {
    saveExportJobState(state)
    return []
  }

  const candidates = jobs
    .filter((job) => normalizeSlug(job.market) === market)
    .filter((job) => ["requested", "downloaded", "waiting_for_export", "ready_for_download"].includes(String(job.status || "")))
    .sort((a, b) => Date.parse(String(b.requestedAt || "")) - Date.parse(String(a.requestedAt || "")))

  const touched = candidates.map((job) => {
    job.status = "export_rejected"
    job.exportRejectedAt = nowIso()
    job.exportRejectionReason = reason
    job.rejectedSourceFile = sourceFile
    job.rejectedSchema = input.schema || null
    job.rejectedRowCount = Number(input.rowCount || 0)
    job.updatedAt = nowIso()
    return job.id
  })

  saveExportJobState({ ...state, jobs })
  return touched
}

export function markJobsDownloaded(input) {
  const state = loadExportJobState()
  const jobs = safeArray(state.jobs)
  const market = normalizeSlug(input.market)
  const strategyKey = normalizeSlug(input.strategyKey || "")
  const sourceFile = input.sourceFile ? path.resolve(input.sourceFile) : null

  const candidates = jobs
    .filter((job) => normalizeSlug(job.market) === market)
    .filter((job) => !strategyKey || normalizeSlug(job.strategyKey) === strategyKey)
    .filter((job) => ["requested", "waiting_for_export", "ready_for_download"].includes(String(job.status || "")))
    .sort((a, b) => Date.parse(String(b.requestedAt || "")) - Date.parse(String(a.requestedAt || "")))

  const touched = candidates.map((job) => {
    job.status = "downloaded"
    job.downloadedAt = nowIso()
    job.downloadSourceFile = sourceFile
    job.updatedAt = nowIso()
    return job.id
  })

  saveExportJobState({ ...state, jobs })
  return touched
}

export function markJobsPrivateFallback(input) {
  const state = loadExportJobState()
  const jobs = safeArray(state.jobs)
  const market = normalizeSlug(input.market)
  const strategyKey = normalizeSlug(input.strategyKey || "")
  const listId = input.listId ? String(input.listId) : ""
  const destFile = input.outputFile ? path.resolve(input.outputFile) : null

  const touched = jobs
    .filter((job) => normalizeSlug(job.market) === market)
    .filter((job) => !strategyKey || normalizeSlug(job.strategyKey) === strategyKey)
    .filter((job) => !listId || !job.listId || String(job.listId) === listId)
    .filter((job) => ["requested", "downloaded", "waiting_for_export", "ready_for_download"].includes(job.status))
    .map((job) => {
      job.status = "private_fallback_ready"
      if (listId) job.listId = listId
      job.privateFallbackAt = nowIso()
      job.outputFile = destFile
      job.outputCount = Number(input.rowCount || 0)
      job.rejectedCount = Number(input.rejectedCount || 0)
      job.privateFallbackSource = input.source || "atlas_property_endpoint"
      job.updatedAt = nowIso()
      return job.id
    })

  saveExportJobState({ ...state, jobs })
  return touched
}

export function loadExportJobSummary() {
  return readJson(SUMMARY_FILE, null)
}
