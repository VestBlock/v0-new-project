/**
 * DealMachine export outreach for VestBlock.
 *
 * Builds owner outreach directly from DealMachine Contacts exports, optionally
 * enriching rows with a local ranked queue when one exists. Sends email through
 * Resend and writes a DNC-aware phone queue for Messages.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-export-outreach.mjs
 *   node --env-file=.env.local scripts/dealmachine-export-outreach.mjs --market=philadelphia-pa --export-csv=data/dm-exports/philadelphia-pa-2026-06-08.csv --limit=150 --send
 */

import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const SYNC_COMMAND_CENTER = !args.includes("--no-command-center-sync")
const IGNORE_SENT_PROPERTIES = args.includes("--ignore-sent-properties")
const IGNORE_SENT_EMAILS = args.includes("--ignore-sent-emails")
const REQUIRE_QUEUE_MATCH = args.includes("--require-queue-match")
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 150
const THROTTLE_MS = getArg("throttle") ? Number.parseInt(getArg("throttle"), 10) : 1800
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const DM_EXPORT_DIR = path.join(process.cwd(), "data", "dm-exports")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")
const SUPPRESSION_FILE = path.join(process.cwd(), "data", "outreach-suppressions.json")
const BCC = getArg("bcc") || ""
const CONFIG_FILE = getArg("config-file")
const EXPORT_CSV = getArg("export-csv")
const QUEUE_CSV = getArg("queue-csv")
const MARKET_ARG = (getArg("market") || getArg("markets") || "").trim()
const STRATEGY = normalizeMarketSlug(getArg("strategy") || "seller-options")
const MAX_EXPORT_AGE_DAYS = getArg("max-export-age-days") ? Number.parseInt(getArg("max-export-age-days"), 10) : 2
const SENT_LOOKBACK_DAYS = getArg("sent-lookback-days") ? Number.parseInt(getArg("sent-lookback-days"), 10) : null
const ALLOW_STALE_EXPORT = args.includes("--allow-stale-export")
const PORTFOLIO_STRATEGIES = new Set(["portfolio-landlord", "senior-landlord", "out-of-state-landlord", "landlord-portfolio"])
const ON_MARKET_STRATEGIES = new Set(["on-market-lowball", "on-market-cash-sweep", "active-listing-cash-review", "dealmachine-on-market"])
const TAX_CODE_STRATEGIES = new Set(["tax-code-stack", "tax-delinquent-code-violation", "code-tax-stack"])
const BUILDER_INFILL_STRATEGIES = new Set(["builder-infill-teardown", "infill-builder-teardown", "builder-teardown", "lot-assembly-builder"])
const LAND_WHOLESALE_STRATEGIES = new Set(["land-wholesale", "land-infill-lowball", "vacant-land-wholesale", "developer-land-arbitrage"])
const SMALL_MULTIFAMILY_STRATEGIES = new Set(["small-multifamily-portfolio", "multifamily-portfolio", "portfolio-breakup", "2-20-unit-portfolio"])
const INSTITUTIONAL_BTR_STRATEGIES = new Set(["institutional-btr-buybox", "btr-buybox", "sfr-aggregator-buybox", "institutional-sfr"])
const COMMERCIAL_DISTRESS_STRATEGIES = new Set(["commercial-small-bay-distress", "small-bay-distress", "commercial-distress", "mixed-use-distress"])
const NOVATION_RETAIL_STRATEGIES = new Set(["novation-retail-spread", "retail-spread-novation", "novation"])
const PREFORECLOSURE_SUBTO_STRATEGIES = new Set(["preforeclosure-subto", "preforeclosure-subject-to", "subject-to-preforeclosure"])
const DIVORCE_STRATEGIES = new Set(["divorce-separation", "divorce", "separation", "marital-split"])
const RELOCATION_STRATEGIES = new Set(["relocation-job-transfer", "relocation", "job-transfer", "military-pcs"])
const OUT_OF_STATE_HEIR_STRATEGIES = new Set(["out-of-state-heir", "long-distance-owner", "out-of-state-owner", "heir-distance"])
const SENIOR_DOWNSIZING_STRATEGIES = new Set(["senior-downsizing-medical", "senior-downsizing", "medical-hardship", "accessibility-hardship"])
const FIRE_DAMAGE_STRATEGIES = new Set(["fire-storm-damage", "fire-damage", "storm-damage", "insurance-damage"])
const PROBLEM_TENANT_STRATEGIES = new Set(["problem-tenant-eviction", "problem-tenant", "eviction-landlord", "occupied-distress"])
const SELLER_FINANCE_STRATEGIES = new Set(["seller-finance-equity", "seller-finance", "owner-carry", "creative-equity", "carry-back"])
const TIRED_LANDLORD_STRATEGIES = new Set(["tired-landlord", "burned-out-landlord", "absentee-rental", "rental-fatigue"])
const PROBATE_INHERITANCE_STRATEGIES = new Set(["probate-inheritance", "probate", "inheritance", "estate-property", "heir-property"])
const VACANT_PROPERTY_STRATEGIES = new Set(["vacant-property-refresh", "vacant-property", "vacant-home", "vacant-refresh"])
const CODE_VIOLATION_STRATEGIES = new Set(["code-violation-distress", "code-violation", "city-pressure", "nuisance-property"])
const TAX_DELINQUENT_SIMPLE_STRATEGIES = new Set(["tax-delinquent-cure", "tax-delinquent", "tax-cure", "back-taxes"])
const FSBO_STRATEGIES = new Set(["fsbo-conversion", "fsbo", "for-sale-by-owner", "owner-listed"])
const FAILED_FLIPPER_STRATEGIES = new Set(["failed-flipper-stuck-rehab", "failed-flipper", "stuck-rehab", "hard-money-maturity"])
const HOA_DELINQUENT_STRATEGIES = new Set(["hoa-delinquent", "hoa-lien", "association-lien", "hoa-pressure"])
const REVERSE_MORTGAGE_STRATEGIES = new Set(["reverse-mortgage-exit", "reverse-mortgage", "hecm-exit", "senior-hecm"])
const TITLE_ISSUE_STRATEGIES = new Set(["title-issue-cloud", "title-issue", "cloud-on-title", "quiet-title"])
const POST_AUCTION_STRATEGIES = new Set(["post-auction-backup-buyer", "post-auction", "backup-buyer", "redemption-window"])
const LOWBALL_MIN_PCT = boundedPercent(getArg("cash-min-pct") || "0.50", 0.5)
const LOWBALL_MAX_PCT = boundedPercent(getArg("cash-max-pct") || "0.60", 0.6)
const MAX_CASH_REVIEW_ANCHOR = getArg("max-anchor") ? numberish(getArg("max-anchor")) : 750000

function normalizeMarketSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseMarketArgs(value) {
  const raw = String(value || "").trim()
  if (!raw) return []
  const delimiter = raw.includes("|") ? "|" : raw.includes(";") ? ";" : raw.includes(",") && !/[a-z]+,\s*[a-z]{2}\b/i.test(raw) ? "," : null
  const markets = delimiter ? raw.split(delimiter) : [raw]
  return markets.map(normalizeMarketSlug).filter(Boolean)
}

function boundedPercent(value, fallback) {
  const parsed = Number.parseFloat(String(value || ""))
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(0.1, Math.min(0.95, parsed > 1 ? parsed / 100 : parsed))
}

function numberish(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
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

function findLatestExportForMarket(market) {
  if (!fs.existsSync(DM_EXPORT_DIR)) return ""
  const slug = normalizeMarketSlug(market)
  const compact = slug.replace(/-/g, "")
  const threshold = Date.now() - MAX_EXPORT_AGE_DAYS * 24 * 60 * 60 * 1000

  const candidates = fs
    .readdirSync(DM_EXPORT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const file = path.join(DM_EXPORT_DIR, name)
      const stat = fs.statSync(file)
      return { file, name: name.toLowerCase(), mtimeMs: stat.mtimeMs }
    })
    .filter((entry) => entry.mtimeMs >= threshold)
    .filter((entry) => {
      const normalized = normalizeMarketSlug(entry.name)
      return normalized.includes(slug) || normalized.replace(/-/g, "").includes(compact)
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return candidates[0]?.file || ""
}

function findQueueCsvForMarket(market) {
  const normalizedMarket = normalizeMarketSlug(market)
  const preferred = [
    `dealmachine-api-${normalizedMarket}-atlas-export-needed.csv`,
    `dealmachine-api-${normalizedMarket}-ready-now.csv`,
    `dealmachine-api-${normalizedMarket}-contactable-nurture-stack.csv`,
    `dealmachine-api-${normalizedMarket}.csv`,
  ]

  for (const filename of preferred) {
    const file = path.join(OUT_DIR, filename)
    if (fs.existsSync(file)) return file
  }

  if (!fs.existsSync(OUT_DIR)) return ""
  const fallback = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.includes(normalizedMarket) && name.endsWith(".csv"))
    .sort()

  return fallback.length ? path.join(OUT_DIR, fallback[0]) : ""
}

function loadMarketConfigs() {
  if (CONFIG_FILE) {
    const file = path.resolve(CONFIG_FILE)
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    if (!Array.isArray(parsed)) throw new Error("Config file must be a JSON array.")
    return parsed.map((entry) => ({
      market: normalizeMarketSlug(entry.market),
      queueCsv: String(entry.queueCsv || "").trim(),
      exportCsv: String(entry.exportCsv || "").trim(),
    }))
  }

  if (!MARKET_ARG) {
    throw new Error("Provide --market=<city-state> and --export-csv=<path>, or pass --config-file=<json>.")
  }

  const markets = parseMarketArgs(MARKET_ARG)
  if (SEND && !EXPORT_CSV && markets.length !== 1) {
    throw new Error("Live send across multiple markets requires --config-file=<json> so every DealMachine export is explicit.")
  }
  if (SEND && !EXPORT_CSV) {
    throw new Error("Live send requires --export-csv=<path> so the exact DealMachine export file is explicit.")
  }

  return markets.map((market) => {
    const exportCsv = EXPORT_CSV ? path.resolve(EXPORT_CSV) : findLatestExportForMarket(market)
    if (!exportCsv) {
      throw new Error(
        `No DealMachine export CSV found for ${market}. Place a fresh Contacts export in ${DM_EXPORT_DIR} or pass --export-csv=<path>.`
      )
    }

    return {
      market,
      queueCsv: QUEUE_CSV ? path.resolve(QUEUE_CSV) : findQueueCsvForMarket(market),
      exportCsv,
    }
  })
}

function env(name) {
  return String(process.env[name] || "").trim()
}

function sender() {
  return env("OUTREACH_FROM_EMAIL") || env("FROM_EMAIL") || env("RESEND_EMAIL") || "acquisitions@vestblock.io"
}

function buildRunStamp() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-")
  const nonce = Math.random().toString(36).slice(2, 8)
  return `${iso}-${process.pid}-${nonce}`
}

function mailingAddress() {
  return (
    env("OUTREACH_MAILING_ADDRESS") ||
    env("BUSINESS_MAILING_ADDRESS") ||
    env("COMPANY_MAILING_ADDRESS") ||
    env("PUBLIC_BUSINESS_ADDRESS")
  )
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
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

function queueAddress(row) {
  if (row.property_address_full) return row.property_address_full
  return [row.property_address, row.city, row.state, row.zip].filter(Boolean).join(", ")
}

function queueMarketLabel(row) {
  if (row.market_city && row.market_state) return `${row.market_city}, ${row.market_state}`
  return [row.city, row.state].filter(Boolean).join(", ")
}

function queueOwnerName(row) {
  return String(row.owner_name || "").trim()
}

function queueDistressScore(row) {
  const value = row.distress_score || row.priority_score || "0"
  return Number.parseInt(String(value), 10) || 0
}

function exportAddress(row) {
  return (
    row.associated_property_address_full ||
    row.property_address_full ||
    [row.property_address, row.property_city, row.property_state, row.property_zip].filter(Boolean).join(", ")
  )
}

function marketLabelFromAddress(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 3) return `${parts[1]}, ${parts[2].split(/\s+/)[0]}`
  if (parts.length >= 2) return parts.slice(-2).join(", ")
  return ""
}

function exportOwnerName(row) {
  return (
    `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
    row.full_name ||
    row.contact_name ||
    row.owner_name ||
    ""
  )
}

function stateFromAddress(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 3) return ""
  return String(parts[2] || "").split(/\s+/)[0]?.toUpperCase() || ""
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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
}

function isUsableOwnerEmail(value) {
  const email = String(value || "").trim().toLowerCase()
  if (!isEmail(email)) return false
  if (/@vestblock\.io$/i.test(email)) return false
  if (/(^|@)(example\.com|email\.com|address\.com)$/i.test(email)) return false
  return true
}

function splitContactValues(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstNameFromOwnerName(ownerName) {
  if (/\b(llc|inc|corp|corporation|company|co\.|partners|holdings|trust|church|city|county|fund|lp)\b/i.test(String(ownerName || ""))) {
    return "there"
  }
  const first = String(ownerName || "")
    .trim()
    .split(/\s+/)
    .find((part) => /[a-z]/i.test(part))
  if (!first || first.length < 2) return "there"
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

function ownerPortfolioKey(hit, ownerName) {
  const owner = normalizeText(hit.owner_name || ownerName || hit.contact_full_name || "")
  const mailing = normalizeText(
    [
      hit.primary_mailing_address,
      hit.primary_mailing_city,
      hit.primary_mailing_state,
      hit.primary_mailing_zip,
    ]
      .filter(Boolean)
      .join(" ")
  )
  if (!owner && !mailing) return ""
  return `${owner}|${mailing}`
}

function pathLabelList(value) {
  const labels = String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((path) => path !== "lender_review")
    .map((path) => {
      if (path === "fast_cash") return "a fast cash review"
      if (path === "creative_structure") return "a creative structure"
      if (path === "novation") return "a market-assisted sale"
      if (path === "rental_hold") return "a rental-buyer review"
      return path.replace(/_/g, " ")
    })

  return [...new Set(labels)].filter((label) => label !== "manual review").slice(0, 4).join(", ")
}

function sellerPathList(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((path) => path !== "lender_review")
    .join(" | ")
}

function buildEmail(contact) {
  const property = contact.property_address_full
  const pathLine = pathLabelList(contact.suggested_exit_paths)
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    `I came across it while reviewing off-market opportunities in ${contact.market_label}.`,
    contact.tax_delinquent === "Yes"
      ? "I also saw a tax signal tied to the property, which is one reason it landed on my list."
      : "It landed on my review list, so I figured I'd ask directly instead of making assumptions.",
    "",
    "I wanted to ask whether you have any plans for the property in the near term, or if you would at least be open to reviewing options.",
    pathLine ? `Depending on the situation, that could include ${pathLine}.` : "If there is a fit, we can keep it simple and only talk through the options that actually make sense.",
    "",
    `Would you be open to a quick reply on whether ${line} is worth a conversation, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildTaxCodeStackEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const codeLine = contact.code_violation
    ? `I also saw a local code or condition note tied to it ("${contact.code_violation}"), which is why it landed on my list.`
    : "It also showed a local property-condition signal, which is why it landed on my list."
  const taxLine = contact.past_due_amount
    ? `I have a tax signal showing ${contact.past_due_amount}; if that's outdated or already handled, no problem.`
    : "I also have a tax signal in my review queue; if that's outdated or already handled, no problem."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    taxLine,
    codeLine,
    "",
    "If taxes, repairs, code items, tenants, or timing have made the property harder to manage, I can review whether a direct purchase or another practical path even makes sense.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, tax advisor, code-enforcement agency, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildPortfolioLandlordEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const portfolioLine =
    Number(contact.portfolio_count || 0) >= 2
      ? `The same owner record appears tied to ${contact.portfolio_count} properties in this export, so I wanted to ask whether you are open to reviewing one property or the small group.`
      : "This looks like a landlord-style owner record, so I wanted to ask directly instead of guessing."
  const distanceLine = contact.out_of_state_mailing === "true"
    ? "The mailing address also appears to be outside the property state, which is one reason I reached out."
    : contact.absentee_owner === "true"
      ? "The record reads like an absentee-owner file, which is one reason I reached out."
      : "Sometimes owners with a few rentals are open to selling when the pricing and timing line up."
  const subject = `Quick question on your ${market} rental`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    portfolioLine,
    distanceLine,
    "",
    "If you're open to it, I can take a quick look at that property or the small group and tell you whether we have a real fit on our side without dragging you through a long process.",
    "",
    `Would you be open to a quick conversation about ${line}, or if there are multiple properties you may want to sell, a short review of the group?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildBuilderInfillEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const signalLine = contact.property_type || contact.zoning || contact.code_violation
    ? `The file has a few builder-review signals on it${contact.property_type ? `, including "${contact.property_type}"` : ""}${contact.zoning ? ` and zoning/use noted as "${contact.zoning}"` : ""}${contact.code_violation ? `, plus a condition note marked "${contact.code_violation}"` : ""}.`
    : "The address landed in a builder/infill review lane, so I wanted to ask about the real condition and timing instead of guessing."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    signalLine,
    "",
    `We work through builder and rehab criteria in ${market}. If it's a teardown, heavy rehab, vacant lot, or just something you'd rather not keep dealing with, I can give it a real first-pass review.`,
    "",
    `Would you be open to sending a few details or photos for ${line}, or should I close the file out?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, builder, developer, or closing agent. We do not guarantee offers, sale timelines, closing, zoning outcomes, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildSmallMultifamilyEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const portfolioLine =
    Number(contact.portfolio_count || 0) >= 2
      ? `The owner record appears tied to ${contact.portfolio_count} properties in this export, so I wanted to ask whether you are open to reviewing one property or the group.`
      : contact.units
        ? `The file reads like a ${contact.units}-unit or small multifamily opportunity, so I wanted to ask directly before making assumptions.`
        : "The file reads like a small rental or multifamily-style opportunity, so I wanted to ask directly before making assumptions."
  const subject = `Quick question on ${market} rentals`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    portfolioLine,
    "",
    "If you would consider selling one rental, several doors, or a harder-to-manage property, I can take a quick look and see whether there's a real fit without wasting your time.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close this out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, property manager, or closing agent. We do not guarantee offers, sale timelines, closing, financing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildInstitutionalBtrEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    `We are reviewing a few ${market} properties against active rental-buyer and build-to-rent criteria. Your address came across as a possible fit.`,
    "",
    "If the data is wrong or it's not something you'd ever consider selling, no problem. If you are open to it, I can do a quick review and only keep going if the criteria actually match.",
    "",
    `Would you be open to sending a few details about ${line}, or is this not worth revisiting?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, institutional buyer, or closing agent. We do not guarantee buyer demand, offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildCommercialDistressEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const useLine = contact.property_type || contact.zoning
    ? `The file shows ${[contact.property_type, contact.zoning].filter(Boolean).join(" / ")} as the use or zoning signal.`
    : "The property came through a commercial or mixed-use review lane."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    useLine,
    "",
    "We route commercial, mixed-use, storage, and redevelopment opportunities to operators already active in those lanes. If this property has vacancy, repairs, lease complexity, or timing pressure, I can review it and see if there's a real fit.",
    "",
    `Would you be open to a short conversation about ${line}, or should I close this out?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, environmental consultant, or closing agent. We do not guarantee offers, sale timelines, closing, zoning outcomes, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildNovationRetailSpreadEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    "Sometimes a straight cash offer is not the best fit, especially when a property may do better with cleanup, photos, access, or a cleaner presentation path. If that's the case here, I can review whether a market-assisted route makes more sense.",
    "",
    `Would you be open to sharing a few details and photos for ${line}?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, attorney, or closing agent. We do not guarantee offers, sale timelines, closing, buyer demand, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildSellerFinanceEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    "Not every property is best served by a straight cash sale. In some cases, monthly payments or flexible seller-finance terms create a better path for the owner.",
    "If that is something you would ever consider, I can review whether a simple owner-carry structure even makes sense before anyone wastes time.",
    "",
    `Would you be open to a quick conversation about whether ${line} could fit a seller-finance or flexible-terms path, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, legal advisor, or closing agent. We do not guarantee offers, payments, sale timelines, closing, financing approval, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildTiredLandlordEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const subject = `Quick question on your ${market} rental`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    "I reached out because the record reads like a rental or absentee-owner file, and sometimes owners are open to selling when a property becomes more work than it is worth.",
    "If tenants, repairs, turnover, distance, or just timing have made the property harder to manage, I can review whether there is a real fit on our side.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close it out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, property manager, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildProbateInheritanceEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    "If the property is tied to an estate, probate, or inherited situation, I know that can create extra decisions and loose ends at the wrong time.",
    "If the simplest path is selling it as-is, I can review whether we have a real fit without dragging you through a long process.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, probate attorney, estate representative, or closing agent. We do not guarantee offers, sale timelines, legal outcomes, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildVacantPropertyEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    "The address came across my review list as a likely vacant or lightly used property, so I wanted to ask directly instead of making assumptions.",
    "If it is sitting empty, needs work, or is no longer part of your plan, I can review whether an as-is purchase even makes sense.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, contractor, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildCodeViolationEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const codeLine = contact.code_violation
    ? `The property record also showed a local issue noted as "${contact.code_violation}".`
    : "The property record also showed a local city or condition issue."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    codeLine,
    "If repairs, citations, cleanup, or city pressure have made the property harder to manage, I can review whether a direct as-is path makes sense.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, municipal department, legal advisor, or closing agent. We do not guarantee offers, code resolutions, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildTaxDelinquentEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const taxLine = contact.past_due_amount
    ? `The file also showed a tax amount around ${contact.past_due_amount}; if that is already resolved or outdated, no problem.`
    : "The file also showed a tax signal; if that is already resolved or outdated, no problem."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    taxLine,
    "If catching up taxes, carrying costs, or property upkeep has become more trouble than the property is worth, I can review whether an as-is solution makes sense.",
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, tax advisor, legal advisor, or closing agent. We do not guarantee offers, tax outcomes, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildScenarioEmail(contact, lines, complianceLine) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    ...lines,
    "",
    `Would you be open to a quick conversation about ${line}, or should I close the file out on my side?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    complianceLine,
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ].filter(Boolean).join("\n")
  return { subject, body }
}

function buildDivorceSeparationEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If the property has become part of a divorce, separation, or broader split, sometimes the simplest solution is a quiet as-is sale on a timeline both sides can work with.",
      "If that is the situation here, I can review whether there is a real fit without turning it into a long process.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, law firm, mediator, or closing agent. We do not guarantee offers, legal outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildRelocationEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "I reached out because some owners hit a point where a move, job transfer, or out-of-state change forces a quick decision on whether to keep a house as a rental or sell it cleanly.",
      "If timing is the main issue, we can review an as-is path and work around your move-out or relocation window.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, employer, relocation company, lender, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes."
  )
}

function buildOutOfStateHeirEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "Managing a property from out of state can get expensive fast, especially when the house is inherited or tied to family cleanout and deferred maintenance.",
      "If you would rather handle it remotely and be done with it, I can review whether an as-is purchase makes sense.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, estate representative, or closing agent. We do not guarantee offers, remote closing timelines, legal outcomes, or transaction outcomes."
  )
}

function buildSeniorDownsizingEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If the property has become too much to keep up with, or if accessibility, upkeep, or health changes are driving the decision, an as-is sale can sometimes be the simplest path.",
      "We can review that without repairs, showings, or a rushed move-out expectation unless you want speed.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, medical provider, care advisor, or closing agent. We do not guarantee offers, housing outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildFireDamageEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If the property has fire, storm, water, or insurance-related damage and the repair process is dragging, I can review whether an as-is sale makes more sense than carrying the rebuild.",
      "If there is still a claim or contractor issue in motion, no problem — I only want to see if there is a realistic fit.",
    ],
    "VestBlock routes real estate conversations and is not an insurance carrier, public adjuster, contractor, brokerage, lender, or closing agent. We do not guarantee offers, claim outcomes, repair outcomes, sale timelines, or transaction outcomes."
  )
}

function buildProblemTenantEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If dealing with a tenant, eviction, occupancy issue, or squatter situation is what has kept you tied to the property, that is exactly the kind of headache some owners want to exit.",
      "If that is the case here, I can review whether we would take it in its current condition and occupancy status.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, property manager, eviction attorney, or closing agent. We do not guarantee offers, eviction outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildFsboEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If you are already trying to sell it yourself, I figured it made more sense to ask directly instead of adding another layer of noise.",
      "If you would rather skip the tire-kickers and compare a real as-is path, I can review whether there is a fit.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, listing service, or closing agent. We do not guarantee offers, buyer demand, sale timelines, closing, or transaction outcomes."
  )
}

function buildFailedFlipperEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If the project has stretched longer than planned, permits or contractors have slowed it down, or carrying costs are starting to eat the deal, I can review it as-is from an investor perspective.",
      "I am not looking to waste your time with generic curiosity — just whether there is a real exit fit.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, hard-money lender, general contractor, or closing agent. We do not guarantee offers, refi outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildHoaDelinquentEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If HOA dues, an association lien, or condo/association pressure has become a bigger problem than the property is worth, I can review whether a clean sale solves it before it grows.",
      "If the data is wrong or already resolved, no problem.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, homeowners association, legal advisor, or closing agent. We do not guarantee offers, lien outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildReverseMortgageEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If a reverse-mortgage balance is part of the decision, sometimes families wait too long to compare options and lose flexibility.",
      "If that is part of the situation here, I can review whether an as-is sale makes sense before the timeline gets tighter.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, HECM servicer, legal advisor, or closing agent. We do not guarantee offers, loan outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildTitleIssueEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If a title issue, heirship problem, missing deed, or cloud on title is what has kept the property stuck, that is worth knowing up front.",
      "We review some properties with title complications, so if that is the blocker here, I can at least tell you whether it is worth a conversation.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, title company, legal advisor, or closing agent. We do not guarantee offers, title outcomes, quiet-title outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function buildPostAuctionEmail(contact) {
  return buildScenarioEmail(
    contact,
    [
      "If an auction fell through, a sale was postponed, or there is still a redemption-style window around the property, there may still be time to compare options before the path narrows.",
      "If that is the situation here, I can review whether there is a real fit instead of assuming it is already gone.",
    ],
    "VestBlock routes real estate conversations and is not a brokerage, lender, foreclosure attorney, trustee, or closing agent. We do not guarantee rescue outcomes, legal outcomes, sale timelines, closing, or transaction outcomes."
  )
}

function developerActivityScore(contact) {
  const market = normalizeMarketSlug(contact.market || contact.market_label || marketLabelFromAddress(contact.property_address_full))
  const haystack = strategyHaystack(contact)
  const hotMarketScores = new Map([
    ["milwaukee-wi", 82],
    ["toledo-oh", 68],
    ["columbus-oh", 88],
    ["cincinnati-oh", 80],
    ["indianapolis-in", 84],
    ["louisville-ky", 78],
    ["kansas-city-mo", 76],
    ["philadelphia-pa", 74],
    ["cleveland-oh", 72],
    ["detroit-mi", 70],
    ["macon-ga", 64],
  ])
  let score = hotMarketScores.get(market) || 58
  if (/\b(infill|developer|builder|new construction|permit|redevelopment|assemblage)\b/.test(haystack)) score += 14
  if (/\b(vacant land|land|lot|parcel|zoning|buildable|acre|acres|side lot)\b/.test(haystack)) score += 12
  if (String(contact.is_vacant || "").toLowerCase() === "true" || /\bvacant\b/.test(haystack)) score += 6
  if (contact.tax_delinquent || contact.past_due_amount || contact.active_lien) score += 5
  return Math.max(0, Math.min(100, score))
}

function isOnMarketStatus(value) {
  const status = normalizeMarketSlug(value)
  return [
    "active",
    "pending",
    "for-sale",
    "listed",
    "under-contract",
    "coming-soon",
  ].includes(status)
}

function cashRangeFromContact(contact) {
  const anchor =
    numberish(contact.list_price) ||
    numberish(contact.current_listing_price) ||
    numberish(contact.estimated_value)
  if (!anchor) return { low: 0, high: 0, anchor: 0 }
  const minPct = Math.min(LOWBALL_MIN_PCT, LOWBALL_MAX_PCT)
  const maxPct = Math.max(LOWBALL_MIN_PCT, LOWBALL_MAX_PCT)
  return {
    low: Math.round((anchor * minPct) / 1000) * 1000,
    high: Math.round((anchor * maxPct) / 1000) * 1000,
    anchor,
  }
}

function isInstitutionalNonSellerOwner(value) {
  const owner = normalizeText(value)
  return /\b(city of|county of|state of|housing authority|redevelopment authority|department of|national bank|freddie mac|fannie mae|merrill lynch|mortgage|rcaf|csmc|hud)\b/i.test(owner)
}

function isLandWholesaleCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const value = anchorValue(contact)
  const landSignal = /\b(vacant land|raw land|land only|residential vacant|vacant lot|side lot|infill lot|lot|parcel|buildable|zoning|acre|acres|assemblage)\b/.test(haystack)
  const likelyVacantInfill =
    (String(contact.is_vacant || "").toLowerCase() === "true" || /\bvacant\b/.test(haystack)) &&
    (!numberish(contact.rent_estimate) || numberish(contact.rent_estimate) < 800) &&
    (!value || value <= 250000)
  const lowStructureSignal = !/\b(duplex|triplex|fourplex|apartment|commercial|industrial|warehouse|mixed use|retail|office)\b/.test(haystack)
  return developerActivityScore(contact) >= 65 && (landSignal || (likelyVacantInfill && lowStructureSignal))
}

function buildLandWholesaleEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "the area"
  const score = developerActivityScore(contact)
  const range = cashRangeFromContact(contact)
  const rangeLine = range.low && range.high
    ? `For land and infill deals like this, my first-pass review usually starts around ${money(range.low)}-${money(range.high)} based on the public value signal I have. That is not a final offer; it depends on access, utilities, zoning, title, liens, survey, buildability, and whether a builder can actually use it.`
    : "I would need the parcel details, access, utilities, zoning, title, lien status, survey, and buildability before putting a real number on it."
  const developerLine = score >= 75
    ? `The reason I am asking is that ${market} has enough builder/developer activity for land and infill opportunities to be worth a separate review.`
    : `I am checking whether this is a simple land or infill opportunity that could fit a builder/developer lane in ${market}.`
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    developerLine,
    "I am not sending a blind number off one data point.",
    "",
    rangeLine,
    "If it's truly land, a vacant lot, or a teardown/infill situation, I can review it quickly once I see a little more detail.",
    "",
    `Would you be open to sending the best details you have on ${line}, or should I close this out?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, surveyor, zoning consultant, attorney, or closing agent. We do not guarantee offers, zoning outcomes, buildability, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildPreforeclosureSubtoEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "your market"
  const ownershipLine = contact.out_of_state_mailing === "true"
    ? "The mailing record also appears to be outside the property state, which is one reason the file stood out."
    : contact.absentee_owner === "true"
      ? "The file also reads more like an absentee or non-occupant owner record, which is one reason it stood out."
      : "The file has a timing-sensitive owner signal, which is why I reached out directly."
  const subject = `Open to reviewing options on ${line}?`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. Quick question about ${property}.`,
    "",
    `Public records suggest there may be timing pressure around the property in ${market}.`,
    ownershipLine,
    "",
    "When that happens, some owners prefer to review practical off-market options before the timeline gets tighter.",
    "Depending on the numbers and the file itself, that can mean a direct purchase, a market-assisted sale, or in some cases a review of whether the existing financing can be worked through as part of a creative structure.",
    "",
    "If timing pressure is not addressed, it can make future financing harder, which is one reason some owners choose to review options early.",
    "",
    `If you are open to a short conversation about ${line}, reply yes and I will keep it straightforward. If not, I can close the file out on my side.`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock is not a law firm, credit-repair company, housing counselor, brokerage, lender, or closing agent. We do not guarantee foreclosure relief, lender approval, credit outcomes, offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildOnMarketCashReviewEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "the market"
  const status = contact.market_status ? ` as ${String(contact.market_status).toLowerCase()}` : ""
  const range = cashRangeFromContact(contact)
  const rangeLine = range.low && range.high
    ? `Based on the public value/listing signal I have, my first-pass as-is cash review would probably start around ${money(range.low)}-${money(range.high)}. That is not a final offer; it depends on photos, access, title, liens, tenant status, and the real condition.`
    : "I would need photos, access, title, lien, tenant, and condition details before putting a real cash number on it."
  const subject = `Quick question on ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. ${line} came across my DealMachine board${status}, so I wanted to reach out directly.`,
    "",
    rangeLine,
    "If the property is cleaner than the data suggests, I can sharpen that after I see more detail. If it needs work or has timing pressure, I can keep the review focused on an as-is path.",
    "",
    "If you are represented by an agent, I am happy to work through them or loop them in so the conversation stays clean.",
    "",
    `Would you be open to sending a few photos or the best contact path for ${line}? If the timing is wrong, no problem.`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildStrategyEmail(contact) {
  if (DIVORCE_STRATEGIES.has(STRATEGY)) return buildDivorceSeparationEmail(contact)
  if (RELOCATION_STRATEGIES.has(STRATEGY)) return buildRelocationEmail(contact)
  if (OUT_OF_STATE_HEIR_STRATEGIES.has(STRATEGY)) return buildOutOfStateHeirEmail(contact)
  if (SENIOR_DOWNSIZING_STRATEGIES.has(STRATEGY)) return buildSeniorDownsizingEmail(contact)
  if (FIRE_DAMAGE_STRATEGIES.has(STRATEGY)) return buildFireDamageEmail(contact)
  if (PROBLEM_TENANT_STRATEGIES.has(STRATEGY)) return buildProblemTenantEmail(contact)
  if (SELLER_FINANCE_STRATEGIES.has(STRATEGY)) return buildSellerFinanceEmail(contact)
  if (TIRED_LANDLORD_STRATEGIES.has(STRATEGY)) return buildTiredLandlordEmail(contact)
  if (PROBATE_INHERITANCE_STRATEGIES.has(STRATEGY)) return buildProbateInheritanceEmail(contact)
  if (VACANT_PROPERTY_STRATEGIES.has(STRATEGY)) return buildVacantPropertyEmail(contact)
  if (CODE_VIOLATION_STRATEGIES.has(STRATEGY)) return buildCodeViolationEmail(contact)
  if (TAX_DELINQUENT_SIMPLE_STRATEGIES.has(STRATEGY)) return buildTaxDelinquentEmail(contact)
  if (FSBO_STRATEGIES.has(STRATEGY)) return buildFsboEmail(contact)
  if (FAILED_FLIPPER_STRATEGIES.has(STRATEGY)) return buildFailedFlipperEmail(contact)
  if (HOA_DELINQUENT_STRATEGIES.has(STRATEGY)) return buildHoaDelinquentEmail(contact)
  if (REVERSE_MORTGAGE_STRATEGIES.has(STRATEGY)) return buildReverseMortgageEmail(contact)
  if (TITLE_ISSUE_STRATEGIES.has(STRATEGY)) return buildTitleIssueEmail(contact)
  if (POST_AUCTION_STRATEGIES.has(STRATEGY)) return buildPostAuctionEmail(contact)
  if (ON_MARKET_STRATEGIES.has(STRATEGY)) return buildOnMarketCashReviewEmail(contact)
  if (TAX_CODE_STRATEGIES.has(STRATEGY)) return buildTaxCodeStackEmail(contact)
  if (PORTFOLIO_STRATEGIES.has(STRATEGY)) return buildPortfolioLandlordEmail(contact)
  if (BUILDER_INFILL_STRATEGIES.has(STRATEGY)) return buildBuilderInfillEmail(contact)
  if (LAND_WHOLESALE_STRATEGIES.has(STRATEGY)) return buildLandWholesaleEmail(contact)
  if (SMALL_MULTIFAMILY_STRATEGIES.has(STRATEGY)) return buildSmallMultifamilyEmail(contact)
  if (INSTITUTIONAL_BTR_STRATEGIES.has(STRATEGY)) return buildInstitutionalBtrEmail(contact)
  if (COMMERCIAL_DISTRESS_STRATEGIES.has(STRATEGY)) return buildCommercialDistressEmail(contact)
  if (NOVATION_RETAIL_STRATEGIES.has(STRATEGY)) return buildNovationRetailSpreadEmail(contact)
  if (PREFORECLOSURE_SUBTO_STRATEGIES.has(STRATEGY)) return buildPreforeclosureSubtoEmail(contact)
  return buildEmail(contact)
}

function buildText(contact) {
  const line = contact.property_address_full.split(",")[0]
  const first = String(contact.first_name || "").trim().toLowerCase()
  const greeting = first && first !== "there"
    ? `Hi ${contact.first_name},`
    : "Hi,"
  if (DIVORCE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the property has become part of a split or separation and you want a quiet as-is option, I’d be glad to compare paths. Reply STOP to opt out.`
  }
  if (RELOCATION_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If a move or job transfer is part of the reason you may sell, I’d be glad to compare timing options. Reply STOP to opt out.`
  }
  if (OUT_OF_STATE_HEIR_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If managing it from out of state has become a headache, I’d be glad to compare as-is options. Reply STOP to opt out.`
  }
  if (SENIOR_DOWNSIZING_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the house has become too much to keep up with and you’d ever consider selling as-is, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (FIRE_DAMAGE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If repairs or insurance issues are dragging and you’d consider selling as-is, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (PROBLEM_TENANT_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the tenant or occupancy situation is what’s keeping you tied to it, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (SELLER_FINANCE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If you would ever consider monthly payments or flexible terms instead of a straight cash sale, I’d be glad to compare options. If not, I’ll close it out on my side. Reply STOP to opt out.`
  }
  if (TIRED_LANDLORD_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If you are still holding it as a rental, would you consider selling if the timing and terms made sense? Reply STOP to opt out.`
  }
  if (PROBATE_INHERITANCE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the property is part of an estate or inherited situation and you’d ever consider selling as-is, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (VACANT_PROPERTY_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. Is that property still part of your plan, or would you consider selling it as-is? Reply STOP to opt out.`
  }
  if (CODE_VIOLATION_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If city issues, repairs, or cleanup have made the property harder to manage, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (TAX_DELINQUENT_SIMPLE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If catching up taxes or holding costs has become a headache, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (FSBO_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If you'd rather skip the tire-kickers and compare a real as-is path, I’d be glad to talk. Reply STOP to opt out.`
  }
  if (FAILED_FLIPPER_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the rehab has stretched longer than planned and you want an as-is exit, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (HOA_DELINQUENT_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If the HOA or association situation is becoming a bigger problem, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (REVERSE_MORTGAGE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If a reverse-mortgage timeline is part of the decision, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (TITLE_ISSUE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If title issues are what have kept the property stuck, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (POST_AUCTION_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If an auction fell through or timing is still tight around the property, I’d be glad to compare options. Reply STOP to opt out.`
  }
  if (LAND_WHOLESALE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. Is that lot something you would consider selling if the numbers and timing made sense? If not, no problem and I'll close it out on my side. Reply STOP to opt out.`
  }
  if (TAX_CODE_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. ${line} came across my review list, so I wanted to ask whether you would be open to reviewing options on it. If not, I'll close the file out on my side. Reply STOP to opt out.`
  }
  if (PORTFOLIO_STRATEGIES.has(STRATEGY) || SMALL_MULTIFAMILY_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. If you would consider selling that property, or even a small group of rentals, I'd be glad to compare timing and options with you. Reply STOP to opt out.`
  }
  if (PREFORECLOSURE_SUBTO_STRATEGIES.has(STRATEGY)) {
    return `${greeting} Robert with VestBlock. Reaching out about ${line}. Public records suggest there may be timing pressure around the property, and I wanted to ask whether you are open to reviewing off-market options before the timeline gets tighter. Reply STOP to opt out.`
  }
  return `${greeting} Robert with VestBlock. Reaching out about ${line}. Are you open to reviewing options on the property, or should I close the file out on my side? Reply STOP to opt out.`
}

function normalizeUsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return ""
}

function isTextablePhone(phone) {
  const type = String(phone?.type || "").trim().toLowerCase()
  const dnc = String(phone?.dnc || "").trim().toLowerCase()
  if (/do not call/.test(dnc)) return false
  if (type === "landline") return false
  if (!/(mobile|wireless|cell)/.test(type)) return false
  return Boolean(normalizeUsPhone(phone?.number))
}

function parseResultsFileTimestamp(file) {
  const stamp = String(file || "").match(/(\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}(?:[-.]\d+)?Z)/)
  if (!stamp) return 0
  const iso = stamp[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3")
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : 0
}

function loadAlreadyContacted() {
  const sentEmails = new Set()
  const sentProperties = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return { sentEmails, sentProperties }
  const cutoff = Number.isFinite(SENT_LOOKBACK_DAYS) && SENT_LOOKBACK_DAYS >= 0
    ? Date.now() - SENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    : 0
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-outreach-results-") || !file.endsWith(".json")) continue
    if (cutoff && parseResultsFileTimestamp(file) && parseResultsFileTimestamp(file) < cutoff) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, file), "utf8"))
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (!row?.ok) continue
        if (row.email) sentEmails.add(String(row.email).toLowerCase())
        const propertyKey = normalizeAddress(row.property_address_full)
        if (propertyKey) sentProperties.add(propertyKey)
      }
    } catch {}
  }
  return { sentEmails, sentProperties }
}

function assertFreshExport(file) {
  if (ALLOW_STALE_EXPORT || !file) return
  const stat = fs.statSync(file)
  const threshold = Date.now() - MAX_EXPORT_AGE_DAYS * 24 * 60 * 60 * 1000
  if (stat.mtimeMs < threshold) {
    throw new Error(
      `Export CSV is stale for live outreach: ${file}. Fresh exports must be newer than ${MAX_EXPORT_AGE_DAYS} day(s), or re-run with --allow-stale-export.`
    )
  }
}

function loadSuppressedEmails() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, "utf8"))
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed
        .map((entry) => String(typeof entry === "string" ? entry : entry?.email || "").trim().toLowerCase())
        .filter(isUsableOwnerEmail)
    )
  } catch {
    return new Set()
  }
}

function loadMatches(marketConfigs) {
  const contacts = []
  for (const config of marketConfigs) {
    const exportRows = loadCsv(config.exportCsv)
    const queueRows = config.queueCsv && fs.existsSync(config.queueCsv) ? loadCsv(config.queueCsv) : []
    const requireQueueMatch = REQUIRE_QUEUE_MATCH && queueRows.length > 0
    const queueByAddress = new Map()
    for (const row of queueRows) {
      const key = normalizeAddress(queueAddress(row))
      if (key) queueByAddress.set(key, row)
    }

    for (const hit of exportRows) {
      const propertyAddressFull = exportAddress(hit)
      const addressKey = normalizeAddress(propertyAddressFull)
      if (!addressKey) continue

      const queue = queueByAddress.get(addressKey) || null
      if (requireQueueMatch && !queue) continue
      const ownerName = queue ? `${hit.first_name || ""} ${hit.last_name || ""}`.trim() || queueOwnerName(queue) : exportOwnerName(hit)
      const firstName = hit.first_name || firstNameFromOwnerName(ownerName)
      const propertyState = queue?.property_state || queue?.state || hit.property_state || stateFromAddress(propertyAddressFull)
      const primaryMailingState = normalizeState(hit.primary_mailing_state || hit.owner_state || hit.owner_address_state)
      const emails = [
        hit.email_address_1,
        hit.email_address_2,
        hit.email_address_3,
        hit.email,
        ...splitContactValues(hit.surfaced_emails),
        ...splitContactValues(hit.email_addresses),
      ]
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(isUsableOwnerEmail)
        .filter((email, index, rows) => rows.indexOf(email) === index)
      const phones = [
        ...[1, 2, 3]
        .map((index) => ({
          number: String(hit[`phone_${index}`] || "").trim(),
          dnc: String(hit[`phone_${index}_do_not_call`] || "").trim(),
          type: String(hit[`phone_${index}_type`] || "").trim(),
        })),
        ...splitContactValues(hit.surfaced_phone_numbers).map((number) => ({
          number,
          dnc: "",
          type: "",
        })),
      ].filter((entry) => entry.number)

      contacts.push({
        market: config.market,
        export_csv: config.exportCsv,
        market_label: queue ? queueMarketLabel(queue) : marketLabelFromAddress(propertyAddressFull),
        property_address_full: propertyAddressFull,
        owner_name: ownerName,
        record_owner_name: queue ? queueOwnerName(queue) || ownerName : ownerName,
        first_name: firstName || "there",
        contact_full_name: hit.contact_full_name || ownerName,
        contact_flags: hit.contact_flags || "",
        owner_status: hit.owner_status || "",
        owner_match_strategy: hit.owner_match_strategy || "",
        likely_owner: hit.likely_owner || "",
        resident: hit.resident || "",
        in_owner_family: hit.in_owner_family || "",
        property_state: propertyState,
        out_of_state_owner_source: hit.out_of_state_owner || "",
        primary_mailing_address: hit.primary_mailing_address || hit.owner_address || "",
        primary_mailing_city: hit.primary_mailing_city || hit.owner_city || hit.owner_address_city || "",
        primary_mailing_state: primaryMailingState,
        primary_mailing_zip: hit.primary_mailing_zip || hit.owner_zip || hit.owner_address_zip || "",
        portfolio_key: ownerPortfolioKey(hit, ownerName),
        tax_delinquent: queue?.tax_delinquent || hit.tax_delinquent || "",
        past_due_amount: queue?.past_due_amount || hit.past_due_amount || hit.delinquent_amount || "",
        code_violation_hit: queue?.code_violation_hit || hit.code_violation_hit || "",
        code_violation: queue?.code_violation || hit.code_violation || "",
        code_violation_date: queue?.code_violation_date || hit.code_violation_date || "",
        stack_method: queue?.stack_method || hit.stack_method || "",
        priority_score: queue?.priority_score || hit.priority_score || "",
        estimated_value: queue?.estimated_value || hit.estimated_value || hit.current_listing_price || "",
        list_price: queue?.list_price || queue?.current_listing_price || hit.list_price || hit.current_listing_price || "",
        current_listing_price: queue?.current_listing_price || hit.current_listing_price || hit.list_price || "",
        market_status: queue?.market_status || hit.market_status || "",
        lead_status: queue?.lead_status || hit.lead_status || "",
        date_created: queue?.date_created || hit.date_created || "",
        date_updated: queue?.date_updated || hit.date_updated || "",
        rent_estimate: queue?.rent_estimate || "",
        estimated_ltv: queue?.estimated_ltv || "",
        equity_amount: queue?.equity_amount || hit.equity_amount || "",
        equity_percent: queue?.equity_percent || hit.equity_percent || "",
        property_type: queue?.property_type || queue?.property_use || hit.property_type || hit.property_use || hit.land_use || "",
        units: queue?.units || queue?.unit_count || hit.units || hit.unit_count || hit.number_of_units || hit.property_units || "",
        lot_size: queue?.lot_size || hit.lot_size || hit.lot_size_sqft || hit.acres || "",
        zoning: queue?.zoning || hit.zoning || hit.property_zoning || "",
        is_vacant: queue?.is_vacant || hit.is_vacant || hit.vacant || "",
        active_lien: queue?.active_lien || hit.active_lien || "",
        recent_note: queue?.recent_note || hit.recent_note || hit.note || "",
        cash_review_low: queue?.cash_review_low || "",
        cash_review_high: queue?.cash_review_high || "",
        suggested_exit_paths: queue?.suggested_exit_paths || "seller_options",
        buyer_packet_summary: queue?.buyer_packet_summary || queue?.notes || "",
        distress_score: queue ? queueDistressScore(queue) : 0,
        dealmachine_id: queue?.dealmachine_id || hit.lead_id || hit.id || "",
        queue_strategy_key: queue?.strategy_key || "",
        queue_strategy_name: queue?.strategy_name || "",
        export_reason: queue?.export_reason || "",
        request_source_file: queue?.source_file || "",
        emails,
        phones,
      })
    }
  }
  return contacts
}

function annotatePortfolioSignals(contacts) {
  const groups = new Map()
  for (const contact of contacts) {
    const key = contact.portfolio_key
    if (!key) continue
    const group = groups.get(key) || { properties: new Set(), markets: new Set() }
    const propertyKey = normalizeAddress(contact.property_address_full)
    if (propertyKey) group.properties.add(propertyKey)
    if (contact.market) group.markets.add(contact.market)
    groups.set(key, group)
  }

  return contacts.map((contact) => {
    const group = groups.get(contact.portfolio_key)
    const portfolioCount = group?.properties?.size || 1
    const flags = String(contact.contact_flags || "").toLowerCase()
    const propertyState = normalizeState(contact.property_state || stateFromAddress(contact.property_address_full))
    const mailingState = normalizeState(contact.primary_mailing_state)
    const outOfState =
      Boolean(propertyState && mailingState && propertyState !== mailingState) ||
      String(contact.out_of_state_owner_source || "").toLowerCase() === "true"
    const absentee = /absentee/i.test(contact.owner_status || "") || (String(contact.resident || "").toLowerCase() === "false" && !outOfState ? true : outOfState)
    const seniorSignal = /\bsenior\b/i.test(flags)
    const propertyOwner =
      /property_owner|likely owner|linked to company|family/i.test(flags) ||
      /owner/i.test(contact.owner_status || "") ||
      Boolean(contact.owner_name)
    const fit =
      propertyOwner &&
      (
        outOfState ||
        (portfolioCount >= 2 && (outOfState || absentee)) ||
        (portfolioCount >= 2 && seniorSignal) ||
        (outOfState && seniorSignal) ||
        (absentee && seniorSignal)
      )
    const reasons = [
      portfolioCount >= 2 ? `portfolio_count_${portfolioCount}` : "",
      outOfState ? "out_of_state_mailing" : "",
      absentee ? "absentee_owner" : "",
      seniorSignal ? "senior_landlord_signal" : "",
    ].filter(Boolean)

    return {
      ...contact,
      portfolio_count: portfolioCount,
      portfolio_markets: [...(group?.markets || [])].join(" | "),
      out_of_state_mailing: outOfState ? "true" : "false",
      absentee_owner: absentee ? "true" : "false",
      senior_landlord_signal: seniorSignal ? "true" : "false",
      strategy_fit: fit ? "true" : "false",
      strategy_reason: reasons.join(" | "),
    }
  })
}

function strategyHaystack(contact) {
  return normalizeText([
    contact.property_address_full,
    contact.market_label,
    contact.owner_name,
    contact.record_owner_name,
    contact.property_type,
    contact.units,
    contact.lot_size,
    contact.zoning,
    contact.code_violation,
    contact.stack_method,
    contact.queue_strategy_key,
    contact.queue_strategy_name,
    contact.export_reason,
    contact.suggested_exit_paths,
    contact.buyer_packet_summary,
    contact.recent_note,
    contact.is_vacant,
    contact.active_lien,
    contact.equity_amount,
    contact.equity_percent,
    contact.strategy_reason,
    contact.lead_status,
    contact.market_status,
  ].filter(Boolean).join(" "))
}

function hasDistressSignal(contact) {
  const haystack = strategyHaystack(contact)
  return (
    String(contact.code_violation_hit || "").toLowerCase() === "true" ||
    Boolean(contact.tax_delinquent || contact.past_due_amount) ||
    Number(contact.distress_score || 0) >= 70 ||
    /\b(vacant|abandoned|boarded|fire|condemned|demo|demolition|code|violation|tax|delinquent|repair|rehab|distress)\b/.test(haystack)
  )
}

function anchorValue(contact) {
  return numberish(contact.list_price) || numberish(contact.current_listing_price) || numberish(contact.estimated_value)
}

function withStrategyReason(contact, extraReasons) {
  return {
    ...contact,
    strategy_fit: "true",
    strategy_reason: [
      contact.strategy_reason,
      ...extraReasons,
    ].filter(Boolean).join(" | "),
  }
}

function isBuilderInfillCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const builderSignal = /\b(infill|teardown|tear down|lot|land|vacant|oversized|zoning|demo|demolition|fire|condemned|boarded|shell|heavy rehab|major repair)\b/.test(haystack)
  return builderSignal || hasDistressSignal(contact)
}

function isSmallMultifamilyCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const unitCount = numberish(contact.units)
  return (
    (unitCount >= 2 && unitCount <= 20) ||
    Number(contact.portfolio_count || 0) >= 2 ||
    /\b(duplex|triplex|fourplex|quad|2 unit|3 unit|4 unit|multi family|multifamily|apartment|units)\b/.test(haystack)
  )
}

function isInstitutionalBtrCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const value = anchorValue(contact)
  const inPriceBand = !value || (value >= 60000 && value <= 450000)
  return inPriceBand && (
    /\b(single family|sfr|residential|lot|land|vacant|newer|rental|portfolio|build)\b/.test(haystack) ||
    contact.absentee_owner === "true" ||
    contact.out_of_state_mailing === "true"
  )
}

function isCommercialDistressCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const value = anchorValue(contact)
  return (
    /\b(commercial|industrial|warehouse|storage|small bay|mixed use|retail|office|auto|shop|flex|light industrial|zoning)\b/.test(haystack) ||
    (value >= 350000 && hasDistressSignal(contact))
  )
}

function hasProbateSignal(contact) {
  return /\b(probate|estate|heir|inherited|inheritance|executor|executrix|personal representative|deceased)\b/.test(strategyHaystack(contact))
}

function hasDivorceSignal(contact) {
  return /\b(divorce|separation|dissolution|marital|family court|domestic relations)\b/.test(strategyHaystack(contact))
}

function hasRelocationSignal(contact) {
  return /\b(relocation|relocating|job transfer|transferred|pcs|military move|new job|moving out of state)\b/.test(strategyHaystack(contact))
}

function isOutOfStateHeirCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    contact.out_of_state_mailing === "true" &&
    hasProbateSignal(contact)
  )
}

function isSeniorDownsizingCandidate(contact) {
  const haystack = strategyHaystack(contact)
  const yearsOwned = numberish(contact.years_owned || contact.ownership_years || contact.ownership_length)
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    !hasProbateSignal(contact) &&
    (
      /\b(senior|downsizing|medical|assisted living|nursing|accessibility|mobility)\b/.test(haystack) ||
      yearsOwned >= 20
    )
  )
}

function isFireDamageCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    /\b(fire|storm|insurance|smoke|water damage|hail|flood|boarded|condemned)\b/.test(strategyHaystack(contact))
  )
}

function isProblemTenantCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    (
      contact.absentee_owner === "true" ||
      /\b(tenant|eviction|occupied|squatter|lease violation|non paying|landlord)\b/.test(strategyHaystack(contact))
    )
  )
}

function isFsboCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    /\b(fsbo|for sale by owner|owner listed|zillow fsbo|facebook marketplace|craigslist|yard sign)\b/.test(strategyHaystack(contact))
  )
}

function isFailedFlipperCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    /\b(rehab|flip|flipper|hard money|construction|permit|stalled|unfinished|contractor)\b/.test(strategyHaystack(contact))
  )
}

function hasHoaSignal(contact) {
  return /\b(hoa|association lien|association dues|condo dues|poa)\b/.test(strategyHaystack(contact))
}

function isReverseMortgageCandidate(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    /\b(reverse mortgage|hecm|hud payoff|senior loan)\b/.test(strategyHaystack(contact))
  )
}

function hasTitleIssueSignal(contact) {
  return /\b(title issue|cloud on title|quiet title|unrecorded|deed issue|heirship|probate title)\b/.test(strategyHaystack(contact))
}

function isPostAuctionCandidate(contact) {
  return /\b(post auction|auction cancelled|auction postponed|redemption|backup buyer|sale fell through)\b/.test(strategyHaystack(contact))
}

function isSellerFinanceCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const equityPercent = numberish(contact.equity_percent)
  const equityAmount = numberish(contact.equity_amount)
  const value = anchorValue(contact)
  const landlordSignal = /\b(rental|tenant|leased|landlord|portfolio|absentee)\b/.test(haystack)
  const vacant = String(contact.is_vacant || "").toLowerCase() === "true"
  const outOfState = contact.out_of_state_mailing === "true"
  return !hasProbateSignal(contact) && !/\b(preforeclosure|foreclosure|auction)\b/.test(haystack) && (
    equityPercent >= 45 ||
    equityAmount >= 90000 ||
    (value >= 150000 && equityPercent >= 30)
  ) && (landlordSignal || vacant || outOfState || /\b(seller finance|owner carry|owner financing|carry|wrap|creative)\b/.test(haystack))
}

function isTiredLandlordCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  return (
    contact.absentee_owner === "true" ||
    contact.out_of_state_mailing === "true" ||
    /\b(landlord|rental|tenant|lease|portfolio|absentee)\b/.test(haystack)
  ) && (
    hasDistressSignal(contact) ||
    String(contact.is_vacant || "").toLowerCase() === "true" ||
    numberish(contact.equity_percent) >= 25
  )
}

function isVacantPropertyCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const commercialHeavy = /\b(commercial|industrial|warehouse|mixed use|office)\b/.test(haystack)
  return !commercialHeavy && (
    String(contact.is_vacant || "").toLowerCase() === "true" ||
    /\b(vacant|boarded|empty|unoccupied)\b/.test(haystack)
  )
}

function hasCodeDistressSignal(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    String(contact.code_violation_hit || "").toLowerCase() === "true" &&
    !Boolean(contact.tax_delinquent || contact.past_due_amount)
  ) || (
    /\b(code|violation|citation|nuisance|condemned|unsafe)\b/.test(strategyHaystack(contact)) &&
    !Boolean(contact.tax_delinquent || contact.past_due_amount)
  )
}

function hasTaxOnlySignal(contact) {
  return (
    !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name) &&
    Boolean(contact.tax_delinquent || contact.past_due_amount) &&
    String(contact.code_violation_hit || "").toLowerCase() !== "true"
  )
}

function isPreforeclosureSubjectToCandidate(contact) {
  if (isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name)) return false
  const haystack = strategyHaystack(contact)
  const explicitPreforeclosureExport = /preforeclosure/i.test(String(contact.export_csv || ""))
  const preforeclosureSignal =
    /\b(preforeclosure|foreclosure|lis pendens|auction|notice of default|sale date)\b/.test(haystack) ||
    /preforeclosure/i.test(String(contact.queue_strategy_key || "")) ||
    /preforeclosure/i.test(String(contact.queue_strategy_name || "")) ||
    explicitPreforeclosureExport
  if (!preforeclosureSignal) return false
  if (explicitPreforeclosureExport) return contact.senior_landlord_signal !== "true"

  const absentee = contact.absentee_owner === "true" || contact.out_of_state_mailing === "true"
  const landlordOrCreativeSignal =
    /\b(rental|tenant|leased|landlord|creative|subject to|seller finance|carry|wrap)\b/.test(haystack)
  const businessOwnerSignal = /\bbusiness|llc|inc|corp|trust\b/i.test(String(contact.record_owner_name || contact.owner_name || ""))
  const distressSupportSignal =
    String(contact.is_vacant || "").toLowerCase() === "true" ||
    String(contact.active_lien || "").toLowerCase() === "yes" ||
    String(contact.tax_delinquent || "").toLowerCase() === "yes" ||
    Number(contact.distress_score || 0) >= 75 ||
    numberish(contact.equity_percent) >= 25
  const seniorOwner = contact.senior_landlord_signal === "true"

  return (absentee || landlordOrCreativeSignal || businessOwnerSignal || distressSupportSignal) && !seniorOwner
}

function applyStrategyFilter(contacts) {
  const annotated = annotatePortfolioSignals(contacts)
  if (DIVORCE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(hasDivorceSignal)
      .map((contact) => withStrategyReason(contact, [
        "divorce_separation_quiet_exit_lane",
        numberish(contact.equity_percent) >= 25 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
      ]))
  }
  if (RELOCATION_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(hasRelocationSignal)
      .map((contact) => withStrategyReason(contact, [
        "relocation_job_transfer_timing_lane",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
      ]))
  }
  if (OUT_OF_STATE_HEIR_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isOutOfStateHeirCandidate)
      .map((contact) => withStrategyReason(contact, [
        "out_of_state_heir_remote_relief_lane",
        numberish(contact.equity_percent) >= 25 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
      ]))
  }
  if (SENIOR_DOWNSIZING_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isSeniorDownsizingCandidate)
      .map((contact) => withStrategyReason(contact, [
        "senior_downsizing_medical_hardship_lane",
        numberish(contact.years_owned || contact.ownership_years || contact.ownership_length) >= 20 ? "long_term_owner" : "",
      ]))
  }
  if (FIRE_DAMAGE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isFireDamageCandidate)
      .map((contact) => withStrategyReason(contact, [
        "fire_storm_insurance_damage_lane",
        hasDistressSignal(contact) ? "distress_signal" : "",
      ]))
  }
  if (PROBLEM_TENANT_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isProblemTenantCandidate)
      .map((contact) => withStrategyReason(contact, [
        "problem_tenant_eviction_lane",
        contact.absentee_owner === "true" ? "absentee_owner" : "",
      ]))
  }
  if (SELLER_FINANCE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isSellerFinanceCandidate)
      .map((contact) => withStrategyReason(contact, [
        "seller_finance_owner_carry_lane",
        numberish(contact.equity_percent) >= 45 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
        numberish(contact.equity_amount) >= 90000 ? `equity_amount_${Math.round(numberish(contact.equity_amount) / 1000)}k` : "",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
      ]))
  }
  if (TIRED_LANDLORD_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isTiredLandlordCandidate)
      .map((contact) => withStrategyReason(contact, [
        "tired_landlord_rental_fatigue_lane",
        Number(contact.portfolio_count || 0) >= 2 ? `portfolio_count_${contact.portfolio_count}` : "",
        contact.absentee_owner === "true" ? "absentee_owner" : "",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
      ]))
  }
  if (PROBATE_INHERITANCE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(hasProbateSignal)
      .map((contact) => withStrategyReason(contact, [
        "probate_inheritance_soft_touch_lane",
        String(contact.is_vacant || "").toLowerCase() === "true" ? "vacant_signal" : "",
        numberish(contact.equity_percent) >= 25 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
      ]))
  }
  if (VACANT_PROPERTY_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isVacantPropertyCandidate)
      .map((contact) => withStrategyReason(contact, [
        "vacant_property_refresh_lane",
        contact.is_vacant ? `vacant_${normalizeMarketSlug(contact.is_vacant)}` : "",
        hasDistressSignal(contact) ? "distress_signal" : "",
      ]))
  }
  if (CODE_VIOLATION_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(hasCodeDistressSignal)
      .map((contact) => withStrategyReason(contact, [
        "code_violation_city_pressure_lane",
        contact.code_violation ? `code_${normalizeMarketSlug(contact.code_violation).slice(0, 32)}` : "code_violation_signal",
      ]))
  }
  if (TAX_DELINQUENT_SIMPLE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(hasTaxOnlySignal)
      .map((contact) => withStrategyReason(contact, [
        "tax_delinquent_cure_lane",
        contact.past_due_amount ? "tax_amount_visible" : "tax_delinquent_signal",
        numberish(contact.equity_percent) >= 20 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
      ]))
  }
  if (FSBO_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isFsboCandidate)
      .map((contact) => withStrategyReason(contact, [
        "fsbo_conversion_real_buyer_lane",
        anchorValue(contact) ? `value_anchor_${Math.round(anchorValue(contact) / 1000)}k` : "",
      ]))
  }
  if (FAILED_FLIPPER_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isFailedFlipperCandidate)
      .map((contact) => withStrategyReason(contact, [
        "failed_flipper_stuck_rehab_lane",
        hasDistressSignal(contact) ? "distress_signal" : "",
      ]))
  }
  if (HOA_DELINQUENT_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(hasHoaSignal)
      .map((contact) => withStrategyReason(contact, [
        "hoa_delinquent_association_pressure_lane",
        numberish(contact.equity_percent) >= 20 ? `equity_percent_${Math.round(numberish(contact.equity_percent))}` : "",
      ]))
  }
  if (REVERSE_MORTGAGE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isReverseMortgageCandidate)
      .map((contact) => withStrategyReason(contact, [
        "reverse_mortgage_exit_lane",
        hasProbateSignal(contact) ? "estate_or_heir_signal" : "",
      ]))
  }
  if (TITLE_ISSUE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(hasTitleIssueSignal)
      .map((contact) => withStrategyReason(contact, [
        "title_issue_cloud_on_title_lane",
        hasProbateSignal(contact) ? "probate_title_overlap" : "",
      ]))
  }
  if (POST_AUCTION_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter(isPostAuctionCandidate)
      .map((contact) => withStrategyReason(contact, [
        "post_auction_backup_buyer_lane",
        /redemption/.test(strategyHaystack(contact)) ? "redemption_signal" : "",
      ]))
  }
  if (ON_MARKET_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => isOnMarketStatus(contact.market_status))
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .filter((contact) => {
        const anchor = cashRangeFromContact(contact).anchor
        return !MAX_CASH_REVIEW_ANCHOR || !anchor || anchor <= MAX_CASH_REVIEW_ANCHOR
      })
      .map((contact) => ({
        ...contact,
        strategy_fit: "true",
        strategy_reason: [
          contact.strategy_reason,
          contact.market_status ? `dealmachine_status_${normalizeMarketSlug(contact.market_status)}` : "",
          contact.record_owner_name ? `record_owner_${normalizeMarketSlug(contact.record_owner_name).slice(0, 40)}` : "",
          contact.list_price || contact.current_listing_price
            ? "listing_price_available"
            : contact.estimated_value
              ? "estimated_value_anchor"
              : "",
        ].filter(Boolean).join(" | "),
      }))
  }
  if (TAX_CODE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) =>
        TAX_CODE_STRATEGIES.has(normalizeMarketSlug(contact.queue_strategy_key)) ||
        (
          String(contact.code_violation_hit || "").toLowerCase() === "true" &&
          Boolean(contact.tax_delinquent || contact.past_due_amount)
        )
      )
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .map((contact) => ({
        ...contact,
        strategy_fit: "true",
        strategy_reason: [
          contact.strategy_reason,
          contact.stack_method || "tax_code_stack",
          contact.code_violation ? `code_${normalizeMarketSlug(contact.code_violation).slice(0, 48)}` : "code_violation_hit",
          contact.past_due_amount ? "tax_amount_visible" : "tax_delinquent_signal",
          contact.priority_score ? `priority_${contact.priority_score}` : "",
        ].filter(Boolean).join(" | "),
      }))
  }
  if (BUILDER_INFILL_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isBuilderInfillCandidate)
      .map((contact) => withStrategyReason(contact, [
        "high_fee_builder_infill_lane",
        hasDistressSignal(contact) ? "distress_or_condition_signal" : "",
        contact.property_type ? `property_type_${normalizeMarketSlug(contact.property_type).slice(0, 36)}` : "",
        contact.zoning ? `zoning_${normalizeMarketSlug(contact.zoning).slice(0, 24)}` : "",
      ]))
  }
  if (LAND_WHOLESALE_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isLandWholesaleCandidate)
      .map((contact) => withStrategyReason(contact, [
        "land_wholesale_developer_activity_lane",
        `developer_activity_${developerActivityScore(contact)}`,
        anchorValue(contact) ? `value_anchor_${Math.round(anchorValue(contact) / 1000)}k` : "",
        contact.is_vacant ? `vacant_${normalizeMarketSlug(contact.is_vacant)}` : "",
        contact.zoning ? `zoning_${normalizeMarketSlug(contact.zoning).slice(0, 24)}` : "",
      ]))
  }
  if (SMALL_MULTIFAMILY_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isSmallMultifamilyCandidate)
      .map((contact) => withStrategyReason(contact, [
        "high_fee_multifamily_portfolio_lane",
        Number(contact.portfolio_count || 0) >= 2 ? `portfolio_count_${contact.portfolio_count}` : "",
        contact.units ? `units_${normalizeMarketSlug(contact.units).slice(0, 16)}` : "",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
      ]))
  }
  if (INSTITUTIONAL_BTR_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isInstitutionalBtrCandidate)
      .map((contact) => withStrategyReason(contact, [
        "high_fee_institutional_btr_buybox_lane",
        anchorValue(contact) ? `value_anchor_${Math.round(anchorValue(contact) / 1000)}k` : "",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
      ]))
  }
  if (COMMERCIAL_DISTRESS_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) =>
        COMMERCIAL_DISTRESS_STRATEGIES.has(normalizeMarketSlug(contact.queue_strategy_key)) ||
        isCommercialDistressCandidate(contact)
      )
      .map((contact) => withStrategyReason(contact, [
        "high_fee_commercial_distress_lane",
        contact.property_type ? `property_type_${normalizeMarketSlug(contact.property_type).slice(0, 36)}` : "",
        hasDistressSignal(contact) ? "distress_or_condition_signal" : "",
      ]))
  }
  if (NOVATION_RETAIL_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter((contact) => isOnMarketStatus(contact.market_status) || hasDistressSignal(contact))
      .filter((contact) => !isInstitutionalNonSellerOwner(contact.record_owner_name || contact.owner_name))
      .map((contact) => withStrategyReason(contact, [
        "high_fee_novation_retail_spread_lane",
        isOnMarketStatus(contact.market_status) ? `market_status_${normalizeMarketSlug(contact.market_status)}` : "",
        anchorValue(contact) ? `value_anchor_${Math.round(anchorValue(contact) / 1000)}k` : "",
      ]))
  }
  if (PREFORECLOSURE_SUBTO_STRATEGIES.has(STRATEGY)) {
    return annotated
      .filter(isPreforeclosureSubjectToCandidate)
      .map((contact) => withStrategyReason(contact, [
        "preforeclosure_subject_to_review_lane",
        contact.out_of_state_mailing === "true" ? "out_of_state_mailing" : "",
        contact.absentee_owner === "true" ? "absentee_owner" : "",
        /\b(rental|tenant|leased|landlord)\b/.test(strategyHaystack(contact)) ? "rental_signal" : "",
        /preforeclosure|foreclosure|auction/.test(strategyHaystack(contact)) ? "preforeclosure_signal" : "",
      ]))
  }
  if (!PORTFOLIO_STRATEGIES.has(STRATEGY)) return annotated
  return annotated.filter((contact) => contact.strategy_fit === "true")
}

async function sendWithResend(resend, draft) {
  const payload = {
    from: sender(),
    to: draft.email,
    subject: draft.subject,
    text: draft.body,
  }
  if (BCC) payload.bcc = BCC
  const { data, error } = await resend.emails.send(payload)
  if (error) return { ok: false, error: error.message || "Resend send failed." }
  return { ok: true, id: data?.id || null }
}

function supabaseAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for command-center sync.")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function splitCityStateZip(address) {
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length < 3) return { city: "", state: "", zip: "" }
  const stateZip = parts[2].split(/\s+/)
  return {
    city: parts[1] || "",
    state: stateZip[0] || "",
    zip: stateZip[1] || "",
  }
}

function commandCenterExternalId(draft) {
  return (
    String(draft.dealmachine_id || "").trim() ||
    `${draft.market}:${normalizeAddress(draft.property_address_full)}:${String(draft.email || "").trim().toLowerCase()}`
  )
}

function strategyLeadNiche(strategy) {
  if (DIVORCE_STRATEGIES.has(strategy)) return "dealmachine_divorce_separation"
  if (RELOCATION_STRATEGIES.has(strategy)) return "dealmachine_relocation_job_transfer"
  if (OUT_OF_STATE_HEIR_STRATEGIES.has(strategy)) return "dealmachine_out_of_state_heir"
  if (SENIOR_DOWNSIZING_STRATEGIES.has(strategy)) return "dealmachine_senior_downsizing"
  if (FIRE_DAMAGE_STRATEGIES.has(strategy)) return "dealmachine_fire_storm_damage"
  if (PROBLEM_TENANT_STRATEGIES.has(strategy)) return "dealmachine_problem_tenant"
  if (ON_MARKET_STRATEGIES.has(strategy)) return "dealmachine_on_market_cash_review"
  if (SELLER_FINANCE_STRATEGIES.has(strategy)) return "dealmachine_seller_finance_review"
  if (TIRED_LANDLORD_STRATEGIES.has(strategy)) return "dealmachine_tired_landlord"
  if (PROBATE_INHERITANCE_STRATEGIES.has(strategy)) return "dealmachine_probate_inheritance"
  if (VACANT_PROPERTY_STRATEGIES.has(strategy)) return "dealmachine_vacant_property"
  if (CODE_VIOLATION_STRATEGIES.has(strategy)) return "dealmachine_code_violation"
  if (TAX_DELINQUENT_SIMPLE_STRATEGIES.has(strategy)) return "dealmachine_tax_delinquent"
  if (FSBO_STRATEGIES.has(strategy)) return "dealmachine_fsbo_conversion"
  if (FAILED_FLIPPER_STRATEGIES.has(strategy)) return "dealmachine_failed_flipper"
  if (HOA_DELINQUENT_STRATEGIES.has(strategy)) return "dealmachine_hoa_delinquent"
  if (REVERSE_MORTGAGE_STRATEGIES.has(strategy)) return "dealmachine_reverse_mortgage_exit"
  if (TITLE_ISSUE_STRATEGIES.has(strategy)) return "dealmachine_title_issue"
  if (POST_AUCTION_STRATEGIES.has(strategy)) return "dealmachine_post_auction"
  if (BUILDER_INFILL_STRATEGIES.has(strategy)) return "high_fee_builder_infill"
  if (LAND_WHOLESALE_STRATEGIES.has(strategy)) return "high_fee_land_wholesale"
  if (SMALL_MULTIFAMILY_STRATEGIES.has(strategy)) return "high_fee_small_multifamily"
  if (INSTITUTIONAL_BTR_STRATEGIES.has(strategy)) return "high_fee_institutional_btr"
  if (COMMERCIAL_DISTRESS_STRATEGIES.has(strategy)) return "high_fee_commercial_distress"
  if (NOVATION_RETAIL_STRATEGIES.has(strategy)) return "high_fee_novation_retail_spread"
  if (PREFORECLOSURE_SUBTO_STRATEGIES.has(strategy)) return "dealmachine_preforeclosure_subject_to_review"
  if (PORTFOLIO_STRATEGIES.has(strategy)) return "dealmachine_portfolio_landlord"
  if (TAX_CODE_STRATEGIES.has(strategy)) return "dealmachine_tax_code_stack"
  return "dealmachine_owner_contact"
}

function strategyOutreachAngle(strategy) {
  if (DIVORCE_STRATEGIES.has(strategy)) return "Quiet, discreet as-is exit for divorce or separation timing pressure"
  if (RELOCATION_STRATEGIES.has(strategy)) return "Relocation or job-transfer timing review"
  if (OUT_OF_STATE_HEIR_STRATEGIES.has(strategy)) return "Remote inherited-property relief for out-of-state owners"
  if (SENIOR_DOWNSIZING_STRATEGIES.has(strategy)) return "Senior downsizing or medical-hardship simplicity review"
  if (FIRE_DAMAGE_STRATEGIES.has(strategy)) return "Fire, storm, or insurance-damage as-is review"
  if (PROBLEM_TENANT_STRATEGIES.has(strategy)) return "Problem-tenant or eviction-relief seller review"
  if (ON_MARKET_STRATEGIES.has(strategy)) return "On-market/as-is cash review from DealMachine active/pending status"
  if (SELLER_FINANCE_STRATEGIES.has(strategy)) return "Seller-finance or owner-carry review for high-equity owners"
  if (TIRED_LANDLORD_STRATEGIES.has(strategy)) return "Tired-landlord rental sale review"
  if (PROBATE_INHERITANCE_STRATEGIES.has(strategy)) return "Probate or inheritance soft-touch seller review"
  if (VACANT_PROPERTY_STRATEGIES.has(strategy)) return "Vacant-property as-is seller review"
  if (CODE_VIOLATION_STRATEGIES.has(strategy)) return "Code-violation or city-pressure seller review"
  if (TAX_DELINQUENT_SIMPLE_STRATEGIES.has(strategy)) return "Tax-delinquent seller review"
  if (FSBO_STRATEGIES.has(strategy)) return "FSBO conversion into real as-is buyer review"
  if (FAILED_FLIPPER_STRATEGIES.has(strategy)) return "Failed-flipper or stuck-rehab investor relief review"
  if (HOA_DELINQUENT_STRATEGIES.has(strategy)) return "HOA delinquency or association-pressure seller review"
  if (REVERSE_MORTGAGE_STRATEGIES.has(strategy)) return "Reverse-mortgage exit or heir-protection review"
  if (TITLE_ISSUE_STRATEGIES.has(strategy)) return "Title-issue or cloud-on-title seller review"
  if (POST_AUCTION_STRATEGIES.has(strategy)) return "Post-auction rescue or backup-buyer review"
  if (BUILDER_INFILL_STRATEGIES.has(strategy)) return "Builder, infill, teardown, or heavy-rehab seller review"
  if (LAND_WHOLESALE_STRATEGIES.has(strategy)) return "Land wholesale review cross-checked against developer and infill activity"
  if (SMALL_MULTIFAMILY_STRATEGIES.has(strategy)) return "Small multifamily or portfolio-breakup seller review"
  if (INSTITUTIONAL_BTR_STRATEGIES.has(strategy)) return "Institutional or build-to-rent buy-box seller review"
  if (COMMERCIAL_DISTRESS_STRATEGIES.has(strategy)) return "Commercial, mixed-use, or small-bay distress review"
  if (NOVATION_RETAIL_STRATEGIES.has(strategy)) return "Disclosed novation or retail-spread seller review"
  if (PREFORECLOSURE_SUBTO_STRATEGIES.has(strategy)) return "Preforeclosure review with creative-structure screening for likely absentee or investor-style ownership"
  if (PORTFOLIO_STRATEGIES.has(strategy)) return "Portfolio landlord sale review"
  if (TAX_CODE_STRATEGIES.has(strategy)) return "Tax delinquent and code-violation seller review"
  return "Seller options review from DealMachine owner-contact export"
}

async function findExistingCommandCenterLead(admin, draft, externalId) {
  const { data: byExternalId, error: externalError } = await admin
    .from("leads")
    .select("id")
    .eq("source", "dealmachine_contacts_export")
    .eq("external_id", externalId)
    .maybeSingle()
  if (externalError) throw externalError
  if (byExternalId?.id) return byExternalId

  const { data: byPropertyEmail, error: propertyError } = await admin
    .from("leads")
    .select("id")
    .eq("property_address", draft.property_address_full)
    .eq("email", String(draft.email || "").trim().toLowerCase())
    .limit(1)
  if (propertyError) throw propertyError
  return byPropertyEmail?.[0] || null
}

async function upsertCommandCenterLead(admin, draft, result) {
  const location = splitCityStateZip(draft.property_address_full)
  const externalId = commandCenterExternalId(draft)
  const existing = await findExistingCommandCenterLead(admin, draft, externalId)
  const now = new Date().toISOString()
  const sentOk = Boolean(result.ok)
  const strategy = normalizeMarketSlug(draft.strategy || STRATEGY)
  const onMarketStrategy = ON_MARKET_STRATEGIES.has(strategy)
  const suggestedPaths = sellerPathList(draft.suggested_exit_paths) || "seller options"
  const payload = {
    lead_type: "sell_house",
    source: "dealmachine_contacts_export",
    source_url: draft.export_csv || null,
    category: "seller_lead",
    external_id: externalId,
    name: draft.owner_name || null,
    business_name: null,
    property_address: draft.property_address_full || null,
    phone: null,
    email: String(draft.email || "").trim().toLowerCase(),
    city: location.city || null,
    state: location.state || null,
    zip: location.zip || null,
    best_offer: "Real Estate Seller Lead",
    lead_score: Number.parseInt(String(draft.distress_score || ""), 10) || 82,
    urgency_level: "medium",
    contactability_level: "high",
    market_segment: "seller_lead",
    niche: strategyLeadNiche(strategy),
    email_valid: true,
    bounce_risk_score: 10,
    status: sentOk ? "contacted" : "outreach_ready",
    outreach_status: sentOk ? "sent" : "failed",
    delivery_status: sentOk ? "sent" : "failed",
    last_contacted_at: sentOk ? now : null,
    last_outreach_generated_at: now,
    imported_at: now,
    pain_signal: onMarketStrategy
      ? `DealMachine owner contact marked ${draft.market_status || "on-market/review"} for ${draft.property_address_full}. Conditional as-is cash range: ${draft.cash_review_low || "n/a"}-${draft.cash_review_high || "n/a"}.`
      : `DealMachine owner contact for ${draft.property_address_full}. Suggested paths: ${suggestedPaths}.`,
    outreach_angle: strategyOutreachAngle(strategy),
    notes: draft.buyer_packet_summary || (onMarketStrategy
      ? "DealMachine active/pending owner-contact export queued for conditional as-is cash-review outreach."
      : "DealMachine owner-contact export queued for seller-options outreach."),
    contact_info: {
      source: "dealmachine_contacts_export",
      ownerName: draft.owner_name || null,
      recordOwnerName: draft.record_owner_name || null,
      email: draft.email || null,
      dealmachineId: draft.dealmachine_id || null,
    },
    form_data: {
      market: draft.market,
      propertyAddress: draft.property_address_full,
      estimatedValue: draft.estimated_value,
      listPrice: draft.list_price,
      currentListingPrice: draft.current_listing_price,
      marketStatus: draft.market_status,
      leadStatus: draft.lead_status,
      rentEstimate: draft.rent_estimate,
      estimatedLtv: draft.estimated_ltv,
      equityAmount: draft.equity_amount,
      equityPercent: draft.equity_percent,
      propertyType: draft.property_type,
      units: draft.units,
      lotSize: draft.lot_size,
      zoning: draft.zoning,
      isVacant: draft.is_vacant,
      activeLien: draft.active_lien,
      recentNote: draft.recent_note,
      developerActivityScore: draft.developer_activity_score,
      cashReviewLow: draft.cash_review_low,
      cashReviewHigh: draft.cash_review_high,
      cashReviewAnchor: draft.cash_review_anchor,
      suggestedExitPaths: draft.suggested_exit_paths,
      taxDelinquent: draft.tax_delinquent,
    },
    metadata_json: {
      dealmachineId: draft.dealmachine_id || null,
      commandCenterSync: true,
      sourceScript: "dealmachine-export-outreach",
      resendId: result.id || null,
      sentFrom: sender(),
      strategy: draft.strategy || null,
      recordOwnerName: draft.record_owner_name || null,
      portfolioCount: draft.portfolio_count || null,
      strategyReason: draft.strategy_reason || null,
      propertyType: draft.property_type || null,
      units: draft.units || null,
      lotSize: draft.lot_size || null,
      zoning: draft.zoning || null,
      isVacant: draft.is_vacant || null,
      activeLien: draft.active_lien || null,
      equityAmount: draft.equity_amount || null,
      equityPercent: draft.equity_percent || null,
      recentNote: draft.recent_note || null,
      developerActivityScore: draft.developer_activity_score || null,
      marketStatus: draft.market_status || null,
      leadStatus: draft.lead_status || null,
      cashReviewAnchor: draft.cash_review_anchor || null,
    },
  }

  if (existing?.id) {
    const { data, error } = await admin
      .from("leads")
      .update({ ...payload, updated_at: now })
      .eq("id", existing.id)
      .select("id")
      .single()
    if (error) throw error
    return data.id
  }

  const { data, error } = await admin
    .from("leads")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

async function upsertCommandCenterOutreachMessage(admin, leadId, draft, result) {
  const now = new Date().toISOString()
  const { data: existingRows, error: findError } = await admin
    .from("outreach_messages")
    .select("id")
    .eq("lead_id", leadId)
    .eq("channel", "email")
    .limit(1)
  if (findError) throw findError

  const sentOk = Boolean(result.ok)
  const payload = {
    lead_id: leadId,
    channel: "email",
    subject: draft.subject,
    body: draft.body,
    cta: "Reply if you are open to a quick conversation, or reply unsubscribe/do not contact to opt out.",
    language: "en",
    compliance_note: "Includes seller-options disclosure, opt-out language, and mailing address.",
    generated_with: "dealmachine_export_outreach",
    status: sentOk ? "sent" : "failed",
    approved_at: now,
    approved_by_user_id: null,
    sent_at: sentOk ? now : null,
    send_provider: "resend",
    send_error: sentOk ? null : result.error || "Resend send failed.",
    last_generated_at: now,
  }

  if (existingRows?.[0]?.id) {
    const { data, error } = await admin
      .from("outreach_messages")
      .update({ ...payload, updated_at: now })
      .eq("id", existingRows[0].id)
      .select("id")
      .single()
    if (error) throw error
    return data.id
  }

  const { data, error } = await admin
    .from("outreach_messages")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

async function syncCommandCenterSend(admin, draft, result) {
  const leadId = await upsertCommandCenterLead(admin, draft, result)
  const outreachMessageId = await upsertCommandCenterOutreachMessage(admin, leadId, draft, result)
  const { error } = await admin.from("outreach_send_events").insert({
    lead_id: leadId,
    outreach_message_id: outreachMessageId,
    channel: "email",
    provider: "resend",
    status: result.ok ? "sent" : "failed",
    recipient: draft.email,
    subject: draft.subject,
    error_message: result.ok ? null : result.error || "Resend send failed.",
    metadata_json: {
      source: "dealmachine_export_outreach",
      market: draft.market,
      propertyAddress: draft.property_address_full,
      dealmachineId: draft.dealmachine_id || null,
      resendId: result.id || null,
      sentFrom: sender(),
      strategy: draft.strategy || null,
      recordOwnerName: draft.record_owner_name || null,
      portfolioCount: draft.portfolio_count || null,
      strategyReason: draft.strategy_reason || null,
      propertyType: draft.property_type || null,
      units: draft.units || null,
      lotSize: draft.lot_size || null,
      zoning: draft.zoning || null,
      isVacant: draft.is_vacant || null,
      activeLien: draft.active_lien || null,
      equityAmount: draft.equity_amount || null,
      equityPercent: draft.equity_percent || null,
      recentNote: draft.recent_note || null,
      developerActivityScore: draft.developer_activity_score || null,
      marketStatus: draft.market_status || null,
      leadStatus: draft.lead_status || null,
      cashReviewLow: draft.cash_review_low || null,
      cashReviewHigh: draft.cash_review_high || null,
      cashReviewAnchor: draft.cash_review_anchor || null,
    },
  })
  if (error) throw error
  return { ok: true, leadId, outreachMessageId }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  if (SEND && !env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY.")
  if (SEND && !mailingAddress()) throw new Error("Missing OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS.")
  const commandCenterAdmin = SEND && SYNC_COMMAND_CENTER ? supabaseAdmin() : null

  fs.mkdirSync(DM_EXPORT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const marketConfigs = loadMarketConfigs()
  for (const config of marketConfigs) {
    if (!fs.existsSync(config.exportCsv)) throw new Error(`Missing DealMachine export CSV for ${config.market}: ${config.exportCsv}`)
    assertFreshExport(config.exportCsv)
  }
  const alreadyContacted = loadAlreadyContacted()
  const suppressedEmails = loadSuppressedEmails()
  const rawContacts = applyStrategyFilter(loadMatches(marketConfigs)).sort(
    (a, b) => b.distress_score - a.distress_score || a.property_address_full.localeCompare(b.property_address_full)
  )

  const emailDrafts = []
  const phoneQueue = []
  const seenEmail = new Set()
  const seenEmailProperty = new Set()
  const seenRecipientEmail = new Set()
  const seenPhone = new Set()

  for (const contact of rawContacts) {
    const propertyKey = normalizeAddress(contact.property_address_full)
    if (!IGNORE_SENT_PROPERTIES && alreadyContacted.sentProperties.has(propertyKey)) continue
    if (seenEmailProperty.has(propertyKey)) continue

    let emailSelectedForProperty = false
    for (const email of contact.emails) {
      const normalizedEmail = email.toLowerCase()
      const key = `${contact.property_address_full}|${normalizedEmail}`
      if (suppressedEmails.has(normalizedEmail)) continue
      if (seenEmail.has(key) || seenRecipientEmail.has(normalizedEmail) || (!IGNORE_SENT_EMAILS && alreadyContacted.sentEmails.has(normalizedEmail))) continue
      const cashReview = cashRangeFromContact(contact)
      seenEmail.add(key)
      seenRecipientEmail.add(normalizedEmail)
      seenEmailProperty.add(propertyKey)
      emailDrafts.push({
        market: contact.market,
        property_address_full: contact.property_address_full,
        owner_name: contact.owner_name,
        record_owner_name: contact.record_owner_name || "",
        dealmachine_id: contact.dealmachine_id,
        email: normalizedEmail,
        first_name: contact.first_name,
        export_csv: contact.export_csv,
        strategy: STRATEGY,
        portfolio_count: contact.portfolio_count || "",
        portfolio_markets: contact.portfolio_markets || "",
        out_of_state_mailing: contact.out_of_state_mailing || "",
        absentee_owner: contact.absentee_owner || "",
        senior_landlord_signal: contact.senior_landlord_signal || "",
        strategy_reason: contact.strategy_reason || "",
        market_status: contact.market_status || "",
        lead_status: contact.lead_status || "",
        date_created: contact.date_created || "",
        date_updated: contact.date_updated || "",
        tax_delinquent: contact.tax_delinquent,
        past_due_amount: contact.past_due_amount || "",
        code_violation_hit: contact.code_violation_hit || "",
        code_violation: contact.code_violation || "",
        code_violation_date: contact.code_violation_date || "",
        stack_method: contact.stack_method || "",
        priority_score: contact.priority_score || "",
        estimated_value: contact.estimated_value,
        list_price: contact.list_price || "",
        current_listing_price: contact.current_listing_price || "",
        rent_estimate: contact.rent_estimate,
        estimated_ltv: contact.estimated_ltv,
        equity_amount: contact.equity_amount || "",
        equity_percent: contact.equity_percent || "",
        property_type: contact.property_type || "",
        units: contact.units || "",
        lot_size: contact.lot_size || "",
        zoning: contact.zoning || "",
        is_vacant: contact.is_vacant || "",
        active_lien: contact.active_lien || "",
        recent_note: contact.recent_note || "",
        developer_activity_score: LAND_WHOLESALE_STRATEGIES.has(STRATEGY) ? developerActivityScore(contact) : "",
        cash_review_low: contact.cash_review_low || cashReview.low || "",
        cash_review_high: contact.cash_review_high || cashReview.high || "",
        cash_review_anchor: cashReview.anchor || "",
        suggested_exit_paths: sellerPathList(contact.suggested_exit_paths),
        buyer_packet_summary: contact.buyer_packet_summary,
        distress_score: contact.distress_score,
        ...buildStrategyEmail(contact),
      })
      emailSelectedForProperty = true
      if (emailSelectedForProperty) break
    }

    let phoneSelectedForProperty = false
    for (const phone of contact.phones) {
      const key = `${contact.property_address_full}|${phone.number}`
      if (seenPhone.has(key)) continue
      seenPhone.add(key)
      if (!isTextablePhone(phone)) continue
      phoneQueue.push({
        market: contact.market,
        property_address_full: contact.property_address_full,
        owner_name: contact.owner_name,
        dealmachine_id: contact.dealmachine_id,
        phone: normalizeUsPhone(phone.number),
        do_not_call: phone.dnc,
        phone_type: phone.type,
        can_text: isTextablePhone(phone) ? "true" : "false",
        suggested_exit_paths: sellerPathList(contact.suggested_exit_paths),
        buyer_packet_summary: contact.buyer_packet_summary,
        distress_score: contact.distress_score,
        text_message: buildText(contact),
      })
      phoneSelectedForProperty = true
      if (phoneSelectedForProperty) break
    }
  }

  const selectedDrafts = emailDrafts.slice(0, LIMIT)
  const stamp = buildRunStamp()
  const emailCsv = path.join(OUT_DIR, `dealmachine-export-owner-email-ready-${stamp}.csv`)
  const phoneCsv = path.join(OUT_DIR, `dealmachine-export-phone-queue-${stamp}.csv`)
  const draftsJson = path.join(OUTREACH_DIR, `dealmachine-export-outreach-drafts-${stamp}.json`)
  const draftsTxt = path.join(OUTREACH_DIR, `dealmachine-export-outreach-drafts-${stamp}.txt`)

  const emailCols = [
    "market",
    "property_address_full",
    "owner_name",
    "record_owner_name",
    "dealmachine_id",
    "email",
    "first_name",
    "strategy",
    "portfolio_count",
    "portfolio_markets",
    "out_of_state_mailing",
    "absentee_owner",
    "senior_landlord_signal",
    "strategy_reason",
    "market_status",
    "lead_status",
    "date_created",
    "date_updated",
    "tax_delinquent",
    "past_due_amount",
    "code_violation_hit",
    "code_violation",
    "code_violation_date",
    "stack_method",
    "priority_score",
    "estimated_value",
    "list_price",
    "current_listing_price",
    "rent_estimate",
    "estimated_ltv",
    "equity_amount",
    "equity_percent",
    "property_type",
    "units",
    "lot_size",
    "zoning",
    "is_vacant",
    "active_lien",
    "recent_note",
    "developer_activity_score",
    "cash_review_low",
    "cash_review_high",
    "cash_review_anchor",
    "suggested_exit_paths",
    "buyer_packet_summary",
    "distress_score",
    "subject",
    "body",
  ]
  fs.writeFileSync(emailCsv, [emailCols.join(","), ...selectedDrafts.map((row) => emailCols.map((col) => esc(row[col])).join(","))].join("\n"))

  const phoneCols = [
    "market",
    "property_address_full",
    "owner_name",
    "dealmachine_id",
    "phone",
    "do_not_call",
    "phone_type",
    "can_text",
    "suggested_exit_paths",
    "buyer_packet_summary",
    "distress_score",
    "text_message",
  ]
  fs.writeFileSync(phoneCsv, [phoneCols.join(","), ...phoneQueue.map((row) => phoneCols.map((col) => esc(row[col])).join(","))].join("\n"))

  fs.writeFileSync(draftsJson, JSON.stringify(selectedDrafts, null, 2))
  fs.writeFileSync(
    draftsTxt,
    selectedDrafts
      .map((draft, index) => `#${index + 1} ${draft.property_address_full} <${draft.email}>\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\n${"=".repeat(80)}\n`)
      .join("\n")
  )

  console.log("=== DealMachine export outreach ===")
  console.log(`Mode:           ${SEND ? "LIVE SEND (Resend)" : "DRY RUN"}`)
  console.log(`Matched emails: ${emailDrafts.length}`)
  console.log(`Selected send:  ${selectedDrafts.length}`)
  console.log(`Phone queue:    ${phoneQueue.length}`)
  console.log(`Strategy:       ${STRATEGY}`)
  console.log(`Email CSV:      ${emailCsv}`)
  console.log(`Phone CSV:      ${phoneCsv}`)
  console.log(`Draft review:   ${draftsTxt}`)
  console.log(`CC sync:        ${SEND && SYNC_COMMAND_CENTER ? "enabled" : "disabled"}`)

  if (!SEND || !selectedDrafts.length) {
    console.log(SEND ? "No selected drafts to send." : "Dry run only. Re-run with --send to deliver through Resend.")
    return
  }

  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  for (let index = 0; index < selectedDrafts.length; index++) {
    const draft = selectedDrafts[index]
    const result = await sendWithResend(resend, draft)
    let commandCenter = null
    if (commandCenterAdmin) {
      try {
        commandCenter = await syncCommandCenterSend(commandCenterAdmin, draft, result)
      } catch (error) {
        commandCenter = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
    results.push({
      strategy: draft.strategy || STRATEGY,
      market: draft.market,
      email: draft.email,
      subject: draft.subject,
      property_address_full: draft.property_address_full,
      dealmachine_id: draft.dealmachine_id,
      sent_from: sender(),
      commandCenter,
      ...result,
    })
    const syncLabel = commandCenter ? (commandCenter.ok ? " synced" : ` sync-failed: ${commandCenter.error}`) : ""
    console.log(`${result.ok ? "ok" : "failed"} ${index + 1}/${selectedDrafts.length} ${draft.property_address_full} ${result.ok ? result.id : result.error}${syncLabel}`)
    if (index < selectedDrafts.length - 1) await sleep(THROTTLE_MS)
  }

  fs.writeFileSync(path.join(OUTREACH_DIR, `dealmachine-export-outreach-results-${stamp}.json`), JSON.stringify(results, null, 2))
  const sent = results.filter((row) => row.ok).length
  console.log(`Done. Sent ${sent}/${results.length}; failed ${results.length - sent}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
