import assert from 'node:assert/strict'

import { createResearchCallbackSignature, verifyResearchCallback } from '../lib/research/callbackSecurity'

const secret = 'gate3-callback-test-secret'
const timestamp = 1_786_000_000
const rawBody = JSON.stringify({ event_id: 'vestblock-worker-event-0001', job_id: '00000000-0000-4000-8000-000000000001' })
const signature = createResearchCallbackSignature(secret, timestamp, rawBody)

assert.deepEqual(
  verifyResearchCallback({ secret, rawBody, timestampHeader: String(timestamp), signatureHeader: signature, now: timestamp * 1000 }),
  { ok: true, timestamp }
)
assert.equal(
  verifyResearchCallback({ secret, rawBody: `${rawBody} `, timestampHeader: String(timestamp), signatureHeader: signature, now: timestamp * 1000 }).ok,
  false
)
assert.equal(
  verifyResearchCallback({ secret, rawBody, timestampHeader: String(timestamp - 301), signatureHeader: signature, now: timestamp * 1000 }).ok,
  false
)

console.log('research callback signature contract passed')
