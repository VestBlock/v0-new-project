#!/usr/bin/env node
// Direct-mail batch builder: turns no-email DealMachine contacts into a mail-ready list.
//
// The email lanes can only reach owners with usable addresses. Every export row with a
// mailing address but NO usable email is currently unreachable — this script stages them
// for a physical mail test (DealMachine mail engine or any postcard vendor). Mail is the
// proven channel for distressed owners and is compliant for DNC/no-email records.
//
// Review-first: the script writes a CSV and never sends anything. Rerun with --commit to
// record the batch into the local mail ledger so future runs exclude the same addresses.
//
// Usage:
//   npm run outreach:direct-mail-batch                                 # stage 100 from priority lanes
//   npm run outreach:direct-mail-batch -- --limit=150 --strategies=tax-code-stack,vacant-equity
//   npm run outreach:direct-mail-batch -- --commit                     # also record batch in ledger

import fs from "node:fs"
import path from "node:path"
import { getEmailQualityIssue } from "./shared-email-quality.mjs"

const ROOT = process.cwd()
const EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const OUT_DIR = path.join(ROOT, "data", "operating-loops", "direct-mail")
const LEDGER_PATH = path.join(OUT_DIR, "direct-mail-ledger.json")

const DEFAULT_STRATEGIES = [
  "tax-code-stack",
  "vacant-equity",
  "lien-equity",
  "preforeclosure-equity",
  "portfolio-landlord",
  "tax-remote-equity-rotation",
  "tax-oos-equity-stack",
]

function arg(name, fallback = "") {
  const prefix = `--${name}=`
  const hit = process.argv.filter((piece) => piece.startsWith(prefix)).pop()
  return hit ? hit.slice(prefix.length) : fallback
}
const LIMIT = Number(arg("limit", 100))
const PER_MARKET = Number(arg("per-market", 40))
const STRATEGIES = arg("strategies", DEFAULT_STRATEGIES.join(","))
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
const COMMIT = process.argv.includes("--commit")

// Minimal CSV parser handling quoted fields.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else inQuotes = false
      } else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += char
  }
  if (field !== "" || row.length) {
    row.push(field)
    if (row.length > 1 || row[0] !== "") rows.push(row)
  }
  return rows
}

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`

function listExportFiles() {
  const files = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (name.endsWith(".csv")) files.push(full)
    }
  }
  if (fs.existsSync(EXPORT_DIR)) walk(EXPORT_DIR)
  return files
}

function fileStrategy(file) {
  const base = path.basename(file).toLowerCase()
  return STRATEGIES.find((strategy) => base.includes(strategy)) || null
}

function fileMarket(file) {
  // e.g. direct-kansas-city-mo-tax-code-stack-... -> kansas-city-mo
  const base = path.basename(file).toLowerCase().replace(/^direct-/, "").replace(/^vestblock-/, "")
  const match = base.match(/^([a-z-]+-(?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy))-/)
  return match ? match[1] : "unknown"
}

function usableEmail(...emails) {
  return emails.some((email) => String(email || "").trim() && getEmailQualityIssue(email) === null)
}

function loadLedger() {
  try {
    const data = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"))
    return new Set(Array.isArray(data.mailedKeys) ? data.mailedKeys : [])
  } catch {
    return new Set()
  }
}

const files = listExportFiles().filter((file) => fileStrategy(file))
if (!files.length) {
  console.error(`No DealMachine export CSVs matched strategies [${STRATEGIES.join(", ")}] in ${EXPORT_DIR}`)
  process.exit(1)
}

const mailedKeys = loadLedger()
const seen = new Set()
const candidates = []
const skipped = { hasEmail: 0, missingMailingAddress: 0, missingName: 0, duplicate: 0, alreadyMailed: 0 }

for (const file of files) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"))
  if (rows.length < 2) continue
  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const col = (name) => header.indexOf(name)
  const idx = {
    property: col("associated_property_address_full"),
    first: col("first_name"),
    last: col("last_name"),
    mail: col("primary_mailing_address"),
    mailCity: col("primary_mailing_city"),
    mailState: col("primary_mailing_state"),
    mailZip: col("primary_mailing_zip"),
    email1: col("email_address_1"),
    email2: col("email_address_2"),
    email3: col("email_address_3"),
  }
  if (idx.mail === -1 || idx.property === -1) continue

  const strategy = fileStrategy(file)
  const market = fileMarket(file)

  for (const row of rows.slice(1)) {
    const firstName = String(row[idx.first] || "").trim()
    const lastName = String(row[idx.last] || "").trim()
    const mailAddress = String(row[idx.mail] || "").trim()
    const mailCity = String(row[idx.mailCity] || "").trim()
    const mailState = String(row[idx.mailState] || "").trim()
    const mailZip = String(row[idx.mailZip] || "").trim()
    const property = String(row[idx.property] || "").trim()

    if (usableEmail(row[idx.email1], row[idx.email2], row[idx.email3])) {
      skipped.hasEmail += 1
      continue
    }
    if (!mailAddress || !mailCity || !mailState || !mailZip) {
      skipped.missingMailingAddress += 1
      continue
    }
    if (!firstName && !lastName) {
      skipped.missingName += 1
      continue
    }

    const key = `${mailAddress}|${mailZip}|${lastName}`.toLowerCase()
    if (seen.has(key)) {
      skipped.duplicate += 1
      continue
    }
    if (mailedKeys.has(key)) {
      skipped.alreadyMailed += 1
      continue
    }
    seen.add(key)
    candidates.push({
      key,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      mailAddress,
      mailCity,
      mailState,
      mailZip,
      property,
      market,
      strategy,
      sourceFile: path.basename(file),
    })
  }
}

// Balance across markets, cap total.
const perMarketCount = new Map()
const batch = []
for (const candidate of candidates) {
  if (batch.length >= LIMIT) break
  const count = perMarketCount.get(candidate.market) || 0
  if (count >= PER_MARKET) continue
  perMarketCount.set(candidate.market, count + 1)
  batch.push(candidate)
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
fs.mkdirSync(OUT_DIR, { recursive: true })
const csvPath = path.join(OUT_DIR, `direct-mail-batch-${stamp}.csv`)
const header = ["full_name", "mailing_address", "mailing_city", "mailing_state", "mailing_zip", "property_address", "market", "strategy", "source_file"]
fs.writeFileSync(
  csvPath,
  `${[header.join(","), ...batch.map((row) =>
    [row.fullName, row.mailAddress, row.mailCity, row.mailState, row.mailZip, row.property, row.market, row.strategy, row.sourceFile]
      .map(csvEscape)
      .join(",")
  )].join("\n")}\n`,
  "utf8"
)

if (COMMIT && batch.length) {
  const merged = new Set([...mailedKeys, ...batch.map((row) => row.key)])
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify({ updatedAt: new Date().toISOString(), mailedKeys: [...merged] }, null, 2)}\n`, "utf8")
}

console.log(`Direct-mail batch staged (nothing sent):`)
console.log(`  candidates: ${candidates.length} no-email owners across ${files.length} export files`)
console.log(`  staged: ${batch.length} (cap ${LIMIT}, ${PER_MARKET}/market)${COMMIT ? " — recorded in mail ledger" : ""}`)
console.log(`  skipped -> has email: ${skipped.hasEmail}, no mailing addr: ${skipped.missingMailingAddress}, no name: ${skipped.missingName}, duplicate: ${skipped.duplicate}, already mailed: ${skipped.alreadyMailed}`)
for (const [market, count] of [...perMarketCount.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${market}: ${count}`)
console.log(`  CSV: ${csvPath}`)
console.log(`Next: upload the CSV to the DealMachine mail engine (or postcard vendor), then rerun with --commit to lock these addresses into the ledger.`)
