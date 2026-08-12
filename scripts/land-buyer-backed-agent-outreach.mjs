/**
 * Buyer-backed land finder/outreach.
 *
 * Pulls current on-market land listings, excludes Biloxi when requested, and
 * sends concise agent outreach for an active land buyer.
 *
 * Dry run by default. Use --send for live email.
 */

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { Resend } from "resend"
import { getEmailQualityIssue, normalizeEmailAddress } from "./shared-email-quality.mjs"

const args = process.argv.slice(2)
const SEND = args.includes("--send")

function getArg(name, fallback = "") {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

const MARKETS = (getArg("markets") || "Gulfport, MS|Ocean Springs, MS|Pascagoula, MS|Long Beach, MS|D'Iberville, MS|Gautier, MS")
  .split("|")
  .map((market) => market.trim())
  .filter(Boolean)
const EXCLUDE_MARKETS = new Set(
  (getArg("exclude-markets") || "Biloxi, MS")
    .split("|")
    .map((market) => market.trim().toLowerCase())
    .filter(Boolean),
)
const BUYER_NAME = getArg("buyer", "Manny")
const LIMIT = Number.parseInt(getArg("limit", "20"), 10)
const HARVEST_LIMIT = Number.parseInt(getArg("harvest-limit-per-market", "80"), 10)
const PRICE_MIN = Number.parseInt(getArg("price-min", "0"), 10)
const PRICE_MAX = Number.parseInt(getArg("price-max", "1000000"), 10)
const MIN_ACRES = Number.parseFloat(getArg("min-acres", "0"))
const THROTTLE_MS = Number.parseInt(getArg("throttle", "1800"), 10)
const BCC = getArg("bcc")
const HOMEHARVEST_PYTHON = getArg("homeharvest-python", path.join(process.cwd(), ".venv-homeharvest", "bin", "python"))

const STAMP = new Date().toISOString().replace(/[:.]/g, "-")
const DATE = new Date().toISOString().slice(0, 10)
const OUT_DIR = path.join(process.cwd(), "data", "buyer-opportunities", "land-buyer-backed")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")

function env(name) {
  return String(process.env[name] || "").trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ""
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function acresFromLotSqft(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Number((n / 43560).toFixed(2))
}

function firstName(name) {
  const raw = String(name || "").split(/\s+/).find(Boolean) || ""
  if (!raw) return "there"
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

function phoneList(value) {
  if (!Array.isArray(value)) return ""
  return value.map((entry) => entry?.number).filter(Boolean).join("; ")
}

function listingUrl(record) {
  return record.property_url || (record.permalink ? `https://www.realtor.com/realestateandhomes-detail/${record.permalink}` : "")
}

function scoreListing(listing) {
  let score = 0
  if (listing.days_on_market >= 180) score += 35
  else if (listing.days_on_market >= 90) score += 25
  else if (listing.days_on_market >= 45) score += 12
  if (listing.acres >= 5) score += 25
  else if (listing.acres >= 1) score += 18
  else if (listing.acres >= 0.25) score += 8
  if (listing.price > 0 && listing.price <= 50000) score += 16
  else if (listing.price <= 150000) score += 12
  else if (listing.price <= 300000) score += 7
  if (/water|river|bay|beach|gulf|development|buildable|cleared|utilities|zoned/i.test(listing.notes)) score += 10
  return score
}

function fetchMarket(market) {
  const run = spawnSync(
    HOMEHARVEST_PYTHON,
    [
      "scripts/homeharvest-listings.py",
      "--market",
      market,
      "--limit",
      String(HARVEST_LIMIT),
      "--price-min",
      String(PRICE_MIN),
      "--price-max",
      String(PRICE_MAX),
      "--property-type",
      "land",
      "--exclude-pending",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  )
  if (run.status !== 0) throw new Error(`HomeHarvest failed for ${market}: ${run.stderr || run.stdout}`)
  const records = JSON.parse(run.stdout || "[]")
  return records.map((record) => {
    const cityState = `${record.city || ""}, ${record.state || ""}`.trim().toLowerCase()
    return {
      market,
      city_state: cityState,
      address: String(record.full_street_line || record.street || "").trim(),
      city: String(record.city || "").trim(),
      state: String(record.state || "").trim(),
      zip: String(record.zip_code || "").trim(),
      price: Number(record.list_price || 0),
      acres: acresFromLotSqft(record.lot_sqft),
      lot_sqft: Number(record.lot_sqft || 0),
      days_on_market: Number(record.days_on_mls || 0),
      agent_name: String(record.agent_name || "").trim(),
      agent_email: normalizeEmailAddress(record.agent_email || ""),
      agent_phone: phoneList(record.agent_phones),
      office_name: String(record.office_name || "").trim(),
      url: listingUrl(record),
      notes: String(record.text || "").replace(/\s+/g, " ").trim(),
    }
  })
}

function readPriorRecipients() {
  const recipients = new Set()
  for (const dir of [OUTREACH_DIR, OUT_DIR]) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!/land-buyer-backed-results-.*\.json$/i.test(file)) continue
      const text = fs.readFileSync(path.join(dir, file), "utf8")
      for (const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) recipients.add(match[0].toLowerCase())
    }
  }
  return recipients
}

function buildEmail(listing) {
  const street = listing.address.split(",")[0]
  const subject = `${street} - land buyer question`
  const body = [
    `Hi ${firstName(listing.agent_name)},`,
    "",
    `I saw your land listing at ${listing.address}, ${listing.city}, ${listing.state}${listing.price ? ` listed around ${money(listing.price)}` : ""}.`,
    "",
    `I am working with an active buyer, ${BUYER_NAME}, who is looking at land opportunities on the Gulf Coast outside of Biloxi right now. We are not trying to waste your seller's time - I just want to confirm whether this one is still available and whether the seller has any flexibility on price, terms, or timing.`,
    "",
    "A few quick things that would help us determine fit:",
    "- Is there a recent survey or plat?",
    "- Any known wetlands, flood, access, utility, zoning, or setback issues?",
    "- Would the seller consider a clean cash/fast-close conversation if the numbers work?",
    "- If not cash, would they consider seller finance or another short-term terms arrangement?",
    "",
    `If it is worth reviewing, send over whatever diligence packet you have and I can route it to ${BUYER_NAME}.`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock coordinates real estate deal flow and buyer relationships. Any opportunity is subject to buyer diligence, zoning, access, utilities, title, survey, flood/wetlands review, and final written agreement. We are not a brokerage, lender, attorney, or financial advisor.",
    'If you would rather not receive these, reply "unsubscribe" and we will remove you.',
    env("OUTREACH_MAILING_ADDRESS") || null,
  ]
    .filter(Boolean)
    .join("\n")
  return { ...listing, subject, body }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })

  const harvested = []
  for (const market of MARKETS) {
    const normalized = market.toLowerCase()
    if (EXCLUDE_MARKETS.has(normalized) || normalized.includes("biloxi")) continue
    const listings = fetchMarket(market).filter((listing) => {
      if (!listing.address || !listing.city || !listing.state) return false
      if (EXCLUDE_MARKETS.has(`${listing.city}, ${listing.state}`.toLowerCase())) return false
      if (String(listing.city || "").toLowerCase().includes("biloxi")) return false
      if (listing.price > PRICE_MAX || listing.price < PRICE_MIN) return false
      if (listing.acres < MIN_ACRES) return false
      return true
    })
    harvested.push(...listings)
    console.log(`${market}: ${listings.length} non-Biloxi land listings`)
  }

  const prior = readPriorRecipients()
  const byListing = new Map()
  for (const listing of harvested) {
    const key = `${listing.address}|${listing.city}|${listing.price}`.toLowerCase()
    if (!byListing.has(key)) byListing.set(key, listing)
  }

  const ranked = [...byListing.values()]
    .map((listing) => ({ ...listing, score: scoreListing(listing) }))
    .sort((a, b) => b.score - a.score || b.days_on_market - a.days_on_market || a.price - b.price)

  const callQueue = ranked.filter((listing) => !listing.agent_email || getEmailQualityIssue(listing.agent_email))
  const seenRecipients = new Set()
  const drafts = []
  for (const listing of ranked) {
    if (drafts.length >= LIMIT) break
    if (!listing.agent_email || getEmailQualityIssue(listing.agent_email)) continue
    const recipient = listing.agent_email.toLowerCase()
    if (prior.has(recipient) || seenRecipients.has(recipient)) continue
    seenRecipients.add(recipient)
    drafts.push(buildEmail(listing))
  }

  const columns = [
    "market",
    "address",
    "city",
    "state",
    "zip",
    "price",
    "acres",
    "days_on_market",
    "score",
    "agent_name",
    "agent_email",
    "agent_phone",
    "office_name",
    "url",
    "notes",
  ]
  const harvestCsv = path.join(OUT_DIR, `land-buyer-backed-harvest-${DATE}-${STAMP}.csv`)
  fs.writeFileSync(harvestCsv, [columns.join(","), ...ranked.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n") + "\n")

  const callCsv = path.join(OUT_DIR, `land-buyer-backed-call-queue-${DATE}-${STAMP}.csv`)
  fs.writeFileSync(callCsv, [columns.join(","), ...callQueue.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n") + "\n")

  const draftsJson = path.join(OUTREACH_DIR, `land-buyer-backed-drafts-${STAMP}.json`)
  const draftsTxt = path.join(OUTREACH_DIR, `land-buyer-backed-drafts-${STAMP}.txt`)
  fs.writeFileSync(draftsJson, JSON.stringify(drafts, null, 2))
  fs.writeFileSync(
    draftsTxt,
    drafts.map((draft, index) => `#${index + 1} ${draft.address}, ${draft.city} <${draft.agent_email}>\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\n${"=".repeat(80)}\n`).join("\n"),
  )

  console.log(`Harvested ${ranked.length} ranked non-Biloxi land listings.`)
  console.log(`Drafts: ${drafts.length} -> ${draftsTxt}`)
  console.log(`Call queue: ${callQueue.length} -> ${callCsv}`)

  if (!SEND) return
  if (!env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY.")
  const from = env("OUTREACH_FROM_EMAIL") || env("FROM_EMAIL") || "acquisitions@vestblock.io"
  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  console.log(`Sending ${drafts.length} land buyer-backed emails from ${from}...`)
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]
    const payload = { from, to: draft.agent_email, subject: draft.subject, text: draft.body }
    if (BCC) payload.bcc = BCC
    const { data, error } = await resend.emails.send(payload)
    const ok = !error
    results.push({
      ok,
      strategy: "buyer-backed-land-agent-outreach",
      buyer: BUYER_NAME,
      market: draft.market,
      address: draft.address,
      email: draft.agent_email,
      subject: draft.subject,
      id: data?.id || null,
      error: error?.message || null,
    })
    console.log(`${ok ? "ok" : "failed"} ${index + 1}/${drafts.length} ${draft.address} ${ok ? data?.id : error?.message}`)
    if (index < drafts.length - 1) await sleep(THROTTLE_MS)
  }
  const resultsFile = path.join(OUTREACH_DIR, `land-buyer-backed-results-${STAMP}.json`)
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2))
  console.log(`Done. Sent ${results.filter((result) => result.ok).length}/${results.length}. Results: ${resultsFile}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
