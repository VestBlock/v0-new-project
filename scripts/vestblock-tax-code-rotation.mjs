/**
 * Build the VestBlock tax/code daily rotation plan.
 *
 * This does not send outreach. It turns built DealMachine lists, export
 * requests, and local tax/code stack outputs into a 30/day operating queue so
 * the Boss Agent can keep loading inventory without rediscovering the process.
 *
 * Usage:
 *   node scripts/vestblock-tax-code-rotation.mjs
 *   node scripts/vestblock-tax-code-rotation.mjs --daily-cap=30
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DAILY_CAP = Number.parseInt(getArg("daily-cap") || "30", 10)
const MARKET_FILTER = parseMarkets(getArg("markets") || getArg("market") || "")
const STRATEGY = "tax-code-stack"
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")
const DISTRESS_DIR = path.join(process.cwd(), "data", "distress-leads")
const DM_EXPORT_DIR = path.join(process.cwd(), "data", "dm-exports")
const OPERATING_DIR = path.join(process.cwd(), "data", "operating-loops")

function safeJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseMarkets(value) {
  return new Set(
    String(value || "")
      .split(/[|;]/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [city, state] = chunk.split(",").map((part) => part.trim())
        return city && state ? slug(`${city}-${state}`) : slug(chunk)
      })
  )
}

function wantedMarket(marketSlug) {
  return MARKET_FILTER.size === 0 || MARKET_FILTER.has(marketSlug)
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function latestFiles(dir, test) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(test)
    .map((name) => ({ name, file: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
}

function exportableCountValue(row) {
  if (row.actualCount !== null && row.actualCount !== undefined && row.actualCount !== '') return Number(row.actualCount)
  const countResult = row.countResult || {}
  if (countResult.total_count_not_yet_exported !== null && countResult.total_count_not_yet_exported !== undefined) {
    return Number(countResult.total_count_not_yet_exported)
  }
  if (countResult.actual_count !== null && countResult.actual_count !== undefined) return Number(countResult.actual_count)
  if (countResult.count !== null && countResult.count !== undefined) return Number(countResult.count)
  return null
}

function isZeroExportable(row) {
  const count = exportableCountValue(row)
  return row.exportBlocked || (count !== null && Number.isFinite(count) && count <= 0)
}

function loadExportRequestedByMarket() {
  const byMarket = new Map()
  for (const entry of latestFiles(OUTREACH_DIR, (name) => /^dealmachine-export-lists-.*\.json$/i.test(name))) {
    const parsed = safeJson(entry.file)
    for (const row of parsed?.rows || parsed?.results || []) {
      if (!row.market) continue
      const key = slug(row.market)
      if (!wantedMarket(key)) continue
      const countValue = exportableCountValue(row)
      const zeroExportable = isZeroExportable(row)
      const requested = Boolean(row.exported || row.requested) && !zeroExportable
      const current = byMarket.get(key) || {
        market: row.market,
        marketSlug: key,
        exportRequested: false,
        zeroExportable: false,
        latestActualCount: null,
        latestExportCheckMtime: 0,
        exportReports: [],
        listIds: [],
        estimatedCount: 0,
        latestExportRequestMtime: 0,
      }
      current.exportReports.push(path.relative(process.cwd(), entry.file))
      if (row.id || row.listId) current.listIds.push(String(row.id || row.listId))
      current.estimatedCount = Math.max(current.estimatedCount, Number(row.count || row.estimatedCount || 0))
      if (entry.mtime >= Number(current.latestExportCheckMtime || 0)) {
        current.latestExportCheckMtime = entry.mtime
        current.latestActualCount = countValue
        current.zeroExportable = zeroExportable
        current.latestExportReport = path.relative(process.cwd(), entry.file)
      }
      current.exportRequested = current.exportRequested || requested
      if (requested) current.latestExportRequestMtime = Math.max(current.latestExportRequestMtime, entry.mtime)
      byMarket.set(key, current)
    }
  }
  return byMarket
}

function loadStackRowsByMarket() {
  const latest = latestFiles(DISTRESS_DIR, (name) => /^dealmachine-tax-code-stack-.*\.json$/i.test(name) && !/summary/i.test(name))[0]
  const csvFile = latest ? latest.file.replace(/\.json$/i, ".csv") : ""
  const stackFile = csvFile && fs.existsSync(csvFile) ? csvFile : latest?.file || ""
  const rows = latest ? safeJson(latest.file) : []
  const byMarket = new Map()
  if (!Array.isArray(rows)) return { file: latest?.file || "", byMarket }
  for (const row of rows) {
    const key = slug(row.market)
    if (!wantedMarket(key)) continue
    const current = byMarket.get(key) || { market: row.market, marketSlug: key, stackRows: 0, stackedRows: 0, taxOnlyRows: 0, stackFile: path.relative(process.cwd(), stackFile) }
    current.stackRows += 1
    if (String(row.code_violation_hit).toLowerCase() === "true") current.stackedRows += 1
    else current.taxOnlyRows += 1
    byMarket.set(key, current)
  }
  return { file: latest?.file || "", byMarket }
}

function latestDmExportForMarket(marketSlug, newerThanMs = 0) {
  const files = latestFiles(DM_EXPORT_DIR, (name) => name.toLowerCase().endsWith(".csv"))
  return files.find((entry) => entry.mtime >= newerThanMs && slug(entry.name).includes(marketSlug))?.file || ""
}

function buildPlan() {
  const exportByMarket = loadExportRequestedByMarket()
  const stack = loadStackRowsByMarket()
  const marketKeys = new Set([...exportByMarket.keys(), ...stack.byMarket.keys()])
  const lanes = [...marketKeys]
    .map((key) => {
      const exportState = exportByMarket.get(key)
      const stackState = stack.byMarket.get(key)
      const market = exportState?.market || stackState?.market || key
      const exportCsv = latestDmExportForMarket(key, Number(exportState?.latestExportRequestMtime || 0))
      const zeroExportable = Boolean(exportState?.zeroExportable) && !exportCsv
      const knownLeadCount = Number(stackState?.stackRows || 0) > 0
        ? Number(stackState?.stackRows || 0)
        : Number(exportState?.estimatedCount || 0)
      const loadedCount = exportCsv ? knownLeadCount : 0
      const pendingCount = exportCsv || zeroExportable ? 0 : knownLeadCount
      const status = exportCsv
        ? "csv_ready_for_daily_send"
        : zeroExportable
          ? "blocked_zero_exportable_contacts"
          : exportState?.exportRequested
            ? "waiting_for_dealmachine_export_email"
            : "needs_contact_export"
      return {
        strategy: STRATEGY,
        market,
        marketSlug: key,
        status,
        dailyCap: DAILY_CAP,
        knownLeadCount,
        loadedCount,
        pendingCount,
        stackRows: stackState?.stackRows || 0,
        stackedRows: stackState?.stackedRows || 0,
        taxOnlyRows: stackState?.taxOnlyRows || 0,
        exportRequested: Boolean(exportState?.exportRequested),
        zeroExportable,
        latestActualCount: exportState?.latestActualCount ?? null,
        latestExportReport: exportState?.latestExportReport || "",
        exportCsv: exportCsv ? path.relative(process.cwd(), exportCsv) : "",
        stackFile: stackState?.stackFile || "",
        exportReports: exportState?.exportReports || [],
        listIds: exportState?.listIds || [],
        remediationCommand: zeroExportable
          ? `npm run vestblock:tax-code-stack:build -- --markets="${market.replace(", ", ",")}" --per-city=${DAILY_CAP}`
          : "",
        sendCommand: exportCsv
          ? [
              "node --env-file=.env.local scripts/dealmachine-export-outreach.mjs",
              "--strategy=tax-code-stack",
              `--market=${key}`,
              `--export-csv=${path.relative(process.cwd(), exportCsv)}`,
              stackState?.stackFile ? `--queue-csv=${stackState.stackFile}` : "",
              `--limit=${DAILY_CAP}`,
              "--send",
            ].filter(Boolean).join(" ")
          : "",
        ingestCommand: "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
      }
    })
    .filter((lane) => lane.knownLeadCount > 0 || lane.exportRequested || lane.stackRows > 0)
    .sort((a, b) => {
      const statusRank = { csv_ready_for_daily_send: 0, waiting_for_dealmachine_export_email: 1, needs_contact_export: 2, blocked_zero_exportable_contacts: 3 }
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || b.knownLeadCount - a.knownLeadCount || a.market.localeCompare(b.market)
    })

  const batches = []
  let dayOffset = 0
  for (const lane of lanes) {
    const total = lane.knownLeadCount || lane.pendingCount || 0
    const batchCount = Math.max(1, Math.ceil(total / DAILY_CAP))
    for (let index = 0; index < batchCount; index++) {
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      const target = Math.min(DAILY_CAP, Math.max(0, total - index * DAILY_CAP))
      batches.push({
        date: date.toISOString().slice(0, 10),
        strategy: STRATEGY,
        market: lane.market,
        marketSlug: lane.marketSlug,
        targetSendCount: target || DAILY_CAP,
        status: lane.status,
        sendCommand: lane.sendCommand,
      })
      dayOffset += 1
    }
  }

  return {
    createdAt: new Date().toISOString(),
    strategy: STRATEGY,
    dailyCap: DAILY_CAP,
    sourceStackFile: stack.file ? path.relative(process.cwd(), stack.file) : "",
    lanes,
    batches,
  }
}

function writePlan(plan) {
  fs.mkdirSync(OPERATING_DIR, { recursive: true })
  const jsonPath = path.join(OPERATING_DIR, "tax-code-stack-rotation.json")
  const csvPath = path.join(OPERATING_DIR, "tax-code-stack-rotation.csv")
  const batchCsvPath = path.join(OPERATING_DIR, "tax-code-stack-daily-batches.csv")
  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2))
  const laneColumns = ["strategy", "market", "status", "dailyCap", "knownLeadCount", "loadedCount", "pendingCount", "stackRows", "stackedRows", "taxOnlyRows", "latestActualCount", "latestExportReport", "exportCsv", "sendCommand", "ingestCommand", "remediationCommand"]
  fs.writeFileSync(csvPath, [laneColumns.join(","), ...plan.lanes.map((row) => laneColumns.map((column) => esc(row[column])).join(","))].join("\n"))
  const batchColumns = ["date", "strategy", "market", "targetSendCount", "status", "sendCommand"]
  fs.writeFileSync(batchCsvPath, [batchColumns.join(","), ...plan.batches.map((row) => batchColumns.map((column) => esc(row[column])).join(","))].join("\n"))
  return { jsonPath, csvPath, batchCsvPath }
}

const plan = buildPlan()
const outputs = writePlan(plan)
console.log("=== VestBlock tax/code rotation ===")
console.log(`Daily cap: ${plan.dailyCap}`)
console.log(`Markets:   ${plan.lanes.map((lane) => `${lane.market} (${lane.status}, ${lane.knownLeadCount})`).join(" | ")}`)
console.log(`JSON:      ${outputs.jsonPath}`)
console.log(`CSV:       ${outputs.csvPath}`)
console.log(`Batches:   ${outputs.batchCsvPath}`)
