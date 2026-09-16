import assert from 'node:assert/strict'

import {
  buildHunterSendVerificationCache,
  hashHunterVerificationEmail,
} from '../lib/outreach/hunterSendVerificationCore'
import {
  assessVerifiedBusinessColdEmailAdmission,
  deriveRecipientBoundBusinessContactEvidence,
} from '../lib/outreach/verifiedBusinessColdEmail'

const now = new Date('2026-09-15T18:00:00.000Z')
const recipientEmail = 'vestblock.partner@gmail.com'
const publicContactInfo = {
  publicEmailEnrichment: {
    provider: 'public_website',
    confidence: 'high',
    checkedAt: now.toISOString(),
  },
  publicEmailCandidates: [{
    email: recipientEmail,
    score: 9,
    sourceUrl: 'https://www.example-business.test/contact-us',
  }],
}
const hunterEvidence = buildHunterSendVerificationCache({
  email: recipientEmail,
  status: 'valid',
  checkedAt: now.toISOString(),
})

const canonicalEvidence = deriveRecipientBoundBusinessContactEvidence({
  contactInfo: publicContactInfo,
  recipientEmail,
  website: 'https://example-business.test',
  now,
})
assert.ok(canonicalEvidence, 'a current exact email published on the canonical business site is admissible')
assert.equal(canonicalEvidence.sourceUrl, 'https://www.example-business.test/contact-us')
assert.equal(
  assessVerifiedBusinessColdEmailAdmission({
    strategyKey: 'funding_prep',
    recipientEmail,
    hunterEvidence,
    businessContactEvidence: canonicalEvidence,
    now,
  }).allowed,
  true,
  'canonical-site evidence may bind a free/webmail recipient to a business'
)

const unrelatedSourceEvidence = deriveRecipientBoundBusinessContactEvidence({
  contactInfo: {
    ...publicContactInfo,
    publicEmailCandidates: [{
      email: recipientEmail,
      score: 9,
      sourceUrl: 'https://directory.example/contact-us',
    }],
  },
  recipientEmail,
  website: 'https://example-business.test',
  now,
})
assert.equal(
  unrelatedSourceEvidence,
  null,
  'an arbitrary HTTP directory must not bind a public email to the business'
)

assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    contactInfo: publicContactInfo,
    recipientEmail,
    website: null,
    now,
  }),
  null,
  'public-source evidence must fail closed when the canonical business website is missing'
)

assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    metadataJson: { businessContactEvidence: canonicalEvidence },
    recipientEmail,
    website: 'https://example-business.test',
    now,
  }),
  null,
  'a caller-provided evidence blob cannot authorize a new cold send'
)

const corporateRecipient = 'ops@example-business.test'
const corporateHunterEvidence = deriveRecipientBoundBusinessContactEvidence({
  metadataJson: {
    hunterContactEnrichment: {
      provider: 'hunter',
      status: 'found',
      accepted: true,
      acceptedVerificationStatus: 'valid',
      acceptedConfidence: 95,
      acceptedRecipientHash: hashHunterVerificationEmail(corporateRecipient),
      domain: 'example-business.test',
      checkedAt: now.toISOString(),
    },
  },
  recipientEmail: corporateRecipient,
  website: 'https://www.example-business.test',
  now,
})
assert.ok(corporateHunterEvidence, 'Hunter evidence is admissible when the exact recipient and business domain align')

assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    metadataJson: {
      hunterContactEnrichment: {
        provider: 'hunter',
        status: 'found',
        accepted: true,
        acceptedVerificationStatus: 'valid',
        acceptedConfidence: 99,
        acceptedRecipientHash: hashHunterVerificationEmail(recipientEmail),
        domain: 'example-business.test',
        checkedAt: now.toISOString(),
      },
    },
    recipientEmail,
    website: 'https://example-business.test',
    now,
  }),
  null,
  'Hunter validity alone cannot authorize a free/webmail recipient whose domain does not match the business website'
)

assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    metadataJson: {
      hunterContactEnrichment: {
        provider: 'hunter',
        status: 'found',
        accepted: true,
        acceptedVerificationStatus: 'valid',
        acceptedConfidence: 99,
        acceptedRecipientHash: hashHunterVerificationEmail('changed@example-business.test'),
        domain: 'example-business.test',
        checkedAt: now.toISOString(),
      },
    },
    recipientEmail: corporateRecipient,
    website: 'https://example-business.test',
    now,
  }),
  null,
  'Hunter business evidence must bind the exact current recipient'
)

console.log('verified-business-cold-email: ok')
