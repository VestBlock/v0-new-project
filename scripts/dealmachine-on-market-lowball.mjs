/**
 * DealMachine on-market cash-review wrapper.
 *
 * Finds the latest DealMachine Contacts export and local DealMachine queue per
 * market, then runs the on-market lowball/cash-review strategy through the
 * shared DealMachine export outreach sender.
 *
 * DRY RUN BY DEFAULT. Nothing sends unless --send is passed.
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LIMIT = Number.parseInt(getArg("limit") || "100", 10)
const MAX_EXPORT_AGE_DAYS = Number.parseInt(getArg("max-export-age-days") || "14", 10)
const MARKETS = parseMarkets(getArg("markets") || getArg("market") || "milwaukee-wi|toledo-oh")
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const DM_EXPORT_DIR = path.join(process.cwd(), "data", "dm-exports")

function normalizeMarketSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseMarkets(value) {
  const text = String(value || "").trim()
  if (!text) return []
  const separator = text.includes("|")
    ? "|"
    : /^[a-z\s]+,\s*[a-z]{2}$/i.test(text)
      ? null
      : ","
  const parts = separator ? text.split(separator) : [text]
  return [...new Set(parts.map(normalizeMarketSlug).filter(Boolean))]
}

function findLatestExportForMarket(market) {
  if (!fs.existsSync(DM_EXPORT_DIR)) return ""
  const slug = normalizeMarketSlug(market)
  const compact = slug.replace(/-/g, "")
  const threshold = Date.now() - MAX_EXPORT_AGE_DAYS * 24 * 60 * 60 * 1000

  const candidates = fs
    .readdirSync(DM_EXPORT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const file = path.join(DM_EXPORT_DIR, name)
      const stat = fs.statSync(file)
      return { file, name: name.toLowerCase(), mtimeMs: stat.mtimeMs }
    })
    .filter((entry) => entry.mtimeMs >= threshold)
    .filter((entry) => {
      const normalized = normalizeMarketSlug(entry.name)
      return normalized.includes(slug) || normalized.replace(/-/g, "").includes(compact)
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return candidates[0]?.file || ""
}

function findQueueCsvForMarket(market) {
  const normalizedMarket = normalizeMarketSlug(market)
  const preferred = [
    `dealmachine-api-${normalizedMarket}.csv`,
    `dealmachine-api-${normalizedMarket}-ready-now.csv`,
    `dealmachine-api-${normalizedMarket}-contactable-nurture-stack.csv`,
    `dealmachine-api-${normalizedMarket}-atlas-export-needed.csv`,
  ]

  for (const filename of preferred) {
    const file = path.join(OUT_DIR, filename)
    if (fs.existsSync(file)) return file
  }

  if (!fs.existsSync(OUT_DIR)) return ""
  const fallback = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.includes(normalizedMarket) && name.endsWith(".csv"))
    .sort()

  return fallback.length ? path.join(OUT_DIR, fallback[0]) : ""
}

function selectedCount(output) {
  const sent = output.match(/Done\. Sent\s+(\d+)\/(\d+)/i)
  if (sent) return Number.parseInt(sent[1], 10) || Number.parseInt(sent[2], 10) || 0
  const selected = output.match(/Selected send:\s+(\d+)/i)
  return selected ? Number.parseInt(selected[1], 10) || 0 : 0
}

function runMarket(market, limit) {
  const exportCsv = findLatestExportForMarket(market)
  const queueCsv = findQueueCsvForMarket(market)

  if (!exportCsv) {
    console.log(`skip ${market}: no recent DealMachine Contacts export in ${DM_EXPORT_DIR}`)
    return 0
  }
  if (!queueCsv) {
    console.log(`skip ${market}: no local DealMachine API/queue CSV in ${OUT_DIR}`)
    return 0
  }

  const commandArgs = [
    "scripts/dealmachine-export-outreach.mjs",
    "--strategy=on-market-lowball",
    `--market=${market}`,
    `--export-csv=${exportCsv}`,
    `--queue-csv=${queueCsv}`,
    `--limit=${limit}`,
  ]
  if (SEND) commandArgs.push("--send")

  console.log(`\n--- ${market} ---`)
  console.log(`export: ${exportCsv}`)
  console.log(`queue:  ${queueCsv}`)
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    console.error(`market ${market} failed with exit ${result.status}`)
    return 0
  }
  return selectedCount(`${result.stdout || ""}\n${result.stderr || ""}`)
}

console.log("=== DealMachine on-market cash-review wrapper ===")
console.log(`Mode:    ${SEND ? "LIVE SEND" : "DRY RUN"}`)
console.log(`Markets: ${MARKETS.join(", ") || "none"}`)
console.log(`Limit:   ${LIMIT}`)
console.log("Source:  DealMachine Contacts export + DealMachine active/pending queue only")

let remaining = LIMIT
let total = 0
for (const market of MARKETS) {
  if (remaining <= 0) break
  const count = runMarket(market, remaining)
  total += count
  remaining = Math.max(0, remaining - count)
}

console.log(`\nDone. ${SEND ? "Sent/attempted" : "Prepared"} ${total}/${LIMIT} selected DealMachine on-market cash-review draft${total === 1 ? "" : "s"}.`)
