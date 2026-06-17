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
const WAIT_FOR_CONTACTS_MS = Number(getArg("wait-ms") || (SEND ? 10 * 60 * 1000 : 0))

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
  return rows
    .map((row) => ({
      market: row.market || [row.city, row.state].filter(Boolean).join(", "),
      strategyKey: row.strategyKey || row.strategy_key || row.strategy || "contacts",
      count: Number(row.count || row.estimated_count || 0),
      id: row.list?.id || row.list_id || row.id,
      title: row.title || row.list?.title || `DealMachine list ${row.list?.id || row.list_id || row.id}`,
    }))
    .filter((row) => row.id && row.count > 0)
}

function makeBrowserPayload(lists) {
  const config = {
    runId: RUN_ID,
    send: SEND,
    emails: EMAILS,
    dealmachineDedupe: DEDUPE_BY_DEALMACHINE,
    waitForContactsMs: WAIT_FOR_CONTACTS_MS,
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

    const exportableCount = async (list) => {
      const started = Date.now()
      do {
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
          const { countResponse, countResult, actualCount } = await exportableCount(list)
          const row = {
            ...list,
            countStatus: countResponse.status,
            countOk: countResponse.ok,
            actualCount,
            countResult,
            exported: false
          }

          if (CONFIG.send) {
            if (!countResponse.ok || Number(actualCount || 0) <= 0) {
              row.exportBlocked = true
              row.exportBlockReason = "blocked_zero_exportable_contacts"
              window.vbDmExportLists.rows.push(row)
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

          window.vbDmExportLists.rows.push(row)
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
  while (Date.now() - started < 10 * 60 * 1000) {
    const raw = chromeJavascript("JSON.stringify(window.vbDmExportLists || null)")
    if (raw && raw !== "null") {
      const parsed = JSON.parse(raw)
      if (parsed.runId !== RUN_ID) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
        continue
      }
      process.stdout.write(`\r${parsed.rows?.length || 0} lists checked${parsed.send ? " / export mode" : " / dry run"}`)
      if (parsed.done) {
        process.stdout.write("\n")
        return parsed
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  process.stdout.write("\n")
  return { done: false, fatal: "Timed out waiting for DealMachine export results." }
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
      "When DealMachine emails the Contacts CSV, save it into `data/dm-exports/` and ingest it:",
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
