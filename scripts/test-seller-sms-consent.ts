import assert from 'node:assert/strict'

import {
  SELLER_SMS_CONSENT_DISCLOSURE,
  SELLER_SMS_CONSENT_VERSION,
  sellerSmsConsentEvidence,
} from '../lib/outreach/sellerSmsConsent'

assert.match(SELLER_SMS_CONSENT_DISCLOSURE, /Vestblock LLC/)
assert.match(SELLER_SMS_CONSENT_DISCLOSURE, /not a condition of purchase/i)
assert.match(SELLER_SMS_CONSENT_DISCLOSURE, /Reply STOP/i)
assert.ok(SELLER_SMS_CONSENT_VERSION)

assert.equal(sellerSmsConsentEvidence({
  consented: false,
  consentedAt: new Date().toISOString(),
  sourcePath: '/sell',
  phoneFingerprint: 'a'.repeat(64),
  phoneLast4: '0100',
}), null)

const evidence = sellerSmsConsentEvidence({
  consented: true,
  consentedAt: '2026-09-16T01:00:00.000Z',
  sourcePath: '/sell',
  phoneFingerprint: 'a'.repeat(64),
  phoneLast4: '0100',
  userAgent: 'VestBlock consent test',
  networkFingerprint: 'abc123',
})

assert.equal(evidence?.status, 'granted')
assert.equal(evidence?.brand, 'Vestblock LLC')
assert.equal(evidence?.sourcePath, '/sell')
assert.equal(evidence?.method, 'unchecked_checkbox')
assert.equal(evidence?.phoneFingerprint, 'a'.repeat(64))
assert.equal(evidence?.phoneLast4, '0100')
assert.equal(evidence?.networkFingerprint, 'abc123')

assert.equal(sellerSmsConsentEvidence({
  consented: true,
  consentedAt: '2026-09-16T01:00:00.000Z',
  sourcePath: '/sell',
  phoneFingerprint: '',
  phoneLast4: '0100',
}), null, 'Consent without an exact phone binding must fail closed.')

console.log('Seller SMS consent evidence tests passed.')
