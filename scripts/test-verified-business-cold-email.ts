import assert from 'node:assert/strict'

import {
  buildHunterSendVerificationCache,
  hashHunterVerificationEmail,
} from '../lib/outreach/hunterSendVerificationCore'
import {
  assessVerifiedBusinessColdEmailAdmission,
  deriveRecipientBoundBusinessContactEvidence,
} from '../lib/outreach/verifiedBusinessColdEmail'
import { isListingAgentIntermediaryLead } from '../lib/outreach/listingAgentCore'

const now = new Date('2026-09-15T18:00:00.000Z')
const recipientEmail = 'vestblock.partner@gmail.com'
const listingAgentEmailHash = hashHunterVerificationEmail(recipientEmail)
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

const listingAgentEvidence = deriveRecipientBoundBusinessContactEvidence({
  source: 'homeharvest_stale_listing',
  metadataJson: {
    strategyPrimary: 'active-stale-creative',
    strategySourceFamilies: ['homeharvest'],
    sourceObservedAt: now.toISOString(),
    listingUrl: 'https://listing.example.test/property/123',
    listingAgentEmailHash,
  },
  contactInfo: {
    contactRole: 'listing_agent',
    publicBusinessContact: true,
  },
  recipientEmail,
  now,
})
assert.equal(
  isListingAgentIntermediaryLead({
    source: 'homeharvest_stale_listing',
    metadata_json: {
      strategyPrimary: 'active-stale-creative',
      strategySourceFamilies: ['homeharvest'],
      listingUrl: 'https://listing.example.test/property/123',
      listingAgentEmailHash,
    },
    contact_info: { contactRole: 'listing_agent', publicBusinessContact: true },
  }),
  true
)
assert.ok(listingAgentEvidence, 'a current listing-feed agent contact is admissible business evidence')
assert.equal(listingAgentEvidence.source, 'verified_listing_feed_agent_contact')
assert.equal(
  assessVerifiedBusinessColdEmailAdmission({
    strategyKey: 'listing_agents',
    recipientEmail,
    hunterEvidence,
    businessContactEvidence: listingAgentEvidence,
    now,
  }).allowed,
  true,
  'fresh listing-agent evidence and exact-recipient Hunter verification may enter the partner lane'
)
assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    source: 'homeharvest_stale_listing',
    metadataJson: {
      strategyPrimary: 'active-stale-creative',
      strategySourceFamilies: ['homeharvest'],
      sourceObservedAt: now.toISOString(),
      listingUrl: 'https://listing.example.test/property/123',
      listingAgentEmailHash,
    },
    contactInfo: { contactRole: 'listing_agent', publicBusinessContact: true },
    recipientEmail: 'changed-recipient@example.test',
    now,
  }),
  null,
  'a recipient changed after source observation must not inherit listing-agent business evidence'
)
assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    source: 'csv_import',
    metadataJson: {
      strategyPrimary: 'active-stale-creative',
      strategySourceFamilies: ['homeharvest'],
      sourceObservedAt: now.toISOString(),
      listingUrl: 'https://listing.example.test/property/123',
      listingAgentEmailHash,
    },
    contactInfo: { contactRole: 'listing_agent', publicBusinessContact: true },
    recipientEmail,
    now,
  }),
  null,
  'lookalike metadata from a non-HomeHarvest lead source must not authorize outreach'
)
assert.equal(
  deriveRecipientBoundBusinessContactEvidence({
    source: 'homeharvest_stale_listing',
    metadataJson: {
      strategyPrimary: 'active-stale-creative',
      strategySourceFamilies: ['homeharvest'],
      sourceObservedAt: '2026-07-01T00:00:00.000Z',
      listingUrl: 'https://listing.example.test/property/old',
      listingAgentEmailHash,
    },
    contactInfo: { contactRole: 'listing_agent', publicBusinessContact: true },
    recipientEmail,
    now,
  }),
  null,
  'stale listing-feed evidence must not authorize new agent outreach'
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
