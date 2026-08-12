/**
 * Daily city rotation for on-market creative-finance outreach.
 *
 * Runs one city per day through the stale-listing creative-finance lane so we
 * expand methodically instead of hitting the same markets every run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/on-market-creative-daily-city.mjs
 *   node --env-file=.env.local scripts/on-market-creative-daily-city.mjs --send
 *   node --env-file=.env.local scripts/on-market-creative-daily-city.mjs --city="Cleveland, OH"
 */

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const SEND = args.includes("--send")

function getArg(name) {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = [
  "Milwaukee, WI",
  "Toledo, OH",
  "Cincinnati, OH",
  "Detroit, MI",
  "Cleveland, OH",
  "Columbus, OH",
  "Indianapolis, IN",
  "Louisville, KY",
  "Kansas City, MO",
  "Macon, GA",
  "Pittsburgh, PA",
  "Akron, OH",
  "Buffalo, NY",
  "Dayton, OH",
  "Fort Wayne, IN",
  "Grand Rapids, MI",
  "Flint, MI",
  "Lansing, MI",
  "Youngstown, OH",
  "Rochester, NY",
  "Syracuse, NY",
  "Tulsa, OK",
  "Little Rock, AR",
  "Omaha, NE",
  "Wichita, KS",
]

const ROOT = process.cwd()
const OPERATING_DIR = path.join(ROOT, "data", "operating-loops")
const STATE_FILE = path.join(OPERATING_DIR, "on-market-creative-city-rotation.json")
const REPORT_FILE = path.join(OPERATING_DIR, "on-market-creative-city-latest.json")
const REPORT_MD_FILE = path.join(OPERATING_DIR, "on-market-creative-city-latest.md")

const MARKETS = parseMarkets(getArg("markets") || getArg("market-list") || process.env.ON_MARKET_CREATIVE_MARKETS || "")
const CITY_OVERRIDE = getArg("city") || getArg("market")
const PRICE_MIN = Number.parseInt(getArg("price-min") || process.env.ON_MARKET_CREATIVE_PRICE_MIN || "50000", 10)
const PRICE_MAX = Number.parseInt(getArg("price-max") || process.env.ON_MARKET_CREATIVE_PRICE_MAX || "1000000", 10)
const LIMIT = Number.parseInt(getArg("limit") || process.env.ON_MARKET_CREATIVE_LIMIT || "100", 10)
const HARVEST_LIMIT = Number.parseInt(
  getArg("harvest-limit-per-market") || process.env.ON_MARKET_CREATIVE_HARVEST_LIMIT || "140",
  10,
)
const MIN_DOM = Number.parseInt(getArg("min-dom") || process.env.ON_MARKET_CREATIVE_MIN_DOM || "45", 10)
const DISTRESS_THRESHOLD = Number.parseInt(
  getArg("distress-threshold") || process.env.ON_MARKET_CREATIVE_DISTRESS_THRESHOLD || "8",
  10,
)

function parseMarkets(value) {
  const parsed = String(value || "")
    .split("|")
    .map((market) => market.trim())
    .filter(Boolean)
  return parsed.length ? parsed : DEFAULT_MARKETS
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeMarket(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}

function pickMarket(state) {
  if (CITY_OVERRIDE) return normalizeMarket(CITY_OVERRIDE)

  const today = todayKey()
  if (state.lastRunDate === today && state.lastMarket) return state.lastMarket

  const lastIndex = Number.isInteger(state.lastIndex) ? state.lastIndex : -1
  for (let offset = 1; offset <= MARKETS.length; offset++) {
    const nextIndex = (lastIndex + offset) % MARKETS.length
    const market = normalizeMarket(MARKETS[nextIndex])
    const lastRun = state.marketRuns?.[market]?.lastRunDate
    if (lastRun !== today) return market
  }

  return normalizeMarket(MARKETS[(lastIndex + 1) % MARKETS.length])
}

function commandForMarket(market) {
  return [
    "scripts/stale-listing-finder.mjs",
    "--source=homeharvest",
    "--offer-mode=on-market-creative-finance",
    `--market=${market}`,
    `--min-dom=${MIN_DOM}`,
    `--distress-threshold=${DISTRESS_THRESHOLD}`,
    `--price-min=${PRICE_MIN}`,
    `--price-max=${PRICE_MAX}`,
    `--harvest-limit-per-market=${HARVEST_LIMIT}`,
    `--limit=${LIMIT}`,
    "--ingest",
    ...(SEND ? ["--send"] : []),
  ]
}

function updateState(state, market, result) {
  const marketRuns = state.marketRuns || {}
  const today = todayKey()
  const index = MARKETS.findIndex((candidate) => normalizeMarket(candidate) === market)
  marketRuns[market] = {
    lastRunDate: today,
    lastRunAt: new Date().toISOString(),
    lastStatus: result.status,
    lastExitCode: result.exitCode,
  }
  return {
    updatedAt: new Date().toISOString(),
    lastRunDate: today,
    lastRunAt: new Date().toISOString(),
    lastMarket: market,
    lastIndex: index >= 0 ? index : state.lastIndex,
    markets: MARKETS,
    marketRuns,
  }
}

function renderMarkdown(report) {
  return [
    "# On-Market Creative City Rotation",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${report.send ? "live send" : "ingest + review queue (no direct send)"}`,
    `- Market: ${report.market}`,
    `- Price range: $${PRICE_MIN.toLocaleString()}-$${PRICE_MAX.toLocaleString()}`,
    `- Status: ${report.ok ? "ok" : "failed"}`,
    "",
    "## Command",
    "",
    "```bash",
    `node --env-file=.env.local ${report.command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ")}`,
    "```",
    "",
    "## Output",
    "",
    "```",
    report.stdout || "",
    report.stderr ? `\nSTDERR:\n${report.stderr}` : "",
    "```",
    "",
  ].join("\n")
}

function main() {
  fs.mkdirSync(OPERATING_DIR, { recursive: true })
  const state = readJson(STATE_FILE, {})
  const market = pickMarket(state)
  const command = commandForMarket(market)
  const run = spawnSync("node", command, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  const result = {
    status: run.status === 0 ? "ok" : "failed",
    exitCode: run.status,
  }
  const nextState = updateState(state, market, result)
  writeJson(STATE_FILE, nextState)

  const report = {
    generatedAt: new Date().toISOString(),
    ok: run.status === 0,
    send: SEND,
    executionMode: SEND ? "live_send" : "ingest_review_queue",
    directSendEnabled: SEND,
    market,
    priceMin: PRICE_MIN,
    priceMax: PRICE_MAX,
    minDom: MIN_DOM,
    distressThreshold: DISTRESS_THRESHOLD,
    limit: LIMIT,
    harvestLimit: HARVEST_LIMIT,
    command,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    stateFile: path.relative(ROOT, STATE_FILE),
  }
  writeJson(REPORT_FILE, report)
  fs.writeFileSync(REPORT_MD_FILE, renderMarkdown(report))

  console.log(JSON.stringify(report, null, 2))
  if (run.status !== 0) process.exit(run.status || 1)
}

main()
