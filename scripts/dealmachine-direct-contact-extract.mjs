/**
 * Extract owner-safe DealMachine contacts directly from saved website lists.
 *
 * Uses the logged-in Google Chrome DealMachine session. Raw contact CSVs are
 * written to data/dm-exports. Terminal output and markdown reports stay
 * count-based so we do not print owner emails/phones into chat logs.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync, spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const ROOT = process.cwd()
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const RUN_ID = `vb-dm-direct-contact-extract-${new Date().toISOString().replace(/[:.]/g, "-")}`
const STAGE = args.includes("--stage-command-center") || args.includes("--stage")

function getArg(name) {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

function parseList(value) {
  return String(value || "").split(/[|,;]/).map((x) => x.trim()).filter(Boolean)
}

function slug(value) {
  return String(value || "market").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "market"
}

function numberArg(name, fallback) {
  const parsed = Number.parseInt(getArg(name) || "", 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function defaultFiles() {
  if (!fs.existsSync(OUTREACH_DIR)) return []
  return fs.readdirSync(OUTREACH_DIR)
    .filter((name) => /^dealmachine-(upgrade-list-builder|website-list-builder)-.*\.json$/i.test(name))
    .map((name) => path.join(OUTREACH_DIR, name))
    .sort()
    .slice(-1)
}

function selectedFiles() {
  const files = parseList(getArg("files") || getArg("file") || "")
  return files.length ? files.map((file) => path.isAbsolute(file) ? file : path.join(ROOT, file)) : defaultFiles()
}

function loadBuiltLists(files) {
  const seen = new Set()
  const lists = []
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    for (const row of parsed.built || parsed.builtLists || []) {
      const list = row.list || {}
      const listId = list.id || list.value || row.listId || row.id
      if (!listId || seen.has(String(listId))) continue
      seen.add(String(listId))
      const market = row.market || [row.city, row.state].filter(Boolean).join(", ") || "unknown market"
      const strategyKey = slug(row.strategyKey || row.strategy || "seller-options")
      lists.push({
        sourceFile: path.relative(ROOT, file),
        listId: String(listId),
        title: row.title || list.title || list.label || `VestBlock DealMachine List ${listId}`,
        market,
        marketSlug: slug(market),
        strategyKey,
        strategy: row.strategy || row.strategyKey || strategyKey,
        variant: row.variant || "",
        estimatedCount: Number(row.count || list.estimated_count || list.lead_count || 0),
      })
    }
  }
  return lists
}

function explicitLists() {
  return parseList(getArg("list-ids") || getArg("list-id") || "").map((listId) => {
    const market = getArg("market") || "manual market"
    return {
      sourceFile: "manual",
      listId: String(listId),
      title: `Manual DealMachine List ${listId}`,
      market,
      marketSlug: slug(market),
      strategyKey: slug(getArg("strategy") || "seller-options"),
      strategy: getArg("strategy") || "seller-options",
      variant: "",
      estimatedCount: 0,
    }
  })
}

function chromeJavascript(source, timeoutMs = 20000) {
  const jsPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.js`)
  const osaPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.applescript`)
  fs.writeFileSync(jsPath, source)
  fs.writeFileSync(osaPath, [
    "on run argv",
    "  set jsPath to item 1 of argv",
    "  set jsSource to read POSIX file jsPath as «class utf8»",
    "  tell application \"Google Chrome\"",
    "    if (count windows) is 0 then error \"Google Chrome is not open\"",
    "    tell active tab of front window to execute javascript jsSource",
    "  end tell",
    "end run",
  ].join("\n"))
  try {
    return execFileSync("osascript", [osaPath, jsPath], { encoding: "utf8", timeout: timeoutMs, maxBuffer: 80 * 1024 * 1024 }).trim()
  } finally {
    fs.rmSync(jsPath, { force: true })
    fs.rmSync(osaPath, { force: true })
  }
}

function browserPayload(lists, limit, pageSize, requestTimeoutMs) {
  return `(() => {
  const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
  const runId = ${JSON.stringify(RUN_ID)}
  const token = localStorage.getItem("token")
  const lists = ${JSON.stringify(lists)}
  const limit = ${JSON.stringify(limit)}
  const pageSize = ${JSON.stringify(pageSize)}
  const requestTimeoutMs = ${JSON.stringify(requestTimeoutMs)}
  const personFlags = (contact) => (contact?.person_flags || []).map((flag) => String(flag?.value || "").trim().toLowerCase()).filter(Boolean)
  const ownerSafe = (contact) => {
    const matchingType = String(contact?.matching_type || "").trim().toLowerCase()
    const flags = personFlags(contact)
    if (contact?.likely_owner) return true
    if (matchingType === "mailing_address") return true
    if (matchingType === "company_tiebreaker") return true
    if (contact?.in_owner_family && !contact?.resident && !flags.includes("renter")) return true
    if (flags.includes("property_owner") && !contact?.resident && !flags.includes("renter")) return true
    return false
  }
  const withTimeout = async (url, options = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = { parseError: text.slice(0, 300) } }
      return { status: response.status, ok: response.ok, data }
    } finally {
      clearTimeout(timer)
    }
  }
  const apiList = (body) => withTimeout("https://api.dealmachine.com/v2/list/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-DM-Client-Key": DM_CLIENT_KEY },
    body: JSON.stringify({ token, ...body })
  })
  const apiProperty = (dealId) => {
    const url = new URL("https://api.dealmachine.com/v2/property/")
    url.searchParams.set("token", token)
    url.searchParams.set("deal_id", dealId)
    return withTimeout(url.toString(), { headers: { "Accept": "application/json", "X-DM-Client-Key": DM_CLIENT_KEY } })
  }
  const propertyFrom = (data) => data?.results?.property || data?.property || data?.results || data || {}
  const normPhoneType = (value) => String(value || "").trim().toUpperCase() === "W" ? "Wireless" : String(value || "").trim()
  const unique = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
  const boolText = (value) => value ? "true" : "false"
  const contactRow = (item, listRow, property, contact) => {
    const propertyAddress = property?.property_address_full || listRow?.property_address_full || [property?.property_address, property?.property_address_city, property?.property_address_state, property?.property_address_zip].filter(Boolean).join(", ")
    return {
      contact_id: String(contact?.individual_key || contact?.owner_hash || ""),
      associated_property_address_full: propertyAddress,
      property_address_full: propertyAddress,
      property_address: property?.property_address || listRow?.property_address || "",
      property_city: property?.property_address_city || listRow?.property_address_city || "",
      property_state: property?.property_address_state || listRow?.property_address_state || "",
      property_zip: property?.property_address_zip || listRow?.property_address_zip || "",
      first_name: String(contact?.given_name || "").trim(),
      last_name: String(contact?.surname || "").trim(),
      primary_mailing_address: String(contact?.primary_address || property?.owner_address || "").trim(),
      primary_mailing_city: String(contact?.primary_city || property?.owner_address_city || "").trim(),
      primary_mailing_state: String(contact?.primary_state || property?.owner_address_state || "").trim(),
      primary_mailing_zip: String(contact?.primary_zip || property?.owner_address_zip || "").trim(),
      contact_flags: unique(personFlags(contact)).join("|"),
      email_address_1: String(contact?.email_address_1 || "").trim(),
      email_address_2: String(contact?.email_address_2 || "").trim(),
      email_address_3: String(contact?.email_address_3 || "").trim(),
      phone_1: String(contact?.phone_1 || "").trim(),
      phone_1_do_not_call: contact?.phone_1_do_not_call ? "DO NOT CALL" : "",
      phone_1_activity_status: String(contact?.phone_1_activity_status || contact?.phone_1_status || "").trim(),
      phone_1_type: normPhoneType(contact?.phone_1_type),
      phone_2: String(contact?.phone_2 || "").trim(),
      phone_2_do_not_call: contact?.phone_2_do_not_call ? "DO NOT CALL" : "",
      phone_2_activity_status: String(contact?.phone_2_activity_status || contact?.phone_2_status || "").trim(),
      phone_2_type: normPhoneType(contact?.phone_2_type),
      phone_3: String(contact?.phone_3 || "").trim(),
      phone_3_do_not_call: contact?.phone_3_do_not_call ? "DO NOT CALL" : "",
      phone_3_activity_status: String(contact?.phone_3_activity_status || contact?.phone_3_status || "").trim(),
      phone_3_type: normPhoneType(contact?.phone_3_type),
      full_name: String(contact?.full_name || [contact?.given_name, contact?.surname].filter(Boolean).join(" ")).trim(),
      owner_name: property?.owner_name || listRow?.owner_name || "",
      contact_full_name: String(contact?.full_name || [contact?.given_name, contact?.surname].filter(Boolean).join(" ")).trim(),
      matching_type: String(contact?.matching_type || "").trim(),
      likely_owner: boolText(contact?.likely_owner),
      resident: boolText(contact?.resident),
      in_owner_family: boolText(contact?.in_owner_family),
      out_of_state_owner: boolText(property?.absentee_owner || property?.out_of_state_owner || listRow?.absentee_owner),
      estimated_value: String(property?.estimated_value || property?.avm || listRow?.estimated_value || "").trim(),
      equity_amount: String(property?.equity_amount || listRow?.equity_amount || "").trim(),
      equity_percent: String(property?.equity_percent || listRow?.equity_percent || "").trim(),
      property_type: String(property?.property_type || listRow?.property_type || "").trim(),
      property_use: String(property?.property_use || listRow?.property_use || "").trim(),
      units: String(property?.units || listRow?.units || "").trim(),
      is_vacant: boolText(property?.vacant || listRow?.vacant),
      tax_delinquent: boolText(property?.tax_delinquent || listRow?.tax_delinquent),
      market_status: String(property?.mls_status || listRow?.mls_status || "").trim(),
      dealmachine_id: String(listRow?.deal_id || property?.deal_id || "").trim(),
      lead_id: String(listRow?.id || property?.id || "").trim(),
      source_list_id: String(item.listId),
      source_strategy: item.strategyKey || item.strategy || "seller-options",
      source_variant: item.variant || "",
      date_created: String(property?.date_created || listRow?.date_created || "").trim(),
      date_updated: String(property?.date_updated || listRow?.date_updated || "").trim(),
    }
  }
  const summarize = (contacts) => {
    const emails = new Set()
    const phones = new Set()
    let dncPhoneFlags = 0
    for (const contact of contacts) {
      for (const key of ["email_address_1", "email_address_2", "email_address_3"]) if (contact[key]) emails.add(String(contact[key]).toLowerCase())
      for (const key of ["phone_1", "phone_2", "phone_3"]) if (contact[key]) phones.add(String(contact[key]).replace(/\D/g, ""))
      for (const key of ["phone_1_do_not_call", "phone_2_do_not_call", "phone_3_do_not_call"]) if (contact[key]) dncPhoneFlags++
    }
    return { contacts: contacts.length, uniqueEmails: emails.size, uniquePhones: phones.size, dncPhoneFlags }
  }
  window.vbDmDirectContactExtract = { done: false, runId, startedAt: new Date().toISOString(), listsChecked: 0, results: [] }
  ;(async () => {
    if (!token) throw new Error("DealMachine token was not found. Open app.dealmachine.com/map and log in.")
    const results = []
    for (const item of lists) {
      const result = { ...item, rowCount: 0, propertyOk: 0, contacts: [], errors: [] }
      try {
        const listResponse = await apiList({ type: "list", list_id: item.listId, page: 1, limit: pageSize })
        const rows = listResponse.data?.results?.properties || []
        result.rowCount = rows.length
        for (const listRow of rows.filter((row) => row?.deal_id).slice(0, limit)) {
          try {
            const propertyResponse = await apiProperty(listRow.deal_id)
            const property = propertyFrom(propertyResponse.data)
            if (propertyResponse.ok) result.propertyOk++
            const phoneEntries = Array.isArray(property?.phone_numbers) ? property.phone_numbers : []
            for (const entry of phoneEntries) {
              const contact = entry?.contact
              if (contact && ownerSafe(contact)) result.contacts.push(contactRow(item, listRow, property, contact))
            }
          } catch (error) {
            result.errors.push(String(error).slice(0, 180))
          }
        }
      } catch (error) {
        result.errors.push(String(error).slice(0, 180))
      }
      result.summary = summarize(result.contacts)
      results.push(result)
      window.vbDmDirectContactExtract = { ...window.vbDmDirectContactExtract, listsChecked: results.length, currentList: item.listId, results }
    }
    window.vbDmDirectContactExtract = { done: true, runId, startedAt: window.vbDmDirectContactExtract.startedAt, finishedAt: new Date().toISOString(), hasToken: Boolean(token), listsChecked: results.length, results }
  })().catch((error) => {
    window.vbDmDirectContactExtract = { done: true, runId, startedAt: window.vbDmDirectContactExtract.startedAt, finishedAt: new Date().toISOString(), error: String(error), listsChecked: (window.vbDmDirectContactExtract.results || []).length, results: window.vbDmDirectContactExtract.results || [] }
  })
  return "started"
})()`
}

function waitForExtract(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastChecked = -1
  while (Date.now() < deadline) {
    const raw = chromeJavascript("JSON.stringify(window.vbDmDirectContactExtract || { done: false, listsChecked: 0 })", 12000)
    const parsed = raw ? JSON.parse(raw) : { done: false, listsChecked: 0 }
    if (parsed.listsChecked !== lastChecked) {
      lastChecked = parsed.listsChecked
      console.error(`[DealMachine direct extract] progress ${lastChecked}${parsed.done ? " done" : ""}`)
    }
    if (parsed.done) return parsed
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500)
  }
  const raw = chromeJavascript("JSON.stringify(window.vbDmDirectContactExtract || { done: false, listsChecked: 0, results: [] })", 12000)
  const partial = raw ? JSON.parse(raw) : { done: false, results: [] }
  partial.error = partial.error || `Timed out after ${timeoutMs}ms waiting for DealMachine direct contact extraction`
  return partial
}

const CSV_COLUMNS = [
  "contact_id", "associated_property_address_full", "property_address_full", "property_address", "property_city", "property_state", "property_zip",
  "first_name", "last_name", "primary_mailing_address", "primary_mailing_city", "primary_mailing_state", "primary_mailing_zip", "contact_flags",
  "email_address_1", "email_address_2", "email_address_3",
  "phone_1", "phone_1_do_not_call", "phone_1_activity_status", "phone_1_type",
  "phone_2", "phone_2_do_not_call", "phone_2_activity_status", "phone_2_type",
  "phone_3", "phone_3_do_not_call", "phone_3_activity_status", "phone_3_type",
  "full_name", "owner_name", "contact_full_name", "matching_type", "likely_owner", "resident", "in_owner_family", "out_of_state_owner",
  "estimated_value", "equity_amount", "equity_percent", "property_type", "property_use", "units", "is_vacant", "tax_delinquent", "market_status",
  "dealmachine_id", "lead_id", "source_list_id", "source_strategy", "source_variant", "date_created", "date_updated",
]

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, )}"`
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, [CSV_COLUMNS.join(","), ...rows.map((row) => CSV_COLUMNS.map((col) => csvCell(row[col])).join(","))].join("\n") + "\n")
}

function runStage(output) {
  const result = spawnSync("node", [
    "--env-file=.env.local",
    "scripts/dealmachine-export-outreach.mjs",
    `--market=${output.marketSlug}`,
    `--strategy=${output.strategyKey}`,
    `--export-csv=${output.absoluteCsvPath}`,
    "--export-only",
    "--stage-command-center",
    "--limit=30",
  ], { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  return { ok: result.status === 0, status: result.status, stdoutTail: String(result.stdout || "").split("\n").slice(-20).join("\n"), stderrTail: String(result.stderr || "").split("\n").slice(-12).join("\n") }
}

function writeReports(report, outputs) {
  const jsonPath = path.join(OUTREACH_DIR, `${RUN_ID}.json`)
  const mdPath = path.join(OUTREACH_DIR, `${RUN_ID}.md`)
  const slim = {
    runId: report.runId,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    hasToken: report.hasToken,
    error: report.error || null,
    outputs: outputs.map(({ absoluteCsvPath, ...row }) => row),
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(slim, null, 2)}\n`)
  const lines = [
    "# DealMachine Direct Contact Extract",
    "",
    `Run ID: ${report.runId || RUN_ID}`,
    `Finished: ${report.finishedAt || ""}`,
    report.error ? `Error: ${report.error}` : "",
    "",
    "| List | Market | Strategy | Rows pulled | Properties OK | Contacts | Emails | Phones | DNC flags | CSV | Staged |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---|---|",
  ].filter(Boolean)
  for (const out of outputs) {
    lines.push(`| ${out.listId} | ${out.market} | ${out.strategyKey} | ${out.rowCount} | ${out.propertyOk} | ${out.contacts} | ${out.uniqueEmails} | ${out.uniquePhones} | ${out.dncPhoneFlags} | ${out.csvPath} | ${out.stage?.ok ? "yes" : out.stage ? "failed" : "not requested"} |`)
  }
  lines.push("", "Raw contact CSVs are written under data/dm-exports for VestBlock ingestion. This report does not include raw contact values.")
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`)
  return { jsonPath, mdPath }
}

fs.mkdirSync(OUTREACH_DIR, { recursive: true })
fs.mkdirSync(DM_EXPORT_DIR, { recursive: true })

const manualLists = explicitLists()
const lists = manualLists.length ? manualLists : loadBuiltLists(selectedFiles())
if (!lists.length) throw new Error("No DealMachine saved lists found. Pass --list-ids=... or --files=...")
const limit = numberArg("limit", 30)
const pageSize = Math.max(limit, numberArg("page-size", 30))
const requestTimeoutMs = numberArg("request-timeout-ms", 15000)
const timeoutMs = numberArg("timeout-ms", Math.max(120000, lists.length * limit * 3500))

console.error(`[DealMachine direct extract] starting ${lists.length} lists, limit ${limit}, pageSize ${pageSize}`)
chromeJavascript(browserPayload(lists, limit, pageSize, requestTimeoutMs), 20000)
const report = waitForExtract(timeoutMs)

const outputs = []
for (const row of report.results || []) {
  const contacts = row.contacts || []
  const fileBase = `direct-${row.marketSlug || slug(row.market)}-${row.strategyKey || "seller-options"}-${row.listId}-${RUN_ID}.csv`
  const csvPath = path.join(DM_EXPORT_DIR, fileBase)
  writeCsv(csvPath, contacts)
  const output = {
    listId: row.listId,
    market: row.market,
    marketSlug: row.marketSlug || slug(row.market),
    strategyKey: row.strategyKey || "seller-options",
    rowCount: row.rowCount || 0,
    propertyOk: row.propertyOk || 0,
    contacts: contacts.length,
    uniqueEmails: row.summary?.uniqueEmails || 0,
    uniquePhones: row.summary?.uniquePhones || 0,
    dncPhoneFlags: row.summary?.dncPhoneFlags || 0,
    errors: row.errors?.length || 0,
    csvPath: path.relative(ROOT, csvPath),
    absoluteCsvPath: csvPath,
  }
  if (STAGE && contacts.length) output.stage = runStage(output)
  outputs.push(output)
}

const reports = writeReports(report, outputs)
console.log(JSON.stringify({
  runId: RUN_ID,
  lists: outputs.length,
  contacts: outputs.reduce((sum, row) => sum + row.contacts, 0),
  uniqueEmails: outputs.reduce((sum, row) => sum + row.uniqueEmails, 0),
  uniquePhones: outputs.reduce((sum, row) => sum + row.uniquePhones, 0),
  dncPhoneFlags: outputs.reduce((sum, row) => sum + row.dncPhoneFlags, 0),
  stagedOk: outputs.filter((row) => row.stage?.ok).length,
  stagedFailed: outputs.filter((row) => row.stage && !row.stage.ok).length,
  reports: { json: path.relative(ROOT, reports.jsonPath), md: path.relative(ROOT, reports.mdPath) },
  csvs: outputs.map((row) => row.csvPath),
}, null, 2))
