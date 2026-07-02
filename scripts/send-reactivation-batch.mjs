#!/usr/bin/env node
// Reactivation batch sender: delivers the VERIFIED second-touch queue through Resend
// with the same guardrails as the primary seller sender.
//
// Guardrails (all enforced before any send):
//   - only reads *-verified.csv files (output of outreach:verify-emails)
//   - re-checks suppressions and the reply log at send time (things change between staging and sending)
//   - skips anyone already sent a reactivation (tmp/outreach/reactivation-results-*.json)
//   - appends the CAN-SPAM footer (opt-out line + OUTREACH_MAILING_ADDRESS) to every email
//   - preview by default; --live required for real sends; hard --limit cap (default 50)
//
// Results land in tmp/outreach/reactivation-results-<stamp>.json, which the campaign
// ledger parses — so these sends show up in the command center and lane stats.
//
// Usage:
//   npm run outreach:send-reactivation                    # preview latest verified batch
//   npm run outreach:send-reactivation -- --limit=60
//   npm run outreach:send-reactivation:live -- --limit=50 # real sends

import fs from "node:fs"
import path from "node:path"
import { Resend } from "resend"

const ROOT = process.cwd()
const REACTIVATION_DIR = path.join(ROOT, "data", "operating-loops", "reactivation")
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REPLY_LOG_PATH = path.join(ROOT, "data", "operating-loops", "reply-log.jsonl")

const args = process.argv.slice(2)
const LIVE = args.includes("--live")
const argValue = (name, fallback) => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const LIMIT = Number(argValue("limit", 50))
const CSV_ARG = argValue("csv", "")
const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || process.env.FROM_EMAIL || "acquisitions@vestblock.io"

function mailingAddress() {
  return (
    process.env.OUTREACH_MAILING_ADDRESS ||
    process.env.BUSINESS_MAILING_ADDRESS ||
    process.env.COMPANY_MAILING_ADDRESS ||
    ""
  ).trim()
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else inQuotes = false
      } else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ",") { row.push(field); field = "" }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(field); field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += char
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row) }
  return rows
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  } catch { return [] }
}

function suppressedEmails() {
  try {
    const data = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, "utf8"))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
    return new Set(rows.map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))
  } catch { return new Set() }
}

function alreadyReactivated() {
  const sent = new Set()
  let names = []
  try { names = fs.readdirSync(OUTREACH_DIR) } catch { return sent }
  for (const name of names) {
    if (!name.startsWith("reactivation-results-") || !name.endsWith(".json")) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, name), "utf8"))
      for (const row of rows || []) {
        const email = String(row.email || "").trim().toLowerCase()
        if (email && row.ok) sent.add(email)
      }
    } catch { /* skip */ }
  }
  return sent
}

// ---- Load the verified batch ------------------------------------------------
const csvPath = CSV_ARG
  ? path.resolve(ROOT, CSV_ARG)
  : (() => {
      let names = []
      try { names = fs.readdirSync(REACTIVATION_DIR) } catch { /* none */ }
      const latest = names.filter((n) => n.startsWith("reactivation-queue-") && n.endsWith("-verified.csv")).sort().pop()
      return latest ? path.join(REACTIVATION_DIR, latest) : null
    })()

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("No verified reactivation CSV found. Run outreach:reactivation-queue then outreach:verify-emails first.")
  process.exit(1)
}
if (!csvPath.endsWith("-verified.csv") && !CSV_ARG) {
  console.error("Refusing to send an unverified batch.")
  process.exit(1)
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"))
const header = rows[0].map((c) => c.trim().toLowerCase())
const col = (name) => header.indexOf(name)
const idx = { email: col("email"), strategy: col("strategy"), market: col("market"), address: col("property_address"), subject: col("subject"), body: col("body") }
if (idx.email === -1 || idx.subject === -1 || idx.body === -1) {
  console.error(`CSV missing required columns (email/subject/body). Columns: ${header.join(", ")}`)
  process.exit(1)
}

// ---- Guardrails ---------------------------------------------------------------
const address = mailingAddress()
if (LIVE && !address) {
  console.error("Missing OUTREACH_MAILING_ADDRESS / BUSINESS_MAILING_ADDRESS — required for live sends (CAN-SPAM).")
  process.exit(1)
}
if (LIVE && !process.env.RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY — cannot live send.")
  process.exit(1)
}

const suppressed = suppressedEmails()
const replied = new Set(readJsonl(REPLY_LOG_PATH).map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))
const sentBefore = alreadyReactivated()

const skipped = { suppressed: 0, replied: 0, alreadySent: 0, duplicate: 0 }
const seen = new Set()
const queue = []
for (const row of rows.slice(1)) {
  if (queue.length >= LIMIT) break
  const email = String(row[idx.email] || "").trim().toLowerCase()
  if (!email) continue
  if (seen.has(email)) { skipped.duplicate += 1; continue }
  seen.add(email)
  if (suppressed.has(email)) { skipped.suppressed += 1; continue }
  if (replied.has(email)) { skipped.replied += 1; continue }
  if (sentBefore.has(email)) { skipped.alreadySent += 1; continue }
  queue.push({
    email,
    strategy: idx.strategy !== -1 ? String(row[idx.strategy] || "").trim() : "reactivation",
    market: idx.market !== -1 ? String(row[idx.market] || "").trim() : null,
    property_address: idx.address !== -1 ? String(row[idx.address] || "").trim() : null,
    subject: String(row[idx.subject] || "").trim(),
    body: String(row[idx.body] || "").trim(),
  })
}

const footerText = [
  "",
  "—",
  'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
  address ? `VestBlock · ${address}` : "",
].filter(Boolean).join("\n")

console.log(`Reactivation sender ${LIVE ? "[LIVE]" : "[preview]"} — batch: ${path.basename(csvPath)}`)
console.log(`  sendable: ${queue.length} (cap ${LIMIT}) · skipped -> suppressed: ${skipped.suppressed}, replied: ${skipped.replied}, already sent: ${skipped.alreadySent}, duplicate: ${skipped.duplicate}`)

if (!LIVE) {
  for (const item of queue.slice(0, 5)) {
    console.log(`\n  To: ${item.email}  [${item.strategy} / ${item.market || "?"}]`)
    console.log(`  Subject: ${item.subject}`)
    console.log(`  ${item.body.split("\n")[2] || item.body.slice(0, 90)}`)
  }
  if (queue.length > 5) console.log(`\n  ...and ${queue.length - 5} more.`)
  console.log(`\nPreview only. Send for real with: npm run outreach:send-reactivation:live -- --limit=${Math.min(LIMIT, queue.length)}`)
  process.exit(0)
}

// ---- Live send ------------------------------------------------------------------
const resend = new Resend(process.env.RESEND_API_KEY)
const results = []
let sentCount = 0
for (const item of queue) {
  const text = `${item.body}\n${footerText}\n`
  try {
    const { data, error } = await resend.emails.send({
      from: `VestBlock Acquisitions <${FROM_EMAIL}>`,
      to: item.email,
      subject: item.subject,
      text,
    })
    if (error) throw new Error(error.message || JSON.stringify(error))
    sentCount += 1
    results.push({ ok: true, email: item.email, strategy: item.strategy, market: item.market, property_address: item.property_address, id: data?.id || null })
    console.log(`  sent ${sentCount}/${queue.length}: ${item.email}`)
  } catch (error) {
    results.push({ ok: false, email: item.email, strategy: item.strategy, market: item.market, property_address: item.property_address, error: String(error?.message || error) })
    console.error(`  FAILED ${item.email}: ${error?.message || error}`)
  }
  await new Promise((resolve) => setTimeout(resolve, 400))
}

fs.mkdirSync(OUTREACH_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const resultsPath = path.join(OUTREACH_DIR, `reactivation-results-${stamp}.json`)
fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8")
console.log(`\nSent ${sentCount}/${queue.length}. Results: ${resultsPath}`)
console.log("These sends enter the campaign ledger on the next command-center load / autopilot run.")
console.log("Log every reply with outreach:log-reply (or let reply-sync catch it).")
