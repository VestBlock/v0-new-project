#!/usr/bin/env node

/**
 * Refresh DealMachine saved lists from prior builder templates using the
 * website-session token, without requiring an active Chrome tab.
 *
 * This rebuilds fresh saved lists from previously proven list_filters so the
 * export/contact lanes can stay alive even when the browser automation path is
 * unavailable on the Pro.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-token-list-rebuilder.mjs
 *   node --env-file=.env.local scripts/dealmachine-token-list-rebuilder.mjs --target-leads=1000 --max-builds=12
 *   node --env-file=.env.local scripts/dealmachine-token-list-rebuilder.mjs --markets="Omaha,NE|Wichita,KS" --strategies="tax-code-stack|vacant-equity"
 */

import fs from "node:fs"
import path from "node:path"
import { ALL_DEALMACHINE_STRATEGIES, loadDealMachineStrategyLearning } from "./lib/dealmachine-strategy-learning.mjs"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "tmp", "outreach")
const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
const TOKEN = String(process.env.DEALMACHINE_WEB_TOKEN || "").trim()
const args = process.argv.slice(2)

function getArg(name, fallback = "") {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

function intArg(name, fallback) {
  const raw = getArg(name)
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value) {
  return String(value || "")
    .split(/[|;,]/)
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

function normalizeMarketLabel(value) {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}, ${parts[1].toUpperCase()}`
  return String(value || "").trim()
}

const TARGET_LEADS = intArg("target-leads", 1000)
const MAX_BUILDS = intArg("max-builds", 12)
const MIN_COUNT = intArg("min-count", 50)
const MAX_COUNT = intArg("max-count", 250)
const REQUEST_TIMEOUT_MS = intArg("request-timeout-ms", 45000)
const PAUSE_MS = intArg("pause-ms", 250)
const MARKETS = new Set(parseList(getArg("markets")).map((item) => normalizeMarketLabel(item)))
const STRATEGIES = new Set(parseList(getArg("strategies")).map((item) => normalizeSlug(item)))
const SOURCE_GLOB = getArg("source-glob", "")
const COVER_ALL_STRATEGIES_FIRST = getArg("cover-all-strategies-first", "true") !== "false"

function listBuilderFiles() {
  if (!fs.existsSync(OUT_DIR)) return []
  const names = fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^dealmachine-website-list-builder-.*\.json$/i.test(name))
    .sort((a, b) => fs.statSync(path.join(OUT_DIR, b)).mtimeMs - fs.statSync(path.join(OUT_DIR, a)).mtimeMs)
  if (!SOURCE_GLOB) return names.map((name) => path.join(OUT_DIR, name))
  const needle = normalizeSlug(SOURCE_GLOB).replace(/\*/g, "")
  return names
    .filter((name) => normalizeSlug(name).includes(needle))
    .map((name) => path.join(OUT_DIR, name))
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function todayStamp() {
  const iso = new Date().toISOString()
  return iso.slice(0, 10)
}

async function dmListBuilder(body, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs)
  try {
    const res = await fetch("https://api.dealmachine.com/v2/list-builder/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-DM-Client-Key": DM_CLIENT_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify({ token: TOKEN, ...body }),
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { error: text.slice(0, 300) }
    }
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timeout)
  }
}

function loadTemplates() {
  const files = listBuilderFiles()
  const seen = new Set()
  const rows = []
  for (const file of files) {
    const parsed = readJson(file, {})
    const built = parsed?.built || parsed?.builtLists || []
    for (const row of built) {
      const list = row?.list || {}
      const filters = list?.list_filters
      const market = normalizeMarketLabel(row?.market || [row?.city, row?.state].filter(Boolean).join(", "))
      const strategyKey = normalizeSlug(row?.strategyKey || row?.strategy)
      const variant = normalizeSlug(row?.variant || "")
      if (!filters || !market || !strategyKey || !variant) continue
      if (MARKETS.size && !MARKETS.has(market)) continue
      if (STRATEGIES.size && !STRATEGIES.has(strategyKey)) continue
      const dedupeKey = `${market}|${strategyKey}|${variant}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      rows.push({
        sourceFile: path.relative(ROOT, file),
        market,
        city: row?.city || market.split(",")[0]?.trim() || "",
        state: String(row?.state || market.split(",")[1] || "").trim().toUpperCase(),
        strategyKey,
        strategy: row?.strategy || strategyKey,
        variant,
        priorCount: Number(row?.count || list?.estimated_count || 0),
        templateListId: list?.id || list?.value || null,
        listFilters: filters,
        listAreaType: list?.list_area_type || row?.locationType || "city",
        listArea: list?.list_area || row?.city || "",
        listArea2: list?.list_area_2 || row?.state || "",
        listGeoFence: list?.list_geo_fence || [],
      })
    }
  }
  return rows
}

async function pace() {
  if (PAUSE_MS > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
}

async function refreshCounts(templates) {
  const counted = []
  for (const [index, row] of templates.entries()) {
    process.stdout.write(`\rCounting templates ${index + 1}/${templates.length} | ${row.market} | ${row.strategyKey}                    `)
    const response = await dmListBuilder({
      type: "build_list_count",
      list_filters: JSON.stringify(row.listFilters),
      location_type: row.listAreaType,
      city: row.city,
      state: row.state,
      zip: row.listAreaType === "zip" ? row.listArea : "",
      fips: "",
      drawing_coordinates: JSON.stringify(Array.isArray(row.listGeoFence) ? row.listGeoFence : []),
    })
    const count = Number(response?.data?.results?.lead_count || 0)
    counted.push({
      ...row,
      freshCount: count,
      countStatus: response.status,
      countError: response?.data?.error || false,
      countOk: response.ok && !response?.data?.error,
    })
    await pace()
  }
  process.stdout.write("\n")
  return counted
}

function templatePriority(row, learningMap) {
  const learning = learningMap.get(row.strategyKey)
  const readiness = Number(learning?.readinessScore || 50)
  const exportableContacts = Number(learning?.exportableContacts || 0)
  const zeroExportChecks = Number(learning?.zeroExportChecks || 0)
  const outreachSent = Number(learning?.outreachSent || 0)
  return (
    readiness * 100000 +
    exportableContacts * 200 +
    row.freshCount * 10 -
    zeroExportChecks * 150 +
    outreachSent
  )
}

function selectTemplates(rows, learningSummary) {
  const eligible = rows.filter((row) => row.countOk && row.freshCount >= MIN_COUNT && row.freshCount <= MAX_COUNT)
  const learningMap = new Map((learningSummary?.strategies || []).map((row) => [row.strategyKey, row]))
  const byStrategy = new Map()
  for (const row of eligible) {
    const list = byStrategy.get(row.strategyKey) || []
    list.push(row)
    byStrategy.set(row.strategyKey, list)
  }
  for (const list of byStrategy.values()) {
    list.sort((a, b) => templatePriority(b, learningMap) - templatePriority(a, learningMap) || b.freshCount - a.freshCount)
  }

  const strategies = [...new Set([
    ...ALL_DEALMACHINE_STRATEGIES.filter((key) => byStrategy.has(key)),
    ...[...byStrategy.keys()].sort(),
  ])]
  const selected = []
  const seenMarkets = new Set()
  let totalLeads = 0

  if (COVER_ALL_STRATEGIES_FIRST) {
    for (const strategy of strategies) {
      const queue = byStrategy.get(strategy) || []
      while (queue.length) {
        const next = queue.shift()
        const marketStrategyKey = `${next.market}|${next.strategyKey}`
        if (seenMarkets.has(marketStrategyKey)) continue
        selected.push(next)
        seenMarkets.add(marketStrategyKey)
        totalLeads += next.freshCount
        break
      }
      if (selected.length >= MAX_BUILDS || totalLeads >= TARGET_LEADS) {
        return { selected, totalLeads, eligibleCount: eligible.length }
      }
    }
  }

  while (selected.length < MAX_BUILDS && totalLeads < TARGET_LEADS) {
    let pickedAny = false
    for (const strategy of strategies) {
      const queue = byStrategy.get(strategy) || []
      while (queue.length) {
        const next = queue.shift()
        const marketStrategyKey = `${next.market}|${next.strategyKey}`
        if (seenMarkets.has(marketStrategyKey)) continue
        selected.push(next)
        seenMarkets.add(marketStrategyKey)
        totalLeads += next.freshCount
        pickedAny = true
        break
      }
      if (selected.length >= MAX_BUILDS || totalLeads >= TARGET_LEADS) break
    }
    if (!pickedAny) break
  }

  return { selected, totalLeads, eligibleCount: eligible.length }
}

function summarizeCountedRows(rows) {
  const summary = {
    total: rows.length,
    okCount: 0,
    errorCount: 0,
    zeroCount: 0,
    underMinCount: 0,
    overMaxCount: 0,
    eligibleCount: 0,
    topEligible: [],
    sampleErrors: [],
  }
  for (const row of rows) {
    if (!row.countOk) {
      summary.errorCount += 1
      if (summary.sampleErrors.length < 12) {
        summary.sampleErrors.push({
          market: row.market,
          strategyKey: row.strategyKey,
          variant: row.variant,
          countStatus: row.countStatus,
          countError: row.countError,
        })
      }
      continue
    }
    summary.okCount += 1
    if (row.freshCount <= 0) summary.zeroCount += 1
    if (row.freshCount < MIN_COUNT) summary.underMinCount += 1
    else if (row.freshCount > MAX_COUNT) summary.overMaxCount += 1
    else summary.eligibleCount += 1
  }
  summary.topEligible = rows
    .filter((row) => row.countOk && row.freshCount >= MIN_COUNT && row.freshCount <= MAX_COUNT)
    .sort((a, b) => b.freshCount - a.freshCount)
    .slice(0, 15)
    .map((row) => ({
      market: row.market,
      strategyKey: row.strategyKey,
      variant: row.variant,
      freshCount: row.freshCount,
      priorCount: row.priorCount,
    }))
  return summary
}

async function buildLists(selected) {
  const built = []
  const errors = []
  const today = todayStamp()
  for (const [index, row] of selected.entries()) {
    process.stdout.write(`\rBuilding lists ${index + 1}/${selected.length} | ${row.market} | ${row.strategyKey}                    `)
    const title = `VB ${row.strategyKey} ${normalizeSlug(`${row.city}-${row.state}`)} ${row.variant} ${today}`.slice(0, 150)
    const response = await dmListBuilder(
      {
        title,
        type: "build_list",
        using_new_filters: 1,
        list_type: "build_list",
        list_area_type: row.listAreaType,
        list_area: row.listArea,
        list_area_2: row.listArea2,
        list_geo_fence: JSON.stringify(Array.isArray(row.listGeoFence) ? row.listGeoFence : []),
        list_filters: JSON.stringify(row.listFilters),
        estimated_count: row.freshCount,
      },
      Math.max(REQUEST_TIMEOUT_MS, 60000)
    )
    const payload = {
      ...row,
      title,
      buildStatus: response.status,
      buildError: response?.data?.error || false,
      list: response?.data?.results?.list || response?.data?.results || null,
    }
    if (response.ok && !response?.data?.error && payload.list?.id) built.push(payload)
    else errors.push(payload)
    await pace()
  }
  process.stdout.write("\n")
  return { built, errors }
}

function writeOutputs(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(OUT_DIR, `dealmachine-token-list-rebuilder-${stamp}.json`)
  const mdPath = path.join(OUT_DIR, `dealmachine-token-list-rebuilder-${stamp}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  const lines = [
    "# DealMachine Token List Rebuilder",
    "",
    `Created: ${report.finishedAt}`,
    `Templates scanned: ${report.templatesScanned}`,
    `Eligible templates: ${report.eligibleCount}`,
    `Selected builds: ${report.selected.length}`,
    `Target fresh leads: ${report.targetLeads}`,
    `Selected estimated leads: ${report.selectedLeadCount}`,
    `Built lists: ${report.built.length}`,
    `Errors: ${report.errors.length}`,
    "",
    "## Built",
    "",
    ...(report.built.length
      ? report.built.map((row) => `- ${row.title}: ${row.freshCount} leads (${row.market}, ${row.strategyKey}, list ${row.list?.id})`)
      : ["- None"]),
    "",
    "## Selected",
    "",
    ...(report.selected.length
      ? report.selected.map((row) => `- ${row.market} / ${row.strategyKey} / ${row.variant}: ${row.freshCount}`)
      : ["- None"]),
    "",
    "## Errors",
    "",
    ...(report.errors.length
      ? report.errors.map((row) => `- ${row.market} / ${row.strategyKey} / ${row.variant}: status ${row.buildStatus} ${row.buildError || ""}`.trim())
      : ["- None"]),
    "",
  ]
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`)
  return { jsonPath, mdPath }
}

async function main() {
  if (!TOKEN) throw new Error("Missing DEALMACHINE_WEB_TOKEN in environment.")
  const templates = loadTemplates()
  if (!templates.length) {
    throw new Error("No builder templates were found in tmp/outreach.")
  }
  const learningSummary = loadDealMachineStrategyLearning(ROOT)
  const counted = await refreshCounts(templates)
  const countedSummary = summarizeCountedRows(counted)
  const selection = selectTemplates(counted, learningSummary)
  const buildResults = await buildLists(selection.selected)
  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    targetLeads: TARGET_LEADS,
    maxBuilds: MAX_BUILDS,
    minCount: MIN_COUNT,
    maxCount: MAX_COUNT,
    templatesScanned: templates.length,
    countedSummary,
    eligibleCount: selection.eligibleCount,
    selectedLeadCount: selection.totalLeads,
    selected: selection.selected,
    built: buildResults.built,
    errors: buildResults.errors,
    learningFile: path.relative(ROOT, learningSummary.file),
    learningStrategiesObserved: learningSummary.totalStrategiesObserved,
    missingStrategiesWithoutHistory: learningSummary.missingStrategies,
    missingStrategiesWithoutEligibleTemplates: ALL_DEALMACHINE_STRATEGIES.filter((key) => !selection.selected.some((row) => row.strategyKey === key)),
  }
  const outputs = writeOutputs(report)
  console.log(JSON.stringify({
    ok: buildResults.built.length > 0,
    selected: selection.selected.length,
    built: buildResults.built.length,
    selectedLeadCount: selection.totalLeads,
    json: path.relative(ROOT, outputs.jsonPath),
    md: path.relative(ROOT, outputs.mdPath),
  }, null, 2))
  if (!buildResults.built.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
