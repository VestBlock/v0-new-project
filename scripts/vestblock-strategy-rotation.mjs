#!/usr/bin/env node

/**
 * VestBlock multi-strategy rotation planner.
 *
 * Creates 30-lead DealMachine rotation plans across the seller strategies the
 * Boss can run multiple times per day. Optional count/build/export modes call
 * the existing DealMachine website list-builder and Contacts export request
 * scripts so each strategy stays separated.
 *
 * Usage:
 *   node --env-file=.env.local scripts/vestblock-strategy-rotation.mjs
 *   node --env-file=.env.local scripts/vestblock-strategy-rotation.mjs --strategy=failed-landlord-exit --markets="Tulsa,OK|Dayton,OH" --count
 *   node --env-file=.env.local scripts/vestblock-strategy-rotation.mjs --strategy=epic --build --max-builds=8
 */

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "data", "operating-loops")
const TMP_OUTREACH = path.join(ROOT, "tmp", "outreach")

function has(flag) {
  return args.includes(flag)
}

function getArg(name, fallback = "") {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

function intArg(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ""), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseList(value) {
  return String(value || "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

const CORE_STRATEGIES = [
  "tax-code-stack",
  "vacant-equity",
  "land-wholesale",
  "portfolio-landlord",
  "preforeclosure-equity",
  "expired-lowball",
  "active-stale-lowball",
  "lien-equity",
  "tax-remote-equity-rotation",
]

const EPIC_STRATEGIES = [
  "failed-landlord-exit",
  "insurance-damage-event",
  "zombie-rehab",
  "senior-downsizer",
  "rent-gap-multifamily",
  "probate-vacant-equity",
  "tired-airbnb-midterm",
  "utility-lien-water-shutoff",
  "contractor-distress-flip",
  "small-commercial-owner-exit",
  "portfolio-fragmentation",
  "buyer-reverse-engineering",
  "permit-spike-developer-land",
  "judgment-lien-pressure",
  "tax-assessment-shock",
]

const STRATEGY_LABELS = {
  "tax-code-stack": "Tax delinquent + code violation",
  "vacant-equity": "Vacant high-equity absentee",
  "land-wholesale": "Land wholesale / developer activity",
  "portfolio-landlord": "Portfolio landlord",
  "preforeclosure-equity": "Preforeclosure equity",
  "expired-lowball": "Expired listing lowball",
  "active-stale-lowball": "Active stale listing lowball",
  "lien-equity": "Active lien with equity",
  "tax-remote-equity-rotation": "Tax remote-owner equity rotation",
  "failed-landlord-exit": "Failed landlord exit",
  "insurance-damage-event": "Insurance / damage event",
  "zombie-rehab": "Zombie rehab / stalled project",
  "senior-downsizer": "Equity-rich downsizer",
  "rent-gap-multifamily": "Small multifamily rent gap",
  "probate-vacant-equity": "Probate + vacant + equity",
  "tired-airbnb-midterm": "Tired Airbnb / midterm rental",
  "utility-lien-water-shutoff": "Utility / water lien pressure",
  "contractor-distress-flip": "Contractor distress buyer-seller flip",
  "small-commercial-owner-exit": "Small commercial owner exit",
  "portfolio-fragmentation": "Portfolio fragmentation",
  "buyer-reverse-engineering": "Buyer reverse-engineering",
  "permit-spike-developer-land": "Permit spike developer / land",
  "judgment-lien-pressure": "Judgment / lien pressure",
  "tax-assessment-shock": "Tax assessment shock",
}

const DEFAULT_MARKETS = [
  "Tulsa,OK",
  "Dayton,OH",
  "Akron,OH",
  "Little Rock,AR",
  "Kansas City,MO",
  "St. Louis,MO",
  "Memphis,TN",
  "Birmingham,AL",
  "Omaha,NE",
  "Des Moines,IA",
  "Wichita,KS",
  "Greensboro,NC",
]

function selectedStrategies() {
  const raw = getArg("strategies", getArg("strategy", "epic"))
  if (raw === "all") return [...CORE_STRATEGIES, ...EPIC_STRATEGIES]
  if (raw === "core") return CORE_STRATEGIES
  if (raw === "epic") return EPIC_STRATEGIES
  return parseList(raw).map(slug).filter(Boolean)
}

function selectedMarkets() {
  const raw = getArg("markets", getArg("market", DEFAULT_MARKETS.join("|")))
  return parseList(raw).map((market) => {
    const [city, state] = market.split(",").map((part) => part.trim())
    if (city && state) return `${city},${state.toUpperCase()}`
    return market
  })
}

function latestBuilderJson() {
  if (!fs.existsSync(TMP_OUTREACH)) return ""
  return fs
    .readdirSync(TMP_OUTREACH)
    .filter((name) => /^dealmachine-website-list-builder-.*\.json$/i.test(name))
    .map((name) => ({ file: path.join(TMP_OUTREACH, name), mtime: fs.statSync(path.join(TMP_OUTREACH, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file || ""
}

function runNodeScript(script, extraArgs) {
  const child = spawnSync(process.execPath, ["--env-file=.env.local", script, ...extraArgs], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  })
  if (child.status !== 0) throw new Error(`${script} failed with exit code ${child.status}`)
}

function buildPlan({ strategies, markets, dailyCap, maxBuilds, rotationsPerMarket }) {
  const createdAt = new Date().toISOString()
  const lanes = []
  for (const strategy of strategies) {
    for (const market of markets) {
      lanes.push({
        strategy,
        strategyLabel: STRATEGY_LABELS[strategy] || strategy.replace(/-/g, " "),
        market,
        targetLeadCount: dailyCap,
        rotationsPerMarket,
        status: "ready_to_count_or_build",
        buildCommand: [
          "node --env-file=.env.local scripts/dealmachine-website-list-builder.mjs --build",
          `--strategies=${strategy}`,
          `--markets=${market}`,
          `--max-count=${dailyCap}`,
          "--min-count=1",
          `--rotations-per-market=${rotationsPerMarket}`,
          "--timeout-ms=45000",
          "--poll-timeout-ms=600000",
          "--max-builds=1",
        ].join(" "),
        exportCommand: "node --env-file=.env.local scripts/dealmachine-export-lists.mjs --lists-json=<builder-json> --send --emails=acquisitions@vestblock.io --wait-ms=60000 --request-timeout-ms=60000",
        outreachCommand: `node --env-file=.env.local scripts/dealmachine-export-outreach.mjs --strategy=${strategy} --market=${slug(market)} --export-csv=<downloaded-contacts.csv> --limit=${dailyCap} --send`,
      })
    }
  }

  const waves = []
  let index = 0
  for (const lane of lanes) {
    const wave = Math.floor(index / Math.max(1, maxBuilds)) + 1
    waves.push({
      wave,
      strategy: lane.strategy,
      strategyLabel: lane.strategyLabel,
      market: lane.market,
      targetLeadCount: lane.targetLeadCount,
      buildCommand: lane.buildCommand,
      exportCommand: lane.exportCommand,
      outreachCommand: lane.outreachCommand,
    })
    index += 1
  }

  return { createdAt, dailyCap, maxBuilds, rotationsPerMarket, strategies, markets, lanes, waves }
}

function writePlan(plan) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, "strategy-rotation-plan.json")
  const csvPath = path.join(OUT_DIR, "strategy-rotation-plan.csv")
  const mdPath = path.join(OUT_DIR, "strategy-rotation-plan.md")
  fs.writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8")
  const columns = ["wave", "strategy", "strategyLabel", "market", "targetLeadCount", "buildCommand", "exportCommand", "outreachCommand"]
  fs.writeFileSync(csvPath, [columns.join(","), ...plan.waves.map((row) => columns.map((column) => esc(row[column])).join(","))].join("\n") + "\n", "utf8")
  fs.writeFileSync(
    mdPath,
    [
      "# VestBlock Strategy Rotation Plan",
      "",
      `Created: ${plan.createdAt}`,
      `Daily lane cap: ${plan.dailyCap}`,
      `Strategies: ${plan.strategies.join(", ")}`,
      `Markets: ${plan.markets.join(" | ")}`,
      "",
      "## Waves",
      "",
      ...plan.waves.map((row) => `- Wave ${row.wave}: ${row.strategyLabel} / ${row.market} / ${row.targetLeadCount} leads`),
      "",
      "## Operating Rule",
      "",
      "Build one wave at a time, export Contacts with DNC fields, ingest/download the CSV, then send only through the matching strategy outreach command.",
      "",
    ].join("\n"),
    "utf8"
  )
  return { jsonPath, csvPath, mdPath }
}

async function main() {
  const strategies = selectedStrategies()
  const markets = selectedMarkets()
  const dailyCap = intArg("daily-cap", 30, 100)
  const maxBuilds = intArg("max-builds", 4, 40)
  const rotationsPerMarket = intArg("rotations-per-market", 1, 10)
  const shouldCount = has("--count")
  const shouldBuild = has("--build")
  const shouldExport = has("--export")
  const plan = buildPlan({ strategies, markets, dailyCap, maxBuilds, rotationsPerMarket })
  const outputs = writePlan(plan)

  console.log("=== VestBlock strategy rotation ===")
  console.log(`Mode:       ${shouldBuild ? "BUILD" : shouldCount ? "COUNT" : "PLAN"}`)
  console.log(`Daily cap:  ${dailyCap}`)
  console.log(`Strategies: ${strategies.join(" | ")}`)
  console.log(`Markets:    ${markets.join(" | ")}`)
  console.log(`Waves:      ${Math.max(1, ...plan.waves.map((wave) => wave.wave))}`)
  console.log(`Plan:       ${outputs.mdPath}`)
  console.log(`JSON:       ${outputs.jsonPath}`)

  if (shouldCount || shouldBuild) {
    const builderArgs = [
      `--strategies=${strategies.join("|")}`,
      `--markets=${markets.join("|")}`,
      `--max-count=${dailyCap}`,
      "--min-count=1",
      `--rotations-per-market=${rotationsPerMarket}`,
      `--max-builds=${maxBuilds}`,
      "--timeout-ms=45000",
      "--poll-timeout-ms=600000",
    ]
    if (shouldBuild) builderArgs.unshift("--build")
    runNodeScript("scripts/dealmachine-website-list-builder.mjs", builderArgs)
  }

  if (shouldExport) {
    const builderJson = getArg("lists-json", latestBuilderJson())
    if (!builderJson) throw new Error("No DealMachine list-builder JSON found. Run --build first or pass --lists-json=<path>.")
    runNodeScript("scripts/dealmachine-export-lists.mjs", [
      `--lists-json=${builderJson}`,
      "--send",
      "--emails=acquisitions@vestblock.io",
      "--wait-ms=60000",
      "--request-timeout-ms=60000",
    ])
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
