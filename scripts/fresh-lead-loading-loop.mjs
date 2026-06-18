#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const getArg = (name, fallback = '') => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=').trim() : fallback
}
const hasFlag = (name) => args.includes(`--${name}`)
const ROOT = process.cwd()
const DATE = new Date().toISOString().slice(0, 10)
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const DEFAULT_MARKETS = 'Tulsa,OK|Oklahoma City,OK|Wichita,KS|Omaha,NE|Des Moines,IA|Fort Wayne,IN|South Bend,IN|Peoria,IL|Springfield,MO|Evansville,IN'
const DEFAULT_OUTSCRAPER_LANES = 'buyer-developer|land-developers|investor-network|lender-network|wholesaler-network|acquisition-manager-network|property-manager-network|fire-damage-builders|county-records'
const markets = getArg('markets', DEFAULT_MARKETS)
const outscraperLanes = getArg('outscraper-lanes', DEFAULT_OUTSCRAPER_LANES).split('|').map((lane) => lane.trim()).filter(Boolean)
const sellerLimit = getArg('seller-limit', '120')
const runOutscraper = !hasFlag('skip-outscraper') && !hasFlag('verify-only')
const runSellers = !hasFlag('skip-sellers') && !hasFlag('verify-only')
const runDealMachine = hasFlag('dealmachine') && !hasFlag('verify-only')

function run(label, command, commandArgs, options = {}) {
  console.log(`\n=== ${label} ===`)
  console.log([command, ...commandArgs].join(' '))
  const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit', env: process.env, ...options })
  return { label, ok: result.status === 0, status: result.status, signal: result.signal }
}
function latestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || ''
}
function ensureHomeHarvest() {
  const python = path.join(ROOT, '.venv-homeharvest', 'bin', 'python')
  if (fs.existsSync(python)) return { label: 'homeharvest-env', ok: true, skipped: true }
  const created = run('Create HomeHarvest env', 'python3', ['-m', 'venv', '.venv-homeharvest'])
  if (!created.ok) return created
  const pip = run('Install HomeHarvest', python, ['-m', 'pip', 'install', '--upgrade', 'pip', 'homeharvest'])
  return pip
}
async function verify() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ok: false, error: 'Missing Supabase admin env vars.' }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  async function count(table, q) {
    const result = await q(supabase.from(table).select('id', { count: 'exact', head: true }))
    if (result.error) throw result.error
    return result.count ?? 0
  }
  const since = `${DATE}T00:00:00.000Z`
  const laneCounts = {}
  for (const lane of outscraperLanes.filter((lane) => lane !== 'county-records')) {
    laneCounts[lane] = await count('buyers', (q) => q.eq('source', 'outscraper_google_maps_businesses').contains('metadata_json', { lane }).gte('updated_at', since))
  }
  return {
    ok: true,
    sellerLeads: await count('leads', (q) => q.eq('source', 'homeharvest_stale_listing').gte('imported_at', since)),
    sellerMessages: await count('outreach_messages', (q) => q.eq('generated_with', 'homeharvest_stale_listing_import').eq('status', 'needs_review').gte('created_at', since)),
    queuedSellerEvents: await count('outreach_send_events', (q) => q.eq('provider', 'vestblock_queue').eq('status', 'queued').eq('metadata_json->>source', 'homeharvest_stale_listing_import').gte('created_at', since)),
    buyerTouchScripts: await count('buyer_outreach_messages', (q) => q.eq('generated_with', 'outscraper_import_loader').eq('status', 'needs_review').gte('created_at', since)),
    countySources: await count('lead_sources', (q) => q.eq('source_type', 'outscraper_public_record_source').gte('created_at', since)),
    laneCounts,
  }
}
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const startedAt = new Date().toISOString()
  const steps = []
  steps.push(ensureHomeHarvest())

  if (runSellers) {
    steps.push(run('Fresh seller stale-listing harvest', 'node', [
      '--env-file=.env.local',
      'scripts/stale-listing-finder.mjs',
      '--source=homeharvest',
      '--offer-mode=lowball',
      `--market=${markets}`,
      '--min-dom=30',
      '--distress-threshold=8',
      '--price-max=450000',
      '--harvest-limit-per-market=80',
      `--limit=${sellerLimit}`,
      '--skip-analyzer',
    ]))
    const draftJson = latestFile(path.join(ROOT, 'tmp', 'outreach'), /^stale-listing-drafts-.*\.json$/i)
    if (draftJson) steps.push(run('Import stale-listing sellers to command center', 'node', ['--env-file=.env.local', 'scripts/import-stale-listing-seller-leads.mjs', `--input=${draftJson}`]))
    else steps.push({ label: 'Import stale-listing sellers to command center', ok: false, error: 'No stale-listing draft JSON found.' })
  }

  if (runOutscraper) {
    for (const lane of outscraperLanes) {
      steps.push(run(`OutScraper ${lane}`, 'node', [
        '--env-file=.env.local',
        'scripts/outscraper-real-estate-discovery.mjs',
        '--run',
        `--lane=${lane}`,
        `--market=${markets}`,
        '--max-niches=5',
        '--limit-per-niche=2',
        '--timeout-ms=60000',
      ]))
      const csv = latestFile(path.join(ROOT, 'artifacts', 'outscraper', DATE, lane), new RegExp(`^outscraper-${lane}-.*\\.csv$`, 'i'))
      if (csv) steps.push(run(`Import ${lane} to command center`, 'node', ['--env-file=.env.local', 'scripts/import-outsourced-real-estate-leads.mjs', `--input=${csv}`, `--lane=${lane}`]))
      else steps.push({ label: `Import ${lane} to command center`, ok: false, error: 'No OutScraper CSV found.' })
    }
  }

  if (runDealMachine) {
    const chromeSessionEnv = { ...process.env, DEALMACHINE_WEB_TOKEN: '' }
    const dm = run('DealMachine saved-list builder', 'node', ['scripts/dealmachine-website-list-builder.mjs', '--build', '--max-builds=8', `--markets=${markets}`, '--strategies=tax-code-stack|vacant-equity|portfolio-landlord|preforeclosure-equity|tax-remote-equity-rotation'], { env: chromeSessionEnv })
    if (!dm.ok) dm.blocker = 'If Chrome says JavaScript from Apple Events is off, open Chrome on the Pro, go to View > Developer > Allow JavaScript from Apple Events, then rerun with --dealmachine.'
    steps.push(dm)
  }

  let verification = null
  try { verification = await verify() } catch (error) { verification = { ok: false, error: error instanceof Error ? error.message : String(error) } }
  const finishedAt = new Date().toISOString()
  const report = { ok: steps.every((step) => step.ok), startedAt, finishedAt, markets, outscraperLanes, runSellers, runOutscraper, runDealMachine, steps, verification }
  const reportPath = path.join(OUT_DIR, `fresh-lead-loading-loop-${finishedAt.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log('\n=== Fresh lead loading loop summary ===')
  console.log(JSON.stringify({ ok: report.ok, reportPath, verification }, null, 2))
  if (!report.ok) process.exitCode = 1
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1) })
