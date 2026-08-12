#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const INPUT = path.resolve(getArg("input") || newestStackCsv() || "")
const OUT_DIR = path.join(process.cwd(), "data", "operating-loops", "county-code-stacked-lanes")
const LIMIT = Number.parseInt(getArg("limit") || "500", 10)

function newestStackCsv() {
  const dir = path.join(process.cwd(), "data", "distress-leads")
  if (!fs.existsSync(dir)) return ""
  const hits = fs
    .readdirSync(dir)
    .filter((name) => /^dealmachine-tax-code-stack-.*\.csv$/i.test(name))
    .map((name) => {
      const file = path.join(dir, name)
      return { file, mtime: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
  return hits[0]?.file || ""
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          value += "\""
          i += 1
        } else {
          inQuotes = false
        }
      } else value += ch
      continue
    }
    if (ch === "\"") inQuotes = true
    else if (ch === ",") {
      row.push(value)
      value = ""
    } else if (ch === "\n") {
      row.push(value)
      rows.push(row)
      row = []
      value = ""
    } else if (ch !== "\r") value += ch
  }
  if (value || row.length) {
    row.push(value)
    rows.push(row)
  }
  const [header = [], ...body] = rows
  return body
    .filter((cols) => cols.some((cell) => String(cell || "").trim()))
    .map((cols) => Object.fromEntries(header.map((key, index) => [key, cols[index] ?? ""])))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function numberish(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function boolish(value) {
  return /^(true|yes|y|1)$/i.test(String(value || "").trim())
}

function haystack(row) {
  return [
    row.stack_method,
    row.code_violation,
    row.suggested_exit_paths,
    row.seller_review_summary,
    row.next_action,
    row.owner_name,
    row.property_address_full,
    row.is_vacant,
    row.out_of_state_owner,
    row.active_lien,
    row.tax_delinquent,
    row.past_due_amount,
    row.estimated_value,
    row.equity_percent,
  ].join(" ").toLowerCase()
}

function routeRow(row) {
  const text = haystack(row)
  const lanes = new Set()
  const score = numberish(row.priority_score)
  const equity = numberish(row.equity_percent)
  const value = numberish(row.estimated_value_value || row.estimated_value)
  const pastDue = numberish(row.past_due_amount_value || row.past_due_amount)
  const codeHit = boolish(row.code_violation_hit)
  const taxHit = boolish(row.tax_delinquent) || numberish(row.past_due_amount_value || row.past_due_amount) > 0 || /tax_delinquent/.test(text)
  const vacant = boolish(row.is_vacant) || /\b(vacant|boarded|unoccupied|empty)\b/.test(text)
  const outOfState = boolish(row.out_of_state_owner)
  const activeLien = boolish(row.active_lien) || /\b(lien|judgment|municipal lien|tax lien)\b/.test(text)
  const severeCondition = /\b(condemn|unsafe|structural|roof|demolition|demo|fire|board|deteriorated|danger)\b/.test(text)
  const landlord = /\b(llc|holdings|rental|tenant|landlord|portfolio|property management|sfr)\b/.test(text)
  const land = /\b(lot|land|parcel|infill|side lot|vacant land|yard|grass|limbs|brush)\b/.test(text)
  const ownerEntity = /\b(llc|inc|corp|company|co\.|holdings|trust|partners|lp|property|assets|sfr)\b/i.test(row.owner_name || "")
  const lowValue = value > 0 && value <= 85000
  const midValue = value >= 85000 && value <= 225000
  const higherValue = value > 225000
  const highEquity = equity >= 45 || numberish(row.equity_amount) >= 75000
  const contactReady = boolish(row.has_email_address) || boolish(row.has_phone_number)
  const lowPastDue = taxHit && pastDue > 0 && pastDue < 2500
  const materialPastDue = pastDue >= 2500 && pastDue < 10000
  const heavyPastDue = pastDue >= 10000
  const trashGrass = /\b(trash|litter|grass|weed|brush|limbs|rubbish|refuse|storage|junk)\b/.test(text)
  const buildingCase = /\b(building|residence|roof|porch|foundation|structural|unsafe|deteriorated|condemn|demolition|zoning)\b/.test(text)
  const utilityOrSystems = /\b(utility|water|sewer|electrical|plumbing|furnace|hvac|gas|meter|service line)\b/.test(text)
  const nuisanceOrRepeat = /\b(nuisance|repeat|chronic|multiple|open case|case:|citation|summons)\b/.test(text)
  const exteriorOnly = trashGrass && !buildingCase && !severeCondition
  const likelyRental = landlord || /\b(apt|apartment|duplex|triplex|fourplex|unit|units|tenant|lease|rental)\b/.test(text)
  const urbanCore = /\b(kansas city|cincinnati|wichita|toledo|cleveland|detroit|milwaukee|flint|buffalo|kalamazoo|omaha|des moines|philadelphia|louisville|indianapolis)\b/.test(text)
  const smallBalanceSave = lowPastDue && (highEquity || value >= 75000)
  const ownerOccupiedLikely = !ownerEntity && !outOfState && !landlord
  const absenteeLikely = outOfState || /\b(absentee|mailing|remote)\b/.test(text)
  const institutionalLikely = /\b(sfr3|vinebrook|amherst|progress residential|invitation homes|main street renewal|firstkey|tricon|fund|reit|capital|asset|portfolio)\b/i.test(row.owner_name || "")

  // Core public-record distress lanes.
  if (codeHit && taxHit) lanes.add("tax-code-stack")
  else if (codeHit) lanes.add("code-violation-distress")
  else if (taxHit) lanes.add("tax-delinquent-cure")

  // Seller acquisition angles.
  if (vacant && equity >= 25) lanes.add("vacant-equity")
  if (vacant || severeCondition) lanes.add("vacant-property-refresh")
  if ((landlord || outOfState) && (codeHit || taxHit || vacant)) lanes.add("tired-landlord")
  if (landlord && value >= 75000) lanes.add("portfolio-landlord")
  if (severeCondition) lanes.add("failed-flipper-stuck-rehab")
  if (activeLien && highEquity) lanes.add("lien-equity")
  if (codeHit && severeCondition) lanes.add("municipal-pressure-resolution")
  if (outOfState && (codeHit || taxHit || vacant)) lanes.add("remote-owner-clean-exit")

  // Creative finance / structured exit angles.
  if (highEquity && (taxHit || codeHit || outOfState || landlord)) lanes.add("seller-finance-equity")
  if (highEquity && midValue && !severeCondition) lanes.add("novation-retail-spread")
  if (taxHit && pastDue >= 5000 && highEquity) lanes.add("tax-cure-installment-review")
  if (taxHit && highEquity && (outOfState || landlord)) lanes.add("subject-to-watchlist")

  // Land, infill, and rebuild/dispo paths.
  if (land) lanes.add("land-wholesale")
  if (land || severeCondition) lanes.add("builder-infill-teardown")
  if (land && lowValue) lanes.add("urban-grower-land-dispo")
  if ((land || vacant) && codeHit) lanes.add("land-bank-rebuild-referral")
  if (severeCondition) lanes.add("contractor-buyer-match")
  if (landlord && midValue) lanes.add("dscr-rental-buyer-match")

  // Risk / manual-review lanes that should not be treated like normal blast lists.
  if (ownerEntity && (codeHit || taxHit)) lanes.add("entity-owner-direct-skiptrace")
  if (!contactReady) lanes.add("needs-skiptrace")
  if (score >= 90 || (codeHit && taxHit && highEquity)) lanes.add("hot-stack-manual-review")
  if (score >= 85) lanes.add("fast-cash-review")
  if (score >= 80 || land || severeCondition) lanes.add("buyer-match-needed")

  // Additional stack methods: offer structure.
  if (smallBalanceSave) lanes.add("tax-payoff-fast-close")
  if (materialPastDue && highEquity) lanes.add("tax-cure-equity-offer")
  if (heavyPastDue && highEquity) lanes.add("deep-tax-distress-offer")
  if (codeHit && trashGrass && !severeCondition) lanes.add("cleanup-credit-offer")
  if (codeHit && buildingCase) lanes.add("code-repair-credit-offer")
  if (highEquity && ownerOccupiedLikely && !severeCondition) lanes.add("retail-cleanup-novation")
  if (highEquity && absenteeLikely) lanes.add("absentee-equity-cash-or-carry")
  if (higherValue && highEquity && !severeCondition) lanes.add("premium-equity-direct-offer")
  if (lowValue && severeCondition) lanes.add("ultra-low-basis-rehab-buyer")

  // Additional stack methods: buyer/dispo and partner paths.
  if (land || trashGrass) lanes.add("side-lot-neighbor-outreach")
  if (land || vacant) lanes.add("infill-builder-buyer-match")
  if (buildingCase || severeCondition) lanes.add("heavy-rehab-buyer-match")
  if (taxHit && codeHit) lanes.add("tax-code-buyer-packet")
  if (ownerEntity && (landlord || value >= 100000)) lanes.add("investor-owner-buyer-referral")
  if (lowValue && (land || vacant || severeCondition)) lanes.add("local-small-investor-blast")
  if (codeHit && (trashGrass || land)) lanes.add("neighborhood-association-referral")
  if (land || vacant || codeHit) lanes.add("municipal-nonprofit-rebuild-referral")

  // Additional stack methods: data enrichment and legal/title risk research.
  if (ownerEntity) lanes.add("secretary-of-state-owner-lookup")
  if (/trust|estate|heir|deceased|probate/.test(text) || /\btr\b/i.test(row.owner_name || "")) lanes.add("probate-title-research")
  if (/bank|mortgage|servicing|hud|fannie|freddie|sheriff|auction|foreclosure/.test(text)) lanes.add("foreclosure-auction-crosscheck")
  if (taxHit) lanes.add("treasurer-balance-verification")
  if (codeHit) lanes.add("municipal-case-verification")
  if (activeLien) lanes.add("lien-payoff-verification")
  if (!row.dealmachine_id && !contactReady) lanes.add("county-owner-record-lookup")
  if (contactReady) lanes.add("email-sms-ready")

  // More stacked strategy methods: seller psychology / timing.
  if (ownerOccupiedLikely && codeHit && !severeCondition) lanes.add("owner-occupant-soft-help")
  if (ownerOccupiedLikely && taxHit && lowPastDue) lanes.add("small-tax-balance-save-or-buy")
  if (absenteeLikely && codeHit && trashGrass) lanes.add("remote-maintenance-headache")
  if (nuisanceOrRepeat && codeHit) lanes.add("repeat-code-pressure")
  if (exteriorOnly) lanes.add("quick-cleanup-before-sale")
  if (utilityOrSystems) lanes.add("systems-repair-distress")

  // More stacked strategy methods: rental and tenant-based monetization.
  if (likelyRental && codeHit) lanes.add("rental-code-compliance-exit")
  if (likelyRental && taxHit) lanes.add("rental-tax-pressure-exit")
  if (likelyRental && highEquity) lanes.add("lease-option-buyer-review")
  if (likelyRental && value >= 60000) lanes.add("section-8-landlord-buyer-match")
  if (likelyRental && severeCondition) lanes.add("occupied-heavy-rehab-risk-review")

  // More stacked strategy methods: institutional / entity owner.
  if (institutionalLikely && codeHit) lanes.add("institutional-tail-risk-cleanup")
  if (institutionalLikely && taxHit) lanes.add("institutional-noncore-disposition")
  if (ownerEntity && lowValue) lanes.add("entity-low-value-cleanout")
  if (ownerEntity && highEquity && codeHit) lanes.add("entity-equity-code-resolution")

  // More stacked strategy methods: public program and neighborhood reuse.
  if (urbanCore && land) lanes.add("urban-infill-microbuilder-match")
  if (urbanCore && vacant && lowValue) lanes.add("affordable-housing-nonprofit-referral")
  if (urbanCore && codeHit && buildingCase) lanes.add("community-development-rehab-referral")
  if (urbanCore && land && trashGrass) lanes.add("garden-side-yard-program")
  if (urbanCore && severeCondition) lanes.add("demolition-grant-watchlist")

  // More stacked strategy methods: capital partner / lending angle.
  if (highEquity && !severeCondition && taxHit) lanes.add("private-lender-tax-cure-referral")
  if (highEquity && likelyRental) lanes.add("dscr-refi-rescue-watchlist")
  if (highEquity && codeHit && buildingCase) lanes.add("rehab-loan-partner-review")
  if (value >= 150000 && highEquity && absenteeLikely) lanes.add("bridge-buyer-or-seller-carry")

  // More stacked strategy methods: data enrichment and comp work.
  if (buyerMatchNeeded(row, lanes)) lanes.add("streetview-condition-check")
  if (land || vacant || severeCondition) lanes.add("google-maps-lot-context")
  if (highEquity || value >= 100000) lanes.add("arv-comp-pack-needed")
  if (likelyRental) lanes.add("rent-comp-dscr-check")
  if (land) lanes.add("zoning-and-lot-size-check")

  return [...lanes].sort()
}

function buyerMatchNeeded(row, lanes) {
  return lanes.has("buyer-match-needed") || lanes.has("contractor-buyer-match") || lanes.has("dscr-rental-buyer-match") || numberish(row.priority_score) >= 80
}

function laneFamily(lane) {
  if (/buyer|dscr|contractor|dispo|land-bank|grower/.test(lane)) return "buyer_dispo"
  if (/seller-finance|novation|subject-to|installment/.test(lane)) return "creative_finance"
  if (/skiptrace|manual-review|watchlist/.test(lane)) return "risk_review"
  return "seller_acquisition"
}

function lanePriority(row, lane) {
  let score = numberish(row.priority_score)
  if (/hot-stack|tax-code-stack|buyer-match-needed|fast-cash/.test(lane)) score += 8
  if (/needs-skiptrace|watchlist/.test(lane)) score -= 10
  if (/creative|seller-finance|novation|subject-to/.test(lane)) score += 4
  return Math.max(0, Math.min(100, score))
}

function reasonFor(row, lane) {
  const parts = []
  if (row.stack_method) parts.push(row.stack_method)
  if (row.code_violation) parts.push(`code: ${row.code_violation}`)
  if (row.tax_delinquent) parts.push(`tax: ${row.tax_delinquent}`)
  if (row.past_due_amount) parts.push(`past due: ${row.past_due_amount}`)
  if (row.is_vacant) parts.push(`vacant: ${row.is_vacant}`)
  if (row.out_of_state_owner) parts.push(`oos owner: ${row.out_of_state_owner}`)
  if (row.equity_percent) parts.push(`equity: ${row.equity_percent}`)
  if (row.active_lien) parts.push(`lien: ${row.active_lien}`)
  parts.push(`family: ${laneFamily(lane)}`)
  parts.push(`routed: ${lane}`)
  return parts.filter(Boolean).join(" | ")
}

function writeCsv(file, rows) {
  const columns = [
    "lane",
    "lane_family",
    "lane_priority",
    "market",
    "property_address_full",
    "owner_name",
    "dealmachine_id",
    "priority_score",
    "stack_method",
    "code_violation",
    "tax_delinquent",
    "past_due_amount",
    "estimated_value",
    "equity_percent",
    "is_vacant",
    "out_of_state_owner",
    "has_email_address",
    "has_phone_number",
    "route_reason",
    "next_action",
  ]
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
}

function main() {
  if (!INPUT || !fs.existsSync(INPUT)) throw new Error("Missing --input=<dealmachine-tax-code-stack csv>")
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const rows = parseCsv(fs.readFileSync(INPUT, "utf8")).slice(0, LIMIT)
  const routed = []
  for (const row of rows) {
    for (const lane of routeRow(row)) {
      routed.push({
        ...row,
        lane,
        lane_family: laneFamily(lane),
        lane_priority: lanePriority(row, lane),
        route_reason: reasonFor(row, lane),
      })
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const allCsv = path.join(OUT_DIR, `county-code-stacked-lanes-${stamp}.csv`)
  writeCsv(allCsv, routed)

  const byLane = new Map()
  for (const row of routed) {
    const group = byLane.get(row.lane) || []
    group.push(row)
    byLane.set(row.lane, group)
  }

  const laneFiles = {}
  for (const [lane, laneRows] of byLane) {
    const file = path.join(OUT_DIR, `${slug(lane)}-${stamp}.csv`)
    writeCsv(file, laneRows)
    laneFiles[lane] = path.relative(process.cwd(), file)
  }

  const summary = {
    createdAt: new Date().toISOString(),
    input: path.relative(process.cwd(), INPUT),
    rowsRead: rows.length,
    routedRows: routed.length,
    lanes: [...byLane.entries()].map(([lane, laneRows]) => ({
      lane,
      family: laneFamily(lane),
      rows: laneRows.length,
      contactReady: laneRows.filter((row) => boolish(row.has_email_address) || boolish(row.has_phone_number)).length,
      averagePriority: Math.round(laneRows.reduce((sum, row) => sum + numberish(row.lane_priority), 0) / Math.max(1, laneRows.length)),
      file: laneFiles[lane],
    })).sort((a, b) => b.rows - a.rows || a.lane.localeCompare(b.lane)),
    allCsv: path.relative(process.cwd(), allCsv),
  }
  const summaryFile = path.join(OUT_DIR, `county-code-stacked-lanes-${stamp}.json`)
  fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`)

  console.log("=== County/code stacked lane routing ===")
  console.log(`Input:       ${summary.input}`)
  console.log(`Rows read:   ${summary.rowsRead}`)
  console.log(`Routed rows: ${summary.routedRows}`)
  for (const lane of summary.lanes) console.log(`${lane.lane}: ${lane.rows} rows (${lane.contactReady} contact-ready)`)
  console.log(`CSV:         ${summary.allCsv}`)
  console.log(`Summary:     ${path.relative(process.cwd(), summaryFile)}`)
}

main()
