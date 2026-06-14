/**
 * Build the DealMachine Contacts export queue for on-market cash-review outreach.
 *
 * This does not send. It selects fresh active/pending DealMachine leads that
 * need a Contacts export before the lowball sender can email them.
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")
const LIMIT = Number.parseInt(getArg("limit") || "100", 10)
const MAX_ANCHOR = getArg("max-anchor") ? numberish(getArg("max-anchor")) : 750000
const MARKETS = parseMarkets(getArg("markets") || "")

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

function parseCsvText(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++
      if (field !== "" || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
      }
    } else {
      field += char
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function loadCsv(file) {
  const rows = parseCsvText(fs.readFileSync(file, "utf8"))
  const header = rows[0] || []
  return rows.slice(1).map((values) => Object.fromEntries(header.map((col, index) => [String(col || "").trim(), String(values[index] || "").trim()])))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function numberish(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeAddress(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z]{2})\s+\d{5}(?:-\d{4})?\b/g, "$1")
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "av")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bboulevard\b/g, "blvd")
}

function isOnMarketStatus(value) {
  const status = normalizeMarketSlug(value)
  return ["active", "pending", "for-sale", "listed", "under-contract", "coming-soon"].includes(status)
}

function isInstitutionalNonSellerOwner(value) {
  const owner = String(value || "").trim().toLowerCase()
  return /\b(city of|county of|state of|housing authority|redevelopment authority|department of|national bank|freddie mac|fannie mae|merrill lynch|mortgage|rcaf|csmc|hud)\b/i.test(owner)
}

function loadAlreadyContacted() {
  const sentProperties = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return sentProperties
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-outreach-results-") || !file.endsWith(".json")) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, file), "utf8"))
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (!row?.ok) continue
        const propertyKey = normalizeAddress(row.property_address_full)
        if (propertyKey) sentProperties.add(propertyKey)
      }
    } catch {}
  }
  return sentProperties
}

function baseQueueFiles() {
  if (!fs.existsSync(OUT_DIR)) return []
  const derivedSuffixes = [
    "-ready-now",
    "-atlas-export-needed",
    "-contactable-nurture-stack",
    "-live-problem-stack",
    "-tax-due-now-stack",
    "-preforeclosure-saveable-stack",
    "-preforeclosure-equity-stack",
    "-absentee-problem-stack",
    "-absentee-vacant-stack",
    "-vacant-equity-stack",
    "-contact-first-stack",
    "-dead-asset-stack",
    "-hot-seller-stack",
    "-investor-fatigue-stack",
  ]
  return fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^dealmachine-api-[a-z0-9-]+\.csv$/i.test(name))
    .filter((name) => {
      const market = marketFromFile(path.join(OUT_DIR, name))
      return !derivedSuffixes.some((suffix) => market.endsWith(suffix))
    })
    .filter((name) => !MARKETS.length || MARKETS.some((market) => name === `dealmachine-api-${market}.csv`))
    .map((name) => path.join(OUT_DIR, name))
    .sort()
}

function marketFromFile(file) {
  return path.basename(file).replace(/^dealmachine-api-/i, "").replace(/\.csv$/i, "")
}

function rowAddress(row) {
  return row.property_address_full || [row.property_address_line_1, row.property_city, row.property_state, row.property_zip].filter(Boolean).join(", ")
}

function rowAnchor(row) {
  return numberish(row.current_listing_price) || numberish(row.list_price) || numberish(row.estimated_value_value) || numberish(row.estimated_value)
}

function candidateReason(row, anchor) {
  return [
    `status_${normalizeMarketSlug(row.market_status)}`,
    anchor ? `anchor_${anchor}` : "",
    row.tax_delinquent === "Yes" ? "tax_delinquent" : "",
    row.active_lien === "Yes" ? "active_lien" : "",
    row.preforeclosure_status ? `preforeclosure_${normalizeMarketSlug(row.preforeclosure_status)}` : "",
    row.is_vacant === "true" ? "vacant" : "",
    row.out_of_state_owner === "true" ? "out_of_state_owner" : "",
  ].filter(Boolean).join(" | ")
}

const sentProperties = loadAlreadyContacted()
const seen = new Set()
const candidates = []

for (const file of baseQueueFiles()) {
  const market = marketFromFile(file)
  const rows = loadCsv(file)
  for (const row of rows) {
    const address = rowAddress(row)
    const addressKey = normalizeAddress(address)
    if (!addressKey || seen.has(addressKey) || sentProperties.has(addressKey)) continue
    if (!isOnMarketStatus(row.market_status)) continue
    if (isInstitutionalNonSellerOwner(row.owner_name)) continue
    if (!(String(row.has_email_address).toLowerCase() === "true" || String(row.has_phone_number).toLowerCase() === "true")) continue

    const anchor = rowAnchor(row)
    if (MAX_ANCHOR && anchor && anchor > MAX_ANCHOR) continue

    seen.add(addressKey)
    candidates.push({
      market,
      dealmachine_id: row.dealmachine_id || "",
      property_address_full: address,
      owner_name: row.owner_name || "",
      market_status: row.market_status || "",
      lead_status: row.lead_status || "",
      estimated_value: row.estimated_value || row.estimated_value_value || "",
      cash_review_low: row.cash_review_low || "",
      cash_review_high: row.cash_review_high || "",
      has_email_address: row.has_email_address || "",
      has_phone_number: row.has_phone_number || "",
      atlas_export_needed: row.atlas_export_needed || "",
      distress_score: numberish(row.distress_score),
      date_created: row.date_created || "",
      date_updated: row.date_updated || "",
      strategy_reason: candidateReason(row, anchor),
      queue_file: file,
    })
  }
}

candidates.sort((a, b) => b.distress_score - a.distress_score || a.market.localeCompare(b.market) || a.property_address_full.localeCompare(b.property_address_full))

const selected = candidates.slice(0, LIMIT)
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const outFile = path.join(OUT_DIR, `dealmachine-on-market-lowball-export-needed-${stamp}.csv`)
const summaryFile = path.join(OUT_DIR, `dealmachine-on-market-lowball-export-needed-summary-${stamp}.json`)
const columns = [
  "market",
  "dealmachine_id",
  "property_address_full",
  "owner_name",
  "market_status",
  "lead_status",
  "estimated_value",
  "cash_review_low",
  "cash_review_high",
  "has_email_address",
  "has_phone_number",
  "atlas_export_needed",
  "distress_score",
  "date_created",
  "date_updated",
  "strategy_reason",
  "queue_file",
]

fs.writeFileSync(outFile, [columns.join(","), ...selected.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
const byMarket = selected.reduce((acc, row) => {
  acc[row.market] = (acc[row.market] || 0) + 1
  return acc
}, {})
fs.writeFileSync(
  summaryFile,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    limit: LIMIT,
    maxAnchor: MAX_ANCHOR || null,
    markets: MARKETS.length ? MARKETS : "all base dealmachine-api markets",
    selected: selected.length,
    availableBeforeLimit: candidates.length,
    byMarket,
    output: outFile,
  }, null, 2)
)

console.log("=== DealMachine on-market lowball export-needed queue ===")
console.log(`Selected:          ${selected.length}/${LIMIT}`)
console.log(`Available total:   ${candidates.length}`)
console.log(`Max anchor:        ${MAX_ANCHOR || "none"}`)
console.log(`Markets:           ${MARKETS.length ? MARKETS.join(", ") : "all base dealmachine-api markets"}`)
console.log(`CSV:               ${outFile}`)
console.log(`Summary:           ${summaryFile}`)
for (const [market, count] of Object.entries(byMarket).sort((a, b) => b[1] - a[1])) {
  console.log(`- ${market}: ${count}`)
}
