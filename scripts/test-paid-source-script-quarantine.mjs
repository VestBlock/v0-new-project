import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  REAL_SOURCE_DRY_RUN_QUARANTINE_REASON,
  runRealSourceAdapterV4,
} from '../lib/leads/outreach-v4/source-adapters.mjs'

const originalFetch = globalThis.fetch
let networkCalled = false
globalThis.fetch = async () => {
  networkCalled = true
  throw new Error('network_should_not_be_called')
}

try {
  const result = await runRealSourceAdapterV4(
    {
      verticalId: 'ai_receptionist',
      label: 'AI receptionist',
      markets: [{ city: 'Chicago', state: 'IL', marketKey: 'chicago-il' }],
    },
    {
      provider: 'google_places',
      limitPerNiche: 10,
      nicheLimit: 5,
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.skipped, true)
  assert.equal(result.reason, REAL_SOURCE_DRY_RUN_QUARANTINE_REASON)
  assert.equal(networkCalled, false)
} finally {
  globalThis.fetch = originalFetch
}

const dryRun = spawnSync(process.execPath, ['scripts/outreach-v4-dry-run.mjs', '--real-source'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    GOOGLE_PLACES_API_KEY: 'test-key-that-must-not-be-used',
    OUTSCRAPER_API_KEY: 'test-key-that-must-not-be-used',
    ALLOW_PAID_SCRAPING: 'true',
    LEADS_ENABLE_OUTSCRAPER: 'true',
  },
  encoding: 'utf8',
})

assert.equal(dryRun.status, 1)
assert.match(dryRun.stderr, new RegExp(REAL_SOURCE_DRY_RUN_QUARANTINE_REASON))

const institutionalHunterRun = spawnSync(
  process.execPath,
  [
    'scripts/enrich-institutional-buyer-contacts.mjs',
    '--input',
    path.join(process.cwd(), 'data', 'institutional-buyers', 'must-not-be-read.csv'),
  ],
  {
    cwd: process.cwd(),
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

const workflowSource = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'outreach-v4-workflow.mjs'),
  'utf8'
)
assert.equal(workflowSource.includes("'--real-source'"), false)
assert.equal(workflowSource.includes("'--real-source-only'"), false)

console.log('paid-source-script-quarantine: ok')
