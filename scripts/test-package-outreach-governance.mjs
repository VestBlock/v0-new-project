import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  GOVERNED_OUTREACH_DISPATCH_COMMAND,
  LEGACY_OUTREACH_QUARANTINE_CODE,
  quarantineLegacyDirectLiveSend,
} from './lib/legacy-outreach-quarantine.mjs'

const root = process.cwd()
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const packageJson = JSON.parse(source('package.json'))
const scripts = packageJson.scripts || {}

assert.doesNotThrow(() =>
  quarantineLegacyDirectLiveSend({ requested: false, entry: 'safe-preview' })
)
assert.throws(
  () => quarantineLegacyDirectLiveSend({ requested: true, entry: 'unsafe-live-entry' }),
  (error) =>
    error?.code === LEGACY_OUTREACH_QUARANTINE_CODE &&
    error.message.includes(GOVERNED_OUTREACH_DISPATCH_COMMAND)
)

assert.match(scripts['outreach:dispatch'], /scripts\/governed-outreach-dispatch\.mjs --dry-run/)
assert.match(scripts['outreach:dispatch:live'], /scripts\/governed-outreach-dispatch\.mjs --send/)

const quarantinedLiveAliases = [
  'vestblock:master-loop:send',
  'relationships:landbank-reo:send',
  'buyers:kimi-send-approved',
  'buyers:fire-damage-kc:send',
  'outreach:v4-send-approved:live',
  'sellers:on-market-lowball:send',
  'sellers:on-market-creative:send',
  'sellers:on-market-creative:daily:send',
  'distress:dealmachine:export-autoloop:send',
]

for (const name of quarantinedLiveAliases) {
  assert.match(
    scripts[name] || '',
    /scripts\/quarantine-legacy-live-send\.mjs/,
    `${name} must remain quarantined instead of invoking a legacy provider`
  )
}

const guardedProviderScripts = [
  'scripts/dealmachine-export-outreach.mjs',
  'scripts/dealmachine-export-followup.mjs',
  'scripts/developer-partner-outreach.mjs',
  'scripts/fire-damage-buyer-outreach.mjs',
  'scripts/institutional-buybox-outreach.mjs',
  'scripts/land-buyer-backed-agent-outreach.mjs',
  'scripts/landbank-reo-relationship-campaign.mjs',
  'scripts/outreach-v4-send-approved.mjs',
  'scripts/send-buyer-criteria-drafts.mjs',
  'scripts/send-csv-buyer-outreach.mjs',
  'scripts/stale-listing-finder.mjs',
]

const directProviderInventory = fs
  .readdirSync(path.join(root, 'scripts'))
  .filter((name) => name.endsWith('.mjs') && !name.startsWith('test-'))
  .map((name) => `scripts/${name}`)
  .filter((relativePath) => /new Resend\b|\.emails\.send\(/.test(source(relativePath)))
  .sort()

assert.deepEqual(
  directProviderInventory,
  [...guardedProviderScripts, 'scripts/dealmachine-owner-email.mjs'].sort(),
  'every standalone direct email-provider script must be quarantined or permanently disabled'
)

const directHunterProviderInventory = fs
  .readdirSync(path.join(root, 'scripts'))
  .filter((name) => name.endsWith('.mjs') && !name.startsWith('test-'))
  .map((name) => `scripts/${name}`)
  .filter((relativePath) => /api\.hunter\.io/.test(source(relativePath)))
  .sort()

assert.deepEqual(
  directHunterProviderInventory,
  ['scripts/enrich-institutional-buyer-contacts.mjs'],
  'every standalone direct Hunter script must be permanently quarantined or use the shared reservation budget'
)

const institutionalHunterSource = source('scripts/enrich-institutional-buyer-contacts.mjs')
const institutionalHunterQuarantineCall = institutionalHunterSource.indexOf(
  'quarantineLegacyInstitutionalBuyerHunterEnrichment()'
)
assert.ok(institutionalHunterQuarantineCall >= 0, 'institutional Hunter enrichment must call its quarantine')
assert.ok(
  institutionalHunterQuarantineCall < institutionalHunterSource.indexOf('const args = process.argv.slice(2)'),
  'institutional Hunter enrichment must stop before argument parsing or any file/provider work'
)

const retiredHunterVerificationSource = source('lib/outreach/hunterEmailVerification.ts')
assert.doesNotMatch(retiredHunterVerificationSource, /api\.hunter\.io|HUNTER_API_KEY|\bfetch\s*\(/)
assert.match(retiredHunterVerificationSource, /unbudgeted_hunter_verification_quarantined/)

for (const relativePath of guardedProviderScripts) {
  const scriptSource = source(relativePath)
  assert.match(scriptSource, /legacy-outreach-quarantine\.mjs/)
  assert.match(scriptSource, /quarantineLegacyDirectLiveSend\(\{ requested:/)
}

const guardedOrchestrators = [
  'scripts/dealmachine-export-autoloop.mjs',
  'scripts/on-market-creative-daily-city.mjs',
  'scripts/seller-outreach-autopilot.mjs',
  'scripts/vestblock-master-revenue-loop.mjs',
]

for (const relativePath of guardedOrchestrators) {
  const scriptSource = source(relativePath)
  assert.match(scriptSource, /legacy-outreach-quarantine\.mjs/)
  assert.match(scriptSource, /quarantineLegacyDirectLiveSend\(\{ requested:/)
}

assert.match(
  source('scripts/dealmachine-owner-email.mjs'),
  /blockLegacyDealMachineApi\(['"]dealmachine-owner-email\.mjs['"]\)/,
  'the retired DealMachine owner-email sender must remain permanently disabled'
)

const retiredDealMachineAttempt = spawnSync(
  process.execPath,
  ['scripts/dealmachine-owner-email.mjs', '--send'],
  { cwd: root, encoding: 'utf8' }
)
assert.equal(retiredDealMachineAttempt.status, 1)
assert.match(retiredDealMachineAttempt.stderr, /is disabled because it targets DealMachine's legacy\/private API/)

for (const [name, command] of Object.entries(scripts)) {
  const directProviderScript = guardedProviderScripts.find((relativePath) =>
    String(command).includes(relativePath)
  )
  if (!directProviderScript) continue
  assert.doesNotMatch(
    String(command),
    /(?:^|\s)--send(?:\s|$)/,
    `${name} must not advertise direct live delivery through ${directProviderScript}`
  )
}

for (const relativePath of [
  'scripts/instantly-lead-sync.mjs',
  'scripts/instantly-demand-discovery.mjs',
]) {
  const scriptSource = source(relativePath)
  assert.match(scriptSource, /quarantineLegacyDirectLiveSend/)
  assert.match(scriptSource, /requested: push && Boolean\(campaignId\)/)
}
const instantlyCampaignSource = source('scripts/instantly-campaign-control.mjs')
assert.match(instantlyCampaignSource, /requested: activate \|\| apply/)
assert.match(instantlyCampaignSource, /activate \|\| pause/)
assert.match(scripts['instantly:push'], /instantly-lead-sync\.mjs --push/)
assert.match(scripts['instantly:demand:push'], /instantly-demand-discovery\.mjs --push/)

for (const instructionPath of [
  'scripts/dealmachine-export-lists.mjs',
  'scripts/dealmachine-ingest-export.mjs',
  'scripts/dealmachine-list-builder-expansion.mjs',
  'scripts/skip-trace-prep.mjs',
  'scripts/vestblock-tax-code-rotation.mjs',
]) {
  assert.doesNotMatch(
    source(instructionPath),
    /(?:dealmachine-export-outreach\.mjs|distress:dealmachine:export-outreach)[^\n"']*--send/,
    `${instructionPath} must not advertise the retired direct provider path`
  )
}
assert.match(source('scripts/vestblock-tax-code-rotation.mjs'), /pnpm run outreach:dispatch:live/)

const governedDispatchSource = source('scripts/governed-outreach-dispatch.mjs')
assert.match(governedDispatchSource, /new URL\('\/api\/cron\/outreach-dispatch'/)
assert.match(governedDispatchSource, /CRON_SECRET/)
assert.match(governedDispatchSource, /payload\?\.dryRun !== false/)
assert.match(governedDispatchSource, /payload\?\.liveEnabled !== true/)
assert.doesNotMatch(
  governedDispatchSource,
  /\bResend\b|gmail\.googleapis\.com|graph\.microsoft\.com|emails\.send|sendMail/
)

const quarantineCli = spawnSync(
  process.execPath,
  ['scripts/quarantine-legacy-live-send.mjs', '--entry=regression-test'],
  { cwd: root, encoding: 'utf8' }
)
assert.equal(quarantineCli.status, 1)
assert.match(quarantineCli.stderr, /legacy_outreach_live_send_quarantined/)

for (const relativePath of guardedProviderScripts) {
  const directLegacyAttempt = spawnSync(
    process.execPath,
    [relativePath, '--send'],
    { cwd: root, encoding: 'utf8' }
  )
  assert.equal(directLegacyAttempt.status, 1, `${relativePath} rejects direct live delivery`)
  assert.match(
    directLegacyAttempt.stderr,
    /legacy_outreach_live_send_quarantined/,
    `${relativePath} reports its governed successor`
  )
}

for (const relativePath of guardedOrchestrators) {
  const directLegacyAttempt = spawnSync(
    process.execPath,
    [relativePath, '--send'],
    { cwd: root, encoding: 'utf8' }
  )
  assert.equal(directLegacyAttempt.status, 1, `${relativePath} rejects live orchestration`)
  assert.match(directLegacyAttempt.stderr, /legacy_outreach_live_send_quarantined/)
}

console.log('package outreach governance: ok')
