import assert from 'node:assert/strict'

// The publisher is intentionally server-only because it holds the Buffer
// credential path. Stub that marker for this Node-only pure-content test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleLoader = require('node:module') as typeof import('node:module') & { _load: Function }
const originalLoad = moduleLoader._load
moduleLoader._load = function loadForTest(request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildBufferPostDraft } = require('@/lib/social/bufferPublisher') as typeof import('@/lib/social/bufferPublisher')
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

console.log('buffer-publisher: ok')
