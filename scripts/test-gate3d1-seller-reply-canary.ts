import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { OPERATING_STRATEGY_VERSION_CONTRACTS } from '../lib/strategy/operating-contracts'
import {
  GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_CANDIDATE,
  GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
  GATE3D1_SELLER_REPLY_CANARY_PURPOSE,
  GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT,
  GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
} from '../lib/strategy/gate3d1-seller-reply-canary'
import {
  buildGate3d1SellerReplyCanaryManifest,
  GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS,
  serializeGate3d1SellerReplyCanaryCandidateSql,
  serializeGate3d1SellerReplyCanaryManifest,
} from './generate-gate3d1-seller-reply-canary-manifest'

const candidate = GATE3D1_SELLER_REPLY_CANARY_CANDIDATE
const historicalSeller = OPERATING_STRATEGY_VERSION_CONTRACTS.seller_options_intake

// Gate 3B remains immutable historical evidence.
assert.equal(Object.keys(OPERATING_STRATEGY_VERSION_CONTRACTS).length, 17)
assert.equal(historicalSeller.versionStatus, 'draft')
assert.equal(historicalSeller.executionMode, 'no_send')
assert.equal(historicalSeller.externalSendCap, 0)
assert.equal(historicalSeller.ownerContract.dispatchAuthority, 'none_in_gate_3b')
assert.equal(historicalSeller.operatingContract.activationReadiness.status, 'blocked')
assert.ok(historicalSeller.operatingContract.activationReadiness.blockers.length > 0)

for (const [strategyKey, contract] of Object.entries(OPERATING_STRATEGY_VERSION_CONTRACTS)) {
  if (strategyKey === 'seller_options_intake') continue
  assert.equal(contract.versionStatus, 'draft')
  assert.ok(['no_send', 'internal_only', 'inactive'].includes(contract.executionMode))
  assert.equal(contract.externalSendCap, 0)
  assert.equal(contract.ownerContract.dispatchAuthority, 'none_in_gate_3b')
  assert.equal(contract.operatingContract.activationReadiness.status, 'blocked')
  assert.ok(contract.operatingContract.activationReadiness.blockers.length > 0)
}

// The only overlay is a still-unapproved, tightly scoped cap-one draft.
assert.equal(candidate.strategyKey, 'seller_options_intake')
assert.equal(candidate.version, 1)
assert.equal(candidate.versionStatus, 'draft')
assert.equal(candidate.executionMode, 'approved_live')
assert.equal(candidate.externalSendCap, 1)
assert.equal(candidate.activation.externalActivation, 'pending_founder_review')
assert.ok(candidate.activation.blockers.length > 0)
assert.equal(candidate.ownerContract.dispatchAuthority, 'vestblock_application')
assert.equal(candidate.operatingContract.activationReadiness.status, 'ready')
assert.deepEqual(candidate.operatingContract.activationReadiness.blockers, [])
assert.equal(candidate.operatingContract.canaryScope.manifestKey, GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY)
assert.equal(candidate.operatingContract.canaryScope.purpose, GATE3D1_SELLER_REPLY_CANARY_PURPOSE)
assert.equal(candidate.operatingContract.canaryScope.writerRelease, GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE)
assert.equal(candidate.operatingContract.canaryScope.maximumLifetimeRecipients, 1)
assert.equal(candidate.operatingContract.canaryScope.maximumLifetimeSends, 1)
assert.equal(candidate.operatingContract.canaryScope.exactSameThreadOnly, true)
assert.equal(candidate.operatingContract.canaryScope.providerFallbackAllowed, false)
assert.equal(candidate.operatingContract.canaryScope.newThreadAllowed, false)
assert.equal(candidate.operatingContract.canaryScope.automaticSequenceAllowed, false)

const externalChannels = new Set(
  [
    ...candidate.operatingContract.primaryChannels,
    ...candidate.operatingContract.secondaryChannels,
  ].filter((channel) => !['operator_task', 'no_outreach', 'website_notification'].includes(channel))
)
assert.deepEqual([...externalChannels], ['outlook_graph'])
assert.ok(candidate.operatingContract.channelSelectionRules.some((rule) => /no resend, gmail/i.test(rule)))
assert.ok(candidate.operatingContract.channelSelectionRules.some((rule) => /no .*provider fallback/i.test(rule)))
assert.ok(candidate.operatingContract.nurtureRules.every((rule) => /no |cannot|requires/i.test(rule)))
assert.ok(candidate.operatingContract.integrationDependencies.length >= 4)
assert.ok(candidate.operatingContract.integrationDependencies.every(
  (dependency) => dependency.status === 'available' && dependency.requiredBeforeActivation
))
assert.equal(candidate.outcomeContract.targetOutcomeObservable, true)
assert.equal(candidate.outcomeContract.observableCurrentOutcome.available, true)
assert.equal(candidate.outcomeContract.minimumExposure, 1)
assert.equal(candidate.outcomeContract.minimumPrimaryConversions, 1)

assert.match(GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT, /^[0-9a-f]{40}$/)
assert.match(GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT, /^[0-9a-f]{32}$/)
assert.match(GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT, /^[0-9a-f]{32}$/)
assert.notEqual(
  GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT
)
assert.notEqual(GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT, '0'.repeat(32))

const manifest = buildGate3d1SellerReplyCanaryManifest()
assert.equal(manifest.expected_before_fingerprint, GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT)
assert.equal(manifest.expected_after_fingerprint, GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT)
assert.equal(manifest.source_commit, GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT)
assert.equal(manifest.strategy_key, 'seller_options_intake')
assert.equal(manifest.required_current_status, 'draft')
assert.equal(manifest.execution_mode, 'approved_live')
assert.equal(manifest.external_send_cap, 1)
assert.equal(manifest.owner_contract_json.dispatchAuthority, 'vestblock_application')
assert.equal(Object.keys(manifest.unchanged_gate3c_fingerprints).length, 16)
assert.equal(
  Object.prototype.hasOwnProperty.call(
    manifest.unchanged_gate3c_fingerprints,
    'seller_options_intake'
  ),
  false
)
for (const fingerprint of Object.values(GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS)) {
  assert.match(fingerprint, /^[0-9a-f]{32}$/)
}

const serializedManifest = serializeGate3d1SellerReplyCanaryManifest()
assert.equal(serializedManifest, serializeGate3d1SellerReplyCanaryManifest())
assert.doesNotMatch(serializedManifest, /generated_at|generatedAt|CURRENT_TIMESTAMP|NOW\(\)/)

const sql = serializeGate3d1SellerReplyCanaryCandidateSql()
assert.equal(sql, serializeGate3d1SellerReplyCanaryCandidateSql())
assert.ok(sql.includes(GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT))
assert.ok(sql.includes(GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT))
assert.ok(sql.includes(GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT))
for (const fingerprint of Object.values(GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS)) {
  assert.ok(sql.includes(fingerprint))
}
assert.match(sql, /private\.gate3b_operating_contract_fingerprint\(candidate\)/)
assert.match(sql, /changed_count <> 1/)
assert.match(sql, /status = 'draft'/)
assert.match(sql, /execution_mode <> 'approved_live'/)
assert.match(sql, /external_send_cap <> 1/)
assert.match(sql, /outbound_kill_switch/)
assert.match(sql, /NOT controls\.paused/)
assert.match(sql, /n8n[\s\S]*live_send_enabled/)
assert.doesNotMatch(
  sql,
  /private\.gate3b_operating_contract_fingerprint\(version\)/,
  'SQL table aliases must be passed as composite rows, not the integer version column.'
)
assert.match(sql, /cannot rewrite active or retired history/i)
assert.match(sql, /no prior runtime activity or reservation/i)
assert.doesNotMatch(sql, /SET\s+(?:status|approved_by_user_id|approved_at|activated_at|retired_at)\s*=/i)
assert.doesNotMatch(sql, /SET\s+(?:outbound_kill_switch|paused|live_send_enabled)\s*=/i)

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260815231000_gate3d1_seller_reply_canary_candidate.sql'
)
const migration = readFileSync(migrationPath, 'utf8')
assert.equal(migration, sql)

console.log(JSON.stringify({
  ok: true,
  gate: '3D.1',
  strategy: candidate.strategyKey,
  status: candidate.versionStatus,
  cap: candidate.externalSendCap,
  beforeFingerprint: GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT,
  afterFingerprint: GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
  unchangedGate3cDrafts: Object.keys(GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS).length,
}, null, 2))
