/**
 * Bootstrap a county-first preforeclosure source pack from the local registry.
 *
 * This does not scrape gated systems. It creates a clean operating packet:
 * - markdown source guide per market
 * - raw CSV intake templates
 * - report showing which county/public URLs should be worked first
 *
 * Usage:
 *   node scripts/preforeclosure-county-source-bootstrap.mjs
 *   node scripts/preforeclosure-county-source-bootstrap.mjs --markets=kansas-city-mo,tulsa-ok
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const PRE_DIR = path.join(process.cwd(), "data", "preforeclosure-county")
const RAW_DIR = path.join(PRE_DIR, "raw")
const GUIDE_DIR = path.join(PRE_DIR, "guides")
const REPORT_DIR = path.join(process.cwd(), "tmp", "outreach")
const REGISTRY_FILE = path.join(PRE_DIR, "source-registry.json")

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseMarkets(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map((item) => normalizeSlug(item))
    .filter(Boolean)
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeIfMissing(file, contents) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, contents)
}

function csvTemplate() {
  return [
    "county,state,owner_name,property_address,mailing_address,case_number,filing_date,sale_date,plaintiff,arrears_amount,estimated_value,mortgage_balance,tax_delinquent_amount,status,notes",
  ].join("\n")
}

function main() {
  ensureDir(PRE_DIR)
  ensureDir(RAW_DIR)
  ensureDir(GUIDE_DIR)
  ensureDir(REPORT_DIR)

  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"))
  const selected = parseMarkets(getArg("markets"))
  const markets = (registry.markets || []).filter((market) => !selected.length || selected.includes(normalizeSlug(market.market)))
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportFile = path.join(REPORT_DIR, `preforeclosure-county-source-bootstrap-${stamp}.md`)

  const report = [
    "# Preforeclosure County Source Bootstrap",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Markets: ${markets.length}`,
    "",
  ]

  for (const market of markets) {
    const guideFile = path.join(GUIDE_DIR, `${market.market}.md`)
    const rawTemplateFile = path.join(RAW_DIR, `${market.market}-${new Date().toISOString().slice(0, 10)}-raw-template.csv`)

    const guide = [
      `# ${market.market}`,
      "",
      `- County: ${market.county}`,
      `- State: ${market.state}`,
      `- Priority: ${market.priority || 0}`,
      "",
      "## Source order",
      "",
      ...market.sources.map((source, index) => `${index + 1}. ${source.label} - ${source.url}\n   - ${source.notes}`),
      "",
      "## Intake rule",
      "",
      "- Pull current filings, auction notices, postponements, and tax-sale context from these county/public sources first.",
      "- Save cleaned rows into the raw CSV template in `data/preforeclosure-county/raw`.",
      "- Then run `npm run distress:preforeclosure:county-osint -- --file=<raw csv> --apply-checklists --run-public-osint`.",
      "- Use DealMachine only as a fallback contact path after county-trigger validation and public OSINT review.",
      "",
      "## OSINT follow-through",
      "",
      "- Verify mailing vs property address.",
      "- Check owner entity/trust/LLC naming.",
      "- Score owner-occupant sensitivity, bankruptcy, probate, vacancy, tax, and code stack.",
      "- Route into subject-to, cash, novation, or referral before outreach.",
      "",
    ].join("\n")

    fs.writeFileSync(guideFile, guide)
    writeIfMissing(rawTemplateFile, csvTemplate())

    report.push(`## ${market.market}`)
    report.push("")
    report.push(`- Guide: ${path.relative(process.cwd(), guideFile)}`)
    report.push(`- Raw template: ${path.relative(process.cwd(), rawTemplateFile)}`)
    report.push(...market.sources.map((source) => `- ${source.type}: ${source.url}`))
    report.push("")
  }

  fs.writeFileSync(reportFile, report.join("\n"))
  console.log(
    JSON.stringify(
      {
        ok: true,
        markets: markets.map((market) => market.market),
        reportFile: path.relative(process.cwd(), reportFile),
        guides: markets.map((market) => path.relative(process.cwd(), path.join(GUIDE_DIR, `${market.market}.md`))),
      },
      null,
      2
    )
  )
}

main()
