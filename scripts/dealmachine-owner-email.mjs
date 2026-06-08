/**
 * DealMachine owner email follow-up for VestBlock distress-stack leads.
 *
 * Reads data/distress-leads/dealmachine-pushed-records.json, fetches the exact
 * DealMachine lead records, extracts returned owner email addresses, writes a
 * contact report, and sends a soft seller-option email through Resend.
 *
 * DRY RUN BY DEFAULT. Nothing sends unless --send is passed.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-owner-email.mjs --limit=100
 *   node --env-file=.env.local scripts/dealmachine-owner-email.mjs --limit=100 --address-pass
 *   node --env-file=.env.local scripts/dealmachine-owner-email.mjs --limit=100 --export=/path/to/dealmachine-export.csv
 *   node --env-file=.env.local scripts/dealmachine-owner-email.mjs --limit=100 --send
 */

import { Resend } from "resend"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 100
const THROTTLE_MS = getArg("throttle") ? Number.parseInt(getArg("throttle"), 10) : 2200
const BCC = getArg("bcc") || ""
const ONLY_RECENT = !args.includes("--all")
const EXPORT_PATH = getArg("export") || getArg("csv") || ""
const ADDRESS_PASS = args.includes("--address-pass")

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const RECORDS_PATH = path.join(OUT_DIR, "dealmachine-pushed-records.json")
const CONTACTS_CSV = path.join(OUT_DIR, "dealmachine-owner-email-contacts.csv")
const CONTACTS_JSON = path.join(OUT_DIR, "dealmachine-owner-email-contacts.json")
const EXPORT_NEEDED_CSV = path.join(OUT_DIR, "dealmachine-email-export-needed.csv")
const ADDRESS_PASS_CSV = path.join(OUT_DIR, "dealmachine-address-pass-results.csv")
const ADDRESS_PASS_JSON = path.join(OUT_DIR, "dealmachine-address-pass-results.json")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")

const API_BASE = "https://api.dealmachine.com/public/v1"
const DM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "VestBlockOwnerEmail/1.0 (+https://vestblock.io)",
}

function env(name) {
  return String(process.env[name] || "").trim()
}

function sender() {
  return env("FROM_EMAIL") || "contact@vestblock.io"
}

function mailingAddress() {
  return (
    env("OUTREACH_MAILING_ADDRESS") ||
    env("BUSINESS_MAILING_ADDRESS") ||
    env("COMPANY_MAILING_ADDRESS") ||
    env("PUBLIC_BUSINESS_ADDRESS")
  )
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function loadRecords() {
  const records = readJson(RECORDS_PATH, [])
  if (!Array.isArray(records)) return []
  return records
    .filter((record) => record?.dealmachine_id)
    .sort((a, b) => String(b.pushed_at || "").localeCompare(String(a.pushed_at || "")))
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
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

function pick(row, names) {
  for (const name of names) {
    const key = normalizeKey(name)
    if (row[key]) return row[key]
  }
  return ""
}

function addressPartsFromFull(fullAddress) {
  const parts = String(fullAddress || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const propertyLine = parts[0] || ""
  const city = parts[1] || ""
  const statePart = parts[2] || ""
  const state = (statePart.match(/\b[A-Z]{2}\b/i)?.[0] || "").toUpperCase()
  return { propertyLine, city, state }
}

function loadDealMachineExport(filePath) {
  if (!filePath) return []
  if (!fs.existsSync(filePath)) throw new Error(`DealMachine export not found: ${filePath}`)
  if (!/\.csv$/i.test(filePath)) {
    throw new Error("DealMachine export import currently expects a CSV file. Export/download the sheet as CSV and rerun.")
  }

  const rows = parseCsvText(fs.readFileSync(filePath, "utf8"))
  const header = rows[0] || []
  const contacts = []

  for (const values of rows.slice(1)) {
    const row = Object.fromEntries(header.map((col, index) => [normalizeKey(col), String(values[index] || "").trim()]))
    const allText = values.join(" ")
    const emails = [...new Set((allText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase()))]
      .filter(isUsableOwnerEmail)

    if (!emails.length) continue

    const firstName = pick(row, ["first name", "first_name"])
    const lastName = pick(row, ["last name", "last_name"])
    const ownerName =
      pick(row, ["owner name", "owner 1 name", "owner_1_name", "owner"]) ||
      [firstName, lastName].filter(Boolean).join(" ")
    const exportedFullAddress =
      pick(row, [
        "associated property address full",
        "associated_property_address_full",
        "property address full",
        "property_address_full",
        "full address",
        "property full address",
      ]) || ""
    const parsed = addressPartsFromFull(exportedFullAddress)
    const propertyLine =
      pick(row, ["property address", "property_address", "address", "street address", "property address line 1"]) ||
      parsed.propertyLine
    const city = pick(row, ["property city", "city"]) || parsed.city
    const state = (pick(row, ["property state", "state"]) || parsed.state).toUpperCase()
    const fullAddress = exportedFullAddress || [propertyLine, city, state].filter(Boolean).join(", ")
    const dealmachineId = pick(row, ["id", "lead id", "lead_id", "dealmachine id", "dealmachine_id"])

    for (const email of emails) {
      contacts.push({
        email,
        dealmachine_id: dealmachineId,
        full_address: fullAddress,
        property_line: propertyLine || "the property",
        city_state: [city, state].filter(Boolean).join(", "),
        first_name: firstName || firstNameFromOwnerName(ownerName),
        owner_name: ownerName,
        market: "",
        pushed_at: "",
        source_key: normalizeAddress(fullAddress),
        contact_source: "dealmachine_export_csv",
      })
    }
  }

  return contacts
}

function indexRecords(records) {
  const byId = new Map()
  const byAddress = new Map()
  for (const record of records) {
    if (record.dealmachine_id) byId.set(String(record.dealmachine_id), record)
    const candidates = [record.full_address, [record.property_address, record.city, record.state].filter(Boolean).join(", ")]
    for (const candidate of candidates) {
      const key = normalizeAddress(candidate)
      if (key) byAddress.set(key, record)
    }
  }
  return { byId, byAddress }
}

function loadAlreadySent() {
  const sent = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return sent
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-owner-email-results-") || !file.endsWith(".json")) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, file), "utf8"))
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (row?.ok && row?.email) sent.add(String(row.email).toLowerCase())
      }
    } catch {}
  }
  return sent
}

async function dmRequest(apiKey, endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { ...DM_HEADERS, Authorization: `Bearer ${apiKey}` },
  })
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
      error: data?.error || data?.message || data?.raw || `HTTP ${response.status}`,
      data,
    }
  }
  return { ok: true, status: response.status, data: data?.data || data }
}

async function dmFormRequest(apiKey, endpoint, form) {
  const body = new FormData()
  for (const [key, value] of Object.entries(form)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      body.set(key, String(value))
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { ...DM_HEADERS, Authorization: `Bearer ${apiKey}` },
    body,
  })
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
      error: data?.error?.message || data?.error || data?.message || data?.raw || `HTTP ${response.status}`,
      data,
    }
  }
  return { ok: true, status: response.status, data: data?.data || data }
}

function propertyFullAddressForPass(lead, record) {
  const apiFull = String(lead?.property_address_full || "").trim()
  if (apiFull) return apiFull
  const line = String(lead?.property_address_line_1 || record.property_address || "").trim()
  const city = String(lead?.property_address_city || record.city || "").trim()
  const state = String(lead?.property_address_state || record.state || "").trim()
  const zip = String(lead?.property_address_zipcode || "").trim()
  return [line, city, state, zip].filter(Boolean).join(", ")
}

async function runAddressPass(apiKey, lead, record) {
  const fullAddress = propertyFullAddressForPass(lead, record)
  const forms = []
  if (fullAddress) forms.push({ label: "full_address", form: { full_address: fullAddress } })
  if (lead?.property_latitude && lead?.property_longitude) {
    forms.push({ label: "lat_lng", form: { lat: lead.property_latitude, lng: lead.property_longitude } })
  }
  if (lead?.property_address_line_1 && lead?.property_address_city && lead?.property_address_state && lead?.property_address_zipcode) {
    forms.push({
      label: "parsed_address",
      form: {
        address: lead.property_address_line_1,
        city: lead.property_address_city,
        state: lead.property_address_state,
        zip: lead.property_address_zipcode,
      },
    })
  }

  const attempts = []
  const emails = new Set()
  let latestLead = lead
  for (const attempt of forms) {
    const result = await dmFormRequest(apiKey, "/leads/", attempt.form)
    attempts.push({
      label: attempt.label,
      ok: result.ok,
      status: result.status,
      error: result.error || null,
    })

    const returnedLead = Array.isArray(result.data) ? result.data[0] : result.data?.data || result.data
    const returnedId = returnedLead?.id
    if (returnedLead) {
      latestLead = returnedLead
      for (const email of extractEmails(returnedLead)) emails.add(email)
    }
    if (returnedId) {
      const fetched = await dmRequest(apiKey, `/leads/${returnedId}`)
      if (fetched.ok) {
        latestLead = fetched.data || latestLead
        for (const email of extractEmails(fetched.data)) emails.add(email)
      }
    }

    if ([...emails].length) break
    if (result.error && /already added/i.test(String(result.error))) break
    await sleep(180)
  }

  const refetched = await dmRequest(apiKey, `/leads/${record.dealmachine_id}`)
  if (refetched.ok) {
    latestLead = refetched.data || latestLead
    for (const email of extractEmails(refetched.data)) emails.add(email)
  }

  return {
    fullAddress,
    attempts,
    emails: [...emails],
    lead: latestLead,
  }
}

function emailFromItem(item) {
  if (typeof item === "string") return item.trim().toLowerCase()
  if (!item || typeof item !== "object") return ""
  const value =
    item.email ||
    item.email_address ||
    item.address ||
    item.value ||
    item.emailAddress ||
    item.EmailAddress ||
    ""
  return String(value || "").trim().toLowerCase()
}

function extractEmailsDeep(value, emails = new Set()) {
  if (typeof value === "string") {
    for (const hit of value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []) {
      if (isUsableOwnerEmail(hit)) emails.add(hit.toLowerCase())
    }
    return [...emails]
  }
  if (!value || typeof value !== "object") return [...emails]
  if (Array.isArray(value)) {
    for (const item of value) extractEmailsDeep(item, emails)
    return [...emails]
  }
  for (const item of Object.values(value)) {
    extractEmailsDeep(item, emails)
  }
  return [...emails]
}

function extractEmails(lead) {
  const emails = new Set()
  const raw = Array.isArray(lead?.email_addresses) ? lead.email_addresses : []
  for (const item of raw) {
    const email = emailFromItem(item)
    if (isUsableOwnerEmail(email)) emails.add(email)
  }
  for (const email of extractEmailsDeep(lead)) {
    emails.add(email)
  }
  return [...emails]
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

function firstNameFromLead(lead, record) {
  const explicit = String(lead?.owner_1_firstname || "").trim()
  if (explicit) return explicit
  return firstNameFromOwnerName(lead?.owner_1_name || record.owner_name || "")
}

function propertyLine(lead, record) {
  return (
    String(lead?.property_address_line_1 || "").trim() ||
    String(record.property_address || "").trim() ||
    String(lead?.property_address_full || "").split(",")[0].trim() ||
    "the property"
  )
}

function cityState(lead, record) {
  const city = String(lead?.property_address_city || record.city || "").trim()
  const state = String(lead?.property_address_state || record.state || "").trim()
  return [city, state].filter(Boolean).join(", ")
}

function buildEmail(contact) {
  const property = contact.property_line
  const location = contact.city_state ? ` in ${contact.city_state}` : ""
  const ownerLine = contact.owner_name ? `I have ${contact.owner_name} connected to the property record.` : ""
  const signalLine = contact.distress_stack
    ? `The note I have on this file is: ${contact.distress_stack}.`
    : "The property came through my review list, so I wanted to ask directly instead of making assumptions."
  const amountLine = contact.delinquent_amount
    ? `I also have a public-record amount noted as ${contact.delinquent_amount}; if that is outdated or not relevant, no problem.`
    : ""
  const subject = `Question about ${property}`
  const address = mailingAddress()
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I wanted to ask about ${property}${location}. ${ownerLine}`,
    "",
    signalLine,
    amountLine,
    "",
    "If it would help, I can review this specific property and walk through several options. I am not sending a blind offer or promising a closing; I only want to see whether one of those options is realistic for this property.",
    "",
    `Would you be open to a quick conversation about ${property}, or is this not something you want to discuss right now?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "contact@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee funding, approvals, sale timelines, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    address,
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, body }
}

function writeContacts(contacts) {
  const cols = [
    "email",
    "dealmachine_id",
    "full_address",
    "property_line",
    "city_state",
    "owner_name",
    "market",
    "pushed_at",
    "source_key",
    "contact_source",
    "distress_stack",
    "delinquent_amount",
  ]
  fs.writeFileSync(
    CONTACTS_CSV,
    [
      cols.join(","),
      ...contacts.map((contact) => cols.map((col) => esc(contact[col])).join(",")),
    ].join("\n")
  )
  fs.writeFileSync(CONTACTS_JSON, JSON.stringify(contacts, null, 2))
}

function writeExportNeeded(rows) {
  const cols = [
    "dealmachine_id",
    "full_address",
    "property_address",
    "city",
    "state",
    "owner_name",
    "market",
    "has_email_address",
    "has_phone_number",
    "note",
  ]
  fs.writeFileSync(
    EXPORT_NEEDED_CSV,
    [
      cols.join(","),
      ...rows.map((row) => cols.map((col) => esc(row[col])).join(",")),
    ].join("\n")
  )
}

function writeAddressPassRows(rows) {
  const cols = [
    "dealmachine_id",
    "full_address",
    "owner_name",
    "market",
    "address_pass_ran",
    "email_found",
    "email_count",
    "already_added",
    "attempt_summary",
  ]
  fs.writeFileSync(
    ADDRESS_PASS_CSV,
    [
      cols.join(","),
      ...rows.map((row) => cols.map((col) => esc(row[col])).join(",")),
    ].join("\n")
  )
  fs.writeFileSync(ADDRESS_PASS_JSON, JSON.stringify(rows, null, 2))
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

async function main() {
  if (!env("DEALMACHINE_API_KEY")) throw new Error("Missing DEALMACHINE_API_KEY.")
  if (SEND && !env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY.")
  if (SEND && !sender()) throw new Error("Missing FROM_EMAIL.")
  if (SEND && !mailingAddress()) {
    throw new Error("Missing OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS.")
  }

  const records = loadRecords()
  const selected = (ONLY_RECENT ? records.slice(0, LIMIT) : records).slice(0, LIMIT)
  if (!selected.length) throw new Error("No DealMachine pushed records found. Push leads first.")

  const alreadySent = loadAlreadySent()
  const recordIndex = indexRecords(selected)
  const contactsByEmail = new Map()
  let fetched = 0
  let fetchFailures = 0
  let withEmail = 0
  let flaggedEmailHidden = 0
  let addressPassRuns = 0
  let addressPassAlreadyAdded = 0
  let addressPassFoundEmails = 0
  const exportNeeded = []
  const addressPassRows = []

  for (const record of selected) {
    const result = await dmRequest(env("DEALMACHINE_API_KEY"), `/leads/${record.dealmachine_id}`)
    fetched++
    if (!result.ok) {
      fetchFailures++
      console.log(`fetch failed ${record.dealmachine_id}: ${result.error}`)
      continue
    }
    const lead = result.data || {}
    let leadForDraft = lead
    let emails = extractEmails(lead)

    if (!emails.length && ADDRESS_PASS && lead?.has_email_address) {
      addressPassRuns++
      const addressPass = await runAddressPass(env("DEALMACHINE_API_KEY"), lead, record)
      leadForDraft = addressPass.lead || lead
      emails = [...new Set([...emails, ...addressPass.emails])]
      const alreadyAdded = addressPass.attempts.some((attempt) => /already added/i.test(String(attempt.error || "")))
      addressPassRows.push({
        dealmachine_id: record.dealmachine_id,
        full_address: addressPass.fullAddress,
        owner_name: leadForDraft.owner_1_name || record.owner_name || "",
        market: record.market || "",
        address_pass_ran: "true",
        email_found: emails.length ? "true" : "false",
        email_count: emails.length,
        already_added: alreadyAdded ? "true" : "false",
        attempt_summary: addressPass.attempts
          .map((attempt) => `${attempt.label}:${attempt.ok ? "ok" : attempt.error || `HTTP ${attempt.status}`}`)
          .join(" | "),
      })
      if (alreadyAdded) {
        addressPassAlreadyAdded++
      }
      if (emails.length) {
        addressPassFoundEmails++
        console.log(`address-pass found email ${record.dealmachine_id} ${addressPass.fullAddress}`)
      } else {
        const finalAttempt = addressPass.attempts.find((attempt) => attempt.error) || addressPass.attempts.at(-1)
        console.log(
          `address-pass no email ${record.dealmachine_id} ${addressPass.fullAddress} ${finalAttempt?.error || finalAttempt?.label || ""}`
        )
      }
    }

    if (emails.length) withEmail++
    if (!emails.length && lead?.has_email_address) {
      flaggedEmailHidden++
      exportNeeded.push({
        dealmachine_id: record.dealmachine_id,
        full_address: record.full_address || leadForDraft.property_address_full || "",
        property_address: record.property_address || propertyLine(leadForDraft, record),
        city: record.city || leadForDraft.property_address_city || "",
        state: record.state || leadForDraft.property_address_state || "",
        owner_name: leadForDraft.owner_1_name || record.owner_name || "",
        market: record.market || "",
        has_email_address: "true",
        has_phone_number: leadForDraft?.has_phone_number ? "true" : "false",
        note: "DealMachine API flagged owner email as available but did not expose the email address. Export these leads from DealMachine as CSV and rerun this script with --export=/path/to/export.csv.",
      })
    }
    for (const email of emails) {
      if (alreadySent.has(email)) continue
      if (contactsByEmail.has(email)) continue
      contactsByEmail.set(email, {
        email,
        dealmachine_id: record.dealmachine_id,
        full_address: record.full_address || leadForDraft.property_address_full || "",
        property_line: propertyLine(leadForDraft, record),
        city_state: cityState(leadForDraft, record),
        first_name: firstNameFromLead(leadForDraft, record),
        owner_name: leadForDraft.owner_1_name || record.owner_name || "",
        market: record.market || "",
        pushed_at: record.pushed_at || "",
        source_key: record.key || "",
        contact_source: ADDRESS_PASS ? "dealmachine_api_address_pass" : "dealmachine_api",
        distress_stack: record.distress_stack || "",
        delinquent_amount: record.delinquent_amount || "",
      })
    }
    await sleep(120)
  }

  let exportContactsAdded = 0
  for (const exportContact of loadDealMachineExport(EXPORT_PATH)) {
    if (alreadySent.has(exportContact.email)) continue
    if (contactsByEmail.has(exportContact.email)) continue
    const matchedRecord =
      recordIndex.byId.get(String(exportContact.dealmachine_id || "")) ||
      recordIndex.byAddress.get(normalizeAddress(exportContact.full_address))
    if (!matchedRecord) continue
    contactsByEmail.set(exportContact.email, {
      ...exportContact,
      dealmachine_id: exportContact.dealmachine_id || matchedRecord?.dealmachine_id || "",
      full_address: exportContact.full_address || matchedRecord?.full_address || "",
      property_line: exportContact.property_line || matchedRecord?.property_address || "the property",
      city_state: exportContact.city_state || [matchedRecord?.city, matchedRecord?.state].filter(Boolean).join(", "),
      owner_name: exportContact.owner_name || matchedRecord?.owner_name || "",
      market: exportContact.market || matchedRecord?.market || "",
      pushed_at: exportContact.pushed_at || matchedRecord?.pushed_at || "",
      source_key: exportContact.source_key || matchedRecord?.key || "",
      distress_stack: matchedRecord?.distress_stack || "",
      delinquent_amount: matchedRecord?.delinquent_amount || "",
    })
    exportContactsAdded++
  }

  const contacts = [...contactsByEmail.values()]
  const drafts = contacts.map((contact) => ({ ...contact, ...buildEmail(contact) }))

  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  writeContacts(contacts)
  writeExportNeeded(exportNeeded)
  if (ADDRESS_PASS) writeAddressPassRows(addressPassRows)
  fs.writeFileSync(
    path.join(OUTREACH_DIR, `dealmachine-owner-email-drafts-${stamp}.txt`),
    drafts
      .map(
        (draft, index) =>
          `#${index + 1} ${draft.property_line} <${draft.email}>\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\n${"=".repeat(80)}\n`
      )
      .join("\n")
  )
  fs.writeFileSync(path.join(OUTREACH_DIR, `dealmachine-owner-email-drafts-${stamp}.json`), JSON.stringify(drafts, null, 2))

  console.log("=== DealMachine owner email ===")
  console.log(`Mode:              ${SEND ? "LIVE SEND (Resend)" : "DRY RUN"}`)
  console.log(`DealMachine leads: ${selected.length}`)
  console.log(`Fetched:           ${fetched}`)
  console.log(`Fetch failures:    ${fetchFailures}`)
  console.log(`Leads with email:  ${withEmail}`)
  console.log(`Email hidden flag: ${flaggedEmailHidden}`)
  console.log(`Address-pass runs: ${addressPassRuns}`)
  console.log(`Already added:     ${addressPassAlreadyAdded}`)
  console.log(`Address-pass hit:  ${addressPassFoundEmails}`)
  console.log(`Export contacts:   ${exportContactsAdded}`)
  console.log(`Unique emails:     ${drafts.length}`)
  console.log(`Contacts CSV:      ${CONTACTS_CSV}`)
  console.log(`Export-needed CSV: ${EXPORT_NEEDED_CSV}`)
  if (ADDRESS_PASS) console.log(`Address-pass CSV:  ${ADDRESS_PASS_CSV}`)
  console.log(`Draft review:      ${path.join(OUTREACH_DIR, `dealmachine-owner-email-drafts-${stamp}.txt`)}`)

  if (!drafts.length) {
    console.log("No emails returned by DealMachine for this batch. No Resend messages sent.")
    return
  }

  if (!SEND) {
    console.log("Dry run only. Re-run with --send to deliver through Resend.")
    return
  }

  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  console.log(`Sending from ${sender()} with ${THROTTLE_MS}ms throttle.`)
  for (let index = 0; index < drafts.length; index++) {
    const draft = drafts[index]
    const result = await sendWithResend(resend, draft)
    results.push({
      email: draft.email,
      dealmachine_id: draft.dealmachine_id,
      full_address: draft.full_address,
      subject: draft.subject,
      ...result,
    })
    console.log(`${result.ok ? "ok" : "failed"} ${index + 1}/${drafts.length} ${draft.dealmachine_id} ${result.ok ? result.id : result.error}`)
    if (index < drafts.length - 1) await sleep(THROTTLE_MS)
  }

  const sent = results.filter((result) => result.ok).length
  fs.writeFileSync(path.join(OUTREACH_DIR, `dealmachine-owner-email-results-${stamp}.json`), JSON.stringify(results, null, 2))
  console.log(`Done. Sent ${sent}/${results.length}; failed ${results.length - sent}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
