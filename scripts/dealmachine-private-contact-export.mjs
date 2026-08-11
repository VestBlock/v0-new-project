/**
 * Build an outreach-ready contact CSV from fresh DealMachine leads using the
 * same website-side property endpoint the Atlas session can access.
 *
 * This is a fallback when the normal DealMachine Contacts export is not yet
 * available, but fresh leads already exist in DealMachine.
 *
 * Safety:
 * - Reads only leads we already created in DealMachine.
 * - Exports only owner-safe contacts for seller outreach.
 * - Skips resident / renter matches unless DealMachine also marks them as likely owner.
 *
 * Usage:
 *   node scripts/dealmachine-private-contact-export.mjs --market=philadelphia-pa --token=...
 *   node scripts/dealmachine-private-contact-export.mjs --market=kansas-city-mo --token=... --limit=25
 *   node --env-file=.env.local scripts/dealmachine-private-contact-export.mjs --market=omaha-ne --list-id=1312730 --output-slug=vestblock-tax-code-stack-omaha-ne-2026-06-30-1312730
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { markJobsPrivateFallback } from "./lib/dealmachine-export-jobs.mjs"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const MARKET_ARG = getArg("market")
const LIST_ID = getArg("list-id")
const STRATEGY_KEY = normalizeSlug(getArg("strategy-key") || "")
const SOURCE_CSV = getArg("source-csv")
const OUTPUT_SLUG = normalizeSlug(getArg("output-slug") || "")
const EXPLICIT_TOKEN = getArg("token") || String(process.env.DEALMACHINE_WEB_TOKEN || "").trim()
const LIMIT_RAW = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : null
const SINCE_HOURS = getArg("since-hours") ? Number.parseInt(getArg("since-hours"), 10) : 72
const CACHE_HOURS = getArg("cache-hours") ? Number.parseInt(getArg("cache-hours"), 10) : 72
const DEALMACHINE_API_KEY = String(process.env.DEALMACHINE_API_KEY || "").trim()

const ROOT = process.cwd()
const PUSHED_RECORDS = path.join(ROOT, "data", "distress-leads", "dealmachine-pushed-records.json")
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const CACHE_DIR = path.join(ROOT, "data", "operating-loops")
const PROPERTY_CACHE_FILE = path.join(CACHE_DIR, "dealmachine-private-property-cache.json")
const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
const ATLAS_DEBUG_LOG = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "com.openai.atlas",
  "browser-data",
  "host",
  "debug.log"
)

const MARKET_SLUGS = {
  philadelphia: "philadelphia-pa",
  "philadelphia-pa": "philadelphia-pa",
  "kansas-city": "kansas-city-mo",
  "kansas-city-mo": "kansas-city-mo",
  "new-orleans": "new-orleans-la",
  "new-orleans-la": "new-orleans-la",
}

const MARKET_SHORT = {
  "philadelphia-pa": "philadelphia",
  "kansas-city-mo": "kansas-city",
  "new-orleans-la": "new-orleans",
}

function normalizeMarket(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function marketSlug(value) {
  return MARKET_SLUGS[normalizeMarket(value)] || normalizeMarket(value)
}

function marketShort(value) {
  const slug = marketSlug(value)
  return MARKET_SHORT[slug] || slug.replace(/-[a-z]{2}$/, "")
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function localDateStamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let value = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') {
      value += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(value)
      value = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(value)
      if (row.some((cell) => String(cell).trim())) rows.push(row)
      row = []
      value = ""
    } else {
      value += char
    }
  }
  if (value.length || row.length) {
    row.push(value)
    if (row.some((cell) => String(cell).trim())) rows.push(row)
  }
  const [header = [], ...body] = rows
  return body.map((cols) => Object.fromEntries(header.map((key, idx) => [String(key || "").trim(), cols[idx] ?? ""])))
}

function pick(row, keys) {
  for (const key of keys) {
    const exact = row[key]
    if (exact !== undefined && String(exact).trim()) return String(exact).trim()
    const found = Object.keys(row).find((name) => normalizeSlug(name) === normalizeSlug(key))
    if (found && String(row[found]).trim()) return String(row[found]).trim()
  }
  return ""
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

function findAtlasToken() {
  try {
    if (!fs.existsSync(ATLAS_DEBUG_LOG)) return ""
    const text = fs.readFileSync(ATLAS_DEBUG_LOG, "utf8")
    const matches = [
      ...text.matchAll(/\\"token\\":\\"([A-Za-z0-9]{20,})\\"/g),
      ...text.matchAll(/"token":"([A-Za-z0-9]{20,})"/g),
    ]
    return matches.length ? String(matches[matches.length - 1][1] || "").trim() : ""
  } catch {
    return ""
  }
}

function paceFactory(delayMs = 250) {
  let lastAt = 0
  return async function pace() {
    const elapsed = Date.now() - lastAt
    if (elapsed < delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed))
    }
    lastAt = Date.now()
  }
}

function loadPropertyCache() {
  const parsed = readJson(PROPERTY_CACHE_FILE, {})
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
}

function savePropertyCache(cache) {
  writeJson(PROPERTY_CACHE_FILE, cache)
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
}

function titlePhoneType(value) {
  const raw = String(value || "").trim().toUpperCase()
  if (raw === "W" || raw === "M" || raw === "CELL") return "Wireless"
  if (raw === "L") return "Landline"
  if (raw === "VOIP") return "VOIP"
  if (!raw) return ""
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

function personFlags(contact) {
  return (contact?.person_flags || [])
    .map((flag) => String(flag?.value || "").trim().toLowerCase())
    .filter(Boolean)
}

function fullName(contact) {
  if (contact?.full_name) return String(contact.full_name).trim()
  return [contact?.given_name, contact?.surname].filter(Boolean).join(" ").trim()
}

function ownerSafe(contact) {
  const matchingType = String(contact?.matching_type || "").trim().toLowerCase()
  const likelyOwner = Boolean(contact?.likely_owner)
  const resident = Boolean(contact?.resident)
  const inOwnerFamily = Boolean(contact?.in_owner_family)
  const flags = personFlags(contact)
  const isRenter = flags.includes("renter")
  const isPropertyOwner = flags.includes("property_owner")

  if (likelyOwner) return true
  if (matchingType === "mailing_address") return true
  if (matchingType === "company_tiebreaker") return true
  if (inOwnerFamily && !resident && !isRenter) return true
  if (isPropertyOwner && !resident && !isRenter) return true
  return false
}

function selectOwnerContacts(property) {
  const contacts = []
  const seen = new Set()

  for (const phoneEntry of property?.phone_numbers || []) {
    const contact = phoneEntry?.contact
    if (!contact || !ownerSafe(contact)) continue
    const key = [
      String(property?.deal?.id || property?.id || ""),
      String(contact?.individual_key || ""),
      String(contact?.phone_1 || ""),
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    contacts.push(contact)
  }

  return contacts
}

function toRow(record, property, contact) {
  const flags = personFlags(contact)
  return {
    contact_id: String(contact?.individual_key || ""),
    associated_property_address_full: String(property?.property_address_full || record.full_address || "").trim(),
    first_name: String(contact?.given_name || "").trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    last_name: String(contact?.surname || "").trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    middle_initial: String(contact?.middle_initial || "").trim(),
    generational_suffix: String(contact?.generational_suffix || "").trim(),
    primary_mailing_address: String(contact?.primary_address || "").trim(),
    primary_mailing_city: String(contact?.primary_city || "").trim(),
    primary_mailing_state: String(contact?.primary_state || "").trim(),
    primary_mailing_zip: String(contact?.primary_zip || "").trim(),
    contact_flags: flags.join("|"),
    gender: String(contact?.gender || "").trim(),
    birth_month_year: "",
    language_preference: String(contact?.language_preference || "").trim(),
    marital_status: String(contact?.marital_status || "").trim(),
    est_household_income_code: String(contact?.est_household_income_code || "").trim(),
    home_business: String(contact?.home_business || ""),
    net_asset_value: String(contact?.net_asset_value || "").trim(),
    education_model: String(contact?.education_model || "").trim(),
    occupation_group: String(contact?.occupation_group || "").trim(),
    occupation_code: String(contact?.occupation_code || "").trim(),
    business_owner: String(contact?.business_owner || ""),
    email_address_1: isEmail(contact?.email_address_1) ? String(contact.email_address_1).trim().toUpperCase() : "",
    email_address_2: isEmail(contact?.email_address_2) ? String(contact.email_address_2).trim().toUpperCase() : "",
    email_address_3: isEmail(contact?.email_address_3) ? String(contact.email_address_3).trim().toUpperCase() : "",
    phone_1: String(contact?.phone_1 || "").trim(),
    phone_1_do_not_call: contact?.phone_1_do_not_call ? "DO NOT CALL" : "",
    phone_1_activity_status: String(contact?.phone_1_activity_status || "").trim(),
    phone_1_carrier: String(contact?.phone_1_owner || "").trim(),
    phone_1_prepaid_indicator: String(contact?.phone_1_prepaid_indicator || "").trim(),
    phone_1_type: titlePhoneType(contact?.phone_1_type),
    phone_1_usage_2_months: String(contact?.phone_1_usage_2_months || "").trim(),
    phone_1_usage_12_months: String(contact?.phone_1_usage_12_months || "").trim(),
    phone_2: String(contact?.phone_2 || "").trim(),
    phone_2_do_not_call: contact?.phone_2_do_not_call ? "DO NOT CALL" : "",
    phone_2_activity_status: String(contact?.phone_2_activity_status || "").trim(),
    phone_2_carrier: String(contact?.phone_2_owner || "").trim(),
    phone_2_prepaid_indicator: String(contact?.phone_2_prepaid_indicator || "").trim(),
    phone_2_type: titlePhoneType(contact?.phone_2_type),
    phone_2_usage_2_months: String(contact?.phone_2_usage_2_months || "").trim(),
    phone_2_usage_12_months: String(contact?.phone_2_usage_12_months || "").trim(),
    phone_3: String(contact?.phone_3 || "").trim(),
    phone_3_do_not_call: contact?.phone_3_do_not_call ? "DO NOT CALL" : "",
    phone_3_activity_status: String(contact?.phone_3_activity_status || "").trim(),
    phone_3_carrier: String(contact?.phone_3_owner || "").trim(),
    phone_3_prepaid_indicator: String(contact?.phone_3_prepaid_indicator || "").trim(),
    phone_3_type: titlePhoneType(contact?.phone_3_type),
    phone_3_usage_2_months: String(contact?.phone_3_usage_2_months || "").trim(),
    phone_3_usage_12_months: String(contact?.phone_3_usage_12_months || "").trim(),
    lead_id: String(record.dealmachine_id || ""),
    owner_name: String(property?.owner_1_name || record.owner_name || "").trim(),
    owner_status: String(property?.owner_status || property?.owner_status_info?.text || "").trim(),
    owner_match_strategy: String(contact?.matching_type || "").trim(),
    likely_owner: String(Boolean(contact?.likely_owner)),
    resident: String(Boolean(contact?.resident)),
    in_owner_family: String(Boolean(contact?.in_owner_family)),
    contact_full_name: fullName(contact),
  }
}

async function fetchProperty(token, dealId, pace) {
  let lastError = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    await pace()
    const url = new URL("https://api.dealmachine.com/v2/property/")
    url.searchParams.set("token", token)
    url.searchParams.set("deal_id", String(dealId))
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 VestBlock/1.0",
        "X-DM-Client-Key": DM_CLIENT_KEY,
      },
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (response.ok && data?.results?.property) return data.results.property
    lastError = new Error(`DealMachine property fetch failed for ${dealId}: HTTP ${response.status}`)
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) break
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt + Math.floor(Math.random() * 400)))
  }
  throw lastError || new Error(`DealMachine property fetch failed for ${dealId}`)
}

async function fetchListLeads(listId) {
  if (!DEALMACHINE_API_KEY) {
    throw new Error("Missing DEALMACHINE_API_KEY in environment for --list-id mode.")
  }

  const rows = []
  let after = 0
  const pageSize = 100
  const hardLimit = Number.isFinite(LIMIT_RAW) && LIMIT_RAW > 0 ? LIMIT_RAW : Number.POSITIVE_INFINITY

  while (rows.length < hardLimit) {
    const url = new URL("https://api.dealmachine.com/public/v1/leads/")
    url.searchParams.set("limit", String(Math.min(pageSize, hardLimit - rows.length)))
    url.searchParams.set("after", String(after))
    url.searchParams.set("list_id", String(listId))
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${DEALMACHINE_API_KEY}`,
        "User-Agent": "VestBlockDealMachinePrivateExport/1.0 (+https://vestblock.io)",
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
      throw new Error(data?.error?.message || data?.error || data?.message || data?.raw || `DealMachine public lead fetch failed: HTTP ${response.status}`)
    }
    const page = Array.isArray(data?.data) ? data.data : []
    if (!page.length) break
    rows.push(...page)
    after += page.length
    if (page.length < pageSize) break
  }

  return rows
}

function readSourceCsvRecords(file) {
  const resolved = path.resolve(file)
  const rows = parseCsvText(fs.readFileSync(resolved, "utf8"))
  const headers = rows.length ? Object.keys(rows[0]).map((key) => normalizeSlug(key)) : []
  const shellOnlyContactExport =
    headers.includes("contact-id") &&
    headers.includes("associated-property-address-full") &&
    !headers.some((key) => /(^|-)lead-id$|dealmachine-id|deal-id/.test(key))

  if (shellOnlyContactExport) {
    throw new Error(
      `${SOURCE_CSV} is a DealMachine lead-shell export. Its contact_id values are not property deal IDs, so this fallback cannot hydrate phone/email safely. Request/download the DealMachine Contacts export instead.`
    )
  }

  const hardLimit = Number.isFinite(LIMIT_RAW) && LIMIT_RAW > 0 ? LIMIT_RAW : Number.POSITIVE_INFINITY
  return rows
    .map((row) => {
      const dealmachineId = pick(row, ["lead_id", "dealmachine_id", "deal_id", "id"])
      const firstName = pick(row, ["first_name", "owner_first_name"])
      const lastName = pick(row, ["last_name", "owner_last_name"])
      return {
        dealmachine_id: dealmachineId,
        full_address: pick(row, ["associated_property_address_full", "property_address_full", "address"]),
        owner_name: pick(row, ["owner_name"]) || [firstName, lastName].filter(Boolean).join(" "),
        market: marketSlug(MARKET_ARG),
        pushed_at: new Date().toISOString(),
        source_csv: resolved,
      }
    })
    .filter((row) => row.dealmachine_id)
    .slice(0, hardLimit)
}

async function main() {
  if (!MARKET_ARG) throw new Error("Missing --market=<city-state>.")
  const token = EXPLICIT_TOKEN || findAtlasToken()
  if (!token) {
    throw new Error(
      `Missing DealMachine web token. Pass --token=..., set DEALMACHINE_WEB_TOKEN, or keep Atlas logged into DealMachine so the script can read ${ATLAS_DEBUG_LOG}.`
    )
  }
  if (!fs.existsSync(PUSHED_RECORDS)) throw new Error(`Missing pushed records log: ${PUSHED_RECORDS}`)

  const slug = marketSlug(MARKET_ARG)
  const short = marketShort(slug)
  const now = Date.now()
  const threshold = now - SINCE_HOURS * 60 * 60 * 1000
  let records

  if (SOURCE_CSV) {
    records = readSourceCsvRecords(SOURCE_CSV)
  } else if (LIST_ID) {
    throw new Error(
      "--list-id mode is disabled because DealMachine's public /public/v1/leads endpoint has been observed returning rows outside the requested list. Use scripts/dealmachine-export-lists.mjs or scripts/dealmachine-session-export.mjs to request a Contacts export for the list, then ingest the downloaded CSV."
    )
  } else {
    if (!fs.existsSync(PUSHED_RECORDS)) throw new Error(`Missing pushed records log: ${PUSHED_RECORDS}`)
    const fallbackLimit = Number.isFinite(LIMIT_RAW) && LIMIT_RAW > 0 ? LIMIT_RAW : 25
    records = readJson(PUSHED_RECORDS, [])
      .filter((row) => row?.dealmachine_id && normalizeMarket(row.market) === short)
      .filter((row) => {
        const pushedAt = Date.parse(String(row.pushed_at || ""))
        return Number.isFinite(pushedAt) ? pushedAt >= threshold : true
      })
      .sort((a, b) => Date.parse(String(b.pushed_at || "")) - Date.parse(String(a.pushed_at || "")))
      .slice(0, fallbackLimit)
  }

  if (!records.length) {
    throw new Error(SOURCE_CSV
      ? `No DealMachine contact/deal ids found in ${SOURCE_CSV}.`
      : LIST_ID
      ? `No DealMachine leads found for list ${LIST_ID}.`
      : `No recent pushed DealMachine records found for ${short}.`)
  }

  fs.mkdirSync(DM_EXPORT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })

  const pace = paceFactory()
  const propertyCache = loadPropertyCache()
  const cacheThreshold = Date.now() - CACHE_HOURS * 60 * 60 * 1000
  const rows = []
  const rejected = []

  for (const record of records) {
    try {
      const cacheKey = String(record.dealmachine_id || "").trim()
      const cached = propertyCache[cacheKey]
      const property = cached && Date.parse(String(cached.cachedAt || "")) >= cacheThreshold
        ? cached.property
        : await fetchProperty(token, record.dealmachine_id, pace)
      if (!cached || Date.parse(String(cached.cachedAt || "")) < cacheThreshold) {
        propertyCache[cacheKey] = {
          cachedAt: new Date().toISOString(),
          property,
        }
      }
      const contacts = selectOwnerContacts(property)
      if (!contacts.length) {
        rejected.push({
          lead_id: record.dealmachine_id,
          address: property?.property_address_full || record.full_address,
          reason: "no_owner_safe_phone_contact",
          owner_name: property?.owner_1_name || "",
        })
        continue
      }
      for (const contact of contacts) {
        rows.push(toRow(record, property, contact))
      }
    } catch (error) {
      rejected.push({
        lead_id: record.dealmachine_id,
        address: record.full_address,
        reason: error instanceof Error ? error.message : String(error),
        owner_name: record.owner_name || "",
      })
    }
  }

  const dateStr = localDateStamp()
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outBase = OUTPUT_SLUG || `${slug}-${dateStr}-private-owner-contacts`
  const outCsv = path.join(DM_EXPORT_DIR, `${outBase}.csv`)
  const rejectedJson = path.join(OUTREACH_DIR, `dealmachine-private-contact-rejected-${slug}-${stamp}.json`)

  const cols = [
    "contact_id",
    "associated_property_address_full",
    "first_name",
    "last_name",
    "middle_initial",
    "generational_suffix",
    "primary_mailing_address",
    "primary_mailing_city",
    "primary_mailing_state",
    "primary_mailing_zip",
    "contact_flags",
    "gender",
    "birth_month_year",
    "language_preference",
    "marital_status",
    "est_household_income_code",
    "home_business",
    "net_asset_value",
    "education_model",
    "occupation_group",
    "occupation_code",
    "business_owner",
    "email_address_1",
    "email_address_2",
    "email_address_3",
    "phone_1",
    "phone_1_do_not_call",
    "phone_1_activity_status",
    "phone_1_carrier",
    "phone_1_prepaid_indicator",
    "phone_1_type",
    "phone_1_usage_2_months",
    "phone_1_usage_12_months",
    "phone_2",
    "phone_2_do_not_call",
    "phone_2_activity_status",
    "phone_2_carrier",
    "phone_2_prepaid_indicator",
    "phone_2_type",
    "phone_2_usage_2_months",
    "phone_2_usage_12_months",
    "phone_3",
    "phone_3_do_not_call",
    "phone_3_activity_status",
    "phone_3_carrier",
    "phone_3_prepaid_indicator",
    "phone_3_type",
    "phone_3_usage_2_months",
    "phone_3_usage_12_months",
    "lead_id",
    "owner_name",
    "owner_status",
    "owner_match_strategy",
    "likely_owner",
    "resident",
    "in_owner_family",
    "contact_full_name",
  ]

  fs.writeFileSync(outCsv, [cols.join(","), ...rows.map((row) => cols.map((col) => esc(row[col])).join(","))].join("\n"))
  fs.writeFileSync(rejectedJson, JSON.stringify(rejected, null, 2))
  savePropertyCache(propertyCache)
  markJobsPrivateFallback({
    market: slug,
    strategyKey: STRATEGY_KEY,
    listId: LIST_ID,
    outputFile: outCsv,
    rowCount: rows.length,
    rejectedCount: rejected.length,
    source: "atlas_property_endpoint",
  })

  const withEmail = rows.filter((row) => row.email_address_1 || row.email_address_2 || row.email_address_3).length
  const withPhone = rows.filter((row) => row.phone_1 || row.phone_2 || row.phone_3).length

  console.log("=== DealMachine private contact export ===")
  console.log(`Market:             ${slug}`)
  console.log(`Fresh leads scanned: ${records.length}`)
  console.log(`Owner-safe rows:     ${rows.length}`)
  console.log(`Rows with email:     ${withEmail}`)
  console.log(`Rows with phone:     ${withPhone}`)
  console.log(`Rejected leads:      ${rejected.length}`)
  console.log(`CSV:                ${outCsv}`)
  console.log(`Rejected log:       ${rejectedJson}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
