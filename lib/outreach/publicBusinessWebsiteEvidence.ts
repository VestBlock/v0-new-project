import 'server-only'

import { lookup } from 'node:dns/promises'
import { request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { Readable } from 'node:stream'

import {
  observeExactRecipientOnBusinessWebsite,
} from '@/lib/outreach/publicBusinessWebsiteEvidenceCore'
import {
  runPublicBusinessWebsiteEvidenceWorkflow,
  type PublicBusinessEvidenceEntity,
  type PublicBusinessEvidenceRefreshResult,
  type PublicBusinessEvidenceScope,
  type PublicBusinessEvidenceStateStore,
} from '@/lib/outreach/publicBusinessWebsiteEvidenceWorkflow'
import { createAdminClient } from '@/lib/supabase/admin'

export type { PublicBusinessEvidenceRefreshResult }

const STORAGE = {
  buyer: { table: 'buyers', emailColumn: 'contact_email' },
  lender: { table: 'lenders', emailColumn: 'contact_email' },
  lead: { table: 'leads', emailColumn: 'email' },
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

function selectColumnsForStorage(storage: (typeof STORAGE)[PublicBusinessEvidenceScope]) {
  return storage.emailColumn === 'email'
    ? 'id,source,email,website,contact_info,metadata_json,updated_at'
    : 'id,source,contact_email,website,contact_info,metadata_json,updated_at'
}

function entityFromRecord(input: {
  record: Record<string, unknown>
  storage: (typeof STORAGE)[PublicBusinessEvidenceScope]
  fallback: PublicBusinessEvidenceEntity
}) : PublicBusinessEvidenceEntity {
  const { record, storage, fallback } = input
  return {
    id: String(record.id || fallback.id),
    source: typeof record.source === 'string' ? record.source : fallback.source,
    contactEmail: typeof record[storage.emailColumn] === 'string'
      ? record[storage.emailColumn] as string
      : null,
    website: typeof record.website === 'string' ? record.website : null,
    contactInfo: record.contact_info && typeof record.contact_info === 'object'
      ? record.contact_info as Record<string, unknown>
      : {},
    metadataJson: record.metadata_json && typeof record.metadata_json === 'object'
      ? record.metadata_json as Record<string, unknown>
      : {},
    updatedAt: String(record.updated_at || fallback.updatedAt),
  }
}

function createPublicBusinessEvidenceStateStore(): PublicBusinessEvidenceStateStore {
  const admin = createAdminClient()
  return {
    compareAndSwap: async ({ scope, currentEntity, contactInfo, metadataJson, updatedAt }) => {
      const storage = STORAGE[scope]
      const selectColumns = selectColumnsForStorage(storage)
      let query = admin
        .from(storage.table)
        .update({
          contact_info: contactInfo,
          metadata_json: metadataJson,
          updated_at: updatedAt,
        })
        .eq('id', currentEntity.id)
        .eq(storage.emailColumn, currentEntity.contactEmail)
        .eq('updated_at', currentEntity.updatedAt)
      query = currentEntity.website == null
        ? query.is('website', null)
        : query.eq('website', currentEntity.website)
      const { data, error } = await query.select(selectColumns).maybeSingle()
      return {
        entity: data
          ? entityFromRecord({
              record: data as Record<string, unknown>,
              storage,
              fallback: currentEntity,
            })
          : null,
        error,
      }
    },
    readById: async ({ scope, entityId }) => {
      const storage = STORAGE[scope]
      const selectColumns = selectColumnsForStorage(storage)
      const { data, error } = await admin
        .from(storage.table)
        .select(selectColumns)
        .eq('id', entityId)
        .maybeSingle()
      return {
        entity: data
          ? entityFromRecord({
              record: data as Record<string, unknown>,
              storage,
              fallback: {
                id: entityId,
                source: null,
                contactEmail: null,
                website: null,
                contactInfo: {},
                metadataJson: {},
                updatedAt: '',
              },
            })
          : null,
        error,
      }
    },
  }
}

export async function ensurePublicBusinessWebsiteEvidenceForEntity(input: {
  scope: PublicBusinessEvidenceScope
  entity: PublicBusinessEvidenceEntity
  now?: Date
}): Promise<PublicBusinessEvidenceRefreshResult> {
  return runPublicBusinessWebsiteEvidenceWorkflow({
    ...input,
    store: createPublicBusinessEvidenceStateStore(),
    observe: ({ website, recipientEmail }) => observeExactRecipientOnBusinessWebsite({
      website,
      recipientEmail,
      dependencies: {
        fetchImpl: fetchPinnedPublicBusinessUrl,
        validatePublicUrl: validatePublicBusinessUrl,
      },
    }),
  })
}
