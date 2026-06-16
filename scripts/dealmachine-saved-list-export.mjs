/**
 * Queue DealMachine Contacts exports for saved website-built lists.
 *
 * This runs inside the logged-in Chrome DealMachine tab so the browser session
 * supplies the token. It does not run DealMachine skip tracing; it requests the
 * Contacts export with DNC/landline scrub settings so outreach can be verified
 * before sending.
 *
 * Usage:
 *   node scripts/dealmachine-saved-list-export.mjs --dry-run --files=tmp/outreach/run.json
 *   node scripts/dealmachine-saved-list-export.mjs --send --email=acquisitions@vestblock.io --files=tmp/outreach/run-a.json,tmp/outreach/run-b.json
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const SEND = args.includes("--send") || args.includes("--export")
const OUT_DIR = path.join(process.cwd(), "tmp", "outreach")
const RUN_ID = `vb-dm-export-${new Date().toISOString().replace(/[:.]/g, "-")}`
const DEFAULT_EMAIL = "acquisitions@vestblock.io"

function getArg(name) {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

function parseList(value) {
  return String(value || "")
    .split(/[|,;]/)
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
    return execFileSync("osascript", [osaPath, jsPath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trim()
  } finally {
    fs.rmSync(jsPath, { force: true })
    fs.rmSync(osaPath, { force: true })
  }
}

function chromeUrl() {
  return execFileSync(
    "osascript",
    ["-e", 'tell application "Google Chrome" to if (count windows) > 0 then get URL of active tab of front window'],
    { encoding: "utf8" }
  ).trim()
}

function defaultFiles() {
  if (!fs.existsSync(OUT_DIR)) return []
  return fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^dealmachine-(upgrade-list-builder|website-list-builder)-.*\.json$/i.test(name))
    .map((name) => path.join(OUT_DIR, name))
    .sort()
}

function absoluteFile(file) {
  return path.isAbsolute(file) ? file : path.join(process.cwd(), file)
}

function selectedFiles() {
  const requested = parseList(getArg("files") || getArg("file") || "")
  return requested.length ? requested.map(absoluteFile) : defaultFiles()
}

function loadBuiltLists(files) {
  const seen = new Set()
  const lists = []
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    const rows = parsed.built || parsed.builtLists || []
    for (const row of rows) {
      const list = row.list || {}
      const listId = list.id || list.value || row.listId || row.id
      if (!listId) continue
      const key = String(listId)
      if (seen.has(key)) continue
      seen.add(key)
      lists.push({
        sourceFile: path.relative(process.cwd(), file),
        listId,
        title: row.title || list.title || list.label || `VB ${row.strategyKey || "strategy"} ${row.market || "market"}`,
        market: row.market || [row.city, row.state].filter(Boolean).join(", "),
        city: row.city || "",
        state: row.state || "",
        strategyKey: row.strategyKey || normalizeSlug(row.strategy),
        strategy: row.strategy || row.strategyKey || "",
        variant: row.variant || "",
        estimatedCount: Number(row.count || list.estimated_count || list.lead_count || 0),
      })
    }
  }
  return lists
}

function browserExportPayload(lists, email, send) {
  return `(() => {
  const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
  const runId = ${JSON.stringify(RUN_ID)}
  const token = localStorage.getItem("token")
  const lists = ${JSON.stringify(lists)}
  const email = ${JSON.stringify(email)}
  const send = ${JSON.stringify(send)}
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  window.vbDmSavedListExport = { done: false, runId, email, send, results: [], startedAt: new Date().toISOString() }
  const api = async (body) => {
    const res = await fetch("https://api.dealmachine.com/v2/list/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-DM-Client-Key": DM_CLIENT_KEY
      },
      body: JSON.stringify({ token, ...body })
    })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch (error) { data = { error: text.slice(0, 500) } }
    return { ok: res.ok, status: res.status, data }
  }
  const results = []
  ;(async () => {
    if (!token) throw new Error("DealMachine token was not found. Open app.dealmachine.com/map and log in.")
    for (const item of lists) {
      let actualCount = null
      let actualCountStatus = null
      try {
        const countResponse = await api({
          type: "export_actual_count",
          select_all: 1,
          list_id: item.listId,
          total_count: item.estimatedCount || 0,
          export_type: "contacts",
          include_likely_owners: 1,
          include_family: 0,
          include_likely_renters: 0,
          include_potential_property_owners: 0,
          scrub_dnc: 1,
          scrub_landline: 1,
          scrub_wireless: 0,
          deduplicate: 1,
          remove_items_without_phone_numbers: 0
        })
        actualCountStatus = countResponse.status
        actualCount = countResponse.data?.results?.actual_count ?? countResponse.data?.results?.count ?? countResponse.data?.actual_count ?? null
      } catch (error) {
        actualCountStatus = 0
      }
      if (!send) {
        results.push({ ...item, requested: false, dryRun: true, actualCount, actualCountStatus })
        continue
      }
      const fileName = String(item.title || "VestBlock DealMachine Contacts Export").slice(0, 150)
      const response = await api({
        type: "export_v2",
        select_all: 1,
        total_count: item.estimatedCount || actualCount || 0,
        new_filters: null,
        emails: email,
        list_id: item.listId,
        search: "",
        search_type: "",
        list_history_id: "",
        lead_ids: "",
        selected_columns: "",
        include_all_columns: 1,
        property_flags: "",
        property_flags_and_or: "",
        export_type: "contacts",
        include_likely_owners: 1,
        include_family: 0,
        include_likely_renters: 0,
        include_potential_property_owners: 0,
        scrub_dnc: 1,
        scrub_landline: 1,
        scrub_wireless: 0,
        deduplicate: 1,
        remove_items_without_phone_numbers: 0,
        export_file_name: fileName
      })
      results.push({ ...item, requested: response.ok && response.data?.error !== true, actualCount, actualCountStatus, status: response.status, response: response.data })
      await sleep(350)
    }
    window.vbDmSavedListExport = { done: true, runId, email, send, results, finishedAt: new Date().toISOString() }
  })().catch((error) => {
    window.vbDmSavedListExport = { done: true, runId, email, send, results, fatal: error?.message || String(error), finishedAt: new Date().toISOString() }
  })
  return "vb-dealmachine-saved-list-export-started"
})()`
}

function pollBrowserResults() {
  const started = Date.now()
  while (Date.now() - started < 10 * 60 * 1000) {
    const raw = chromeJavascript("JSON.stringify(window.vbDmSavedListExport || null)")
    if (raw && raw !== "null") {
      const parsed = JSON.parse(raw)
      if (parsed.runId === RUN_ID && parsed.done) return parsed
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500)
  }
  throw new Error("Timed out before DealMachine export requests finished.")
}

function writeOutputs(result) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(OUT_DIR, `dealmachine-saved-list-export-${stamp}.json`)
  const mdPath = path.join(OUT_DIR, `dealmachine-saved-list-export-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2))

  const rows = result.results || []
  const requested = rows.filter((row) => row.requested).length
  const failed = rows.filter((row) => !row.requested && !row.dryRun).length
  const byStrategy = rows.reduce((acc, row) => {
    const key = row.strategyKey || "unknown"
    const current = acc[key] || { lists: 0, leads: 0, requested: 0 }
    current.lists += 1
    current.leads += Number(row.estimatedCount || 0)
    if (row.requested) current.requested += 1
    acc[key] = current
    return acc
  }, {})

  const lines = [
    "# DealMachine Saved List Export",
    "",
    `Created: ${result.finishedAt || new Date().toISOString()}`,
    `Mode: ${result.send ? "Export requested" : "Dry run"}`,
    `Email: ${result.email}`,
    `Lists: ${rows.length}`,
    `Requested: ${requested}`,
    `Failed: ${failed}`,
    "",
    "## By Strategy",
    "",
    ...Object.entries(byStrategy).map(([key, value]) => `- ${key}: ${value.requested}/${value.lists} exports, ${value.leads} estimated leads`),
    "",
    "## Lists",
    "",
    ...rows.map((row) => `- ${row.requested || row.dryRun ? "OK" : "FAILED"} ${row.market} / ${row.strategyKey}: ${row.estimatedCount} leads, list ${row.listId}`),
    "",
    "## Export Settings",
    "",
    "- Contacts export",
    "- Likely Property Owners only",
    "- DNC scrub on",
    "- Landline scrub on",
    "- Wireless scrub off",
    "- Deduplicate contacts on",
    "- Include contacts without phone numbers on",
    "",
    `JSON: ${path.relative(process.cwd(), jsonPath)}`,
  ]
  fs.writeFileSync(mdPath, lines.join("\n"))
  return { jsonPath, mdPath }
}

function main() {
  const files = selectedFiles()
  const email = getArg("email") || DEFAULT_EMAIL
  const lists = loadBuiltLists(files)
  if (!lists.length) throw new Error("No saved DealMachine lists were found in the selected JSON files.")

  const url = chromeUrl()
  if (!/app\.dealmachine\.com/i.test(url)) {
    throw new Error(`Chrome active tab is not DealMachine. Current URL: ${url}`)
  }

  console.log("=== DealMachine saved-list Contacts export ===")
  console.log(`Mode:    ${SEND ? "SEND/export" : "dry run"}`)
  console.log(`Email:   ${email}`)
  console.log(`Files:   ${files.length}`)
  console.log(`Lists:   ${lists.length}`)
  console.log(`Leads:   ${lists.reduce((sum, row) => sum + Number(row.estimatedCount || 0), 0)}`)
  console.log("")

  const started = chromeJavascript(browserExportPayload(lists, email, SEND))
  console.log(started)
  const result = pollBrowserResults()
  const outputs = writeOutputs(result)

  const requested = (result.results || []).filter((row) => row.requested).length
  const failed = (result.results || []).filter((row) => !row.requested && !row.dryRun).length
  console.log("")
  console.log(`Export requests: ${requested}/${lists.length}`)
  console.log(`Failed:          ${failed}`)
  console.log(`Report:          ${outputs.mdPath}`)
  console.log(`JSON:            ${outputs.jsonPath}`)
  if (result.fatal) {
    process.exitCode = 1
    console.log(`Fatal:           ${result.fatal}`)
  }
}

main()
