import assert from 'node:assert/strict'

import {
  formatPersistedOperationalError,
  formatStructuredError,
} from '../lib/system/errorMessage'

const postgrestError = {
  code: '23502',
  message: 'Null value violates not-null constraint.',
  details: 'Failing row contains (person@example.com, private lead details).',
  hint: 'Inspect person@example.com.',
}

const formatted = formatPersistedOperationalError(postgrestError, 'Lead ingestion failed.')
assert.equal(formatted, 'Lead ingestion failed. (code: 23502)')
assert.doesNotMatch(formatted, /\[object Object\]/)
assert.doesNotMatch(formatted, /person@example\.com|private lead details|Inspect/i)

assert.equal(
  formatPersistedOperationalError({ code: 'PGRST204', details: 'private row contents' }, 'Lead ingestion failed.'),
  'Lead ingestion failed. (code: PGRST204)'
)
assert.equal(
  formatPersistedOperationalError({ details: 'private row contents' }, 'Apify Yelp processing failed.'),
  'Apify Yelp processing failed.'
)
assert.equal(
  formatPersistedOperationalError({ message: { nested: 'not safe to serialize' } }, 'Lead ingestion failed.'),
  'Lead ingestion failed.'
)

const providerError = Object.assign(new Error(
  'POST https://api.apify.com/v2/acts/example?token=secret_value_12345678901234567890 failed for person@example.com with Authorization=Bearer abcdefghijklmnopqrstuvwxyz123456'
), { code: 'HTTP_402' })
const persistedProviderError = formatPersistedOperationalError(
  providerError,
  'Provider operation failed.'
)
assert.equal(persistedProviderError, 'Provider operation failed. (code: HTTP_402)')
assert.doesNotMatch(persistedProviderError, /api\.apify|secret_value|person@example|abcdefghijklmnopqrstuvwxyz/i)

const displayProviderError = formatStructuredError(providerError, 'Provider operation failed.')
assert.doesNotMatch(displayProviderError, /api\.apify|secret_value|person@example|abcdefghijklmnopqrstuvwxyz/i)
assert.match(displayProviderError, /\[url\]|\[email\]|\[redacted\]/)

console.log('Safe operational error formatting checks passed.')
