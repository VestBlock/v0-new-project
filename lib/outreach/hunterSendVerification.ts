import 'server-only'

import { verifyEmailWithHunter, type HunterEmailVerificationStatus } from '@/lib/email/hunterVerifier'
import type { LeadRecord } from '@/lib/leads/types'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  reserveHunterSendVerification,
  type HunterSendVerificationScope,
} from '@/lib/outreach/hunterSendVerificationBudget'
import {
  assessHunterSendVerificationCache,
  buildHunterSendVerificationCache,
  type HunterSendVerificationCache,
} from '@/lib/outreach/hunterSendVerificationCore'
import { createAdminClient } from '@/lib/supabase/admin'

export type HunterSendVerificationResult = {
  sendable: boolean
  status: HunterEmailVerificationStatus | 'unverified'
  source: 'cache' | 'live' | 'blocked'
  reason: string
  creditReserved: boolean
  dailyBudgetRemaining?: number
  cache?: HunterSendVerificationCache
}

function maxAgeMsFromEnv() {
  const parsed = Number.parseInt(process.env.LEADS_HUNTER_VERIFICATION_MAX_AGE_HOURS || '', 10)
  const hours = Number.isFinite(parsed) ? Math.min(168, Math.max(1, parsed)) : 72
  return hours * 60 * 60 * 1_000
}

type HunterVerificationEntity = {
  id: string
  email: string | null | undefined
  metadata_json: Record<string, unknown> | null | undefined
}

const HUNTER_VERIFICATION_ENTITY_STORAGE = {
  lead: { table: 'leads', emailColumn: 'email' },
  buyer: { table: 'buyers', emailColumn: 'contact_email' },
  lender: { table: 'lenders', emailColumn: 'contact_email' },
  investor: { table: 'investor_profiles', emailColumn: 'contact_email' },
} as const

type PersistedHunterVerificationScope = keyof typeof HUNTER_VERIFICATION_ENTITY_STORAGE

async function persistVerificationCache(input: {
  scope: PersistedHunterVerificationScope
  entityId: string
  email: string
  cache: HunterSendVerificationCache
}) {
  const storage = HUNTER_VERIFICATION_ENTITY_STORAGE[input.scope]
  const admin = createAdminClient()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: current, error: readError } = await admin
      .from(storage.table)
      .select(`${storage.emailColumn},metadata_json,updated_at`)
      .eq('id', input.entityId)
      .maybeSingle()
    if (readError) throw readError
    const currentRecord = current as Record<string, unknown> | null
    if (
      !currentRecord ||
      normalizeEmailAddress(String(currentRecord[storage.emailColumn] || '')) !== normalizeEmailAddress(input.email)
    ) return false

    const metadata = currentRecord.metadata_json && typeof currentRecord.metadata_json === 'object'
      ? currentRecord.metadata_json as Record<string, unknown>
      : {}
    const { data: updated, error: updateError } = await admin
      .from(storage.table)
      .update({
        metadata_json: {
          ...metadata,
          hunterSendVerification: input.cache,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.entityId)
      .eq(storage.emailColumn, currentRecord[storage.emailColumn])
      .eq('updated_at', currentRecord.updated_at)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (updated?.id) return true
  }
  return false
}

export async function ensureFreshHunterSendVerificationForEntity(input: {
  scope: PersistedHunterVerificationScope
  entity: HunterVerificationEntity
  messageId: string
  allowNetwork: boolean
  dailyLimit: number
  now?: Date
}): Promise<HunterSendVerificationResult> {
  const now = input.now || new Date()
  const email = normalizeEmailAddress(input.entity.email)
  if (!isUsableContactEmail(email)) {
    return {
      sendable: false,
      status: 'unverified',
      source: 'blocked',
      reason: 'hunter_verification_email_unusable',
      creditReserved: false,
    }
  }

  const cached = assessHunterSendVerificationCache({
    metadata: input.entity.metadata_json,
    email,
    now,
    maxAgeMs: maxAgeMsFromEnv(),
  })
  if (cached.fresh && cached.record) {
    return {
      sendable: cached.sendable,
      status: cached.record.status,
      source: 'cache',
      reason: cached.reason,
      creditReserved: false,
      cache: cached.record,
    }
  }
  if (!input.allowNetwork || input.dailyLimit < 1) {
    return {
      sendable: false,
      status: cached.record?.status || 'unverified',
      source: 'blocked',
      reason: input.allowNetwork ? 'lead_hunter_daily_budget_exhausted' : cached.reason,
      creditReserved: false,
    }
  }

  let reservation
  try {
    reservation = await reserveHunterSendVerification({
      scope: input.scope as HunterSendVerificationScope,
      messageId: input.messageId,
      email,
      dailyLimit: input.dailyLimit,
      now,
    })
  } catch {
    return {
      sendable: false,
      status: cached.record?.status || 'unverified',
      source: 'blocked',
      reason: 'hunter_verification_budget_unavailable',
      creditReserved: false,
    }
  }
  if (!reservation.allowed) {
    return {
      sendable: false,
      status: cached.record?.status || 'unverified',
      source: 'blocked',
      reason: reservation.reason || 'lead_hunter_budget_blocked',
      creditReserved: false,
      dailyBudgetRemaining: reservation.remaining,
    }
  }

  let verification
  try {
    verification = await verifyEmailWithHunter({ email, now })
  } catch {
    return {
      sendable: false,
      status: 'unverified',
      source: 'live',
      reason: 'hunter_verification_safety_unavailable',
      creditReserved: true,
      dailyBudgetRemaining: reservation.remaining,
    }
  }
  const cache = verification.cacheable
    ? buildHunterSendVerificationCache({
        email,
        status: verification.status,
        checkedAt: verification.checkedAt,
      })
    : undefined
  if (verification.cacheable) {
    const persisted = await persistVerificationCache({
      scope: input.scope,
      entityId: input.entity.id,
      email,
      cache: cache!,
    }).catch(() => false)
    if (!persisted) {
      return {
        sendable: false,
        status: verification.status,
        source: 'live',
        reason: 'hunter_verification_cache_write_failed',
        creditReserved: true,
        dailyBudgetRemaining: reservation.remaining,
      }
    }
  }

  return {
    sendable: verification.cacheable && verification.status === 'valid',
    status: verification.status,
    source: 'live',
    reason: verification.status === 'valid' && verification.cacheable ? 'hunter_valid_live' : verification.reason,
    creditReserved: true,
    dailyBudgetRemaining: reservation.remaining,
    cache,
  }
}

export async function ensureFreshHunterSendVerification(input: {
  lead: LeadRecord
  messageId: string
  allowNetwork: boolean
  dailyLimit: number
  now?: Date
}) {
  return ensureFreshHunterSendVerificationForEntity({
    scope: 'lead',
    entity: {
      id: input.lead.id,
      email: input.lead.email,
      metadata_json: input.lead.metadata_json,
    },
    messageId: input.messageId,
    allowNetwork: input.allowNetwork,
    dailyLimit: input.dailyLimit,
    now: input.now,
  })
}
