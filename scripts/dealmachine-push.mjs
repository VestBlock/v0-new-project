/**
 * DealMachine integration for VestBlock distress-stack leads.
 *
 * Official API docs:
 *   https://docs.dealmachine.com/
 *
 * What this does:
 *   - Reads data/distress-leads/MASTER-distress-stack.csv
 *   - Sorts stacked distress leads by highest delinquent amount first
 *   - Writes data/distress-leads/dealmachine-import.csv for manual import
 *   - Dry-runs by default
 *   - With --push, creates DealMachine leads through the official API
 *   - Adds a note to each pushed lead with the tax/code/vacancy signal
 *
 * Safety:
 *   - No live API write unless --push is passed
 *   - Does not start mail sequences automatically
 *   - Honors DealMachine's documented 10 req/sec and 5,000 req/day limit
 *
 * Usage:
 *   node scripts/dealmachine-push.mjs
 *   node --env-file=.env.local scripts/dealmachine-push.mjs --pull
 *   node --env-file=.env.local scripts/dealmachine-push.mjs --push --limit=25
 *   node --env-file=.env.local scripts/dealmachine-push.mjs --push --market=milwaukee --limit=100
 *
 * Optional env / args:
 *   DEALMACHINE_API_KEY      required for --pull and --push
 *   DEALMACHINE_LIST_IDS     comma-separated list ids to attach after lead creation
 *   DEALMACHINE_TAG_IDS      comma-separated tag ids to attach after lead creation
 *   DEALMACHINE_LEAD_STATUS_ID optional status id to set after lead creation
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const PUSH = args.includes("--push")
const PULL = args.includes("--pull")
const SKIP_NOTES = args.includes("--skip-notes")
const GEOCODE = !args.includes("--no-geocode")
const SKIP_RANGED = args.includes("--skip-ranged")

const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : null
const MARKET = getArg("market") ? getArg("market").toLowerCase() : null
const INPUT_CSV = getArg("input-csv") || ""
const LIST_IDS = splitIds(getArg("list-ids") || process.env.DEALMACHINE_LIST_IDS || "")
const TAG_IDS = splitIds(getArg("tag-ids") || process.env.DEALMACHINE_TAG_IDS || "")
const LEAD_STATUS_ID = getArg("lead-status-id") || process.env.DEALMACHINE_LEAD_STATUS_ID || ""

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const MASTER = path.join(OUT_DIR, "MASTER-distress-stack.csv")
const IMPORT_CSV = path.join(OUT_DIR, "dealmachine-import.csv")
const PUSHED_LOG = path.join(OUT_DIR, "dealmachine-pushed.json")
const PUSHED_RECORDS = path.join(OUT_DIR, "dealmachine-pushed-records.json")
const GEOCODE_CACHE = path.join(OUT_DIR, "dealmachine-geocode-cache.json")

const API_BASE = "https://api.dealmachine.com/public/v1"
const REQUESTS_PER_SECOND = 10
const DAILY_REQUEST_CAP = 5000
const MIN_DELAY_MS = Math.ceil(1000 / REQUESTS_PER_SECOND)
const STATE_BY_MARKET = { cincinnati: "OH", toledo: "OH", milwaukee: "WI", detroit: "MI", columbus: "OH" }
const DM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "VestBlockDistressStack/1.0 (+https://vestblock.io)",
}

let requestCount = 0
let lastRequestAt = 0
let geocodeCache = null

function splitIds(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseMoney(value) {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function errorMessage(value) {
  if (!value) return "Unknown API error."
  if (typeof value === "string") return value
  if (value.message) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
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

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function readPushedLog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUSHED_LOG, "utf8"))
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((item) => (typeof item === "string" ? item : item?.key)).filter(Boolean))
  } catch {
    return new Set()
  }
}

function writePushedLog(pushed) {
  fs.writeFileSync(PUSHED_LOG, JSON.stringify([...pushed].sort(), null, 2))
}

function readPushedRecords() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUSHED_RECORDS, "utf8"))
    return Array.isArray(parsed) ? parsed.filter((record) => record?.key && record?.dealmachine_id) : []
  } catch {
    return []
  }
}

function writePushedRecords(records) {
  const byKey = new Map()
  for (const record of records) {
    if (record?.key) byKey.set(record.key, record)
  }
  fs.writeFileSync(
    PUSHED_RECORDS,
    JSON.stringify(
      [...byKey.values()].sort((a, b) => String(a.key).localeCompare(String(b.key))),
      null,
      2
    )
  )
}

function upsertPushedRecord(records, record) {
  const index = records.findIndex((existing) => existing.key === record.key)
  if (index >= 0) records[index] = { ...records[index], ...record }
  else records.push(record)
}

function contactSnapshot(data) {
  if (!data || typeof data !== "object") return null
  return {
    has_email_address: Boolean(data.has_email_address),
    has_phone_number: Boolean(data.has_phone_number),
    email_count: Array.isArray(data.email_addresses) ? data.email_addresses.length : 0,
    phone_count: Array.isArray(data.phone_numbers) ? data.phone_numbers.length : 0,
  }
}

function readGeocodeCache() {
  if (geocodeCache) return geocodeCache
  geocodeCache = readJsonFile(GEOCODE_CACHE, {})
  return geocodeCache
}

function writeGeocodeCache() {
  if (!geocodeCache) return
  fs.writeFileSync(GEOCODE_CACHE, JSON.stringify(geocodeCache, null, 2))
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function normalizePropertyAddress(address) {
  return String(address || "")
    .trim()
    .replace(/^(\d+)\s*\/\s*\d+\b/, "$1")
    .replace(/^(\d+)\s*-\s*\d+\b/, "$1")
    .replace(/\s+/g, " ")
}

function geocodeAddressLine(lead) {
  const address = normalizePropertyAddress(lead.property_address)
  return [address, lead.city, lead.state].filter(Boolean).join(", ")
}

async function geocodeLead(lead) {
  if (!GEOCODE) return null
  const query = geocodeAddressLine(lead)
  if (!query) return null
  const cache = readGeocodeCache()
  if (cache[query]) return cache[query]

  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(query)}`
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "VestBlockGeocoder/1.0 (+https://vestblock.io)" },
    })
    const data = await response.json()
    const match = data?.result?.addressMatches?.[0]
    const result = match
      ? {
          ok: true,
          query,
          matched_address: match.matchedAddress || "",
          latitude: match.coordinates?.y || null,
          longitude: match.coordinates?.x || null,
        }
      : { ok: false, query, matched_address: "", latitude: null, longitude: null }
    cache[query] = result
    if (Object.keys(cache).length % 10 === 0) writeGeocodeCache()
    return result
  } catch (error) {
    const result = {
      ok: false,
      query,
      matched_address: "",
      latitude: null,
      longitude: null,
      error: error instanceof Error ? error.message : String(error),
    }
    cache[query] = result
    return result
  }
}

function cleanOwner(value) {
  return String(value || "").replace(/\s*\(mails from [^)]*\)/i, "").trim()
}

function fullAddress(lead) {
  return [lead.property_address, lead.city, lead.state].filter(Boolean).join(", ")
}

function leadKey(lead) {
  return `${lead.market}|${lead.property_address.toLowerCase()}`
}

function isRangedAddress(lead) {
  return /(^|\s)\d+\s*\/\s*\d+\b/.test(String(lead.property_address || ""))
}

function buildLeadNote(lead) {
  return [
    "VestBlock distress stack lead",
    `Market: ${lead.market}`,
    `Stack: ${lead.signal || "public distress signal"} + tax delinquency`,
    `Property: ${fullAddress(lead)}`,
    lead.owner_name ? `Public-record owner: ${lead.owner_name}` : null,
    lead.delinquent_amount ? `Delinquent amount: ${lead.delinquent_amount}` : null,
    lead.foreclosure_flag ? `Foreclosure flag: ${lead.foreclosure_flag}` : null,
    lead.delinquent_parcel ? `Parcel: ${lead.delinquent_parcel}` : null,
    lead.first_seen ? `First seen: ${lead.first_seen}` : null,
    "Seller path: route to Robert/acquisitions for several-option review. No guarantee of offer or closing.",
  ]
    .filter(Boolean)
    .join("\n")
}

function loadLeads() {
  const inputFile = INPUT_CSV ? path.resolve(INPUT_CSV) : MASTER
  if (!fs.existsSync(inputFile)) {
    throw new Error(`No input file found: ${inputFile}`)
  }

  const rows = parseCsv(inputFile)
  const header = rows[0] || []
  const idx = Object.fromEntries(header.map((col, index) => [col, index]))
  const seen = new Set()
  const leads = []

  for (const row of rows.slice(1)) {
    if (!row.length) continue
    const market = String(row[idx.market] || "").trim().toLowerCase()
    const propertyAddress = String(row[idx.address] || row[idx.property_address] || "").trim()
    if (!market || !propertyAddress) continue

    const lead = {
      market,
      property_address: propertyAddress,
      city: String(row[idx.city] || "").trim(),
      state: String(row[idx.state] || STATE_BY_MARKET[market] || "").trim(),
      owner_name: cleanOwner(row[idx.delinquent_owner] || row[idx.owner_name]),
      signal: String(row[idx.violation] || row[idx.case_subtype] || row[idx.case_type] || row[idx.source] || "").trim(),
      violation_date: String(row[idx.violation_date] || row[idx.opened_date] || row[idx.order_issued_date] || "").trim(),
      delinquent_amount: String(row[idx.delinquent_amount] || row[idx.priority_score] || "").trim(),
      delinquent_amount_number: parseMoney(row[idx.delinquent_amount]) || Number(row[idx.priority_score] || 0),
      foreclosure_flag: String(row[idx.foreclosure_flag] || "").trim(),
      delinquent_parcel: String(row[idx.delinquent_parcel] || row[idx.parcel] || "").trim(),
      first_seen: String(row[idx.first_seen] || "").trim(),
      last_seen: String(row[idx.last_seen] || "").trim(),
    }

    const key = leadKey(lead)
    if (seen.has(key)) continue
    seen.add(key)
    leads.push(lead)
  }

  leads.sort((a, b) => {
    if (b.delinquent_amount_number !== a.delinquent_amount_number) {
      return b.delinquent_amount_number - a.delinquent_amount_number
    }
    return fullAddress(a).localeCompare(fullAddress(b))
  })

  return MARKET ? leads.filter((lead) => lead.market === MARKET) : leads
}

function writeImportCsv(leads) {
  const cols = [
    "full_address",
    "property_address",
    "city",
    "state",
    "owner_name",
    "market",
    "distress_stack",
    "delinquent_amount",
    "foreclosure_flag",
    "parcel",
    "first_seen",
    "notes",
  ]
  const rows = leads.map((lead) => ({
    full_address: fullAddress(lead),
    property_address: lead.property_address,
    city: lead.city,
    state: lead.state,
    owner_name: lead.owner_name,
    market: lead.market,
    distress_stack: lead.signal || "public distress signal + tax delinquency",
    delinquent_amount: lead.delinquent_amount,
    foreclosure_flag: lead.foreclosure_flag,
    parcel: lead.delinquent_parcel,
    first_seen: lead.first_seen,
    notes: buildLeadNote(lead).replace(/\n/g, " | "),
  }))

  fs.writeFileSync(
    IMPORT_CSV,
    [cols.join(","), ...rows.map((row) => cols.map((col) => esc(row[col])).join(","))].join("\n")
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pace() {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed)
  lastRequestAt = Date.now()
}

async function dmRequest(apiKey, endpoint, { method = "GET", form = null } = {}) {
  if (requestCount >= DAILY_REQUEST_CAP) {
    throw new Error(`DealMachine daily request cap reached locally (${DAILY_REQUEST_CAP}).`)
  }

  await pace()
  requestCount++

  const headers = {
    ...DM_HEADERS,
    Authorization: `Bearer ${apiKey}`,
  }
  const init = { method, headers }

  if (form) {
    const body = new FormData()
    for (const [key, value] of Object.entries(form)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        body.set(key, String(value))
      }
    }
    init.body = body
  }

  const response = await fetch(`${API_BASE}${endpoint}`, init)
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok || data?.error) {
    return {
      ok: false,
      status: response.status,
      error: errorMessage(data?.error || data?.message || data?.raw || `HTTP ${response.status}`),
      data,
    }
  }

  return { ok: true, status: response.status, data }
}

async function pullLeads(apiKey, limit = 25) {
  const result = await dmRequest(apiKey, `/leads/?limit=${limit}&after=0`)
  if (!result.ok) return result
  const leads = Array.isArray(result.data?.data) ? result.data.data : []
  return { ok: true, count: leads.length, leads }
}

async function addLead(apiKey, lead) {
  const geocoded = await geocodeLead(lead)
  const attempts = []
  if (geocoded?.ok && geocoded.matched_address) {
    attempts.push({ label: "census_matched_full_address", form: { full_address: geocoded.matched_address } })
  }

  attempts.push({ label: "normalized_full_address", form: { full_address: geocodeAddressLine(lead) } })

  if (geocoded?.ok && geocoded.latitude && geocoded.longitude) {
    attempts.push({ label: "lat_lng", form: { lat: geocoded.latitude, lng: geocoded.longitude } })
    attempts.push({ label: "latitude_longitude", form: { latitude: geocoded.latitude, longitude: geocoded.longitude } })
  }

  let last = null
  for (const attempt of attempts) {
    const result = await dmRequest(apiKey, "/leads/", {
      method: "POST",
      form: attempt.form,
    })
    if (result.ok) return result
    last = { ...result, error: `${attempt.label}: ${result.error}` }
    if (!/property not found/i.test(String(result.error))) break
  }
  return last || { ok: false, error: "No DealMachine add attempt was made." }
}

async function updateLeadStatus(apiKey, leadId) {
  if (!LEAD_STATUS_ID) return { ok: true, skipped: true }
  return dmRequest(apiKey, `/leads/${leadId}/lead-status`, {
    method: "POST",
    form: { lead_status_id: LEAD_STATUS_ID },
  })
}

async function addLeadToLists(apiKey, leadId) {
  if (!LIST_IDS.length) return { ok: true, skipped: true }
  return dmRequest(apiKey, `/leads/${leadId}/add-to-list`, {
    method: "POST",
    form: { list_ids: LIST_IDS.join(",") },
  })
}

async function addTagsToLead(apiKey, leadId) {
  if (!TAG_IDS.length) return { ok: true, skipped: true }
  return dmRequest(apiKey, `/leads/${leadId}/add-tags`, {
    method: "POST",
    form: { tag_ids: TAG_IDS.join(",") },
  })
}

async function createNote(apiKey, leadId, lead) {
  if (SKIP_NOTES) return { ok: true, skipped: true }
  return dmRequest(apiKey, `/leads/${leadId}/create-note`, {
    method: "POST",
    form: { note: buildLeadNote(lead) },
  })
}

async function pushLead(apiKey, lead) {
  const added = await addLead(apiKey, lead)
  if (!added.ok) return { ok: false, stage: "add", error: added.error }

  const leadId = added.data?.data?.id
  if (!leadId) return { ok: false, stage: "add", error: "DealMachine returned no lead id." }

  const postSteps = [
    ["note", () => createNote(apiKey, leadId, lead)],
    ["status", () => updateLeadStatus(apiKey, leadId)],
    ["list", () => addLeadToLists(apiKey, leadId)],
    ["tag", () => addTagsToLead(apiKey, leadId)],
  ]

  const warnings = []
  for (const [stage, run] of postSteps) {
    const result = await run()
    if (!result.ok) warnings.push(`${stage}: ${result.error}`)
  }

  return { ok: true, leadId, warnings, contactSnapshot: contactSnapshot(added.data?.data) }
}

async function main() {
  if (PULL) {
    if (!process.env.DEALMACHINE_API_KEY) {
      throw new Error("Missing DEALMACHINE_API_KEY.")
    }
    const pulled = await pullLeads(process.env.DEALMACHINE_API_KEY, LIMIT || 25)
    if (!pulled.ok) throw new Error(`DealMachine read failed: ${pulled.error}`)
    console.log(`DealMachine API OK. Retrieved ${pulled.count} lead sample(s).`)
    const sample = pulled.leads.slice(0, 5).map((lead) => ({
      id: lead.id,
      status: lead.lead_status?.label || "",
      source: lead.lead_source || "",
      address: lead.property_address_full || lead.address || lead.owner_address_full || "",
      phones: lead.phone_numbers?.length || lead.contactability?.phone_count || 0,
      emails: lead.email_addresses?.length || lead.contactability?.email_count || 0,
    }))
    console.table(sample)
    return
  }

  const pushed = readPushedLog()
  const pushedRecords = readPushedRecords()
  let leads = loadLeads().filter((lead) => !pushed.has(leadKey(lead)))
  if (SKIP_RANGED) leads = leads.filter((lead) => !isRangedAddress(lead))
  if (LIMIT) leads = leads.slice(0, LIMIT)

  writeImportCsv(leads)

  console.log("=== DealMachine distress stack sync ===")
  console.log(`Mode:       ${PUSH ? "LIVE PUSH" : "DRY RUN"}`)
  console.log(`Market:     ${MARKET || "all"}`)
  console.log(`Input:      ${INPUT_CSV ? path.resolve(INPUT_CSV) : MASTER}`)
  console.log(`New leads:  ${leads.length}${LIMIT ? ` (limit ${LIMIT})` : ""}`)
  console.log(`Already pushed locally: ${pushed.size}`)
  console.log(`Import CSV: ${IMPORT_CSV}`)

  if (!leads.length) return

  console.log("\nTop priority sample:")
  for (const lead of leads.slice(0, 8)) {
    console.log(
      `  ${lead.delinquent_amount || "$0"} | ${fullAddress(lead)} | ${lead.owner_name || "owner unknown"} | ${lead.signal || "signal"}`
    )
  }

  if (!PUSH) {
    console.log("\nDry run only. Use --push with DEALMACHINE_API_KEY to create leads in DealMachine.")
    console.log("Recommended first live run: node --env-file=.env.local scripts/dealmachine-push.mjs --push --limit=25")
    return
  }

  if (!process.env.DEALMACHINE_API_KEY) {
    throw new Error("Missing DEALMACHINE_API_KEY.")
  }

  const estimatedRequestsPerLead =
    1 + (SKIP_NOTES ? 0 : 1) + (LEAD_STATUS_ID ? 1 : 0) + (LIST_IDS.length ? 1 : 0) + (TAG_IDS.length ? 1 : 0)
  const maxLeadsByRequestBudget = Math.floor(DAILY_REQUEST_CAP / estimatedRequestsPerLead)
  if (leads.length > maxLeadsByRequestBudget) {
    console.log(
      `Capping this run from ${leads.length} to ${maxLeadsByRequestBudget} leads to stay under ${DAILY_REQUEST_CAP} API requests/day.`
    )
    leads = leads.slice(0, maxLeadsByRequestBudget)
  }

  let ok = 0
  let failed = 0
  const apiKey = process.env.DEALMACHINE_API_KEY

  for (const [index, lead] of leads.entries()) {
    const result = await pushLead(apiKey, lead)
    if (result.ok) {
      ok++
      const key = leadKey(lead)
      pushed.add(key)
      upsertPushedRecord(pushedRecords, {
        key,
        dealmachine_id: result.leadId,
        pushed_at: new Date().toISOString(),
        full_address: fullAddress(lead),
        property_address: lead.property_address,
        city: lead.city,
        state: lead.state,
        market: lead.market,
        owner_name: lead.owner_name,
        distress_stack: lead.signal || "public distress signal + tax delinquency",
        delinquent_amount: lead.delinquent_amount,
        foreclosure_flag: lead.foreclosure_flag,
        parcel: lead.delinquent_parcel,
        first_seen: lead.first_seen,
        contact_snapshot: result.contactSnapshot,
      })
      if (ok % 10 === 0) {
        writePushedLog(pushed)
        writePushedRecords(pushedRecords)
      }
      const warn = result.warnings?.length ? ` warnings: ${result.warnings.join("; ")}` : ""
      console.log(`  ${index + 1}/${leads.length} ok ${result.leadId}: ${fullAddress(lead)}${warn}`)
    } else {
      failed++
      console.log(`  ${index + 1}/${leads.length} failed ${result.stage}: ${fullAddress(lead)} - ${result.error}`)
    }
  }

  writePushedLog(pushed)
  writePushedRecords(pushedRecords)
  console.log(`\nComplete. Pushed ${ok}/${leads.length}; failed ${failed}; API requests used this run: ${requestCount}.`)
  console.log("No mail sequence was started by this script.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
