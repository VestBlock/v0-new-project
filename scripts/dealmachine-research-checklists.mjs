/**
 * Create internal Research Checklist rows from a DealMachine Contacts export.
 *
 * Dry run by default. Pass --apply to write to Supabase with service-role env vars.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-research-checklists.mjs \
 *     --market=philadelphia-pa \
 *     --export-csv=data/dm-exports/philadelphia-pa-2026-06-09-private-owner-contacts.csv
 *
 *   node --env-file=.env.local scripts/dealmachine-research-checklists.mjs \
 *     --market=philadelphia-pa \
 *     --export-csv=data/dm-exports/philadelphia-pa-2026-06-09-private-owner-contacts.csv \
 *     --limit=100 \
 *     --apply
 */

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const MARKET = normalizeSlug(getArg("market"))
const EXPORT_CSV = getArg("export-csv")
const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 250
const STRATEGY = normalizeSlug(getArg("strategy"))

if (!EXPORT_CSV) {
  console.error("Missing --export-csv=<path>.")
  process.exit(1)
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseCsvText(text) {
  const rows = []
  let row = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ",") { row.push(field); field = "" }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = "" }
    } else field += char
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  return rows
}

function loadCsv(file) {
  const rows = parseCsvText(fs.readFileSync(file, "utf8"))
  const header = rows[0] || []
  return rows.slice(1).map((values) => Object.fromEntries(header.map((col, index) => [String(col || "").trim(), String(values[index] || "").trim()])))
}

function first(row, names) {
  for (const name of names) {
    const value = row[name]
    if (value) return String(value).trim()
  }
  return ""
}

function lowerText(value) {
  return String(value || "").trim().toLowerCase()
}

function isDncValue(value) {
  return /dnc|do not call|do-not-call|no call|suppressed|excluded/.test(lowerText(value))
}

function ownerName(row) {
  return (
    `${first(row, ["first_name", "First Name"])} ${first(row, ["last_name", "Last Name"])}`.trim() ||
    first(row, ["full_name", "contact_name", "owner_name", "Owner Name", "Associated Contact Name"])
  )
}

function propertyAddress(row) {
  return (
    first(row, ["associated_property_address_full", "property_address_full", "Property Address Full", "address_full"]) ||
    [first(row, ["property_address", "Property Address", "address"]), first(row, ["property_city", "city"]), first(row, ["property_state", "state"]), first(row, ["property_zip", "zip"])].filter(Boolean).join(", ")
  )
}

function contactEmail(row) {
  return first(row, ["email_address_1", "email_1", "email", "Email", "Email 1", "email_address"])
}

function mobilePhone(row) {
  for (let i = 1; i <= 5; i++) {
    const phone = first(row, [`phone_${i}`, `Phone ${i}`, `phone${i}`])
    if (!phone) continue
    if (isDncValue(phone)) continue
    const type = first(row, [`phone_${i}_type`, `Phone ${i} Type`, `phone${i}_type`]).toLowerCase()
    const dnc = first(row, [`phone_${i}_do_not_call`, `phone_${i}_dnc`, `Phone ${i} DNC`]).toLowerCase()
    const activity = first(row, [`phone_${i}_activity_status`, `Phone ${i} Activity Status`])
    if (isDncValue(dnc) || dnc.includes("true") || dnc.includes("yes")) continue
    if (!type || /mobile|wireless|cell/.test(type)) return phone
    if (/active/i.test(activity) && !type) return phone
  }
  const fallback = first(row, ["phone_1", "Phone 1", "phone"])
  return isDncValue(fallback) ? "" : fallback
}

function splitMarketFromAddress(address) {
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 3) {
    const stateZip = parts[2].split(/\s+/)
    return { city: parts[1] || "", state: stateZip[0] || "", zipCode: stateZip[1] || "" }
  }
  return { city: "", state: "", zipCode: "" }
}

function rowText(row) {
  return Object.values(row).join(" ").toLowerCase()
}

function detectedSignals(row, sourceFile) {
  const text = `${rowText(row)} ${sourceFile}`.toLowerCase()
  const signals = []
  if (/tax|delinquen|treasurer|past.?due/.test(text)) signals.push({ key: "tax_delinquency", label: "Tax delinquency signal", severity: "high" })
  if (/code|violation|blight|condemn|unsafe|citation/.test(text)) signals.push({ key: "code_violation", label: "Code or condition signal", severity: "high" })
  if (/vacant|vacancy|abandoned/.test(text)) signals.push({ key: "vacancy", label: "Vacancy signal", severity: "medium" })
  if (/foreclosure|sheriff|auction|preforeclosure/.test(text)) signals.push({ key: "foreclosure_filing", label: "Foreclosure or auction signal", severity: "high" })
  if (/probate|estate/.test(text)) signals.push({ key: "probate", label: "Probate or estate signal", severity: "medium" })
  if (/absentee|out.?of.?state|mailing_address_previous|likely owner/.test(text)) signals.push({ key: "absentee_owner", label: "Absentee owner signal", severity: "medium" })
  if (/portfolio|multi.?property|landlord|duplex|triplex|fourplex|multi.?family/.test(text)) signals.push({ key: "portfolio_landlord", label: "Portfolio or small multifamily signal", severity: "medium" })
  if (/builder|infill|teardown|land|lot|zoning/.test(text)) signals.push({ key: "builder_fit", label: "Builder or infill signal", severity: "medium" })
  return signals
}

function signalScoreFor(row, sourceFile, email, phone) {
  const signals = detectedSignals(row, sourceFile)
  const signalPoints = signals.reduce((sum, signal) => sum + (signal.severity === "high" ? 14 : 9), 0)
  const contactPoints = (email ? 18 : 0) + (phone ? 14 : 0)
  const ownerPoints = ownerName(row) ? 8 : 0
  const addressPoints = propertyAddress(row) ? 10 : 0
  return Math.max(0, Math.min(100, Math.round(signalPoints + contactPoints + ownerPoints + addressPoints)))
}

function recommendedLaneFor(row, sourceFile) {
  const text = `${rowText(row)} ${sourceFile} ${STRATEGY}`.toLowerCase()
  if (/novation|expired|active-stale|listing/.test(text)) return "seller_novation"
  if (/creative|subject|seller.?finance|wrap/.test(text)) return "seller_creative"
  if (/builder|infill|teardown|developer/.test(text)) return "developer_partner"
  return "seller_fast_cash"
}

function checklistFor(row, sourceFile, index) {
  const address = propertyAddress(row)
  const market = splitMarketFromAddress(address)
  const email = contactEmail(row)
  const phone = mobilePhone(row)
  const name = ownerName(row)
  const dealmachineId = first(row, ["contact_id", "lead_id", "dealmachine_id", "id", "Lead ID"]) || `${MARKET || "unknown"}:${normalizeSlug(address)}:${index}`
  const signals = detectedSignals(row, sourceFile)
  const signalScore = signalScoreFor(row, sourceFile, email, phone)
  const dncSuppressed = isDncValue(first(row, ["contact_flags", "Contact Flags"])) || Object.values(row).some((value) => isDncValue(value) && /phone|call/i.test(String(value)))
  const recommendedLane = dncSuppressed ? "no_outreach" : recommendedLaneFor(row, sourceFile)

  return {
    entity_type: "property",
    source_type: "dealmachine_contacts_export",
    source_id: dealmachineId,
    property_address: address || null,
    city: first(row, ["property_city", "city"]) || market.city || null,
    state: (first(row, ["property_state", "state"]) || market.state || "").toUpperCase() || null,
    zip_code: first(row, ["property_zip", "zip"]) || market.zipCode || null,
    owner_name: name || null,
    company_name: first(row, ["company_name", "llc_name", "owner_company"]) || null,
    contact_email: email ? email.toLowerCase() : null,
    contact_phone: phone || null,
    website: null,
    checklist_json: {
      propertyVerified: Boolean(address),
      ownerEntityVerified: Boolean(name),
      contactQualityReviewed: Boolean(email || phone),
      sourceLinksAttached: true,
      fitCriteriaReviewed: signals.length > 0,
      riskReviewed: dncSuppressed,
      nextActionSelected: true,
      signalScore,
      detectedSignals: signals.map((signal) => signal.key),
      strategy: STRATEGY || null,
    },
    source_links_json: [
      {
        label: "DealMachine Contacts export",
        url: path.relative(process.cwd(), sourceFile),
        sourceType: "dealmachine_contacts_export",
        notes: [MARKET ? `Market: ${MARKET}` : null, STRATEGY ? `Strategy: ${STRATEGY}` : null].filter(Boolean).join(" · ") || null,
      },
    ],
    risk_flags_json: [
      dncSuppressed ? { label: "DNC or suppressed contact marker", severity: "high", notes: "Do not call/text. Review email permissibility separately." } : null,
      !email && !phone ? { label: "No usable contact", severity: "medium", notes: "Needs contact enrichment or manual review before outreach." } : null,
    ].filter(Boolean),
    opportunity_flags_json: [
      ...signals.map((signal) => ({ label: signal.label, severity: signal.severity, notes: `Signal key: ${signal.key}` })),
      { label: "Seller outreach candidate", severity: signalScore >= 70 ? "high" : "info", notes: `Signal score: ${signalScore}/100. Review before live outreach.` },
    ],
    recommended_lane: recommendedLane,
    outreach_status: dncSuppressed || (!email && !phone) ? "not_ready" : signalScore >= 70 ? "ready" : "needs_review",
    confidence_score: Math.min(100, (address ? 15 : 0) + (name ? 15 : 0) + (email || phone ? 20 : 0) + (signals.length ? 20 : 0) + 10 + 5),
    research_summary: `DealMachine export row queued with OSINT signal score ${signalScore}/100${signals.length ? ` from ${signals.map((signal) => signal.key).join(", ")}` : ""}.`,
    next_action: signalScore >= 70
      ? "Verify ownership/source evidence, then queue the lane-specific seller outreach draft."
      : "Add public source evidence, verify owner/entity, and improve contact quality before outreach.",
  }
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function upsertChecklist(admin, payload) {
  const { data: existing, error: findError } = await admin
    .from("osint_research_checklists")
    .select("id")
    .eq("source_type", payload.source_type)
    .eq("source_id", payload.source_id)
    .maybeSingle()
  if (findError) throw findError

  const query = existing?.id
    ? admin.from("osint_research_checklists").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", existing.id)
    : admin.from("osint_research_checklists").insert(payload)

  const { error } = await query
  if (error) throw error
}

async function main() {
  const file = path.resolve(EXPORT_CSV)
  if (!fs.existsSync(file)) throw new Error(`Export file not found: ${file}`)
  const rows = loadCsv(file).slice(0, LIMIT)
  const payloads = rows.map((row, index) => checklistFor(row, file, index)).filter((row) => row.property_address)

  console.log(JSON.stringify({
    apply: APPLY,
    source: file,
    market: MARKET || null,
    rowsRead: rows.length,
    checklistRows: payloads.length,
    withEmail: payloads.filter((row) => row.contact_email).length,
    withPhone: payloads.filter((row) => row.contact_phone).length,
    ready: payloads.filter((row) => row.outreach_status === "ready").length,
    notReady: payloads.filter((row) => row.outreach_status === "not_ready").length,
    averageSignalScore: payloads.length
      ? Math.round(payloads.reduce((sum, row) => sum + Number(row.checklist_json.signalScore || 0), 0) / payloads.length)
      : 0,
  }, null, 2))

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write internal Research Checklist records.")
    return
  }

  const admin = supabaseAdmin()
  for (const payload of payloads) await upsertChecklist(admin, payload)
  console.log(`Created/updated ${payloads.length} internal Research Checklist records.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
