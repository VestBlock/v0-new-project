#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { gunzipSync } from 'node:zlib'

import {
  createDealMachineV2Client,
  dealMachineApiKey,
  downloadDealMachineExportFile,
  isDealMachineCredentialFormat,
} from '../lib/dealmachine/v2-client.mjs'
import {
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  hydrateStrategyPlan,
} from '../lib/dealmachine/v2-strategy-catalog.mjs'

const ROOT = process.cwd()

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback
}

function flag(name) {
  return process.argv.includes(`--${name}`)
}

function intOption(name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const value = Number.parseInt(option(name), 10)
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function csvCell(value) {
  const string = value === null || value === undefined
    ? ''
    : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string
}

function flattenSearchRows(payload, plan) {
  const rows = []
  for (const raw of Array.isArray(payload?.data) ? payload.data : []) {
    const peopleAnchor = plan.anchor === 'people'
    const property = peopleAnchor ? raw.property || {} : raw
    const contacts = peopleAnchor ? [raw] : Array.isArray(raw.contacts) ? raw.contacts : []
    const emittedContacts = contacts.length ? contacts : [{}]
    for (const contact of emittedContacts) {
      rows.push({
        dm_property_id: property.dm_property_id || '',
        dm_person_id: contact.dm_person_id || '',
        full_address: property.full_address || '',
        property_city: property.city || '',
        property_state: property.state || '',
        property_zip: property.zip || '',
        full_name: contact.full_name || property.owner_1_full_name || '',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        mailing_address: contact.residence?.full_address || raw.residence?.full_address || '',
        phones: contact.phones || [],
        emails: contact.emails || [],
        ...Object.fromEntries(DEALMACHINE_STRATEGY_FIELDS.map((field) => [field, property[field] ?? ''])),
      })
    }
  }
  return rows
}

function rowsToCsv(rows) {
  if (!rows.length) return ''
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n'
}

function countFromPayload(payload) {
  return Number(
    payload?.total_results ||
      payload?.totals?.properties ||
      payload?.totals?.people ||
      payload?.data?.total_results ||
      0
  )
}

function estimatedCredits(payload, allPages = false) {
  return Number(
    allPages
      ? payload?.estimated_credits?.total_all_pages || payload?.estimated_credits?.this_page || 0
      : payload?.estimated_credits?.this_page || 0
  )
}

function redactedAccount(payload) {
  const data = payload?.data || payload || {}
  return {
    organization: data.organization_name || data.name || null,
    plan: data.plan_name || data.plan || data.subscription?.name || null,
    status: data.status || data.subscription?.status || null,
  }
}

function runIngest(csvPath, manifestPath, dryRun) {
  const args = [
    'exec',
    'ts-node',
    '-r',
    'tsconfig-paths/register',
    '--compiler-options',
    '{"module":"commonjs","moduleResolution":"node"}',
    'scripts/dealmachine-v2-ingest.ts',
    `--csv=${csvPath}`,
    `--manifest=${manifestPath}`,
  ]
  if (dryRun) args.push('--dry-run')
  const result = spawnSync('pnpm', args, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'DealMachine v2 ingestion failed.')
  return JSON.parse(result.stdout)
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`)
}

async function main() {
  const mode = option('mode', 'plan')
  if (!['plan', 'search', 'export'].includes(mode)) throw new Error('--mode must be plan, search, or export.')
  const apiKey = dealMachineApiKey()
  if (!isDealMachineCredentialFormat(apiKey)) {
    throw new Error('DEALMACHINE_API_KEY must contain the full one-time dm_sk_live_* or dm_at_live_* secret.')
  }

  const date = option('date', new Date().toISOString().slice(0, 10))
  const requestedStrategies = option('strategies')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const includeLowball = flag('include-lowball')
  const apply = flag('apply')
  const force = flag('force')
  const maxStrategies = intOption('max-strategies', 17, 1, 17)
  const perPage = intOption('per-page', 25, 1, 250)
  const maxRecordsPerStrategy = intOption('max-records-per-strategy', 100, 1, 5_000)
  const dailyCreditBudget = intOption('daily-credit-budget', Number(process.env.DEALMACHINE_DAILY_CREDIT_BUDGET || 500), 1, 100_000)
  const outputRoot = path.resolve(option('output-dir', path.join('data', 'dm-exports', 'v2', date)))
  const reportDir = path.resolve('reports', 'dealmachine-v2')
  const stateFile = path.resolve('data', 'operating-loops', 'dealmachine-v2-strategy-state.json')
  const lockPath = path.resolve('data', 'dm-exports', '.dealmachine-v2-export.lock')
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.mkdirSync(reportDir, { recursive: true })

  const client = createDealMachineV2Client({ apiKey })
  const startedAt = new Date().toISOString()
  const state = readJson(stateFile, { contractVersion: 2, updatedAt: null, completed: {} })
  const spentToday = Object.values(state.completed || {})
    .filter((entry) => entry?.date === date)
    .reduce((total, entry) => total + Number(entry.creditsUsed || 0), 0)
  const report = {
    mode,
    apply,
    date,
    startedAt,
    completedAt: null,
    account: null,
    budget: { dailyCreditBudget, previouslyUsedCredits: spentToday, reservedCredits: spentToday, maxRecordsPerStrategy },
    lowball: { included: includeLowball, capShare: 0.05, defaultEnabled: false },
    strategies: [],
    totals: { planned: 0, searched: 0, exported: 0, downloadedFiles: 0, rows: 0, ingested: 0, skipped: 0, failed: 0 },
  }

  const [account, propertyFilters, peopleFilters, propertyFields, peopleFields] = await Promise.all([
    client.account(),
    client.listFilters('properties'),
    client.listFilters('people'),
    client.listFields('properties'),
    client.listFields('people'),
  ])
  report.account = redactedAccount(account)
  const filterMetadata = [...propertyFilters, ...peopleFilters]
  const availableFields = new Set([...propertyFields, ...peopleFields].map((row) => String(row.field_id || '')))
  const plans = buildDailyStrategyPlans({
    date,
    strategyKeys: requestedStrategies,
    includeDisabled: includeLowball,
    includeLowball,
  }).slice(0, maxStrategies)
  const nonLowballCapacity = plans.filter((plan) => !plan.lowball).length * perPage
  const lowballPageSize = Math.max(1, Math.min(perPage, Math.floor((nonLowballCapacity * 0.05) / 0.95)))
  report.totals.planned = plans.length

  let exportLock = null
  if (mode === 'export') {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true })
    exportLock = fs.openSync(lockPath, 'wx')
    fs.writeFileSync(exportLock, JSON.stringify({ pid: process.pid, startedAt }))
  }

  try {
    for (const plan of plans) {
      const entry = {
        strategyKey: plan.key,
        market: plan.market,
        variant: plan.variant.key,
        reviewOnly: plan.reviewOnly,
        candidateOnly: plan.candidateOnly,
        lowball: plan.lowball,
        status: 'planned',
        matched: 0,
        estimatedCredits: 0,
        creditsUsed: 0,
        rows: 0,
        files: [],
        ingested: 0,
        warnings: [],
        error: null,
      }
      report.strategies.push(entry)
      try {
        const hydrated = await hydrateStrategyPlan(client, plan, filterMetadata)
        const planPageSize = plan.lowball ? lowballPageSize : perPage
        const runKey = `${date}:${plan.key}:${plan.market}:${plan.variant.key}`
        if (mode !== 'plan' && state.completed?.[runKey] && !force) {
          entry.status = 'skipped_already_completed'
          entry.warnings.push('The paid daily lane ledger already contains this exact strategy/city/variant run.')
          report.totals.skipped += 1
          continue
        }
        const fields = DEALMACHINE_STRATEGY_FIELDS.filter((field) => availableFields.has(field))
        hydrated.searchBody.fields = fields
        hydrated.exportBody.fields = fields
        entry.warnings.push(...hydrated.warnings)
        const count = await client.countProperties({
          locations: hydrated.searchBody.locations,
          filters: hydrated.searchBody.filters,
          anchor: hydrated.searchBody.anchor,
          contact_audience: hydrated.searchBody.contact_audience,
          exclude_previously_exported: hydrated.searchBody.exclude_previously_exported,
        })
        entry.matched = countFromPayload(count)
        const requestedRows = mode === 'export' ? Math.max(1, entry.matched) : planPageSize
        const estimate = await client.estimatePropertySearch({
          ...hydrated.searchBody,
          page: 1,
          per_page: Math.min(250, requestedRows),
        })
        entry.estimatedCredits = estimatedCredits(estimate, mode === 'export')

        const manifestDir = path.join(outputRoot, slug(plan.key), slug(plan.market), slug(plan.variant.key))
        fs.mkdirSync(manifestDir, { recursive: true })
        const manifestPath = path.join(manifestDir, 'manifest.json')
        const manifest = {
          contractVersion: 2,
          provider: 'dealmachine',
          apiFamily: 'official-v2',
          mode,
          strategyKey: plan.key,
          strategyLabel: plan.label,
          variant: plan.variant.key,
          signals: plan.variant.signals,
          candidateOnly: plan.candidateOnly,
          candidateReason: plan.candidateReason || null,
          reviewOnly: plan.reviewOnly,
          lowball: plan.lowball,
          market: plan.market,
          location: hydrated.location,
          filters: hydrated.filters,
          matched: entry.matched,
          estimatedCredits: entry.estimatedCredits,
          sourceObservedAt: new Date().toISOString(),
          exportId: null,
          files: [],
        }

        if (mode === 'plan') {
          entry.status = 'estimated'
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          continue
        }
        if (!entry.matched) {
          entry.status = 'empty'
          report.totals.skipped += 1
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          if (mode !== 'plan') {
            state.completed[runKey] = {
              date,
              strategyKey: plan.key,
              market: plan.market,
              variant: plan.variant.key,
              mode,
              status: 'empty',
              rows: 0,
              creditsUsed: 0,
              completedAt: new Date().toISOString(),
              reportPath: null,
            }
            state.updatedAt = new Date().toISOString()
            saveState(stateFile, state)
          }
          continue
        }
        if (mode === 'export' && plan.lowball) {
          entry.status = 'skipped_lowball_export'
          entry.warnings.push('Conditional-cash records use bounded search mode so they cannot exceed the 5% acquisition cap.')
          report.totals.skipped += 1
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          continue
        }
        if (mode === 'export' && entry.matched > maxRecordsPerStrategy) {
          entry.status = 'skipped_oversized'
          entry.warnings.push(`Matched ${entry.matched}; direct export cap is ${maxRecordsPerStrategy}. Use search mode or narrow filters.`)
          report.totals.skipped += 1
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          continue
        }
        if (report.budget.reservedCredits + entry.estimatedCredits > dailyCreditBudget) {
          entry.status = 'skipped_budget'
          entry.warnings.push('Estimated credits would exceed the configured daily budget.')
          report.totals.skipped += 1
          fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          continue
        }

        report.budget.reservedCredits += entry.estimatedCredits
        const csvPaths = []
        if (mode === 'search') {
          const payload = await client.searchProperties({ ...hydrated.searchBody, page: 1, per_page: planPageSize })
          const rows = flattenSearchRows(payload, hydrated)
          const csvPath = path.join(manifestDir, 'search-results.csv')
          fs.writeFileSync(csvPath, rowsToCsv(rows))
          csvPaths.push(csvPath)
          entry.rows = rows.length
          entry.creditsUsed = Number(payload?.credits?.used || entry.estimatedCredits)
          entry.status = 'searched'
          report.totals.searched += 1
          report.totals.rows += rows.length
        } else {
          const payload = await client.exportProperties(hydrated.exportBody)
          manifest.exportId = payload?.export_id || payload?.data?.export_id || null
          entry.creditsUsed = Number(payload?.credits?.used || payload?.data?.credits?.used || entry.estimatedCredits)
          entry.rows = Number(payload?.record_count || payload?.data?.record_count || 0)
          for (const download of client.downloadUrls(payload)) {
            const gzPath = path.join(manifestDir, path.basename(download.filename))
            const gz = await downloadDealMachineExportFile(download)
            fs.writeFileSync(gzPath, gz)
            const csvPath = gzPath.replace(/\.gz$/i, '')
            fs.writeFileSync(csvPath, gunzipSync(gz))
            csvPaths.push(csvPath)
            entry.files.push({ gzPath, csvPath, bytes: gz.length })
            manifest.files.push({ gzPath, csvPath, bytes: gz.length })
            report.totals.downloadedFiles += 1
          }
          entry.status = 'exported'
          report.totals.exported += 1
          report.totals.rows += entry.rows
        }

        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        if (apply) {
          for (const csvPath of csvPaths) {
            const result = runIngest(csvPath, manifestPath, false)
            entry.ingested += Number(result.ingested || 0)
          }
          report.totals.ingested += entry.ingested
          entry.status = `${entry.status}_ingested`
        }
        state.completed[runKey] = {
          date,
          strategyKey: plan.key,
          market: plan.market,
          variant: plan.variant.key,
          mode,
          status: entry.status,
          rows: entry.rows,
          ingested: entry.ingested,
          creditsUsed: entry.creditsUsed,
          completedAt: new Date().toISOString(),
          manifestPath,
        }
        state.updatedAt = new Date().toISOString()
        saveState(stateFile, state)
      } catch (error) {
        entry.status = 'failed'
        entry.error = error instanceof Error ? error.message : String(error)
        report.totals.failed += 1
      }
    }
  } finally {
    if (exportLock !== null) fs.closeSync(exportLock)
    if (mode === 'export' && fs.existsSync(lockPath)) fs.unlinkSync(lockPath)
  }

  report.completedAt = new Date().toISOString()
  const reportPath = path.join(reportDir, `${date}-${mode}-${Date.now()}.json`)
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  for (const entry of Object.values(state.completed || {})) {
    if (entry?.date === date && !entry.reportPath) entry.reportPath = reportPath
  }
  state.updatedAt = new Date().toISOString()
  saveState(stateFile, state)
  process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`)
  if (report.totals.failed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
