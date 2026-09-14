export type BufferAutoPublishService = 'facebook' | 'linkedin'

export const BUFFER_STALE_CLAIM_AFTER_MS = 30 * 60 * 1000

export const BUFFER_STALE_CLAIM_ERROR =
  'Buffer publishing remained in progress for more than 30 minutes without a provider post ID. Automatic retry is blocked because Buffer may have accepted the post before the response was lost. Verify the VestBlock Buffer queue before retrying.'

export type BufferLedgerRecoveryAction =
  | {
      kind: 'ignore'
      reason:
        | 'not_buffer'
        | 'unsupported_service'
        | 'provider_evidence_present'
        | 'not_sending'
        | 'fresh_claim'
        | 'missing_claim_time'
    }
  | { kind: 'reconcile_provider'; bufferPostId: string }
  | { kind: 'quarantine_stale_claim'; error: string }

export type BufferPublishSkipReason =
  | 'already_scheduled'
  | 'manual_verification_required'
  | 'publish_in_flight'

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export function normalizeBufferAutoPublishService(value: unknown): BufferAutoPublishService | null {
  const normalized = nonEmptyString(value).toLowerCase()
  return normalized === 'facebook' || normalized === 'linkedin' ? normalized : null
}

export function getBufferPublishSkipReason(input: {
  status?: unknown
  metadata?: Record<string, unknown> | null
}): BufferPublishSkipReason | null {
  const metadata = input.metadata || {}
  if (input.status === 'published' || nonEmptyString(metadata.bufferPostId)) return 'already_scheduled'
  if (metadata.bufferRetryBlocked === true) return 'manual_verification_required'
  if (nonEmptyString(metadata.bufferStatus).toLowerCase() === 'sending') return 'publish_in_flight'
  return null
}

export function planBufferLedgerRecovery(input: {
  status?: unknown
  platform?: unknown
  updatedAt?: unknown
  metadata?: Record<string, unknown> | null
  now: Date
}): BufferLedgerRecoveryAction {
  const metadata = input.metadata || {}
  const isBufferAsset =
    nonEmptyString(metadata.publisher).toLowerCase() === 'buffer' ||
    Boolean(nonEmptyString(metadata.bufferChannelId)) ||
    Boolean(nonEmptyString(metadata.bufferPostId)) ||
    Boolean(nonEmptyString(metadata.bufferStatus))
  if (!isBufferAsset) return { kind: 'ignore', reason: 'not_buffer' }

  const service = normalizeBufferAutoPublishService(nonEmptyString(metadata.bufferService) || input.platform)
  if (!service) return { kind: 'ignore', reason: 'unsupported_service' }

  const bufferPostId = nonEmptyString(metadata.bufferPostId)
  if (bufferPostId) return { kind: 'reconcile_provider', bufferPostId }
  if (nonEmptyString(metadata.bufferExternalLink) || nonEmptyString(metadata.externalLink)) {
    return { kind: 'ignore', reason: 'provider_evidence_present' }
  }

  const bufferStatus = nonEmptyString(metadata.bufferStatus).toLowerCase()
  if (input.status === 'published' || bufferStatus !== 'sending') {
    return { kind: 'ignore', reason: 'not_sending' }
  }

  const claimTimeValue = nonEmptyString(metadata.lastAttemptAt) || nonEmptyString(input.updatedAt)
  const claimTime = Date.parse(claimTimeValue)
  if (!Number.isFinite(claimTime)) return { kind: 'ignore', reason: 'missing_claim_time' }

  const staleBefore = input.now.getTime() - BUFFER_STALE_CLAIM_AFTER_MS
  if (claimTime >= staleBefore) return { kind: 'ignore', reason: 'fresh_claim' }

  return { kind: 'quarantine_stale_claim', error: BUFFER_STALE_CLAIM_ERROR }
}

export function buildStaleBufferClaimPatch(input: {
  metadata: Record<string, unknown>
  recoveredAt: string
  error?: string
}) {
  const error = (input.error || BUFFER_STALE_CLAIM_ERROR).slice(0, 500)
  return {
    status: 'ready' as const,
    updated_at: input.recoveredAt,
    metadata_json: {
      ...input.metadata,
      bufferStatus: 'failed',
      bufferError: error,
      bufferRetryBlocked: true,
      bufferRecoveryStatus: 'manual_verification_required',
      bufferRecoveredAt: input.recoveredAt,
    },
  }
}
