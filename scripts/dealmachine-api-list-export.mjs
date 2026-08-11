/**
 * DealMachine direct list export runner.
 *
 * Uses DealMachine's documented v2 API surface to:
 * - create a list from DealMachine record IDs
 * - export that list with a property or person anchor
 * - download completed export URLs into data/dm-exports/incoming
 *
 * The current legacy public v1 key can harvest leads but cannot call this API.
 * This script fails clearly until DEALMACHINE_API_KEY or DEALMACHINE_V2_API_KEY
 * is a dm_sk_live... API key or dm_at_live... OAuth token with list/export scopes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-api-list-export.mjs --queue-csv=data/distress-leads/dealmachine-api-rochester-ny-preforeclosure-saveable-stack.csv
 *   node --env-file=.env.local scripts/dealmachine-api-list-export.mjs --from-latest-request --max-lists=5
 */

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(`--${name}`)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const ROOT = process.cwd()
const API_BASE = "https://api.v2.dealmachine.com/v1"
const TOKEN = String(process.env.DEALMACHINE_V2_API_KEY || process.env.DEALMACHINE_API_KEY || "").trim()
const QUEUE_CSV = getArg("queue-csv")
const FROM_LATEST_REQUEST = hasFlag("from-latest-request")
const ANCHOR = getArg("anchor") || "person"
const MAX_LISTS = getArg("max-lists") ? Number.parseInt(getArg("max-lists"), 10) : 10
const BATCH_SIZE = Math.min(getArg("batch-size") ? Number.parseInt(getArg("batch-size"), 10) : 250, 250)
const POLL_SECONDS = getArg("poll-seconds") ? Number.parseInt(getArg("poll-seconds"), 10) : 8
const MAX_POLLS = getArg("max-polls") ? Number.parseInt(getArg("max-polls"), 10) : 45
const INGEST = hasFlag("ingest")
const APPLY = hasFlag("apply")

const DISTRESS_DIR = path.join(ROOT, "data", "distress-leads")
const INCOMING_DIR = path.join(ROOT, "data", "dm-exports", "incoming")
const OUT_DIR = path.join(ROOT, "data", "operating-loops")
const SUMMARY_FILE = path.join(OUT_DIR, "dealmachine-api-list-export-summary.json")

const EXPORT_FIELDS = [
  "property_address_full",
  "property_address_city",
  "property_address_state",
  "property_address_zip",
  "property_type",
  "estimated_value",
  "equity_amount",
  "equity_percent",
  "owner_full_name",
  "owner_first_name",
  "owner_last_name",
  "owner_mailing_address_full",
  "owner_mailing_address_city",
  "owner_mailing_address_state",
  "owner_mailing_address_zip",
  "email",
  "emails",
  "phone",
  "phones",
  "phone_type",
  "dnc",
  "tags",
  "lists",
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (ch !== "\r") {
      cell += ch
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [header = [], ...body] = rows
  return body
    .filter((line) => line.some((value) => String(value || "").trim()))
    .map((line) => Object.fromEntries(header.map((col, index) => [String(col || "").trim(), line[index] || ""])))
}

function first(row, names) {
  for (const name of names) {
    const exact = row[name]
    if (exact != null && String(exact).trim()) return String(exact).trim()
    const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
    if (key && String(row[key] || "").trim()) return String(row[key]).trim()
  }
  return ""
}

function readRows(file) {
  return parseCsvText(fs.readFileSync(file, "utf8"))
}

function newestFile(dir, prefix, suffix = ".json") {
  if (!fs.existsSync(dir)) return null
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({ name, file: path.join(dir, name), mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

function loadLatestRequestFiles() {
  const latest = newestFile(DISTRESS_DIR, "dealmachine-contact-export-request-summary-")
  if (!latest) return []
  const summary = JSON.parse(fs.readFileSync(latest.file, "utf8"))
  return (summary.listPackages || [])
    .map((item) => ({
      file: path.resolve(ROOT, item.file || ""),
      listName: item.listName || `${item.strategyKey || "vestblock"} ${item.market || "market"}`,
      strategyKey: item.strategyKey || "",
      market: item.market || "",
    }))
    .filter((item) => item.file && fs.existsSync(item.file))
}

function buildQueueInputs() {
  if (QUEUE_CSV) {
    const file = path.resolve(ROOT, QUEUE_CSV)
    return [{
      file,
      listName: `VestBlock ${normalizeSlug(path.basename(file, ".csv"))}`,
      strategyKey: "",
      market: "",
    }]
  }
  if (FROM_LATEST_REQUEST) return loadLatestRequestFiles()
  throw new Error("Pass --queue-csv=... or --from-latest-request.")
}

function collectRecordIds(file) {
  const rows = readRows(file)
  const ids = []
  const seen = new Set()
  for (const row of rows) {
    const id = first(row, ["dealmachine_id", "lead_id", "property_id", "record_id", "id"])
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function assertV2Token() {
  if (!TOKEN) throw new Error("Missing DEALMACHINE_API_KEY or DEALMACHINE_V2_API_KEY.")
  if (!/^(dm_sk|dm_at)_(live|test)_/i.test(TOKEN)) {
    throw new Error("Configured DealMachine key is a public v1 harvest key. Direct API list exports require a dm_sk_live... API key or dm_at_live... OAuth token.")
  }
}

async function dmFetch(pathname, options = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { message: text }
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || body?.detail || `${res.status} ${res.statusText}`
    throw new Error(`${pathname} failed: ${msg}`)
  }
  return body
}

function pickId(body, keys) {
  for (const key of keys) {
    if (body?.[key]) return String(body[key])
    if (body?.data?.[key]) return String(body.data[key])
  }
  return ""
}

async function createList({ name, recordIds }) {
  const body = await dmFetch("/lists", {
    method: "POST",
    body: JSON.stringify({
      name,
      record_ids: recordIds,
    }),
  })
  const listId = pickId(body, ["id", "list_id"])
  if (!listId) throw new Error(`Create list returned no list id for ${name}.`)
  return { listId, body }
}

async function waitForList(listId) {
  let last = null
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const body = await dmFetch(`/lists/${encodeURIComponent(listId)}`)
    last = body
    const status = String(body?.status || body?.data?.status || "").toLowerCase()
    if (!status || ["completed", "complete", "ready"].includes(status)) return body
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(`List ${listId} ended with status ${status}.`)
    }
    await sleep(POLL_SECONDS * 1000)
  }
  throw new Error(`Timed out waiting for list ${listId}. Last status: ${last?.status || last?.data?.status || "unknown"}`)
}

async function requestExport(listId) {
  const body = await dmFetch(`/lists/${encodeURIComponent(listId)}/export`, {
    method: "POST",
    body: JSON.stringify({
      anchor: ANCHOR,
      fields: EXPORT_FIELDS,
    }),
  })
  const exportId = pickId(body, ["id", "export_id"])
  if (!exportId) throw new Error(`Export request returned no export id for list ${listId}.`)
  return { exportId, body }
}

function getDownloadUrls(body) {
  const value = body?.download_urls || body?.data?.download_urls || body?.download_url || body?.data?.download_url
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (value) return [String(value)]
  return []
}

async function waitForExport(exportId) {
  let last = null
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const body = await dmFetch(`/exports/${encodeURIComponent(exportId)}`)
    last = body
    const status = String(body?.status || body?.data?.status || "").toLowerCase()
    const urls = getDownloadUrls(body)
    if (urls.length && (!status || ["completed", "complete", "ready"].includes(status))) return { body, urls }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(`Export ${exportId} ended with status ${status}.`)
    }
    await sleep(POLL_SECONDS * 1000)
  }
  throw new Error(`Timed out waiting for export ${exportId}. Last status: ${last?.status || last?.data?.status || "unknown"}`)
}

async function download(url, destination) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destination, buffer)
  return destination
}

function chunk(values, size) {
  const out = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

function ingest(file) {
  const command = ["scripts/dealmachine-ingest-export.mjs", `--file=${file}`, "--split-by-market"]
  if (APPLY) command.push("--apply")
  return execFileSync("node", command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

async function main() {
  assertV2Token()
  fs.mkdirSync(INCOMING_DIR, { recursive: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const inputs = buildQueueInputs().slice(0, MAX_LISTS)
  const actions = []

  for (const input of inputs) {
    const recordIds = collectRecordIds(input.file)
    if (!recordIds.length) {
      actions.push({ inputFile: input.file, status: "skipped", reason: "no_record_ids" })
      continue
    }

    const batches = chunk(recordIds, BATCH_SIZE)
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index]
      const listName = `${input.listName} ${batches.length > 1 ? `batch ${index + 1}` : ""}`.trim().slice(0, 120)
      const created = await createList({ name: listName, recordIds: batch })
      await waitForList(created.listId)
      const requested = await requestExport(created.listId)
      const completed = await waitForExport(requested.exportId)

      const downloaded = []
      for (let urlIndex = 0; urlIndex < completed.urls.length; urlIndex += 1) {
        const suffix = completed.urls[urlIndex].split("?")[0].split(".").pop() || "csv"
        const dest = path.join(
          INCOMING_DIR,
          `${normalizeSlug(listName)}-${requested.exportId}-${urlIndex + 1}.${suffix}`,
        )
        downloaded.push(await download(completed.urls[urlIndex], dest))
      }

      const ingested = []
      if (INGEST) {
        for (const file of downloaded) ingested.push({ file, output: ingest(file) })
      }

      actions.push({
        inputFile: input.file,
        status: "exported",
        listName,
        listId: created.listId,
        exportId: requested.exportId,
        recordCount: batch.length,
        downloaded,
        ingested: ingested.map((row) => row.file),
      })
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    anchor: ANCHOR,
    ingest: INGEST,
    apply: APPLY,
    actions,
  }
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exit(1)
})
