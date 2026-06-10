/**
 * Stale-listing finder — the Boss Agent's realtor creative-finance play.
 *
 * Pipeline:
 *   1. Harvest for-sale listings with high days-on-market for target markets
 *      (Outscraper Zillow API if OUTSCRAPER_API_KEY is set, or --input-csv
 *      with a manually exported listing file).
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
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --market="Milwaukee, WI" --min-dom=90 --limit=25
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --market="Milwaukee, WI|Cincinnati, OH" --min-dom=120
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --input-csv=data/stale-listings/manual-export.csv
 *   node --env-file=.env.local scripts/stale-listing-finder.mjs --market="Milwaukee, WI" --send
 *
 * ENV:
 *   OUTSCRAPER_API_KEY   enables the Zillow harvest (skipped without it)
 *   ANALYZER_URL         analyzer base URL (default https://vestblock.io)
 *   RESEND_API_KEY       required for --send
 *   FROM_EMAIL           sender (default contact@vestblock.io)
 *   OUTREACH_MAILING_ADDRESS  required for --send (CAN-SPAM)
 *
 * OUTPUT:
 *   data/stale-listings/<market>-<date>.csv          harvest + analyzer numbers
 *   data/stale-listings/agent-call-queue-<date>.csv  agents without email (phone follow-up)
 *   tmp/outreach/stale-listing-drafts-<stamp>.txt    human review file
 *   tmp/outreach/stale-listing-results-<stamp>.json  send log (dedupe source)
 */

import { Resend } from "resend"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
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

// ── Harvest: Outscraper Zillow ────────────────────────────────────────────────

async function harvestOutscraper(market) {
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
    response = await fetch(`https://api.app.outscraper.com/zillow-search?${params}`, {
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
  const firstName = (listing.agent_name || "").split(/\s+/)[0] || "there"
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
  const body = [
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
    "contact@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock connects real estate opportunities with buyers, lenders, and partners. We are not a brokerage or lender and do not guarantee any purchase, terms, or closing.",
    'If you would rather not receive these, reply "unsubscribe" and we will remove you.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, body }
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
  console.log(`Analyzer:  ${ANALYZER_BASE}/api/property-analyzer`)

  // 1. Harvest
  let listings = []
  if (INPUT_CSV) {
    console.log(`Source:    manual CSV (${INPUT_CSV})`)
    listings = harvestCsv(INPUT_CSV)
  } else {
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
  }

  if (!listings.length) {
    console.log("\nNo listings harvested. Options:")
    console.log("  - Add OUTSCRAPER_API_KEY to .env.local (Outscraper has a Zillow search API)")
    console.log("  - Or export listings manually and rerun with --input-csv=path/to/file.csv")
    console.log("    (columns: address, city, state, zip, price, days_on_market, agent_name, agent_email, agent_phone)")
    return
  }

  // 2. Filter stale + dedupe + rank by DOM
  const seen = new Set()
  const stale = listings
    .filter((listing) => listing.days_on_market >= MIN_DOM)
    .filter((listing) => {
      const key = listing.address.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.days_on_market - a.days_on_market)
    .slice(0, LIMIT)

  console.log(`\nStale (>=${MIN_DOM} DOM): ${stale.length} of ${listings.length} harvested`)
  if (!stale.length) {
    console.log("Nothing above the DOM threshold. Lower --min-dom or widen markets.")
    return
  }

  // 3. Analyze each through the VestBlock calculator
  const analyzed = []
  for (const [index, listing] of stale.entries()) {
    const result = await analyzeListing(listing)
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
    "listing_url", "agent_name", "agent_phone", "agent_email", "brokerage",
    "deal_strength", "offer_label", "offer_viability", "offer_price", "offer_down", "offer_monthly", "analyzer_reason",
  ]
  const csvRows = analyzed.map((row) => ({
    ...row,
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
  const alreadySent = loadAlreadySent()
  const drafts = []
  const callQueue = []
  for (const row of analyzed) {
    if (isEmail(row.agent_email) && !alreadySent.has(row.agent_email)) {
      drafts.push({ ...row, ...buildAgentEmail(row, row.offer) })
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
  const from = env("FROM_EMAIL") || "contact@vestblock.io"
  console.log(`\nSending from ${from} with ${THROTTLE_MS}ms throttle...`)
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]
    const payload = { from, to: draft.agent_email, subject: draft.subject, text: draft.body }
    if (BCC) payload.bcc = BCC
    const { data, error } = await resend.emails.send(payload)
    const ok = !error
    results.push({ ok, email: draft.agent_email, address: draft.address, id: data?.id || null, error: error?.message || null })
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
