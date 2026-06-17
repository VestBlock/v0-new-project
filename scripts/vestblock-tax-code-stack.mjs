/**
 * VestBlock tax-delinquency + code-violation stack runner.
 *
 * This is the single operator command for the tax/code lane. It reuses the
 * existing DealMachine, public-record, and export-queue scripts so the play is
 * repeatable from the command center instead of rediscovered manually.
 *
 * Usage:
 *   node --env-file=.env.local scripts/vestblock-tax-code-stack.mjs
 *   node --env-file=.env.local scripts/vestblock-tax-code-stack.mjs --markets="Kansas City,MO|Omaha,NE|Des Moines,IA|Wichita,KS" --per-city=30
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = "Kansas City,MO|Omaha,NE|Des Moines,IA|Wichita,KS"
const MARKETS = parseMarkets(getArg("markets") || getArg("market") || DEFAULT_MARKETS)
const PER_CITY = Number.parseInt(getArg("per-city") || getArg("limit-per-city") || "30", 10)
const HARVEST_PAGES = Number.parseInt(getArg("pages") || "10", 10)
const RUN_OUTSCRAPER = args.includes("--outscraper-run")
const BUILD_MISSING_LISTS = args.includes("--build-missing-lists")
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")

function parseMarkets(input) {
  return String(input || DEFAULT_MARKETS)
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [city, state] = chunk.split(",").map((part) => part.trim())
      return city && state ? { city, state: state.toUpperCase(), label: `${city}, ${state.toUpperCase()}`, slug: slug(`${city}-${state}`) } : null
    })
    .filter(Boolean)
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function run(label, command, commandArgs, options = {}) {
  console.log(`\n=== ${label} ===`)
  console.log([command, ...commandArgs].join(" "))
  const result = spawnSync(command, commandArgs, {
    stdio: options.quiet ? "pipe" : "inherit",
    encoding: "utf8",
    env: process.env,
  })
  if (options.allowFailure && result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : ""
    const stdout = result.stdout ? String(result.stdout).trim() : ""
    console.log(`Skipped ${label}: ${stderr || stdout || `exit ${result.status}`}`)
    return { ok: false, stdout, stderr, status: result.status }
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`)
  }
  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "", status: result.status }
}

function latestFile(prefix, extension = ".json") {
  if (!fs.existsSync(OUT_DIR)) return ""
  const hits = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
    .map((name) => ({ file: path.join(OUT_DIR, name), mtime: fs.statSync(path.join(OUT_DIR, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return hits[0]?.file || ""
}

async function writeKcmoOpenCodeViolations() {
  const hasKansasCity = MARKETS.some((market) => market.slug === "kansas-city-mo")
  if (!hasKansasCity) return null

  const url = new URL("https://data.kcmo.org/resource/nhtf-e75a.json")
  url.searchParams.set("$select", "address,state,violation_description,violation_entry_date,status,case_opened,case_id")
  url.searchParams.set("$where", 'status="Open"')
  url.searchParams.set("$limit", "50000")

  const response = await fetch(url)
  if (!response.ok) throw new Error(`KCMO code source failed ${response.status}: ${(await response.text()).slice(0, 200)}`)
  const rows = await response.json()
  const columns = ["address", "city", "state", "violation", "violation_date", "case_id", "status", "source_url"]
  const normalized = rows
    .filter((row) => row.address)
    .map((row) => ({
      address: row.address || "",
      city: "Kansas City",
      state: row.state || "MO",
      violation: [row.violation_description, row.status ? `status: ${row.status}` : "", row.case_id ? `case: ${row.case_id}` : ""].filter(Boolean).join(" | "),
      violation_date: row.violation_entry_date || row.case_opened || "",
      case_id: row.case_id || "",
      status: row.status || "",
      source_url: "https://data.kcmo.org/Neighborhoods/Property-Violations-Historical-/nhtf-e75a",
    }))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, "code-violations-kansas-city-mo.csv")
  fs.writeFileSync(file, [columns.join(","), ...normalized.map((row) => columns.map((column) => esc(row[column])).join(","))].join("\n"))
  return { file, rows: normalized.length }
}

function sourceMapRows() {
  return [
    {
      market: "Kansas City, MO",
      tax_source: "Jackson County Tax Search",
      tax_url: "https://mo-jackson.publicaccessnow.com/Collector/TaxSearch.aspx",
      code_source: "Open Data KC Property Violations",
      code_url: "https://data.kcmo.org/Neighborhoods/Property-Violations-Historical-/nhtf-e75a",
      status: "automated_code_match_ready",
    },
    {
      market: "Omaha, NE",
      tax_source: "Douglas County Treasurer Property Tax Lookup",
      tax_url: "https://treasurer.douglascounty-ne.gov/property-tax-lookup/",
      code_source: "Omaha/Douglas code source needs adapter or exported CSV",
      code_url: "https://www.omahahotline.com/",
      status: "needs_dealmachine_export_and_code_adapter",
    },
    {
      market: "Des Moines, IA",
      tax_source: "Polk County Treasurer / Iowa Tax and Tags",
      tax_url: "https://www.iowataxandtags.org/about-us/polk-county-treasurer/",
      code_source: "Des Moines/Polk code source needs adapter or exported CSV",
      code_url: "https://www.polkcountyiowa.gov/county-assessor/",
      status: "needs_dealmachine_export_and_code_adapter",
    },
    {
      market: "Wichita, KS",
      tax_source: "Sedgwick County Delinquent Tax Listings",
      tax_url: "https://ssc.sedgwickcounty.org/propertytax/delinquencies.aspx",
      code_source: "Wichita code enforcement source needs adapter or exported CSV",
      code_url: "https://www.wichita.gov/558/Enforcement",
      status: "needs_dealmachine_export_and_code_adapter",
    },
  ].filter((row) => MARKETS.some((market) => market.label === row.market))
}

function writeSourceMap() {
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const file = path.join(OUTREACH_DIR, `vestblock-tax-code-source-map-${stamp}.csv`)
  const columns = ["market", "tax_source", "tax_url", "code_source", "code_url", "status"]
  const rows = sourceMapRows()
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((column) => esc(row[column])).join(","))].join("\n"))
  return { file, rows: rows.length }
}

function readSummary(file) {
  if (!file) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const marketsArg = MARKETS.map((market) => `${market.city},${market.state}`).join("|")
  const totalLimit = Math.max(PER_CITY * MARKETS.length, PER_CITY)
  const report = {
    createdAt: new Date().toISOString(),
    markets: MARKETS.map((market) => market.label),
    perCity: PER_CITY,
    artifacts: {},
    blockers: [],
  }

  const sourceMap = writeSourceMap()
  report.artifacts.sourceMapCsv = sourceMap.file

  if (RUN_OUTSCRAPER) {
    const result = run(
      "Outscraper county-record source discovery",
      "node",
      [
        "--env-file=.env.local",
        "scripts/outscraper-real-estate-discovery.mjs",
        "--run",
        "--lane=county-records",
        `--market=${marketsArg}`,
        "--max-niches=8",
        "--limit-per-niche=2",
      ],
      { allowFailure: true, quiet: true }
    )
    if (!result.ok) report.blockers.push(`Outscraper county-record discovery failed: ${(result.stderr || result.stdout || "").slice(0, 240)}`)
  }

  const kcCode = await writeKcmoOpenCodeViolations()
  if (kcCode) report.artifacts.kcmoCodeViolationsCsv = kcCode.file

  run("DealMachine market harvest", "node", [
    "--env-file=.env.local",
    "scripts/dealmachine-market-harvest.mjs",
    `--markets=${marketsArg}`,
    "--contactable-only",
    "--stacked",
    `--pages=${HARVEST_PAGES}`,
    "--timeout-ms=45000",
  ])

  run("DealMachine tax/code stack", "node", [
    "--env-file=.env.local",
    "scripts/dealmachine-tax-code-stack.mjs",
    `--markets=${marketsArg}`,
    "--include-tax-only",
    `--limit=${totalLimit}`,
  ])

  const stackSummaryPath = latestFile("dealmachine-tax-code-stack-summary-")
  const stackSummary = readSummary(stackSummaryPath)
  report.artifacts.stackSummaryJson = stackSummaryPath
  report.artifacts.stackCsv = stackSummary?.csvPath || null
  report.stackSummary = stackSummary?.marketSummaries || []
  const missingMarkets = (stackSummary?.marketSummaries || [])
    .filter((market) => Number(market.dealMachineRows || 0) === 0 || Number(market.stackedRows || 0) < PER_CITY)
    .map((market) => market.market)

  if (missingMarkets.length) {
    run("DealMachine List Builder queue for missing cities", "node", [
      "scripts/dealmachine-list-builder-expansion.mjs",
      `--markets=${missingMarkets.map((market) => market.replace(", ", ",")).join("|")}`,
      "--strategies=tax-code-stack",
      "--mode=smart",
      `--limit-per-list=${PER_CITY}`,
    ])
    const listBuilderPlan = [...fs.readdirSync(OUTREACH_DIR)]
      .filter((name) => name.startsWith("dealmachine-list-builder-expansion-") && name.endsWith(".md"))
      .map((name) => ({ file: path.join(OUTREACH_DIR, name), mtime: fs.statSync(path.join(OUTREACH_DIR, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]?.file
    report.artifacts.listBuilderPlanMd = listBuilderPlan || null
    report.blockers.push(`${missingMarkets.join(" | ")} need DealMachine List Builder export/contact CSV before this lane can reach ${PER_CITY} per city.`)

    if (BUILD_MISSING_LISTS) {
      run("DealMachine website list builder", "node", [
        "scripts/dealmachine-website-list-builder.mjs",
        "--build",
        `--markets=${missingMarkets.map((market) => market.replace(", ", ",")).join("|")}`,
        "--strategies=tax-code-stack",
        `--max-builds=${missingMarkets.length}`,
        `--max-count=${PER_CITY}`,
        "--min-count=1",
        "--timeout-ms=45000",
        "--poll-timeout-ms=600000",
      ], { allowFailure: true })
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportPath = path.join(OUTREACH_DIR, `vestblock-tax-code-stack-run-${stamp}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== VestBlock tax/code stack complete ===")
  console.log(`Stack CSV:      ${report.artifacts.stackCsv || "none"}`)
  console.log(`Source map:     ${report.artifacts.sourceMapCsv}`)
  console.log(`Run report:     ${reportPath}`)
  if (report.blockers.length) {
    console.log("Blockers:")
    for (const blocker of report.blockers) console.log(`- ${blocker}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
