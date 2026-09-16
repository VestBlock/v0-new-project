import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'vestblock-sms-consent-'))
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'send-messages-batch.mjs')
const builderScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'build-dealmachine-sms-queue.mjs')
const queue = path.join(workdir, 'queue.csv')
const header = [
  'phone',
  'phone_type',
  'can_text',
  'sms_consent',
  'sms_outreach_allowed',
  'sms_consented_at',
  'sms_consent_version',
  'sms_consent_phone_fingerprint',
  'do_not_call',
  'text_message',
].join(',')

function run(row, mode = '--dry-run') {
  fs.writeFileSync(queue, `${header}\n${row}\n`)
  return spawnSync(process.execPath, [script, `--queue=${queue}`, mode], {
    cwd: workdir,
    encoding: 'utf8',
  })
}

const missingConsent = run(
  '4145550100,Wireless,true,false,false,,,,false,"Consent is required"',
)
assert.equal(missingConsent.status, 0)
assert.match(missingConsent.stdout, /Candidates selected: 0/)

const matchingFingerprint = createHash('sha256').update('14145550100').digest('hex')
const durableConsentRow =
  `4145550100,Wireless,true,true,true,2025-09-15T12:00:00.000Z,seller-sms-v2-2026-09-15,${matchingFingerprint},false,"Reply STOP to opt out"`
const consented = run(durableConsentRow)
assert.equal(consented.status, 0)
assert.match(consented.stdout, /Candidates selected: 1/)

const mismatchedConsent = run(
  `4145550199,Wireless,true,true,true,2025-09-15T12:00:00.000Z,seller-sms-v2-2026-09-15,${matchingFingerprint},false,"Wrong number"`,
)
assert.equal(mismatchedConsent.status, 0)
assert.match(mismatchedConsent.stdout, /Candidates selected: 0/)

const liveAppleMessages = run(durableConsentRow, '--send')
assert.notEqual(liveAppleMessages.status, 0)
assert.match(`${liveAppleMessages.stdout}\n${liveAppleMessages.stderr}`, /Live Apple Messages outreach is disabled/)

const exportDir = path.join(workdir, 'data', 'dm-exports')
const sourceCsv = path.join(exportDir, 'milwaukee-wi.csv')
fs.mkdirSync(exportDir, { recursive: true })
const sourceHeader = [
  'property_address_full',
  'owner_name',
  'phone_1',
  'phone_1_type',
  'phone_1_do_not_call',
  'sms_consent',
  'sms_outreach_allowed',
  'sms_consented_at',
  'sms_consent_version',
  'sms_consent_phone_fingerprint',
].join(',')

function runBuilder(fingerprint) {
  fs.writeFileSync(
    sourceCsv,
    `${sourceHeader}\n"123 Main St, Milwaukee, WI",Owner,4145550100,Wireless,false,true,true,2025-09-15T12:00:00.000Z,seller-sms-v2-2026-09-15,${fingerprint}\n`,
  )
  return spawnSync(process.execPath, [builderScript, '--limit=1', '--files=1'], {
    cwd: workdir,
    encoding: 'utf8',
  })
}

const mismatchedBuilder = runBuilder('b'.repeat(64))
assert.equal(mismatchedBuilder.status, 0)
assert.match(mismatchedBuilder.stdout, /Accepted: 0\/1/)

const consentedBuilder = runBuilder(matchingFingerprint)
assert.equal(consentedBuilder.status, 0)
assert.match(consentedBuilder.stdout, /Accepted: 1\/1/)

fs.rmSync(workdir, { recursive: true, force: true })
console.log('SMS consent and provider gate tests passed.')
