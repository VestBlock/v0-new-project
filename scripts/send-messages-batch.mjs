#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const DEFAULT_QUEUE = path.resolve("data/distress-leads/dealmachine-export-phone-queue-2026-06-05T19-10-33-046Z.csv")
const RESULTS_DIR = path.resolve("tmp/outreach")

function parseArgs(argv) {
  const args = { queue: DEFAULT_QUEUE, limit: Infinity, delayMs: 900, send: false, dryRun: false, service: "sms" }
  for (const raw of argv) {
    if (raw.startsWith("--queue=")) args.queue = path.resolve(raw.slice(8))
    else if (raw.startsWith("--limit=")) args.limit = Number(raw.slice(8)) || Infinity
    else if (raw.startsWith("--delay-ms=")) args.delayMs = Number(raw.slice(11)) || 900
    else if (raw.startsWith("--service=")) args.service = raw.slice(10).toLowerCase()
    else if (raw === "--send") args.send = true
    else if (raw === "--dry-run") args.dryRun = true
  }
  if (!args.send) args.dryRun = true
  return args
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          value += "\""
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        value += ch
      }
      continue
    }
    if (ch === "\"") {
      inQuotes = true
    } else if (ch === ",") {
      row.push(value)
      value = ""
    } else if (ch === "\n") {
      row.push(value)
      rows.push(row)
      row = []
      value = ""
    } else if (ch !== "\r") {
      value += ch
    }
  }
  if (value.length || row.length) {
    row.push(value)
    rows.push(row)
  }
  const [header = [], ...body] = rows
  return body
    .filter((cols) => cols.some((cell) => cell !== ""))
    .map((cols) => Object.fromEntries(header.map((key, idx) => [key, cols[idx] ?? ""])))
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits ? `+${digits}` : ""
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function listPriorResults() {
  if (!fs.existsSync(RESULTS_DIR)) return []
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((name) => /^dealmachine-export-phone-send-results-.*\.json$/.test(name))
    .sort()
    .map((name) => path.join(RESULTS_DIR, name))
}

function loadAlreadySent() {
  const sent = new Set()
  for (const file of listPriorResults()) {
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"))
      for (const item of json.results || []) {
        if ((item.status === "verified" || item.status === "submitted") && item.phone && item.text_message) {
          sent.add(`${item.phone}::${item.text_message}`)
        }
      }
    } catch {}
  }
  return sent
}

function sendMessage(phone, message, servicePreference) {
  const script = `
on run argv
  set targetNumber to item 1 of argv
  set messageText to item 2 of argv
  set servicePreference to item 3 of argv
  tell application "Messages"
    set targetService to missing value
    if servicePreference is "sms" then
      try
        set targetService to 1st service whose service type = SMS and enabled = true
      end try
    end if
    if targetService is missing value then
      try
        set targetService to 1st service whose service type = iMessage and enabled = true
      end try
    end if
    if targetService is missing value and servicePreference is not "sms" then
      try
        set targetService to 1st service whose service type = SMS and enabled = true
      end try
    end if
    if targetService is missing value then error "No enabled Messages service available."
    set targetBuddy to buddy targetNumber of targetService
    send messageText to targetBuddy
    return "submitted via service id " & (id of targetService as text) & " (" & (service type of targetService as text) & ")"
  end tell
end run
`
  return execFileSync("osascript", ["-", phone, message, servicePreference], {
    input: script,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  }).trim()
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const queue = parseCsv(fs.readFileSync(args.queue, "utf8"))
  const alreadySent = loadAlreadySent()
  const candidates = queue
    .filter((row) => String(row.can_text).toLowerCase() === "true")
    .map((row) => ({
      ...row,
      phone: normalizePhone(row.phone),
      sent_key: `${normalizePhone(row.phone)}::${row.text_message}`,
    }))
    .filter((row) => row.phone && row.text_message && !alreadySent.has(row.sent_key))
    .slice(0, args.limit)

  const results = []
  console.log(`Queue file: ${args.queue}`)
  console.log(`Candidates selected: ${candidates.length}`)
  console.log(`Mode: ${args.dryRun ? "dry-run" : "send"}`)

  for (const row of candidates) {
    const record = {
      phone: row.phone,
      owner_name: row.owner_name,
      property_address_full: row.property_address_full,
      market: row.market,
      text_message: row.text_message,
      status: "pending",
      error: null,
      submit_result: null,
    }
    try {
      if (!args.dryRun) {
        record.submit_result = sendMessage(row.phone, row.text_message, args.service)
        sleep(args.delayMs)
      }
      record.status = args.dryRun ? "dry-run" : "submitted"
      console.log(`${record.status.toUpperCase()} ${row.phone} :: ${row.property_address_full}`)
    } catch (error) {
      record.status = "failed"
      record.error = error instanceof Error ? error.message : String(error)
      console.error(`FAILED ${row.phone} :: ${row.property_address_full} :: ${record.error}`)
    }
    results.push(record)
  }

  const outPath = path.join(RESULTS_DIR, `dealmachine-export-phone-send-results-${stamp}.json`)
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        queue: args.queue,
        send: !args.dryRun,
        service: args.service,
        selected: candidates.length,
        submitted: results.filter((row) => row.status === "submitted").length,
        verified: results.filter((row) => row.status === "verified").length,
        failed: results.filter((row) => row.status === "failed").length,
        results,
      },
      null,
      2,
    ),
  )
  console.log(`Results file: ${outPath}`)
}

main()
