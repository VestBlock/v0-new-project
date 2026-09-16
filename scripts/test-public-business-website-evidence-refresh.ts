import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { hashHunterVerificationEmail } from '../lib/outreach/hunterSendVerificationCore'
import {
  buildPublicBusinessWebsiteContactInfo,
  observeExactRecipientOnBusinessWebsite,
} from '../lib/outreach/publicBusinessWebsiteEvidenceCore'
import { deriveRecipientBoundBusinessContactEvidence } from '../lib/outreach/verifiedBusinessColdEmail'

function html(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...(init.headers || {}) },
  })
}

function fetchMap(routes: Record<string, Response>) {
  const calls: string[] = []
  const fetchImpl = (async (value: URL | RequestInfo) => {
    const url = String(value)
    calls.push(url)
    const response = routes[url]
    if (!response) return html('not found', { status: 404 })
    return response.clone()
  }) as typeof fetch
  return { fetchImpl, calls }
}

const alwaysPublic = async () => true

async function main() {
{
  const network = fetchMap({
    'https://example.test/': html('<main>Email our team at Partner@Example.test.</main>'),
  })
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl: network.fetchImpl, validatePublicUrl: alwaysPublic },
  })
  assert.deepEqual(result, {
    status: 'found',
    sourceUrl: 'https://example.test/',
    attemptedUrls: ['https://example.test/'],
  })
}

{
  const network = fetchMap({
    'https://example.test/': html('<a href="/contact">Contact</a>'),
    'https://example.test/contact': html('<p>partnerships@example.test</p>'),
  })
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partnerships@example.test',
    dependencies: { fetchImpl: network.fetchImpl, validatePublicUrl: alwaysPublic },
  })
  assert.equal(result.status, 'found')
  assert.equal(result.status === 'found' ? result.sourceUrl : null, 'https://example.test/contact')
  assert.deepEqual(network.calls, ['https://example.test/', 'https://example.test/contact'])
}

{
  const network = fetchMap({
    'https://example.test/': html('<p>not-partner@example.test</p>'),
  })
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl: network.fetchImpl, validatePublicUrl: alwaysPublic },
  })
  assert.equal(result.status, 'not_found', 'a substring inside a different address is not exact evidence')
}

{
  const network = fetchMap({
    'https://example.test/': html('', { status: 302, headers: { location: 'https://evil.test/contact' } }),
  })
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl: network.fetchImpl, validatePublicUrl: alwaysPublic },
  })
  assert.equal(result.status, 'invalid')
  assert.deepEqual(network.calls, ['https://example.test/'], 'a cross-domain redirect must never be fetched')
}

{
  const fetchImpl = (async (value: URL | RequestInfo) => {
    const url = String(value)
    if (url === 'https://example.test/') return html('<a href="/contact">Contact</a>')
    throw new Error('temporary contact page outage')
  }) as typeof fetch
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl, validatePublicUrl: alwaysPublic },
  })
  assert.equal(result.status, 'unavailable', 'a transient contact-page outage must not become permanent no-evidence')
}

{
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'file:///etc/passwd',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl: fetch, validatePublicUrl: alwaysPublic },
  })
  assert.equal(result.status, 'invalid')
}

{
  const fetchImpl = ((_: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })) as typeof fetch
  const result = await observeExactRecipientOnBusinessWebsite({
    website: 'https://example.test/',
    recipientEmail: 'partner@example.test',
    dependencies: { fetchImpl, validatePublicUrl: alwaysPublic },
    timeoutMs: 15,
  })
  assert.equal(result.status, 'unavailable')
}

{
  const observedAt = '2026-09-16T18:00:00.000Z'
  const contactInfo = buildPublicBusinessWebsiteContactInfo({
    existingContactInfo: { existingField: 'preserved' },
    recipientEmail: 'partner@example.test',
    sourceUrl: 'https://www.example.test/contact',
    attemptedUrls: ['https://example.test/', 'https://www.example.test/contact'],
    observedAt,
  })
  assert.equal((contactInfo as Record<string, unknown>).existingField, 'preserved')
  assert.equal(contactInfo.publicEmailEnrichment.recipientHash, hashHunterVerificationEmail('partner@example.test'))
  const evidence = deriveRecipientBoundBusinessContactEvidence({
    contactInfo,
    recipientEmail: 'partner@example.test',
    website: 'https://example.test/',
    now: new Date('2026-09-17T18:00:00.000Z'),
  })
  assert.equal(evidence?.source, 'public_business_website_email')
  assert.equal(evidence?.recipientHash, hashHunterVerificationEmail('partner@example.test'))
  assert.equal(deriveRecipientBoundBusinessContactEvidence({
    contactInfo,
    recipientEmail: 'someone-else@example.test',
    website: 'https://example.test/',
    now: new Date('2026-09-17T18:00:00.000Z'),
  }), null, 'persisted website evidence must remain bound to the current recipient')
  assert.equal(deriveRecipientBoundBusinessContactEvidence({
    contactInfo: {
      ...contactInfo,
      publicEmailEnrichment: {
        ...contactInfo.publicEmailEnrichment,
        recipientHash: hashHunterVerificationEmail('tampered@example.test'),
      },
    },
    recipientEmail: 'partner@example.test',
    website: 'https://example.test/',
    now: new Date('2026-09-17T18:00:00.000Z'),
  }), null, 'a mismatched persisted recipient hash must invalidate website evidence')
}

const runtime = readFileSync(resolve(process.cwd(), 'lib/outreach/publicBusinessWebsiteEvidence.ts'), 'utf8')
assert.match(runtime, /\.eq\('contact_email', input\.entity\.contactEmail\)/)
assert.match(runtime, /\.eq\('updated_at', input\.entity\.updatedAt\)/)
assert.match(runtime, /query\.is\('website', null\)/)
assert.match(runtime, /query\.eq\('website', input\.entity\.website\)/)
assert.match(runtime, /deriveFromEntity\(updatedEntity, now\)/)

console.log('public-business-website-evidence-refresh: ok')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
