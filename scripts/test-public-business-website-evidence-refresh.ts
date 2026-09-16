import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { hashHunterVerificationEmail } from '../lib/outreach/hunterSendVerificationCore'
import {
  assessPublicBusinessWebsiteEvidenceMiss,
  buildPublicBusinessWebsiteEvidenceMiss,
  buildPublicBusinessWebsiteContactInfo,
  metadataWithPublicBusinessWebsiteEvidenceMiss,
  metadataWithoutPublicBusinessWebsiteEvidenceMiss,
  observeExactRecipientOnBusinessWebsite,
  PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_METADATA_KEY,
  PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_TTL_MS,
} from '../lib/outreach/publicBusinessWebsiteEvidenceCore'
import {
  deriveRecipientBoundBusinessContactEvidence,
  excludePublicBusinessWebsiteEvidenceMissesFromQueue,
  isPublicBusinessWebsiteEvidenceMissQuarantined,
} from '../lib/outreach/verifiedBusinessColdEmail'
import {
  persistPublicBusinessEvidenceState,
  runPublicBusinessWebsiteEvidenceWorkflow,
  type PublicBusinessEvidenceEntity,
  type PublicBusinessEvidenceStateStore,
} from '../lib/outreach/publicBusinessWebsiteEvidenceWorkflow'

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

function inMemoryEvidenceStore(
  initial: PublicBusinessEvidenceEntity,
  onConflict?: (row: PublicBusinessEvidenceEntity, attempt: number) => PublicBusinessEvidenceEntity,
  conflictEveryAttempt = false
) {
  let row = structuredClone(initial)
  let compareAndSwapCalls = 0
  let readCalls = 0
  const store: PublicBusinessEvidenceStateStore = {
    compareAndSwap: async ({ currentEntity, contactInfo, metadataJson, updatedAt }) => {
      compareAndSwapCalls += 1
      if (onConflict && (conflictEveryAttempt || compareAndSwapCalls === 1)) {
        row = onConflict(structuredClone(row), compareAndSwapCalls)
        return { entity: null, error: null }
      }
      if (
        currentEntity.id !== row.id ||
        currentEntity.contactEmail !== row.contactEmail ||
        currentEntity.website !== row.website ||
        currentEntity.updatedAt !== row.updatedAt
      ) return { entity: null, error: null }
      row = { ...row, contactInfo, metadataJson, updatedAt }
      return { entity: structuredClone(row), error: null }
    },
    readById: async ({ entityId }) => {
      readCalls += 1
      return {
        entity: entityId === row.id ? structuredClone(row) : null,
        error: null,
      }
    },
  }
  return {
    store,
    get row() { return structuredClone(row) },
    get compareAndSwapCalls() { return compareAndSwapCalls },
    get readCalls() { return readCalls },
  }
}

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

{
  const checkedAt = new Date('2026-09-16T18:00:00.000Z')
  const miss = buildPublicBusinessWebsiteEvidenceMiss({
    recipientEmail: 'partner@example.test',
    website: 'https://example.test/contact/',
    reason: 'exact_recipient_not_found_on_business_website',
    checkedAt: checkedAt.toISOString(),
  })
  const metadata = metadataWithPublicBusinessWebsiteEvidenceMiss(
    { existingField: 'preserved' },
    miss
  )
  const fresh = assessPublicBusinessWebsiteEvidenceMiss({
    metadataJson: metadata,
    recipientEmail: 'partner@example.test',
    website: 'https://example.test/contact',
    now: new Date(checkedAt.getTime() + 60_000),
  })
  assert.equal(fresh.active, true, 'a recipient-and-website-bound terminal miss must suppress the next crawl')
  assert.equal(fresh.record?.reason, 'exact_recipient_not_found_on_business_website')
  assert.equal(JSON.stringify(fresh.record).includes('partner@example.test'), false, 'the cache must not store raw recipient email')
  assert.equal(
    isPublicBusinessWebsiteEvidenceMissQuarantined({
      email: 'partner@example.test',
      website: 'https://example.test/contact',
      contact_info: {},
      metadata_json: metadata,
    }, new Date(checkedAt.getTime() + 60_000)),
    true,
    'the queue predicate must reject an active terminal miss'
  )
  const positiveContactInfo = buildPublicBusinessWebsiteContactInfo({
    recipientEmail: 'partner@example.test',
    sourceUrl: 'https://example.test/contact',
    attemptedUrls: ['https://example.test/contact'],
    observedAt: checkedAt.toISOString(),
  })
  assert.equal(
    isPublicBusinessWebsiteEvidenceMissQuarantined({
      email: 'partner@example.test',
      website: 'https://example.test/contact',
      contact_info: positiveContactInfo,
      metadata_json: metadata,
    }, new Date(checkedAt.getTime() + 60_000)),
    false,
    'fresh positive evidence must win over and clear the operational effect of a stale terminal marker'
  )
  assert.equal(
    assessPublicBusinessWebsiteEvidenceMiss({
      metadataJson: metadata,
      recipientEmail: 'changed@example.test',
      website: 'https://example.test/contact',
      now: new Date(checkedAt.getTime() + 60_000),
    }).active,
    false,
    'changing the recipient must immediately invalidate the negative cache'
  )
  assert.equal(
    assessPublicBusinessWebsiteEvidenceMiss({
      metadataJson: metadata,
      recipientEmail: 'partner@example.test',
      website: 'https://other.example.test/contact',
      now: new Date(checkedAt.getTime() + 60_000),
    }).active,
    false,
    'changing the canonical website binding must immediately invalidate the negative cache'
  )
  assert.equal(
    assessPublicBusinessWebsiteEvidenceMiss({
      metadataJson: metadata,
      recipientEmail: 'partner@example.test',
      website: 'https://example.test/contact',
      now: new Date(checkedAt.getTime() + PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_TTL_MS),
    }).reason,
    'public_business_evidence_miss_expired',
    'the denial-only cache must expire at the hard seven-day boundary'
  )
  const futureMiss = buildPublicBusinessWebsiteEvidenceMiss({
    recipientEmail: 'partner@example.test',
    website: 'https://example.test/contact',
    reason: 'website_url_not_http_or_domain_aligned',
    checkedAt: new Date(checkedAt.getTime() + 10 * 60_000).toISOString(),
  })
  assert.equal(
    assessPublicBusinessWebsiteEvidenceMiss({
      metadataJson: metadataWithPublicBusinessWebsiteEvidenceMiss({}, futureMiss),
      recipientEmail: 'partner@example.test',
      website: 'https://example.test/contact',
      now: checkedAt,
    }).reason,
    'public_business_evidence_miss_timestamp_future'
  )
  const cleared = metadataWithoutPublicBusinessWebsiteEvidenceMiss(metadata)
  assert.equal(cleared.existingField, 'preserved')
  assert.equal(cleared[PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_METADATA_KEY], undefined)
}

{
  const now = new Date('2026-09-16T18:00:00.000Z')
  const entity: PublicBusinessEvidenceEntity = {
    id: 'terminal-cache-lead',
    source: 'outscraper_google_maps_businesses',
    contactEmail: 'partner@example.test',
    website: 'https://example.test/',
    contactInfo: {},
    metadataJson: { existing: 'preserved' },
    updatedAt: '2026-09-16T17:00:00.000Z',
  }
  const state = inMemoryEvidenceStore(entity)
  let observationCalls = 0
  const observeTerminal = async () => {
    observationCalls += 1
    return {
      status: 'not_found' as const,
      attemptedUrls: ['https://example.test/'],
      reason: 'exact_recipient_not_found_on_business_website',
    }
  }
  const first = await runPublicBusinessWebsiteEvidenceWorkflow({
    scope: 'lead',
    entity,
    now,
    store: state.store,
    observe: observeTerminal,
  })
  assert.equal(first.retryable, false)
  assert.match(first.reason, /_quarantined$/)
  assert.equal(state.row.metadataJson?.existing, 'preserved')
  const second = await runPublicBusinessWebsiteEvidenceWorkflow({
    scope: 'lead',
    entity: state.row,
    now: new Date(now.getTime() + 60_000),
    store: state.store,
    observe: observeTerminal,
  })
  assert.equal(second.retryable, false)
  assert.match(second.reason, /terminal_miss_cached/)
  assert.equal(observationCalls, 1, 'the second terminal-miss call must perform zero website fetches')
  assert.equal(state.compareAndSwapCalls, 1, 'a cached terminal miss must not write again')
}

{
  const now = new Date('2026-09-16T18:00:00.000Z')
  const entity: PublicBusinessEvidenceEntity = {
    id: 'transient-evidence-lead',
    source: 'apify_yelp_businesses',
    contactEmail: 'partner@example.test',
    website: 'https://example.test/',
    contactInfo: {},
    metadataJson: {},
    updatedAt: '2026-09-16T17:00:00.000Z',
  }
  const state = inMemoryEvidenceStore(entity)
  let observationCalls = 0
  const observeTransient = async () => {
    observationCalls += 1
    return {
      status: 'unavailable' as const,
      attemptedUrls: ['https://example.test/'],
      reason: 'website_fetch_failed',
    }
  }
  const first = await runPublicBusinessWebsiteEvidenceWorkflow({
    scope: 'lead', entity, now, store: state.store, observe: observeTransient,
  })
  const second = await runPublicBusinessWebsiteEvidenceWorkflow({
    scope: 'lead', entity, now, store: state.store, observe: observeTransient,
  })
  assert.equal(first.retryable, true)
  assert.equal(second.retryable, true)
  assert.equal(observationCalls, 2, 'a transient failure must be fetched again on the next attempt')
  assert.equal(state.compareAndSwapCalls, 0, 'transient failures must never be cached')
}

{
  const now = new Date('2026-09-16T18:00:00.000Z')
  const entity: PublicBusinessEvidenceEntity = {
    id: 'evidence-cas-conflict',
    source: 'outscraper_google_maps_businesses',
    contactEmail: 'partner@example.test',
    website: 'https://example.test/',
    contactInfo: { initial: true },
    metadataJson: { original: true },
    updatedAt: '2026-09-16T17:00:00.000Z',
  }
  const state = inMemoryEvidenceStore(entity, (row) => ({
    ...row,
    metadataJson: { ...row.metadataJson, concurrentWriter: 'preserved' },
    updatedAt: '2026-09-16T17:00:01.000Z',
  }))
  const persisted = await persistPublicBusinessEvidenceState({
    scope: 'lead',
    entity,
    now,
    store: state.store,
    buildState: (current) => ({
      contactInfo: current.contactInfo || {},
      metadataJson: { ...(current.metadataJson || {}), workflowWriter: true },
    }),
  })
  assert.equal(persisted.status, 'updated')
  assert.equal(state.compareAndSwapCalls, 2)
  assert.equal(state.row.metadataJson?.concurrentWriter, 'preserved')
  assert.equal(state.row.metadataJson?.workflowWriter, true)

  const bindingState = inMemoryEvidenceStore(entity, (row) => ({
    ...row,
    website: 'https://changed.example.test/',
    updatedAt: '2026-09-16T17:00:01.000Z',
  }))
  const bindingResult = await persistPublicBusinessEvidenceState({
    scope: 'lead',
    entity,
    now,
    store: bindingState.store,
    buildState: (current) => ({
      contactInfo: current.contactInfo || {},
      metadataJson: { ...(current.metadataJson || {}), shouldNotPersist: true },
    }),
  })
  assert.equal(bindingResult.status, 'concurrent')
  assert.equal(bindingState.compareAndSwapCalls, 1, 'a website binding change must abort before another CAS')
  assert.equal(bindingState.row.metadataJson?.shouldNotPersist, undefined)

  const exhaustionState = inMemoryEvidenceStore(entity, (row, attempt) => ({
    ...row,
    metadataJson: { ...row.metadataJson, [`conflict${attempt}`]: true },
    updatedAt: new Date(Date.parse(row.updatedAt) + 1_000).toISOString(),
  }), true)
  const exhaustionResult = await persistPublicBusinessEvidenceState({
    scope: 'lead',
    entity,
    now,
    store: exhaustionState.store,
    buildState: (current) => ({
      contactInfo: current.contactInfo || {},
      metadataJson: { ...(current.metadataJson || {}), workflowWriter: true },
    }),
  })
  assert.equal(exhaustionResult.status, 'concurrent')
  assert.equal(exhaustionState.compareAndSwapCalls, 3, 'evidence CAS retries must remain bounded')
  assert.equal(exhaustionState.readCalls, 3)
}

{
  const now = new Date('2026-09-16T18:00:00.000Z')
  const miss = buildPublicBusinessWebsiteEvidenceMiss({
    recipientEmail: 'blocked@example.test',
    website: 'https://blocked.example.test/',
    reason: 'exact_recipient_not_found_on_business_website',
    checkedAt: now.toISOString(),
  })
  const rows = [
    {
      id: 'newer-cached-miss',
      leads: {
        email: 'blocked@example.test',
        website: 'https://blocked.example.test/',
        contact_info: {},
        metadata_json: metadataWithPublicBusinessWebsiteEvidenceMiss({}, miss),
      },
    },
    {
      id: 'older-valid-replacement',
      leads: {
        email: 'valid@example.test',
        website: 'https://valid.example.test/',
        contact_info: {},
        metadata_json: {},
      },
    },
  ]
  const tightQueue = excludePublicBusinessWebsiteEvidenceMissesFromQueue(rows, now).slice(0, 1)
  assert.deepEqual(
    tightQueue.map((row) => row.id),
    ['older-valid-replacement'],
    'a cached miss ahead of a valid row must not consume a tight replacement slot'
  )
}

const runtime = readFileSync(resolve(process.cwd(), 'lib/outreach/publicBusinessWebsiteEvidence.ts'), 'utf8')
assert.match(runtime, /lead: \{ table: 'leads', emailColumn: 'email' \}/)
assert.match(runtime, /\.eq\(storage\.emailColumn, currentEntity\.contactEmail\)/)
assert.match(runtime, /\.eq\('updated_at', currentEntity\.updatedAt\)/)
assert.match(runtime, /query\.is\('website', null\)/)
assert.match(runtime, /query\.eq\('website', currentEntity\.website\)/)

const workflowRuntime = readFileSync(
  resolve(process.cwd(), 'lib/outreach/publicBusinessWebsiteEvidenceWorkflow.ts'),
  'utf8'
)
assert.match(workflowRuntime, /type PublicBusinessEvidenceScope = 'buyer' \| 'lender' \| 'lead'/)
assert.match(workflowRuntime, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/)
assert.match(workflowRuntime, /observation\.status === 'unavailable'/)
assert.match(workflowRuntime, /metadataWithPublicBusinessWebsiteEvidenceMiss/)
assert.match(workflowRuntime, /metadataWithoutPublicBusinessWebsiteEvidenceMiss/)
assert.match(workflowRuntime, /deriveFromEntity\(updatedEntity, now\)/)

const leadOutbound = readFileSync(resolve(process.cwd(), 'lib/leads/outbound.ts'), 'utf8')
assert.match(leadOutbound, /ensurePublicBusinessWebsiteEvidenceForEntity/)
assert.match(leadOutbound, /scope: 'lead'/)
assert.match(leadOutbound, /public_business_evidence_refresh_retryable/)
assert.ok(
  leadOutbound.indexOf('const businessContact = await ensureLeadBusinessContactEvidence(lead)') <
    leadOutbound.indexOf('const hunter = await ensureFreshHunterSendVerification({'),
  'general lead delivery must recover recipient-bound website evidence before spending a Hunter verification credit'
)

const leadAutomation = readFileSync(resolve(process.cwd(), 'lib/leads/dailyAutomation.ts'), 'utf8')
assert.ok(
  leadAutomation.indexOf('const businessContact = await ensureLeadBusinessContactEvidence(currentLead)') <
    leadAutomation.indexOf('const hunterVerification = await ensureFreshHunterSendVerification({'),
  'the throughput queue must recover recipient-bound website evidence before its Hunter preflight'
)
assert.match(leadAutomation, /status: 'business_evidence_blocked'/)

const leadRepository = readFileSync(resolve(process.cwd(), 'lib/leads/repository.ts'), 'utf8')
assert.ok(
  leadRepository.indexOf('excludePublicBusinessWebsiteEvidenceMissesFromQueue(rows, evidenceNow)') <
    leadRepository.indexOf('prioritizeAndDedupeOutreachQueueCandidates('),
  'active terminal misses must leave the general queue before replacement candidate capping and network work'
)

console.log('public-business-website-evidence-refresh: ok')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
