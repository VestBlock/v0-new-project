/**
 * Preforeclosure county + OSINT intake lane for VestBlock.
 *
 * This script normalizes raw county/court foreclosure CSVs, scores each record
 * for subject-to fit, routes each lead into the right seller lane, writes a
 * public-OSINT-ready review file, can optionally run public-source contact
 * enrichment, writes a DealMachine import file as a fallback contact path, and
 * can optionally sync the results into the internal OSINT research checklist
 * table.
 *
 * Dry run by default.
 *
 * Usage:
 *   node --env-file=.env.local scripts/preforeclosure-county-osint-lane.mjs --file=data/preforeclosure-county/raw/sample.csv
 *   node --env-file=.env.local scripts/preforeclosure-county-osint-lane.mjs --file=data/preforeclosure-county/raw/jackson-county.csv --market=kansas-city-mo --apply-checklists
 *   node --env-file=.env.local scripts/preforeclosure-county-osint-lane.mjs --file=data/preforeclosure-county/raw/jackson-county.csv --run-public-osint
 */

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const args = process.argv.slice(2)
const APPLY_CHECKLISTS = args.includes("--apply-checklists")
const WRITE_DM_IMPORT = !args.includes("--no-dm-import")
const WRITE_JSON = !args.includes("--no-json")
const RUN_PUBLIC_OSINT = args.includes("--run-public-osint")
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const FILE = getArg("file")
const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 0
const MARKET_OVERRIDE = normalizeSlug(getArg("market"))
const COUNTY_OVERRIDE = String(getArg("county") || "").trim()
const STATE_OVERRIDE = String(getArg("state") || "").trim().toUpperCase()
const SOURCE_URL = String(getArg("source-url") || "").trim()

const PRE_DIR = path.join(process.cwd(), "data", "preforeclosure-county")
const RAW_DIR = path.join(PRE_DIR, "raw")
const NORMALIZED_DIR = path.join(PRE_DIR, "normalized")
const DM_IMPORT_DIR = path.join(PRE_DIR, "dealmachine-import")
const REVIEW_DIR = path.join(PRE_DIR, "review")
const REPORT_DIR = path.join(process.cwd(), "tmp", "outreach")

const STATUS_POSTPONED = /\b(postpon|cont(?:inu|.)?|reschedul|adjourn)\b/i
const STATUS_CANCELLED = /\b(cancel|dismiss|withdraw|rescinded|stayed)\b/i
const STATUS_BANKRUPTCY = /\bbankrupt|chapter 7|chapter 11|chapter 13\b/i
const STATUS_PROBATE = /\bprobate|estate\b/i
const STATUS_VACANT = /\bvacant|abandon|boarded|condemn|unsafe|fire\b/i
const STATUS_RENTAL = /\brental|tenant|lease|occupied by tenant\b/i
const STATUS_OWNER_OCC = /\bowner.?occup|homestead|primary residence\b/i

const CHECKLIST_LANE_BY_ROUTE = {
  subject_to: "seller_creative",
  cash_offer: "seller_fast_cash",
  novation: "seller_novation",
  short_sale: "seller_creative",
  seller_finance: "seller_creative",
  lender_rescue_referral: "no_outreach",
  attorney_housing_referral: "no_outreach",
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeText(value) {
  return String(value || "").trim()
}

function lowerText(value) {
  return normalizeText(value).toLowerCase()
}

function numberish(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function booleanish(value) {
  return /^(1|true|yes|y|vacant|absentee|owner occupied|owner-occupied)$/i.test(String(value || "").trim())
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
  const header = (rows[0] || []).map((col) => String(col || "").trim())
  return rows.slice(1).map((values) =>
    Object.fromEntries(header.map((col, index) => [col, String(values[index] || "").trim()]))
  )
}

function pick(row, names) {
  for (const name of names) {
    const value = row[name]
    if (normalizeText(value)) return normalizeText(value)
  }
  return ""
}

function pickAddress(row) {
  return pick(row, [
    "property_address",
    "property address",
    "address",
    "site_address",
    "site address",
    "full_address",
    "property_full_address",
    "property",
  ])
}

function pickMailingAddress(row) {
  return pick(row, [
    "mailing_address",
    "mailing address",
    "owner_mailing_address",
    "owner mailing address",
    "tax_mailing_address",
    "borrower_mailing_address",
  ])
}

function splitCityStateZip(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return { city: "", state: "", zip: "" }
  const tail = parts[parts.length - 1].split(/\s+/).filter(Boolean)
  return {
    city: parts.length >= 3 ? parts[parts.length - 2] : "",
    state: tail[0] || "",
    zip: tail[1] || "",
  }
}

function normalizeDate(value) {
  const raw = normalizeText(value)
  if (!raw) return ""
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  const match = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/)
  if (!match) return ""
  const mm = match[1].padStart(2, "0")
  const dd = match[2].padStart(2, "0")
  const yyyy = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${yyyy}-${mm}-${dd}`
}

function daysUntil(dateText) {
  if (!dateText) return null
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.round((parsed.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function entityOwnerFlag(ownerName) {
  return /\b(llc|inc|corp|corporation|trust|holdings|partners|properties)\b/i.test(ownerName)
}

function mailingDiffers(propertyAddress, mailingAddress) {
  if (!propertyAddress || !mailingAddress) return false
  return normalizeSlug(propertyAddress) !== normalizeSlug(mailingAddress)
}

function computeSubjectToFit(record) {
  let score = 0
  const notes = []

  if (record.filingDate || record.caseNumber) {
    score += 15
    notes.push("foreclosure_filed")
  }
  if (typeof record.daysToSale === "number" && record.daysToSale >= 0 && record.daysToSale <= 45) {
    score += 10
    notes.push("auction_within_45_days")
  }
  if (record.statusPostponed) {
    score += 8
    notes.push("auction_postponed")
  }
  if (record.absenteeOwner) {
    score += 8
    notes.push("absentee_owner")
  }
  if (record.rentalDemandStrong) {
    score += 10
    notes.push("rental_demand")
  }
  if (record.manageableArrears) {
    score += 12
    notes.push("manageable_arrears")
  }
  if (record.equityPercent >= 10 && record.equityPercent <= 30) {
    score += 10
    notes.push("equity_band")
  }
  if (record.appearsHabitable) {
    score += 10
    notes.push("appears_habitable")
  }
  if (record.taxCodeStack) {
    score += 6
    notes.push("tax_code_stack")
  }
  if (record.buyerDemandStrong) {
    score += 8
    notes.push("buyer_demand")
  }

  if (record.ownerOccupiedSensitive) {
    score -= 12
    notes.push("owner_occupied_sensitive")
  }
  if (record.bankruptcyFlag) {
    score -= 15
    notes.push("bankruptcy")
  }
  if (record.probateFlag) {
    score -= 10
    notes.push("probate")
  }
  if (record.heavyRehab) {
    score -= 8
    notes.push("heavy_rehab")
  }
  if (record.equityPercent > 35 && record.appearsHabitable) {
    score -= 10
    notes.push("high_equity_retail_ready")
  }

  return { score: Math.max(0, Math.min(100, score)), notes }
}

function routeLead(record, fit) {
  if (record.bankruptcyFlag || record.probateFlag || record.ownerOccupiedSensitive) {
    return record.ownerOccupiedSensitive ? "attorney_housing_referral" : "lender_rescue_referral"
  }
  if (fit.score >= 70) return "subject_to"
  if (record.equityPercent >= 35 && record.appearsHabitable && !record.heavyRehab) return "novation"
  if (record.equityPercent >= 20 && record.absenteeOwner && record.rentalDemandStrong) return "seller_finance"
  if (record.taxCodeStack || record.heavyRehab || record.daysToSale !== null && record.daysToSale <= 21) return "cash_offer"
  if (record.equityPercent > 0 && record.equityPercent < 10) return "short_sale"
  return "cash_offer"
}

function readinessFor(record, route) {
  if (route === "attorney_housing_referral" || route === "lender_rescue_referral") return "needs_review"
  if (!record.ownerName || !record.propertyAddress) return "not_ready"
  if (route === "subject_to" && record.ownerOccupiedSensitive) return "needs_review"
  return route === "subject_to" ? "ready" : "needs_review"
}

function likelyRentalDemand(market, rowText) {
  if (/\brental|tenant|leased|investor\b/.test(rowText)) return true
  return /kansas-city-mo|tulsa-ok|little-rock-ar|memphis-tn|milwaukee-wi|detroit-mi|cincinnati-oh/.test(market)
}

function likelyBuyerDemand(rowText, estimatedValue) {
  return /\binfill|rental|tenant|duplex|triplex|fourplex|portfolio\b/.test(rowText) || (estimatedValue > 0 && estimatedValue <= 350000)
}

function normalizeCountyRow(row, index, context) {
  const ownerName = pick(row, ["owner_name", "owner", "borrower_name", "borrower", "defendant", "grantor"])
  const propertyAddress = pickAddress(row)
  const mailingAddress = pickMailingAddress(row)
  const propertySplit = splitCityStateZip(propertyAddress)
  const mailingSplit = splitCityStateZip(mailingAddress)
  const city = pick(row, ["city", "property_city"]) || propertySplit.city
  const state = (pick(row, ["state", "property_state"]) || propertySplit.state || context.state || "").toUpperCase()
  const zipCode = pick(row, ["zip", "zipcode", "property_zip"]) || propertySplit.zip
  const mailingCity = pick(row, ["mailing_city"]) || mailingSplit.city
  const mailingState = (pick(row, ["mailing_state"]) || mailingSplit.state || "").toUpperCase()
  const mailingZip = pick(row, ["mailing_zip", "mailing_zipcode"]) || mailingSplit.zip
  const caseNumber = pick(row, ["case_number", "case number", "docket_number", "docket", "file_number"])
  const filingDate = normalizeDate(pick(row, ["filing_date", "filed_date", "default_date", "notice_date"]))
  const saleDate = normalizeDate(pick(row, ["sale_date", "auction_date", "hearing_date"]))
  const plaintiff = pick(row, ["plaintiff", "lender", "beneficiary", "bank_name"])
  const status = pick(row, ["status", "sale_status", "auction_status", "case_status", "notes"])
  const arrearsAmount = numberish(pick(row, ["arrears", "arrears_amount", "past_due_amount", "default_amount", "reinstatement_amount"]))
  const taxAmount = numberish(pick(row, ["tax_delinquent_amount", "delinquent_tax_amount", "tax_amount"]))
  const estimatedValue = numberish(pick(row, ["estimated_value", "avm", "market_value", "assessed_value"]))
  const mortgageBalance = numberish(pick(row, ["mortgage_balance", "loan_balance", "unpaid_balance"]))
  const equityPercentExplicit = numberish(pick(row, ["equity_percent", "estimated_equity_percent"]))
  const equityPercent =
    equityPercentExplicit ||
    (estimatedValue > 0 && mortgageBalance > 0 ? Math.max(0, Math.round(((estimatedValue - mortgageBalance) / estimatedValue) * 100)) : 0)
  const statusText = `${status} ${Object.values(row).join(" ")}`.toLowerCase()
  const absenteeOwner =
    booleanish(pick(row, ["absentee_owner", "out_of_state_owner"])) ||
    mailingDiffers(propertyAddress, mailingAddress)
  const ownerOccupiedSensitive =
    booleanish(pick(row, ["owner_occupied", "owner occupied", "homestead"])) ||
    STATUS_OWNER_OCC.test(statusText)
  const entityOwner = entityOwnerFlag(ownerName)
  const statusPostponed = STATUS_POSTPONED.test(statusText)
  const statusCancelled = STATUS_CANCELLED.test(statusText)
  const bankruptcyFlag = booleanish(pick(row, ["bankruptcy_flag", "bankruptcy"])) || STATUS_BANKRUPTCY.test(statusText)
  const probateFlag = booleanish(pick(row, ["probate_flag", "probate"])) || STATUS_PROBATE.test(statusText)
  const vacantFlag = booleanish(pick(row, ["vacant_flag", "vacant"])) || STATUS_VACANT.test(statusText)
  const rentalSignal = booleanish(pick(row, ["tenant_occupied", "rental_flag"])) || STATUS_RENTAL.test(statusText)
  const codeViolationFlag = booleanish(pick(row, ["code_violation_flag", "code_violation"])) || /\bcode|violation|unsafe|condemn\b/.test(statusText)
  const taxDelinquentFlag = taxAmount > 0 || booleanish(pick(row, ["tax_delinquent_flag", "tax_delinquent"]))
  const taxCodeStack = taxDelinquentFlag && codeViolationFlag
  const daysToSale = daysUntil(saleDate)
  const manageableArrears = arrearsAmount > 0 && (arrearsAmount <= 25000 || (estimatedValue > 0 && arrearsAmount / estimatedValue <= 0.06))
  const appearsHabitable = !vacantFlag && !/\bfire|condemn|boarded|unsafe\b/.test(statusText)
  const heavyRehab = /\bfire|condemn|unsafe|collapse|major rehab|gut\b/.test(statusText)
  const market = context.market || normalizeSlug(`${city}-${state}`)
  const rentalDemandStrong = likelyRentalDemand(market, statusText)
  const buyerDemandStrong = likelyBuyerDemand(statusText, estimatedValue)

  const normalized = {
    externalId: `${context.sourceKey}:${caseNumber || normalizeSlug(propertyAddress) || index}`,
    market,
    county: context.county || "",
    state,
    sourceType: "county_preforeclosure_public_record",
    sourceKey: context.sourceKey,
    sourceUrl: SOURCE_URL || "",
    ownerName,
    entityOwner,
    propertyAddress,
    city,
    zipCode,
    mailingAddress,
    mailingCity,
    mailingState,
    mailingZip,
    absenteeOwner,
    ownerOccupiedSensitive,
    caseNumber,
    filingDate,
    saleDate,
    daysToSale,
    plaintiff,
    status,
    statusPostponed,
    statusCancelled,
    bankruptcyFlag,
    probateFlag,
    vacantFlag,
    rentalSignal,
    codeViolationFlag,
    taxDelinquentFlag,
    taxAmount,
    taxCodeStack,
    arrearsAmount,
    estimatedValue,
    mortgageBalance,
    equityPercent,
    manageableArrears,
    appearsHabitable,
    heavyRehab,
    rentalDemandStrong,
    buyerDemandStrong,
    notes: pick(row, ["notes", "comments", "remarks", "legal_description"]),
  }

  const fit = computeSubjectToFit(normalized)
  const route = routeLead(normalized, fit)
  const outreachStatus = readinessFor(normalized, route)
  return {
    ...normalized,
    subjectToFitScore: fit.score,
    subjectToFitReasons: fit.notes.join("|"),
    primaryRoute: route,
    recommendedLane: CHECKLIST_LANE_BY_ROUTE[route] || "seller_fast_cash",
    outreachStatus,
  }
}

function checklistPayload(record, sourceFile) {
  const riskFlags = [
    record.ownerOccupiedSensitive
      ? { label: "Owner-occupant legal sensitivity", severity: "high", notes: "Needs attorney-reviewed language before any subject-to discussion." }
      : null,
    record.bankruptcyFlag
      ? { label: "Bankruptcy signal", severity: "high", notes: "Do not pitch terms before legal review." }
      : null,
    record.probateFlag
      ? { label: "Probate / estate signal", severity: "medium", notes: "Verify authority to sell before outreach." }
      : null,
  ].filter(Boolean)

  const opportunityFlags = [
    { label: "Preforeclosure filing", severity: "high", notes: record.filingDate || "County record signal present." },
    record.daysToSale !== null ? { label: "Sale date tracked", severity: record.daysToSale <= 21 ? "high" : "info", notes: `${record.daysToSale} days to sale.` } : null,
    record.subjectToFitScore >= 70 ? { label: "Subject-to review candidate", severity: "high", notes: `Score ${record.subjectToFitScore}/100.` } : null,
    record.taxCodeStack ? { label: "Tax + code stack", severity: "medium", notes: "Multiple distress signals in the file." } : null,
  ].filter(Boolean)

  return {
    entity_type: "property",
    source_type: record.sourceType,
    source_id: record.externalId,
    property_address: record.propertyAddress || null,
    city: record.city || null,
    state: record.state || null,
    zip_code: record.zipCode || null,
    owner_name: record.ownerName || null,
    company_name: record.entityOwner ? record.ownerName || null : null,
    contact_email: null,
    contact_phone: null,
    website: null,
    checklist_json: {
      propertyVerified: Boolean(record.propertyAddress),
      ownerEntityVerified: Boolean(record.ownerName),
      contactQualityReviewed: false,
      sourceLinksAttached: true,
      fitCriteriaReviewed: true,
      mapConditionReviewed: record.appearsHabitable,
      riskReviewed: true,
      nextActionSelected: true,
      subject_to_fit_score: record.subjectToFitScore,
      foreclosure_filing_date: record.filingDate || null,
      sale_date: record.saleDate || null,
      route: record.primaryRoute,
      absentee_owner: record.absenteeOwner,
      owner_occupied_sensitive: record.ownerOccupiedSensitive,
    },
    source_links_json: [
      {
        label: "County preforeclosure file",
        url: path.relative(process.cwd(), sourceFile),
        sourceType: "county_preforeclosure_public_record",
        notes: [record.county ? `County: ${record.county}` : "", record.caseNumber ? `Case: ${record.caseNumber}` : ""].filter(Boolean).join(" · ") || null,
      },
      ...(record.sourceUrl ? [{ label: "Public source", url: record.sourceUrl, sourceType: "county_public_record", notes: null }] : []),
    ],
    risk_flags_json: riskFlags,
    opportunity_flags_json: opportunityFlags,
    recommended_lane: record.recommendedLane,
    outreach_status: record.outreachStatus,
    confidence_score: Math.min(
      100,
      15 +
        (record.ownerName ? 15 : 0) +
        (record.propertyAddress ? 20 : 0) +
        (record.caseNumber ? 15 : 0) +
        (record.filingDate ? 10 : 0) +
        (record.saleDate ? 10 : 0) +
        (record.subjectToFitScore >= 70 ? 10 : 0)
    ),
    research_summary: `County preforeclosure lead routed to ${record.primaryRoute} with subject-to fit ${record.subjectToFitScore}/100.`,
    next_action:
      record.primaryRoute === "subject_to"
        ? "Push to DealMachine import or approved enrichment path, validate contact quality, then use the preforeclosure creative-review copy."
        : record.primaryRoute === "novation"
          ? "Review retail condition and equity before sending novation language."
          : record.primaryRoute === "cash_offer"
            ? "Layer in contact enrichment and use the fast-cash lane after source verification."
            : "Hold for legal or housing-counselor review before any owner messaging.",
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

function writeCsv(file, columns, rows) {
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((column) => esc(row[column] || "")).join(","))].join("\n"))
}

function detectInputFile() {
  if (FILE) {
    const resolved = path.resolve(FILE)
    if (!fs.existsSync(resolved)) throw new Error(`Input file not found: ${resolved}`)
    return resolved
  }
  if (!fs.existsSync(RAW_DIR)) throw new Error(`No raw county directory found at ${RAW_DIR}`)
  const candidates = fs
    .readdirSync(RAW_DIR)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const file = path.join(RAW_DIR, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  if (!candidates.length) throw new Error(`No county CSV found in ${RAW_DIR}`)
  return candidates[0].file
}

function runPublicOsint(reviewCsv) {
  const scriptFile = path.join(process.cwd(), "scripts", "preforeclosure-public-osint-enrich.mjs")
  const output = execFileSync(
    process.execPath,
    ["--env-file=.env.local", scriptFile, `--input=${reviewCsv}`],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  return JSON.parse(output)
}

async function main() {
  ensureDir(PRE_DIR)
  ensureDir(RAW_DIR)
  ensureDir(NORMALIZED_DIR)
  ensureDir(DM_IMPORT_DIR)
  ensureDir(REVIEW_DIR)
  ensureDir(REPORT_DIR)

  const sourceFile = detectInputFile()
  const rows = loadCsv(sourceFile)
  const limitedRows = LIMIT > 0 ? rows.slice(0, LIMIT) : rows
  const sourceKey = normalizeSlug(path.basename(sourceFile, path.extname(sourceFile)))
  const inferredState = STATE_OVERRIDE || pick(limitedRows[0] || {}, ["state", "property_state"]).toUpperCase()
  const inferredCounty = COUNTY_OVERRIDE || pick(limitedRows[0] || {}, ["county", "county_name"])
  const inferredMarket = MARKET_OVERRIDE || normalizeSlug(`${pick(limitedRows[0] || {}, ["city", "property_city"])}-${inferredState}`)
  const context = { sourceKey, state: inferredState, county: inferredCounty, market: inferredMarket }

  const normalized = limitedRows
    .map((row, index) => normalizeCountyRow(row, index, context))
    .filter((row) => row.propertyAddress)

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = `${sourceKey}-${stamp}`
  const normalizedCsv = path.join(NORMALIZED_DIR, `${baseName}.csv`)
  const reviewCsv = path.join(REVIEW_DIR, `${baseName}-review.csv`)
  const dmImportCsv = path.join(DM_IMPORT_DIR, `${baseName}-dealmachine-import.csv`)
  const reportFile = path.join(REPORT_DIR, `preforeclosure-county-osint-${stamp}.md`)

  writeCsv(
    normalizedCsv,
    [
      "market",
      "county",
      "state",
      "ownerName",
      "propertyAddress",
      "city",
      "zipCode",
      "mailingAddress",
      "absenteeOwner",
      "caseNumber",
      "filingDate",
      "saleDate",
      "daysToSale",
      "plaintiff",
      "arrearsAmount",
      "taxAmount",
      "estimatedValue",
      "mortgageBalance",
      "equityPercent",
      "subjectToFitScore",
      "primaryRoute",
      "outreachStatus",
      "notes",
    ],
    normalized
  )

  writeCsv(
    reviewCsv,
    [
      "market",
      "ownerName",
      "propertyAddress",
      "mailingAddress",
      "caseNumber",
      "filingDate",
      "saleDate",
      "daysToSale",
      "subjectToFitScore",
      "subjectToFitReasons",
      "primaryRoute",
      "outreachStatus",
      "absenteeOwner",
      "ownerOccupiedSensitive",
      "taxCodeStack",
      "equityPercent",
      "arrearsAmount",
      "estimatedValue",
      "notes",
    ],
    normalized
  )

  if (WRITE_DM_IMPORT) {
    writeCsv(
      dmImportCsv,
      ["market", "owner_name", "property_address", "city", "state", "zip", "mailing_address", "case_number", "route_hint", "subject_to_fit_score", "county", "source_key"],
      normalized.map((row) => ({
        market: row.market,
        owner_name: row.ownerName,
        property_address: row.propertyAddress,
        city: row.city,
        state: row.state,
        zip: row.zipCode,
        mailing_address: row.mailingAddress,
        case_number: row.caseNumber,
        route_hint: row.primaryRoute,
        subject_to_fit_score: row.subjectToFitScore,
        county: row.county,
        source_key: row.sourceKey,
      }))
    )
  }

  if (WRITE_JSON) {
    fs.writeFileSync(path.join(NORMALIZED_DIR, `${baseName}.json`), JSON.stringify(normalized, null, 2))
  }

  let publicOsintResult = null
  if (RUN_PUBLIC_OSINT) {
    publicOsintResult = runPublicOsint(reviewCsv)
  }

  let synced = 0
  if (APPLY_CHECKLISTS) {
    const admin = supabaseAdmin()
    for (const row of normalized) {
      await upsertChecklist(admin, checklistPayload(row, sourceFile))
      synced++
    }
  }

  const routeCounts = normalized.reduce((acc, row) => {
    acc[row.primaryRoute] = (acc[row.primaryRoute] || 0) + 1
    return acc
  }, {})
  const readySubjectTo = normalized.filter((row) => row.primaryRoute === "subject_to" && row.outreachStatus === "ready")
  const needsLegalReview = normalized.filter((row) => row.ownerOccupiedSensitive || row.bankruptcyFlag || row.probateFlag)

  const reportLines = [
    "# Preforeclosure County OSINT Lane",
    "",
    `- Source file: ${path.relative(process.cwd(), sourceFile)}`,
    `- Processed at: ${new Date().toISOString()}`,
    `- Rows processed: ${normalized.length}`,
    `- Checklists synced: ${synced}`,
    `- Normalized CSV: ${path.relative(process.cwd(), normalizedCsv)}`,
    `- Review CSV: ${path.relative(process.cwd(), reviewCsv)}`,
    `- Public OSINT enrichment: ${publicOsintResult ? publicOsintResult.outputCsv : "not run"}`,
    `- DealMachine import file: ${WRITE_DM_IMPORT ? path.relative(process.cwd(), dmImportCsv) : "skipped"}`,
    "",
    "## Route counts",
    "",
    ...Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).map(([route, count]) => `- ${route}: ${count}`),
    "",
    `## Ready subject-to candidates (${readySubjectTo.length})`,
    "",
    ...readySubjectTo.slice(0, 15).map(
      (row) =>
        `- ${row.propertyAddress} | owner: ${row.ownerName || "unknown"} | fit: ${row.subjectToFitScore} | sale: ${row.saleDate || "n/a"} | case: ${row.caseNumber || "n/a"}`
    ),
    "",
    `## Legal / caution review (${needsLegalReview.length})`,
    "",
    ...needsLegalReview.slice(0, 15).map(
      (row) =>
        `- ${row.propertyAddress} | route: ${row.primaryRoute} | flags: ${[
          row.ownerOccupiedSensitive ? "owner-occupied" : "",
          row.bankruptcyFlag ? "bankruptcy" : "",
          row.probateFlag ? "probate" : "",
        ].filter(Boolean).join(", ")}`
    ),
  ]
  fs.writeFileSync(reportFile, reportLines.join("\n"))

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceFile: path.relative(process.cwd(), sourceFile),
        rowsProcessed: normalized.length,
        syncedChecklists: synced,
        normalizedCsv: path.relative(process.cwd(), normalizedCsv),
        reviewCsv: path.relative(process.cwd(), reviewCsv),
        publicOsint: publicOsintResult,
        dealMachineImportCsv: WRITE_DM_IMPORT ? path.relative(process.cwd(), dmImportCsv) : null,
        reportFile: path.relative(process.cwd(), reportFile),
        routeCounts,
        readySubjectTo: readySubjectTo.length,
        cautionReview: needsLegalReview.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`[preforeclosure-county-osint-lane] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
