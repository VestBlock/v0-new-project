/**
 * Source-led major market harvest for wholesaling expansion.
 *
 * This intentionally does not depend on DealMachine already containing market
 * inventory. It pulls address-bearing public distress sources first, then writes
 * seed files that can be pushed/enriched in DealMachine.
 */

import fs from "node:fs"
import path from "node:path"

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function dateFromEpoch(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ""
  return new Date(n).toISOString().slice(0, 10)
}

function scoreColumbus(row) {
  let score = 0
  const type = String(row.B1_PER_TYPE || "")
  const subType = String(row.B1_PER_SUB_TYPE || "")
  const task = String(row.INSPECTION_TASK || "")
  const attorney = String(row.CITY_ATTORNEY_FLAG || "")
  if (/unsafe/i.test(subType)) score += 50
  if (/building orders/i.test(type)) score += 25
  if (/proceed with orders|order/i.test(task)) score += 20
  if (attorney === "Y") score += 15
  if (/residential/i.test(String(row.LAND_USE || ""))) score += 10
  if (Number(row.OPENED_YEAR || 0) >= 2025) score += 8
  if (String(row.B1_APPL_STATUS || "").toLowerCase() !== "closed") score += 12
  return score
}

async function fetchArcgisAll(base, where, pageSize = 2000) {
  const out = []
  let offset = 0
  for (let page = 0; page < 80; page++) {
    const url = `${base}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=${pageSize}&resultOffset=${offset}&returnGeometry=false&f=json`
    const response = await fetch(url)
    const data = await response.json()
    if (data.error) throw new Error(`${base}: ${data.error.message}`)
    const features = data.features || []
    if (!features.length) break
    out.push(...features.map((feature) => feature.attributes || {}))
    offset += features.length
    if (!data.exceededTransferLimit && features.length < pageSize) break
  }
  return out
}

function writeCsv(file, rows) {
  const cols = [
    "market",
    "source",
    "priority_score",
    "property_address",
    "city",
    "state",
    "zip",
    "parcel",
    "case_id",
    "case_type",
    "case_subtype",
    "case_category",
    "status",
    "land_use",
    "opened_date",
    "order_issued_date",
    "last_status_date",
    "inspection_task",
    "city_attorney_flag",
    "source_url",
    "notes",
  ]
  fs.writeFileSync(file, [cols.join(","), ...rows.map((row) => cols.map((col) => esc(row[col])).join(","))].join("\n"))
}

async function harvestColumbus() {
  const buildingLayer = "https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/24"
  const codeLayer = "https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/23"

  const [unsafeResidential, openResidentialCode] = await Promise.all([
    fetchArcgisAll(buildingLayer, "B1_APPL_STATUS <> 'Closed' AND LAND_USE='Residential'"),
    fetchArcgisAll(codeLayer, "B1_APPL_STATUS <> 'Closed'"),
  ])

  const byAddress = new Map()
  for (const row of unsafeResidential) {
    const address = String(row.SITE_ADDRESS || "").trim()
    if (!address) continue
    const out = {
      market: "columbus",
      source: "columbus_building_compliance_open_residential",
      priority_score: scoreColumbus(row),
      property_address: address,
      city: "Columbus",
      state: "OH",
      zip: row.B1_SITUS_ZIP || "",
      parcel: row.B1_PARCEL_NBR || "",
      case_id: row.B1_ALT_ID || "",
      case_type: row.B1_PER_TYPE || "",
      case_subtype: row.B1_PER_SUB_TYPE || "",
      case_category: row.B1_PER_CATEGORY || "",
      status: row.B1_APPL_STATUS || "",
      land_use: row.LAND_USE || "",
      opened_date: dateFromEpoch(row.B1_FILE_DD),
      order_issued_date: dateFromEpoch(row.ORDER_ISSUED_DATE),
      last_status_date: dateFromEpoch(row.LAST_STATUS_DT),
      inspection_task: row.INSPECTION_TASK || "",
      city_attorney_flag: row.CITY_ATTORNEY_FLAG || "",
      source_url: row.ACA_URL || "",
      notes: "Open residential building compliance case. Seed to DealMachine, export contacts, then use several-options seller outreach.",
    }
    byAddress.set(address.toLowerCase(), out)
  }

  for (const row of openResidentialCode) {
    const address = String(row.SITE_ADDRESS || "").trim()
    if (!address) continue
    const key = address.toLowerCase()
    const existing = byAddress.get(key)
    if (existing) {
      existing.priority_score += 15
      existing.notes += ` Additional open code case: ${row.B1_PER_SUB_TYPE || row.B1_PER_TYPE || row.B1_ALT_ID}.`
      continue
    }
    byAddress.set(key, {
      market: "columbus",
      source: "columbus_code_enforcement_open",
      priority_score: 25,
      property_address: address,
      city: "Columbus",
      state: "OH",
      zip: "",
      parcel: row.B1_PARCEL_NBR || "",
      case_id: row.B1_ALT_ID || "",
      case_type: row.B1_PER_TYPE || "",
      case_subtype: row.B1_PER_SUB_TYPE || "",
      case_category: row.B1_PER_CATEGORY || "",
      status: row.B1_APPL_STATUS || "",
      land_use: "",
      opened_date: dateFromEpoch(row.B1_FILE_DD),
      order_issued_date: "",
      last_status_date: dateFromEpoch(row.INSP_LAST_DATE),
      inspection_task: row.INSP_LAST_RESULT || "",
      city_attorney_flag: "",
      source_url: row.ACA_URL || "",
      notes: "Open code enforcement case. Seed to DealMachine, export contacts, then use several-options seller outreach.",
    })
  }

  return [...byAddress.values()].sort((a, b) => b.priority_score - a.priority_score || a.property_address.localeCompare(b.property_address))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const columbus = await harvestColumbus()
  const allPath = path.join(OUT_DIR, `major-market-source-columbus-oh-${stamp}.csv`)
  const seedPath = path.join(OUT_DIR, `major-market-dealmachine-seed-columbus-oh-${stamp}.csv`)
  writeCsv(allPath, columbus)
  writeCsv(seedPath, columbus.slice(0, 250))
  console.log("=== Major market source harvest ===")
  console.log(`Columbus source rows: ${columbus.length}`)
  console.log(`Top seed rows:        ${Math.min(250, columbus.length)}`)
  console.log(`All CSV:              ${allPath}`)
  console.log(`DealMachine seed CSV: ${seedPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
