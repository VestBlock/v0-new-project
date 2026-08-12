import fs from "node:fs"
import path from "node:path"

export const ALL_DEALMACHINE_STRATEGIES = [
  "divorce-separation",
  "relocation-job-transfer",
  "out-of-state-heir",
  "senior-downsizing-medical",
  "fire-storm-damage",
  "problem-tenant-eviction",
  "seller-finance-equity",
  "tax-code-stack",
  "vacant-equity",
  "land-wholesale",
  "portfolio-landlord",
  "tired-landlord",
  "vacant-property-refresh",
  "code-violation-distress",
  "tax-delinquent-cure",
  "fsbo-conversion",
  "failed-flipper-stuck-rehab",
  "hoa-delinquent",
  "reverse-mortgage-exit",
  "title-issue-cloud",
  "post-auction-backup-buyer",
  "preforeclosure-equity",
  "probate-inheritance",
  "expired-lowball",
  "active-stale-lowball",
  "lien-equity",
]

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
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

function ensureBucket(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      strategyKey: key,
      builderRuns: 0,
      builtLists: 0,
      builtLeadEstimate: 0,
      hydrationPending: 0,
      exportChecks: 0,
      exportableContacts: 0,
      zeroExportChecks: 0,
      exportRequests: 0,
      exportSuccesses: 0,
      exportSchemaRejects: 0,
      outreachRuns: 0,
      outreachSent: 0,
      outreachFailed: 0,
      markets: new Set(),
      lastSeenAt: null,
    })
  }
  return map.get(key)
}

function markSeen(bucket, iso, market) {
  if (market) bucket.markets.add(String(market).trim())
  if (iso && (!bucket.lastSeenAt || iso > bucket.lastSeenAt)) bucket.lastSeenAt = iso
}

function scoreStrategy(bucket) {
  let score = 50
  if (bucket.exportableContacts > 0) score += 30
  if (bucket.exportSuccesses > 0) score += 12
  if (bucket.outreachSent > 0) score += 8
  if (bucket.zeroExportChecks > 0 && bucket.exportableContacts === 0) score -= Math.min(25, bucket.zeroExportChecks * 5)
  if (bucket.exportSchemaRejects > 0) score -= Math.min(30, bucket.exportSchemaRejects * 10)
  if (bucket.hydrationPending > 0 && bucket.exportableContacts === 0) score -= Math.min(12, bucket.hydrationPending * 3)
  if (bucket.outreachFailed > 0) score -= Math.min(10, bucket.outreachFailed * 2)
  if (!bucket.builderRuns && !bucket.exportChecks && !bucket.outreachRuns) score -= 5
  return Math.max(0, Math.min(100, score))
}

export function loadDealMachineStrategyLearning(root, options = {}) {
  const outreachDir = path.join(root, "tmp", "outreach")
  const stateDir = path.join(root, "data", "operating-loops")
  const limit = Number.isFinite(options.limit) ? options.limit : 40
  const strategyMap = new Map()

  const builderFiles = newestMatchingFiles(outreachDir, /^dealmachine-website-list-builder-.*\.json$/i, limit)
  for (const entry of builderFiles) {
    const parsed = readJson(entry.file, {})
    const built = Array.isArray(parsed?.built) ? parsed.built : []
    for (const row of built) {
      const key = normalizeSlug(row?.strategyKey || row?.strategy)
      if (!key) continue
      const bucket = ensureBucket(strategyMap, key)
      bucket.builderRuns += 1
      bucket.builtLists += 1
      bucket.builtLeadEstimate += Number(row?.count || row?.estimatedCount || row?.list?.estimated_count || 0)
      if (row?.hydrationPending) bucket.hydrationPending += 1
      markSeen(bucket, parsed?.finishedAt || parsed?.startedAt || null, row?.market)
    }
  }

  const exportFiles = newestMatchingFiles(outreachDir, /^dealmachine-export-lists-.*\.json$/i, limit)
  for (const entry of exportFiles) {
    const parsed = readJson(entry.file, {})
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : []
    for (const row of rows) {
      const key = normalizeSlug(row?.strategyKey || row?.strategy)
      if (!key) continue
      const bucket = ensureBucket(strategyMap, key)
      bucket.exportChecks += 1
      bucket.exportableContacts += Number(row?.actualCount || 0)
      if (Number(row?.actualCount || 0) <= 0) bucket.zeroExportChecks += 1
      if (row?.exported) bucket.exportSuccesses += 1
      if (row?.exportStatus) bucket.exportRequests += 1
      markSeen(bucket, parsed?.finishedAt || parsed?.startedAt || null, row?.market)
    }
  }

  const savedListFiles = newestMatchingFiles(outreachDir, /^dealmachine-saved-list-export-.*\.json$/i, limit)
  for (const entry of savedListFiles) {
    const parsed = readJson(entry.file, {})
    const rows = Array.isArray(parsed?.results) ? parsed.results : []
    for (const row of rows) {
      const key = normalizeSlug(row?.strategyKey || row?.strategy)
      if (!key) continue
      const bucket = ensureBucket(strategyMap, key)
      bucket.exportChecks += 1
      bucket.exportableContacts += Number(row?.actualCount || 0)
      if (Number(row?.actualCount || 0) <= 0) bucket.zeroExportChecks += 1
      if (row?.requested) {
        bucket.exportRequests += 1
        bucket.exportSuccesses += 1
      }
      if (row?.acceptedUnverified || row?.exportBlockReason) bucket.exportSchemaRejects += 1
      markSeen(bucket, parsed?.finishedAt || parsed?.startedAt || null, row?.market)
    }
  }

  const jobSummary = readJson(path.join(stateDir, "dealmachine-export-jobs-summary.json"), {})
  for (const job of Array.isArray(jobSummary?.recentlyUpdated) ? jobSummary.recentlyUpdated : []) {
    const key = normalizeSlug(job?.strategyKey)
    if (!key || job?.status !== "export_rejected") continue
    const bucket = ensureBucket(strategyMap, key)
    bucket.exportSchemaRejects += 1
    markSeen(bucket, job?.updatedAt || job?.exportRejectedAt || null, job?.market)
  }

  const outreachFiles = newestMatchingFiles(outreachDir, /^dealmachine-export-outreach-results-.*\.json$/i, limit)
  for (const entry of outreachFiles) {
    const parsed = readJson(entry.file, [])
    const rows = Array.isArray(parsed) ? parsed : []
    for (const row of rows) {
      const key = normalizeSlug(row?.strategy)
      if (!key) continue
      const bucket = ensureBucket(strategyMap, key)
      bucket.outreachRuns += 1
      if (row?.ok) bucket.outreachSent += 1
      else bucket.outreachFailed += 1
      markSeen(bucket, row?.sent_at || row?.created_at || null, row?.market)
    }
  }

  const summary = Array.from(strategyMap.values())
    .map((bucket) => ({
      ...bucket,
      markets: [...bucket.markets].sort(),
      readinessScore: scoreStrategy(bucket),
    }))
    .sort((left, right) => right.readinessScore - left.readinessScore || left.strategyKey.localeCompare(right.strategyKey))

  const payload = {
    generatedAt: new Date().toISOString(),
    strategies: summary,
    totalStrategiesObserved: summary.length,
    allStrategies: ALL_DEALMACHINE_STRATEGIES,
    coveredStrategies: summary.map((row) => row.strategyKey),
    missingStrategies: ALL_DEALMACHINE_STRATEGIES.filter((key) => !summary.some((row) => row.strategyKey === key)),
  }

  fs.mkdirSync(stateDir, { recursive: true })
  const outFile = path.join(stateDir, "dealmachine-strategy-learning.json")
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`)
  return { ...payload, file: outFile }
}
