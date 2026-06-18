/**
 * DealMachine contact-export request builder.
 *
 * Builds the exact "download this from DealMachine" package for strategy queues
 * that have lead signals but no surfaced contact values yet. This is not skip
 * tracing. It prepares a list for a DealMachine Contacts export so the next
 * step can verify emails, phones, and DNC fields before any outreach.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-export-request.mjs
 *   node --env-file=.env.local scripts/dealmachine-export-request.mjs --strategy=builder-infill-teardown --limit=100
 *   node --env-file=.env.local scripts/dealmachine-export-request.mjs --strategy=all --markets=columbus-oh|louisville-ky
 *   node --env-file=.env.local scripts/dealmachine-export-request.mjs --queue-csv=data/distress-leads/dealmachine-api-columbus-oh-live-problem-stack.csv
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const STRATEGY_ARG = normalizeSlug(getArg("strategy") || "all")
const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 100
const QUEUE_CSV = getArg("queue-csv")
const MARKET_FILTERS = parseList(getArg("markets") || getArg("market") || "")
const INCLUDE_NO_CONTACT_SIGNAL = args.includes("--include-no-contact-signal")
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")

const STRATEGY_DEFINITIONS = [
  {
    key: "tax-code-stack",
    aliases: ["tax-delinquent-code-violation", "code-tax-stack"],
    label: "Tax delinquent + code violation",
    fileTest: (name) =>
      /^dealmachine-tax-code-stack-.*\.csv$/i.test(name) ||
      /^dealmachine-api-.*-(live-problem-stack|tax-due-now-stack)\.csv$/i.test(name),
    fit: (row) => hasTaxSignal(row) && (hasCodeSignal(row) || hasDistressSignal(row)),
    reason: "tax/code pressure needs DealMachine Contacts export before owner outreach",
  },
  {
    key: "senior-out-of-state-landlord",
    aliases: ["portfolio-landlord", "senior-landlord", "out-of-state-landlord", "landlord-portfolio"],
    label: "Senior / out-of-state landlord portfolio",
    fileTest: (name) => /^dealmachine-api-.*-(absentee-problem-stack|contactable-nurture-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => isOutOfState(row) || /senior|absentee|portfolio|rental|landlord/i.test(rowText(row)),
    reason: "absentee/landlord lead needs contact export with DNC columns",
  },
  {
    key: "builder-infill-teardown",
    aliases: ["infill-builder-teardown", "builder-teardown", "lot-assembly-builder"],
    label: "Builder infill / teardown",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|vacant-equity-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /infill|teardown|tear down|lot|land|vacant|zoning|demo|demolition|fire|condemned|boarded|shell|unsafe|code/i.test(rowText(row)),
    reason: "builder-fit signal needs contact export before seller copy is safe",
  },
  {
    key: "land-wholesale",
    aliases: ["land-infill-lowball", "vacant-land-wholesale", "developer-land-arbitrage"],
    label: "Land wholesale / developer activity",
    fileTest: (name) => /^dealmachine-api-.*-(vacant-equity-stack|atlas-export-needed|live-problem-stack|ready-now)\.csv$/i.test(name),
    fit: (row) => isLandWholesaleCandidate(row),
    reason: "land/infill candidate needs Contacts export with DNC fields before 30-50% conditional cash review",
  },
  {
    key: "small-multifamily-portfolio",
    aliases: ["multifamily-portfolio", "portfolio-breakup", "2-20-unit-portfolio"],
    label: "Small multifamily / portfolio breakup",
    fileTest: (name) => /^dealmachine-api-.*-(contactable-nurture-stack|absentee-problem-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /duplex|triplex|fourplex|quad|multi family|multifamily|apartment|units|portfolio|rental/i.test(rowText(row)),
    reason: "small multifamily or portfolio signal needs exact Contacts export",
  },
  {
    key: "institutional-btr-buybox",
    aliases: ["btr-buybox", "sfr-aggregator-buybox", "institutional-sfr"],
    label: "Institutional / BTR buy-box",
    fileTest: (name) => /^dealmachine-api-.*-(vacant-equity-stack|contactable-nurture-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /single family|sfr|residential|lot|land|vacant|rental|portfolio|build/i.test(rowText(row)) || isOutOfState(row),
    reason: "BTR/SFR candidate needs contact export before owner outreach",
  },
  {
    key: "commercial-small-bay-distress",
    aliases: ["small-bay-distress", "commercial-distress", "mixed-use-distress"],
    label: "Commercial / small-bay distress",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /commercial|industrial|warehouse|storage|small bay|mixed use|retail|office|auto|shop|flex|zoning/i.test(rowText(row)),
    reason: "commercial distress candidate needs verified contact export",
  },
  {
    key: "novation-retail-spread",
    aliases: ["retail-spread-novation", "novation"],
    label: "Novation / retail-spread",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|vacant-equity-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /active|listed|for sale|pending|retail|vacant|repair|rehab|distress|code/i.test(rowText(row)),
    reason: "novation/retail-spread candidate needs owner contact export first",
  },
  {
    key: "failed-landlord-exit",
    aliases: ["landlord-pain-exit", "failed-landlord"],
    label: "Failed landlord exit",
    fileTest: (name) => /^dealmachine-api-.*-(absentee-problem-stack|contactable-nurture-stack|atlas-export-needed|live-problem-stack)\.csv$/i.test(name),
    fit: (row) => /landlord|rental|portfolio|multi|absentee|out of state|tax|delinquent|lien|vacant|eviction|code|violation/i.test(rowText(row)),
    reason: "failed landlord exit signal needs Contacts export with DNC columns",
  },
  {
    key: "insurance-damage-event",
    aliases: ["damage-event", "fire-storm-damage"],
    label: "Insurance / damage event",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|vacant-equity-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /fire|storm|damage|insurance|boarded|unsafe|condemned|shell|repair|rehab|vacant|code|violation|lien/i.test(rowText(row)),
    reason: "damage event or heavy-repair signal needs contact export",
  },
  {
    key: "zombie-rehab",
    aliases: ["stalled-rehab", "zombie-project"],
    label: "Zombie rehab / stalled project",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|vacant-equity-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /rehab|unfinished|vacant|permit|lien|tax|delinquent|code|violation|repair|demo|shell|boarded/i.test(rowText(row)),
    reason: "stalled rehab signal needs exact Contacts export",
  },
  {
    key: "senior-downsizer",
    aliases: ["equity-rich-downsizer", "downsizer"],
    label: "Equity-rich downsizer",
    fileTest: (name) => /^dealmachine-api-.*-(contactable-nurture-stack|atlas-export-needed|ready-now)\.csv$/i.test(name),
    fit: (row) => /equity|owner occupied|long term|senior|tax|free and clear|absentee/i.test(rowText(row)) || numberish(pick(row, ["equity_percent"])) >= 80,
    reason: "high-equity simplify/downsize signal needs Contacts export",
  },
  {
    key: "rent-gap-multifamily",
    aliases: ["small-multifamily-rent-gap", "rent-gap"],
    label: "Small multifamily rent gap",
    fileTest: (name) => /^dealmachine-api-.*-(contactable-nurture-stack|absentee-problem-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /duplex|triplex|fourplex|multi|multifamily|apartment|units|rent|rental|portfolio|landlord/i.test(rowText(row)),
    reason: "small multifamily rent-gap signal needs Contacts export",
  },
  {
    key: "probate-vacant-equity",
    aliases: ["probate-vacant", "estate-vacant-equity"],
    label: "Probate + vacant + equity",
    fileTest: (name) => /^dealmachine-api-.*-(vacant-equity-stack|atlas-export-needed|live-problem-stack)\.csv$/i.test(name),
    fit: (row) => /probate|estate|heir|vacant|inherited|cleanout|equity|tax|delinquent/i.test(rowText(row)),
    reason: "probate/vacant/equity signal needs Contacts export",
  },
  {
    key: "tired-airbnb-midterm",
    aliases: ["tired-airbnb", "str-midterm-rental"],
    label: "Tired Airbnb / midterm rental",
    fileTest: (name) => /^dealmachine-api-.*-(contactable-nurture-stack|atlas-export-needed|ready-now)\.csv$/i.test(name),
    fit: (row) => /airbnb|short term|str|midterm|furnished|rental|vacancy|booking|portfolio|absentee/i.test(rowText(row)),
    reason: "rental-operator fatigue signal needs Contacts export",
  },
  {
    key: "utility-lien-water-shutoff",
    aliases: ["utility-lien", "water-lien"],
    label: "Utility / water lien pressure",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|tax-due-now-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /water|utility|nuisance|lien|tax|delinquent|municipal|code|violation|vacant/i.test(rowText(row)),
    reason: "utility/water lien or municipal-pressure signal needs Contacts export",
  },
  {
    key: "contractor-distress-flip",
    aliases: ["contractor-distress", "heavy-rehab-buyer-seller"],
    label: "Contractor distress buyer-seller flip",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|vacant-equity-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /contractor|fire|structural|rehab|repair|damage|vacant|code|violation|demo|shell|boarded/i.test(rowText(row)),
    reason: "contractor-heavy distress signal needs Contacts export",
  },
  {
    key: "small-commercial-owner-exit",
    aliases: ["small-commercial-exit", "mixed-use-owner-exit"],
    label: "Small commercial owner exit",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|atlas-export-needed|ready-now)\.csv$/i.test(name),
    fit: (row) => /commercial|mixed use|retail|office|warehouse|industrial|small bay|shop|storage|zoning|vacant|lease/i.test(rowText(row)),
    reason: "small commercial owner-exit signal needs Contacts export",
  },
  {
    key: "portfolio-fragmentation",
    aliases: ["portfolio-breakoff", "one-door-portfolio"],
    label: "Portfolio fragmentation",
    fileTest: (name) => /^dealmachine-api-.*-(absentee-problem-stack|contactable-nurture-stack|atlas-export-needed|live-problem-stack)\.csv$/i.test(name),
    fit: (row) => /portfolio|multiple properties|multi|landlord|rental|tax|lien|vacant|code|violation|absentee/i.test(rowText(row)),
    reason: "portfolio-fragmentation candidate needs Contacts export",
  },
  {
    key: "buyer-reverse-engineering",
    aliases: ["reverse-engineered-buyer-demand", "buyer-pattern-seller"],
    label: "Buyer reverse-engineering",
    fileTest: (name) => /^dealmachine-api-.*-(contactable-nurture-stack|vacant-equity-stack|atlas-export-needed|ready-now)\.csv$/i.test(name),
    fit: (row) => /buyer|buy box|cash buyer|rental|portfolio|duplex|land|builder|vacant|equity|absentee/i.test(rowText(row)) || hasDistressSignal(row),
    reason: "buyer-pattern candidate needs Contacts export",
  },
  {
    key: "permit-spike-developer-land",
    aliases: ["permit-spike", "developer-land-spike"],
    label: "Permit spike developer / land",
    fileTest: (name) => /^dealmachine-api-.*-(vacant-equity-stack|atlas-export-needed|live-problem-stack)\.csv$/i.test(name),
    fit: (row) => /permit|new construction|developer|infill|land|lot|vacant|zoning|assemblage|teardown|demo/i.test(rowText(row)) || isLandWholesaleCandidate(row),
    reason: "developer/permit-spike land candidate needs Contacts export",
  },
  {
    key: "judgment-lien-pressure",
    aliases: ["judgment-lien", "lien-pressure"],
    label: "Judgment / lien pressure",
    fileTest: (name) => /^dealmachine-api-.*-(live-problem-stack|tax-due-now-stack|atlas-export-needed)\.csv$/i.test(name),
    fit: (row) => /judgment|lien|tax|delinquent|municipal|title|code|violation|nuisance|foreclosure/i.test(rowText(row)),
    reason: "judgment/lien pressure signal needs Contacts export",
  },
  {
    key: "tax-assessment-shock",
    aliases: ["assessment-shock", "tax-burden"],
    label: "Tax assessment shock",
    fileTest: (name) => /^dealmachine-api-.*-(tax-due-now-stack|contactable-nurture-stack|atlas-export-needed|ready-now)\.csv$/i.test(name),
    fit: (row) => /assessment|tax|delinquent|high equity|equity|senior|absentee|out of state/i.test(rowText(row)) || hasTaxSignal(row),
    reason: "tax-burden or assessment-shock signal needs Contacts export",
  },
]

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseList(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map(normalizeSlug)
    .filter(Boolean)
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

function normalizeHeader(value) {
  return normalizeSlug(value).replace(/-/g, "_")
}

function loadCsv(file) {
  const rows = parseCsvText(fs.readFileSync(file, "utf8"))
  const header = rows[0] || []
  return rows.slice(1).map((values) => Object.fromEntries(header.map((col, index) => [normalizeHeader(col), String(values[index] || "").trim()])))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function pick(row, names) {
  for (const name of names) {
    const value = row[normalizeHeader(name)]
    if (value) return value
  }
  return ""
}

function boolish(value) {
  return /^(true|yes|y|1)$/i.test(String(value || "").trim())
}

function numberish(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function rowText(row) {
  return Object.values(row).join(" ")
}

function hasTaxSignal(row) {
  return boolish(pick(row, ["tax_delinquent"])) || Boolean(pick(row, ["tax_delinquent_year", "past_due_amount", "delinquent_amount"]))
}

function hasCodeSignal(row) {
  return boolish(pick(row, ["code_violation_hit"])) || Boolean(pick(row, ["code_violation", "violation", "stack_method"]))
}

function hasDistressSignal(row) {
  return numberish(pick(row, ["distress_score", "priority_score"])) >= 70 || /vacant|unsafe|lien|preforeclosure|code|violation|tax|delinquent|repair|rehab|distress/i.test(rowText(row))
}

function isLandWholesaleCandidate(row) {
  const text = rowText(row).toLowerCase()
  const estimatedValue = numberish(pick(row, ["estimated_value", "estimated_value_value", "current_listing_price", "list_price"]))
  const rentEstimate = numberish(pick(row, ["rent_estimate"]))
  const vacant = boolish(pick(row, ["is_vacant", "vacant"])) || /\bvacant\b/.test(text)
  const landSignal = /\b(vacant land|raw land|land only|residential vacant|vacant lot|side lot|infill lot|lot|parcel|buildable|zoning|acre|acres|assemblage)\b/.test(text)
  const lowStructureSignal = !/\b(duplex|triplex|fourplex|apartment|commercial|industrial|warehouse|mixed use|retail|office)\b/.test(text)
  const developerSignal = /\b(infill|developer|builder|new construction|permit|redevelopment|assemblage|zoning|lot|land)\b/.test(text)
  return (landSignal || (vacant && lowStructureSignal && (!rentEstimate || rentEstimate < 800) && (!estimatedValue || estimatedValue <= 250000))) && (developerSignal || hasDistressSignal(row))
}

function isOutOfState(row) {
  const propertyState = pick(row, ["property_state", "state"])
  const ownerState = pick(row, ["owner_state", "primary_mailing_state", "mailing_state"])
  return boolish(pick(row, ["out_of_state_owner"])) || Boolean(propertyState && ownerState && propertyState.toUpperCase() !== ownerState.toUpperCase())
}

function hasContactSignal(row) {
  return (
    boolish(pick(row, ["has_email_address", "has_phone_number"])) ||
    numberish(pick(row, ["email_count", "phone_count"])) > 0 ||
    Boolean(pick(row, ["surfaced_emails", "surfaced_phone_numbers"]))
  )
}

function marketFromFile(name) {
  const match = name.match(/^dealmachine-api-(.*?)(?:-(?:atlas-export-needed|ready-now|live-problem-stack|tax-due-now-stack|preforeclosure-saveable-stack|absentee-problem-stack|vacant-equity-stack|contactable-nurture-stack))?\.csv$/i)
  return match ? normalizeSlug(match[1]) : ""
}

function marketFromRow(row, fallback) {
  const city = pick(row, ["market_city", "property_city", "city"])
  const state = pick(row, ["market_state", "property_state", "state"])
  return city && state ? normalizeSlug(`${city}-${state}`) : fallback
}

function propertyAddress(row) {
  return (
    pick(row, ["property_address_full", "property_full_address", "associated_property_address_full", "address"]) ||
    [pick(row, ["property_address_line_1", "property_address", "address_line_1"]), pick(row, ["property_city", "city"]), pick(row, ["property_state", "state"]), pick(row, ["property_zip", "zip"])].filter(Boolean).join(", ")
  )
}

function canonicalRow(row, sourceFile, strategy) {
  const market = marketFromRow(row, marketFromFile(path.basename(sourceFile)))
  const address = propertyAddress(row)
  return {
    strategy_key: strategy.key,
    strategy_name: strategy.label,
    market,
    dealmachine_id: pick(row, ["dealmachine_id", "lead_id", "id"]),
    property_address_full: address,
    property_address_line_1: pick(row, ["property_address_line_1", "property_address", "address_line_1"]) || address.split(",")[0],
    property_city: pick(row, ["property_city", "city", "market_city"]),
    property_state: pick(row, ["property_state", "state", "market_state"]),
    property_zip: pick(row, ["property_zip", "zip"]),
    owner_name: pick(row, ["owner_name", "record_owner_name", "contact_full_name"]),
    has_email_address: pick(row, ["has_email_address"]),
    has_phone_number: pick(row, ["has_phone_number"]),
    email_count: pick(row, ["email_count"]),
    phone_count: pick(row, ["phone_count"]),
    dnc_visible_before_export: pick(row, ["surfaced_phone_dnc", "phone_dnc", "do_not_call"]),
    atlas_export_needed: pick(row, ["atlas_export_needed"]) || "true",
    distress_score: pick(row, ["distress_score", "priority_score"]),
    estimated_value: pick(row, ["estimated_value", "estimated_value_value", "current_listing_price", "list_price"]),
    rent_estimate: pick(row, ["rent_estimate"]),
    is_vacant: pick(row, ["is_vacant", "vacant"]),
    active_lien: pick(row, ["active_lien"]),
    equity_amount: pick(row, ["equity_amount"]),
    equity_percent: pick(row, ["equity_percent"]),
    tax_delinquent: pick(row, ["tax_delinquent"]),
    code_violation: pick(row, ["code_violation", "violation", "stack_method"]),
    export_action: "DealMachine Contacts export only; do not run DealMachine skip tracing unless a human explicitly opts in.",
    export_reason: strategy.reason,
    source_file: path.relative(process.cwd(), sourceFile),
  }
}

function selectStrategies() {
  if (STRATEGY_ARG === "all") return STRATEGY_DEFINITIONS
  const match = STRATEGY_DEFINITIONS.find((strategy) => strategy.key === STRATEGY_ARG || strategy.aliases.includes(STRATEGY_ARG))
  if (!match) {
    throw new Error(`Unknown strategy "${STRATEGY_ARG}". Use one of: all, ${STRATEGY_DEFINITIONS.map((strategy) => strategy.key).join(", ")}`)
  }
  return [match]
}

function queueFilesForStrategy(strategy) {
  if (QUEUE_CSV) return [path.resolve(QUEUE_CSV)]
  if (!fs.existsSync(OUT_DIR)) return []
  return fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.endsWith(".csv"))
    .filter((name) => strategy.fileTest(name))
    .map((name) => path.join(OUT_DIR, name))
}

function marketAllowed(market, sourceFile) {
  if (!MARKET_FILTERS.length) return true
  const fileMarket = marketFromFile(path.basename(sourceFile))
  return MARKET_FILTERS.includes(market) || MARKET_FILTERS.includes(fileMarket)
}

function dedupeKey(row) {
  const id = row.dealmachine_id
  if (id) return `id:${id}`
  return `addr:${normalizeSlug(row.property_address_full)}`
}

function buildRequests() {
  const selectedStrategies = selectStrategies()
  const requests = []
  const summaryByStrategy = new Map()

  for (const strategy of selectedStrategies) {
    const seen = new Set()
    const candidates = []
    let scanned = 0
    let contactSignalSkipped = 0
    for (const file of queueFilesForStrategy(strategy)) {
      if (!fs.existsSync(file)) continue
      for (const raw of loadCsv(file)) {
        scanned++
        const canonical = canonicalRow(raw, file, strategy)
        if (!marketAllowed(canonical.market, file)) continue
        if (!canonical.property_address_full) continue
        if (!strategy.fit(raw)) continue
        if (!INCLUDE_NO_CONTACT_SIGNAL && !hasContactSignal(raw)) {
          contactSignalSkipped++
          continue
        }
        const key = `${strategy.key}:${dedupeKey(canonical)}`
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(canonical)
      }
    }
    const selected = balancedByMarket(candidates, LIMIT)
    requests.push(...selected)
    summaryByStrategy.set(strategy.key, {
      strategyKey: strategy.key,
      strategyName: strategy.label,
      requestedRows: selected.length,
      scannedRows: scanned,
      skippedNoContactSignal: contactSignalSkipped,
    })
  }

  return { requests, summaryByStrategy: [...summaryByStrategy.values()] }
}

function balancedByMarket(rows, limit) {
  if (rows.length <= limit) return rows
  const grouped = new Map()
  for (const row of rows) {
    const market = row.market || "unknown-market"
    const group = grouped.get(market) || []
    group.push(row)
    grouped.set(market, group)
  }
  const preferred = MARKET_FILTERS.length ? MARKET_FILTERS.filter((market) => grouped.has(market)) : []
  const rest = [...grouped.keys()].filter((market) => !preferred.includes(market)).sort()
  const markets = [...preferred, ...rest]
  const selected = []
  while (selected.length < limit && markets.some((market) => (grouped.get(market) || []).length)) {
    for (const market of markets) {
      const group = grouped.get(market) || []
      const next = group.shift()
      if (next) selected.push(next)
      if (selected.length >= limit) break
    }
  }
  return selected
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function localDateStamp(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function writeCsv(file, columns, rows) {
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
}

function buildListPackages(requests, columns, runStamp) {
  const packageDir = path.join(OUTREACH_DIR, `dealmachine-list-package-${runStamp}`)
  fs.mkdirSync(packageDir, { recursive: true })
  const grouped = new Map()

  for (const row of requests) {
    const key = `${row.strategy_key || "unknown"}:${row.market || "unknown-market"}`
    const group = grouped.get(key) || {
      strategyKey: row.strategy_key || "unknown",
      strategyName: row.strategy_name || "Unknown strategy",
      market: row.market || "unknown-market",
      rows: [],
    }
    group.rows.push(row)
    grouped.set(key, group)
  }

  return [...grouped.values()]
    .sort((a, b) => a.strategyKey.localeCompare(b.strategyKey) || a.market.localeCompare(b.market))
    .map((group) => {
      const filename = `${group.strategyKey}-${group.market}.csv`
      const file = path.join(packageDir, filename)
      const listName = `VB ${group.strategyKey} ${group.market} ${localDateStamp()}`
      writeCsv(file, columns, group.rows)
      return {
        listName,
        strategyKey: group.strategyKey,
        strategyName: group.strategyName,
        market: group.market,
        rows: group.rows.length,
        file: path.relative(process.cwd(), file),
      }
    })
}

function writeOutputs(requests, summaryByStrategy) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const runStamp = stamp()
  const csvPath = path.join(OUT_DIR, `dealmachine-contact-export-request-${runStamp}.csv`)
  const summaryPath = path.join(OUT_DIR, `dealmachine-contact-export-request-summary-${runStamp}.json`)
  const guidePath = path.join(OUTREACH_DIR, `dealmachine-contact-export-request-${runStamp}.md`)
  const columns = [
    "strategy_key",
    "strategy_name",
    "market",
    "dealmachine_id",
    "property_address_full",
    "property_address_line_1",
    "property_city",
    "property_state",
    "property_zip",
    "owner_name",
    "has_email_address",
    "has_phone_number",
    "email_count",
    "phone_count",
    "dnc_visible_before_export",
    "atlas_export_needed",
    "distress_score",
    "estimated_value",
    "rent_estimate",
    "is_vacant",
    "active_lien",
    "equity_amount",
    "equity_percent",
    "tax_delinquent",
    "code_violation",
    "export_action",
    "export_reason",
    "source_file",
  ]
  writeCsv(csvPath, columns, requests)
  const listPackages = buildListPackages(requests, columns, runStamp)

  const markets = [...new Set(requests.map((row) => row.market).filter(Boolean))].sort()
  const strategies = [...new Set(requests.map((row) => row.strategy_key))]
  const summary = {
    createdAt: new Date().toISOString(),
    strategyArg: STRATEGY_ARG,
    limitPerStrategy: LIMIT,
    totalRows: requests.length,
    markets,
    strategies,
    includeNoContactSignal: INCLUDE_NO_CONTACT_SIGNAL,
    noDealMachineSkipTraceDefault: true,
    csvPath: path.relative(process.cwd(), csvPath),
    guidePath: path.relative(process.cwd(), guidePath),
    listPackages,
    summaryByStrategy,
    nextCommands: [
      "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
      "pnpm run distress:dealmachine:export-outreach -- --strategy=<strategy-key> --export-csv=data/dm-exports/<market>-<date>.csv --queue-csv=<queue-file> --limit=100",
    ],
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  const guide = [
    "# DealMachine Contact Export Request",
    "",
    `Created: ${summary.createdAt}`,
    `Rows requested: ${requests.length}`,
    `Strategies: ${strategies.join(", ") || "none"}`,
    `Markets: ${markets.join(", ") || "none"}`,
    "",
    "## Rule",
    "",
    "Use DealMachine to pull or export the list. Do not use DealMachine skip tracing as the default. This package is for a Contacts export so VestBlock can verify email, phone, and DNC fields before outreach.",
    "",
    "## DealMachine Steps",
    "",
    "1. Open DealMachine and create one saved/static list per package below.",
    "2. Use the package CSV for exact rows by property address or DealMachine lead ID; do not broaden into unrelated market leads.",
    "3. Name each list exactly as shown so later exports can be traced back to strategy and market.",
    "4. Export Leads -> Contacts.",
    "5. Export settings: Likely Property Owners, Scrub DNC on, Scrub Landline on, Deduplicate on, include contacts without phone numbers on.",
    "6. Save the downloaded CSV, then run the split ingest command below.",
    "",
    "## Saved List Packages",
    "",
    ...listPackages.map((item) => `- ${item.listName}: ${item.rows} rows -> ${item.file}`),
    "",
    "## Files",
    "",
    `- Export request CSV: ${summary.csvPath}`,
    `- Summary JSON: ${path.relative(process.cwd(), summaryPath)}`,
    "",
    "## Commands After Download",
    "",
    "```bash",
    "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
    "pnpm run distress:dealmachine:export-outreach -- --strategy=<strategy-key> --export-csv=data/dm-exports/<market>-<date>.csv --queue-csv=<queue-file> --limit=100",
    "```",
    "",
    "## Strategy Counts",
    "",
    ...summaryByStrategy.map((row) => `- ${row.strategyName}: ${row.requestedRows} requested from ${row.scannedRows} scanned${row.skippedNoContactSignal ? `; ${row.skippedNoContactSignal} skipped without visible contact signal` : ""}`),
    "",
  ].join("\n")
  fs.writeFileSync(guidePath, guide)

  return { csvPath, summaryPath, guidePath, summary }
}

function main() {
  const { requests, summaryByStrategy } = buildRequests()
  const { csvPath, summaryPath, guidePath, summary } = writeOutputs(requests, summaryByStrategy)

  console.log("=== DealMachine contact export request ===")
  console.log(`Strategy:        ${STRATEGY_ARG}`)
  console.log(`Rows requested:  ${requests.length}`)
  console.log(`Markets:         ${summary.markets.join(", ") || "none"}`)
  console.log(`CSV:             ${csvPath}`)
  console.log(`Guide:           ${guidePath}`)
  console.log(`Summary:         ${summaryPath}`)
  console.log(`List packages:   ${summary.listPackages.length}`)
  console.log("")
  for (const row of summaryByStrategy) {
    console.log(`- ${row.strategyName}: ${row.requestedRows}/${LIMIT} requested (${row.scannedRows} scanned)`)
  }
  console.log("")
  console.log("Next:")
  console.log("  1. Create the saved DealMachine lists shown in the guide. Do not run DM skip tracing by default.")
  console.log("  2. Export Contacts with Likely Owners, DNC scrub, landline scrub, and dedupe on.")
  console.log("  3. Run: pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/export.csv --split-by-market")
}

main()
