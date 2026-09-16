import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  assertPurposeBoundBreakerProvider,
  PURPOSE_BOUND_EMAIL_PROVIDER,
  resolvePurposeBoundOutboundProvider,
} from '@/lib/outreach/deliveryRuntime'

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

assert.equal(PURPOSE_BOUND_EMAIL_PROVIDER, 'outlook')
assert.doesNotThrow(() => {
  assertPurposeBoundBreakerProvider('outlook', { provider: ' OUTLOOK ' })
})
assert.doesNotThrow(() => {
  assertPurposeBoundBreakerProvider('outlook')
})
assert.throws(
  () => assertPurposeBoundBreakerProvider('outlook', { provider: 'resend' }),
  /delivery_circuit_provider_mismatch: expected outlook, received resend/
)
assert.throws(
  () => assertPurposeBoundBreakerProvider('outlook', { provider: '' }),
  /delivery_circuit_provider_mismatch/
)

const permitted = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'buyers', purpose: 'transactional' },
  { gmail: true, resend: true, outlook: true }
)
assert.equal(permitted.allowed, true)
assert.equal(permitted.action, 'send_outlook')
assert.equal(permitted.provider, 'outlook')

const cold = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'buyers', purpose: 'cold_outreach', isBusinessContact: true },
  { gmail: true, resend: true, outlook: true }
)
assert.equal(cold.allowed, true)
assert.equal(cold.action, 'send_outlook')
assert.equal(cold.provider, 'outlook')

const noOutlook = resolvePurposeBoundOutboundProvider(
  { strategyKey: 'buyers', purpose: 'transactional' },
  { gmail: true, resend: true, outlook: false }
)
assert.equal(noOutlook.allowed, false)
assert.equal(noOutlook.action, 'hold_provider_unavailable')
assert.equal(noOutlook.provider, 'none')

const adapter = source('lib/outreach/outlookDelivery.ts')
assert.match(adapter, /sendTransactionalEmailWithMicrosoftGraphIdempotently/)
assert.match(adapter, /reserveOutlookColdEmailAttempt/)
assert.doesNotMatch(adapter, /getDeliveryCircuitBreaker|acquireGuardedDeliveryAttempt|sendWithResend/)
assert.doesNotMatch(adapter, /instantly/i)

for (const relativePath of [
  'lib/leads/dailyAutomation.ts',
  'lib/buyers/automation.ts',
  'lib/lenders/automation.ts',
  'lib/investors/service.ts',
  'app/api/cron/partner-network-pipeline/route.ts',
]) {
  const runtime = source(relativePath)
  assert.doesNotMatch(
    runtime,
    /getDeliveryCircuitBreaker\(/,
    `${relativePath} must not gate active Outlook delivery on legacy Resend telemetry.`
  )
  assert.doesNotMatch(
    runtime,
    /readInstantlyStagingReadiness|hold_for_instantly|enqueueInstantly/i,
    `${relativePath} must not require inactive Instantly infrastructure.`
  )
}

const combinedPartnerRoute = source('app/api/cron/partner-network-pipeline/route.ts')
assert.match(combinedPartnerRoute, /const invocationId = `partner-network:\$\{randomUUID\(\)\}`/)
assert.match(combinedPartnerRoute, /let invocationRemaining = 2/)
assert.match(combinedPartnerRoute, /const effectiveSendLimit = Object\.values\(sendAllocations\)/)
assert.match(combinedPartnerRoute, /invocationId/)

console.log('delivery-control alignment tests passed for Outlook-only routing')
