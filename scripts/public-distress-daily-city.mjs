#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

try {
  process.loadEnvFile?.(".env.local")
} catch {
  // Hosted and launchd environments may provide variables directly.
}

const args = process.argv.slice(2)
const ROOT = process.cwd()
const OUTPUT_DIR = path.join(ROOT, "data", "operating-loops")
const DISTRESS_DIR = path.join(ROOT, "data", "distress-leads")
const STATE_FILE = path.join(OUTPUT_DIR, "public-distress-city-rotation.json")
const REPORT_FILE = path.join(OUTPUT_DIR, "public-distress-city-latest.json")
const REPORT_MD_FILE = path.join(OUTPUT_DIR, "public-distress-city-latest.md")

const MARKETS = [
  "Indianapolis, IN",
  "Charlotte, NC",
  "Louisville, KY",
  "Fayetteville, NC",
  "Philadelphia, PA",
  "Pittsburgh, PA",
  "Kansas City, MO",
  "New Orleans, LA",
  "Columbus, OH",
]

function arg(name, fallback = "") {
  const prefix = `--${name}=`
  return [...args].reverse().find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function pickMarket(state) {
  const override = arg("city") || arg("market")
  if (override) return override.trim()
  if (state.lastRunDate === today() && state.lastMarket) return state.lastMarket
  const lastIndex = Number.isInteger(state.lastIndex) ? state.lastIndex : -1
  return MARKETS[(lastIndex + 1) % MARKETS.length]
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  return {
    ok: result.status === 0,
    exitCode: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  }
}

function latestSummary(startedAtMs) {
  if (!fs.existsSync(DISTRESS_DIR)) return null
  return fs.readdirSync(DISTRESS_DIR)
    .filter((name) => /^major-market-source-harvest-summary-.*\.json$/i.test(name))
    .map((name) => {
      const file = path.join(DISTRESS_DIR, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .filter((row) => row.mtimeMs >= startedAtMs - 1000)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.file || null
}

function csvRowCount(file) {
  if (!file || !fs.existsSync(file)) return 0
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean)
  return Math.max(0, lines.length - 1)
}

function markdown(report) {
  return [
    "# Public Distress City Rotation",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Market: ${report.market}`,
    "- Mode: public-record ingest and evidence stacking; no direct outreach",
    `- Status: ${report.ok ? "ok" : "failed"}`,
    `- Public rows harvested: ${report.rowsHarvested}`,
    `- Rows accepted by source bridge: ${report.rowsImported}`,
    `- Duplicate batch: ${report.duplicate ? "yes" : "no"}`,
    "",
    "## Guardrails",
    "",
    "- Records are property-level evidence, not permission to infer a private email or phone number.",
    "- Natural-person owner records stay in licensed-enrichment, direct-mail, or manual-review paths.",
    "- Outreach is created only after the strategy source contract and contact provenance gates pass.",
    "",
    "## Collector Output",
    "",
    "```text",
    report.collector.stdout || "",
    report.collector.stderr ? `\nSTDERR:\n${report.collector.stderr}` : "",
    "```",
    "",
  ].join("\n")
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const state = readJson(STATE_FILE, {})
  const market = pickMarket(state)
  const startedAtMs = Date.now()
  const collector = run("node", [
    "scripts/major-market-source-harvest.mjs",
    `--markets=${market.replace(/,\s+/g, ",")}`,
    `--seed-limit=${arg("seed-limit", "500")}`,
    `--fetch-limit=${arg("fetch-limit", "8000")}`,
  ])

  const summaryFile = collector.ok ? latestSummary(startedAtMs) : null
  const summary = summaryFile ? readJson(summaryFile, null) : null
  const combinedPath = summary?.combinedPath || null
  const rowsHarvested = csvRowCount(combinedPath)
  let bridge = null

  if (collector.ok && combinedPath && rowsHarvested > 0) {
    const sourceName = `public_distress_open_data:${market.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    const pushed = run("node", [
      "scripts/push-strategy-source-batch.mjs",
      `--input=${combinedPath}`,
      `--source-name=${sourceName}`,
      `--batch-id=${today()}:${sourceName}`,
      "--confidence=85",
      "--apply",
    ])
    if (pushed.ok) {
      try {
        bridge = JSON.parse(pushed.stdout)
      } catch {
        bridge = { success: false, error: "Source bridge returned non-JSON output." }
      }
    } else {
      bridge = { success: false, error: pushed.stderr || pushed.stdout || "Source bridge failed." }
    }
  }

  const ok = collector.ok && (rowsHarvested === 0 || bridge?.success === true)
  const generatedAt = new Date().toISOString()
  const index = MARKETS.findIndex((value) => value === market)
  writeJson(STATE_FILE, {
    ...state,
    lastIndex: index >= 0 ? index : state.lastIndex,
    lastMarket: market,
    lastRunDate: today(),
    lastRunAt: generatedAt,
    lastStatus: ok ? "ok" : "failed",
    markets: MARKETS,
  })

  const report = {
    generatedAt,
    ok,
    executionMode: "public_record_ingest_no_direct_outreach",
    directSendEnabled: false,
    market,
    rowsHarvested,
    rowsImported: Number(bridge?.imported || bridge?.rowsIngested || 0),
    duplicate: Boolean(bridge?.duplicate),
    summaryFile,
    combinedPath,
    sourceEventId: bridge?.eventId || null,
    collector,
    bridge,
  }
  writeJson(REPORT_FILE, report)
  fs.writeFileSync(REPORT_MD_FILE, markdown(report))
  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exit(1)
}

main()
