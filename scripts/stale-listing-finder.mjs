/**
 * Stale-listing finder — the Boss Agent's realtor creative-finance play.
 *
 * Pipeline:
 *   1. Harvest fresh on-market listings with high days-on-market/distress
 *      signals for target markets. HomeHarvest is the preferred low-cost
 *      listing source; Outscraper is only used when explicitly requested.
 *   2. Run every listing through the VestBlock property analyzer
 *      (/api/property-analyzer) to get creative-finance structures
 *      (seller finance / subject-to) and deal metrics.
 *   3. Draft agent-facing outreach: a specific creative-terms structure the
 *      listing agent can take to their seller. Listing agents are business
 *      contacts — cleaner compliance posture than cold homeowner contact.
 *
 * DRY RUN BY DEFAULT. Nothing sends unless --send is passed.
 *
 * USAGE:
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --input-csv=data/stale-listings/manual-export.csv
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --input-csv=data/stale-listings/manual-export.csv --send
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --source=homeharvest --offer-mode=lowball --market="Milwaukee, WI|Toledo, OH" --min-dom=30 --limit=100
 *
 * ENV:
 *   OUTSCRAPER_API_KEY   optional, only used with --source=outscraper
 *   ANALYZER_URL         analyzer base URL (default https://vestblock.io)
 *   RESEND_API_KEY       required for --send
 *   FROM_EMAIL           sender (default acquisitions@vestblock.io)
 *   OUTREACH_MAILING_ADDRESS  required for --send (CAN-SPAM)
 *
 * OUTPUT:
 *   data/stale-listings/<market>-<date>.csv          harvest + analyzer numbers
 *   data/stale-listings/agent-call-queue-<date>.csv  agents without email (phone follow-up)
 *   tmp/outreach/stale-listing-drafts-<stamp>.txt    human review file
 *   tmp/outreach/stale-listing-results-<stamp>.json  send log (dedupe source)
 */

import { Resend } from "resend"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (name) => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const MARKETS = (getArg("market") || getArg("markets") || "Milwaukee, WI")
  .split("|")
  .map((m) => m.trim())
  .filter(Boolean)
const MIN_DOM = Number.parseInt(getArg("min-dom") || "90", 10)
const LIMIT = Number.parseInt(getArg("limit") || "25", 10)
const INPUT_CSV = getArg("input-csv")
const THROTTLE_MS = Number.parseInt(getArg("throttle") || "2000", 10)
const BCC = getArg("bcc") || ""
const ANALYZER_BASE = (process.env.ANALYZER_URL || "https://vestblock.io").replace(/\/$/, "")
const OUTSCRAPER_API_BASE_URL = (process.env.OUTSCRAPER_API_BASE_URL || "https://api.datapipeplatform.cloud").replace(/\/+$/, "")
const OFFER_MODE = normalizeSlug(getArg("offer-mode") || getArg("strategy") || "creative")
const SOURCE = normalizeSlug(getArg("source") || (INPUT_CSV ? "csv" : "manual"))
const LOWBALL_MODE = ["lowball", "cash-lowball", "as-is-cash", "on-market-lowball"].includes(OFFER_MODE)
const SKIP_ANALYZER = args.includes("--skip-analyzer") || LOWBALL_MODE
const PAID_SCRAPING_APPROVED = /^(1|true|yes|on)$/i.test(String(process.env.ALLOW_PAID_SCRAPING || "").trim())
const OUTSCRAPER_APPROVED =
  PAID_SCRAPING_APPROVED &&
  /^(1|true|yes|on)$/i.test(String(process.env.LEADS_ENABLE_OUTSCRAPER || "").trim()) &&
  Boolean(String(process.env.OUTSCRAPER_API_KEY || "").trim())
const HOMEHARVEST_PYTHON = getArg("homeharvest-python") || path.join(process.cwd(), ".venv-homeharvest", "bin", "python")
const HOMEHARVEST_LIMIT_PER_MARKET = Number.parseInt(getArg("harvest-limit-per-market") || String(Math.max(LIMIT * 3, 150)), 10)
const PRICE_MAX = Number.parseInt(getArg("price-max") || "450000", 10)
const PRICE_MIN = Number.parseInt(getArg("price-min") || "0", 10)
const DISTRESS_THRESHOLD = Number.parseInt(getArg("distress-threshold") || "10", 10)
const EXCLUDE_PENDING = !args.includes("--include-pending")
const LOWBALL_MIN_PCT = boundedPercent(getArg("cash-min-pct") || "0.50", 0.5)
const LOWBALL_MAX_PCT = boundedPercent(getArg("cash-max-pct") || "0.60", 0.6)

const OUT_DIR = path.join(process.cwd(), "data", "stale-listings")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")
const DATE = new Date().toISOString().slice(0, 10)
const STAMP = new Date().toISOString().replace(/[:.]/g, "-")

function env(name) {
  return String(process.env[name] || "").trim()
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function money(value) {
  if (!Number.isFinite(value) || value <= 0) return null
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function emailBody(lines) {
  return lines.filter((line) => line !== null && line !== undefined && line !== false).join("\n")
}

function firstNameForGreeting(agentName) {
  const raw = String(agentName || "").split(/\s+/).find(Boolean) || ""
  if (!raw) return "there"
  if (raw === raw.toUpperCase() || raw === raw.toLowerCase()) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  }
  return raw
}

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

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function pick(record, keys) {
  for (const key of keys) {
    const hit = Object.entries(record).find(([k]) => normalizeKey(k) === normalizeKey(key))
    if (hit && String(hit[1] ?? "").trim()) return String(hit[1]).trim()
  }
  return ""
}

function pickDeep(record, keys) {
  // search nested objects one level down too (Outscraper nests agent info)
  const direct = pick(record, keys)
  if (direct) return direct
  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = pick(value, keys)
      if (nested) return nested
    }
  }
  return ""
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
}

function numberish(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function marketSlug(market) {
  return market.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function normalizeSlug(value) {
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

function lowballCashRange(listing) {
  if (!Number.isFinite(listing.price) || listing.price <= 0) return { low: 0, high: 0 }
  const minPct = Math.min(LOWBALL_MIN_PCT, LOWBALL_MAX_PCT)
  const maxPct = Math.max(LOWBALL_MIN_PCT, LOWBALL_MAX_PCT)
  const step = listing.price < 20000 ? 500 : 1000
  return {
    low: Math.max(step, Math.floor((listing.price * minPct) / step) * step),
    high: Math.max(step, Math.ceil((listing.price * maxPct) / step) * step),
  }
}

function firstPhone(value) {
  if (Array.isArray(value)) {
    const primary = value.find((entry) => entry?.primary) || value[0]
    if (primary && typeof primary === "object") return String(primary.number || primary.phone || "").trim()
    return String(primary || "").trim()
  }
  if (typeof value === "string") {
    const match = value.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/)
    return match?.[0] || ""
  }
  return ""
}

function listingDistressProfile(listing) {
  const text = [
    listing.text,
    listing.style,
    listing.brokerage,
    listing.office_name,
    listing.mls_status,
    listing.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const keywordWeights = [
    { pattern: /as[-\s]?is|cash only|proof of funds|investor|developers?|land bank|foreclosure|tax foreclosure|auction/i, weight: 16, label: "as-is/cash/investor signal" },
    { pattern: /needs? (work|repair|renovation|updat)|major systems|scope|rehab|fixer|handyman|tlc|distressed/i, weight: 14, label: "repair-heavy language" },
    { pattern: /vacant|condemned|fire damage|water damage|mold|foundation|roof|electrical|plumbing|furnace|water heater/i, weight: 12, label: "condition or vacancy signal" },
    { pattern: /estate|motivated|priced to sell|bring (an )?offer|seller says sell|opportunity/i, weight: 6, label: "motivated-seller language" },
  ]
  let score = 0
  const reasons = []
  for (const { pattern, weight, label } of keywordWeights) {
    if (pattern.test(text)) {
      score += weight
      reasons.push(label)
    }
  }
  if (listing.days_on_market >= 120) {
    score += 22
    reasons.push("120+ DOM")
  } else if (listing.days_on_market >= 90) {
    score += 18
    reasons.push("90+ DOM")
  } else if (listing.days_on_market >= 45) {
    score += 10
    reasons.push("45+ DOM")
  } else if (listing.days_on_market >= 21) {
    score += 5
    reasons.push("21+ DOM")
  }
  if (listing.price > 0 && listing.price <= 75000) {
    score += 14
    reasons.push("sub-75k list")
  } else if (listing.price > 0 && listing.price <= 150000) {
    score += 8
    reasons.push("sub-150k list")
  }
  if (Number(listing.year_built) > 0 && Number(listing.year_built) <= 1940) {
    score += 4
    reasons.push("older structure")
  }
  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 8).join(" | "),
  }
}

// ── Harvest: Outscraper Zillow ────────────────────────────────────────────────

async function harvestOutscraper(market) {
  if (!OUTSCRAPER_APPROVED) {
    return {
      ok: false,
      reason:
        "Outscraper is quarantined. Use --source=homeharvest, or set ALLOW_PAID_SCRAPING=true plus LEADS_ENABLE_OUTSCRAPER=true only after paid scraping is approved.",
      listings: [],
    }
  }

  const apiKey = env("OUTSCRAPER_API_KEY")
  if (!apiKey) {
    return { ok: false, reason: "OUTSCRAPER_API_KEY missing — use --input-csv or add the key to .env.local", listings: [] }
  }

  const params = new URLSearchParams({
    query: `${market} for sale`,
    limit: String(Math.max(LIMIT * 4, 80)),
    async: "false",
  })

  let response
  try {
    response = await fetch(`${OUTSCRAPER_API_BASE_URL}/zillow-search?${params}`, {
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey.replace(/[\r\n\t]/g, ""),
      },
    })
  } catch (error) {
    return { ok: false, reason: `fetch failed: ${error.message}`, listings: [] }
  }

  if (response.status === 402) {
    return {
      ok: false,
      reason:
        "Outscraper returned 402 Payment Required — the Zillow scraper needs credits/billing enabled on your Outscraper account (outscraper.com → Billing). The API key itself is valid.",
      listings: [],
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    return { ok: false, reason: `HTTP ${response.status}: ${text.slice(0, 140)}`, listings: [] }
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    return { ok: false, reason: `invalid JSON: ${error.message}`, listings: [] }
  }

  const records = []
  const data = Array.isArray(payload?.data) ? payload.data : []
  for (const group of data) {
    if (Array.isArray(group)) records.push(...group)
    else if (group && typeof group === "object") records.push(group)
  }

  const listings = records
    .map((record) => mapListing(record, market))
    .filter((listing) => listing.address)

  return { ok: true, reason: "", listings }
}

function mapListing(record, market) {
  const dom = numberish(
    pickDeep(record, ["daysOnZillow", "days_on_zillow", "days on zillow", "daysOnMarket", "days_on_market", "dom", "time on zillow"])
  )
  const [cityGuess, stateGuess] = market.split(",").map((p) => p.trim())
  return {
    market,
    address: pickDeep(record, ["streetAddress", "street_address", "address", "addressStreet", "full_address"]),
    city: pickDeep(record, ["addressCity", "city", "address_city"]) || cityGuess || "",
    state: pickDeep(record, ["addressState", "state", "address_state"]) || stateGuess || "",
    zip: pickDeep(record, ["addressZipcode", "zipcode", "zip", "address_zipcode", "postal_code"]),
    price: numberish(pickDeep(record, ["unformattedPrice", "price", "listPrice", "list_price", "asking_price"])),
    days_on_market: dom,
    beds: pickDeep(record, ["beds", "bedrooms"]),
    baths: pickDeep(record, ["baths", "bathrooms"]),
    sqft: pickDeep(record, ["area", "livingArea", "sqft", "square_feet", "living_area"]),
    listing_url: pickDeep(record, ["detailUrl", "detail_url", "url", "link", "zillow_url"]),
    agent_name: pickDeep(record, ["agentName", "agent_name", "listingAgent", "listing_agent", "brokerName", "broker_name"]),
    agent_phone: pickDeep(record, ["agentPhoneNumber", "agent_phone", "phone", "brokerPhone", "broker_phone"]),
    agent_email: pickDeep(record, ["agentEmail", "agent_email", "email", "brokerEmail", "broker_email"]).toLowerCase(),
    brokerage: pickDeep(record, ["brokerName", "brokerage", "broker_name", "brokerageName"]),
  }
}

function mapHomeHarvestListing(record, market) {
  const agentEmail = String(record.agent_email || record.office_email || "").trim().toLowerCase()
  const agentPhone = firstPhone(record.agent_phones) || firstPhone(record.office_phones)
  return {
    market,
    address: String(record.formatted_address || record.full_street_line || record.street || "").trim(),
    city: String(record.city || "").trim(),
    state: String(record.state || "").trim(),
    zip: String(record.zip_code || "").trim(),
    price: numberish(record.list_price),
    days_on_market: numberish(record.days_on_mls),
    beds: record.beds || "",
    baths: numberish(record.full_baths) + numberish(record.half_baths) * 0.5 || record.full_baths || "",
    sqft: record.sqft || "",
    year_built: record.year_built || "",
    listing_url: String(record.property_url || "").trim(),
    agent_name: String(record.agent_name || "").trim(),
    agent_phone: agentPhone,
    agent_email: agentEmail,
    brokerage: String(record.broker_name || record.office_name || "").trim(),
    office_name: String(record.office_name || "").trim(),
    office_email: String(record.office_email || "").trim().toLowerCase(),
    mls: String(record.mls || "").trim(),
    mls_id: String(record.mls_id || "").trim(),
    status: String(record.status || "").trim(),
    mls_status: String(record.mls_status || "").trim(),
    text: String(record.text || "").replace(/\s+/g, " ").trim(),
    style: String(record.style || "").trim(),
    primary_photo: String(record.primary_photo || "").trim(),
  }
}

function harvestHomeHarvest(market) {
  const script = path.join(process.cwd(), "scripts", "homeharvest-listings.py")
  if (!fs.existsSync(script)) {
    return { ok: false, reason: `missing helper script: ${script}`, listings: [] }
  }
  if (!fs.existsSync(HOMEHARVEST_PYTHON)) {
    return { ok: false, reason: `missing HomeHarvest Python env: ${HOMEHARVEST_PYTHON}`, listings: [] }
  }
  const commandArgs = [
    script,
    `--market=${market}`,
    `--limit=${HOMEHARVEST_LIMIT_PER_MARKET}`,
  ]
  if (PRICE_MAX > 0) commandArgs.push(`--price-max=${PRICE_MAX}`)
  if (PRICE_MIN > 0) commandArgs.push(`--price-min=${PRICE_MIN}`)
  if (EXCLUDE_PENDING) commandArgs.push("--exclude-pending")

  const result = spawnSync(HOMEHARVEST_PYTHON, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status !== 0) {
    return { ok: false, reason: (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 400), listings: [] }
  }

  let rows = []
  try {
    rows = JSON.parse(result.stdout || "[]")
  } catch (error) {
    return { ok: false, reason: `invalid HomeHarvest JSON: ${error.message}`, listings: [] }
  }

  return {
    ok: true,
    reason: "",
    listings: rows.map((record) => mapHomeHarvestListing(record, market)).filter((listing) => listing.address),
  }
}

// ── Harvest: manual CSV ──────────────────────────────────────────────────────

function harvestCsv(file) {
  const resolved = path.resolve(file)
  if (!fs.existsSync(resolved)) throw new Error(`Input CSV not found: ${resolved}`)
  const rows = parseCsvText(fs.readFileSync(resolved, "utf8"))
  const header = rows[0] || []
  const listings = rows.slice(1).map((values) => {
    const record = Object.fromEntries(header.map((col, i) => [col, values[i] || ""]))
    return mapListing(record, pick(record, ["market"]) || MARKETS[0] || "Unknown")
  })
  return listings.filter((listing) => listing.address)
}

// ── Analyzer ─────────────────────────────────────────────────────────────────

async function analyzeListing(listing) {
  try {
    const response = await fetch(`${ANALYZER_BASE}/api/property-analyzer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyAddress: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zip,
        bedrooms: String(listing.beds || ""),
        bathrooms: String(listing.baths || ""),
        squareFeet: String(listing.sqft || ""),
        askingPrice: listing.price ? String(listing.price) : "",
        estimatedValue: listing.price ? String(listing.price) : "",
        timelineToSell: "flexible",
        preferredSalePath: "open_to_creative",
      }),
    })
    if (!response.ok) return { ok: false, reason: `analyzer HTTP ${response.status}` }
    const data = await response.json()
    if (!data?.success) return { ok: false, reason: data?.error || "analyzer rejected input" }
    return { ok: true, opportunity: data.opportunity || null }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

function bestCreativeOffer(opportunity) {
  const offers = Array.isArray(opportunity?.creativeOffers) ? opportunity.creativeOffers : []
  const ranked = ["Meets target", "Borderline", "Needs more inputs", "Below target"]
  return (
    offers
      .slice()
      .sort((a, b) => ranked.indexOf(a.viability) - ranked.indexOf(b.viability))[0] || null
  )
}

// ── Outreach drafts ──────────────────────────────────────────────────────────

function mailingAddress() {
  return env("OUTREACH_MAILING_ADDRESS") || env("BUSINESS_MAILING_ADDRESS") || env("COMPANY_MAILING_ADDRESS")
}

function buildAgentEmail(listing, offer) {
  const firstName = firstNameForGreeting(listing.agent_name)
  const streetLine = listing.address.split(",")[0]
  const domLine = listing.days_on_market ? `${listing.days_on_market} days on market` : "a long time on market"

  const structureLines = []
  if (offer?.metrics) {
    const m = offer.metrics
    const price = money(m.suggestedPurchasePrice)
    const down = money(m.cashToSellerNow ?? m.cashToClose)
    const payment = money(m.monthlyPayment)
    const rate = Number.isFinite(m.noteRatePercent) && m.noteRatePercent > 0 ? `${m.noteRatePercent}%` : null
    const balloon = Number.isFinite(m.balloonYears) && m.balloonYears > 0 ? `${m.balloonYears}-year balloon` : null
    if (price) structureLines.push(`- Purchase price basis: ${price}`)
    if (down) structureLines.push(`- Cash to your seller at close: ${down}`)
    if (payment) structureLines.push(`- Monthly payment on the balance: ${payment}${rate ? ` (${rate} note)` : ""}`)
    if (balloon) structureLines.push(`- Term: ${balloon}`)
  }

  const offerLabel = offer?.label || "a seller-finance structure"
  const subject = `${streetLine} — a terms option for your seller (${domLine})`
  const body = emailBody([
    `Hi ${firstName},`,
    "",
    `I came across your listing at ${listing.address} — I see it's been sitting at ${domLine}${listing.price ? ` around ${money(listing.price)}` : ""}.`,
    "",
    `I work with VestBlock. We connect buyers who close on creative terms when the cash-buyer pool has gone quiet on a listing. For this property, ${offerLabel} could look roughly like:`,
    structureLines.length ? structureLines.join("\n") : "- Happy to put real numbers together if you share the payoff situation.",
    "",
    "These are review numbers, not a contract offer — if your seller is open to terms, I'd put together a clean written proposal you can present. Either way, your commission is respected in the structure.",
    "",
    `Worth a quick conversation about ${streetLine}?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock connects real estate opportunities with buyers, lenders, and partners. We are not a brokerage or lender and do not guarantee any purchase, terms, or closing.",
    'If you would rather not receive these, reply "unsubscribe" and we will remove you.',
    mailingAddress() || null,
  ])

  return { subject, body }
}

function buildLowballAgentEmail(listing) {
  const firstName = firstNameForGreeting(listing.agent_name)
  const streetLine = listing.address.split(",")[0]
  const domLine = listing.days_on_market ? `${listing.days_on_market} days on market` : "a while on market"
  const { low, high } = lowballCashRange(listing)
  const rangeLine = low && high ? `${money(low)}-${money(high)}` : "roughly 50-60% of list"
  const listPriceLine = listing.price ? ` against the ${money(listing.price)} list price` : ""
  const subject = `${streetLine} — as-is cash review`
  const body = emailBody([
    `Hi ${firstName},`,
    "",
    `I came across your listing at ${listing.address}. I see it has been sitting at ${domLine}${listPriceLine}.`,
    "",
    "I work with VestBlock on investor/builder style acquisitions. If the seller would consider a clean as-is path, I can review it quickly and give you a real written number after photos, access, title, and condition are checked.",
    "",
    `Before anyone spends time, the initial cash review would probably start around ${rangeLine}. That is not a final offer, and there may be room to improve if the condition, rent support, repairs, or seller timeline justify it.`,
    "",
    "I know that range is below list. I am not asking you to sell your client short. I am trying to see whether a fast as-is backstop is useful if the property needs work, the seller wants certainty, or the retail buyer pool is not responding.",
    "",
    "If your seller is open to that kind of conversation, send over the best photos/condition notes and any known repair or access details. Your commission can be protected in any structure we seriously review.",
    "",
    `Worth a quick conversation about ${streetLine}?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock connects real estate opportunities with buyers, lenders, and partners. We are not a brokerage or lender and do not guarantee any purchase, terms, or closing.",
    'If you would rather not receive these, reply "unsubscribe" and we will remove you.',
    mailingAddress() || null,
  ])

  return { subject, body }
}

function buildOutboundEmail(listing, offer) {
  if (OFFER_MODE === "lowball" || OFFER_MODE === "cash-lowball" || OFFER_MODE === "as-is-cash") {
    return buildLowballAgentEmail(listing)
  }
  return buildAgentEmail(listing, offer)
}

function loadAlreadySent() {
  const sent = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return sent
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("stale-listing-results-") || !file.endsWith(".json")) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, file), "utf8"))
      if (Array.isArray(rows)) for (const row of rows) if (row?.ok && row?.email) sent.add(row.email.toLowerCase())
    } catch {}
  }
  return sent
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function selectQualifiedListings(scoredListings, alreadySent) {
  const seenAddresses = new Set()
  const qualified = scoredListings
    .filter((listing) => {
      if (LOWBALL_MODE && (!Number.isFinite(listing.price) || listing.price <= 0)) return false
      return LOWBALL_MODE
        ? listing.days_on_market >= MIN_DOM || listing.distress_score >= DISTRESS_THRESHOLD
        : listing.days_on_market >= MIN_DOM
    })
    .filter((listing) => {
      const key = listing.address.toLowerCase()
      if (seenAddresses.has(key)) return false
      seenAddresses.add(key)
      return true
    })
    .sort((a, b) => LOWBALL_MODE
      ? b.distress_score - a.distress_score || b.days_on_market - a.days_on_market || a.address.localeCompare(b.address)
      : b.days_on_market - a.days_on_market)

  if (!LOWBALL_MODE) return { selected: qualified.slice(0, LIMIT), qualifiedCount: qualified.length, reachableCount: 0 }

  const selected = []
  const seenEmails = new Set()
  let reachableCount = 0
  for (const listing of qualified) {
    const email = String(listing.agent_email || "").trim().toLowerCase()
    if (!isEmail(email) || alreadySent.has(email) || seenEmails.has(email)) continue
    reachableCount += 1
    seenEmails.add(email)
    if (selected.length < LIMIT) selected.push(listing)
  }

  if (selected.length < LIMIT) {
    for (const listing of qualified) {
      if (selected.length >= LIMIT) break
      const email = String(listing.agent_email || "").trim().toLowerCase()
      if (email && seenEmails.has(email)) continue
      if (isEmail(email) && alreadySent.has(email)) continue
      if (!listing.agent_phone && !listing.agent_name) continue
      selected.push(listing)
    }
  }

  return { selected, qualifiedCount: qualified.length, reachableCount }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })

  if (SEND && !env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY for --send.")
  if (SEND && !mailingAddress()) throw new Error("Missing OUTREACH_MAILING_ADDRESS for --send (CAN-SPAM).")

  console.log("=== Stale-listing creative finance finder ===")
  console.log(`Mode:      ${SEND ? "LIVE SEND" : "DRY RUN"}`)
  console.log(`Min DOM:   ${MIN_DOM}`)
  console.log(`Limit:     ${LIMIT}`)
  console.log(`Offer:     ${OFFER_MODE}${LOWBALL_MODE ? ` (${Math.round(LOWBALL_MIN_PCT * 100)}-${Math.round(LOWBALL_MAX_PCT * 100)}% condition-dependent)` : ""}`)
  console.log(`Analyzer:  ${SKIP_ANALYZER ? "skipped for this mode" : `${ANALYZER_BASE}/api/property-analyzer`}`)

  // 1. Harvest
  let listings = []
  if (INPUT_CSV) {
    console.log(`Source:    manual CSV (${INPUT_CSV})`)
    listings = harvestCsv(INPUT_CSV)
  } else if (SOURCE === "homeharvest") {
    console.log(`Source:    HomeHarvest on-market listings | markets: ${MARKETS.join(" | ")}`)
    console.log(`Price max: ${PRICE_MAX > 0 ? money(PRICE_MAX) : "none"} | distress threshold: ${DISTRESS_THRESHOLD} | pending: ${EXCLUDE_PENDING ? "excluded" : "included"}`)
    for (const market of MARKETS) {
      const result = harvestHomeHarvest(market)
      if (!result.ok) {
        console.log(`  ${market}: harvest unavailable — ${result.reason}`)
        continue
      }
      console.log(`  ${market}: ${result.listings.length} raw listings`)
      listings.push(...result.listings)
    }
  } else if (SOURCE === "outscraper") {
    console.log(`Source:    Outscraper Zillow | markets: ${MARKETS.join(" | ")}`)
    for (const market of MARKETS) {
      const result = await harvestOutscraper(market)
      if (!result.ok) {
        console.log(`  ${market}: harvest unavailable — ${result.reason}`)
        continue
      }
      console.log(`  ${market}: ${result.listings.length} raw listings`)
      listings.push(...result.listings)
    }
  } else {
    console.log("Source:    manual CSV required (Outscraper disabled by default)")
  }

  if (!listings.length) {
    console.log("\nNo listings harvested. Options:")
    console.log("  - Run with --source=homeharvest for fresh Realtor.com-style on-market listings")
    console.log("  - Export listings manually and rerun with --input-csv=path/to/file.csv")
    console.log("  - Or explicitly pass --source=outscraper only after ALLOW_PAID_SCRAPING=true and LEADS_ENABLE_OUTSCRAPER=true are approved")
    console.log("    (columns: address, city, state, zip, price, days_on_market, agent_name, agent_email, agent_phone)")
    return
  }

  // 2. Filter fresh on-market listings + dedupe + rank by distress/DOM.
  const alreadySent = loadAlreadySent()
  const scoredListings = listings.map((listing) => {
    const profile = listingDistressProfile(listing)
    return { ...listing, distress_score: profile.score, distress_reasons: profile.reasons }
  })
  const { selected: stale, qualifiedCount, reachableCount } = selectQualifiedListings(scoredListings, alreadySent)

  console.log(`\nQualified listings: ${stale.length} selected of ${qualifiedCount} qualified / ${listings.length} harvested`)
  if (LOWBALL_MODE) console.log(`Reachable unique agent emails after prior-send dedupe: ${reachableCount}`)
  if (!stale.length) {
    console.log("Nothing above the DOM/distress threshold. Lower --min-dom/--distress-threshold or widen markets.")
    return
  }

  // 3. Analyze each through the VestBlock calculator
  const analyzed = []
  for (const [index, listing] of stale.entries()) {
    const result = SKIP_ANALYZER ? { ok: false, reason: "skipped for lowball mode" } : await analyzeListing(listing)
    const offer = result.ok ? bestCreativeOffer(result.opportunity) : null
    const dealStrength = result.ok ? result.opportunity?.dealStrength?.label || "" : ""
    analyzed.push({ ...listing, analyzer_ok: result.ok, analyzer_reason: result.ok ? "" : result.reason, deal_strength: dealStrength, offer })
    console.log(
      `  ${index + 1}/${stale.length} ${listing.address} | ${listing.days_on_market} DOM | ${
        result.ok ? `${dealStrength || "analyzed"}${offer ? ` · ${offer.label} (${offer.viability})` : ""}` : `analyzer: ${result.reason}`
      }`
    )
    await sleep(450)
  }

  // 4. Write harvest CSV
  const csvCols = [
    "market", "address", "city", "state", "zip", "price", "days_on_market", "beds", "baths", "sqft",
    "year_built", "listing_url", "agent_name", "agent_phone", "agent_email", "brokerage",
    "status", "mls_status", "mls", "mls_id", "distress_score", "distress_reasons", "deal_strength", "offer_mode", "cash_review_lowball_low", "cash_review_lowball_high", "offer_label", "offer_viability", "offer_price", "offer_down", "offer_monthly", "analyzer_reason",
  ]
  const csvRows = analyzed.map((row) => ({
    ...row,
    offer_mode: OFFER_MODE,
    cash_review_lowball_low: lowballCashRange(row).low || "",
    cash_review_lowball_high: lowballCashRange(row).high || "",
    offer_label: row.offer?.label || "",
    offer_viability: row.offer?.viability || "",
    offer_price: row.offer?.metrics?.suggestedPurchasePrice || "",
    offer_down: row.offer?.metrics?.cashToSellerNow ?? row.offer?.metrics?.cashToClose ?? "",
    offer_monthly: row.offer?.metrics?.monthlyPayment || "",
  }))
  const slug = INPUT_CSV ? "manual" : marketSlug(MARKETS[0])
  const harvestCsvPath = path.join(OUT_DIR, `${slug}-${DATE}.csv`)
  fs.writeFileSync(harvestCsvPath, [csvCols.join(","), ...csvRows.map((r) => csvCols.map((c) => esc(r[c])).join(","))].join("\n"))

  // 5. Split: email drafts vs call queue
  const drafts = []
  const callQueue = []
  const seenDraftEmails = new Set()
  for (const row of analyzed) {
    const normalizedEmail = String(row.agent_email || "").trim().toLowerCase()
    if (isEmail(normalizedEmail) && !alreadySent.has(normalizedEmail) && !seenDraftEmails.has(normalizedEmail)) {
      seenDraftEmails.add(normalizedEmail)
      drafts.push({ ...row, ...buildOutboundEmail(row, row.offer), offer_mode: OFFER_MODE })
    } else if (row.agent_phone || row.agent_name) {
      callQueue.push(row)
    }
  }

  const callCols = ["market", "address", "days_on_market", "price", "agent_name", "agent_phone", "brokerage", "listing_url", "offer_label", "offer_price", "offer_monthly"]
  const callQueuePath = path.join(OUT_DIR, `agent-call-queue-${DATE}.csv`)
  fs.writeFileSync(
    callQueuePath,
    [callCols.join(","), ...callQueue.map((r) => callCols.map((c) => esc(c.startsWith("offer_") ? (c === "offer_label" ? r.offer?.label : c === "offer_price" ? r.offer?.metrics?.suggestedPurchasePrice : r.offer?.metrics?.monthlyPayment) || "" : r[c])).join(","))].join("\n")
  )

  const draftsTxt = path.join(OUTREACH_DIR, `stale-listing-drafts-${STAMP}.txt`)
  fs.writeFileSync(
    draftsTxt,
    drafts.map((d, i) => `#${i + 1} ${d.address} (${d.days_on_market} DOM) <${d.agent_email}>\nSUBJECT: ${d.subject}\n\n${d.body}\n\n${"=".repeat(80)}\n`).join("\n")
  )
  fs.writeFileSync(path.join(OUTREACH_DIR, `stale-listing-drafts-${STAMP}.json`), JSON.stringify(drafts, null, 2))

  console.log(`\nHarvest CSV:   ${harvestCsvPath}`)
  console.log(`Call queue:    ${callQueuePath} (${callQueue.length} agents, phone follow-up)`)
  console.log(`Email drafts:  ${drafts.length} (review: ${draftsTxt})`)

  if (!SEND) {
    console.log("\nDRY RUN complete. Read the drafts file, then re-run with --send.")
    return
  }
  if (!drafts.length) {
    console.log("No email drafts to send (agents without emails are in the call queue).")
    return
  }

  // 6. Send
  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  const from = env("FROM_EMAIL") || "acquisitions@vestblock.io"
  console.log(`\nSending from ${from} with ${THROTTLE_MS}ms throttle...`)
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]
    const payload = { from, to: draft.agent_email, subject: draft.subject, text: draft.body }
    if (BCC) payload.bcc = BCC
    const { data, error } = await resend.emails.send(payload)
    const ok = !error
    results.push({
      ok,
      strategy: LOWBALL_MODE ? "on-market-lowball-agent-sweep" : "stale-listing-creative-finance",
      offer_mode: OFFER_MODE,
      market: draft.market,
      email: draft.agent_email,
      subject: draft.subject,
      address: draft.address,
      price: draft.price,
      days_on_market: draft.days_on_market,
      distress_score: draft.distress_score,
      sent_from: from,
      id: data?.id || null,
      error: error?.message || null,
    })
    console.log(`${ok ? "ok" : "failed"} ${i + 1}/${drafts.length} ${draft.address} ${ok ? data?.id : error?.message}`)
    if (i < drafts.length - 1) await sleep(THROTTLE_MS)
  }
  fs.writeFileSync(path.join(OUTREACH_DIR, `stale-listing-results-${STAMP}.json`), JSON.stringify(results, null, 2))
  const sent = results.filter((r) => r.ok).length
  console.log(`\nDone. Sent ${sent}/${results.length}; failed ${results.length - sent}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
