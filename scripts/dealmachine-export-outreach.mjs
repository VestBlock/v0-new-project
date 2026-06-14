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
const MARKET_ARG = (getArg("market") || "").trim().toLowerCase()
const STRATEGY = normalizeMarketSlug(getArg("strategy") || "seller-options")
const MAX_EXPORT_AGE_DAYS = getArg("max-export-age-days") ? Number.parseInt(getArg("max-export-age-days"), 10) : 7
const PORTFOLIO_STRATEGIES = new Set(["portfolio-landlord", "senior-landlord", "out-of-state-landlord", "landlord-portfolio"])
const ON_MARKET_STRATEGIES = new Set(["on-market-lowball", "on-market-cash-sweep", "active-listing-cash-review", "dealmachine-on-market"])
const TAX_CODE_STRATEGIES = new Set(["tax-code-stack", "tax-delinquent-code-violation", "code-tax-stack"])
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

  if (SEND && !EXPORT_CSV) {
    throw new Error("Live send requires --export-csv=<path> so the exact DealMachine export file is explicit.")
  }

  const market = normalizeMarketSlug(MARKET_ARG)
  const exportCsv = EXPORT_CSV ? path.resolve(EXPORT_CSV) : findLatestExportForMarket(market)
  if (!exportCsv) {
    throw new Error(
      `No DealMachine export CSV found for ${market}. Place a fresh Contacts export in ${DM_EXPORT_DIR} or pass --export-csv=<path>.`
    )
  }

  return [{
    market,
    queueCsv: QUEUE_CSV ? path.resolve(QUEUE_CSV) : findQueueCsvForMarket(market),
    exportCsv,
  }]
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
  const subject = `Question about ${property.split(",")[0]}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I wanted to ask about ${property}.`,
    "",
    `I came across this property while reviewing local off-market and distress opportunities in ${contact.market_label}.`,
    contact.tax_delinquent === "Yes"
      ? "I also see a tax-delinquent signal on the file, which is one reason it landed on my review list."
      : "The property came through my review list, so I wanted to ask directly instead of assuming anything.",
    "",
    "If it would help, I can review this specific property and walk through several options. I am not sending a blind offer or promising a closing; I only want to see whether one of those options is realistic for this property.",
    pathLine ? `For this address, the review may include ${pathLine}.` : "",
    "",
    `Would you be open to a quick conversation about ${property.split(",")[0]}, or is this not something you want to discuss right now?`,
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
    ? `The file also had a local code/condition signal noted as "${contact.code_violation}", so I wanted to ask directly instead of guessing about the situation.`
    : "The file had a local property-condition signal, so I wanted to ask directly instead of guessing about the situation."
  const taxLine = contact.past_due_amount
    ? `I also have a tax-delinquent signal with ${contact.past_due_amount} shown in the review queue; if that is outdated or already handled, no problem.`
    : "I also have a tax-delinquent signal on the review queue; if that is outdated or already handled, no problem."
  const subject = `Question about ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I wanted to ask about ${property}.`,
    "",
    taxLine,
    codeLine,
    "",
    "I am not assuming you want to sell and I am not sending a blind offer. If the property is becoming a headache because of taxes, repairs, code items, tenants, or timing, I can review it and talk through realistic paths.",
    "",
    "Depending on the numbers and condition, that review could include an as-is cash path, a creative structure, or simply passing if it does not make sense.",
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
    ? "The mailing address also appears to be outside the property state, which can make management more of a headache over time."
    : contact.absentee_owner === "true"
      ? "The record reads like an absentee-owner file, which can make management more of a headache over time."
      : "Sometimes owners with several rentals only want to sell if there is a simple path and a real buyer on the other side."
  const subject = `Question about your ${market} rental property`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I wanted to ask about ${property}.`,
    "",
    portfolioLine,
    distanceLine,
    "",
    "We are building buyer and builder demand in a few markets and can review rental, cash, and creative options before anyone wastes time. I am not sending a blind offer or promising a closing; I only want to see whether one of those options is realistic.",
    "",
    `Would you be open to a quick conversation about ${line}, or if there are multiple properties you would rather simplify, a short review of the group?`,
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

function buildOnMarketCashReviewEmail(contact) {
  const property = contact.property_address_full
  const line = property.split(",")[0]
  const market = contact.market_label || marketLabelFromAddress(property) || "the market"
  const status = contact.market_status ? ` as ${String(contact.market_status).toLowerCase()}` : ""
  const range = cashRangeFromContact(contact)
  const rangeLine = range.low && range.high
    ? `Based on the public value/listing signal I have, my first-pass as-is cash review would probably start around ${money(range.low)}-${money(range.high)}. That is not a final offer; it depends on photos, access, title, liens, tenant status, and the real condition.`
    : "I would need photos, access, title, lien, tenant, and condition details before putting a real cash number on it."
  const subject = `Question about ${line}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I am reviewing a few on-market and recently surfaced properties in ${market}, and ${line} came across my DealMachine board${status}.`,
    "",
    rangeLine,
    "If the property is cleaner than the data suggests, I can sharpen the number upward after I see more detail. If it needs work or has timing pressure, I can keep the review simple and focus on an as-is path.",
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
  if (ON_MARKET_STRATEGIES.has(STRATEGY)) return buildOnMarketCashReviewEmail(contact)
  if (TAX_CODE_STRATEGIES.has(STRATEGY)) return buildTaxCodeStackEmail(contact)
  if (PORTFOLIO_STRATEGIES.has(STRATEGY)) return buildPortfolioLandlordEmail(contact)
  return buildEmail(contact)
}

function buildText(contact) {
  const line = contact.property_address_full.split(",")[0]
  const first = String(contact.first_name || "").trim().toLowerCase()
  const greeting = first && first !== "there"
    ? `Hi ${contact.first_name},`
    : "Hi,"
  return `${greeting} Robert with VestBlock here. Reaching out about ${line}. Wanted to see if you'd consider selling if the numbers made sense. We have various options depending on the property. Worth a quick conversation? Reply STOP to opt out.`
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

function loadAlreadyContacted() {
  const sentEmails = new Set()
  const sentProperties = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return { sentEmails, sentProperties }
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-outreach-results-") || !file.endsWith(".json")) continue
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
        cash_review_low: queue?.cash_review_low || "",
        cash_review_high: queue?.cash_review_high || "",
        suggested_exit_paths: queue?.suggested_exit_paths || "seller_options",
        buyer_packet_summary: queue?.buyer_packet_summary || queue?.notes || "",
        distress_score: queue ? queueDistressScore(queue) : 0,
        dealmachine_id: queue?.dealmachine_id || hit.lead_id || hit.id || "",
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

function applyStrategyFilter(contacts) {
  const annotated = annotatePortfolioSignals(contacts)
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
      .filter((contact) => String(contact.code_violation_hit || "").toLowerCase() === "true")
      .filter((contact) => contact.tax_delinquent || contact.past_due_amount)
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
  const onMarketStrategy = ON_MARKET_STRATEGIES.has(draft.strategy || STRATEGY)
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
    niche: onMarketStrategy ? "dealmachine_on_market_cash_review" : "dealmachine_owner_contact",
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
    outreach_angle: onMarketStrategy
      ? "On-market/as-is cash review from DealMachine active/pending status"
      : "Seller options review from DealMachine owner-contact export",
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
    if (alreadyContacted.sentProperties.has(propertyKey)) continue
    if (seenEmailProperty.has(propertyKey)) continue

    let emailSelectedForProperty = false
    for (const email of contact.emails) {
      const normalizedEmail = email.toLowerCase()
      const key = `${contact.property_address_full}|${normalizedEmail}`
      if (suppressedEmails.has(normalizedEmail)) continue
      if (seenEmail.has(key) || seenRecipientEmail.has(normalizedEmail) || alreadyContacted.sentEmails.has(normalizedEmail)) continue
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
      email: draft.email,
      property_address_full: draft.property_address_full,
      dealmachine_id: draft.dealmachine_id,
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
