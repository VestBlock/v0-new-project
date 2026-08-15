#!/usr/bin/env node

/**
 * VestBlock master revenue loop.
 *
 * This is the source -> stack -> enrich -> outreach -> buyer/dispo -> report
 * runner. It intentionally defaults to preview mode; live seller outreach and
 * paid discovery only happen when the caller passes --send / --run-paid.
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { loadDealMachineStrategyLearning } from "./lib/dealmachine-strategy-learning.mjs"

const ROOT = process.cwd()
const args = process.argv.slice(2)
const REPORT_DIR = path.join(ROOT, "data", "operating-loops")
const LATEST_JSON = path.join(REPORT_DIR, "vestblock-master-revenue-loop-latest.json")
const LATEST_MD = path.join(REPORT_DIR, "vestblock-master-revenue-loop-latest.md")

function hasFlag(name) {
  return args.includes(name)
}

function getArg(name, fallback = "") {
  const prefix = `${name}=`
  const inline = [...args].reverse().find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.lastIndexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1]
  return fallback
}

function intArg(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ""), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function newestFile(dir, predicate) {
  if (!fs.existsSync(dir)) return null
  return fs
    .readdirSync(dir)
    .filter(predicate)
    .map((name) => {
      const file = path.join(dir, name)
      const stat = fs.statSync(file)
      return { file, name, mtimeMs: stat.mtimeMs, mtimeIso: new Date(stat.mtimeMs).toISOString() }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

function runStep(name, command, stepArgs, options = {}) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, stepArgs, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
  })
  const step = {
    name,
    ok: result.status === 0,
    required: options.required !== false,
    status: result.status,
    command: [command, ...stepArgs].join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: String(result.stdout || "").slice(-9000),
    stderr: String(result.stderr || "").slice(-9000),
  }
  if (!step.ok && step.required) {
    step.blocking = true
  }
  return step
}

function skippedStep(name, reason, required = false) {
  const now = new Date().toISOString()
  return {
    name,
    ok: !required,
    required,
    skipped: true,
    status: null,
    command: "",
    startedAt: now,
    finishedAt: now,
    stdout: "",
    stderr: reason,
    blocking: required || undefined,
  }
}

function envAudit() {
  const checks = [
    ["DealMachine API", ["DEALMACHINE_API_KEY", "DEALMACHINE_TOKEN"]],
    ["Outscraper", ["OUTSCRAPER_API_KEY"]],
    ["Supabase", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE"]],
    ["Resend email", ["RESEND_API_KEY"]],
    ["Google Maps", ["GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]],
    ["OpenAI", ["OPENAI_API_KEY"]],
    ["Vercel", ["VERCEL_TOKEN"]],
    ["Instantly", ["INSTANTLY_API_KEY"]],
  ]
  return checks.map(([label, keys]) => ({
    label,
    keys,
    wired: keys.some((key) => Boolean(process.env[key])),
  }))
}

function scriptAudit() {
  const scripts = [
    ["DealMachine native API health", "scripts/dealmachine-api-capabilities.mjs"],
    ["Seller outreach autopilot", "scripts/seller-outreach-autopilot.mjs"],
    ["SMS relay queue", "scripts/send-messages-batch.mjs"],
    ["SMS review queue", "scripts/sms-review-queue.mjs"],
    ["County/code stack router", "scripts/route-county-code-stack-lanes.mjs"],
    ["Preforeclosure county OSINT", "scripts/preforeclosure-county-osint-lane.mjs"],
    ["Public OSINT enrich", "scripts/preforeclosure-public-osint-enrich.mjs"],
    ["Outscraper discovery", "scripts/outscraper-real-estate-discovery.mjs"],
    ["Boss daily loop", "scripts/boss-daily-loop.mjs"],
    ["Command scorecard", "scripts/revenue-command-scorecard.mjs"],
    ["Primary-machine guard", "scripts/require-primary-machine.mjs"],
  ]
  return scripts.map(([label, relativePath]) => ({ label, relativePath, wired: exists(relativePath) }))
}

function findLatestTaxCodeStackCsv() {
  const dirs = [
    path.join(ROOT, "data", "distress-leads"),
  ]
  const candidates = []
  for (const dir of dirs) {
    const latest = newestFile(
      dir,
      (name) => /\.csv$/i.test(name) && /tax|code|violation|delinquent/i.test(name)
    )
    if (latest) candidates.push(latest)
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

function renderMarkdown(summary) {
  const lines = []
  lines.push("# VestBlock Master Revenue Loop")
  lines.push("")
  lines.push(`Generated: ${summary.generatedAt}`)
  lines.push(`Mode: ${summary.mode}`)
  lines.push(`Overall: ${summary.ok ? "OK" : "Needs attention"}`)
  lines.push("")
  lines.push("## Wiring")
  for (const item of summary.wiring.env) {
    lines.push(`- ${item.wired ? "OK" : "MISSING"} ${item.label}`)
  }
  for (const item of summary.wiring.scripts) {
    lines.push(`- ${item.wired ? "OK" : "MISSING"} ${item.label}`)
  }
  lines.push("")
  lines.push("## Strategy Learning")
  lines.push(`- Observed strategies: ${summary.strategyLearning.totalStrategiesObserved}`)
  lines.push(`- Covered strategies: ${summary.strategyLearning.coveredStrategies.slice(0, 18).join(", ") || "none"}`)
  lines.push(`- Missing strategies: ${summary.strategyLearning.missingStrategies.slice(0, 18).join(", ") || "none"}`)
  lines.push("")
  lines.push("## Steps")
  for (const step of summary.steps) {
    lines.push(`- ${step.ok ? "OK" : "ERR"} ${step.name}`)
  }
  lines.push("")
  lines.push("## Latest Artifacts")
  for (const [label, value] of Object.entries(summary.artifacts)) {
    lines.push(`- ${label}: ${value || "none"}`)
  }
  lines.push("")
  lines.push("## Next Command")
  lines.push("Preview:")
  lines.push("`npm run vestblock:master-loop`")
  lines.push("")
  lines.push("Live seller outreach on the Pro:")
  lines.push("`npm run vestblock:master-loop:send -- --daily-cap=500 --run-paid`")
  return `${lines.join("\n")}\n`
}

async function main() {
  const send = hasFlag("--send")
  const runPaid = hasFlag("--run-paid")
  const dailyCap = intArg("--daily-cap", Number.parseInt(process.env.SELLER_OUTREACH_DAILY_CAP || "500", 10), 1000)
  const sellerMarkets = getArg(
    "--seller-markets",
    "buffalo-ny,kalamazoo-mi,flint-mi,toledo-oh,cleveland-oh,detroit-mi,akron-oh"
  )
  const includeBuyers = !hasFlag("--skip-buyers")
  const includeStackRouter = !hasFlag("--skip-stack-router")
  const steps = []

  fs.mkdirSync(REPORT_DIR, { recursive: true })

  const primaryGuard = runStep("primary-machine-guard", "node", ["scripts/require-primary-machine.mjs"], {
    required: send,
  })
  const isPrimaryMachine = primaryGuard.ok
  if (send || isPrimaryMachine) {
    steps.push(primaryGuard)
  } else {
    steps.push(
      skippedStep(
        "primary-machine-guard",
        "Command-center preview mode. Live outreach is intentionally reserved for the primary Pro host."
      )
    )
  }
  if (send && !isPrimaryMachine) {
    const summary = {
      generatedAt: new Date().toISOString(),
      ok: false,
      mode: "LIVE_SEND_BLOCKED_NON_PRIMARY",
      send,
      runPaid,
      dailyCap,
      sellerMarkets,
      wiring: {
        env: envAudit(),
        scripts: scriptAudit(),
      },
      strategyLearning: {
        file: null,
        totalStrategiesObserved: 0,
        coveredStrategies: [],
        missingStrategies: [],
        topStrategies: [],
      },
      steps,
      artifacts: {},
    }
    fs.writeFileSync(LATEST_JSON, `${JSON.stringify(summary, null, 2)}\n`)
    fs.writeFileSync(LATEST_MD, renderMarkdown(summary))
    console.log("=== VestBlock master revenue loop ===")
    console.log("Mode: LIVE_SEND_BLOCKED_NON_PRIMARY")
    console.log(primaryGuard.stderr || "Primary-machine guard blocked live mode.")
    process.exitCode = 1
    return
  }

  const wiring = {
    env: envAudit(),
    scripts: scriptAudit(),
  }

  const strategyLearning = loadDealMachineStrategyLearning(ROOT, { limit: 80 })

  steps.push(runStep("boss-daily-loop", "npm", ["run", "boss:daily-loop"], { required: false }))
  steps.push(runStep("command-scorecard", "npm", ["run", "revenue:command"], { required: false }))
  steps.push(runStep("instantly-doctor", "npm", ["run", "instantly:doctor"], { required: false }))

  const latestStackCsv = findLatestTaxCodeStackCsv()
  if (includeStackRouter && latestStackCsv) {
    steps.push(
      runStep("county-code-stack-router", "node", [
        "scripts/route-county-code-stack-lanes.mjs",
        `--source=${latestStackCsv.file}`,
      ])
    )
  } else if (includeStackRouter) {
    steps.push({
      name: "county-code-stack-router",
      ok: false,
      required: false,
      status: null,
      command: "auto-find tax/code source csv",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      stdout: "",
      stderr: "No tax/code source CSV found.",
    })
  }

  steps.push(skippedStep(
    "seller-outreach-autopilot",
    "The legacy DealMachine-export sender is retired. Controlled outreach resumes only through the CRM-owned strategy pilot after its release gate."
  ))

  if (includeBuyers) {
    const buyerLanes = ["buyer-developer", "investor-network", "land-developers", "county-records"]
    for (const lane of buyerLanes) {
      const buyerArgs = ["--env-file=.env.local", "scripts/outscraper-real-estate-discovery.mjs", `--lane=${lane}`]
      if (runPaid) buyerArgs.push("--run")
      steps.push(runStep(`outscraper-${lane}`, "node", buyerArgs, { required: false }))
    }
  }

  steps.push(runStep("sms-review-queue", "npm", ["run", "outreach:sms-review", "--", "--limit=200"], { required: false }))

  const artifacts = {
    strategyLearning: strategyLearning.file,
    latestTaxCodeStackCsv: latestStackCsv?.file || null,
    latestStackRoutes:
      newestFile(path.join(REPORT_DIR, "county-code-stacked-lanes"), (name) => /county-code-stacked-lanes-.*\.json$/i.test(name))
        ?.file || null,
    latestRevenueCommand:
      newestFile(REPORT_DIR, (name) => /revenue-command-scorecard.*\.json$/i.test(name))?.file || null,
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    ok: steps.every((step) => step.ok || step.required === false),
    mode: send ? "LIVE_SEND_GATED" : "PREVIEW",
    send,
    runPaid,
    dailyCap,
    sellerMarkets,
    wiring,
    strategyLearning: {
      file: strategyLearning.file,
      totalStrategiesObserved: strategyLearning.totalStrategiesObserved,
      coveredStrategies: strategyLearning.coveredStrategies,
      missingStrategies: strategyLearning.missingStrategies,
      topStrategies: strategyLearning.strategies.slice(0, 12).map((row) => ({
        strategyKey: row.strategyKey,
        readinessScore: row.readinessScore,
        exportableContacts: row.exportableContacts,
        outreachSent: row.outreachSent,
      })),
    },
    steps,
    artifacts,
  }

  fs.writeFileSync(LATEST_JSON, `${JSON.stringify(summary, null, 2)}\n`)
  fs.writeFileSync(LATEST_MD, renderMarkdown(summary))

  console.log("=== VestBlock master revenue loop ===")
  console.log(`Mode: ${summary.mode}`)
  console.log(`Overall: ${summary.ok ? "OK" : "Needs attention"}`)
  for (const step of steps) {
    const label = step.skipped ? "SKIP" : step.ok ? "OK  " : "ERR "
    console.log(`${label} ${step.name}`)
  }
  console.log(`JSON: ${LATEST_JSON}`)
  console.log(`Report: ${LATEST_MD}`)

  if (!summary.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
