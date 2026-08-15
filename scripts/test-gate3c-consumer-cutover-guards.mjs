import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const engine = read('lib/admin/strategyExecutionEngine.ts')
assert.doesNotMatch(engine, /import \{ recordOutboundEnrollment \}/)
assert.doesNotMatch(engine, /recordOutboundEnrollment\(\{/)
assert.match(engine, /activityNamespace: 'outreach_message_draft'/)
assert.match(engine, /receivingStrategyMustResolveBeforeDispatch: true/)
assert.match(engine, /dryRun \? 'dry_run' : 'execution'/)
assert.match(engine, /Boolean\(existingMetadata\.dryRun\) !== input\.dryRun/)
assert.match(engine, /fingerprintGovernedOutreachMessage\(emailMessage\)/)
assert.match(engine, /messageContentSha256/)
assert.match(engine, /emailMessage\.generated_with !== expectedGenerator/)
assert.match(engine, /emailMessage\.status === 'sent'/)
assert.match(engine, /already bound to another operating-strategy version/)
assert.match(engine, /inserted\.error\?\.code === '23505'/)
assert.match(engine, /requiresOperatorReconciliation: incompleteGovernedEvidence/)

const daily = read('lib/leads/dailyAutomation.ts')
assert.match(daily, /async function recordStrategyDraftHandoff/)
assert.match(daily, /activityType: 'handoff'/)
assert.match(daily, /parentActivityId: sourceActivity\.id/)
assert.match(daily, /strategy-engine draft is missing its canonical source activity; dispatch is blocked/)
assert.match(daily, /outreach draft changed after its canonical source snapshot; dispatch is blocked/)
const governedSend = daily.slice(daily.indexOf('const revenueCampaign = classifyLeadRevenueCampaign'))
const handoffIndex = governedSend.indexOf('recordStrategyDraftHandoff')
const reservationIndex = governedSend.indexOf('reserveOperatingStrategyDispatch')
const intentIndex = governedSend.indexOf('recordOutboundEnrollment')
assert.ok(handoffIndex >= 0 && handoffIndex < reservationIndex)
assert.ok(reservationIndex < intentIndex)
assert.match(governedSend, /parentActivityId: handoffActivityId/)
assert.equal(
  [...daily.matchAll(/Governed delivery attribution failed closed:/g)].length,
  4,
  'every governed daily-send outcome must fail closed before legacy success/failure writes',
)

const leadService = read('lib/leads/service.ts')
assert.equal(
  [...leadService.matchAll(/Governed delivery attribution failed closed:/g)].length,
  2,
  'both immediate lead-send outcomes must fail closed before legacy state changes',
)

const targetedSeller = read('app/api/cron/seller-targeted-send/route.ts')
assert.equal(
  [...targetedSeller.matchAll(/Governed delivery attribution failed closed:/g)].length,
  2,
  'both targeted seller outcomes must fail closed before legacy state changes',
)

const enrollment = read('lib/admin/outboundEnrollment.ts')
assert.match(enrollment, /parentActivityId\?: string \| null/)
assert.match(enrollment, /parentActivityId: input\.parentActivityId \|\| null/)
assert.match(enrollment, /A governed dispatch intent already exists for this message/)

const lifecycle = read('app/api/cron/lifecycle-monitor/route.ts')
assert.match(lifecycle, /gate3c_controller_routes_tasks_only/)
assert.doesNotMatch(lifecycle, /sendPaidCustomerUploadReminderEmail|sendUserUploadReminderEmail/)

const resend = read('lib/email/resendDelivery.ts')
assert.match(resend, /Resend provider-event replay conflicts with immutable delivery evidence/)
assert.match(resend, /Resend governed delivery attribution failed closed/)
assert.match(resend, /existingEvent\.data\.recipient !== recipient/)
assert.match(resend, /existingEvent\.data\.subject !== subject/)
assert.match(resend, /existingEvent\.data\.reason !== reason/)
assert.match(resend, /!sameJson\(existingEvent\.data\.metadata_json, metadata\)/)
assert.match(resend, /dispatch_channel !== 'resend_email'/)
assert.doesNotMatch(resend, /if \(duplicate\) return/)

const delivery = read('lib/admin/strategyDelivery.ts')
assert.match(delivery, /enrollment\.dispatch_channel !== expectedDispatchChannel/)
assert.match(delivery, /governed_provider_identity_conflict/)

const n8n = read('lib/automation/n8n-orchestrator.ts')
assert.match(n8n, /replayDigest/)
assert.match(n8n, /request digest does not match the immutable orchestration request/)
assert.match(n8n, /Live n8n dispatch remains blocked until the governed template-approval registry is implemented/)

const outlook = read('lib/email/outlookMailbox.ts')
assert.match(outlook, /recordOperatingStrategyAttributionQuarantine/)
assert.match(outlook, /provider_identity_missing/)
assert.match(outlook, /operating_strategy_version_id', null/)

console.log('Gate 3C consumer cutover guard checks passed.')
