/**
 * DealMachine export ingest for VestBlock.
 *
 * After you export a Contacts CSV from the DealMachine website, this script:
 *   1. Finds the most recent DealMachine export in ~/Downloads/
 *   2. Detects which market(s) are in the file
 *   3. Copies it to data/dm-exports/<market>-YYYY-MM-DD.csv
 *   4. Shows a contact summary (emails, phones, DNC flags)
 *   5. Prints the exact command to run outreach
 *
 * DRY RUN by default. Pass --apply to actually copy the file.
 *
 * USAGE:
 *   node scripts/dealmachine-ingest-export.mjs
 *     → Find the latest DM export, show summary, print next command
 *
 *   node scripts/dealmachine-ingest-export.mjs --apply
 *     → Copy the export to data/dm-exports/ and confirm placement
 *
 *   node scripts/dealmachine-ingest-export.mjs --file=/path/to/export.csv --apply
 *     → Use a specific file instead of auto-detecting from ~/Downloads/
 *
 *   node scripts/dealmachine-ingest-export.mjs --market=philadelphia-pa --apply
 *     → Override the detected market name
 *
 * How to export from DealMachine:
 *   1. Log into app.dealmachine.com
 *   2. Build/filter the list in Map or Leads
 *   3. In Leads, Select All → Lead Actions → Export Leads → choose "Contacts"
 *   4. Preferred export settings for outreach: Likely Property Owners, Deduplicate, Scrub DNC, Scrub Landline
 *   5. Save the CSV to ~/Downloads/ (it will have a name like dealmachine-contacts-YYYYMMDD-*.csv)
 *   6. Run this script
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const EXPLICIT_FILE = getArg("file")
const MARKET_OVERRIDE = (getArg("market") || "").trim().toLowerCase()
const DOWNLOADS = path.join(os.homedir(), "Downloads")
const DM_EXPORT_DIR = path.join(process.cwd(), "data", "dm-exports")

// DealMachine exports files with names like:
//   dealmachine-contacts-20260608-123456.csv
//   contacts_export_2026-06-08.csv
//   DealMachine_Contacts_Export_2026-06-08.csv
const DM_EXPORT_PATTERNS = [
  /^dealmachine[-_]contacts[-_]/i,
  /^contacts[-_]export[-_]/i,
  /^dealmachine[-_]export[-_]/i,
  /^dealmachine.*\.csv$/i,
]

// Market detection: city names that appear in property addresses
const CITY_TO_MARKET = {
  "philadelphia": "philadelphia-pa",
  "pittsburgh": "pittsburgh-pa",
  "kansas city": "kansas-city-mo",
  "new orleans": "new-orleans-la",
  "milwaukee": "milwaukee-wi",
  "cincinnati": "cincinnati-oh",
  "toledo": "toledo-oh",
  "detroit": "detroit-mi",
  "columbus": "columbus-oh",
  "macon": "macon-ga",
  "chicago": "chicago-il",
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvText(text) {
  const rows = []
  let row = [], f = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1]
    if (q) { if (c === '"' && n === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(f); f = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && n === "\n") i++; if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = "" } }
    else f += c
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row) }
  return rows
}

function loadCsv(file) {
  const rows = parseCsvText(fs.readFileSync(file, "utf8"))
  const header = rows[0] || []
  return {
    header,
    rows: rows.slice(1).map((r) => Object.fromEntries(header.map((col, i) => [col.trim(), (r[i] || "").trim()]))),
  }
}

// ─── Find latest DM export in ~/Downloads/ ────────────────────────────────────

function findLatestExport() {
  if (EXPLICIT_FILE) {
    const resolved = path.resolve(EXPLICIT_FILE)
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`)
    return resolved
  }

  if (!fs.existsSync(DOWNLOADS)) throw new Error(`Downloads folder not found: ${DOWNLOADS}`)

  const candidates = fs.readdirSync(DOWNLOADS)
    .filter((name) => name.endsWith(".csv") && DM_EXPORT_PATTERNS.some((pat) => pat.test(name)))
    .map((name) => {
      const file = path.join(DOWNLOADS, name)
      return { file, name, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  if (!candidates.length) {
    console.error(`No DealMachine export CSV found in ${DOWNLOADS}`)
    console.error("")
    console.error("How to export from DealMachine:")
    console.error("  1. Go to app.dealmachine.com → Lists → select your list")
    console.error("  2. Click Export → Contacts")
    console.error("  3. Save the CSV to ~/Downloads/")
    console.error("  4. Re-run this script")
    process.exit(1)
  }

  return candidates[0].file
}

// ─── Detect market from city names in the data ────────────────────────────────

function detectMarket(rows, header) {
  if (MARKET_OVERRIDE) return MARKET_OVERRIDE

  // Scan every column value in every row for known city names.
  // DealMachine export columns vary (associated_property_address_full, property_city, etc.)
  // so we search broadly rather than relying on exact column names.
  const cityCounts = {}
  const sampleRows = rows.slice(0, Math.min(rows.length, 500)) // sample for speed

  for (const row of sampleRows) {
    const allValues = Object.values(row).join(" ").toLowerCase()
    for (const [city, market] of Object.entries(CITY_TO_MARKET)) {
      // Use word-boundary style match to avoid "kansas city" matching "city" alone
      if (allValues.includes(` ${city}`) || allValues.includes(`,${city}`) ||
          allValues.startsWith(city) || allValues.includes(`\t${city}`)) {
        cityCounts[market] = (cityCounts[market] || 0) + 1
      }
    }
  }

  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])
  if (!sorted.length) return null

  // If one market dominates (>70%), use it
  const total = Object.values(cityCounts).reduce((s, n) => s + n, 0)
  if (sorted[0][1] / total >= 0.70) return sorted[0][0]

  // Multiple markets — use the top one but warn
  return sorted[0][0]
}

// ─── Summarize the contact data ───────────────────────────────────────────────

function summarize(rows, header) {
  const emailCols = header.filter((h) => /email/i.test(h))
  const phoneCols = header.filter((h) => /^phone_\d+$/i.test(h))
  const dncCols = header.filter((h) => /do.not.call|dnc/i.test(h))
  const addrCol =
    header.find((h) => /associated_property_address_full/i.test(h)) ||
    header.find((h) => /property.*address.*full/i.test(h)) ||
    header.find((h) => /associated.*address/i.test(h)) ||
    header.find((h) => /address/i.test(h)) ||
    ""

  let withEmail = 0, withPhone = 0, withBoth = 0, dncCount = 0
  const cities = new Set()

  for (const row of rows) {
    const emails = emailCols.map((c) => row[c]).filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    const phones = phoneCols.map((c) => row[c]).filter((v) => v && v.replace(/\D/g, "").length >= 10)
    const dnc = dncCols.some((c) => /yes|true|1/i.test(row[c] || ""))
    if (emails.length) withEmail++
    if (phones.length) withPhone++
    if (emails.length && phones.length) withBoth++
    if (dnc) dncCount++
    if (addrCol) {
      const addr = row[addrCol] || ""
      const cityMatch = addr.match(/,\s*([^,]+),\s*[A-Z]{2}/)
      if (cityMatch) cities.add(cityMatch[1].trim())
    }
  }

  return { total: rows.length, withEmail, withPhone, withBoth, dncCount, cities: [...cities].slice(0, 6), emailCols, phoneCols }
}

function localDateStamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(DM_EXPORT_DIR, { recursive: true })

  const sourceFile = findLatestExport()
  const sourceName = path.basename(sourceFile)
  const { header, rows } = loadCsv(sourceFile)

  if (!rows.length) {
    console.error(`Export file is empty or has no data rows: ${sourceFile}`)
    process.exit(1)
  }

  // Validate it's actually a DealMachine Contacts export
  const hasContactCols = header.some((h) => /email|phone/i.test(h))
  const hasAddressCols = header.some((h) => /address/i.test(h))
  if (!hasContactCols || !hasAddressCols) {
    console.error("This file doesn't look like a DealMachine Contacts export.")
    console.error("Make sure you exported 'Contacts' (not just 'Leads') from DealMachine.")
    console.error(`Columns found: ${header.slice(0, 8).join(", ")}`)
    process.exit(1)
  }

  const stats = summarize(rows, header)
  const detectedMarket = detectMarket(rows, header)
  const dateStr = localDateStamp()
  const market = detectedMarket || "unknown-market"
  const destName = `${market}-${dateStr}.csv`
  const destFile = path.join(DM_EXPORT_DIR, destName)

  console.log("=== DealMachine export ingest ===")
  console.log(`Source:       ${sourceFile}`)
  console.log(`Destination:  ${destFile}`)
  console.log(`Market:       ${detectedMarket || "⚠ could not detect — use --market=<slug>"}`)
  console.log("")
  console.log("Contact summary:")
  console.log(`  Total rows:       ${stats.total}`)
  console.log(`  With email:       ${stats.withEmail} (${Math.round((stats.withEmail / stats.total) * 100)}%)`)
  console.log(`  With phone:       ${stats.withPhone} (${Math.round((stats.withPhone / stats.total) * 100)}%)`)
  console.log(`  With both:        ${stats.withBoth}`)
  console.log(`  DNC flagged:      ${stats.dncCount}`)
  if (stats.cities.length) console.log(`  Cities detected:  ${stats.cities.join(", ")}`)
  console.log(`  Email columns:    ${stats.emailCols.join(", ")}`)
  console.log(`  Phone columns:    ${stats.phoneCols.join(", ")}`)

  if (!APPLY) {
    console.log("")
    console.log("DRY RUN — no files copied. Re-run with --apply to place the export:")
    console.log(`  node scripts/dealmachine-ingest-export.mjs --apply`)
    if (!detectedMarket) {
      console.log(`  node scripts/dealmachine-ingest-export.mjs --market=your-city-state --apply`)
    }
    return
  }

  // Copy the file
  fs.copyFileSync(sourceFile, destFile)
  console.log(`\n✓ Copied to ${destFile}`)
  console.log("")
  console.log("=== Next: run outreach ===")
  console.log("")
  console.log("Preview drafts (no emails sent):")
  console.log(`  node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \\`)
  console.log(`    --market=${market} \\`)
  console.log(`    --export-csv=data/dm-exports/${destName} \\`)
  console.log(`    --limit=150`)
  console.log("")
  console.log("Send (after reviewing the draft .txt file):")
  console.log(`  node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \\`)
  console.log(`    --market=${market} \\`)
  console.log(`    --export-csv=data/dm-exports/${destName} \\`)
  console.log(`    --limit=150 --send`)
  console.log("")
  console.log("Phone queue (DNC-safe mobile numbers only):")
  console.log("  The phone queue CSV is written automatically alongside email drafts.")
  console.log("  File: data/distress-leads/dealmachine-export-phone-queue-<timestamp>.csv")
}

main()
