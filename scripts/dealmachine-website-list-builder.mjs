/**
 * Build fresh DealMachine lead lists through the logged-in website session.
 *
 * This uses the same List Builder endpoint the DealMachine web app uses, but
 * runs inside the already-authenticated Chrome tab so we do not need to expose
 * browser tokens or manually click through every market/strategy combination.
 *
 * Usage:
 *   node scripts/dealmachine-website-list-builder.mjs
 *   node scripts/dealmachine-website-list-builder.mjs --build
 *   node scripts/dealmachine-website-list-builder.mjs --build --max-builds=35 --max-count=350
 *   node scripts/dealmachine-website-list-builder.mjs --markets="Milwaukee,WI|Toledo,OH|Dayton,OH"
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const BUILD = args.includes("--build") || args.includes("--send")
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = [
  "Milwaukee,WI",
  "Toledo,OH",
  "Cleveland,OH",
  "Akron,OH",
  "Dayton,OH",
  "Detroit,MI",
  "Flint,MI",
  "Grand Rapids,MI",
  "Lansing,MI",
  "Fort Wayne,IN",
  "Indianapolis,IN",
  "South Bend,IN",
  "Gary,IN",
  "Youngstown,OH",
  "Buffalo,NY",
  "Rochester,NY",
  "Syracuse,NY",
  "Pittsburgh,PA",
  "Erie,PA",
  "Rockford,IL",
]

const DEFAULT_STRATEGIES = [
  "tax-code-stack",
  "vacant-equity",
  "land-wholesale",
  "portfolio-landlord",
  "preforeclosure-equity",
  "expired-lowball",
  "active-stale-lowball",
  "lien-equity",
]

const OUT_DIR = path.join(process.cwd(), "tmp", "outreach")
const MAX_COUNT = numberArg("max-count", 350)
const MIN_COUNT = numberArg("min-count", 1)
const MAX_BUILDS = numberArg("max-builds", BUILD ? 40 : 0)
const TIMEOUT_MS = numberArg("timeout-ms", 30000)
const PAUSE_MS = numberArg("pause-ms", 500)
const POLL_MS = numberArg("poll-ms", 1500)
const POLL_TIMEOUT_MS = numberArg("poll-timeout-ms", 12 * 60 * 1000)
const RUN_ID = `vb-dm-${new Date().toISOString().replace(/[:.]/g, "-")}`
const USER_MARKETS = parseMarkets(getArg("markets") || getArg("market") || DEFAULT_MARKETS.join("|"))
const USER_STRATEGIES = parseList(getArg("strategies") || getArg("strategy") || DEFAULT_STRATEGIES.join("|")).map(normalizeSlug)

function numberArg(name, fallback) {
  const raw = getArg(name)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value) {
  return String(value || "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseMarkets(value) {
  return parseList(value)
    .map((market) => {
      const [city, state] = market.split(",").map((part) => part.trim())
      return city && state ? { city, state: state.toUpperCase(), slug: normalizeSlug(`${city}-${state}`) } : null
    })
    .filter(Boolean)
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function chromeJavascript(source) {
  const jsPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.js`)
  const osaPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.applescript`)
  fs.writeFileSync(jsPath, source)
  fs.writeFileSync(
    osaPath,
    [
      "on run argv",
      "  set jsPath to item 1 of argv",
      "  set jsSource to read POSIX file jsPath as «class utf8»",
      "  tell application \"Google Chrome\"",
      "    if (count windows) is 0 then error \"Google Chrome is not open\"",
      "    tell active tab of front window to execute javascript jsSource",
      "  end tell",
      "end run",
    ].join("\n")
  )
  try {
    return execFileSync("osascript", [osaPath, jsPath], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).trim()
  } finally {
    fs.rmSync(jsPath, { force: true })
    fs.rmSync(osaPath, { force: true })
  }
}

function selectedChromeUrl() {
  return execFileSync(
    "osascript",
    ["-e", 'tell application "Google Chrome" to if (count windows) > 0 then get URL of active tab of front window'],
    { encoding: "utf8" }
  ).trim()
}

function makeBrowserPayload() {
  const config = {
    runId: RUN_ID,
    build: BUILD,
    minCount: MIN_COUNT,
    maxCount: MAX_COUNT,
    maxBuilds: MAX_BUILDS,
    timeoutMs: TIMEOUT_MS,
    pauseMs: PAUSE_MS,
    markets: USER_MARKETS,
    strategyKeys: USER_STRATEGIES,
  }

  return `(() => {
  const CONFIG = ${JSON.stringify(config)}
  const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
  const token = localStorage.getItem("token")
  window.vbDmWebsiteListBuilderActiveRunId = CONFIG.runId
  const ensureActive = () => {
    if (window.vbDmWebsiteListBuilderActiveRunId !== CONFIG.runId) {
      throw new Error("DealMachine browser run was superseded by a newer run.")
    }
  }
  const dateObject = { date_1: null, date_2: null, date_type: "days", date_amount: 1, time_type: "ago" }
  const today = new Date().toISOString().slice(0, 10)
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const slug = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const option = (value, label = value) => ({ value: String(value), label: String(label) })
  const field = (key, label, type, equal_type, values) => ({
    label,
    key,
    equal_type,
    type,
    values: values.map((value) => typeof value === "object" ? value : option(value)),
    date_object: dateObject,
    additional_condition_values: null
  })
  const boolYes = (key, label) => field(key, label, "bool", "is_equal_to_any_of", [option("Yes", "Yes")])
  const numMin = (key, label, value) => field(key, label, "number", "is_greater_than_or_equal_to", [String(value)])
  const numMax = (key, label, value) => field(key, label, "number", "is_less_than_or_equal_to", [String(value)])
  const objAny = (key, label, values) => field(key, label, "object", "is_equal_to_any_of", values)
  const filters = (items) => ({ data: [{ andor_type: "and", data: items }], andor_type: "and" })
  const residential = objAny("PropertyClass", "Property class", [option("R", "Residential")])
  const vacantLand = objAny("PropertyClass", "Property class", [option("V", "Vacant Land")])
  const offMarket = objAny("market_status", "Market status", [option("Off Market", "Off Market")])
  const active = objAny("market_status", "Market status", [option("Active", "Active")])
  const expired = objAny("market_status", "Market status", [option("Expired Listings", "Expired Listings")])
  const outOfStateAbsentee = objAny("owner_type", "Owner type", [option("Out Of State Absentee Owner", "Out Of State Absentee Owner")])
  const absenteeOrCorporate = objAny("owner_type", "Owner type", [option("Absentee Owner", "Absentee Owner"), option("Out Of State Absentee Owner", "Out Of State Absentee Owner"), option("Corporate Owned", "Corporate Owned")])
  const strategies = {
    "tax-code-stack": {
      label: "Tax delinquent equity pressure",
      variants: [
        { variant: "tax-oos-equity60-residential", items: [boolYes("TaxDelinquent", "Tax delinquent?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 60), residential] },
        { variant: "tax-oos-equity50-residential", items: [boolYes("TaxDelinquent", "Tax delinquent?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 50), residential] },
        { variant: "tax-absentee-equity60-residential", items: [boolYes("TaxDelinquent", "Tax delinquent?"), absenteeOrCorporate, numMin("equity_percent", "Equity percent", 60), residential] },
        { variant: "tax-equity70-residential", items: [boolYes("TaxDelinquent", "Tax delinquent?"), numMin("equity_percent", "Equity percent", 70), residential] }
      ]
    },
    "vacant-equity": {
      label: "Vacant high-equity absentee",
      variants: [
        { variant: "vacant-oos-equity60-offmarket-residential", items: [boolYes("is_vacant", "USPS Vacant?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 60), offMarket, residential] },
        { variant: "vacant-absentee-equity65-offmarket-residential", items: [boolYes("is_vacant", "USPS Vacant?"), absenteeOrCorporate, numMin("equity_percent", "Equity percent", 65), offMarket, residential] },
        { variant: "vacant-oos-equity50-offmarket-residential", items: [boolYes("is_vacant", "USPS Vacant?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 50), offMarket, residential] }
      ]
    },
    "land-wholesale": {
      label: "Land wholesale / developer activity",
      variants: [
        { variant: "vacant-land-oos-equity70-offmarket", items: [vacantLand, outOfStateAbsentee, numMin("equity_percent", "Equity percent", 70), offMarket] },
        { variant: "vacant-land-absentee-equity60-offmarket", items: [vacantLand, absenteeOrCorporate, numMin("equity_percent", "Equity percent", 60), offMarket] },
        { variant: "vacant-land-equity80-offmarket", items: [vacantLand, numMin("equity_percent", "Equity percent", 80), offMarket] },
        { variant: "vacant-infill-oos-equity60-offmarket-residential", items: [boolYes("is_vacant", "USPS Vacant?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 60), offMarket, residential] }
      ]
    },
    "portfolio-landlord": {
      label: "Out-of-state portfolio landlord",
      variants: [
        { variant: "multi-oos-equity65-residential", items: [boolYes("owner_has_multiple_properties", "Owner has multiple properties"), boolYes("out_of_state_owner", "Out of State Owner?"), numMin("equity_percent", "Equity percent", 65), residential] },
        { variant: "multi-oos-equity55-residential", items: [boolYes("owner_has_multiple_properties", "Owner has multiple properties"), boolYes("out_of_state_owner", "Out of State Owner?"), numMin("equity_percent", "Equity percent", 55), residential] },
        { variant: "multi-oos-equity45-offmarket-residential", items: [boolYes("owner_has_multiple_properties", "Owner has multiple properties"), boolYes("out_of_state_owner", "Out of State Owner?"), numMin("equity_percent", "Equity percent", 45), offMarket, residential] }
      ]
    },
    "preforeclosure-equity": {
      label: "Preforeclosure with equity",
      variants: [
        { variant: "preforeclosure-equity35-residential", items: [objAny("preforeclosure_status", "Foreclosure status", [option("In Preforeclosure", "In Preforeclosure")]), numMin("equity_percent", "Equity percent", 35), residential] },
        { variant: "preforeclosure-equity20-residential", items: [objAny("preforeclosure_status", "Foreclosure status", [option("In Preforeclosure", "In Preforeclosure")]), numMin("equity_percent", "Equity percent", 20), residential] }
      ]
    },
    "expired-lowball": {
      label: "Expired listing lowball lane",
      variants: [
        { variant: "expired-under250k-residential", items: [expired, numMax("current_listing_price", "Current listing price", 250000), residential] },
        { variant: "expired-under350k-residential", items: [expired, numMax("current_listing_price", "Current listing price", 350000), residential] },
        { variant: "expired-under450k-residential", items: [expired, numMax("current_listing_price", "Current listing price", 450000), residential] }
      ]
    },
    "active-stale-lowball": {
      label: "Active stale listing lowball lane",
      variants: [
        { variant: "active-dom90-under350k-residential", items: [active, numMin("days_on_market", "Days on market", 90), numMax("current_listing_price", "Current listing price", 350000), residential] },
        { variant: "active-dom60-under350k-residential", items: [active, numMin("days_on_market", "Days on market", 60), numMax("current_listing_price", "Current listing price", 350000), residential] },
        { variant: "active-dom60-under450k-residential", items: [active, numMin("days_on_market", "Days on market", 60), numMax("current_listing_price", "Current listing price", 450000), residential] }
      ]
    },
    "lien-equity": {
      label: "Active lien with equity",
      variants: [
        { variant: "active-lien-oos-equity60-residential", items: [boolYes("active_lien", "Property Has Active Lien?"), outOfStateAbsentee, numMin("equity_percent", "Equity percent", 60), residential] },
        { variant: "active-lien-absentee-equity65-residential", items: [boolYes("active_lien", "Property Has Active Lien?"), absenteeOrCorporate, numMin("equity_percent", "Equity percent", 65), residential] },
        { variant: "active-lien-equity75-residential", items: [boolYes("active_lien", "Property Has Active Lien?"), numMin("equity_percent", "Equity percent", 75), residential] }
      ]
    }
  }

  window.vbDmWebsiteListBuilder = {
    runId: CONFIG.runId,
    done: false,
    build: CONFIG.build,
    startedAt: new Date().toISOString(),
    progress: "starting",
    rows: [],
    built: [],
    skipped: [],
    errors: [],
    selected: [],
    config: { ...CONFIG, strategyKeys: CONFIG.strategyKeys }
  }

  const api = async (body, timeoutMs = CONFIG.timeoutMs) => {
    ensureActive()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs)
    try {
      const res = await fetch("https://api.dealmachine.com/v2/list-builder/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-DM-Client-Key": DM_CLIENT_KEY
        },
        signal: controller.signal,
        body: JSON.stringify({ token, ...body })
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch (error) { data = { error: text.slice(0, 300) } }
      return { ok: res.ok, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, data: { error: error?.message || String(error) } }
    } finally {
      clearTimeout(timeout)
    }
  }

  const countVariant = async ({ market, strategyKey, strategy, variant }) => {
    const listFilters = filters(variant.items)
    const response = await api({
      type: "build_list_count",
      list_filters: JSON.stringify(listFilters),
      location_type: "city",
      city: market.city,
      state: market.state,
      zip: "",
      fips: "",
      drawing_coordinates: JSON.stringify([])
    })
    const count = response.data?.results?.lead_count ?? null
    const row = {
      city: market.city,
      state: market.state,
      market: market.city + ", " + market.state,
      strategyKey,
      strategy: strategy.label,
      variant: variant.variant,
      count,
      status: response.status,
      error: response.data?.error || false,
      filters: listFilters
    }
    window.vbDmWebsiteListBuilder.rows.push({ ...row, filters: undefined })
    return row
  }

  const chooseVariant = async (market, strategyKey) => {
    ensureActive()
    const strategy = strategies[strategyKey]
    if (!strategy) return null
    let lastZero = null
    let lastOversized = null
    for (const variant of strategy.variants) {
      window.vbDmWebsiteListBuilder.progress = market.city + ", " + market.state + " / " + strategyKey + " / " + variant.variant
      const row = await countVariant({ market, strategyKey, strategy, variant })
      await sleep(CONFIG.pauseMs)
      if (row.error || row.count === null) {
        window.vbDmWebsiteListBuilder.errors.push({ ...row, filters: undefined })
        continue
      }
      if (row.count < CONFIG.minCount) {
        lastZero = row
        continue
      }
      if (row.count > CONFIG.maxCount) {
        lastOversized = row
        continue
      }
      return row
    }
    const reason = lastOversized ? "oversized_after_tightening" : "empty"
    window.vbDmWebsiteListBuilder.skipped.push({
      city: market.city,
      state: market.state,
      market: market.city + ", " + market.state,
      strategyKey,
      strategy: strategy.label,
      reason,
      count: lastOversized?.count ?? lastZero?.count ?? null,
      variant: lastOversized?.variant ?? lastZero?.variant ?? null
    })
    return null
  }

  const buildSelected = async (row) => {
    const title = [
      "VB",
      row.strategyKey,
      slug(row.city + "-" + row.state),
      row.variant,
      today
    ].join(" ").slice(0, 150)
    const response = await api({
      title,
      type: "build_list",
      using_new_filters: 1,
      list_type: "build_list",
      list_area_type: "city",
      list_area: row.city,
      list_area_2: row.state,
      list_geo_fence: JSON.stringify([]),
      list_filters: JSON.stringify(row.filters),
      estimated_count: row.count
    }, Math.max(CONFIG.timeoutMs, 45000))
    const result = {
      city: row.city,
      state: row.state,
      market: row.market,
      strategyKey: row.strategyKey,
      strategy: row.strategy,
      variant: row.variant,
      count: row.count,
      title,
      status: response.status,
      error: response.data?.error || false,
      list: response.data?.results?.list || response.data?.results || null
    }
    if (response.ok && response.data?.error === false) {
      window.vbDmWebsiteListBuilder.built.push(result)
    } else {
      window.vbDmWebsiteListBuilder.errors.push(result)
    }
    return result
  }

  ;(async () => {
    try {
      if (!token) throw new Error("DealMachine token was not found in the active tab. Open app.dealmachine.com/map and log in.")
      const strategiesToRun = CONFIG.strategyKeys.filter((key) => strategies[key])
      marketLoop:
      for (const market of CONFIG.markets) {
        for (const strategyKey of strategiesToRun) {
          ensureActive()
          if (CONFIG.build && window.vbDmWebsiteListBuilder.built.length >= CONFIG.maxBuilds) {
            window.vbDmWebsiteListBuilder.progress = "max builds reached"
            break marketLoop
          }
          const selected = await chooseVariant(market, strategyKey)
          if (!selected) continue
          const selectedRow = { ...selected, filters: undefined }
          window.vbDmWebsiteListBuilder.selected.push(selectedRow)
          if (CONFIG.build && window.vbDmWebsiteListBuilder.built.length < CONFIG.maxBuilds) {
            window.vbDmWebsiteListBuilder.progress = "building " + selected.market + " " + selected.strategyKey
            await buildSelected(selected)
            await sleep(CONFIG.pauseMs)
          } else if (CONFIG.build) {
            window.vbDmWebsiteListBuilder.skipped.push({ ...selectedRow, reason: "max_builds_reached" })
          }
        }
      }
      window.vbDmWebsiteListBuilder.done = true
      window.vbDmWebsiteListBuilder.finishedAt = new Date().toISOString()
      window.vbDmWebsiteListBuilder.progress = "done"
    } catch (error) {
      window.vbDmWebsiteListBuilder.done = true
      window.vbDmWebsiteListBuilder.finishedAt = new Date().toISOString()
      window.vbDmWebsiteListBuilder.progress = "failed"
      window.vbDmWebsiteListBuilder.fatal = error?.message || String(error)
    }
  })()

  return "vb-dealmachine-list-builder-started"
})()`
}

function pollResults() {
  const started = Date.now()
  let last = null
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const raw = chromeJavascript("JSON.stringify(window.vbDmWebsiteListBuilder || null)")
    if (raw && raw !== "null") {
      last = JSON.parse(raw)
      process.stdout.write(`\r${last.progress || "working"} | selected ${last.selected?.length || 0} | built ${last.built?.length || 0} | skipped ${last.skipped?.length || 0}`)
      if (last.done) {
        process.stdout.write("\n")
        return last
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, POLL_MS)
  }
  process.stdout.write("\n")
  return last || { done: false, fatal: "Timed out before the browser run finished." }
}

function writeOutputs(results) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(OUT_DIR, `dealmachine-website-list-builder-${stamp}.json`)
  const mdPath = path.join(OUT_DIR, `dealmachine-website-list-builder-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))
  const built = results.built || []
  const selected = results.selected || []
  const skipped = results.skipped || []
  const errors = results.errors || []
  fs.writeFileSync(
    mdPath,
    [
      "# DealMachine Website List Builder Run",
      "",
      `Run ID: ${results.runId || RUN_ID}`,
      `Mode: ${results.build ? "Build lists" : "Count only"}`,
      `Selected lanes: ${selected.length}`,
      `Built lists: ${built.length}`,
      `Skipped lanes: ${skipped.length}`,
      `Errors: ${errors.length}`,
      "",
      "## Built",
      "",
      ...(built.length
        ? built.map((row) => `- ${row.title}: ${row.count} leads (${row.market}, ${row.strategyKey})`)
        : ["- None"]),
      "",
      "## Selected But Not Built",
      "",
      ...(!results.build && selected.length
        ? selected.map((row) => `- ${row.market} / ${row.strategyKey} / ${row.variant}: ${row.count} leads`)
        : ["- None"]),
      "",
      "## Skipped",
      "",
      ...(skipped.length
        ? skipped.map((row) => `- ${row.market} / ${row.strategyKey}: ${row.reason} (${row.count ?? "n/a"} leads, ${row.variant || "no variant"})`)
        : ["- None"]),
      "",
      "## Next Export Settings",
      "",
      "- Export type: Contacts",
      "- Associated contacts: Likely Property Owners",
      "- Scrub DNC: on",
      "- Scrub Landline: on",
      "- Scrub Wireless: off",
      "- Deduplicate Contacts: on",
      "- Include contacts without phone numbers: on",
      "",
      "Then ingest with:",
      "",
      "```bash",
      "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
      "```",
      "",
    ].join("\n")
  )
  return { jsonPath, mdPath }
}

function main() {
  const url = selectedChromeUrl()
  if (!/app\.dealmachine\.com/i.test(url)) {
    throw new Error(`Open DealMachine in the active Chrome tab before running this script. Current tab: ${url}`)
  }
  console.log("=== DealMachine website list builder ===")
  console.log(`Mode:        ${BUILD ? "build lists" : "count only"}`)
  console.log(`Markets:     ${USER_MARKETS.map((market) => `${market.city}, ${market.state}`).join(" | ")}`)
  console.log(`Strategies:  ${USER_STRATEGIES.join(" | ")}`)
  console.log(`Count range: ${MIN_COUNT}-${MAX_COUNT}`)
  console.log(`Max builds:  ${MAX_BUILDS}`)
  console.log("")
  const start = chromeJavascript(makeBrowserPayload())
  if (!/started/.test(start)) {
    throw new Error(`Could not start browser runner: ${start}`)
  }
  const results = pollResults()
  const outputs = writeOutputs(results)
  console.log("")
  console.log(`Selected lanes: ${results.selected?.length || 0}`)
  console.log(`Built lists:    ${results.built?.length || 0}`)
  console.log(`Skipped lanes:  ${results.skipped?.length || 0}`)
  console.log(`Errors:         ${results.errors?.length || 0}`)
  if (results.fatal) console.log(`Fatal:          ${results.fatal}`)
  console.log(`Report:         ${outputs.mdPath}`)
  console.log(`JSON:           ${outputs.jsonPath}`)
}

main()
