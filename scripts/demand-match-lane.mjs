#!/usr/bin/env node
// Demand-Match lane: outreach ONLY where a confirmed buyer buy box already matches.
//
// The flip: instead of "we buy houses," the copy truthfully cites real (anonymized) demand —
// market, asset type, price band, close speed — pulled from active buy boxes in Supabase.
// Owners whose properties match no active buy box are NOT contacted. No invented demand, ever.
//
// Sources:
//   - Active buy boxes: buyer_buy_boxes (Supabase) or --buy-boxes=path.json offline
//   - Owner contacts:   data/dm-exports/*.csv (DealMachine Contacts exports, matched by market)
//
// Output (review-first, never sends): data/operating-loops/demand-match/
//   demand-match-queue-<stamp>.csv  -> feed through outreach:verify-emails, then guarded send
//
// Usage:
//   npm run outreach:demand-match
//   npm run outreach:demand-match -- --limit=90 --per-market=30

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getEmailQualityIssue, normalizeEmailAddress } from "./shared-email-quality.mjs"

const ROOT = process.cwd()
const EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const OUT_DIR = path.join(ROOT, "data", "operating-loops", "demand-match")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REPLY_LOG_PATH = path.join(ROOT, "data", "operating-loops", "reply-log.jsonl")

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const LIMIT = Number(argValue("limit", 90))
const PER_MARKET = Number(argValue("per-market", 30))
const BUY_BOXES_FILE = argValue("buy-boxes", "")

// Lane strategy -> the asset language a buy box must mention to count as a match.
const STRATEGY_ASSET_TERMS = {
  "portfolio-landlord": ["multifamily", "duplex", "single family", "sfr", "rental", "portfolio"],
  "rent-gap-multifamily": ["multifamily", "duplex", "triplex", "fourplex"],
  "small-multifamily-portfolio": ["multifamily", "duplex", "portfolio"],
  "vacant-equity": ["single family", "sfr", "rehab", "flip", "vacant"],
  "preforeclosure-equity": ["single family", "sfr", "flip", "rental"],
  "tax-code-stack": ["single family", "sfr", "rehab", "flip", "land"],
  "tax-remote-equity-rotation": ["single family", "sfr", "rental"],
  "probate-vacant-equity": ["single family", "sfr", "rehab"],
  "land-wholesale": ["land", "lot", "infill"],
  "builder-infill-teardown": ["land", "lot", "infill", "teardown", "new construction"],
  "lien-equity": ["single family", "sfr", "rehab", "flip"],
  "failed-landlord-exit": ["rental", "tenant", "multifamily", "single family", "sfr"],
}

const money = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Math.round(Number(value)).toLocaleString()}` : null)

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  } catch { return [] }
}

function suppressedEmails() {
  try {
    const data = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, "utf8"))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
    return new Set(rows.map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))
  } catch { return new Set() }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i += 1 } else inQuotes = false } else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ",") { row.push(field); field = "" }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(field); field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += char
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row) }
  return rows
}
const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`

// ---- 1. Load active buy boxes -------------------------------------------------
async function loadBuyBoxes() {
  if (BUY_BOXES_FILE) {
    const data = JSON.parse(fs.readFileSync(path.resolve(ROOT, BUY_BOXES_FILE), "utf8"))
    return Array.isArray(data) ? data : []
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("No Supabase credentials and no --buy-boxes file. Cannot load demand.")
    process.exit(1)
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin
    .from("buyer_buy_boxes")
    .select("asset_types,states,cities,metros,price_min,price_max,closing_speed,active")
    .eq("active", true)
    .limit(500)
  if (error) {
    console.error(`Buy box query failed: ${error.message}`)
    process.exit(1)
  }
  return data || []
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase())
  return String(value || "").split(/[,;|]/).map((v) => v.trim().toLowerCase()).filter(Boolean)
}

function marketFromFile(name) {
  const base = name.toLowerCase().replace(/^direct-/, "").replace(/^vestblock-/, "")
  const match = base.match(/^([a-z-]+)-(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)-/)
  return match ? { city: match[1].replace(/-/g, " "), state: match[2].toUpperCase() } : null
}

function strategyFromFile(name) {
  const lower = name.toLowerCase()
  return Object.keys(STRATEGY_ASSET_TERMS).find((key) => lower.includes(key)) || null
}

function boxMatches(box, market, strategy) {
  const states = normalizeList(box.states)
  const cities = normalizeList(box.cities).concat(normalizeList(box.metros))
  const stateHit = states.includes(market.state.toLowerCase())
  const cityHit = cities.some((c) => c.includes(market.city) || market.city.includes(c.split(",")[0] || c))
  if (!stateHit && !cityHit) return false
  const assets = normalizeList(box.asset_types).join(" ")
  const terms = STRATEGY_ASSET_TERMS[strategy] || []
  return terms.some((term) => assets.includes(term))
}

function draftFor(address, market, matches) {
  const bands = matches
    .map((box) => {
      const lo = money(box.price_min)
      const hi = money(box.price_max)
      return lo && hi ? `${lo}–${hi}` : hi ? `up to ${hi}` : lo ? `${lo}+` : null
    })
    .filter(Boolean)
  const band = bands[0] || null
  const speed = matches.map((box) => String(box.closing_speed || "").trim()).find(Boolean) || null
  const cityLabel = market.city.replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    subject: `Buyer interest near ${address}`,
    body: [
      "Hi,",
      "",
      `I run acquisitions at VestBlock. ${matches.length === 1 ? "A verified buyer" : `${matches.length} verified buyers`} in our network ${matches.length === 1 ? "is" : "are"} actively acquiring properties like yours in ${cityLabel}, ${market.state}${band ? ` in the ${band} range` : ""}${speed ? `, typically closing in ${speed}` : ""}.`,
      "",
      `Your property at ${address} fits the criteria they've given us. If selling has crossed your mind — now or later this year — reply and I'll tell you what the review process looks like. No fees, no obligation, and no pressure if the timing is wrong.`,
    ].join("\n"),
  }
}

// ---- Main ----------------------------------------------------------------------
const buyBoxes = await loadBuyBoxes()
if (!buyBoxes.length) {
  console.error("No active buy boxes found. This lane refuses to run on invented demand — grow the buyer network first (buyer signups now alert you in real time).")
  process.exit(1)
}
console.log(`Demand-Match lane: ${buyBoxes.length} active buy box(es) loaded.`)

const suppressed = suppressedEmails()
const replied = new Set(readJsonl(REPLY_LOG_PATH).map((r) => String(r.email || "").trim().toLowerCase()))

const files = []
const walk = (dir) => {
  let names = []
  try { names = fs.readdirSync(dir) } catch { return }
  for (const name of names) {
    const full = path.join(dir, name)
    try {
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (name.endsWith(".csv")) files.push(full)
    } catch { /* skip */ }
  }
}
walk(EXPORT_DIR)

const seen = new Set()
const perMarket = new Map()
const queue = []
const marketStats = new Map()

for (const file of files) {
  const base = path.basename(file)
  const market = marketFromFile(base)
  const strategy = strategyFromFile(base)
  if (!market || !strategy) continue
  const matches = buyBoxes.filter((box) => boxMatches(box, market, strategy))
  const key = `${market.city}, ${market.state}`
  const stat = marketStats.get(key) || { matches: matches.length, rows: 0 }
  stat.matches = Math.max(stat.matches, matches.length)
  marketStats.set(key, stat)
  if (!matches.length) continue

  const rows = parseCsv(fs.readFileSync(file, "utf8"))
  if (rows.length < 2) continue
  const header = rows[0].map((c) => c.trim().toLowerCase())
  const emailIdx = ["email", "email_address_1"].map((n) => header.indexOf(n)).find((i) => i !== -1)
  const addressIdx = ["property_address_full", "associated_property_address_full", "address"].map((n) => header.indexOf(n)).find((i) => i !== -1)
  if (emailIdx === undefined || addressIdx === undefined) continue

  for (const row of rows.slice(1)) {
    if (queue.length >= LIMIT) break
    const email = normalizeEmailAddress(row[emailIdx])
    const address = String(row[addressIdx] || "").trim()
    if (!email || !address || getEmailQualityIssue(email) !== null) continue
    if (seen.has(email) || suppressed.has(email) || replied.has(email)) continue
    const count = perMarket.get(key) || 0
    if (count >= PER_MARKET) break
    seen.add(email)
    perMarket.set(key, count + 1)
    stat.rows += 1
    const draft = draftFor(address, market, matches)
    queue.push({ email, address, market: key, strategy, matchedBuyBoxes: matches.length, subject: draft.subject, body: draft.body })
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const csvPath = path.join(OUT_DIR, `demand-match-queue-${stamp}.csv`)
fs.writeFileSync(
  csvPath,
  `${[
    ["email", "property_address", "market", "strategy", "matched_buy_boxes", "subject", "body"].join(","),
    ...queue.map((r) => [r.email, r.address, r.market, r.strategy, r.matchedBuyBoxes, r.subject, r.body].map(csvEscape).join(",")),
  ].join("\n")}\n`,
  "utf8"
)

console.log(`\nDemand-matched queue staged (review-first, nothing sent): ${queue.length} owner(s), cap ${LIMIT}, ${PER_MARKET}/market`)
for (const [marketKey, stat] of [...marketStats.entries()].sort((a, b) => b[1].rows - a[1].rows)) {
  console.log(`  ${marketKey}: ${stat.matches} matching buy box(es) → ${stat.rows} owner(s) staged`)
}
console.log(`  CSV: ${csvPath}`)
console.log(`\nNext: npm run outreach:verify-emails -- --csv=${path.relative(ROOT, csvPath)} then send the -verified.csv through the guarded sender.`)
if (queue.length === 0) console.log("Zero drafts means zero matching demand — grow buy boxes before touching these markets. That honesty is the lane.")
