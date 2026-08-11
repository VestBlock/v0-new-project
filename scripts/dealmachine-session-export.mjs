/**
 * DealMachine session-backed Contacts export runner.
 *
 * This uses the same export endpoint the logged-in DealMachine web app calls.
 * It is not the official public API from docs.dealmachine.com; it requires a
 * valid DealMachine web session token from localStorage.
 *
 * Why this exists:
 * - DealMachine's public API can get/add/update leads, but does not document a
 *   contacts export endpoint.
 * - The official Help Center says Contacts/Properties exports are available
 *   through the app and delivered by email/notifications.
 * - This script removes the visual-clicking step once DEALMACHINE_WEB_TOKEN is
 *   set, while preserving the same DNC/deduped Contacts export settings.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-session-export.mjs --files=tmp/outreach/dealmachine-website-list-builder-run.json
 *   node --env-file=.env.local scripts/dealmachine-session-export.mjs --send --email=acquisitions@vestblock.io --files=tmp/outreach/run-a.json,tmp/outreach/run-b.json
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send") || args.includes("--export")
const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "tmp", "outreach")
const RUN_ID = `vb-dm-session-export-${new Date().toISOString().replace(/[:.]/g, "-")}`
const DEFAULT_EMAIL = "acquisitions@vestblock.io"
const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
const TOKEN = String(process.env.DEALMACHINE_WEB_TOKEN || "").trim()

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

function defaultFiles() {
  if (!fs.existsSync(OUT_DIR)) return []
  return fs.readdirSync(OUT_DIR)
    .filter((name) => /^dealmachine-(upgrade-list-builder|website-list-builder)-.*\.json$/i.test(name))
    .map((name) => path.join(OUT_DIR, name))
    .sort()
}

function absoluteFile(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file)
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
      if (!listId || seen.has(String(listId))) continue
      seen.add(String(listId))
      lists.push({
        sourceFile: path.relative(ROOT, file),
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

async function dmListPost(body) {
  const res = await fetch("https://api.dealmachine.com/v2/list/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-DM-Client-Key": DM_CLIENT_KEY,
    },
    body: JSON.stringify({ token: TOKEN, ...body }),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text.slice(0, 500) }
  }
  return { ok: res.ok, status: res.status, data }
}

async function exportableCount(item) {
  const response = await dmListPost({
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
    remove_items_without_phone_numbers: 0,
  })
  const result = response.data?.results || response.data || {}
  const actualCount =
    result.total_count_not_yet_exported ??
    result.actual_count ??
    result.count ??
    response.data?.actual_count ??
    null
  return { response, result, actualCount }
}

async function requestExport(item, email, actualCount) {
  return dmListPost({
    type: "export_v2",
    select_all: 1,
    total_count: actualCount || item.estimatedCount || 0,
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
    export_file_name: String(item.title || "VestBlock DealMachine Contacts Export").slice(0, 150),
  })
}

function writeOutputs(result) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(OUT_DIR, `dealmachine-session-export-${stamp}.json`)
  const mdPath = path.join(OUT_DIR, `dealmachine-session-export-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2))

  const rows = result.results || []
  const requested = rows.filter((row) => row.requested).length
  const blocked = rows.filter((row) => row.exportBlocked).length
  const failed = rows.filter((row) => !row.requested && !row.dryRun && !row.exportBlocked).length
  const byStrategy = rows.reduce((acc, row) => {
    const key = row.strategyKey || "unknown"
    const current = acc[key] || { lists: 0, leads: 0, requested: 0 }
    current.lists += 1
    current.leads += Number(row.actualCount || row.estimatedCount || 0)
    if (row.requested) current.requested += 1
    acc[key] = current
    return acc
  }, {})

  fs.writeFileSync(
    mdPath,
    [
      "# DealMachine Session Contacts Export",
      "",
      `Created: ${result.finishedAt}`,
      `Mode: ${result.send ? "Export requested" : "Dry run"}`,
      `Email: ${result.email}`,
      `Lists: ${rows.length}`,
      `Requested: ${requested}`,
      `Blocked zero exportable contacts: ${blocked}`,
      `Failed: ${failed}`,
      "",
      "## By Strategy",
      "",
      ...Object.entries(byStrategy).map(([key, value]) => `- ${key}: ${value.requested}/${value.lists} exports, ${value.leads} exportable/contactable leads`),
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
      `JSON: ${path.relative(ROOT, jsonPath)}`,
    ].join("\n"),
  )
  return { jsonPath, mdPath }
}

async function main() {
  if (!TOKEN) {
    throw new Error("Missing DEALMACHINE_WEB_TOKEN. Open DealMachine once, copy localStorage token, and set DEALMACHINE_WEB_TOKEN in .env.local.")
  }
  const files = selectedFiles()
  const lists = loadBuiltLists(files)
  if (!lists.length) throw new Error("No saved DealMachine lists were found in the selected JSON files.")
  const email = getArg("email") || DEFAULT_EMAIL

  const results = []
  for (const item of lists) {
    const { response, result, actualCount } = await exportableCount(item)
    const row = {
      ...item,
      actualCount,
      actualCountStatus: response.status,
      countResult: result,
      requested: false,
    }
    if (!response.ok || Number(actualCount || 0) <= 0) {
      row.exportBlocked = true
      row.exportBlockReason = "blocked_zero_exportable_contacts"
      results.push(row)
      continue
    }
    if (!SEND) {
      row.dryRun = true
      results.push(row)
      continue
    }
    const exportResponse = await requestExport(item, email, actualCount)
    row.status = exportResponse.status
    row.response = exportResponse.data
    row.requested = exportResponse.ok && exportResponse.data?.error !== true
    results.push(row)
  }

  const result = {
    runId: RUN_ID,
    email,
    send: SEND,
    files: files.map((file) => path.relative(ROOT, file)),
    results,
    finishedAt: new Date().toISOString(),
  }
  const outputs = writeOutputs(result)
  console.log(JSON.stringify({
    runId: RUN_ID,
    send: SEND,
    lists: lists.length,
    requested: results.filter((row) => row.requested).length,
    blocked: results.filter((row) => row.exportBlocked).length,
    report: outputs.mdPath,
    json: outputs.jsonPath,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exit(1)
})
