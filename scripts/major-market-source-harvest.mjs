/**
 * Fresh-city source harvest for DealMachine list building.
 *
 * This script is not the outreach source of truth. DealMachine should build and
 * export the actual contact lists. These public-source rows are used to pick
 * better cities, seed list ideas, and sanity-check DealMachine output quality.
 */

import fs from "node:fs"
import path from "node:path"

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const args = process.argv.slice(2)

const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = "indianapolis,in|charlotte,nc|louisville,ky|fayetteville,nc"
const MARKET_ARG = getArg("markets") || getArg("market") || DEFAULT_MARKETS
const SEED_LIMIT = Number.parseInt(getArg("seed-limit") || "1500", 10)
const FETCH_LIMIT = Number.parseInt(getArg("fetch-limit") || "12000", 10)

const MARKET_ALIASES = {
  "philadelphia,pa": "philadelphia-pa",
  "philadelphia,pennsylvania": "philadelphia-pa",
  "pittsburgh,pa": "pittsburgh-pa",
  "pittsburgh,pennsylvania": "pittsburgh-pa",
  "kansas city,mo": "kansas-city-mo",
  "kansas city,missouri": "kansas-city-mo",
  "new orleans,la": "new-orleans-la",
  "new orleans,louisiana": "new-orleans-la",
  "columbus,oh": "columbus-oh",
  "indianapolis,in": "indianapolis-in",
  "indianapolis,indiana": "indianapolis-in",
  "charlotte,nc": "charlotte-nc",
  "charlotte,north carolina": "charlotte-nc",
  "louisville,ky": "louisville-ky",
  "louisville,kentucky": "louisville-ky",
  "fayetteville,nc": "fayetteville-nc",
  "fayetteville,north carolina": "fayetteville-nc",
}

const ADAPTERS = {
  "philadelphia-pa": harvestPhiladelphia,
  "pittsburgh-pa": harvestPittsburgh,
  "kansas-city-mo": harvestKansasCity,
  "new-orleans-la": harvestNewOrleans,
  "columbus-oh": harvestColumbus,
  "indianapolis-in": harvestIndianapolis,
  "charlotte-nc": harvestCharlotte,
  "louisville-ky": harvestLouisville,
  "fayetteville-nc": harvestFayetteville,
}

function selectedMarkets() {
  return MARKET_ARG.split("|")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => MARKET_ALIASES[entry] || entry.replace(/\s+/g, "-").replace(",", "-"))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function slugMarket(row) {
  return `${row.city}-${row.state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function dateFromEpoch(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ""
  return new Date(n).toISOString().slice(0, 10)
}

function dateOnly(value) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function addressQualityIssue(address) {
  const value = String(address || "").trim()
  if (!value) return "missing_address"
  if (!/^\d+\s+\S+/.test(value)) return "no_street_number"
  if (/^\d+\s*[-/]\s*\d+\b/.test(value)) return "address_range"
  if (/\b(?:apt|apartment|unit|suite|ste|bldg|building|lot|room|rm|floor|fl)\b/i.test(value)) {
    return "unit_or_complex"
  }
  if (/#\s*\w+/.test(value)) return "unit_or_complex"
  if (/\b(?:rear|garage|parking|parcel|block|intersection|alley|sidewalk|streetlight|traffic|median)\b/i.test(value)) {
    return "non_primary_address"
  }
  return ""
}

function normalizeAddress(address) {
  return String(address || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*$/, "")
}

function priorityFromText(...parts) {
  const text = parts.join(" ").toLowerCase()
  let score = 20
  if (/dangerous|unsafe|imminent|structural|main structure|floor joist|rafters|foundation|collapse/.test(text)) score += 55
  if (/vacant|abandon|foreclos/.test(text)) score += 35
  if (/open|violation found|exceeded|not complied|noncompliance/.test(text)) score += 20
  if (/court|docket|notice|condemn|order/.test(text)) score += 15
  if (/trash|litter|weeds|graffiti|refuse/.test(text)) score += 6
  if (/closed|resolved|complied|no violation|abated/.test(text)) score -= 30
  return score
}

function sourceRow(row) {
  return {
    market: row.market,
    lane: "source-distress-contact-needed",
    source: row.source,
    priority_score: row.priority_score,
    property_address: normalizeAddress(row.property_address),
    city: row.city,
    state: row.state,
    zip: row.zip || "",
    parcel: row.parcel || "",
    case_id: row.case_id || "",
    case_type: row.case_type || "",
    case_subtype: row.case_subtype || "",
    case_category: row.case_category || "",
    status: row.status || "",
    land_use: row.land_use || "",
    opened_date: row.opened_date || "",
    order_issued_date: row.order_issued_date || "",
    last_status_date: row.last_status_date || "",
    inspection_task: row.inspection_task || "",
    city_attorney_flag: row.city_attorney_flag || "",
    source_url: row.source_url || "",
    notes: row.notes || "",
    rejection_reason: row.rejection_reason || "",
  }
}

function dedupeRows(rows) {
  const byAddress = new Map()
  for (const row of rows.map(sourceRow)) {
    if (!row.property_address) continue
    const key = `${row.market}|${row.property_address.toLowerCase()}`
    const existing = byAddress.get(key)
    if (!existing || Number(row.priority_score || 0) > Number(existing.priority_score || 0)) {
      byAddress.set(key, row)
    } else if (existing) {
      existing.priority_score = Number(existing.priority_score || 0) + 5
      const count = Number(existing.additional_case_count || 0) + 1
      existing.additional_case_count = count
      if (count <= 5) {
        existing.notes = `${existing.notes} Additional source case: ${row.case_subtype || row.case_type || row.case_id}.`.trim()
      }
    }
  }
  return [...byAddress.values()].sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0))
}

async function fetchSocrataAll(base, params, pageSize = 5000) {
  const rows = []
  for (let offset = 0; offset < FETCH_LIMIT; offset += pageSize) {
    const search = new URLSearchParams({ ...params, $limit: String(pageSize), $offset: String(offset) })
    const response = await fetch(`${base}?${search}`, { headers: { Accept: "application/json" } })
    const text = await response.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data) || !data.length) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

async function fetchCartoAll(sqlBase, table, where, pageSize = 5000) {
  const rows = []
  for (let offset = 0; offset < FETCH_LIMIT; offset += pageSize) {
    const sql = `select * from ${table} where ${where} order by violationdate desc limit ${pageSize} offset ${offset}`
    const response = await fetch(`${sqlBase}?q=${encodeURIComponent(sql)}`)
    const data = await response.json()
    if (data.error) throw new Error(data.error.join("; "))
    const page = data.rows || []
    if (!page.length) break
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

async function fetchCkanDatastoreAll(resourceId, pageSize = 5000) {
  const rows = []
  for (let offset = 0; offset < FETCH_LIMIT; offset += pageSize) {
    const url = `https://data.wprdc.org/api/3/action/datastore_search?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}`
    const response = await fetch(url)
    const data = await response.json()
    const page = data?.result?.records || []
    if (!page.length) break
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

async function fetchArcgisAll(base, where, options = {}) {
  const pageSize = Number(options.pageSize || 2000)
  const orderByFields = String(options.orderByFields || "").trim()
  const out = []
  for (let offset = 0; offset < FETCH_LIMIT; offset += pageSize) {
    const search = new URLSearchParams({
      where,
      outFields: "*",
      resultRecordCount: String(pageSize),
      resultOffset: String(offset),
      returnGeometry: "false",
      f: "json",
    })
    if (orderByFields) search.set("orderByFields", orderByFields)
    const url = `${base}/query?${search.toString()}`
    const response = await fetch(url)
    const data = await response.json()
    if (data.error) throw new Error(`${base}: ${data.error.message}`)
    const features = data.features || []
    if (!features.length) break
    out.push(...features.map((feature) => feature.attributes || {}))
    if (!data.exceededTransferLimit && features.length < pageSize) break
  }
  return out
}

function scoreIndianapolis(row) {
  const type = String(row.CASE_TYPE || "")
  const status = String(row.CASE_STATUS || "")
  let score = priorityFromText(type, status)
  if (/unsafe buildings/i.test(type)) score += 45
  if (/vacant board order/i.test(type)) score += 38
  if (/violation\/building|investigation\/building|repair/i.test(type)) score += 30
  if (/illegal dumping|trash|high weeds/i.test(type)) score += 12
  if (/open|in violation|overdue|not secure|legal case pending|emergency demo|nov issued|inspection pending/i.test(status)) score += 28
  if (/case initiated|pending|inspection|in process/i.test(status)) score += 14
  if (/major|minor|self abated|complied|paid|cleaned/i.test(status)) score -= 10
  return score
}

function scoreCharlotte(row) {
  const type = String(row.CaseType || "")
  const detail = String(row.DetailedDescription || "")
  const origin = String(row.CaseOrigin || "")
  let score = priorityFromText(type, detail, origin)
  if (/housing/i.test(type)) score += 34
  if (/nuisance/i.test(type)) score += 26
  if (/zoning/i.test(type)) score += 16
  if (/vacant|board|hearing|repair|unsafe|abandon|condemn/i.test(detail)) score += 28
  if (/complaint/i.test(origin)) score += 8
  return score
}

function scoreLouisville(row) {
  const occupancy = String(row.OccupancyStatus || "")
  const status = String(row.G6A_G6_STATUS || "")
  const guideStatus = String(row.GUIDE_ITEM_STATUS || "")
  const text = String(row.GUIDE_ITEM_TEXT || "")
  const amount = Number(row.CitationAmount || 0)
  let score = priorityFromText(occupancy, status, guideStatus, text)
  if (/vacant|abandoned|condemned/i.test(occupancy)) score += 34
  if (/emergency referral|citation|hold/i.test(status)) score += 24
  if (/no compliance|in court|in hearing|referral/i.test(guideStatus)) score += 18
  if (/foundation|roof|structural|exterior surface|board|cleaning|chapter 156/i.test(text)) score += 18
  if (amount >= 500) score += 8
  return score
}

function scoreFayetteville(row) {
  const type = String(row.CASE_TYPE_DESC || "")
  const violation = String(row.VIOLATION || "")
  const origin = String(row.LIST_VALUE || "")
  let score = priorityFromText(type, violation, origin)
  if (/substandard building|substandard housing/i.test(type)) score += 42
  if (/building|lot|solid waste|zoning/i.test(type)) score += 18
  if (/boarded building|substandard|no permit|overgrown|solid waste/i.test(violation)) score += 22
  if (/officer initiated/i.test(origin)) score += 6
  return score
}

async function harvestIndianapolis() {
  const where = [
    "(CASE_STATUS IN ('Open','In Process','In Violation','Pending','Inspection','Inspection Pending','Case Initiated','Pending NOV','NOV Issued','NOV Review','Overdue','Not Secure','Legal Case Pending','Emergency Demo'))",
    "(CASE_TYPE LIKE '%Unsafe Buildings%' OR CASE_TYPE LIKE '%Building%' OR CASE_TYPE LIKE '%Repair%' OR CASE_TYPE LIKE '%Vacant Board Order%' OR CASE_TYPE LIKE '%Trash%' OR CASE_TYPE LIKE '%Illegal Dumping%' OR CASE_TYPE LIKE '%High Weeds & Grass%')",
  ].join(" AND ")
  const rows = await fetchArcgisAll(
    "https://gis.indy.gov/server/rest/services/OpenData/OpenData_NonSpatial/MapServer/1",
    where,
    { orderByFields: "OPEN_DATE DESC" }
  )
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "indianapolis",
        source: "indianapolis_code_enforcement_open",
        priority_score: scoreIndianapolis(row),
        property_address: row.STREET_ADDRESS,
        city: "Indianapolis",
        state: "IN",
        zip: String(row.ZIP || "").replace(/\.0$/, ""),
        parcel: "",
        case_id: row.CASE_NUMBER,
        case_type: row.CASE_TYPE,
        case_subtype: row.CASE_STATUS,
        case_category: "code_enforcement",
        status: row.CASE_STATUS,
        opened_date: dateFromEpoch(row.OPEN_DATE),
        last_status_date: dateFromEpoch(row.OPEN_DATE),
        source_url: row.LINK || "https://data.indy.gov/datasets/indianapolis-code-enforcement-violations-and-investigations/about",
        notes: "Indianapolis open code-enforcement case with building, unsafe, repair, trash, or vacancy signal. Use seller-options outreach only.",
      })
    )
  )
}

async function harvestCharlotte() {
  const where = "CaseStatus <> 'Closed' AND (CaseType IN ('Housing','Nuisance','Zoning'))"
  const rows = await fetchArcgisAll(
    "https://gis.charlottenc.gov/arcgis/rest/services/HNS/CodeEnforcementCasesAll/MapServer/0",
    where,
    { orderByFields: "DateCreated DESC" }
  )
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "charlotte",
        source: "charlotte_code_enforcement_open",
        priority_score: scoreCharlotte(row),
        property_address: row.FullAddress,
        city: "Charlotte",
        state: "NC",
        zip: String(row.FullAddress || "").match(/\b\d{5}\b/)?.[0] || "",
        parcel: row.ParcelId,
        case_id: row.CaseNumber,
        case_type: row.CaseType,
        case_subtype: row.CaseOrigin,
        case_category: "code_enforcement",
        status: row.CaseStatus,
        opened_date: dateFromEpoch(row.DateCreated),
        last_status_date: dateFromEpoch(row.DateClosed || row.DateCreated),
        inspection_task: row.DetailedDescription,
        source_url: "https://data.charlottenc.gov/datasets/charlotte::code-enforcement-cases-all/about",
        notes: "Charlotte open housing, nuisance, or zoning case. Use seller-options outreach only.",
      })
    )
  )
}

async function harvestLouisville() {
  const where = [
    "(OccupancyStatus IN ('Vacant Structure','Vacant Lot','Abandoned','Abandoned Structure','Abandoned Lot','Condemned'))",
    "(G6A_G6_STATUS IN ('Citation','Citation Referral','Emergency Referral','Hold') OR GUIDE_ITEM_STATUS IN ('No Compliance','Citation','Citation - Emergency Referral','Citation - Referral','In Court','In Hearing','Referral to RCS'))",
  ].join(" AND ")
  const rows = await fetchArcgisAll(
    "https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/PM_SiteVisit_Violations/FeatureServer/0",
    where,
    { orderByFields: "G6A_G6_COMPL_DD DESC" }
  )
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "louisville",
        source: "louisville_property_maintenance_violations",
        priority_score: scoreLouisville(row),
        property_address: row.FullAddress,
        city: "Louisville",
        state: "KY",
        zip: String(row.FullAddress || "").match(/\b\d{5}\b/)?.[0] || "",
        parcel: row.PARCEL_ID,
        case_id: row.B1_ALT_ID,
        case_type: row.OccupancyStatus,
        case_subtype: row.VIOLATION_CODE,
        case_category: row.G6A_G6_STATUS,
        status: row.GUIDE_ITEM_STATUS || row.G6A_G6_STATUS,
        opened_date: dateFromEpoch(row.G6A_G6_COMPL_DD),
        last_status_date: dateFromEpoch(row.G6A_G6_STATUS_DD || row.G6A_G6_COMPL_DD),
        inspection_task: row.GUIDE_ITEM_TEXT,
        source_url: "https://louisville-metro-opendata-lojic.hub.arcgis.com/datasets/LOJIC::louisville-metro-ky-property-maintenance-inspection-violations",
        notes: "Louisville vacant or abandoned property-maintenance violation with citation or non-compliance signal. Use seller-options outreach only.",
      })
    )
  )
}

async function harvestFayetteville() {
  const where = "STATUS = 'OPEN' AND (CASE_TYPE_DESC IN ('Code Enforcement - Substandard Building','Code Enforcement - Substandard Housing','Code Enforcement - Lot','Code Enforcement - Solid Waste','Code Enforcement - Building','Code Enforcement - Zoning'))"
  const rows = await fetchArcgisAll(
    "https://gismaps.ci.fayetteville.nc.us/opendata/rest/services/DevelopmentServices/SPA_Dashboard_Code_Enforcement/MapServer/0",
    where,
    { orderByFields: "DATE_INITIATED DESC" }
  )
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "fayetteville",
        source: "fayetteville_code_enforcement_open",
        priority_score: scoreFayetteville(row),
        property_address: row.LOCATION,
        city: "Fayetteville",
        state: "NC",
        zip: String(row.LOCATION || "").match(/\b\d{5}\b/)?.[0] || "",
        parcel: "",
        case_id: row.CASE_NUMBER,
        case_type: row.CASE_TYPE_DESC,
        case_subtype: row.VIOLATION,
        case_category: "code_enforcement",
        status: row.STATUS,
        opened_date: dateFromEpoch(row.DATE_INITIATED),
        last_status_date: dateFromEpoch(row.DATE_INITIATED),
        inspection_task: row.LIST_VALUE,
        source_url: "https://data.fayettevillenc.gov/datasets/code-enforcement-data/about",
        notes: "Fayetteville open substandard, lot, building, solid-waste, or zoning case. Use seller-options outreach only.",
      })
    )
  )
}

async function harvestPhiladelphia() {
  const rows = await fetchCartoAll("https://phl.carto.com/api/v2/sql", "li_violations", "casestatus <> 'CLOSED'")
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "philadelphia",
        source: "philadelphia_li_open_violations",
        priority_score: priorityFromText(row.violationdescription, row.prioritydesc, row.casestatus, row.casegroup),
        property_address: row.address,
        city: "Philadelphia",
        state: "PA",
        zip: row.zip,
        parcel: row.opa_account_num || row.addresskey,
        case_id: row.casenumber,
        case_type: row.aptype,
        case_subtype: row.violationtype,
        case_category: row.prioritydesc || row.casegroup,
        status: row.casestatus,
        opened_date: dateOnly(row.caseaddeddate),
        last_status_date: dateOnly(row.mostrecentinsp || row.violationdate),
        inspection_task: row.violationdescription,
        source_url: "https://phl.carto.com/api/v2/sql",
        notes: `Philadelphia open L&I violation. Owner in city source: ${row.ownername || row.organization || "unknown"}. Build DealMachine list, export contacts, then use several-options outreach.`,
      })
    )
  )
}

async function harvestPittsburgh() {
  const rows = await fetchCkanDatastoreAll("70c06278-92c5-4040-ab28-17671866f81c")
  return dedupeRows(
    rows
      .filter((row) => !/closed|resolved/i.test(String(row.status || row.investigation_outcome || "")))
      .map((row) => {
        const [address] = String(row.address || "").split(",")
        return sourceRow({
          market: "pittsburgh",
          source: "pittsburgh_pli_active_violations",
          priority_score: priorityFromText(row.case_file_type, row.investigation_outcome, row.investigation_findings, row.violation_description),
          property_address: address,
          city: "Pittsburgh",
          state: "PA",
          zip: String(row.address || "").match(/\b\d{5}\b/)?.[0] || "",
          parcel: row.parcel_id,
          case_id: row.casefile_number,
          case_type: row.case_file_type,
          case_subtype: row.violation_code_section_title || row.violation_description,
          case_category: row.investigation_outcome,
          status: row.status,
          opened_date: dateOnly(row.investigation_date),
          last_status_date: dateOnly(row.investigation_date),
          inspection_task: row.investigation_findings || row.violation_spec_instructions,
          source_url: "https://data.wprdc.org/dataset/pittsburgh-pli-violations-report",
          notes: "Pittsburgh active PLI/DOMI/ES violation. Build DealMachine list, export contacts, then use several-options outreach.",
        })
      })
  )
}

async function harvestKansasCity() {
  const rows = await fetchSocrataAll("https://data.kcmo.org/resource/7at3-sxhp.json", { status: "OPEN" })
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "kansas-city",
        source: "kansas_city_open_property_cases",
        priority_score: priorityFromText(row.request_type, row.type, row.detail, row.status, row.exceeded_est_timeframe === "Y" ? "exceeded" : ""),
        property_address: row.street_address,
        city: "Kansas City",
        state: "MO",
        zip: row.zip_code,
        parcel: row.parcel_id_no,
        case_id: row.case_id,
        case_type: row.type,
        case_subtype: row.detail,
        case_category: row.request_type || row.category,
        status: row.status,
        opened_date: dateOnly(row.creation_date),
        last_status_date: dateOnly(row.creation_date),
        inspection_task: row.work_group,
        source_url: row.case_url?.url || "https://data.kcmo.org/resource/7at3-sxhp",
        notes: "Kansas City open property/building case. Build DealMachine list, export contacts, then use several-options outreach.",
      })
    )
  )
}

async function harvestNewOrleans() {
  const rows = await fetchSocrataAll("https://data.nola.gov/resource/3ehi-je3s.json", { $order: "violationdate DESC" })
  return dedupeRows(
    rows.map((row) =>
      sourceRow({
        market: "new-orleans",
        source: "new_orleans_code_violations",
        priority_score: priorityFromText(row.violation, row.description, row.codesection),
        property_address: row.location,
        city: "New Orleans",
        state: "LA",
        zip: "",
        parcel: "",
        case_id: row.caseno || row.caseid,
        case_type: row.codesection,
        case_subtype: row.violation,
        case_category: "code_violation",
        status: "violation",
        opened_date: dateOnly(row.violationdate),
        last_status_date: dateOnly(row.violationdate),
        inspection_task: row.description,
        source_url: "https://data.nola.gov/resource/3ehi-je3s",
        notes: "New Orleans code violation. Build DealMachine list, export contacts, then use several-options outreach.",
      })
    )
  )
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

async function harvestColumbus() {
  const buildingLayer = "https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/24"
  const codeLayer = "https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/23"
  const [unsafeResidential, openResidentialCode] = await Promise.all([
    fetchArcgisAll(buildingLayer, "B1_APPL_STATUS <> 'Closed' AND LAND_USE='Residential'"),
    fetchArcgisAll(codeLayer, "B1_APPL_STATUS <> 'Closed'"),
  ])
  return dedupeRows(
    [...unsafeResidential, ...openResidentialCode].map((row) =>
      sourceRow({
        market: "columbus",
        source: "columbus_building_code_open",
        priority_score: scoreColumbus(row),
        property_address: row.SITE_ADDRESS,
        city: "Columbus",
        state: "OH",
        zip: row.B1_SITUS_ZIP,
        parcel: row.B1_PARCEL_NBR,
        case_id: row.B1_ALT_ID,
        case_type: row.B1_PER_TYPE,
        case_subtype: row.B1_PER_SUB_TYPE,
        case_category: row.B1_PER_CATEGORY,
        status: row.B1_APPL_STATUS,
        land_use: row.LAND_USE,
        opened_date: dateFromEpoch(row.B1_FILE_DD),
        order_issued_date: dateFromEpoch(row.ORDER_ISSUED_DATE),
        last_status_date: dateFromEpoch(row.LAST_STATUS_DT || row.INSP_LAST_DATE),
        inspection_task: row.INSPECTION_TASK || row.INSP_LAST_RESULT,
        city_attorney_flag: row.CITY_ATTORNEY_FLAG,
        source_url: row.ACA_URL,
        notes: "Columbus open building/code case. Not in the default fresh-city run.",
      })
    )
  )
}

function writeCsv(file, rows) {
  const cols = [
    "market",
    "lane",
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
    "rejection_reason",
  ]
  fs.writeFileSync(file, [cols.join(","), ...rows.map((row) => cols.map((col) => esc(row[col])).join(","))].join("\n"))
}

function splitReady(rows) {
  const ready = []
  const rejected = []
  for (const row of rows) {
    const rejection = addressQualityIssue(row.property_address)
    if (rejection) rejected.push({ ...row, rejection_reason: rejection })
    else ready.push(row)
  }
  return { ready, rejected }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const summary = []
  const combinedReady = []

  for (const market of selectedMarkets()) {
    const adapter = ADAPTERS[market]
    if (!adapter) throw new Error(`No source adapter for market: ${market}`)
    const rows = await adapter()
    const { ready, rejected } = splitReady(rows)
    const seed = ready.slice(0, SEED_LIMIT)
    const marketSlug = slugMarket(seed[0] || ready[0] || rows[0] || { city: market, state: "" })
    const allPath = path.join(OUT_DIR, `major-market-source-${marketSlug}-${stamp}.csv`)
    const seedPath = path.join(OUT_DIR, `major-market-dealmachine-seed-${marketSlug}-${stamp}.csv`)
    const rejectedPath = path.join(OUT_DIR, `major-market-dealmachine-rejected-${marketSlug}-${stamp}.csv`)
    writeCsv(allPath, rows)
    writeCsv(seedPath, seed)
    writeCsv(rejectedPath, rejected)
    combinedReady.push(...seed)
    summary.push({
      market,
      sourceRows: rows.length,
      dealmachineReady: ready.length,
      rejectedAddresses: rejected.length,
      seedRows: seed.length,
      allPath,
      seedPath,
      rejectedPath,
    })
  }

  const combinedPath = path.join(OUT_DIR, `major-market-fresh-city-source-distress-contact-needed-${stamp}.csv`)
  writeCsv(combinedPath, combinedReady.sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0)))

  const summaryPath = path.join(OUT_DIR, `major-market-source-harvest-summary-${stamp}.json`)
  fs.writeFileSync(summaryPath, JSON.stringify({ createdAt: new Date().toISOString(), markets: summary, combinedPath }, null, 2))

  console.log("=== Fresh-city source harvest ===")
  console.log(`Markets:             ${selectedMarkets().join(", ")}`)
  console.log(`Combined seed rows:  ${combinedReady.length}`)
  console.log(`Combined queue:      ${combinedPath}`)
  console.log(`Summary:             ${summaryPath}`)
  for (const row of summary) {
    console.log(`${row.market}: source=${row.sourceRows} ready=${row.dealmachineReady} rejected=${row.rejectedAddresses} seed=${row.seedRows}`)
    console.log(`  seed: ${row.seedPath}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
