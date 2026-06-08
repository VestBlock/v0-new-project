/**
 * DealMachine contact scout.
 *
 * Pushes balanced batches from the existing VestBlock distress stack into
 * DealMachine, then writes a contactability report from DealMachine's returned
 * has_email_address / has_phone_number flags.
 *
 * Dry-ish safety: this does create DealMachine leads, but it does not send email.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-contact-scout.mjs --per-market=25
 *   node --env-file=.env.local scripts/dealmachine-contact-scout.mjs --markets=cincinnati,milwaukee,toledo,detroit --per-market=25
 */

import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = ["cincinnati", "milwaukee", "toledo", "detroit"]
const MARKETS = (getArg("markets") || DEFAULT_MARKETS.join(","))
  .split(",")
  .map((market) => market.trim().toLowerCase())
  .filter(Boolean)
const PER_MARKET = getArg("per-market") ? Number.parseInt(getArg("per-market"), 10) : 25
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const PUSHED_RECORDS = path.join(OUT_DIR, "dealmachine-pushed-records.json")
const SCOUT_CSV = path.join(OUT_DIR, "dealmachine-contact-scout-results.csv")
const SCOUT_JSON = path.join(OUT_DIR, "dealmachine-contact-scout-results.json")
const OWNER_EMAIL_SCRIPT = path.join(process.cwd(), "scripts", "dealmachine-owner-email.mjs")
const PUSH_SCRIPT = path.join(process.cwd(), "scripts", "dealmachine-push.mjs")

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function contactSnapshot(record) {
  return record.contact_snapshot || record.contactSnapshot || {}
}

function writeScout(records) {
  const rows = records
    .map((record) => {
      const contact = contactSnapshot(record)
      const emailFlag = Boolean(contact.has_email_address)
      const phoneFlag = Boolean(contact.has_phone_number)
      return {
        dealmachine_id: record.dealmachine_id,
        pushed_at: record.pushed_at,
        market: record.market,
        full_address: record.full_address,
        owner_name: record.owner_name,
        distress_stack: record.distress_stack,
        delinquent_amount: record.delinquent_amount,
        has_email_address: emailFlag ? "true" : "false",
        has_phone_number: phoneFlag ? "true" : "false",
        email_count: contact.email_count ?? 0,
        phone_count: contact.phone_count ?? 0,
        contact_priority: emailFlag && phoneFlag ? "A - email and phone flagged" : emailFlag ? "B - email flagged" : phoneFlag ? "C - phone flagged" : "D - no contact flag",
        next_action: emailFlag
          ? "Run owner-email extractor; if API hides email, export contact-enriched CSV from DealMachine UI."
          : phoneFlag
            ? "Review call/DNC-compliant workflow before phone outreach."
            : "Keep in lower-priority follow-up or direct mail lane.",
      }
    })
    .sort((a, b) => {
      const priority = a.contact_priority.localeCompare(b.contact_priority)
      if (priority) return priority
      return String(a.market || "").localeCompare(String(b.market || "")) || String(a.full_address || "").localeCompare(String(b.full_address || ""))
    })

  const columns = [
    "dealmachine_id",
    "pushed_at",
    "market",
    "full_address",
    "owner_name",
    "distress_stack",
    "delinquent_amount",
    "has_email_address",
    "has_phone_number",
    "email_count",
    "phone_count",
    "contact_priority",
    "next_action",
  ]

  fs.writeFileSync(SCOUT_JSON, JSON.stringify(rows, null, 2))
  fs.writeFileSync(SCOUT_CSV, [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n"))
  return rows
}

async function runNodeScript(script, scriptArgs) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...scriptArgs], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  })
  return `${stdout || ""}${stderr ? `\n${stderr}` : ""}`.trim()
}

function summarize(records) {
  const byMarket = {}
  let emailFlag = 0
  let phoneFlag = 0
  for (const record of records) {
    byMarket[record.market || "unknown"] = (byMarket[record.market || "unknown"] || 0) + 1
    const contact = contactSnapshot(record)
    if (contact.has_email_address) emailFlag++
    if (contact.has_phone_number) phoneFlag++
  }
  return { total: records.length, byMarket, emailFlag, phoneFlag }
}

async function main() {
  if (!process.env.DEALMACHINE_API_KEY) throw new Error("Missing DEALMACHINE_API_KEY.")
  if (!PER_MARKET || PER_MARKET < 1) throw new Error("--per-market must be at least 1.")

  const before = readJson(PUSHED_RECORDS, [])
  const beforeIds = new Set(before.map((record) => String(record.dealmachine_id)).filter(Boolean))
  const startedAt = new Date().toISOString()

  console.log("=== DealMachine contact scout ===")
  console.log(`Started:    ${startedAt}`)
  console.log(`Markets:    ${MARKETS.join(", ")}`)
  console.log(`Per market: ${PER_MARKET}`)

  for (const market of MARKETS) {
    console.log(`\n--- ${market} ---`)
    const output = await runNodeScript(PUSH_SCRIPT, ["--push", `--market=${market}`, `--limit=${PER_MARKET}`])
    const important = output
      .split("\n")
      .filter((line) => /^(===|Mode:|Market:|New leads:|Import CSV:|ok |failed |Done\.|Top priority sample:|  \$)/.test(line))
      .slice(-80)
      .join("\n")
    console.log(important || output.split("\n").slice(-20).join("\n"))
  }

  const after = readJson(PUSHED_RECORDS, [])
  const newRecords = after.filter((record) => record.dealmachine_id && !beforeIds.has(String(record.dealmachine_id)))
  const scoutRows = writeScout(newRecords)
  const summary = summarize(newRecords)

  console.log("\n=== Scout summary ===")
  console.log(`New DealMachine leads: ${summary.total}`)
  console.log(`By market: ${Object.entries(summary.byMarket).map(([market, count]) => `${market}: ${count}`).join(", ") || "none"}`)
  console.log(`Email flagged: ${summary.emailFlag}`)
  console.log(`Phone flagged: ${summary.phoneFlag}`)
  console.log(`Scout CSV: ${SCOUT_CSV}`)
  console.log(`Scout JSON: ${SCOUT_JSON}`)

  if (scoutRows.length) {
    const limit = Math.max(scoutRows.length, 1)
    console.log("\n=== Owner-email extraction dry run for new leads ===")
    const output = await runNodeScript(OWNER_EMAIL_SCRIPT, [`--limit=${limit}`])
    console.log(output.split("\n").slice(-18).join("\n"))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
