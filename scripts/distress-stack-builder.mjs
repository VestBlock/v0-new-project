/**
 * VestBlock — Distress Stack Builder (tax-delinquent × code-violation)
 *
 * Wholesaling lead engine. Pulls OPEN code-violation properties from a market's
 * public open-data API, overlays a county tax-delinquent file, and outputs a
 * lead list WITH ADDRESSES for later enrichment. Processes a couple of areas
 * per run and advances a queue so coverage expands daily.
 *
 * SAFETY / SOURCING: read-only public-records data only. No PII beyond public
 * record. No scraping of protected sites.
 *
 * Markets are config-driven (see MARKETS). The Cincinnati market is wired to:
 *   - Code violations: City of Cincinnati Code Enforcement (Socrata, daily refresh)
 *   - Tax delinquent:  Hamilton County Auditor unpaid.xlsx (parcel-keyed)
 *
 * NOTE on matching (honest): Cincinnati's delinquent file is keyed by PARCEL with
 * only the OWNER MAILING address (no property/situs address). We therefore flag a
 * code-violation property as a "both-signal" lead when its property address matches
 * a delinquent owner-mailing address (a likely owner-occupied, tax-delinquent, cited
 * property — a strong lead). Markets that publish address-bearing delinquency get an
 * exact property-address intersection instead. Full delinquent parcel set is exported
 * alongside for a precise parcel join once a parcel↔address crosswalk is supplied.
 *
 * USAGE:
 *   node scripts/distress-stack-builder.mjs                  # process next areas for default market
 *   node scripts/distress-stack-builder.mjs --market=cincinnati --areas=2
 *   node scripts/distress-stack-builder.mjs --market=cincinnati --area="EAST PRICE HILL"
 */

import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"

const args = process.argv.slice(2)
const getArg = (n) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : null }
const MARKET = (getArg("market") || "cincinnati").toLowerCase()
const AREAS_PER_RUN = getArg("areas") ? parseInt(getArg("areas"), 10) : 2
const FORCE_AREA = getArg("area")

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const STATE_DIR = path.join(process.cwd(), "data", "distress-sources")
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"

/* ─── Market registry ──────────────────────────────────────────────────── */
const MARKETS = {
  cincinnati: {
    label: "Cincinnati, OH (Hamilton County)",
    areaField: "neighborhood",
    // Socrata SoQL: open code-enforcement cases for one neighborhood
    violationsUrl: (area) =>
      `https://data.cincinnati-oh.gov/resource/cncm-znd6.json?$where=status_class='OPEN' AND upper(neighborhood)='${area.toUpperCase().replace(/'/g, "''")}'&$limit=5000&$select=number_key,full_address,neighborhood,comp_type_desc,entered_date,data_status_display`,
    addressField: "full_address",
    typeField: "comp_type_desc",
    dateField: "entered_date",
    // Tax-delinquent parcels WITH situs address, straight from CAGIS parcel attributes.
    // DELQ_TAXES>0 = currently tax-delinquent; address = ADDRNO + ADDRST + ADDRSF.
    delinquentCagis: {
      base: "https://cagisonline.hamilton-co.org/arcgis/rest/services/HCE/Cadastral/MapServer/2/query",
      where: "DELQ_TAXES>0",
      outFields: "ADDRNO,ADDRST,ADDRSF,DELQ_TAXES,DLNQDT,FORECL_FLAG,OWNNM1,AUDPCLID",
      pageSize: 1000, // CAGIS maxRecordCount
      cache: path.join(STATE_DIR, "hamilton-delinquent.json"),
      cacheMaxAgeHrs: 168, // refresh weekly
    },
  },

  milwaukee: {
    type: "vacant-delinquent-ckan",
    label: "Milwaukee, WI",
    cityName: "Milwaukee",
    ckanBase: "https://data.milwaukee.gov/api/3/action/datastore_search",
    // tax-delinquent real estate accounts (has Property Address + Tax Key # + amount)
    delinquent: {
      resourceId: "8f1367e1-6f8f-44cc-8ed6-2eecd8267ec7",
      taxkeyField: "Tax Key #",
      addrField: "Property Address",
      amountField: "Total Tax Principal",
      ownerField: "Owner's Name",
    },
    // vacant building registrations (has ADDRFULLLINE + PARCELNBR + DATEOPENED)
    vacant: {
      resourceId: "46dca88b-fec0-48f1-bda6-7296249ea61f",
      taxkeyField: "PARCELNBR",
      addrField: "ADDRFULLLINE",
      dateField: "DATEOPENED",
      areaField: "Neighborhood",
    },
  },

  toledo: {
    type: "arcgis-intersect",
    label: "Toledo, OH (Lucas County)",
    cityName: "Toledo",
    // delinquency overlay: Lucas County AREIS parcels with taxes due + property address
    delinq: {
      url: "https://services3.arcgis.com/T8dczfwPixv79EgZ/arcgis/rest/services/OSE_ParcelsAddresses_AREIS/FeatureServer/0",
      where: "taxdue>0",
      addrField: "property_address",
      amountField: "taxdue",
      label: "AREIS tax-due",
    },
    // distress event: city grass-mowing program = neglected/nuisance lots
    event: {
      url: "https://gis.toledo.oh.gov/arcgis/rest/services/Grass_Mowing_Program/MapServer/0",
      where: "1=1",
      addrField: "Address",
      dateField: "LastMowDate",
      label: "City grass-mowing (nuisance)",
    },
  },

  detroit: {
    type: "detroit-blight-absentee",
    label: "Detroit, MI (Wayne County)",
    cityName: "Detroit",
    districts: ["1", "2", "3", "4", "5", "6", "7"],
    // second signal: absentee-owned parcels (owner mails outside Detroit), cached
    parcels: {
      url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/parcel_file_current/FeatureServer/0",
      where: "taxpayer_city NOT LIKE '%DETROIT%' AND tax_status='TAXABLE'",
      addrField: "address",
      ownerField: "taxpayer_1",
      cityField: "taxpayer_city",
      cache: path.join(STATE_DIR, "detroit-absentee.json"),
      cacheMaxAgeHrs: 168,
    },
    // distress event: recent UNPAID blight tickets, scoped by council district
    blight: {
      url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0",
      addrField: "address",
      dateField: "ticket_issued_date",
      districtField: "council_district",
      where: (district) =>
        `payment_status='NO PAYMENT APPLIED' AND council_district='${district}' AND ticket_issued_date>=DATE '2023-01-01'`,
    },
  },
}

/* Detroit: recent unpaid blight × absentee-owner parcels, district queue. */
async function runDetroit(cfg) {
  // absentee parcels (cached)
  const pc = cfg.parcels
  let absByAddr
  if (fs.existsSync(pc.cache) && (Date.now() - fs.statSync(pc.cache).mtimeMs) / 3.6e6 < pc.cacheMaxAgeHrs) {
    absByAddr = new Map(Object.entries(JSON.parse(fs.readFileSync(pc.cache, "utf8"))))
  } else {
    process.stdout.write("Loading absentee-owned parcels... ")
    const recs = await fetchArcgisAll(pc.url, pc.where, 2000)
    const map = {}
    for (const r of recs) {
      const a = (r[pc.addrField] || "").toString().trim()
      if (!a) continue
      map[normAddr(a)] = { owner: r[pc.ownerField] || "", city: r[pc.cityField] || "" }
    }
    fs.writeFileSync(pc.cache, JSON.stringify(map))
    absByAddr = new Map(Object.entries(map))
    console.log(`${absByAddr.size}.`)
  }

  // district queue
  let queue = loadQueue(MARKET)
  if (!queue) { queue = { market: MARKET, all: cfg.districts, doneIndex: 0, createdAt: new Date().toISOString() }; saveQueue(MARKET, queue) }
  let districtsToRun
  if (FORCE_AREA) districtsToRun = [FORCE_AREA]
  else {
    districtsToRun = queue.all.slice(queue.doneIndex, queue.doneIndex + AREAS_PER_RUN)
    if (districtsToRun.length === 0) { queue.doneIndex = 0; districtsToRun = queue.all.slice(0, AREAS_PER_RUN) }
  }
  console.log(`Absentee parcels: ${absByAddr.size} | districts this run: ${districtsToRun.join(", ")}`)

  const seen = new Set()
  const leads = []
  for (const d of districtsToRun) {
    const recs = await fetchArcgisAll(cfg.blight.url, cfg.blight.where(d), 2000)
    let both = 0
    for (const v of recs) {
      const addr = (v[cfg.blight.addrField] || "").toString().trim()
      if (!addr) continue
      const key = normAddr(addr)
      if (seen.has(key)) continue
      seen.add(key)
      const abs = absByAddr.get(key)
      if (!abs) continue // Detroit stack = ONLY blight × absentee (both signals required)
      both++
      leads.push({
        address: addr, city: cfg.cityName, area: `District ${d}`,
        violation: "Unpaid blight ticket (absentee owner)",
        violation_date: String(v[cfg.blight.dateField] || "").slice(0, 10),
        tax_delinquent_hit: "YES",
        delinquent_amount: "",
        delinquent_parcel: "",
        foreclosure_flag: "",
        delinquent_owner: `${abs.owner}${abs.city ? ` (mails from ${abs.city})` : ""}`,
      })
    }
    console.log(`  District ${d}: ${recs.length} unpaid blight -> ${both} on absentee-owned property (★ both signals)`)
  }
  if (!FORCE_AREA) { queue.doneIndex += districtsToRun.length; queue.lastRun = new Date().toISOString(); saveQueue(MARKET, queue) }
  return { leads, queueLine: `${queue.doneIndex}/${queue.all.length} districts covered` }
}

const normKey = (s) => String(s || "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase()

/* Generic ArcGIS feature-layer pager (returns all attributes). */
async function fetchArcgisAll(base, where, pageSize = 1000) {
  const out = []
  let offset = 0
  for (let page = 0; page < 120; page++) {
    const url = `${base}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=${pageSize}&resultOffset=${offset}&returnGeometry=false&f=json`
    const data = await curlJson(url, true)
    const feats = data?.features || []
    if (feats.length === 0) break
    out.push(...feats.map((f) => f.attributes))
    offset += feats.length
    if (!data.exceededTransferLimit && feats.length < pageSize) break
  }
  return out
}

/* Generic two-layer ArcGIS distress stack: event-layer × delinquency-layer, joined on address. */
async function runArcgisIntersect(cfg) {
  const d = cfg.delinq
  process.stdout.write(`Loading ${d.label || "delinquency"} layer... `)
  const delRecs = await fetchArcgisAll(d.url, d.where, d.pageSize || 1000)
  const delByAddr = new Map()
  for (const r of delRecs) {
    const addr = (r[d.addrField] || "").toString().trim()
    if (!addr) continue
    delByAddr.set(normAddr(addr), {
      amount: d.amountField ? r[d.amountField] : "",
      owner: d.ownerField ? r[d.ownerField] || "" : "",
      parcel: d.parcelField ? r[d.parcelField] || "" : "",
    })
  }
  console.log(`${delByAddr.size} delinquent properties.`)

  const e = cfg.event
  process.stdout.write(`Loading ${e.label || "distress"} layer... `)
  const evRecs = await fetchArcgisAll(e.url, e.where || "1=1", e.pageSize || 1000)
  console.log(`${evRecs.length} records.`)

  const seen = new Set()
  const leads = []
  let both = 0
  for (const v of evRecs) {
    const addr = (v[e.addrField] || "").toString().trim()
    if (!addr) continue
    const key = normAddr(addr)
    if (seen.has(key)) continue
    seen.add(key)
    const del = delByAddr.get(key)
    if (del) both++
    leads.push({
      address: addr,
      city: cfg.cityName,
      area: e.areaField ? v[e.areaField] || "" : "",
      violation: e.label,
      violation_date: e.dateField ? String(v[e.dateField] || "").slice(0, 10) : "",
      tax_delinquent_hit: del ? "YES" : "",
      delinquent_amount: del && del.amount ? `$${Number(String(del.amount).replace(/[^0-9.]/g, "")).toLocaleString()}` : "",
      delinquent_parcel: del?.parcel || "",
      foreclosure_flag: "",
      delinquent_owner: del?.owner || "",
    })
  }
  console.log(`  ${evRecs.length} ${e.label} -> ${both} also tax-delinquent (★ both signals)`)
  return leads
}

async function ckanAll(base, resourceId, fields) {
  const out = []
  let offset = 0
  const pageSize = 5000
  for (let page = 0; page < 50; page++) {
    const fsel = fields ? `&fields=${encodeURIComponent(fields.join(","))}` : ""
    const url = `${base}?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}${fsel}`
    const data = await curlJson(url)
    const recs = data?.result?.records || []
    if (recs.length === 0) break
    out.push(...recs)
    offset += recs.length
    if (recs.length < pageSize) break
  }
  return out
}

/* Vacant × delinquent stack for CKAN markets (Milwaukee-style). */
async function runVacantDelinquentCkan(cfg) {
  process.stdout.write("Loading tax-delinquent accounts... ")
  const delRecs = await ckanAll(cfg.ckanBase, cfg.delinquent.resourceId)
  // aggregate delinquent by taxkey (sum principal across levy years)
  const delByKey = new Map()
  for (const r of delRecs) {
    const k = normKey(r[cfg.delinquent.taxkeyField])
    if (!k) continue
    const amt = Number(String(r[cfg.delinquent.amountField] || "0").replace(/[^0-9.]/g, "")) || 0
    const ex = delByKey.get(k)
    if (ex) ex.amount += amt
    else delByKey.set(k, { amount: amt, address: r[cfg.delinquent.addrField] || "", owner: r[cfg.delinquent.ownerField] || "", parcel: r[cfg.delinquent.taxkeyField] || "" })
  }
  console.log(`${delByKey.size} delinquent parcels.`)

  process.stdout.write("Loading vacant buildings... ")
  const vac = await ckanAll(cfg.ckanBase, cfg.vacant.resourceId)
  console.log(`${vac.length} vacant buildings.`)

  const seen = new Set()
  const leads = []
  let both = 0
  for (const v of vac) {
    const addr = (v[cfg.vacant.addrField] || "").trim()
    if (!addr) continue
    const akey = normAddr(addr)
    if (seen.has(akey)) continue
    seen.add(akey)
    const del = delByKey.get(normKey(v[cfg.vacant.taxkeyField]))
    if (del) both++
    leads.push({
      address: addr,
      city: cfg.cityName,
      area: v[cfg.vacant.areaField] || "",
      violation: "Vacant building (registered)",
      violation_date: String(v[cfg.vacant.dateField] || "").slice(0, 10),
      tax_delinquent_hit: del ? "YES" : "",
      delinquent_amount: del ? `$${Number(del.amount).toLocaleString()}` : "",
      delinquent_parcel: del?.parcel || "",
      foreclosure_flag: "",
      delinquent_owner: del?.owner || "",
    })
  }
  console.log(`  ${vac.length} vacant -> ${both} also tax-delinquent (★ both signals)`)
  return leads
}

async function fetchCagisDelinquent(cfg) {
  const dc = cfg.delinquentCagis
  // serve from cache if fresh
  if (fs.existsSync(dc.cache)) {
    const ageHrs = (Date.now() - fs.statSync(dc.cache).mtimeMs) / 3.6e6
    if (ageHrs < dc.cacheMaxAgeHrs) {
      try { return JSON.parse(fs.readFileSync(dc.cache, "utf8")) } catch {}
    }
  }
  const map = {}
  let offset = 0
  for (let page = 0; page < 80; page++) {
    const url = `${dc.base}?where=${dc.where}&outFields=${dc.outFields}&orderByFields=OBJECTID&resultRecordCount=${dc.pageSize}&resultOffset=${offset}&returnGeometry=false&f=json`
    const data = await curlJson(url)
    const feats = data?.features || []
    if (feats.length === 0) break
    for (const f of feats) {
      const a = f.attributes
      const addr = `${a.ADDRNO || ""} ${a.ADDRST || ""} ${a.ADDRSF || ""}`.replace(/\s+/g, " ").trim()
      if (!a.ADDRNO || !a.ADDRST) continue
      map[normAddr(addr)] = {
        amount: a.DELQ_TAXES, owner: a.OWNNM1 || "", parcel: a.AUDPCLID || "",
        forecl: a.FORECL_FLAG || "", delinquentSince: a.DLNQDT || "",
      }
    }
    offset += feats.length
    // keep paging while the server signals more records (or a full page came back)
    if (!data.exceededTransferLimit && feats.length < dc.pageSize) break
  }
  fs.writeFileSync(dc.cache, JSON.stringify(map))
  return map
}

/* ─── helpers ──────────────────────────────────────────────────────────── */
function curlJson(url, preEncoded = false) {
  return new Promise((res) => execFile("curl", ["-s", "--max-time", "40", "-A", UA, preEncoded ? url : encodeURI(url)], { maxBuffer: 60 * 1024 * 1024 }, (e, out) => {
    if (e) return res(null)
    try { res(JSON.parse(out)) } catch { res(null) }
  }))
}
const STREET_ABBR = { avenue: "av", ave: "av", street: "st", road: "rd", drive: "dr", lane: "ln", court: "ct", place: "pl", boulevard: "blvd", terrace: "ter", circle: "cir", parkway: "pkwy", highway: "hwy" }
function normAddr(a) {
  // street-only: drop ", CITY ST ZIP" tail so cross-source addresses align
  let s = String(a || "").split(",")[0].toLowerCase().replace(/[.#]/g, " ").replace(/\s+/g, " ").trim()
  s = s.replace(/\b(north|south|east|west)\b/g, (m) => m[0])
  s = s.split(" ").map((w) => STREET_ABBR[w] || w).join(" ")
  s = s.replace(/\b(apt|unit|ste|suite|fl|floor|rm)\b.*$/, "").trim()
  return s
}

/* Minimal xlsx reader: sharedStrings + sheet1, returns array of row-arrays. */
function readXlsx(file) {
  const tmp = fs.mkdtempSync(path.join(process.cwd(), "tmp-xlsx-"))
  try {
    execFileSync("unzip", ["-o", "-q", file, "xl/sharedStrings.xml", "xl/worksheets/sheet1.xml", "-d", tmp])
    const ssXml = fs.readFileSync(path.join(tmp, "xl/sharedStrings.xml"), "utf8")
    const shared = []
    const siRe = /<si>([\s\S]*?)<\/si>/g
    let m
    while ((m = siRe.exec(ssXml))) {
      const ts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1])
      shared.push(decodeXml(ts.join("")))
    }
    const sheetXml = fs.readFileSync(path.join(tmp, "xl/worksheets/sheet1.xml"), "utf8")
    const rows = []
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
    let r
    while ((r = rowRe.exec(sheetXml))) {
      const cells = []
      const cRe = /<c[^>]*?r="([A-Z]+)\d+"[^>]*?(t="[^"]*")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>|<c[^>]*?r="([A-Z]+)\d+"[^>]*?(t="[^"]*")?[^>]*\/>/g
      let c
      while ((c = cRe.exec(r[1]))) {
        const col = colToIdx(c[1] || c[4])
        const t = c[2] || c[5] || ""
        const v = c[3]
        let val = ""
        if (v !== undefined) val = t.includes('"s"') ? (shared[parseInt(v, 10)] ?? "") : v
        cells[col] = val
      }
      rows.push(cells)
    }
    return rows
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
function colToIdx(col) { let n = 0; for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1 }
function decodeXml(s) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'") }

import { execFileSync } from "node:child_process"

/* ─── queue (daily expansion) ──────────────────────────────────────────── */
function queuePath(market) { return path.join(STATE_DIR, `${market}-area-queue.json`) }
function loadQueue(market) { try { return JSON.parse(fs.readFileSync(queuePath(market), "utf8")) } catch { return null } }
function saveQueue(market, q) { fs.writeFileSync(queuePath(market), JSON.stringify(q, null, 2)) }

async function discoverAreas(market) {
  // pull distinct neighborhoods with open cases, ordered by volume
  const url = `https://data.cincinnati-oh.gov/resource/cncm-znd6.json?$where=status_class='OPEN'&$select=neighborhood,count(*) as n&$group=neighborhood&$order=n DESC&$limit=200`
  const data = await curlJson(url)
  if (!data) return []
  return data.map((d) => d.neighborhood).filter((x) => x && x !== "N/A" && x.toUpperCase() !== "NULL")
}

/* ─── main ─────────────────────────────────────────────────────────────── */
async function main() {
  const cfg = MARKETS[MARKET]
  if (!cfg) { console.error(`Unknown market: ${MARKET}. Known: ${Object.keys(MARKETS).join(", ")}`); process.exit(1) }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(STATE_DIR, { recursive: true })

  // dispatch by market type (vacant × delinquent markets are whole-city, no area queue)
  if (cfg.type === "vacant-delinquent-ckan") {
    console.log(`Market: ${cfg.label}`)
    const leads = await runVacantDelinquentCkan(cfg)
    await writeOutputs(leads, "whole-city (vacant × delinquent)")
    return
  }
  if (cfg.type === "arcgis-intersect") {
    console.log(`Market: ${cfg.label}`)
    const leads = await runArcgisIntersect(cfg)
    await writeOutputs(leads, "whole-city (nuisance × delinquent)")
    return
  }
  if (cfg.type === "detroit-blight-absentee") {
    console.log(`Market: ${cfg.label}`)
    const { leads, queueLine } = await runDetroit(cfg)
    await writeOutputs(leads, queueLine)
    return
  }

  // 1) build/advance the area queue
  let queue = loadQueue(MARKET)
  if (!queue) {
    const areas = await discoverAreas(MARKET)
    queue = { market: MARKET, all: areas, doneIndex: 0, createdAt: new Date().toISOString() }
    saveQueue(MARKET, queue)
    console.log(`Initialized ${MARKET} area queue with ${areas.length} areas (by open-violation volume).`)
  }

  // 2) pick areas to process this run
  let areasToRun
  if (FORCE_AREA) areasToRun = [FORCE_AREA]
  else {
    areasToRun = queue.all.slice(queue.doneIndex, queue.doneIndex + AREAS_PER_RUN)
    if (areasToRun.length === 0) { queue.doneIndex = 0; areasToRun = queue.all.slice(0, AREAS_PER_RUN) } // wrap around for refresh
  }
  console.log(`Market: ${cfg.label}`)
  console.log(`Processing areas: ${areasToRun.join(" | ")}\n`)

  // 3) load tax-delinquent parcels WITH situs address (from CAGIS, cached)
  process.stdout.write("Loading tax-delinquent parcels (CAGIS, situs-addressed)... ")
  const delinquentByAddr = new Map(Object.entries(await fetchCagisDelinquent(cfg)))
  console.log(`${delinquentByAddr.size} delinquent properties.`)

  // 4) pull violations per area, dedupe, overlay delinquency
  const seen = new Set()
  const leads = []
  for (const area of areasToRun) {
    const data = await curlJson(cfg.violationsUrl(area))
    if (!data) { console.log(`  ${area}: fetch failed`); continue }
    let both = 0
    for (const v of data) {
      const addr = (v[cfg.addressField] || "").trim()
      if (!addr) continue
      const key = normAddr(addr)
      if (seen.has(key)) continue
      seen.add(key)
      const del = delinquentByAddr.get(key)
      if (del) both++
      leads.push({
        address: addr,
        city: "Cincinnati",
        area: v[cfg.areaField] || area,
        violation: v[cfg.typeField] || "",
        violation_date: (v[cfg.dateField] || "").slice(0, 10),
        tax_delinquent_hit: del ? "YES" : "",
        delinquent_amount: del ? `$${Number(del.amount).toLocaleString()}` : "",
        delinquent_parcel: del?.parcel || "",
        foreclosure_flag: del?.forecl || "",
        delinquent_owner: del?.owner || "",
      })
    }
    console.log(`  ${area}: ${data.length} open violations, ${both} also tax-delinquent (★ both signals)`)
  }

  // 5) advance queue
  if (!FORCE_AREA) { queue.doneIndex += areasToRun.length; queue.lastRun = new Date().toISOString(); saveQueue(MARKET, queue) }

  await writeOutputs(leads, `${queue.doneIndex}/${queue.all.length} areas covered`)
}

async function writeOutputs(leads, queueLine) {
  // 6) write outputs — full list + the "both signal" hit list
  const stamp = new Date().toISOString().slice(0, 10)
  const cols = ["address", "city", "area", "violation", "violation_date", "tax_delinquent_hit", "delinquent_amount", "delinquent_parcel", "foreclosure_flag", "delinquent_owner"]
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const toCsv = (rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n")
  const allPath = path.join(OUT_DIR, `${MARKET}-${stamp}.csv`)
  fs.writeFileSync(allPath, toCsv(leads))
  const hits = leads.filter((l) => l.tax_delinquent_hit === "YES")
  const hitsPath = path.join(OUT_DIR, `${MARKET}-${stamp}-BOTH-SIGNALS.csv`)
  fs.writeFileSync(hitsPath, toCsv(hits))

  // 7) append the stacked hits to the cumulative MASTER list (deduped, first/last seen)
  const masterPath = path.join(OUT_DIR, "MASTER-distress-stack.csv")
  const masterCols = ["market", "address", "city", "area", "violation", "violation_date", "delinquent_amount", "foreclosure_flag", "delinquent_owner", "delinquent_parcel", "first_seen", "last_seen"]
  const master = new Map()
  if (fs.existsSync(masterPath)) {
    const rows = parseCsvFile(masterPath)
    const h = rows[0]
    for (const r of rows.slice(1)) {
      if (!r.length) continue
      const obj = Object.fromEntries(h.map((c, i) => [c, r[i] ?? ""]))
      master.set(`${obj.market}|${normAddr(obj.address)}`, obj)
    }
  }
  let added = 0
  for (const hh of hits) {
    const key = `${MARKET}|${normAddr(hh.address)}`
    const existing = master.get(key)
    if (existing) {
      existing.last_seen = stamp
    } else {
      master.set(key, { market: MARKET, address: hh.address, city: hh.city, area: hh.area, violation: hh.violation, violation_date: hh.violation_date, delinquent_amount: hh.delinquent_amount, foreclosure_flag: hh.foreclosure_flag, delinquent_owner: hh.delinquent_owner, delinquent_parcel: hh.delinquent_parcel, first_seen: stamp, last_seen: stamp })
      added++
    }
  }
  const masterRows = [...master.values()]
  fs.writeFileSync(masterPath, [masterCols.join(","), ...masterRows.map((r) => masterCols.map((c) => esc(r[c])).join(","))].join("\n"))

  console.log(`\n=== SUMMARY (${MARKET} · ${stamp}) ===`)
  console.log(`Code-violation distress leads (addresses): ${leads.length}`)
  console.log(`★ Tax-delinquent + second signal (both signals): ${hits.length}`)
  console.log(`Master list: +${added} new -> ${masterRows.length} total stacked leads`)
  console.log(`Queue: ${queueLine}`)
  console.log(`Files:`)
  console.log(`  ${hitsPath}  <- today's stacked list`)
  console.log(`  ${masterPath}  <- MASTER cumulative list (add-to-daily)`)
}

// tiny CSV file reader (handles quoted fields) for the master merge
function parseCsvFile(file) {
  const text = fs.readFileSync(file, "utf8")
  const rows = []; let row = [], f = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1]
    if (q) { if (c === '"' && n === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(f); f = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && n === "\n") i++; if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = "" } }
    else f += c
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row) }
  return rows
}

main().catch((e) => { console.error(e); process.exit(1) })
