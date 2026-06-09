/**
 * DealMachine market harvest for VestBlock.
 *
 * Pulls leads directly from the DealMachine API, filters them by market, and
 * exports clean CSV/JSON files for outbound review.
 *
 * This is API-first by design:
 * - find city/state coverage already living in DealMachine
 * - prioritize leads with usable distress + contactability signals
 * - export one stable list for email/text follow-up
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-market-harvest.mjs --markets="Milwaukee,WI|Toledo,OH"
 *   node --env-file=.env.local scripts/dealmachine-market-harvest.mjs --top-markets=5 --contactable-only
 *   node --env-file=.env.local scripts/dealmachine-market-harvest.mjs --markets="Milwaukee,WI" --contactable-only --stacked
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = "Milwaukee,WI|Toledo,OH|Cincinnati,OH|Detroit,MI|Macon,GA"
const MAX_PAGES = getArg("pages") ? Number.parseInt(getArg("pages"), 10) : 50
const PAGE_SIZE = getArg("page-size") ? Number.parseInt(getArg("page-size"), 10) : 100
const CONTACTABLE_ONLY = args.includes("--contactable-only")
const STACKED = args.includes("--stacked") || args.includes("--stacks")
const TOP_MARKETS = getArg("top-markets") ? Number.parseInt(getArg("top-markets"), 10) : 0
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const TMP_DIR = path.join(process.cwd(), "tmp")
const API_BASE = "https://api.dealmachine.com/public/v1"

function env(name) {
  return String(process.env[name] || "").trim()
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normalizeState(value) {
  return String(value || "").trim().toUpperCase()
}

function parseMarkets(input) {
  return String(input || DEFAULT_MARKETS)
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [city, state] = chunk.split(",").map((part) => part.trim())
      return {
        raw: chunk,
        city,
        state: normalizeState(state),
        key: `${normalizeText(city)}|${normalizeState(state)}`,
      }
    })
    .filter((market) => market.city && market.state)
}

function marketFromLead(lead) {
  return {
    city: String(lead.property_address_city || "").trim(),
    state: normalizeState(lead.property_address_state),
  }
}

function dedupeMarkets(markets) {
  const seen = new Set()
  return markets.filter((market) => {
    const key = `${normalizeText(market.city)}|${normalizeState(market.state)}`
    if (!market.city || !market.state || seen.has(key)) return false
    seen.add(key)
    market.key = key
    market.raw = `${market.city},${market.state}`
    return true
  })
}

function deriveTopMarkets(leads, limit) {
  const counts = new Map()
  for (const lead of leads) {
    const market = marketFromLead(lead)
    if (!market.city || !market.state) continue
    const key = `${normalizeText(market.city)}|${market.state}`
    const current = counts.get(key) || { ...market, key, raw: `${market.city},${market.state}`, count: 0 }
    current.count += 1
    counts.set(key, current)
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
    .slice(0, limit)
    .map(({ count, ...market }) => market)
}

function numberish(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const label = typeof value === "object" && value ? value.label : value
  const n = Number(String(label || "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function labelish(value) {
  if (value == null) return ""
  if (typeof value === "object") {
    if ("label" in value) return String(value.label || "")
    if ("value" in value) return String(value.value || "")
  }
  return String(value)
}

function boolish(value) {
  return value === true || String(value || "").toLowerCase() === "yes"
}

function isRecentLead(lead, cutoff = "2026-01-01") {
  const created = String(lead.date_created || "").slice(0, 10)
  return Boolean(created) && created >= cutoff
}

function isBankOwnedStatus(value) {
  return labelish(value).toLowerCase().includes("bank owned")
}

function isSellerDeadStatus(value) {
  const label = labelish(value).toLowerCase()
  return label === "sold" || label === "fail"
}

function scoreLead(lead) {
  let score = 0
  if (lead.has_email_address) score += 8
  if (lead.has_phone_number) score += 8
  if (boolish(lead.TaxDelinquent)) score += 20
  if (numberish(lead.PastDueAmount) > 0) score += 20
  if (boolish(lead.active_lien)) score += 14
  if (boolish(lead.is_vacant)) score += 12
  if (boolish(lead.out_of_state_owner)) score += 8
  if (boolish(lead.is_corporate_owner)) score += 4
  if (labelish(lead.preforeclosure_status).toLowerCase() === "in preforeclosure") score += 24
  if (numberish(lead.equity_percent) >= 25 || numberish(lead.equity_amount) >= 40000) score += 10
  if (isRecentLead(lead)) score += 10
  if (isBankOwnedStatus(lead.preforeclosure_status)) score -= 80
  if (isSellerDeadStatus(lead.market_status)) score -= 80
  return score
}

function roundToNearest(value, nearest = 5000) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return Math.round(value / nearest) * nearest
}

function moneyLabel(value) {
  if (!Number.isFinite(value) || value <= 0) return "unknown"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function buildDealFit({ lead, estimatedValueValue, equityAmountValue, equityPercentValue, rentEstimateValue, taxDelinquent, activeLien, preforeclosure, pastDueAmountValue }) {
  const paths = []
  const vacant = boolish(lead.is_vacant)
  const outOfStateOwner = boolish(lead.out_of_state_owner)
  const liveProblemSignals = [
    boolish(taxDelinquent) || pastDueAmountValue > 0,
    boolish(activeLien),
    preforeclosure === "In Preforeclosure",
    vacant,
    outOfStateOwner,
  ].filter(Boolean).length

  const cashFactor =
    preforeclosure === "In Preforeclosure" || vacant
      ? 0.62
      : liveProblemSignals >= 2
        ? 0.68
        : 0.72

  const cashReviewHigh = roundToNearest(estimatedValueValue * cashFactor)
  const cashReviewLow = cashReviewHigh ? roundToNearest(cashReviewHigh * 0.9) : ""
  const estimatedLtv =
    estimatedValueValue > 0 && equityAmountValue > 0
      ? Math.round(((estimatedValueValue - equityAmountValue) / estimatedValueValue) * 1000) / 10
      : ""

  if (preforeclosure === "In Preforeclosure" || vacant || liveProblemSignals >= 2) paths.push("fast_cash")
  if ((Number.isFinite(estimatedLtv) && estimatedLtv >= 72) || (equityAmountValue > 0 && equityAmountValue < 30000)) paths.push("creative_structure")
  if (equityPercentValue >= 35 && !vacant && preforeclosure !== "In Preforeclosure") paths.push("seller_options_review")
  if (rentEstimateValue > 0 || outOfStateOwner) paths.push("rental_hold")
  paths.push("manual_review")

  const uniquePaths = [...new Set(paths)]
  const address = lead.property_address_full || "unknown address"
  return {
    rough_value_source: estimatedValueValue ? "dealmachine_estimated_value" : "needs_review",
    rent_estimate: rentEstimateValue ? String(rentEstimateValue) : "",
    cash_review_low: cashReviewLow,
    cash_review_high: cashReviewHigh,
    estimated_ltv: estimatedLtv,
    suggested_exit_paths: uniquePaths.join(" | "),
    buyer_packet_summary: [
      `Address: ${address}`,
      `rough value: ${moneyLabel(estimatedValueValue)}`,
      cashReviewLow && cashReviewHigh ? `cash review band: ${moneyLabel(cashReviewLow)} to ${moneyLabel(cashReviewHigh)}` : "cash review band: needs comps",
      `signals: ${[
        boolish(taxDelinquent) || pastDueAmountValue > 0 ? "tax delinquency" : "",
        boolish(activeLien) ? "lien" : "",
        preforeclosure === "In Preforeclosure" ? "preforeclosure" : "",
        vacant ? "vacant" : "",
        outOfStateOwner ? "out-of-state owner" : "",
      ].filter(Boolean).join(", ") || "needs review"}`,
    ].join("; "),
    seller_review_summary: [
      `Address: ${address}`,
      `rough value: ${moneyLabel(estimatedValueValue)}`,
      `rough rent: ${moneyLabel(rentEstimateValue)}`,
      estimatedLtv !== "" ? `estimated LTV: ${estimatedLtv}%` : "estimated LTV: needs debt details",
      `seller paths: ${uniquePaths.join(", ")}`,
    ].join("; "),
    deal_fit_notes:
      "Internal rough review only. Verify title, comps, condition, occupancy, debt, and owner authorization before making offers or routing to partners.",
  }
}

const STACK_DEFINITIONS = [
  {
    key: "live-problem-stack",
    label: "recent + live seller problem + contactable",
    match: (row) => {
      if (!row.contactable || row.market_status === "Sold" || row.market_status === "Fail" || row.preforeclosure_status === "Bank Owned") return false
      if (String(row.date_created || "").slice(0, 10) < "2026-01-01") return false
      const signals = [
        boolish(row.tax_delinquent) || row.past_due_amount_value > 0,
        boolish(row.active_lien),
        row.preforeclosure_status === "In Preforeclosure",
        row.is_vacant === "true",
        row.out_of_state_owner === "true",
      ].filter(Boolean).length
      return row.contactable && signals >= 2
    },
  },
  {
    key: "tax-due-now-stack",
    label: "current tax delinquency + equity/contact",
    match: (row) =>
      row.contactable &&
      row.market_status !== "Sold" &&
      row.market_status !== "Fail" &&
      row.preforeclosure_status !== "Bank Owned" &&
      boolish(row.tax_delinquent) &&
      (row.tax_delinquent_year === "2025" || row.past_due_amount_value > 0) &&
      (row.equity_percent_value >= 20 || row.equity_amount_value >= 30000),
  },
  {
    key: "preforeclosure-saveable-stack",
    label: "in preforeclosure + equity + not bank-owned",
    match: (row) =>
      row.contactable &&
      row.market_status !== "Sold" &&
      row.market_status !== "Fail" &&
      row.preforeclosure_status === "In Preforeclosure" &&
      (row.equity_percent_value >= 20 || row.equity_amount_value >= 30000),
  },
  {
    key: "absentee-problem-stack",
    label: "absentee owner + active property problem",
    match: (row) =>
      row.contactable &&
      row.market_status !== "Sold" &&
      row.market_status !== "Fail" &&
      row.preforeclosure_status !== "Bank Owned" &&
      row.out_of_state_owner === "true" &&
      (boolish(row.tax_delinquent) || boolish(row.active_lien) || row.is_vacant === "true" || row.preforeclosure_status === "In Preforeclosure"),
  },
  {
    key: "vacant-equity-stack",
    label: "vacant + equity + not sold/bank-owned",
    match: (row) =>
      row.contactable &&
      row.market_status !== "Sold" &&
      row.market_status !== "Fail" &&
      row.preforeclosure_status !== "Bank Owned" &&
      row.is_vacant === "true" &&
      (row.equity_percent_value >= 25 || row.equity_amount_value >= 40000),
  },
  {
    key: "contactable-nurture-stack",
    label: "contactable but weak/live-intent unproven",
    match: (row) =>
      row.has_email_address === "true" &&
      row.has_phone_number === "true" &&
      row.market_status !== "Sold" &&
      row.market_status !== "Fail" &&
      row.preforeclosure_status !== "Bank Owned" &&
      row.distress_score >= 35,
  },
]

function buildRow(lead, market) {
  const emails = Array.isArray(lead.email_addresses) ? lead.email_addresses : []
  const phones = Array.isArray(lead.phone_numbers) ? lead.phone_numbers : []
  const surfacedEmails = emails
    .map((entry) => {
      if (typeof entry === "string") return entry.trim().toLowerCase()
      if (!entry || typeof entry !== "object") return ""
      return String(entry.email || entry.email_address || entry.address || entry.value || "").trim().toLowerCase()
    })
    .filter(Boolean)
  const surfacedPhones = phones
    .map((entry) => {
      if (typeof entry === "string") return { number: entry.trim(), dnc: "", type: "" }
      if (!entry || typeof entry !== "object") return { number: "", dnc: "", type: "" }
      return {
        number: String(entry.number || entry.phone || entry.phone_number || entry.value || "").trim(),
        dnc: String(entry.do_not_call || entry.dnc || entry.phone_do_not_call || "").trim(),
        type: String(entry.type || entry.phone_type || "").trim(),
      }
    })
    .filter((entry) => entry.number)
  const exportNeeded =
    ((lead.has_email_address && surfacedEmails.length === 0) || (lead.has_phone_number && surfacedPhones.length === 0)) ? "true" : "false"
  const taxDelinquent = labelish(lead.TaxDelinquent)
  const activeLien = labelish(lead.active_lien)
  const preforeclosure = labelish(lead.preforeclosure_status)
  const equityAmountValue = numberish(lead.equity_amount)
  const equityPercentValue = numberish(lead.equity_percent)
  const pastDueAmountValue = numberish(lead.PastDueAmount)
  const estimatedValueValue = numberish(lead.EstimatedValue || lead.estimated_value || lead.current_listing_price)
  const rentEstimateValue = numberish(lead.RentEstimate || lead.estimated_rent || lead.rent_estimate || lead.monthly_rent)
  const hasEmail = lead.has_email_address ? "true" : "false"
  const hasPhone = lead.has_phone_number ? "true" : "false"
  const dealFit = buildDealFit({
    lead,
    estimatedValueValue,
    equityAmountValue,
    equityPercentValue,
    rentEstimateValue,
    taxDelinquent,
    activeLien,
    preforeclosure,
    pastDueAmountValue,
  })

  return {
    market_city: market.city,
    market_state: market.state,
    dealmachine_id: lead.id,
    property_address_full: lead.property_address_full || "",
    property_address_line_1: lead.property_address_line_1 || "",
    property_city: lead.property_address_city || "",
    property_state: lead.property_address_state || "",
    property_zip: lead.property_address_zipcode || "",
    owner_name: lead.owner_1_name || lead.likely_owner || "",
    owner_city: lead.owner_address_city || "",
    owner_state: lead.owner_address_state || "",
    estimated_value: labelish(lead.EstimatedValue || lead.estimated_value || lead.current_listing_price),
    estimated_value_value: estimatedValueValue,
    rough_value_source: dealFit.rough_value_source,
    rent_estimate: dealFit.rent_estimate,
    equity_amount: labelish(lead.equity_amount),
    equity_percent: labelish(lead.equity_percent),
    equity_amount_value: equityAmountValue,
    equity_percent_value: equityPercentValue,
    estimated_ltv: dealFit.estimated_ltv,
    cash_review_low: dealFit.cash_review_low,
    cash_review_high: dealFit.cash_review_high,
    suggested_exit_paths: dealFit.suggested_exit_paths,
    buyer_packet_summary: dealFit.buyer_packet_summary,
    seller_review_summary: dealFit.seller_review_summary,
    deal_fit_notes: dealFit.deal_fit_notes,
    tax_delinquent: taxDelinquent,
    tax_delinquent_year: labelish(lead.TaxDelinquentYear),
    past_due_amount: labelish(lead.PastDueAmount),
    past_due_amount_value: pastDueAmountValue,
    active_lien: activeLien,
    preforeclosure_status: preforeclosure,
    is_vacant: boolish(lead.is_vacant) ? "true" : "false",
    out_of_state_owner: boolish(lead.out_of_state_owner) ? "true" : "false",
    is_corporate_owner: boolish(lead.is_corporate_owner) ? "true" : "false",
    has_email_address: hasEmail,
    has_phone_number: hasPhone,
    email_count: surfacedEmails.length,
    phone_count: surfacedPhones.length,
    surfaced_emails: surfacedEmails.join(" | "),
    surfaced_phone_numbers: surfacedPhones.map((entry) => entry.number).join(" | "),
    surfaced_phone_dnc: surfacedPhones.map((entry) => entry.dnc || "unknown").join(" | "),
    surfaced_phone_types: surfacedPhones.map((entry) => entry.type || "unknown").join(" | "),
    atlas_export_needed: exportNeeded,
    market_status: labelish(lead.market_status),
    lead_status: labelish(lead.lead_status?.label || lead.lead_status),
    date_created: lead.date_created || "",
    date_updated: lead.date_updated || "",
    recent_note: String(lead.recent_note || "").replace(/\s+/g, " ").trim(),
    contactable: hasEmail === "true" || hasPhone === "true",
    distress_score: scoreLead(lead),
  }
}

async function dmRequest(endpoint) {
  const apiKey = env("DEALMACHINE_API_KEY")
  if (!apiKey) throw new Error("Missing DEALMACHINE_API_KEY.")
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "VestBlockDealMachineHarvest/1.0 (+https://vestblock.io)",
    },
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || data?.error || data?.message || data?.raw || `HTTP ${response.status}`)
  }
  return Array.isArray(data?.data) ? data.data : []
}

async function fetchAllLeads() {
  const leads = []
  let after = 0
  let hitPageCap = false
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await dmRequest(`/leads/?limit=${PAGE_SIZE}&after=${after}`)
    if (!rows.length) break
    leads.push(...rows)
    after += rows.length
    if (rows.length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1) hitPageCap = true
  }
  return { leads, hitPageCap }
}

function writeCsv(file, rows) {
  const columns = [
    "market_city",
    "market_state",
    "dealmachine_id",
    "property_address_full",
    "property_address_line_1",
    "property_city",
    "property_state",
    "property_zip",
    "owner_name",
    "owner_city",
    "owner_state",
    "estimated_value",
    "estimated_value_value",
    "rough_value_source",
    "rent_estimate",
    "equity_amount",
    "equity_percent",
    "tax_delinquent",
    "estimated_ltv",
    "cash_review_low",
    "cash_review_high",
    "suggested_exit_paths",
    "buyer_packet_summary",
    "seller_review_summary",
    "deal_fit_notes",
    "tax_delinquent_year",
    "past_due_amount",
    "active_lien",
    "preforeclosure_status",
    "is_vacant",
    "out_of_state_owner",
    "is_corporate_owner",
    "has_email_address",
    "has_phone_number",
    "email_count",
    "phone_count",
    "surfaced_emails",
    "surfaced_phone_numbers",
    "surfaced_phone_dnc",
    "surfaced_phone_types",
    "atlas_export_needed",
    "market_status",
    "lead_status",
    "date_created",
    "date_updated",
    "recent_note",
    "distress_score",
  ]
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })

  const harvest = await fetchAllLeads()
  const allLeads = harvest.leads
  const requestedMarkets = getArg("markets")
  const markets = dedupeMarkets(
    requestedMarkets
      ? parseMarkets(requestedMarkets)
      : TOP_MARKETS > 0
        ? deriveTopMarkets(allLeads, TOP_MARKETS)
        : parseMarkets(DEFAULT_MARKETS)
  )
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const snapshotPath = path.join(TMP_DIR, `dealmachine-harvest-snapshot-${stamp}.json`)
  fs.writeFileSync(snapshotPath, JSON.stringify(allLeads, null, 2))

  const byMarket = new Map(markets.map((market) => [market.key, []]))
  for (const lead of allLeads) {
    const key = `${normalizeText(lead.property_address_city)}|${normalizeState(lead.property_address_state)}`
    const market = markets.find((item) => item.key === key)
    if (!market) continue
    if (CONTACTABLE_ONLY && !lead.has_email_address && !lead.has_phone_number) continue
    byMarket.get(market.key)?.push(buildRow(lead, market))
  }

  const summary = []
  for (const market of markets) {
    const rows = (byMarket.get(market.key) || []).sort((a, b) => b.distress_score - a.distress_score || String(a.property_address_full).localeCompare(String(b.property_address_full)))
    const slug = `${normalizeText(market.city).replace(/\s+/g, "-")}-${market.state.toLowerCase()}`
    const csvPath = path.join(OUT_DIR, `dealmachine-api-${slug}.csv`)
    const jsonPath = path.join(OUT_DIR, `dealmachine-api-${slug}.json`)
    const readyCsvPath = path.join(OUT_DIR, `dealmachine-api-${slug}-ready-now.csv`)
    const exportQueuePath = path.join(OUT_DIR, `dealmachine-api-${slug}-atlas-export-needed.csv`)
    writeCsv(csvPath, rows)
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2))
    writeCsv(
      readyCsvPath,
      rows.filter((row) => row.surfaced_emails || row.surfaced_phone_numbers)
    )
    writeCsv(
      exportQueuePath,
      rows.filter((row) => row.atlas_export_needed === "true")
    )
    const stackSummaries = []
    if (STACKED) {
      for (const stack of STACK_DEFINITIONS) {
        const stackRows = rows.filter(stack.match)
        const stackPath = path.join(OUT_DIR, `dealmachine-api-${slug}-${stack.key}.csv`)
        writeCsv(stackPath, stackRows)
        stackSummaries.push({
          key: stack.key,
          label: stack.label,
          rows: stackRows.length,
          path: stackPath,
        })
      }
    }
    summary.push({
      market: `${market.city}, ${market.state}`,
      rows: rows.length,
      contactable: rows.filter((row) => row.has_email_address === "true" || row.has_phone_number === "true").length,
      with_email: rows.filter((row) => row.has_email_address === "true").length,
      with_phone: rows.filter((row) => row.has_phone_number === "true").length,
      ready_now: rows.filter((row) => row.surfaced_emails || row.surfaced_phone_numbers).length,
      atlas_export_needed: rows.filter((row) => row.atlas_export_needed === "true").length,
      top_score: rows[0]?.distress_score || 0,
      csvPath,
      jsonPath,
      readyCsvPath,
      exportQueuePath,
      stacks: stackSummaries,
    })
  }

  const summaryPath = path.join(OUT_DIR, `dealmachine-api-harvest-summary-${stamp}.json`)
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({ fetched: allLeads.length, pageSize: PAGE_SIZE, maxPages: MAX_PAGES, hitPageCap: harvest.hitPageCap, markets: summary }, null, 2)
  )

  console.log("=== DealMachine market harvest ===")
  console.log(`Fetched leads: ${allLeads.length}`)
  console.log(`Page cap hit:  ${harvest.hitPageCap ? "yes" : "no"}`)
  console.log(`Markets:       ${markets.map((market) => `${market.city}, ${market.state}`).join(" | ")}`)
  console.log(`Contactable:   ${CONTACTABLE_ONLY ? "yes" : "no"}`)
  console.log(`Stacked:       ${STACKED ? "yes" : "no"}`)
  console.log(`Snapshot:      ${snapshotPath}`)
  console.log(`Summary:       ${summaryPath}`)
  for (const item of summary) {
    console.log(`- ${item.market}: ${item.rows} rows | email ${item.with_email} | phone ${item.with_phone} | ready ${item.ready_now} | atlas-export ${item.atlas_export_needed} | top score ${item.top_score}`)
    console.log(`  all:   ${item.csvPath}`)
    console.log(`  ready: ${item.readyCsvPath}`)
    console.log(`  queue: ${item.exportQueuePath}`)
    if (STACKED) {
      for (const stack of item.stacks) {
        console.log(`  stack ${stack.key}: ${stack.rows} -> ${stack.path}`)
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
