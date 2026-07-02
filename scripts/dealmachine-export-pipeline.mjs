#!/usr/bin/env node
// DealMachine export pipeline: lane build -> export request -> email watch -> CSV on disk.
//
// Chains the three existing scripts so nobody has to babysit the handoffs:
//   1. dealmachine-website-list-builder.mjs  (builds today's lane lists via web token)
//   2. dealmachine-export-lists.mjs --send    (asks DealMachine to email the Contacts export)
//   3. dealmachine-export-download.mjs        (polls Gmail, follows the link, saves + ingests CSV)
//
// Lanes come from the latest autopilot morning brief (laneFill.buildToday), so the
// daily flow is: npm run outreach:autopilot  ->  npm run outreach:export-pipeline
//
// One-time prerequisite: GOOGLE_REFRESH_TOKEN must include gmail.readonly scope.
// If the preflight fails, run:
//   node --env-file=.env.local scripts/dealmachine-export-download.mjs --auth-url
//   node --env-file=.env.local scripts/dealmachine-export-download.mjs --exchange-code=<code> --write-env
//
// Usage:
//   npm run outreach:export-pipeline                     # build + request + wait + download
//   npm run outreach:export-pipeline -- --skip-build     # only request/download for already-built lists
//   npm run outreach:export-pipeline -- --poll-minutes=30 --dry-run

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = process.cwd()
const BRIEF_PATH = path.join(ROOT, "data", "operating-loops", "morning-brief-latest.json")
const BUILDER_OUT_DIR = path.join(ROOT, "tmp", "outreach")
const EXPORT_DIR = path.join(ROOT, "data", "dm-exports")

const args = process.argv.slice(2)
const has = (flag) => args.includes(`--${flag}`)
const arg = (name, fallback = "") => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const DRY_RUN = has("dry-run")
const SKIP_BUILD = has("skip-build")
const FORCE = has("force")
const POLL_MINUTES = Number(arg("poll-minutes", 20))
const POLL_INTERVAL_SEC = Number(arg("poll-interval-sec", 120))
const EXPORT_EMAIL = process.env.DEALMACHINE_EXPORT_EMAIL || "acquisitions@vestblock.io"

function sh(command, { capture = false } = {}) {
  console.log(`\n$ ${command}`)
  if (DRY_RUN) return { status: 0, stdout: "" }
  const result = spawnSync("/bin/sh", ["-c", command], {
    cwd: ROOT,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  })
  return { status: result.status ?? 1, stdout: result.stdout || "" }
}

function listFiles(dir, filterFn) {
  try {
    return fs.readdirSync(dir).filter(filterFn)
  } catch {
    return []
  }
}

function listExportCsvs() {
  const names = new Set()
  const walk = (dir) => {
    for (const name of listFiles(dir, () => true)) {
      const full = path.join(dir, name)
      try {
        if (fs.statSync(full).isDirectory()) walk(full)
        else if (name.endsWith(".csv")) names.add(full)
      } catch {
        // ignore
      }
    }
  }
  walk(EXPORT_DIR)
  return names
}

function sleep(seconds) {
  spawnSync("/bin/sh", ["-c", `sleep ${seconds}`])
}

// ---- 0. Lanes from the morning brief --------------------------------------
const brief = (() => {
  try {
    return JSON.parse(fs.readFileSync(BRIEF_PATH, "utf8"))
  } catch {
    return null
  }
})()
const buildToday = brief?.laneFill?.buildToday || []
if (!SKIP_BUILD && !buildToday.length) {
  console.error("No lanes queued. Run `npm run outreach:autopilot` first so the brief lists today's builds.")
  process.exit(1)
}
console.log(`DealMachine export pipeline — ${SKIP_BUILD ? "download-only mode" : `${buildToday.length} lane build(s)`}${DRY_RUN ? " [dry-run]" : ""}`)
for (const lane of buildToday) console.log(`  • ${lane.lane}`)

// ---- 1. Preflight: Gmail read scope ----------------------------------------
console.log("\n── Preflight: Gmail export-inbox access ──")
const preflight = sh(
  "node --env-file=.env.local scripts/dealmachine-export-download.mjs --max=1",
  { capture: true }
)
if (preflight.status !== 0 && !DRY_RUN) {
  console.error(
    [
      "",
      "Gmail read access is not working, so downloaded exports cannot be fetched unattended.",
      "One-time fix (adds gmail.readonly to your Google token):",
      "  node --env-file=.env.local scripts/dealmachine-export-download.mjs --auth-url",
      "  node --env-file=.env.local scripts/dealmachine-export-download.mjs --exchange-code=<code> --write-env",
      FORCE ? "Continuing anyway because --force was passed (exports will wait in the inbox)." : "Rerun after fixing, or pass --force to build/request anyway.",
    ].join("\n")
  )
  if (!FORCE) process.exit(1)
}

// ---- 2. Build lane lists ----------------------------------------------------
const builderJsonsBefore = new Set(listFiles(BUILDER_OUT_DIR, (n) => n.startsWith("dealmachine-website-list-builder-") && n.endsWith(".json")))
if (!SKIP_BUILD) {
  for (const lane of buildToday) {
    console.log(`\n── Build: ${lane.lane} ──`)
    const result = sh(lane.command)
    if (result.status !== 0) {
      console.error(`Lane build failed for ${lane.lane}; continuing with remaining lanes.`)
    }
  }
}

// ---- 3. Request Contacts exports for the new builder runs -------------------
const newBuilderJsons = listFiles(BUILDER_OUT_DIR, (n) => n.startsWith("dealmachine-website-list-builder-") && n.endsWith(".json"))
  .filter((n) => !builderJsonsBefore.has(n))
  .map((n) => path.join(BUILDER_OUT_DIR, n))
if (!SKIP_BUILD && !newBuilderJsons.length && !DRY_RUN) {
  console.error("No new list-builder JSON was produced — nothing to export. Check DEALMACHINE_WEB_TOKEN and the build logs above.")
  process.exit(1)
}
for (const jsonPath of newBuilderJsons) {
  console.log(`\n── Request export: ${path.basename(jsonPath)} ──`)
  sh(
    `node --env-file=.env.local scripts/dealmachine-export-lists.mjs --lists-json=${JSON.stringify(jsonPath)} --send --emails=${EXPORT_EMAIL} --wait-ms=60000 --request-timeout-ms=60000`
  )
}

// ---- 4. Poll Gmail until the export CSVs land -------------------------------
console.log(`\n── Watching for Export Complete emails (up to ${POLL_MINUTES} min, every ${POLL_INTERVAL_SEC}s) ──`)
const csvsBefore = listExportCsvs()
const deadline = Date.now() + POLL_MINUTES * 60000
let newCsvs = []
while (Date.now() < deadline) {
  if (DRY_RUN) break
  sleep(POLL_INTERVAL_SEC)
  sh("node --env-file=.env.local scripts/dealmachine-export-download.mjs --apply --ingest --max=10", { capture: true })
  newCsvs = [...listExportCsvs()].filter((file) => !csvsBefore.has(file))
  if (newCsvs.length >= Math.max(1, newBuilderJsons.length || 1)) break
  process.stdout.write(".")
}

// ---- 5. Report ---------------------------------------------------------------
console.log("\n\n══ Pipeline result ══")
if (DRY_RUN) {
  console.log("Dry run complete — commands printed above, nothing executed.")
} else if (newCsvs.length) {
  console.log(`Downloaded ${newCsvs.length} new export CSV(s):`)
  for (const file of newCsvs) console.log(`  ${path.relative(ROOT, file)}`)
  console.log("\nNext: rerun `npm run outreach:autopilot` — these lanes now count as fresh and the send plan updates automatically.")
} else {
  console.log("No new CSVs arrived within the window. DealMachine exports can take a while on big lists —")
  console.log("rerun later with: npm run outreach:export-pipeline -- --skip-build")
}
