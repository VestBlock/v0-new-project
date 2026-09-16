import assert from 'node:assert/strict'

import {
  APIFY_YELP_LEAD_TYPE,
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

console.log('Apify Yelp normalization tests passed.')
