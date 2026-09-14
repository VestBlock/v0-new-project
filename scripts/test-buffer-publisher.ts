import assert from 'node:assert/strict'

// The publisher is intentionally server-only because it holds the Buffer
// credential path. Stub that marker for this Node-only pure-content test.
type TestModuleLoader = typeof import('node:module') & {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const moduleLoader = require('node:module') as TestModuleLoader
const originalLoad = moduleLoader._load
moduleLoader._load = function loadForTest(request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}

const { buildBufferPostDraft } = require('@/lib/social/bufferPublisher') as typeof import('@/lib/social/bufferPublisher')
const {
  BUFFER_STALE_CLAIM_ERROR,
  buildStaleBufferClaimPatch,
  getBufferPublishSkipReason,
  normalizeBufferAutoPublishService,
  planBufferLedgerRecovery,
} = require('@/lib/social/bufferPublisherRecovery') as typeof import('@/lib/social/bufferPublisherRecovery')
moduleLoader._load = originalLoad

const date = new Date('2026-08-20T15:00:00.000Z')
const facebook = buildBufferPostDraft({ date, service: 'facebook', channelId: 'buffer-channel-facebook' })
const linkedin = buildBufferPostDraft({ date, service: 'linkedin', channelId: 'buffer-channel-linkedin' })
const x = buildBufferPostDraft({ date, service: 'x', channelId: 'buffer-channel-x' })
const nextCentralDay = buildBufferPostDraft({
  // This is still August 20 in Central time, while the original test date is
  // August 20 UTC. Keeping these distinct catches UTC-vs-local rotation bugs.
  date: new Date('2026-08-21T00:09:00.000Z'),
  service: 'facebook',
  channelId: 'buffer-channel-facebook',
})
const followingCentralDay = buildBufferPostDraft({
  date: new Date('2026-08-21T15:00:00.000Z'),
  service: 'facebook',
  channelId: 'buffer-channel-facebook',
})
const collisionResolved = buildBufferPostDraft({
  date: new Date('2026-08-21T15:00:00.000Z'),
  service: 'facebook',
  channelId: 'buffer-channel-facebook',
  pillarOffset: 1,
})

assert.match(facebook.slug, /^buffer-2026-08-20-facebook-/)
assert.match(facebook.text, /vestblock\.io/i)
assert.notEqual(facebook.text, linkedin.text)
assert.ok(x.text.length <= 280)
assert.match(linkedin.text, /VestBlock/i)
assert.match(facebook.visualUrl, /\/api\/social-card\/capital-readiness\?v=1$/)
assert.notEqual(nextCentralDay.text, followingCentralDay.text, 'Central-time days must not reuse the same post pillar')
assert.notEqual(nextCentralDay.slug, followingCentralDay.slug, 'Central-time days must have separate ledger keys')
assert.notEqual(collisionResolved.text, followingCentralDay.text, 'A scheduled pillar collision must advance within the approved rotation')

const reconciliationNow = new Date('2026-08-21T16:00:00.000Z')
const freshSending = planBufferLedgerRecovery({
  status: 'ready',
  platform: 'facebook',
  updatedAt: '2026-08-21T15:40:00.000Z',
  metadata: { publisher: 'buffer', bufferService: 'facebook', bufferStatus: 'sending' },
  now: reconciliationNow,
})
const staleWithProviderId = planBufferLedgerRecovery({
  status: 'ready',
  platform: 'linkedin',
  updatedAt: '2026-08-21T14:00:00.000Z',
  metadata: {
    publisher: 'buffer',
    bufferService: 'linkedin',
    bufferStatus: 'sending',
    bufferPostId: 'buffer-post-123',
  },
  now: reconciliationNow,
})
const staleWithoutProviderId = planBufferLedgerRecovery({
  status: 'ready',
  platform: 'facebook',
  updatedAt: '2026-08-21T14:00:00.000Z',
  metadata: {
    publisher: 'buffer',
    bufferService: 'facebook',
    bufferStatus: 'sending',
    lastAttemptAt: '2026-08-21T14:00:00.000Z',
  },
  now: reconciliationNow,
})
const sentWithoutProviderId = planBufferLedgerRecovery({
  status: 'published',
  platform: 'facebook',
  updatedAt: '2026-08-21T14:00:00.000Z',
  metadata: { publisher: 'buffer', bufferService: 'facebook', bufferStatus: 'sent' },
  now: reconciliationNow,
})
const staleWithExternalLink = planBufferLedgerRecovery({
  status: 'ready',
  platform: 'facebook',
  updatedAt: '2026-08-21T14:00:00.000Z',
  metadata: {
    publisher: 'buffer',
    bufferService: 'facebook',
    bufferStatus: 'sending',
    bufferExternalLink: 'https://www.facebook.com/vestblock/posts/provider-evidence',
  },
  now: reconciliationNow,
})

assert.deepEqual(freshSending, { kind: 'ignore', reason: 'fresh_claim' }, 'Fresh sending claims must remain untouched')
assert.deepEqual(
  staleWithProviderId,
  { kind: 'reconcile_provider', bufferPostId: 'buffer-post-123' },
  'A provider ID must always use normal provider reconciliation, even when the claim is old'
)
assert.equal(staleWithoutProviderId.kind, 'quarantine_stale_claim', 'A stale claim without a provider ID must be recovered')
assert.deepEqual(sentWithoutProviderId, { kind: 'ignore', reason: 'not_sending' }, 'Sent rows must remain untouched')
assert.deepEqual(
  staleWithExternalLink,
  { kind: 'ignore', reason: 'provider_evidence_present' },
  'A row with provider evidence must never be reset as an unknown stale claim'
)
assert.equal(normalizeBufferAutoPublishService('facebook'), 'facebook')
assert.equal(normalizeBufferAutoPublishService('linkedin'), 'linkedin')
assert.equal(normalizeBufferAutoPublishService('x'), null, 'X must never be an automatic Buffer destination')
assert.equal(normalizeBufferAutoPublishService('twitter'), null, 'Twitter must never be an automatic Buffer destination')

const stalePatch = buildStaleBufferClaimPatch({
  metadata: { publisher: 'buffer', bufferStatus: 'sending' },
  recoveredAt: reconciliationNow.toISOString(),
})
assert.equal(stalePatch.status, 'ready')
assert.equal(stalePatch.metadata_json.bufferStatus, 'failed')
assert.equal(stalePatch.metadata_json.bufferRetryBlocked, true, 'An uncertain provider outcome must never be retried automatically')
assert.equal(stalePatch.metadata_json.bufferRecoveryStatus, 'manual_verification_required')
assert.equal(stalePatch.metadata_json.bufferError, BUFFER_STALE_CLAIM_ERROR)
assert.ok(stalePatch.metadata_json.bufferError.length <= 500, 'The persisted recovery error must be bounded')
assert.equal(
  getBufferPublishSkipReason({ status: 'ready', metadata: { bufferStatus: 'sending' } }),
  'publish_in_flight',
  'The publisher must not re-send a fresh in-flight claim'
)
assert.equal(
  getBufferPublishSkipReason({ status: stalePatch.status, metadata: stalePatch.metadata_json }),
  'manual_verification_required',
  'The publisher must not automatically retry an uncertain stale claim'
)
assert.equal(
  getBufferPublishSkipReason({ status: 'published', metadata: { bufferStatus: 'sent' } }),
  'already_scheduled',
  'The publisher must leave sent assets untouched'
)

console.log('buffer-publisher: ok')
