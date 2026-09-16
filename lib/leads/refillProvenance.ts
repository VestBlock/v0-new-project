import { createHmac, timingSafeEqual } from 'node:crypto'

import { getSourceFamily } from '@/lib/leads/source-keys'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'

export const CURRENT_EMAIL_REFILL_METADATA_KEY = 'serverEmailReadyRefillProvenance'

const CURRENT_EMAIL_REFILL_PURPOSE = 'vestblock_server_email_ready_refill'
const CURRENT_EMAIL_REFILL_VERSION = 2
const CURRENT_EMAIL_REFILL_MAX_AGE_MS = 72 * 60 * 60 * 1000
const CURRENT_EMAIL_REFILL_FUTURE_SKEW_MS = 5 * 60 * 1000

export type CurrentEmailRefillProvider = 'outscraper' | 'apify'

export type CurrentEmailRefillMarker = {
  purpose: typeof CURRENT_EMAIL_REFILL_PURPOSE
  version: typeof CURRENT_EMAIL_REFILL_VERSION
  provider: CurrentEmailRefillProvider
  issuedAt: string
  leadId: string
  source: string
  sourceFamily: string
  signature: string
}

type CanonicalLeadWithRefillProvenance = {
  id?: string | null
  source?: string | null
  email?: string | null
  email_valid?: boolean | null
  metadata_json?: Record<string, unknown> | null
}

const APPROVED_CANONICAL_SOURCE_FAMILIES = new Set([
  'outscraper_google_maps_businesses',
  'apify_yelp_businesses',
])

function getSigningSecret() {
  const secret = String(
    process.env.LEADS_REFILL_PROVENANCE_SECRET || process.env.CRON_SECRET || ''
  ).trim()
  return secret.length >= 16 ? secret : null
}

function canonicalMarkerPayload(input: {
  provider: CurrentEmailRefillProvider
  issuedAt: string
  leadId: string
  source: string
  sourceFamily: string
  email: string
}) {
  return [
    CURRENT_EMAIL_REFILL_PURPOSE,
    String(CURRENT_EMAIL_REFILL_VERSION),
    input.provider,
    input.issuedAt,
    input.leadId,
    input.source,
    input.sourceFamily,
    normalizeEmailAddress(input.email),
  ].join('\n')
}

function signMarkerPayload(
  input: Parameters<typeof canonicalMarkerPayload>[0],
  secret: string
) {
  return createHmac('sha256', secret).update(canonicalMarkerPayload(input)).digest('hex')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isCurrentEmailRefillProvider(value: unknown): value is CurrentEmailRefillProvider {
  return value === 'outscraper' || value === 'apify'
}

function signaturesMatch(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(actual) || actual.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(actual, 'utf8'), Buffer.from(expected, 'utf8'))
}

/**
 * Builds a short-lived marker only after a lead has a canonical database id,
 * source and recipient. The discovery provider may differ from the canonical
 * source when a fresh Apify/Outscraper result dedupes into the other approved
 * family, but Google Places and every other legacy family remain ineligible.
 */
export function buildCurrentEmailReadyRefillProvenance(
  lead: CanonicalLeadWithRefillProvenance,
  input: {
    provider: CurrentEmailRefillProvider
    issuedAt?: Date
  }
): CurrentEmailRefillMarker | null {
  const leadId = String(lead.id || '').trim()
  const source = String(lead.source || '').trim()
  const sourceFamily = getSourceFamily(source)
  if (
    !leadId ||
    lead.email_valid === false ||
    !isUsableContactEmail(lead.email) ||
    !APPROVED_CANONICAL_SOURCE_FAMILIES.has(sourceFamily)
  ) {
    return null
  }

  const secret = getSigningSecret()
  if (!secret) {
    throw new Error(
      'Current refill provenance requires LEADS_REFILL_PROVENANCE_SECRET or CRON_SECRET with at least 16 characters.'
    )
  }

  const issuedAt = (input.issuedAt || new Date()).toISOString()
  const signatureInput = {
    provider: input.provider,
    issuedAt,
    leadId,
    source,
    sourceFamily,
    email: lead.email || '',
  }
  return {
    purpose: CURRENT_EMAIL_REFILL_PURPOSE,
    version: CURRENT_EMAIL_REFILL_VERSION,
    provider: input.provider,
    issuedAt,
    leadId,
    source,
    sourceFamily,
    signature: signMarkerPayload(signatureInput, secret),
  }
}

export function hasValidCurrentEmailReadyRefillProvenance(
  lead: CanonicalLeadWithRefillProvenance | null | undefined,
  nowMs = Date.now()
) {
  if (
    !lead ||
    !Number.isFinite(nowMs) ||
    !String(lead.id || '').trim() ||
    lead.email_valid === false ||
    !isUsableContactEmail(lead.email)
  ) return false

  const rawMarker = lead.metadata_json?.[CURRENT_EMAIL_REFILL_METADATA_KEY]
  if (!isPlainRecord(rawMarker)) return false
  if (rawMarker.purpose !== CURRENT_EMAIL_REFILL_PURPOSE) return false
  if (rawMarker.version !== CURRENT_EMAIL_REFILL_VERSION) return false
  if (!isCurrentEmailRefillProvider(rawMarker.provider)) return false
  if (typeof rawMarker.issuedAt !== 'string') return false
  if (typeof rawMarker.leadId !== 'string') return false
  if (typeof rawMarker.source !== 'string') return false
  if (typeof rawMarker.sourceFamily !== 'string') return false
  if (typeof rawMarker.signature !== 'string') return false

  const leadId = String(lead.id || '').trim()
  const source = String(lead.source || '').trim()
  const sourceFamily = getSourceFamily(source)
  if (
    rawMarker.leadId !== leadId ||
    rawMarker.source !== source ||
    rawMarker.sourceFamily !== sourceFamily ||
    !APPROVED_CANONICAL_SOURCE_FAMILIES.has(sourceFamily)
  ) {
    return false
  }

  const issuedAtMs = Date.parse(rawMarker.issuedAt)
  if (!Number.isFinite(issuedAtMs)) return false
  if (issuedAtMs > nowMs + CURRENT_EMAIL_REFILL_FUTURE_SKEW_MS) return false
  if (nowMs - issuedAtMs > CURRENT_EMAIL_REFILL_MAX_AGE_MS) return false

  const secret = getSigningSecret()
  if (!secret) return false

  const expectedSignature = signMarkerPayload(
    {
      provider: rawMarker.provider,
      issuedAt: rawMarker.issuedAt,
      leadId,
      source,
      sourceFamily,
      email: lead.email || '',
    },
    secret
  )

  return signaturesMatch(rawMarker.signature, expectedSignature)
}
