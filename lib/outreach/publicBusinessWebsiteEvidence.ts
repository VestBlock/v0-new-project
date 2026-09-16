import 'server-only'

import { lookup } from 'node:dns/promises'
import { request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { Readable } from 'node:stream'

import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  buildPublicBusinessWebsiteContactInfo,
  observeExactRecipientOnBusinessWebsite,
} from '@/lib/outreach/publicBusinessWebsiteEvidenceCore'
import {
  deriveRecipientBoundBusinessContactEvidence,
  type VerifiedBusinessContactEvidence,
} from '@/lib/outreach/verifiedBusinessColdEmail'
import { createAdminClient } from '@/lib/supabase/admin'

type PublicBusinessEvidenceScope = 'buyer' | 'lender'

type PublicBusinessEvidenceEntity = {
  id: string
  contactEmail: string | null | undefined
  website: string | null | undefined
  contactInfo: Record<string, unknown> | null | undefined
  metadataJson: Record<string, unknown> | null | undefined
  source?: string | null
  updatedAt: string
}

export type PublicBusinessEvidenceRefreshResult = {
  evidence: VerifiedBusinessContactEvidence | null
  contactInfo: Record<string, unknown>
  updatedAt: string
  refreshed: boolean
  retryable: boolean
  reason: string
}

const STORAGE = {
  buyer: { table: 'buyers' },
  lender: { table: 'lenders' },
} as const
const PUBLIC_DNS_LOOKUP_TIMEOUT_MS = 2_000

type PublicLookupAddress = { address: string; family: number }

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || a >= 224
}

function isPrivateIpAddress(address: string) {
  const normalized = address.toLowerCase()
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4)
  if (isIP(address) === 4) return isPrivateIpv4(address)
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

function parsePublicBusinessUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username || url.password ||
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname.endsWith('.local')
  ) return null
  if (url.port && !(
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  )) return null
  return url
}

async function resolvePublicBusinessHost(hostname: string): Promise<PublicLookupAddress[]> {
  const literalFamily = isIP(hostname)
  if (literalFamily) {
    return literalFamily !== 4 || isPrivateIpAddress(hostname)
      ? []
      : [{ address: hostname, family: literalFamily }]
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  const lookupPromise: Promise<PublicLookupAddress[]> = lookup(
    hostname,
    { all: true, family: 4, verbatim: true }
  ).then((value) => value as PublicLookupAddress[]).catch(() => [])
  const addresses = await Promise.race<PublicLookupAddress[]>([
    lookupPromise,
    new Promise<PublicLookupAddress[]>((resolve) => {
      timeout = setTimeout(() => resolve([]), PUBLIC_DNS_LOOKUP_TIMEOUT_MS)
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
  if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) return []
  return addresses
}

async function validatePublicBusinessUrl(value: string) {
  const url = parsePublicBusinessUrl(value)
  if (!url) return false
  return (await resolvePublicBusinessHost(url.hostname)).length > 0
}

/**
 * Fetch through a DNS result pinned to the socket. A separate validation followed
 * by global fetch would resolve the hostname twice and leave a DNS-rebinding gap.
 */
export const fetchPinnedPublicBusinessUrl = (async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => {
  const rawUrl = input instanceof Request ? input.url : String(input)
  const url = parsePublicBusinessUrl(rawUrl)
  if (!url) throw new TypeError('Public business website URL is invalid')
  const addresses = await resolvePublicBusinessHost(url.hostname)
  const pinned = addresses[0]
  if (!pinned) throw new TypeError('Public business website host is unavailable')
  const headers = new Headers(init?.headers)
  headers.set('host', url.host)
  const request = url.protocol === 'https:' ? requestHttps : requestHttp
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    callback(null, options.all ? [pinned] : pinned.address, options.all ? undefined : pinned.family)
  }

  return await new Promise<Response>((resolve, reject) => {
    const socketRequest = request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: init?.method || 'GET',
      headers: Object.fromEntries(headers.entries()),
      agent: false,
      signal: init?.signal || undefined,
      lookup: pinnedLookup,
      ...(url.protocol === 'https:' && !isIP(url.hostname)
        ? { servername: url.hostname }
        : {}),
    }, (response) => {
      const responseHeaders = new Headers()
      for (let index = 0; index < response.rawHeaders.length; index += 2) {
        const name = response.rawHeaders[index]
        const value = response.rawHeaders[index + 1]
        if (name && value !== undefined) responseHeaders.append(name, value)
      }
      const body = Readable.toWeb(response) as ReadableStream<Uint8Array>
      resolve(new Response(body, {
        status: response.statusCode || 500,
        statusText: response.statusMessage || '',
        headers: responseHeaders,
      }))
    })
    socketRequest.once('error', reject)
    socketRequest.end()
  })
}) as typeof fetch

function nextCasTimestamp(previous: string, now: Date) {
  const previousMs = Date.parse(previous)
  return new Date(Math.max(now.getTime(), Number.isFinite(previousMs) ? previousMs + 1 : 0)).toISOString()
}

function deriveFromEntity(entity: PublicBusinessEvidenceEntity, now: Date) {
  return deriveRecipientBoundBusinessContactEvidence({
    source: entity.source,
    metadataJson: entity.metadataJson,
    contactInfo: entity.contactInfo,
    recipientEmail: entity.contactEmail,
    website: entity.website,
    now,
  })
}

export async function ensurePublicBusinessWebsiteEvidenceForEntity(input: {
  scope: PublicBusinessEvidenceScope
  entity: PublicBusinessEvidenceEntity
  now?: Date
}): Promise<PublicBusinessEvidenceRefreshResult> {
  const now = input.now || new Date()
  const existingEvidence = deriveFromEntity(input.entity, now)
  if (existingEvidence) {
    return {
      evidence: existingEvidence,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: 'business_contact_evidence_already_fresh',
    }
  }
  const recipientEmail = normalizeEmailAddress(input.entity.contactEmail)
  if (!isUsableContactEmail(recipientEmail)) {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: 'business_contact_evidence_recipient_invalid',
    }
  }

  const observation = await observeExactRecipientOnBusinessWebsite({
    website: input.entity.website,
    recipientEmail,
    dependencies: {
      fetchImpl: fetchPinnedPublicBusinessUrl,
      validatePublicUrl: validatePublicBusinessUrl,
    },
  })
  if (observation.status !== 'found') {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: observation.status === 'unavailable',
      reason: `business_contact_evidence_refresh_${observation.reason}`,
    }
  }

  const observedAt = now.toISOString()
  const contactInfo = buildPublicBusinessWebsiteContactInfo({
    existingContactInfo: input.entity.contactInfo,
    recipientEmail,
    sourceUrl: observation.sourceUrl,
    attemptedUrls: observation.attemptedUrls,
    observedAt,
  })
  const updatedAt = nextCasTimestamp(input.entity.updatedAt, now)
  const admin = createAdminClient()
  let query = admin
    .from(STORAGE[input.scope].table)
    .update({ contact_info: contactInfo, updated_at: updatedAt })
    .eq('id', input.entity.id)
    .eq('contact_email', input.entity.contactEmail)
    .eq('updated_at', input.entity.updatedAt)
  query = input.entity.website == null
    ? query.is('website', null)
    : query.eq('website', input.entity.website)
  const { data, error } = await query
    .select('id,source,contact_email,website,contact_info,metadata_json,updated_at')
    .maybeSingle()
  if (error) {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: true,
      reason: 'business_contact_evidence_refresh_persistence_failed',
    }
  }

  if (!data) {
    const { data: current } = await admin
      .from(STORAGE[input.scope].table)
      .select('id,source,contact_email,website,contact_info,metadata_json,updated_at')
      .eq('id', input.entity.id)
      .maybeSingle()
    const currentRecord = current as Record<string, unknown> | null
    const currentEntity: PublicBusinessEvidenceEntity | null = currentRecord ? {
      id: String(currentRecord.id || ''),
      source: typeof currentRecord.source === 'string' ? currentRecord.source : null,
      contactEmail: typeof currentRecord.contact_email === 'string' ? currentRecord.contact_email : null,
      website: typeof currentRecord.website === 'string' ? currentRecord.website : null,
      contactInfo: currentRecord.contact_info && typeof currentRecord.contact_info === 'object'
        ? currentRecord.contact_info as Record<string, unknown>
        : {},
      metadataJson: currentRecord.metadata_json && typeof currentRecord.metadata_json === 'object'
        ? currentRecord.metadata_json as Record<string, unknown>
        : {},
      updatedAt: String(currentRecord.updated_at || input.entity.updatedAt),
    } : null
    const concurrentEvidence = currentEntity &&
      normalizeEmailAddress(currentEntity.contactEmail) === recipientEmail &&
      currentEntity.website === input.entity.website
      ? deriveFromEntity(currentEntity, now)
      : null
    return {
      evidence: concurrentEvidence || null,
      contactInfo: currentEntity?.contactInfo || input.entity.contactInfo || {},
      updatedAt: currentEntity?.updatedAt || input.entity.updatedAt,
      refreshed: false,
      retryable: !concurrentEvidence,
      reason: concurrentEvidence
        ? 'business_contact_evidence_refreshed_concurrently'
        : 'business_contact_evidence_refresh_concurrent_change',
    }
  }

  const updated = data as Record<string, unknown>
  const updatedEntity: PublicBusinessEvidenceEntity = {
    id: String(updated.id || input.entity.id),
    source: typeof updated.source === 'string' ? updated.source : input.entity.source,
    contactEmail: typeof updated.contact_email === 'string' ? updated.contact_email : null,
    website: typeof updated.website === 'string' ? updated.website : null,
    contactInfo: updated.contact_info && typeof updated.contact_info === 'object'
      ? updated.contact_info as Record<string, unknown>
      : {},
    metadataJson: updated.metadata_json && typeof updated.metadata_json === 'object'
      ? updated.metadata_json as Record<string, unknown>
      : {},
    updatedAt: String(updated.updated_at || updatedAt),
  }
  const evidence = deriveFromEntity(updatedEntity, now)
  return {
    evidence,
    contactInfo: updatedEntity.contactInfo || {},
    updatedAt: updatedEntity.updatedAt,
    refreshed: Boolean(evidence),
    retryable: !evidence,
    reason: evidence
      ? 'business_contact_evidence_refreshed'
      : 'business_contact_evidence_refresh_persisted_evidence_invalid',
  }
}
