import assert from 'node:assert/strict'

import {
  APIFY_YELP_LEAD_TYPE,
  matchApifyYelpNiche,
  normalizeApifyYelpDatasetItem,
} from '@/lib/leads/connectors/apify-yelp'

assert.equal(
  APIFY_YELP_LEAD_TYPE,
  'lead_intelligence',
  'Apify records must use a lead type accepted by the production database contract'
)

const currentActorItem = normalizeApifyYelpDatasetItem({
  name: 'Prince Street Pizza',
  bizId: 'zj8Lq1T8KIC5zwFief15jg',
  directUrl: 'https://www.yelp.com/biz/prince-street-pizza-new-york-2',
  address: {
    addressLine1: '27 Prince St',
    addressLine2: ' Suite 2 ',
    addressLine3: '',
    city: 'New York',
    regionCode: 'NY',
    postalCode: '10012',
    country: 'US',
  },
  phone: '(212) 966-4100',
  website: 'https://locations.princestreetpizza.com/new-york',
  aggregatedRating: 4.3,
  reviewCount: 5705,
  priceRange: 'Under US$10',
  categories: ['Restaurants', 'Pizza'],
}, { city: 'Fallback City', state: 'WI' })

assert.deepEqual(currentActorItem, {
  businessName: 'Prince Street Pizza',
  sourceUrl: 'https://www.yelp.com/biz/prince-street-pizza-new-york-2',
  website: 'https://locations.princestreetpizza.com/new-york',
  externalId: 'zj8Lq1T8KIC5zwFief15jg',
  phone: '(212) 966-4100',
  addressLine: '27 Prince St, Suite 2',
  city: 'New York',
  state: 'NY',
  zip: '10012',
  rating: 4.3,
  reviewCount: 5705,
  price: 'Under US$10',
  businessType: 'Restaurants',
  categories: ['Restaurants', 'Pizza'],
})

const legacyItem = normalizeApifyYelpDatasetItem({
  id: 'legacy-business-id',
  name: 'Legacy Auto Repair',
  url: 'https://www.yelp.com/biz/legacy-auto-repair-milwaukee',
  address: '100 W Main St',
  city: 'Milwaukee',
  state: 'WI',
  zip: '53202',
  phone: '414-555-0100',
  rating: '4.8',
  reviewCount: '42',
  price: '$$',
  categories: [{ alias: 'auto-repair' }],
}, { city: 'Fallback City', state: 'IL' })

assert.equal(legacyItem?.externalId, 'legacy-business-id')
assert.equal(legacyItem?.addressLine, '100 W Main St')
assert.equal(legacyItem?.city, 'Milwaukee')
assert.equal(legacyItem?.state, 'WI')
assert.equal(legacyItem?.zip, '53202')
assert.equal(legacyItem?.rating, 4.8)
assert.equal(legacyItem?.reviewCount, 42)
assert.equal(legacyItem?.businessType, 'auto-repair')
assert.equal(legacyItem?.sourceUrl, 'https://www.yelp.com/biz/legacy-auto-repair-milwaukee')
assert.equal(legacyItem?.website, null)

const currentActorItemWithoutWebsite = normalizeApifyYelpDatasetItem({
  bizId: 'current-missing-site',
  name: 'Current Schema Without External Site',
  directUrl: 'https://www.yelp.com/biz/current-schema-without-external-site',
  address: {
    addressLine1: '10 Main St',
    city: 'Fort Wayne',
    regionCode: 'IN',
    postalCode: '46802',
  },
  aggregatedRating: 4.1,
  reviewCount: 12,
}, { city: 'Fallback City', state: 'IL' })

assert.equal(currentActorItemWithoutWebsite?.sourceUrl, 'https://www.yelp.com/biz/current-schema-without-external-site')
assert.equal(
  currentActorItemWithoutWebsite?.website,
  null,
  'a Yelp directory URL must never be promoted to the business website'
)

assert.equal(
  normalizeApifyYelpDatasetItem({ address: 123 }, { city: 'Milwaukee' }),
  null,
  'invalid dataset items remain quarantined instead of throwing'
)

assert.equal(
  matchApifyYelpNiche(currentActorItem, ['sign installation companies', 'pizza restaurants']),
  'pizza restaurants',
  'current actor categories should select the relevant niche instead of the first requested niche'
)

assert.equal(
  matchApifyYelpNiche(legacyItem, ['event production companies', 'auto repair shops']),
  'auto repair shops',
  'legacy object categories should remain eligible for exact-token niche matching'
)

const validSignBusiness = normalizeApifyYelpDatasetItem({
  bizId: 'valid-sign-business',
  name: 'Acme Signs & Lighting',
  directUrl: 'https://www.yelp.com/biz/acme-signs-and-lighting',
  categories: ['Signmaking'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(validSignBusiness, ['sign installation companies']),
  'sign installation companies',
  'a direct sign-industry token should remain eligible even when Yelp uses Signmaking'
)

const misleadingSignRestaurant = normalizeApifyYelpDatasetItem({
  bizId: 'misleading-sign-restaurant',
  name: 'The Sign Restaurant',
  categories: ['Restaurants'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(misleadingSignRestaurant, ['sign installation companies']),
  null,
  'a business-name token cannot override an unrelated populated Yelp category'
)

const exactNameGenericCategoryCases = [
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Northstar Residential Remodeling',
      categories: ['General Contractors'],
    }, { city: 'Milwaukee' }),
    niche: 'residential remodeling companies',
  },
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Acme Business Funding Brokers',
      categories: ['Financial Services'],
    }, { city: 'Milwaukee' }),
    niche: 'business funding brokers',
  },
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Acme Sign Installation',
      categories: ['Local Services'],
    }, { city: 'Milwaukee' }),
    niche: 'sign installation companies',
  },
] as const

for (const example of exactNameGenericCategoryCases) {
  assert.equal(
    matchApifyYelpNiche(example.record, [example.niche]),
    example.niche,
    `a complete multi-token business-name match should survive a generic Yelp category: ${example.niche}`
  )
}

const residentialCleaner = normalizeApifyYelpDatasetItem({
  bizId: 'residential-cleaner',
  name: 'Northstar Home Cleaning',
  categories: ['Home Cleaning'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(residentialCleaner, ['commercial cleaning companies']),
  null,
  'an unmatched commercial qualifier must not admit a residential cleaning record'
)

const commercialCleaner = normalizeApifyYelpDatasetItem({
  bizId: 'commercial-cleaner',
  name: 'Northstar Commercial Cleaning',
  categories: ['Home Cleaning'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(commercialCleaner, ['commercial cleaning companies']),
  'commercial cleaning companies',
  'a qualifier supported by the business identity and a category-supported niche token remains eligible'
)

const propertyManager = normalizeApifyYelpDatasetItem({
  bizId: 'property-manager',
  name: 'Northstar Property Management',
  categories: ['Property Management'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(propertyManager, ['boutique property management companies']),
  'boutique property management companies',
  'a soft positioning adjective must not starve an otherwise specific two-token match'
)
assert.equal(
  matchApifyYelpNiche(propertyManager, ['small property management companies']),
  'small property management companies',
  'small is a ranking term rather than a mandatory segment qualifier'
)

const qualifiedNicheNearMisses = [
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Public Insurance Agency',
      categories: ['Insurance'],
    }, { city: 'Milwaukee' }),
    niche: 'public adjusters and insurance claim consultants',
  },
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Metro Commercial General Contractor',
      categories: ['General Contractors'],
    }, { city: 'Milwaukee' }),
    niche: 'commercial renovation contractors',
  },
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Hard Rock Mortgage Broker',
      categories: ['Mortgage Brokers'],
    }, { city: 'Milwaukee' }),
    niche: 'hard money brokers',
  },
  {
    record: normalizeApifyYelpDatasetItem({
      name: 'Low Cost Security',
      categories: ['Security Systems'],
    }, { city: 'Milwaukee' }),
    niche: 'low voltage and security integration contractors',
  },
] as const

for (const example of qualifiedNicheNearMisses) {
  assert.equal(
    matchApifyYelpNiche(example.record, [example.niche]),
    null,
    `hard-qualified niche must prove its anchor term: ${example.niche}`
  )
}

const publicAdjuster = normalizeApifyYelpDatasetItem({
  name: 'Metro Public Adjusters',
  categories: ['Public Adjusters'],
}, { city: 'Milwaukee' })

assert.equal(
  matchApifyYelpNiche(publicAdjuster, ['public adjusters and insurance claim consultants']),
  'public adjusters and insurance claim consultants',
  'a hard-qualified niche remains eligible when both qualifier and anchor are supported'
)

const irrelevantEventPlanner = normalizeApifyYelpDatasetItem({
  bizId: 'irrelevant-event-planner',
  name: 'Signature Design Events',
  directUrl: 'https://www.yelp.com/biz/signature-design-events',
  categories: ['Event Planning & Services'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(irrelevantEventPlanner, ['sign installation companies']),
  null,
  'sign must not match as a substring of signature or design'
)
assert.equal(
  matchApifyYelpNiche(irrelevantEventPlanner, ['event production companies']),
  null,
  'one ambiguous word must not relabel event planning as event production'
)

const insuranceAgency = normalizeApifyYelpDatasetItem({
  bizId: 'insurance-agency',
  name: 'Northstar Insurance Agency',
  categories: ['Insurance'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(insuranceAgency, ['public adjusters and insurance claim consultants']),
  null,
  'one industry word must not satisfy a longer compound niche'
)

const validEventProducer = normalizeApifyYelpDatasetItem({
  bizId: 'valid-event-producer',
  name: 'Northstar Event Production',
  directUrl: 'https://www.yelp.com/biz/northstar-event-production',
  categories: ['Event Production'],
}, { city: 'Milwaukee', state: 'WI' })

assert.equal(
  matchApifyYelpNiche(validEventProducer, ['event production companies']),
  'event production companies',
  'two exact industry tokens should preserve valid multi-word matches'
)

assert.equal(
  matchApifyYelpNiche(
    normalizeApifyYelpDatasetItem({
      name: 'Northstar Event Planning',
      categories: ['Event Planning'],
    }, { city: 'Milwaukee' }),
    ['sign installation companies', 'commercial cleaning companies']
  ),
  null,
  'an unmatched actor result must fail closed instead of inheriting the first niche'
)

console.log('Apify Yelp normalization tests passed.')
