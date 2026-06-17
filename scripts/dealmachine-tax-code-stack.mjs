/**
 * VestBlock DealMachine tax-delinquent + code-violation stack builder.
 *
 * Builds a no-send review list by overlaying:
 *   1. Fresh DealMachine market harvest rows with tax delinquency signals.
 *   2. Local public-record code violation / blight / nuisance rows.
 *
 * The script never sends outreach. It writes ranked CSV/JSON artifacts and
 * reports which markets still need a code-violation source.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-tax-code-stack.mjs
 *   node --env-file=.env.local scripts/dealmachine-tax-code-stack.mjs --markets="Cleveland,OH|Columbus,OH"
 *   node --env-file=.env.local scripts/dealmachine-tax-code-stack.mjs --code-csv=data/code-violations/cleveland.csv
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = "Cleveland,OH|Columbus,OH|Indianapolis,IN|Louisville,KY"
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const CODE_DIR = path.join(process.cwd(), "data", "code-violations")
const MASTER_STACK = path.join(OUT_DIR, "MASTER-distress-stack.csv")
const MARKETS = parseMarkets(getArg("markets") || DEFAULT_MARKETS)
const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 250
const CODE_CSV = getArg("code-csv")
const INCLUDE_TAX_ONLY = args.includes("--include-tax-only")

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
  const text = fs.readFileSync(file, "utf8")
  const rows = parseCsvText(text)
  const header = rows[0] || []
  return rows.slice(1).map((values) =>
    Object.fromEntries(header.map((col, index) => [String(col || "").trim(), String(values[index] || "").trim()]))
  )
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

function normalizeMarketSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseMarkets(input) {
  return String(input || DEFAULT_MARKETS)
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [city, state] = chunk.split(",").map((part) => part.trim())
      const cityName = city || ""
      const stateCode = normalizeState(state)
      return {
        city: cityName,
        state: stateCode,
        label: `${cityName}, ${stateCode}`,
        slug: normalizeMarketSlug(`${cityName}-${stateCode}`),
      }
    })
    .filter((market) => market.city && market.state)
}

function numberish(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function boolish(value) {
  const label = String(value || "").trim().toLowerCase()
  return ["true", "yes", "y", "1", "active"].includes(label)
}

function streetOnly(value) {
  return String(value || "")
    .split(",")[0]
    .replace(/\b(apartment|apt|unit|ste|suite|#)\b.*$/i, "")
    .trim()
}

function normalizeAddress(value) {
  return streetOnly(value)
    .toUpperCase()
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/[^A-Z0-9]/g, "")
}

function marketKey(city, state) {
  return `${normalizeText(city)}|${normalizeState(state)}`
}

function dmMarketKey(row, fallbackMarket) {
  return marketKey(row.market_city || row.property_city || fallbackMarket.city, row.market_state || row.property_state || fallbackMarket.state)
}

function codeMarketKey(row, fallbackMarket) {
  const city = row.city || row.property_city || row.market_city || fallbackMarket?.city || ""
  const state = row.state || row.property_state || row.market_state || fallbackMarket?.state || ""
  return marketKey(city, state)
}

function taxSignal(row) {
  return boolish(row.tax_delinquent) || taxAmountValue(row) > 0
}

function taxAmountValue(row) {
  const direct = numberish(row.past_due_amount_value || row.past_due_amount || row.delinquent_amount)
  if (direct > 0) return direct
  const noteMatch = String(row.recent_note || "").match(/\b(?:delinquent amount|past due amount)\s*:\s*\$?([0-9][0-9,]*(?:\.\d+)?)/i)
  return noteMatch ? numberish(noteMatch[1]) : 0
}

function contactable(row) {
  return Boolean(row.surfaced_emails || row.surfaced_phone_numbers || boolish(row.has_email_address) || boolish(row.has_phone_number))
}

function latestFileForMarket(market, extension) {
  if (!fs.existsSync(OUT_DIR)) return ""
  const prefix = `dealmachine-api-${market.slug}`
  const candidates = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
    .filter((name) => !name.includes("-ready-now") && !name.includes("-atlas-export-needed") && !name.includes("-stack"))
    .map((name) => {
      const file = path.join(OUT_DIR, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates[0]?.file || ""
}

function loadDealMachineRows(market) {
  const jsonFile = latestFileForMarket(market, ".json")
  if (jsonFile) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonFile, "utf8"))
      return { file: jsonFile, rows: Array.isArray(parsed) ? parsed : [] }
    } catch {
      return { file: jsonFile, rows: [] }
    }
  }

  const csvFile = latestFileForMarket(market, ".csv")
  return csvFile ? { file: csvFile, rows: loadCsv(csvFile) } : { file: "", rows: [] }
}

function codeRowsFromFile(file, fallbackMarket = null) {
  if (!file || !fs.existsSync(file)) return []
  return loadCsv(file).map((row) => ({
    address: row.address || row.property_address || row.property_address_full || row.full_address || row.situs_address || "",
    city: row.city || row.property_city || fallbackMarket?.city || "",
    state: row.state || row.property_state || fallbackMarket?.state || "",
    violation: row.violation || row.code_violation || row.case_type || row.comp_type_desc || row.description || "Code violation",
    violation_date: row.violation_date || row.case_date || row.entered_date || row.opened_date || row.date || "",
    source_file: file,
  }))
}

function loadCodeRows(markets) {
  const all = []

  if (fs.existsSync(MASTER_STACK)) {
    all.push(...codeRowsFromFile(MASTER_STACK))
  }

  if (CODE_CSV) {
    all.push(...codeRowsFromFile(path.resolve(CODE_CSV)))
  }

  if (fs.existsSync(CODE_DIR)) {
    for (const name of fs.readdirSync(CODE_DIR)) {
      if (!name.toLowerCase().endsWith(".csv")) continue
      all.push(...codeRowsFromFile(path.join(CODE_DIR, name)))
    }
  }

  for (const market of markets) {
    const direct = path.join(OUT_DIR, `code-violations-${market.slug}.csv`)
    if (fs.existsSync(direct)) all.push(...codeRowsFromFile(direct, market))
  }

  return all
}

function buildCodeIndex(codeRows, markets) {
  const wanted = new Set(markets.map((market) => marketKey(market.city, market.state)))
  const byMarket = new Map()
  const byAddress = new Map()

  for (const row of codeRows) {
    const addressKey = normalizeAddress(row.address)
    const market = codeMarketKey(row)
    if (!addressKey || !wanted.has(market)) continue
    const entry = {
      address: row.address,
      market,
      violation: row.violation,
      violation_date: row.violation_date,
      source_file: row.source_file,
    }
    const marketMap = byMarket.get(market) || new Map()
    if (!marketMap.has(addressKey)) marketMap.set(addressKey, entry)
    byMarket.set(market, marketMap)
    if (!byAddress.has(addressKey)) byAddress.set(addressKey, entry)
  }

  return { byMarket, byAddress }
}

function findCodeHit(index, row, market) {
  const addressKey = normalizeAddress(row.property_address_full || row.property_address_line_1)
  if (!addressKey) return null
  const exactMarket = index.byMarket.get(dmMarketKey(row, market))
  return exactMarket?.get(addressKey) || index.byAddress.get(addressKey) || null
}

function severityBoost(codeHit) {
  const text = normalizeText([codeHit?.violation, codeHit?.address].join(" "))
  if (/condemn|unsafe|danger|board|vacant|fire|structural/.test(text)) return 20
  if (/building|housing|nuisance|trash|grass|litter/.test(text)) return 12
  return codeHit ? 8 : 0
}

function priorityScore(row, codeHit) {
  let score = 50
  score += severityBoost(codeHit)
  score += Math.min(25, Math.floor(taxAmountValue(row) / 1000))
  if (contactable(row)) score += 12
  if (numberish(row.equity_percent_value || row.equity_percent) >= 25) score += 10
  if (boolish(row.out_of_state_owner)) score += 8
  if (boolish(row.is_vacant)) score += 8
  if (boolish(row.active_lien)) score += 5
  return Math.min(100, score)
}

function buildOutputRow(row, market, codeHit) {
  const score = priorityScore(row, codeHit)
  return {
    market: market.label,
    property_address_full: row.property_address_full || [row.property_address_line_1, row.property_city, row.property_state, row.property_zip].filter(Boolean).join(", "),
    owner_name: row.owner_name || "",
    dealmachine_id: row.dealmachine_id || "",
    stack_method: codeHit ? "dealmachine_tax_delinquent + county_code_violation" : "dealmachine_tax_delinquent_only",
    priority_score: score,
    tax_delinquent: row.tax_delinquent || "",
    tax_delinquent_year: row.tax_delinquent_year || "",
    past_due_amount: row.past_due_amount || row.delinquent_amount || "",
    past_due_amount_value: row.past_due_amount_value || taxAmountValue(row),
    code_violation_hit: codeHit ? "true" : "false",
    code_violation: codeHit?.violation || "",
    code_violation_date: codeHit?.violation_date || "",
    code_source_file: codeHit?.source_file ? path.relative(process.cwd(), codeHit.source_file) : "",
    estimated_value: row.estimated_value || "",
    estimated_value_value: row.estimated_value_value || "",
    equity_amount: row.equity_amount || "",
    equity_percent: row.equity_percent || "",
    is_vacant: row.is_vacant || "",
    out_of_state_owner: row.out_of_state_owner || "",
    active_lien: row.active_lien || "",
    has_email_address: row.has_email_address || "",
    has_phone_number: row.has_phone_number || "",
    surfaced_emails: row.surfaced_emails || "",
    surfaced_phone_numbers: row.surfaced_phone_numbers || "",
    suggested_exit_paths: row.suggested_exit_paths || "fast_cash | seller_options_review",
    seller_review_summary: row.seller_review_summary || "",
    next_action: codeHit
      ? "Verify title/tax/code status, review value and condition, then draft seller-options outreach."
      : "Add county code-violation source before outreach; tax-only row kept for backlog.",
  }
}

function writeCsv(file, rows) {
  const columns = [
    "market",
    "property_address_full",
    "owner_name",
    "dealmachine_id",
    "stack_method",
    "priority_score",
    "tax_delinquent",
    "tax_delinquent_year",
    "past_due_amount",
    "past_due_amount_value",
    "code_violation_hit",
    "code_violation",
    "code_violation_date",
    "code_source_file",
    "estimated_value",
    "estimated_value_value",
    "equity_amount",
    "equity_percent",
    "is_vacant",
    "out_of_state_owner",
    "active_lien",
    "has_email_address",
    "has_phone_number",
    "surfaced_emails",
    "surfaced_phone_numbers",
    "suggested_exit_paths",
    "seller_review_summary",
    "next_action",
  ]
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const codeRows = loadCodeRows(MARKETS)
  const codeIndex = buildCodeIndex(codeRows, MARKETS)
  const outputs = []
  const marketSummaries = []
  const sourceNeeded = []

  for (const market of MARKETS) {
    const dm = loadDealMachineRows(market)
    const marketCodeMap = codeIndex.byMarket.get(marketKey(market.city, market.state))
    const taxRows = dm.rows.filter(taxSignal)
    const stacked = []
    const taxOnly = []

    for (const row of taxRows) {
      const codeHit = findCodeHit(codeIndex, row, market)
      if (codeHit) stacked.push(buildOutputRow(row, market, codeHit))
      else if (INCLUDE_TAX_ONLY) taxOnly.push(buildOutputRow(row, market, null))
    }

    const marketRows = [...stacked, ...taxOnly].sort((a, b) => b.priority_score - a.priority_score)
    outputs.push(...marketRows)

    const summary = {
      market: market.label,
      dealMachineFile: dm.file ? path.relative(process.cwd(), dm.file) : null,
      dealMachineRows: dm.rows.length,
      taxDelinquentRows: taxRows.length,
      codeViolationRows: marketCodeMap?.size || 0,
      stackedRows: stacked.length,
      taxOnlyBacklogRows: taxOnly.length,
    }
    marketSummaries.push(summary)

    if (!dm.file) sourceNeeded.push(`${market.label}: run DealMachine market harvest first`)
    if (!marketCodeMap?.size) sourceNeeded.push(`${market.label}: add county/city code-violation CSV or source adapter`)
  }

  const limited = outputs.slice(0, LIMIT)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const csvPath = path.join(OUT_DIR, `dealmachine-tax-code-stack-${stamp}.csv`)
  const jsonPath = path.join(OUT_DIR, `dealmachine-tax-code-stack-${stamp}.json`)
  const summaryPath = path.join(OUT_DIR, `dealmachine-tax-code-stack-summary-${stamp}.json`)
  writeCsv(csvPath, limited)
  fs.writeFileSync(jsonPath, JSON.stringify(limited, null, 2))
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        markets: MARKETS.map((market) => market.label),
        limit: LIMIT,
        includeTaxOnly: INCLUDE_TAX_ONLY,
        totalOutputRows: outputs.length,
        writtenRows: limited.length,
        marketSummaries,
        sourceNeeded,
        csvPath,
        jsonPath,
      },
      null,
      2
    )
  )

  console.log("=== DealMachine tax + code stack ===")
  console.log(`Markets:       ${MARKETS.map((market) => market.label).join(" | ")}`)
  console.log(`Written rows:  ${limited.length}`)
  console.log(`CSV:           ${csvPath}`)
  console.log(`Summary:       ${summaryPath}`)
  for (const item of marketSummaries) {
    console.log(
      `- ${item.market}: DM ${item.dealMachineRows}, tax ${item.taxDelinquentRows}, code ${item.codeViolationRows}, stacked ${item.stackedRows}`
    )
  }
  if (sourceNeeded.length) {
    console.log("")
    console.log("Source needed:")
    for (const item of sourceNeeded) console.log(`- ${item}`)
    console.log("")
    console.log("Next commands:")
    console.log(`  npm run distress:tax-code-stack:harvest-new-markets`)
    console.log(`  npm run distress:tax-code-stack:new-markets`)
  }
}

main()
