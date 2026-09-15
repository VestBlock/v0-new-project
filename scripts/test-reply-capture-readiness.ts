import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  evaluateReplyCaptureIdentity,
  evaluateOperationalReplyCaptureReadiness,
  getReplyCaptureReadiness,
  type ReplyCaptureReadiness,
} from '../lib/outreach/reply-capture'

const now = new Date('2026-09-15T15:00:00.000Z')
const connectedConfiguration = {
  ready: true,
  required: true,
  overrideEnabled: false,
  configured: true,
  mailbox: 'acquisitions@vestblock.io',
  replyToEmail: 'acquisitions@vestblock.io',
  identityMatches: true,
  authMode: 'delegated_refresh_token',
  missing: [],
  reason: null,
} satisfies ReplyCaptureReadiness

const normalizedIdentity = evaluateReplyCaptureIdentity({
  replyToEmail: '  Acquisitions@VestBlock.io  ',
  monitoredMailbox: 'acquisitions@vestblock.io',
})
assert.equal(normalizedIdentity.ready, true)
assert.equal(normalizedIdentity.replyToEmail, 'acquisitions@vestblock.io')
assert.equal(normalizedIdentity.monitoredMailbox, 'acquisitions@vestblock.io')

const mismatchedIdentity = evaluateReplyCaptureIdentity({
  replyToEmail: 'outreach@vestblock.io',
  monitoredMailbox: 'acquisitions@vestblock.io',
})
assert.equal(mismatchedIdentity.ready, false)
assert.match(mismatchedIdentity.reason || '', /does not match/i)

const missingIdentity = evaluateReplyCaptureIdentity({
  replyToEmail: '',
  monitoredMailbox: 'acquisitions@vestblock.io',
})
assert.equal(missingIdentity.ready, false)
assert.deepEqual(missingIdentity.missing, ['OUTREACH_REPLY_TO_EMAIL'])

const freshEvidence = {
  status: 'active',
  last_status: 'completed',
  last_run_at: '2026-09-15T14:30:00.000Z',
  last_error: null,
}

const fresh = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: freshEvidence,
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(fresh.ready, true)
assert.equal(fresh.operational, true)
assert.equal(fresh.syncFresh, true)
assert.equal(fresh.syncAgeMinutes, 30)
assert.equal(fresh.lastSuccessfulSyncAt, freshEvidence.last_run_at)

const boundary = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: { ...freshEvidence, last_run_at: '2026-09-15T13:00:00.000Z' },
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(boundary.ready, true, 'the configured maximum sync age remains inclusive')

const stale = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: { ...freshEvidence, last_run_at: '2026-09-15T12:59:00.000Z' },
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(stale.ready, false)
assert.equal(stale.operational, false)
assert.equal(stale.syncFresh, false)
assert.match(stale.reason || '', /stale.*121 minutes/i)

const failed = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: {
    status: 'failed',
    last_status: 'failed',
    last_run_at: '2026-09-15T14:59:00.000Z',
    last_error: 'invalid_grant',
  },
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(failed.ready, false, 'a recent failed run is not successful sync evidence')
assert.equal(failed.lastSuccessfulSyncAt, null)
assert.match(failed.reason || '', /not operational.*failed\/failed/i)

const recordedError = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: { ...freshEvidence, last_error: 'token revoked' },
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(recordedError.ready, false)

const missingEvidence = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: null,
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(missingEvidence.ready, false)
assert.match(missingEvidence.reason || '', /no recorded successful inbound sync/i)

const lookupFailure = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: null,
  evidenceError: 'database unavailable',
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(lookupFailure.ready, false)
assert.match(lookupFailure.reason || '', /cannot be verified/i)

const futureTimestamp = evaluateOperationalReplyCaptureReadiness({
  configuration: connectedConfiguration,
  evidence: { ...freshEvidence, last_run_at: '2026-09-15T15:06:00.000Z' },
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(futureTimestamp.ready, false)
assert.match(futureTimestamp.reason || '', /invalid future/i)

const explicitOverride = evaluateOperationalReplyCaptureReadiness({
  configuration: {
    ...connectedConfiguration,
    ready: true,
    configured: false,
    overrideEnabled: true,
    authMode: 'disconnected',
  },
  evidence: null,
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(explicitOverride.ready, true)
assert.equal(explicitOverride.operational, true)
assert.equal(explicitOverride.freshnessRequired, false)

const identityMismatchCannotBeOverridden = evaluateOperationalReplyCaptureReadiness({
  configuration: {
    ...connectedConfiguration,
    ready: false,
    overrideEnabled: true,
    replyToEmail: 'outreach@vestblock.io',
    identityMatches: false,
    reason: 'The outbound reply-to address does not match the monitored Outlook mailbox.',
  },
  evidence: freshEvidence,
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(identityMismatchCannotBeOverridden.ready, false)
assert.equal(identityMismatchCannotBeOverridden.operational, false)
assert.match(identityMismatchCannotBeOverridden.reason || '', /does not match/i)

const disconnectedReason =
  'Reply capture for acquisitions@vestblock.io is disconnected. Missing MICROSOFT_GRAPH_REFRESH_TOKEN.'
const disconnected = evaluateOperationalReplyCaptureReadiness({
  configuration: {
    ...connectedConfiguration,
    ready: false,
    configured: false,
    authMode: 'disconnected',
    missing: ['MICROSOFT_GRAPH_REFRESH_TOKEN'],
    reason: disconnectedReason,
  },
  evidence: freshEvidence,
  now,
  maxSyncAgeMinutes: 120,
})
assert.equal(disconnected.ready, false)
assert.equal(disconnected.operational, false)
assert.equal(disconnected.reason, disconnectedReason, 'credential readiness remains a prerequisite')

const guardedEnvKeys = [
  'OUTREACH_REPLY_TO_EMAIL',
  'OUTLOOK_ACQUISITIONS_MAILBOX',
  'OUTREACH_REQUIRE_REPLY_CAPTURE',
  'OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE',
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_GRAPH_REFRESH_TOKEN',
  'MICROSOFT_REFRESH_TOKEN',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_CLIENT_SECRET',
] as const
const previousEnv = Object.fromEntries(guardedEnvKeys.map((key) => [key, process.env[key]]))
try {
  for (const key of guardedEnvKeys) delete process.env[key]
  process.env.OUTREACH_REPLY_TO_EMAIL = 'outreach@vestblock.io'
  process.env.OUTLOOK_ACQUISITIONS_MAILBOX = 'acquisitions@vestblock.io'
  process.env.OUTREACH_REQUIRE_REPLY_CAPTURE = 'true'
  process.env.OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE = 'true'
  process.env.MICROSOFT_GRAPH_CLIENT_ID = 'test-client-id'
  process.env.MICROSOFT_GRAPH_REFRESH_TOKEN = 'test-refresh-token'

  const conflictingEnvironment = getReplyCaptureReadiness()
  assert.equal(conflictingEnvironment.configured, true)
  assert.equal(conflictingEnvironment.identityMatches, false)
  assert.equal(
    conflictingEnvironment.ready,
    false,
    'conflicting reply-to and monitored-mailbox env values fail closed even when the legacy override is enabled'
  )
  assert.match(conflictingEnvironment.reason || '', /does not match/i)
} finally {
  for (const key of guardedEnvKeys) {
    const previous = previousEnv[key]
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

const root = process.cwd()
const deliveryGateSource = readFileSync(join(root, 'lib/outreach/deliveryGate.ts'), 'utf8')
assert.match(deliveryGateSource, /getOperationalReplyCaptureReadiness/)
assert.match(
  deliveryGateSource,
  /await getOperationalReplyCaptureReadiness\(\)[\s\S]*if \(!replyCapture\.ready\)[\s\S]*throw new Error/
)

const commandCenterSource = readFileSync(join(root, 'lib/admin/commandCenter.ts'), 'utf8')
assert.match(commandCenterSource, /const mailboxReadiness = getReplyCaptureReadiness\(\)/)
assert.match(commandCenterSource, /mailboxReady: mailboxReadiness\.ready/)
assert.match(commandCenterSource, /if \(!mailboxReadiness\.ready\)/)

const mailboxSource = readFileSync(join(root, 'lib/email/outlookMailbox.ts'), 'utf8')
assert.match(mailboxSource, /status: ingestionPending \? 'blocked' : 'active'/)
assert.match(mailboxSource, /lastStatus: backlogPending[\s\S]*'backlog_pending'[\s\S]*'side_effects_pending'[\s\S]*'completed'/)
assert.match(mailboxSource, /highWatermark: ingestionPending \? cursorState\.highWatermark : windowStartedAt/)
assert.match(mailboxSource, /status: 'failed',[\s\S]*lastStatus: 'failed'/)

console.log('reply-capture-readiness: ok')
