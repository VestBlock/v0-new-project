import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { assessCommercialOutreachContent } from '../lib/outreach/commercialCompliance'

const mailingAddress = '123 Market St., Suite 400, Milwaukee, WI 53202'
assert.deepEqual(
  assessCommercialOutreachContent({
    html: `
      <p>Would a working-capital review be useful?</p>
      <p>If this is not relevant, reply <strong>opt out</strong> and we will stop.</p>
      <footer>VestBlock mailing address: 123 Market St., Suite 400,<br>Milwaukee, WI 53202</footer>
    `,
    mailingAddress,
  }),
  {
    compliant: true,
    missingOptOut: false,
    missingMailingAddress: false,
    mailingAddressConfigured: true,
  }
)

const missingOptOut = assessCommercialOutreachContent({
  html: `<p>Hello.</p><p>${mailingAddress}</p>`,
  mailingAddress,
})
assert.equal(missingOptOut.compliant, false)
assert.equal(missingOptOut.missingOptOut, true)

const missingRenderedAddress = assessCommercialOutreachContent({
  html: '<p>Hello. Reply unsubscribe if this is not relevant.</p>',
  mailingAddress,
})
assert.equal(missingRenderedAddress.compliant, false)
assert.equal(missingRenderedAddress.missingMailingAddress, true)

const missingConfiguredAddress = assessCommercialOutreachContent({
  html: '<p>Hello. Reply unsubscribe. 123 Market St.</p>',
  mailingAddress: '',
})
assert.equal(missingConfiguredAddress.mailingAddressConfigured, false)
assert.equal(missingConfiguredAddress.compliant, false)

const adapter = readFileSync(resolve(process.cwd(), 'lib/outreach/outlookDelivery.ts'), 'utf8')
assert.match(adapter, /assessCommercialOutreachContent\(\{/)
assert.match(adapter, /commercial_content_opt_out_missing/)
assert.match(adapter, /commercial_content_mailing_address_missing/)
assert.ok(
  adapter.indexOf('assessCommercialOutreachContent({') < adapter.indexOf('reserveColdAttempt({'),
  'rendered-content compliance must hold the message before consuming a cold-send reservation'
)
assert.ok(
  adapter.indexOf('const recipientGuard = await dependencies.recipientGuard({') <
    adapter.indexOf("if (input.purpose !== 'transactional')"),
  'the current global suppression guard must run for transactional mail too'
)
assert.ok(
  adapter.indexOf('const recipientGuard = await dependencies.recipientGuard({') <
    adapter.indexOf('dependencies.sendGraph({'),
  'no purpose may reach Outlook before the current recipient guard approves it'
)
assert.ok(
  adapter.indexOf('const replyCapture = await dependencies.replyCaptureReadiness({ now })') <
    adapter.indexOf("if (input.purpose !== 'transactional')"),
  'every outreach purpose, including transactional buyer packets, must require operational reply capture'
)
assert.ok(
  adapter.indexOf('const replyTo = replyCapture.replyToEmail') <
    adapter.indexOf('dependencies.sendGraph({'),
  'Outlook must receive the validated monitored mailbox as Reply-To'
)

console.log('commercial-outlook-content: ok')
