import 'server-only'

import { getOutlookMailboxStatus } from '@/lib/email/outlookMailbox'
import { normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_REPLY_CAPTURE_MAX_SYNC_AGE_MINUTES = 120
const REPLY_CAPTURE_JOB_KEY = 'reply-memory-sync'
const MAILBOX_IDENTITY_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

function envBool(name: string, fallback = false) {
  const value = process.env[name]
  if (!value) return fallback
  return /^(1|true|yes|on)$/i.test(value.trim())
}

export type ReplyCaptureReadiness = {
  ready: boolean
  required: boolean
  overrideEnabled: boolean
  configured: boolean
  mailbox: string
  replyToEmail: string
  identityMatches: boolean
  authMode: string
  missing: string[]
  reason: string | null
}

export type ReplyCaptureIdentityReadiness = {
  ready: boolean
  replyToEmail: string
  monitoredMailbox: string
  missing: string[]
  reason: string | null
}

export type ReplyCaptureSyncEvidence = {
  status: string | null
  last_status: string | null
  last_run_at: string | null
  last_error: string | null
}

export type OperationalReplyCaptureReadiness = ReplyCaptureReadiness & {
  operational: boolean
  freshnessRequired: boolean
  syncFresh: boolean
  syncStatus: string | null
  syncLastStatus: string | null
  lastSuccessfulSyncAt: string | null
  syncAgeMinutes: number | null
  maxSyncAgeMinutes: number
}

function positiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function cleanStatus(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function isValidMailboxIdentity(value: string) {
  if (!MAILBOX_IDENTITY_RE.test(value) || value.length > 254) return false
  const [localPart] = value.split('@')
  return Boolean(localPart && localPart.length <= 64 && !localPart.startsWith('.') && !localPart.endsWith('.') && !localPart.includes('..'))
}

export function evaluateReplyCaptureIdentity(input: {
  replyToEmail: string | null | undefined
  monitoredMailbox: string | null | undefined
}): ReplyCaptureIdentityReadiness {
  const rawReplyToEmail = String(input.replyToEmail || '').trim()
  const rawMonitoredMailbox = String(input.monitoredMailbox || '').trim()
  const replyToEmail = normalizeEmailAddress(rawReplyToEmail)
  const monitoredMailbox = normalizeEmailAddress(rawMonitoredMailbox)
  const missing = [
    !rawReplyToEmail ? 'OUTREACH_REPLY_TO_EMAIL' : null,
    !rawMonitoredMailbox ? 'OUTLOOK_ACQUISITIONS_MAILBOX' : null,
  ].filter((value): value is string => Boolean(value))

  if (missing.length > 0) {
    return {
      ready: false,
      replyToEmail,
      monitoredMailbox,
      missing,
      reason: `Reply capture identity is incomplete. Configure ${missing.join(' and ')} explicitly.`,
    }
  }

  if (!isValidMailboxIdentity(replyToEmail) || !isValidMailboxIdentity(monitoredMailbox)) {
    return {
      ready: false,
      replyToEmail,
      monitoredMailbox,
      missing: [],
      reason: 'OUTREACH_REPLY_TO_EMAIL and OUTLOOK_ACQUISITIONS_MAILBOX must both be valid single email addresses.',
    }
  }

  if (replyToEmail !== monitoredMailbox) {
    return {
      ready: false,
      replyToEmail,
      monitoredMailbox,
      missing: [],
      reason: `Outbound reply-to ${replyToEmail} does not match the monitored Outlook mailbox ${monitoredMailbox}.`,
    }
  }

  return {
    ready: true,
    replyToEmail,
    monitoredMailbox,
    missing: [],
    reason: null,
  }
}

export function evaluateOperationalReplyCaptureReadiness(input: {
  configuration: ReplyCaptureReadiness
  evidence: ReplyCaptureSyncEvidence | null
  now?: Date
  maxSyncAgeMinutes?: number
  evidenceError?: string | null
}): OperationalReplyCaptureReadiness {
  const now = input.now || new Date()
  const maxSyncAgeMinutes = positiveInt(
    input.maxSyncAgeMinutes == null ? null : String(input.maxSyncAgeMinutes),
    DEFAULT_REPLY_CAPTURE_MAX_SYNC_AGE_MINUTES
  )
  const base = input.configuration
  const freshnessRequired = base.required && !base.overrideEnabled
  const evidence = input.evidence
  const syncStatus = evidence?.status || null
  const syncLastStatus = evidence?.last_status || null
  const successfulState =
    cleanStatus(syncStatus) === 'active' &&
    cleanStatus(syncLastStatus) === 'completed' &&
    !String(evidence?.last_error || '').trim()
  const syncTimestamp = successfulState ? Date.parse(String(evidence?.last_run_at || '')) : Number.NaN
  const syncAgeMinutes = Number.isFinite(syncTimestamp)
    ? (now.getTime() - syncTimestamp) / 60_000
    : null
  const syncFresh =
    successfulState &&
    syncAgeMinutes !== null &&
    syncAgeMinutes >= -5 &&
    syncAgeMinutes <= maxSyncAgeMinutes

  if (!base.identityMatches) {
    return {
      ...base,
      ready: false,
      operational: false,
      freshnessRequired,
      syncFresh: false,
      syncStatus,
      syncLastStatus,
      lastSuccessfulSyncAt: null,
      syncAgeMinutes: null,
      maxSyncAgeMinutes,
    }
  }

  if (!freshnessRequired) {
    return {
      ...base,
      ready: true,
      operational: true,
      freshnessRequired: false,
      syncFresh,
      syncStatus,
      syncLastStatus,
      lastSuccessfulSyncAt: Number.isFinite(syncTimestamp) ? evidence?.last_run_at || null : null,
      syncAgeMinutes,
      maxSyncAgeMinutes,
      reason: null,
    }
  }

  if (!base.ready || !base.configured) {
    return {
      ...base,
      ready: false,
      operational: false,
      freshnessRequired: true,
      syncFresh: false,
      syncStatus,
      syncLastStatus,
      lastSuccessfulSyncAt: null,
      syncAgeMinutes: null,
      maxSyncAgeMinutes,
    }
  }

  let reason: string | null = null
  if (input.evidenceError) {
    reason = `Reply capture for ${base.mailbox} cannot be verified because its sync status is unavailable.`
  } else if (!evidence) {
    reason = `Reply capture for ${base.mailbox} has no recorded successful inbound sync.`
  } else if (!successfulState) {
    reason = `Reply capture for ${base.mailbox} is not operational; the latest sync status is ${cleanStatus(syncStatus) || 'unknown'}/${cleanStatus(syncLastStatus) || 'unknown'}.`
  } else if (syncAgeMinutes === null) {
    reason = `Reply capture for ${base.mailbox} has no valid successful-sync timestamp.`
  } else if (syncAgeMinutes < -5) {
    reason = `Reply capture for ${base.mailbox} has an invalid future successful-sync timestamp.`
  } else if (!syncFresh) {
    reason = `Reply capture for ${base.mailbox} is stale; the last successful inbound sync was ${Math.floor(syncAgeMinutes)} minutes ago (maximum ${maxSyncAgeMinutes}).`
  }

  return {
    ...base,
    ready: syncFresh,
    operational: syncFresh,
    freshnessRequired: true,
    syncFresh,
    syncStatus,
    syncLastStatus,
    lastSuccessfulSyncAt: Number.isFinite(syncTimestamp) ? evidence?.last_run_at || null : null,
    syncAgeMinutes,
    maxSyncAgeMinutes,
    reason,
  }
}

export function getReplyCaptureReadiness(): ReplyCaptureReadiness {
  const mailbox = getOutlookMailboxStatus()
  const required = envBool('OUTREACH_REQUIRE_REPLY_CAPTURE', true)
  const overrideEnabled = envBool('OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE', false)
  const identity = evaluateReplyCaptureIdentity({
    replyToEmail: process.env.OUTREACH_REPLY_TO_EMAIL,
    monitoredMailbox: process.env.OUTLOOK_ACQUISITIONS_MAILBOX,
  })
  const ready = identity.ready && (!required || mailbox.configured || overrideEnabled)
  const missing = [...new Set([...mailbox.missing.map(String), ...identity.missing])]

  return {
    ready,
    required,
    overrideEnabled,
    configured: mailbox.configured,
    mailbox: mailbox.mailbox,
    replyToEmail: identity.replyToEmail,
    identityMatches: identity.ready,
    authMode: mailbox.authMode,
    missing,
    reason: ready
      ? null
      : identity.reason || `Reply capture for ${mailbox.mailbox} is disconnected. Missing ${mailbox.missing.join(' and ')}.`,
  }
}

export async function getOperationalReplyCaptureReadiness(options: {
  now?: Date
  maxSyncAgeMinutes?: number
} = {}): Promise<OperationalReplyCaptureReadiness> {
  const configuration = getReplyCaptureReadiness()
  const maxSyncAgeMinutes = options.maxSyncAgeMinutes || positiveInt(
    process.env.OUTREACH_REPLY_CAPTURE_MAX_AGE_MINUTES,
    DEFAULT_REPLY_CAPTURE_MAX_SYNC_AGE_MINUTES
  )

  if (
    !configuration.identityMatches ||
    !configuration.required ||
    configuration.overrideEnabled ||
    !configuration.configured
  ) {
    return evaluateOperationalReplyCaptureReadiness({
      configuration,
      evidence: null,
      now: options.now,
      maxSyncAgeMinutes,
    })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('command_center_jobs')
    .select('status,last_status,last_run_at,last_error')
    .eq('job_key', REPLY_CAPTURE_JOB_KEY)
    .maybeSingle()

  return evaluateOperationalReplyCaptureReadiness({
    configuration,
    evidence: (data || null) as ReplyCaptureSyncEvidence | null,
    now: options.now,
    maxSyncAgeMinutes,
    evidenceError: error?.message || null,
  })
}
