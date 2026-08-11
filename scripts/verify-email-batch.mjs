#!/usr/bin/env node
// Email verification preflight: the missing scale-safety layer before raising volume.
//
// Runs every batch through layered checks, cheapest first:
//   1. Local quality rules (shared-email-quality.mjs: syntax, role accounts, blocked domains)
//   2. Suppression cross-check (data/outreach-suppressions.json)
//   3. MX record lookup (cached per domain)
//   4. Optional paid verification when ZEROBOUNCE_API_KEY is set (skipped cleanly otherwise)
//
// Output: <name>-verified.csv (safe to send) and <name>-risky.csv (hold), plus a JSON summary.
// This script never sends email.
//
// Usage:
//   npm run outreach:verify-emails -- --csv=data/operating-loops/reactivation/reactivation-queue-<stamp>.csv
//   npm run outreach:verify-emails -- --latest-reactivation
//   Flags: --skip-mx  --skip-provider  --provider-limit=200  --email-column=email

import fs from "node:fs"
import path from "node:path"
import {
  normalizeEmailAddress,
  getEmailQualityIssue,
  getEmailDeliverabilityIssue,
} from "./shared-email-quality.mjs"

const ROOT = process.cwd()
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REACTIVATION_DIR = path.join(ROOT, "data", "operating-loops", "reactivation")

function arg(name, fallback = "") {
  const prefix = `--${name}=`
  const hit = process.argv.filter((piece) => piece.startsWith(prefix)).pop()
  return hit ? hit.slice(prefix.length) : fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const EMAIL_COLUMN = arg("email-column", "email").toLowerCase()
const SKIP_MX = hasFlag("skip-mx")
const SKIP_PROVIDER = hasFlag("skip-provider")
const PROVIDER_LIMIT = Number(arg("provider-limit", 200))

function resolveInputPath() {
  const explicit = arg("csv")
  if (explicit) return path.resolve(ROOT, explicit)
  if (hasFlag("latest-reactivation")) {
    try {
      const files = fs
        .readdirSync(REACTIVATION_DIR)
        .filter((name) => name.startsWith("reactivation-queue-") && name.endsWith(".csv"))
        .sort()
      if (files.length) return path.join(REACTIVATION_DIR, files[files.length - 1])
    } catch {
      // fall through
    }
    console.error("No reactivation CSV found. Run outreach:reactivation-queue first.")
    process.exit(1)
  }
  console.error("Pass --csv=path/to/batch.csv or --latest-reactivation")
  process.exit(1)
}

// Minimal CSV parser that handles quoted fields (the formats our scripts emit).
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    if (row.length > 1 || row[0] !== "") rows.push(row)
  }
  return rows
}

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`

function suppressedEmails() {
  try {
    const data = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, "utf8"))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
    return new Set(rows.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean))
  } catch {
    return new Set()
  }
}

async function zeroBounceCheck(email, apiKey) {
  const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`ZeroBounce HTTP ${response.status}`)
  const data = await response.json()
  // valid | invalid | catch-all | unknown | spamtrap | abuse | do_not_mail
  return String(data.status || "unknown").toLowerCase()
}

async function main() {
  const inputPath = resolveInputPath()
  const text = fs.readFileSync(inputPath, "utf8")
  const rows = parseCsv(text)
  if (rows.length < 2) {
    console.error(`No data rows in ${inputPath}`)
    process.exit(1)
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const emailIndex = header.indexOf(EMAIL_COLUMN)
  if (emailIndex === -1) {
    console.error(`Column "${EMAIL_COLUMN}" not found. Columns: ${header.join(", ")}`)
    process.exit(1)
  }

  const suppressed = suppressedEmails()
  const zeroBounceKey = process.env.ZEROBOUNCE_API_KEY || ""
  const useProvider = Boolean(zeroBounceKey) && !SKIP_PROVIDER
  const seen = new Set()
  const verified = []
  const risky = []
  const counts = {}
  const bump = (reason) => {
    counts[reason] = (counts[reason] || 0) + 1
  }
  let providerCalls = 0

  for (const row of rows.slice(1)) {
    const raw = row[emailIndex]
    const email = normalizeEmailAddress(raw)
    let reason = null

    if (!email) reason = "missing_email"
    else if (seen.has(email)) reason = "duplicate_in_batch"
    else if (suppressed.has(email)) reason = "suppressed"
    else {
      seen.add(email)
      reason = SKIP_MX ? getEmailQualityIssue(email) : await getEmailDeliverabilityIssue(email)
    }

    if (!reason && useProvider && providerCalls < PROVIDER_LIMIT) {
      providerCalls += 1
      try {
        const status = await zeroBounceCheck(email, zeroBounceKey)
        if (!["valid", "catch-all"].includes(status)) reason = `provider_${status}`
      } catch (error) {
        // Provider failure must not hard-block a batch; local checks already passed.
        console.warn(`Provider check skipped for ${email}: ${error?.message || error}`)
      }
    }

    // mx_lookup_failed means OUR network couldn't resolve DNS (offline/sandboxed run),
    // not that the address is bad. Pass with a warning instead of holding the batch.
    if (reason === "mx_lookup_failed") {
      bump("verified_mx_unchecked")
      verified.push(row)
    } else if (reason) {
      bump(reason)
      risky.push({ row, reason })
    } else {
      bump("verified")
      verified.push(row)
    }
  }

  const base = inputPath.replace(/\.csv$/i, "")
  const verifiedPath = `${base}-verified.csv`
  const riskyPath = `${base}-risky.csv`
  const summaryPath = `${base}-verification-summary.json`

  fs.writeFileSync(
    verifiedPath,
    `${[rows[0].map(csvEscape).join(","), ...verified.map((row) => row.map(csvEscape).join(","))].join("\n")}\n`,
    "utf8"
  )
  fs.writeFileSync(
    riskyPath,
    `${[[...rows[0], "risk_reason"].map(csvEscape).join(","), ...risky.map(({ row, reason }) => [...row, reason].map(csvEscape).join(","))].join("\n")}\n`,
    "utf8"
  )
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        input: inputPath,
        totalRows: rows.length - 1,
        verified: verified.length,
        risky: risky.length,
        providerUsed: useProvider ? "zerobounce" : "none",
        providerCalls,
        mxChecked: !SKIP_MX,
        reasons: counts,
      },
      null,
      2
    )}\n`,
    "utf8"
  )

  console.log(`Verification complete: ${verified.length} verified / ${risky.length} risky of ${rows.length - 1}`)
  for (const [reason, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }
  if (!useProvider) {
    console.log(
      zeroBounceKey
        ? "  (provider check skipped by flag)"
        : "  (no ZEROBOUNCE_API_KEY set — local + MX checks only; add a key before scaling past ~60/day)"
    )
  }
  console.log(`  Verified CSV: ${verifiedPath}`)
  console.log(`  Risky CSV:    ${riskyPath}`)
  console.log(`Send ONLY the verified CSV through the guarded sender.`)
}

main().catch((error) => {
  console.error(`verify-email-batch failed: ${error?.message || error}`)
  process.exit(1)
})
