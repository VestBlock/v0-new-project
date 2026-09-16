export type PartnerOutreachSendResult = {
  ok: boolean
  deferred?: boolean
  deferredScope?: 'record' | 'lane' | 'global' | 'infrastructure'
  provider: 'outlook' | 'none'
  error?: string | null
}

export type PartnerOutreachSendDisposition = {
  providerAttempted: boolean
  quarantineRecord: boolean
  stopReplacementScan: boolean
}

/**
 * Separates a record-quality rejection from an Outlook provider attempt.
 *
 * Hunter and other record-scoped gates can reject a candidate before Graph is
 * called. Those candidates must leave the approved queue without consuming an
 * Outlook send slot so the bounded replacement pool can continue. Lane,
 * global, and infrastructure deferrals stop the scan because another record
 * cannot fix them.
 */
export function classifyPartnerOutreachSendResult(
  result: PartnerOutreachSendResult
): PartnerOutreachSendDisposition {
  const deferred = result.ok === false && result.deferred === true
  const recordDeferred = deferred && result.deferredScope === 'record'
  const retryableReservation = recordDeferred &&
    /lead_hunter_(?:claim|email)_already_reserved/.test(String(result.error || '').toLowerCase())
  const quarantineRecord = recordDeferred && !retryableReservation

  return {
    providerAttempted: result.provider === 'outlook',
    quarantineRecord,
    stopReplacementScan: deferred && !recordDeferred,
  }
}

export function isPartnerSendOperationalFailureStatus(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase()
  return normalized === 'failed' ||
    normalized === 'record_delivery_quarantine_failed' ||
    normalized === 'delivery_deferred_restore_failed' ||
    (normalized.startsWith('automatic_email_') &&
      normalized !== 'automatic_email_daily_attempt_quota_exhausted')
}
