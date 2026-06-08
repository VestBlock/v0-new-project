/**
 * Export a clean offline CSV from the VestBlock distress-stack master file.
 *
 * Source:
 *   data/distress-leads/MASTER-distress-stack.csv
 *
 * Output:
 *   data/distress-leads/clean-distress-stack-offline.csv
 *
 * Usage:
 *   node scripts/export-clean-distress-stack-csv.mjs
 */

import fs from "node:fs"
import path from "node:path"

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const MASTER = path.join(OUT_DIR, "MASTER-distress-stack.csv")
const CLEAN_CSV = path.join(OUT_DIR, "clean-distress-stack-offline.csv")
const STATE_BY_MARKET = {
  cincinnati: "OH",
  toledo: "OH",
  milwaukee: "WI",
  memphis: "TN",
  detroit: "MI",
}

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8")
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

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}

function cleanOwner(value) {
  return clean(value).replace(/\s*\(mails from [^)]*\)/i, "")
}

function normalizeAddress(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AV")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bBOULEVARD\b/g, "BLVD")
}

function parseMoney(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateMax(a, b) {
  if (!a) return b || ""
  if (!b) return a || ""
  return a >= b ? a : b
}

function dateMin(a, b) {
  if (!a) return b || ""
  if (!b) return a || ""
  return a <= b ? a : b
}

function fullAddress(lead) {
  return [lead.property_address, lead.city, lead.state].filter(Boolean).join(", ")
}

function priorityTier(lead) {
  const hasForeclosure = /^y/i.test(lead.foreclosure_flag || "")
  const hasSevereSignal = /vacant|building|residence|residential|zoning/i.test(lead.distress_signals)
  if (hasForeclosure || lead.delinquent_amount_number >= 10000 || lead.signal_count >= 2) {
    return "A - highest follow-up"
  }
  if (lead.delinquent_amount_number >= 3000 || hasSevereSignal) {
    return "B - strong follow-up"
  }
  return "C - keep warm"
}

function loadCleanLeads() {
  if (!fs.existsSync(MASTER)) {
    throw new Error("No master distress-stack CSV found. Run the distress stack builder first.")
  }

  const rows = parseCsv(MASTER)
  const header = rows[0] || []
  const idx = Object.fromEntries(header.map((col, index) => [col, index]))
  const byProperty = new Map()

  for (const row of rows.slice(1)) {
    if (!row.length) continue

    const market = clean(row[idx.market]).toLowerCase()
    const propertyAddress = clean(row[idx.address])
    const city = clean(row[idx.city])
    if (!market || !propertyAddress) continue

    const state = STATE_BY_MARKET[market] || ""
    const parcel = clean(row[idx.delinquent_parcel])
    const key = [market, normalizeAddress(propertyAddress), parcel || city].join("|")
    const signal = clean(row[idx.violation])
    const delinquentAmountNumber = parseMoney(row[idx.delinquent_amount])

    const existing = byProperty.get(key)
    if (!existing) {
      byProperty.set(key, {
        key,
        market,
        property_address: propertyAddress,
        city,
        state,
        areas: new Set([clean(row[idx.area])].filter(Boolean)),
        owner_name: cleanOwner(row[idx.delinquent_owner]),
        parcel,
        signals: new Set([signal || "Public distress signal"].filter(Boolean)),
        oldest_violation_date: clean(row[idx.violation_date]),
        latest_violation_date: clean(row[idx.violation_date]),
        delinquent_amount_number: delinquentAmountNumber,
        foreclosure_flag: clean(row[idx.foreclosure_flag]),
        first_seen: clean(row[idx.first_seen]),
        last_seen: clean(row[idx.last_seen]),
      })
      continue
    }

    if (signal) existing.signals.add(signal)
    const area = clean(row[idx.area])
    if (area) existing.areas.add(area)
    if (!existing.owner_name) existing.owner_name = cleanOwner(row[idx.delinquent_owner])
    if (!existing.parcel) existing.parcel = parcel
    existing.oldest_violation_date = dateMin(existing.oldest_violation_date, clean(row[idx.violation_date]))
    existing.latest_violation_date = dateMax(existing.latest_violation_date, clean(row[idx.violation_date]))
    existing.first_seen = dateMin(existing.first_seen, clean(row[idx.first_seen]))
    existing.last_seen = dateMax(existing.last_seen, clean(row[idx.last_seen]))
    existing.delinquent_amount_number = Math.max(existing.delinquent_amount_number, delinquentAmountNumber)
    if (!existing.foreclosure_flag) existing.foreclosure_flag = clean(row[idx.foreclosure_flag])
  }

  return [...byProperty.values()]
    .map((lead) => {
      const distressSignals = [...lead.signals].sort().join("; ")
      const output = {
        market: lead.market,
        property_address: lead.property_address,
        city: lead.city,
        state: lead.state,
        full_address: fullAddress(lead),
        owner_name: lead.owner_name,
        parcel: lead.parcel,
        area: [...lead.areas].sort().join("; "),
        signal_count: lead.signals.size,
        distress_signals: distressSignals,
        stack_method: `${distressSignals} + tax delinquency`,
        delinquent_amount: formatMoney(lead.delinquent_amount_number),
        delinquent_amount_number: lead.delinquent_amount_number.toFixed(2),
        foreclosure_flag: lead.foreclosure_flag,
        oldest_violation_date: lead.oldest_violation_date,
        latest_violation_date: lead.latest_violation_date,
        first_seen: lead.first_seen,
        last_seen: lead.last_seen,
        seller_path_options: "Fast cash; creative; novation",
        next_action: "Skip trace owner; verify property/tax/title context; route to acquisitions for seller-path review",
        skip_trace_status: "Needs skip trace",
        owner_phone: "",
        owner_email: "",
        outreach_status: "",
        offline_notes: "",
        source_key: lead.key,
      }
      output.priority_tier = priorityTier(output)
      return output
    })
    .sort((a, b) => {
      const tierSort = a.priority_tier.localeCompare(b.priority_tier)
      if (tierSort) return tierSort
      if (Number(b.delinquent_amount_number) !== Number(a.delinquent_amount_number)) {
        return Number(b.delinquent_amount_number) - Number(a.delinquent_amount_number)
      }
      return a.full_address.localeCompare(b.full_address)
    })
    .map((lead, index) => ({ lead_rank: index + 1, ...lead }))
}

function writeCleanCsv(leads) {
  const columns = [
    "lead_rank",
    "priority_tier",
    "market",
    "property_address",
    "city",
    "state",
    "full_address",
    "owner_name",
    "parcel",
    "area",
    "signal_count",
    "distress_signals",
    "stack_method",
    "delinquent_amount",
    "delinquent_amount_number",
    "foreclosure_flag",
    "oldest_violation_date",
    "latest_violation_date",
    "first_seen",
    "last_seen",
    "seller_path_options",
    "next_action",
    "skip_trace_status",
    "owner_phone",
    "owner_email",
    "outreach_status",
    "offline_notes",
    "source_key",
  ]
  const csv = [columns.join(","), ...leads.map((lead) => columns.map((column) => csvEscape(lead[column])).join(","))]
    .join("\n")

  fs.writeFileSync(CLEAN_CSV, `${csv}\n`)
}

const leads = loadCleanLeads()
writeCleanCsv(leads)

const countsByMarket = leads.reduce((acc, lead) => {
  acc[lead.market] = (acc[lead.market] || 0) + 1
  return acc
}, {})

console.log("VestBlock clean distress-stack CSV")
console.log(`Rows:   ${leads.length}`)
console.log(`Output: ${CLEAN_CSV}`)
console.log(`Markets: ${Object.entries(countsByMarket).map(([market, count]) => `${market}: ${count}`).join(", ")}`)
