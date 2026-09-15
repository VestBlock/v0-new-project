import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const freshLoopSource = fs.readFileSync(
  path.join(root, 'scripts', 'fresh-lead-loading-loop.mjs'),
  'utf8'
)

assert.match(
  freshLoopSource,
  /const runOutscraper = hasFlag\('outscraper-preview'\) && !hasFlag\('verify-only'\)/
)
assert.doesNotMatch(
  freshLoopSource,
  /'scripts\/outscraper-real-estate-discovery\.mjs',\s*'--run'/s
)

const directRun = spawnSync(
  process.execPath,
  [
    'scripts/outscraper-real-estate-discovery.mjs',
    '--run',
    '--lane=buyer-developer',
    '--market=Chicago,IL',
    '--max-niches=999999',
    '--limit-per-niche=999999',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      ALLOW_PAID_SCRAPING: 'true',
      LEADS_ENABLE_OUTSCRAPER: 'true',
      OUTSCRAPER_API_KEY: 'test-key-that-must-not-be-used',
      OUTSCRAPER_API_BASE_URL: 'http://127.0.0.1:9',
    },
    encoding: 'utf8',
  }
)

assert.equal(directRun.status, 1)
assert.match(directRun.stderr, /legacy_outscraper_live_run_quarantined/)
assert.doesNotMatch(directRun.stdout, /LIVE OUTSCRAPER RUN/)

const staleListingRun = spawnSync(
  process.execPath,
  [
    'scripts/stale-listing-finder.mjs',
    '--source=outscraper',
    '--market=Chicago,IL|Milwaukee,WI',
    '--limit=999999',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      ALLOW_PAID_SCRAPING: 'true',
      LEADS_ENABLE_OUTSCRAPER: 'true',
      OUTSCRAPER_API_KEY: 'test-key-that-must-not-be-used',
      OUTSCRAPER_API_BASE_URL: 'http://127.0.0.1:9',
    },
    encoding: 'utf8',
  }
)

assert.equal(staleListingRun.status, 1)
assert.match(staleListingRun.stderr, /legacy_stale_listing_outscraper_quarantined/)
assert.doesNotMatch(staleListingRun.stdout, /Outscraper Zillow/)

const hunterV4Run = spawnSync(
  process.execPath,
  ['scripts/outreach-v4-dry-run.mjs', '--enrich-missing-email', '--enrichment-limit=100'],
  {
    cwd: root,
    env: {
      ...process.env,
      HUNTER_API_KEY: 'test-key-that-must-not-be-used',
    },
    encoding: 'utf8',
  }
)

assert.equal(hunterV4Run.status, 1)
assert.match(hunterV4Run.stderr, /legacy_hunter_domain_enrichment_quarantined/)

const institutionalHunterRun = spawnSync(
  process.execPath,
  [
    'scripts/enrich-institutional-buyer-contacts.mjs',
    '--input',
    path.join(root, 'data', 'institutional-buyers', 'must-not-be-read.csv'),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      HUNTER_API_KEY: 'test-key-that-must-not-be-used',
    },
    encoding: 'utf8',
  }
)

assert.equal(institutionalHunterRun.status, 1)
assert.match(institutionalHunterRun.stderr, /legacy_hunter_institutional_enrichment_quarantined/)
assert.doesNotMatch(institutionalHunterRun.stderr, /ENOENT|no such file/i)
assert.equal(institutionalHunterRun.stdout, '')

const preforeclosureSource = fs.readFileSync(
  path.join(root, 'scripts', 'preforeclosure-public-osint-enrich.mjs'),
  'utf8'
)
assert.match(preforeclosureSource, /legacy_hunter_domain_search_quarantined/)
assert.doesNotMatch(preforeclosureSource, /api\.hunter\.io/)

console.log('legacy-paid-source-quarantine: ok')
