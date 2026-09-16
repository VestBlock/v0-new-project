import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

for (const path of [
  'lib/leads/outbound.ts',
  'lib/buyers/outbound.ts',
  'lib/lenders/outbound.ts',
  'lib/investors/outbound.ts',
]) {
  const value = source(path)
  assert.match(value, /sendGuardedOutlookEmail\(/, `${path} must use the guarded Outlook adapter.`)
  assert.match(value, /ensureFreshHunterSendVerification/, `${path} must refresh or reuse fresh Hunter evidence.`)
  assert.match(value, /invocationId/, `${path} must pass the shared cold-invocation identity.`)
  assert.equal(value.includes('queueInstantlyEnrollment'), false)
  assert.equal(value.includes("provider: 'resend'"), false)
}

for (const path of [
  'lib/leads/dailyAutomation.ts',
  'lib/buyers/automation.ts',
  'lib/lenders/automation.ts',
  'lib/investors/service.ts',
]) {
  const value = source(path)
  assert.match(value, /Math\.min\([^\n]*2\)|outlookInvocationCapacity = 2/)
  assert.match(value, /reconciliationRequired/)
  assert.match(value, /status: 'queued'/)
  assert.match(value, /dispatchId/)
  assert.match(value, /internetMessageId/)
  assert.equal(value.includes('instantly_staged'), false)
}

assert.match(source('lib/leads/outbound.ts'), /Seller and consumer cold email is prohibited/)

const packet = source('lib/buyers/packetDelivery.ts')
assert.match(packet, /contentType: 'application\/pdf'/)
assert.match(packet, /reconciliation_required/)
assert.match(packet, /dispatchId/)

assert.equal(source('vercel.json').includes('/api/cron/instantly-enrollment'), false)

console.log('Outlook source progression assertions passed.')
