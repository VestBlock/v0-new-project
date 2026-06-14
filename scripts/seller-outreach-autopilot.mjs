/**
 * Seller outreach autopilot.
 *
 * Counts today's DealMachine owner-contact sends, calculates remaining daily
 * capacity, then rotates through known DealMachine contact exports until the
 * seller email cap is reached. Live sends require --send.
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const ROOT = process.cwd()
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")

function getArg(name, fallback = "") {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1]
  return fallback
}

function intArg(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ""), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function normalizeMarketSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function todayIso() {
  return getArg("--date", new Date().toISOString().slice(0, 10))
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function countTodaySends(date) {
  const summary = {
    date,
    resultFiles: 0,
    successfulRows: 0,
    failedRows: 0,
    uniqueEmails: 0,
    uniqueProperties: 0,
  }
  const emails = new Set()
  const properties = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return summary

  const prefix = `dealmachine-export-outreach-results-${date}`
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith(prefix) || !file.endsWith(".json")) continue
    const rows = readJson(path.join(OUTREACH_DIR, file), [])
    if (!Array.isArray(rows)) continue
    summary.resultFiles += 1
    for (const row of rows) {
      if (row?.ok) {
        summary.successfulRows += 1
        if (row.email) emails.add(String(row.email).toLowerCase())
        if (row.property_address_full) properties.add(String(row.property_address_full).trim().toLowerCase())
      } else {
        summary.failedRows += 1
      }
    }
  }
  summary.uniqueEmails = emails.size
  summary.uniqueProperties = properties.size
  return summary
}

function findLatestExportForMarket(market) {
  if (!fs.existsSync(DM_EXPORT_DIR)) return ""
  const slug = normalizeMarketSlug(market)
  const compact = slug.replace(/-/g, "")
  const candidates = fs
    .readdirSync(DM_EXPORT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const file = path.join(DM_EXPORT_DIR, name)
      const stat = fs.statSync(file)
      return { file, name: name.toLowerCase(), mtimeMs: stat.mtimeMs }
    })
    .filter((entry) => {
      const normalized = normalizeMarketSlug(entry.name)
      return normalized.includes(slug) || normalized.replace(/-/g, "").includes(compact)
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return candidates[0]?.file || ""
}

function marketList() {
  const explicit = getArg("--markets", "")
  const raw =
    explicit ||
    "charlotte-nc,kansas-city-mo,indianapolis-in,louisville-ky,philadelphia-pa,fayetteville-nc,new-orleans-la,pittsburgh-pa,milwaukee-wi"
  return raw
    .split(",")
    .map((market) => normalizeMarketSlug(market))
    .filter(Boolean)
}

function runMarket({ market, exportCsv, limit, throttle, send }) {
  const childArgs = [
    "--env-file=.env.local",
    "scripts/dealmachine-export-outreach.mjs",
    `--market=${market}`,
    `--export-csv=${exportCsv}`,
    `--limit=${limit}`,
    `--throttle=${throttle}`,
  ]
  if (send) childArgs.push("--send")

  const result = spawnSync(process.execPath, childArgs, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  })

  if (result.status !== 0) {
    throw new Error(`Seller outreach failed for ${market} with exit code ${result.status}`)
  }
}

async function main() {
  const date = todayIso()
  const dailyCap = intArg("--daily-cap", Number.parseInt(process.env.SELLER_OUTREACH_DAILY_CAP || "300", 10), 1000)
  const throttle = intArg("--throttle", 1800, 30000)
  const before = countTodaySends(date)
  let remaining = Math.max(0, dailyCap - before.successfulRows)
  const runs = []

  console.log("=== VestBlock seller outreach autopilot ===")
  console.log(`Mode:             ${SEND ? "LIVE SEND" : "DRY RUN"}`)
  console.log(`Date:             ${date}`)
  console.log(`Daily cap:        ${dailyCap}`)
  console.log(`Sent today:       ${before.successfulRows}`)
  console.log(`Remaining slots:  ${remaining}`)

  if (remaining <= 0) {
    console.log("Seller outreach cap already reached. No sends attempted.")
    console.log(JSON.stringify({ ok: true, capReached: true, before, after: before, runs }, null, 2))
    return
  }

  for (const market of marketList()) {
    if (remaining <= 0) break
    const exportCsv = findLatestExportForMarket(market)
    if (!exportCsv) {
      runs.push({ market, ok: false, skipped: true, reason: "missing_export_csv" })
      continue
    }

    const beforeMarket = countTodaySends(date)
    runMarket({ market, exportCsv, limit: remaining, throttle, send: SEND })
    const afterMarket = countTodaySends(date)
    const sent = Math.max(0, afterMarket.successfulRows - beforeMarket.successfulRows)
    runs.push({ market, ok: true, exportCsv, requested: remaining, sent })

    if (!SEND) break
    remaining = Math.max(0, dailyCap - afterMarket.successfulRows)
  }

  const after = countTodaySends(date)
  console.log(JSON.stringify({
    ok: true,
    capReached: after.successfulRows >= dailyCap,
    before,
    after,
    remaining: Math.max(0, dailyCap - after.successfulRows),
    runs,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
