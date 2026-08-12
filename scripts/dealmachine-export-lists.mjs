/**
 * Trigger DealMachine Contacts exports for existing DealMachine list IDs.
 *
 * The export is started from the authenticated Chrome DealMachine session and
 * DealMachine emails the resulting CSV to the requested address. This is not
 * skip tracing; it only exports contacts already available in DealMachine.
 *
 * Usage:
 *   node scripts/dealmachine-export-lists.mjs --lists-json=tmp/outreach/dealmachine-website-list-builder-2026-06-15T01-01-28-598Z.json
 *   node scripts/dealmachine-export-lists.mjs --lists-json=... --send --emails=acquisitions@vestblock.io
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const SEND = args.includes("--send") || args.includes("--export")
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LISTS_JSON = getArg("lists-json") || getArg("file")
const EMAILS = getArg("emails") || getArg("email") || "acquisitions@vestblock.io"
const OUT_DIR = path.join(process.cwd(), "tmp", "outreach")
const RUN_ID = `vb-dm-export-${new Date().toISOString().replace(/[:.]/g, "-")}`
const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
const DEDUPE_BY_DEALMACHINE = args.includes("--dealmachine-dedupe")
const WAIT_FOR_CONTACTS_MS = Number(getArg("wait-ms") || (SEND ? 45 * 60 * 1000 : 0))
const WAIT_FOR_HYDRATION_MS = Number(getArg("hydration-wait-ms") || (SEND ? 30 * 60 * 1000 : 0))
const MAX_LISTS = Number(getArg("max-lists") || 0)
const FILTER_MARKETS = parsePipeList(getArg("markets") || getArg("market"))
const FILTER_STRATEGIES = parseArgList(getArg("strategies") || getArg("strategy"))
const FILTER_LIST_IDS = parseArgList(getArg("list-ids") || getArg("list-id"))

function parseArgList(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parsePipeList(value) {
  return String(value || "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function selectedChromeUrl() {
  return execFileSync(
    "osascript",
    ["-e", 'tell application "Google Chrome" to if (count windows) > 0 then get URL of active tab of front window'],
    { encoding: "utf8" }
  ).trim()
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
      '  tell application "Google Chrome"',
      '    if (count windows) is 0 then error "Google Chrome is not open"',
      "    tell active tab of front window to execute javascript jsSource",
      "  end tell",
      "end run",
    ].join("\n")
  )
  try {
    return execFileSync("osascript", [osaPath, jsPath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trim()
  } finally {
    fs.rmSync(jsPath, { force: true })
    fs.rmSync(osaPath, { force: true })
  }
}

function loadBuiltLists(file) {
  if (!file) throw new Error("Pass --lists-json=<DealMachine website list-builder JSON>.")
  const absolute = path.resolve(file)
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"))
  const rows = Array.isArray(parsed) ? parsed : parsed.built || []
  const filtered = rows
    .map((row) => ({
      market: row.market || [row.city, row.state].filter(Boolean).join(", "),
      strategyKey: row.strategyKey || row.strategy_key || row.strategy || "contacts",
      count: Number(row.count || row.estimated_count || 0),
      id: row.list?.id || row.list_id || row.id,
      title: row.title || row.list?.title || `DealMachine list ${row.list?.id || row.list_id || row.id}`,
      building: Number(row.list?.building || row.building || 0),
      leadCount: Number(row.list?.lead_count || row.lead_count || 0),
      estimatedCount: Number(row.list?.estimated_count || row.estimated_count || row.count || 0),
    }))
    .filter((row) => row.id && row.count > 0)
    .filter((row) => !FILTER_MARKETS.length || FILTER_MARKETS.some((value) => normalizeSlug(row.market) === normalizeSlug(value)))
    .filter((row) => !FILTER_STRATEGIES.length || FILTER_STRATEGIES.some((value) => normalizeSlug(row.strategyKey) === normalizeSlug(value)))
    .filter((row) => !FILTER_LIST_IDS.length || FILTER_LIST_IDS.some((value) => String(row.id) === String(value)))

  return MAX_LISTS > 0 ? filtered.slice(0, MAX_LISTS) : filtered
}

function makeBrowserPayload(lists) {
  const config = {
    runId: RUN_ID,
    send: SEND,
    emails: EMAILS,
    dealmachineDedupe: DEDUPE_BY_DEALMACHINE,
    waitForContactsMs: WAIT_FOR_CONTACTS_MS,
    waitForHydrationMs: WAIT_FOR_HYDRATION_MS,
    lists,
  }

  return `(() => {
    const CONFIG = ${JSON.stringify(config)}
    const DM_CLIENT_KEY = ${JSON.stringify(DM_CLIENT_KEY)}
    const token = localStorage.getItem("token")
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const slug = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

    window.vbDmExportLists = {
      runId: CONFIG.runId,
      done: false,
      send: CONFIG.send,
      startedAt: new Date().toISOString(),
      rows: [],
      errors: []
    }

    const post = async (body) => {
      const response = await fetch("https://api.dealmachine.com/v2/list/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-DM-Client-Key": DM_CLIENT_KEY
        },
        body: JSON.stringify({ token, ...body })
      })
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch (error) { data = { raw: text.slice(0, 500) } }
      return { ok: response.ok, status: response.status, data }
    }

    const fetchListStatus = async (listId) => {
      const response = await post({
        type: "list",
        list_id: listId,
        page: 1,
        limit: 1
      })
      const list =
        response.data?.results?.list ||
        response.data?.results?.lists?.[0] ||
        response.data?.results ||
        null
      return { ...response, list }
    }

    const waitForHydration = async (list, row) => {
      const started = Date.now()
      let attempts = 0
      do {
        attempts += 1
        const statusResponse = await fetchListStatus(list.id)
        const latest = statusResponse.list || {}
        const building = Number(latest?.building || 0)
        const leadCount = Number(latest?.lead_count || 0)
        const estimatedCount = Number(latest?.estimated_count || list.estimatedCount || list.count || 0)
        row.hydrationStatus = statusResponse.status
        row.hydrationAttempts = attempts
        row.waitElapsedHydrationMs = Date.now() - started
        row.building = building
        row.leadCount = leadCount
        row.estimatedCount = estimatedCount
        row.lastHydrationCheckAt = new Date().toISOString()
        row.waitingForHydration =
          CONFIG.send &&
          building === 1 &&
          row.waitElapsedHydrationMs < CONFIG.waitForHydrationMs
        if (!CONFIG.send || !row.waitingForHydration) {
          row.hydrationTimedOut = CONFIG.send && building === 1 && row.waitElapsedHydrationMs >= CONFIG.waitForHydrationMs
          return { statusResponse, building, leadCount, estimatedCount }
        }
        await sleep(5000)
      } while (true)
    }

    const exportableCount = async (list, row) => {
      const started = Date.now()
      let attempts = 0
      do {
        attempts += 1
        const countResponse = await post({
          type: "export_actual_count",
          select_all: 1,
          total_count: list.count,
          list_id: list.id,
          export_type: "contacts",
          include_likely_owners: true,
          include_family: false,
          include_likely_renters: false,
          include_potential_property_owners: false,
          scrub_dnc: true,
          scrub_landline: true,
          scrub_wireless: false,
          deduplicate: CONFIG.dealmachineDedupe,
          remove_items_without_phone_numbers: false
        })
        const countResult = countResponse.data?.results || countResponse.data || {}
        const actualCount =
          countResult.total_count_not_yet_exported ??
          countResult.actual_count ??
          countResult.count ??
          null
        row.countStatus = countResponse.status
        row.countOk = countResponse.ok
        row.actualCount = actualCount
        row.countResult = countResult
        row.countAttempts = attempts
        row.waitElapsedMs = Date.now() - started
        row.waitingForContacts = CONFIG.send && Number(actualCount || 0) <= 0 && row.waitElapsedMs < CONFIG.waitForContactsMs
        row.lastCheckedAt = new Date().toISOString()
        if (!CONFIG.send || Number(actualCount || 0) > 0 || Date.now() - started >= CONFIG.waitForContactsMs) {
          return { countResponse, countResult, actualCount }
        }
        await sleep(5000)
      } while (true)
    }

    ;(async () => {
      try {
        if (!token) throw new Error("DealMachine token was not found in the active Chrome tab.")
        const settingsResponse = await post({ type: "get_export_settings_for_user" })
        const settings = settingsResponse.data?.results?.export_settings || {}
        const selectedColumns = settings.user_column_preferences?.contact_export_columns || []

        for (const list of CONFIG.lists) {
          const row = {
            ...list,
            countStatus: null,
            countOk: false,
            actualCount: null,
            countResult: null,
            countAttempts: 0,
            waitingForContacts: false,
            waitingForHydration: false,
            waitElapsedMs: 0,
            waitElapsedHydrationMs: 0,
            exported: false,
            startedAt: new Date().toISOString()
          }
          window.vbDmExportLists.rows.push(row)
          await waitForHydration(list, row)
          if (CONFIG.send && row.building === 1) {
            row.exportBlocked = true
            row.exportBlockReason = row.hydrationTimedOut ? "blocked_hydration_timeout" : "blocked_waiting_for_hydration"
            row.finishedAt = new Date().toISOString()
            await sleep(350)
            continue
          }
          const { countResponse, countResult, actualCount } = await exportableCount(list, row)

          if (CONFIG.send) {
            if (!countResponse.ok || Number(actualCount || 0) <= 0) {
              row.exportBlocked = true
              row.exportBlockReason =
                row.building === 1
                  ? "blocked_not_hydrated"
                  : "blocked_zero_exportable_contacts"
              row.finishedAt = new Date().toISOString()
              await sleep(350)
              continue
            }
            const exportFileName = ["vestblock", slug(list.strategyKey || "contacts"), slug(list.market), new Date().toISOString().slice(0, 10), list.id].join("-")
            const exportResponse = await post({
              type: "export_v2",
              select_all: 1,
              total_count: Number(actualCount || list.count || 0),
              emails: CONFIG.emails,
              list_id: list.id,
              selected_columns: selectedColumns.join(","),
              include_all_columns: 0,
              export_type: "contacts",
              include_likely_owners: true,
              include_family: false,
              include_likely_renters: false,
              include_potential_property_owners: false,
              scrub_dnc: true,
              scrub_landline: true,
              scrub_wireless: false,
              deduplicate: CONFIG.dealmachineDedupe,
              remove_items_without_phone_numbers: false,
              export_file_name: exportFileName
            })
            row.exportStatus = exportResponse.status
            row.exportOk = exportResponse.ok
            row.exportError = exportResponse.data?.error || false
            row.exportResult = exportResponse.data?.results || exportResponse.data || null
            row.exported = exportResponse.ok && exportResponse.data?.error === false
            row.exportFileName = exportFileName
          }

          row.finishedAt = new Date().toISOString()
          await sleep(350)
        }

        window.vbDmExportLists.done = true
        window.vbDmExportLists.finishedAt = new Date().toISOString()
      } catch (error) {
        window.vbDmExportLists.done = true
        window.vbDmExportLists.finishedAt = new Date().toISOString()
        window.vbDmExportLists.fatal = error?.message || String(error)
      }
    })()

    return "vb-dealmachine-export-lists-started"
  })()`
}

function pollResults() {
  const started = Date.now()
  const timeoutMs = Math.max(10 * 60 * 1000, WAIT_FOR_CONTACTS_MS + 10 * 60 * 1000)
  while (Date.now() - started < timeoutMs) {
    const raw = chromeJavascript("JSON.stringify(window.vbDmExportLists || null)")
    if (raw && raw !== "null") {
      const parsed = JSON.parse(raw)
      if (parsed.runId !== RUN_ID) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
        continue
      }
      const rows = parsed.rows || []
      const waiting = rows.filter((row) => row.waitingForContacts).length
      const hydrating = rows.filter((row) => row.waitingForHydration).length
      const done = rows.filter((row) => row.finishedAt).length
      process.stdout.write(`\r${done}/${rows.length || 0} lists resolved${hydrating ? ` / hydrating ${hydrating}` : ""}${waiting ? ` / waiting ${waiting}` : ""}${parsed.send ? " / export mode" : " / dry run"}`)
      if (parsed.done) {
        process.stdout.write("\n")
        return parsed
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  process.stdout.write("\n")
  return { done: false, fatal: `Timed out waiting for DealMachine export results after ${Math.round(timeoutMs / 60000)} minutes.` }
}

function writeOutputs(results) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(OUT_DIR, `dealmachine-export-lists-${stamp}.json`)
  const mdPath = path.join(OUT_DIR, `dealmachine-export-lists-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))
  fs.writeFileSync(
    mdPath,
    [
      "# DealMachine Contacts Export Run",
      "",
      `Run ID: ${results.runId || RUN_ID}`,
      `Mode: ${results.send ? "Export requested" : "Dry run"}`,
      `Destination: ${EMAILS}`,
      `Lists: ${results.rows?.length || 0}`,
      `Fatal: ${results.fatal || "none"}`,
      "",
      "## Lists",
      "",
      ...(results.rows || []).map(
        (row) =>
          `- ${row.market}: list ${row.id}, ${row.count} estimated leads, exportable contacts ${row.actualCount ?? "n/a"}, export ${row.exported ? "started" : row.exportBlocked ? row.exportBlockReason : results.send ? "not started" : "dry run"}`
      ),
      "",
      "## Next Step",
      "",
      "DealMachine does not drop the CSV directly to disk. It emails a time-limited download link and also mirrors it in DealMachine notifications.",
      "",
      "Use one lane at a time when testing fresh strategies:",
      "",
      "```bash",
      "node scripts/dealmachine-export-lists.mjs --lists-json=/path/to/run.json --send --emails=acquisitions@vestblock.io --market=<city-state> --strategy=<strategy-key> --max-lists=1",
      "```",
      "",
      "When the Contacts CSV is downloaded, save it into `data/dm-exports/` and ingest it:",
      "",
      "```bash",
      "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
      "```",
      "",
      "Then start outreach with the explicit export CSV so VestBlock's send logs dedupe recipients:",
      "",
      "```bash",
      "node --env-file=.env.local scripts/dealmachine-export-outreach.mjs --market=<city-state> --strategy=<strategy-key> --export-csv=/path/to/dealmachine-contacts.csv --send",
      "```",
      "",
    ].join("\n")
  )
  return { jsonPath, mdPath }
}

function main() {
  const url = selectedChromeUrl()
  if (!/app\.dealmachine\.com/i.test(url)) {
    throw new Error(`Open DealMachine in Chrome before running this script. Current tab: ${url}`)
  }
  const lists = loadBuiltLists(LISTS_JSON)
  if (!lists.length) throw new Error("No built DealMachine lists were found in the JSON.")
  console.log("=== DealMachine Contacts Export ===")
  console.log(`Mode:        ${SEND ? "export" : "dry run"}`)
  console.log(`Lists:       ${lists.length}`)
  if (FILTER_MARKETS.length) console.log(`Markets:     ${FILTER_MARKETS.join(", ")}`)
  if (FILTER_STRATEGIES.length) console.log(`Strategies:  ${FILTER_STRATEGIES.join(", ")}`)
  if (FILTER_LIST_IDS.length) console.log(`List IDs:    ${FILTER_LIST_IDS.join(", ")}`)
  console.log(`Destination: ${EMAILS}`)
  console.log(`DM dedupe:   ${DEDUPE_BY_DEALMACHINE ? "on" : "off; VestBlock send logs will dedupe"}`)
  console.log("")
  const start = chromeJavascript(makeBrowserPayload(lists))
  if (!/started/.test(start)) throw new Error(`Could not start DealMachine export runner: ${start}`)
  const results = pollResults()
  const outputs = writeOutputs(results)
  console.log(`Report: ${outputs.mdPath}`)
  console.log(`JSON:   ${outputs.jsonPath}`)
}

main()
