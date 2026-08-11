import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const ROOT = process.cwd()
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const LOOP_DIR = path.join(ROOT, "data", "operating-loops")
const STATE_FILE = path.join(LOOP_DIR, "dealmachine-export-autoloop-state.json")
const DEFAULT_EXPORT_EMAIL = process.env.OUTREACH_FROM_EMAIL || "acquisitions@vestblock.io"

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function todayIso() {
  return getArg("--date", new Date().toISOString().slice(0, 10))
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function countResults(prefix, date) {
  let files = 0
  let ok = 0
  let failed = 0
  if (!fs.existsSync(OUTREACH_DIR)) return { files, ok, failed }
  const datedPrefix = `${prefix}-${date}`
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith(datedPrefix) || !file.endsWith(".json")) continue
    const rows = readJson(path.join(OUTREACH_DIR, file), [])
    if (!Array.isArray(rows)) continue
    files += 1
    for (const row of rows) {
      if (row?.ok) ok += 1
      else failed += 1
    }
  }
  return { files, ok, failed }
}

function runNodeScript(script, scriptArgs = [], extraEnv = {}) {
  const result = spawnSync(process.execPath, ["--env-file=.env.local", script, ...scriptArgs], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  })
  if (result.status !== 0) {
    throw new Error(`${path.basename(script)} failed with exit code ${result.status}`)
  }
}

function latestFile(dir, prefix) {
  if (!fs.existsSync(dir)) return null
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => {
      const file = path.join(dir, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

function newestMatchingFiles(dir, pattern, limit = 40) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => {
      const file = path.join(dir, name)
      return { file, name, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
}

function normalizeStrategy(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function loadSavedListRequestedIds(limit = 80) {
  const ids = new Set()
  for (const entry of newestMatchingFiles(OUTREACH_DIR, /^dealmachine-saved-list-export-.*\.json$/i, limit)) {
    const parsed = readJson(entry.file, {})
    const rows = Array.isArray(parsed?.results) ? parsed.results : []
    for (const row of rows) {
      if (row?.requested || row?.acceptedUnverified) {
        const id = String(row.listId || row.id || "").trim()
        if (id) ids.add(id)
      }
    }
  }
  return ids
}

function collectRecentBuiltLists({ maxAgeHours = 24, maxLists = 12, strategies = [] }) {
  const strategyFilters = new Set(
    String(strategies || "")
      .split(/[|,;]/)
      .map((value) => normalizeStrategy(value))
      .filter(Boolean)
  )
  const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000
  const requestedIds = loadSavedListRequestedIds()
  const seenIds = new Set()
  const selected = []
  const files = newestMatchingFiles(OUTREACH_DIR, /^dealmachine-website-list-builder-.*\.json$/i, 120)

  for (const entry of files) {
    if (entry.mtimeMs < cutoffMs) continue
    const parsed = readJson(entry.file, {})
    const rows = Array.isArray(parsed?.built) ? parsed.built : []
    for (const row of rows) {
      const listId = String(row?.id || row?.list?.id || row?.list_id || "").trim()
      const strategyKey = normalizeStrategy(row?.strategyKey || row?.strategy)
      const count = Number(row?.count || row?.estimatedCount || row?.list?.estimated_count || 0)
      if (!listId || count <= 0) continue
      if (strategyFilters.size && !strategyFilters.has(strategyKey)) continue
      if (requestedIds.has(listId) || seenIds.has(listId)) continue
      seenIds.add(listId)
      selected.push({
        market: row?.market || [row?.city, row?.state].filter(Boolean).join(", "),
        strategyKey,
        count,
        id: Number(listId),
        title: row?.title || row?.list?.title || `VB ${strategyKey} ${row?.market || "market"}`,
        list: { id: Number(listId) },
      })
      if (selected.length >= maxLists) {
        return selected
      }
    }
  }

  return selected
}

function writeSavedListBatchFile(rows) {
  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const file = path.join(OUTREACH_DIR, `dealmachine-autoloop-saved-list-batch-${stamp}.json`)
  fs.writeFileSync(file, `${JSON.stringify({ built: rows }, null, 2)}\n`)
  return file
}

function selectStrategyWindow(rows, state, strategiesPerCycle = 1) {
  const normalizedCount = Math.max(1, Math.min(Number(strategiesPerCycle) || 1, 12))
  const availableKeys = []
  for (const row of rows) {
    const key = normalizeStrategy(row?.strategyKey)
    if (!key || availableKeys.includes(key)) continue
    availableKeys.push(key)
  }
  if (!availableKeys.length) {
    return { rows: [], selectedStrategyKeys: [] }
  }

  const lastKey = normalizeStrategy(state?.lastSavedListStrategyKey)
  let startIndex = 0
  if (lastKey) {
    const lastIndex = availableKeys.indexOf(lastKey)
    if (lastIndex >= 0) startIndex = (lastIndex + 1) % availableKeys.length
  }

  const selectedStrategyKeys = []
  for (let offset = 0; offset < Math.min(normalizedCount, availableKeys.length); offset += 1) {
    selectedStrategyKeys.push(availableKeys[(startIndex + offset) % availableKeys.length])
  }
  const selectedSet = new Set(selectedStrategyKeys)
  return {
    rows: rows.filter((row) => selectedSet.has(normalizeStrategy(row?.strategyKey))),
    selectedStrategyKeys,
  }
}

function writeLoopSummary(payload) {
  fs.mkdirSync(LOOP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const file = path.join(LOOP_DIR, `dealmachine-export-autoloop-${stamp}.json`)
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`)
  return file
}

function loadLoopState() {
  return readJson(STATE_FILE, {
    updatedAt: null,
    cyclesRun: 0,
    lastCycle: null,
    savedListBatches: [],
    outreachHistory: [],
  })
}

function saveLoopState(state) {
  fs.mkdirSync(LOOP_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
}

function keepRecent(list, limit = 50) {
  return Array.isArray(list) ? list.slice(-limit) : []
}

function fileMeta(file) {
  if (!file) return null
  try {
    const stat = fs.statSync(file)
    return {
      file,
      basename: path.basename(file),
      mtimeMs: stat.mtimeMs,
      mtimeIso: new Date(stat.mtimeMs).toISOString(),
    }
  } catch {
    return null
  }
}

async function runCycle({ send, dailyCap, followupMinAgeDays, throttleMs, includeDownloads, privateFallback }) {
  const date = todayIso()
  const loopState = loadLoopState()
  const beforeInitial = countResults("dealmachine-export-outreach-results", date)
  const beforeFollowup = countResults("dealmachine-export-followup-results", date)
  const beforeTotal = beforeInitial.ok + beforeFollowup.ok
  const savedListMaxAgeHours = intArg("--saved-list-max-age-hours", 36, 24 * 14)
  const savedListMaxLists = intArg("--saved-list-max-lists", 8, 50)
  const savedListStrategiesPerCycle = intArg("--saved-list-strategies-per-cycle", 1, 12)
  const savedListStrategies = getArg("--saved-list-strategies", "vacant-equity|land-wholesale|preforeclosure-equity|active-stale-lowball|lien-equity|tax-code-stack")
  const allowUnverifiedExport = hasFlag("--allow-unverified-export")

  let savedListBatchFile = null
  let savedListBatchCount = 0
  let selectedStrategyKeys = []
  const beforeArtifacts = {
    savedListExport: fileMeta(latestFile(OUTREACH_DIR, "dealmachine-saved-list-export-")?.file),
    initialOutreach: fileMeta(latestFile(OUTREACH_DIR, `dealmachine-export-outreach-results-${date}`)?.file),
    followupOutreach: fileMeta(latestFile(OUTREACH_DIR, `dealmachine-export-followup-results-${date}`)?.file),
    orchestrator: fileMeta(latestFile(LOOP_DIR, "dealmachine-export-orchestrator-summary")?.file),
  }

  const orchestratorArgs = ["scripts/dealmachine-export-orchestrator.mjs", "--apply"]
  if (includeDownloads) orchestratorArgs.push("--include-downloads")
  if (privateFallback) orchestratorArgs.push("--private-fallback")
  runNodeScript(orchestratorArgs[0], orchestratorArgs.slice(1))

  const afterOrchestratorSummary = latestFile(LOOP_DIR, "dealmachine-export-orchestrator-summary")

  const recentBuiltRows = collectRecentBuiltLists({
    maxAgeHours: savedListMaxAgeHours,
    maxLists: savedListMaxLists,
    strategies: savedListStrategies,
  })
  const selectedWindow = selectStrategyWindow(recentBuiltRows, loopState, savedListStrategiesPerCycle)
  selectedStrategyKeys = selectedWindow.selectedStrategyKeys
  if (selectedWindow.rows.length) {
    savedListBatchFile = writeSavedListBatchFile(selectedWindow.rows)
    savedListBatchCount = selectedWindow.rows.length
    const savedListArgs = [
      `--file=${savedListBatchFile}`,
      `--email=${DEFAULT_EXPORT_EMAIL}`,
      "--force-reexport",
    ]
    if (allowUnverifiedExport) savedListArgs.push("--allow-zero-exportable")
    if (send) savedListArgs.unshift("--send")
    runNodeScript("scripts/dealmachine-saved-list-export.mjs", savedListArgs)
  }

  const remainingBeforeFresh = Math.max(0, dailyCap - beforeTotal)

  if (send && remainingBeforeFresh > 0) {
    runNodeScript("scripts/seller-outreach-autopilot.mjs", [
      "--send",
      `--date=${date}`,
      `--daily-cap=${dailyCap}`,
      `--throttle=${throttleMs}`,
    ])
  }

  const afterInitial = countResults("dealmachine-export-outreach-results", date)
  const afterInitialTotal = afterInitial.ok + beforeFollowup.ok
  const remainingBeforeFollowup = Math.max(0, dailyCap - afterInitialTotal)

  if (send && remainingBeforeFollowup > 0) {
    runNodeScript("scripts/dealmachine-export-followup.mjs", [
      "--send",
      `--limit=${remainingBeforeFollowup}`,
      `--min-age-days=${followupMinAgeDays}`,
      `--throttle=${throttleMs}`,
    ])
  }

  const afterFollowup = countResults("dealmachine-export-followup-results", date)
  const afterTotal = afterInitial.ok + afterFollowup.ok
  const afterArtifacts = {
    savedListExport: fileMeta(latestFile(OUTREACH_DIR, "dealmachine-saved-list-export-")?.file),
    initialOutreach: fileMeta(latestFile(OUTREACH_DIR, `dealmachine-export-outreach-results-${date}`)?.file),
    followupOutreach: fileMeta(latestFile(OUTREACH_DIR, `dealmachine-export-followup-results-${date}`)?.file),
    orchestrator: fileMeta(afterOrchestratorSummary?.file),
  }
  const cycleRecord = {
    generatedAt: new Date().toISOString(),
    date,
    send,
    dailyCap,
    selectedStrategyKeys,
    savedListBatchFile,
    savedListBatchCount,
    before: {
      totalSent: beforeTotal,
      initialSent: beforeInitial.ok,
      followupSent: beforeFollowup.ok,
      artifacts: beforeArtifacts,
    },
    after: {
      totalSent: afterTotal,
      initialSent: afterInitial.ok,
      followupSent: afterFollowup.ok,
      remaining: Math.max(0, dailyCap - afterTotal),
      artifacts: afterArtifacts,
    },
  }
  const loopSummary = {
    ok: true,
    generatedAt: cycleRecord.generatedAt,
    send,
    date,
    dailyCap,
    includeDownloads,
    privateFallback,
    allowUnverifiedExport,
    before: {
      initial: beforeInitial,
      followup: beforeFollowup,
      totalSent: beforeTotal,
    },
    after: {
      initial: afterInitial,
      followup: afterFollowup,
      totalSent: afterTotal,
      remaining: Math.max(0, dailyCap - afterTotal),
    },
    savedListStrategiesPerCycle,
    selectedStrategyKeys,
    savedListBatchFile,
    savedListBatchCount,
    stateFile: STATE_FILE,
    cycleRecord,
    orchestratorSummaryFile: afterOrchestratorSummary?.file || null,
  }
  loopSummary.file = writeLoopSummary(loopSummary)
  loopState.updatedAt = loopSummary.generatedAt
  loopState.cyclesRun = Number(loopState.cyclesRun || 0) + 1
  loopState.lastCycle = cycleRecord
  if (selectedStrategyKeys.length) {
    loopState.lastSavedListStrategyKey = selectedStrategyKeys[0]
  }
  if (savedListBatchFile) {
    loopState.savedListBatches.push({
      generatedAt: cycleRecord.generatedAt,
      strategyKeys: selectedStrategyKeys,
      file: savedListBatchFile,
      count: savedListBatchCount,
      latestSavedListExportFile: afterArtifacts.savedListExport?.file || null,
    })
  }
  loopState.savedListBatches = keepRecent(loopState.savedListBatches, 100)
  loopState.outreachHistory.push({
    generatedAt: cycleRecord.generatedAt,
    date,
    totalSent: afterTotal,
    initialSent: afterInitial.ok,
    followupSent: afterFollowup.ok,
    remaining: Math.max(0, dailyCap - afterTotal),
    latestInitialOutreachFile: afterArtifacts.initialOutreach?.file || null,
    latestFollowupFile: afterArtifacts.followupOutreach?.file || null,
  })
  loopState.outreachHistory = keepRecent(loopState.outreachHistory, 100)
  saveLoopState(loopState)
  return loopSummary
}

async function main() {
  const send = hasFlag("--send")
  const loop = hasFlag("--loop")
  const iterations = intArg("--iterations", loop ? Number.MAX_SAFE_INTEGER : 1)
  const sleepSeconds = intArg("--sleep-seconds", 300, 86400)
  const dailyCap = intArg("--daily-cap", Number.parseInt(process.env.SELLER_OUTREACH_DAILY_CAP || "500", 10), 1000)
  const followupMinAgeDays = intArg("--followup-min-age-days", 2, 30)
  const throttleMs = intArg("--throttle", 1800, 30000)
  const includeDownloads = !hasFlag("--skip-downloads")
  const privateFallback = hasFlag("--private-fallback")

  runNodeScript("scripts/require-primary-machine.mjs")

  console.log("=== DealMachine export autoloop ===")
  console.log(`Mode:                ${send ? "LIVE LOOP" : "DRY LOOP"}`)
  console.log(`Iterations:          ${iterations === Number.MAX_SAFE_INTEGER ? "infinite" : iterations}`)
  console.log(`Sleep seconds:       ${sleepSeconds}`)
  console.log(`Daily cap:           ${dailyCap}`)
  console.log(`Follow-up min age:   ${followupMinAgeDays} days`)
  console.log(`Include downloads:   ${includeDownloads ? "yes" : "no"}`)
  console.log(`Private fallback:    ${privateFallback ? "yes" : "no"}`)
  console.log(`Strategies/cycle:    ${intArg("--saved-list-strategies-per-cycle", 1, 12)}`)

  let cycle = 0
  while (cycle < iterations) {
    cycle += 1
    console.log(`\n--- cycle ${cycle} ---`)
    const summary = await runCycle({
      send,
      dailyCap,
      followupMinAgeDays,
      throttleMs,
      includeDownloads,
      privateFallback,
    })
    console.log(JSON.stringify(summary, null, 2))
    if (!loop || cycle >= iterations) break
    await sleep(sleepSeconds * 1000)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
