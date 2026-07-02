#!/usr/bin/env node
/**
 * Load a 500-lead seller outreach queue from strict stale-listing waves.
 *
 * This intentionally stages/imports leads instead of live-sending them. Live
 * sends should happen from the reviewed queue with suppression/bounce checks.
 */

import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name, fallback = "") => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

const waveLimit = Number.parseInt(getArg("wave-limit", "100"), 10)
const maxWaves = Number.parseInt(getArg("waves", "5"), 10)
const minDom = Number.parseInt(getArg("min-dom", "30"), 10)
const priceMax = Number.parseInt(getArg("price-max", "450000"), 10)
const harvestLimitPerMarket = Number.parseInt(getArg("harvest-limit-per-market", "120"), 10)
const outDir = path.join(process.cwd(), "data", "operating-loops")
const outreachDir = path.join(process.cwd(), "tmp", "outreach")

const DEFAULT_WAVES = [
  "Buffalo, NY|Rochester, NY|Syracuse, NY|Erie, PA|Scranton, PA|Allentown, PA|Reading, PA|Harrisburg, PA",
  "Canton, OH|Youngstown, OH|Mansfield, OH|Lima, OH|Springfield, OH|Hamilton, OH|Middletown, OH|Lorain, OH",
  "Saginaw, MI|Bay City, MI|Jackson, MI|Battle Creek, MI|Kalamazoo, MI|Muskegon, MI|Pontiac, MI|Ypsilanti, MI",
  "Terre Haute, IN|Muncie, IN|Anderson, IN|Lafayette, IN|Gary, IN|Kokomo, IN|Elkhart, IN|Mishawaka, IN",
  "Topeka, KS|Lawrence, KS|St Joseph, MO|Joplin, MO|Columbia, MO|Jefferson City, MO|Cape Girardeau, MO|Sioux City, IA",
  "Flint, MI|Lansing, MI|Little Rock, AR|Dayton, OH|Fort Wayne, IN|Wichita, KS|Tulsa, OK|Oklahoma City, OK",
  "Peoria, IL|Rockford, IL|Des Moines, IA|Springfield, MO|Evansville, IN|Grand Rapids, MI|Holland, MI|Wyoming, MI",
]

function run(command, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

function latestDraftJson(beforeMs) {
  const files = fs.existsSync(outreachDir)
    ? fs.readdirSync(outreachDir)
      .filter((file) => file.startsWith("stale-listing-drafts-") && file.endsWith(".json"))
      .map((file) => {
        const full = path.join(outreachDir, file)
        return { file: full, mtimeMs: fs.statSync(full).mtimeMs }
      })
      .filter((entry) => entry.mtimeMs >= beforeMs - 1000)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    : []
  return files[0]?.file || null
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const selectedWaves = DEFAULT_WAVES.slice(0, Math.max(1, maxWaves))
  const summary = {
    ok: true,
    createdAt: new Date().toISOString(),
    targetSellerLeads: selectedWaves.length * waveLimit,
    waveLimit,
    minDom,
    priceMax,
    waves: [],
    totalImported: 0,
    totalMessages: 0,
    errors: [],
  }

  for (const markets of selectedWaves) {
    console.log(`\n=== strict seller queue wave: ${markets} ===`)
    const startedAt = Date.now()
    const harvest = await run(process.execPath, [
      "--env-file=.env.local",
      "scripts/stale-listing-finder.mjs",
      "--source=homeharvest",
      "--offer-mode=lowball",
      `--market=${markets}`,
      `--min-dom=${minDom}`,
      "--distress-threshold=999",
      `--price-max=${priceMax}`,
      `--harvest-limit-per-market=${harvestLimitPerMarket}`,
      `--limit=${waveLimit}`,
      "--allow-high-volume",
      "--skip-analyzer",
    ])

    const draftPath = latestDraftJson(startedAt)
    const wave = { markets, harvestExitCode: harvest.code, draftPath, imported: 0, messages: 0 }
    if (harvest.code !== 0 || !draftPath) {
      summary.ok = false
      summary.errors.push({ markets, stage: "harvest", code: harvest.code, draftPath })
      summary.waves.push(wave)
      continue
    }

    const imported = await run(process.execPath, [
      "--env-file=.env.local",
      "scripts/import-stale-listing-seller-leads.mjs",
      `--input=${draftPath}`,
    ])
    wave.importExitCode = imported.code

    const reportMatch = imported.stdout.match(/"reportPath": "([^"]+)"/)
    if (reportMatch) {
      wave.reportPath = reportMatch[1]
      try {
        const report = JSON.parse(fs.readFileSync(reportMatch[1], "utf8"))
        wave.imported = Number(report.upserted || 0)
        wave.messages = Number(report.messages || 0)
      } catch {}
    }
    summary.totalImported += wave.imported
    summary.totalMessages += wave.messages
    if (imported.code !== 0) {
      summary.ok = false
      summary.errors.push({ markets, stage: "import", code: imported.code })
    }
    summary.waves.push(wave)
  }

  const reportPath = path.join(outDir, `seller-queue-500-loader-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2))
  console.log("\n=== Seller queue loader summary ===")
  console.log(JSON.stringify({ ...summary, reportPath }, null, 2))
  process.exit(summary.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
