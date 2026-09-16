import 'server-only'

import {
  getMicrosoftGraphFailureDisposition,
  hasMicrosoftGraphApplicationCredentials,
  sendTransactionalEmailWithMicrosoftGraphIdempotently,
  type MicrosoftGraphFailureDisposition,
} from '@/lib/email/microsoftGraphSend'
import {
  claimOutlookTransactionalDispatch,
  finalizeOutlookTransactionalDispatch,
  recordOutlookTransactionalDraft,
} from '@/lib/email/transactionalEmailDispatch'
import { buildOutlookTransactionalDispatchIdentity } from '@/lib/email/transactionalEmailDispatchCore'
import type { OutlookDispatchFileAttachment } from '@/lib/email/transactionalEmailDispatchCore'
import {
  assessCommercialOutreachContent,
  getCommercialOutreachMailingAddress,
} from '@/lib/outreach/commercialCompliance'
import type { DailyStrategyOutputLaneKey } from '@/lib/outreach/dailyStrategyOutputCore'
import {
  type DeliveryPurpose,
} from '@/lib/outreach/deliveryPurposeCore'
import { resolvePurposeBoundOutboundProvider } from '@/lib/outreach/deliveryRuntime'
import { getEmailQualityIssue, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import type { HunterSendVerificationCache } from '@/lib/outreach/hunterSendVerificationCore'
import {
  assessVerifiedBusinessColdEmailAdmission,
  classifyVerifiedBusinessColdEmailAdmissionScope,
  deriveRecipientBoundBusinessContactEvidence,
} from '@/lib/outreach/verifiedBusinessColdEmail'
import {
  reserveOutlookColdEmailAttempt,
  type OutlookColdBudgetReservation,
} from '@/lib/outreach/outlookColdBudget'
import { isOutlookColdSendWindow } from '@/lib/outreach/outlookColdBudgetCore'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  getOutreachRecipientGuard,
  type OutreachRecipientScope,
} from '@/lib/outreach/suppression'

export type GuardedOutlookEntity = {
  scope: OutreachRecipientScope
  id: string
  recipientEmail: string
  /** Canonical persisted source used by source-specific delivery gates. */
  source?: string | null
  /** Current persisted entity metadata, reloaded immediately before dispatch. */
  metadataJson?: Record<string, unknown> | null
  /** Current persisted contact discovery evidence, when stored separately. */
  contactInfo?: Record<string, unknown> | null
  /** Current canonical business website used to bind Hunter evidence. */
  website?: string | null
}

export type GuardedOutlookEmailInput = {
  strategyKey: DailyStrategyOutputLaneKey
  purpose: DeliveryPurpose
  entity: GuardedOutlookEntity
  subject: string
  html: string
  eventType: string
  idempotencyKey: string
  correlationId?: string | null
  /** Required for cold outreach; every cron run must share one stable ID. */
  invocationId?: string | null
  /** Required for marketing and ignored for transactional/cold delivery. */
  marketingConsentEvidence?: unknown
  now?: Date
  attachments?: readonly OutlookDispatchFileAttachment[] | null
}

export type GuardedOutlookEmailResult = {
  ok: boolean
  provider: 'outlook' | 'none'
  accepted: boolean
  deduplicated: boolean
  providerMessageId: string | null
  internetMessageId: string | null
  dispatchId: string | null
  correlationId: string
  acceptanceStatus: 'accepted' | 'not_accepted' | 'unknown'
  ledgerFinalized: boolean
  reconciliationRequired: boolean
  retrySafe: boolean
  deferred: boolean
  deferredScope: 'record' | 'lane' | 'global' | 'infrastructure' | null
  error: string | null
  policyReason: string
  coldBudget: OutlookColdBudgetReservation | null
}

type GraphDispatchResult = {
  accepted: true
  acceptance: 'accepted'
  deduplicated: boolean
  ledgerFinalized: boolean
  dispatchId: string
  correlationId: string
  providerMessageId: string | null
  graphMessageId: string | null
  internetMessageId: string | null
}

export type GuardedOutlookEmailDependencies = {
  hasGraphCredentials: () => boolean
  recipientGuard: typeof getOutreachRecipientGuard
  replyCaptureReadiness: typeof getOperationalReplyCaptureReadiness
  mailingAddress: () => string
  reserveColdAttempt: typeof reserveOutlookColdEmailAttempt
  sendGraph: (input: {
    to: string
    subject: string
    html: string
    replyTo: string
    correlationId: string
    eventType: string
    idempotencyKey: string
    attachments?: readonly OutlookDispatchFileAttachment[] | null
  }) => Promise<GraphDispatchResult>
  classifyGraphFailure: (error: unknown) => MicrosoftGraphFailureDisposition
}

const DEFAULT_DEPENDENCIES: GuardedOutlookEmailDependencies = {
  hasGraphCredentials: hasMicrosoftGraphApplicationCredentials,
  recipientGuard: getOutreachRecipientGuard,
  replyCaptureReadiness: getOperationalReplyCaptureReadiness,
  mailingAddress: getCommercialOutreachMailingAddress,
  reserveColdAttempt: reserveOutlookColdEmailAttempt,
  sendGraph: (input) => sendTransactionalEmailWithMicrosoftGraphIdempotently(
    input,
    {
      ledger: {
        claim: claimOutlookTransactionalDispatch,
        recordDraft: recordOutlookTransactionalDraft,
        finalize: finalizeOutlookTransactionalDispatch,
      },
    }
  ),
  classifyGraphFailure: getMicrosoftGraphFailureDisposition,
}

function held(input: {
  reason: string
  policyReason: string
  correlationId: string
  provider?: 'outlook' | 'none'
  deferredScope: NonNullable<GuardedOutlookEmailResult['deferredScope']>
  coldBudget?: OutlookColdBudgetReservation | null
}): GuardedOutlookEmailResult {
  return {
    ok: false,
    provider: input.provider || 'none',
    accepted: false,
    deduplicated: false,
    providerMessageId: null,
    internetMessageId: null,
    dispatchId: null,
    correlationId: input.correlationId,
    acceptanceStatus: 'not_accepted',
    ledgerFinalized: false,
    reconciliationRequired: false,
    retrySafe: true,
    deferred: true,
    deferredScope: input.deferredScope,
    error: input.reason,
    policyReason: input.policyReason,
    coldBudget: input.coldBudget || null,
  }
}

function cleanRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * The sole active outreach-email adapter. It never consults Resend telemetry
 * and never crosses providers. Cold B2B adds recipient-bound Hunter/business
 * evidence, suppression/reply-capture checks, a weekday window, and one atomic
 * database reservation covering invocation, lane, domain, and global caps.
 */
export async function sendGuardedOutlookEmail(
  input: GuardedOutlookEmailInput,
  overrides: Partial<GuardedOutlookEmailDependencies> = {}
): Promise<GuardedOutlookEmailResult> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  const now = input.now || new Date()
  const recipientEmail = normalizeEmailAddress(input.entity.recipientEmail)
  const metadataJson = cleanRecord(input.entity.metadataJson) || {}
  const configuredReplyTo = String(
    process.env.OUTREACH_REPLY_TO_EMAIL || process.env.OUTLOOK_ACQUISITIONS_MAILBOX || ''
  ).trim()
  let identity: ReturnType<typeof buildOutlookTransactionalDispatchIdentity>
  try {
    identity = buildOutlookTransactionalDispatchIdentity({
      to: recipientEmail,
      subject: input.subject,
      html: input.html,
      replyTo: configuredReplyTo,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      attachments: input.attachments,
    })
  } catch (error) {
    return held({
      reason: error instanceof Error ? error.message : 'Outlook dispatch identity is invalid.',
      policyReason: 'dispatch_identity_invalid',
      correlationId: String(input.correlationId || ''),
      deferredScope: 'record',
    })
  }

  const emailIssue = getEmailQualityIssue(recipientEmail)
  if (emailIssue) {
    return held({
      reason: `Recipient email is not eligible for delivery (${emailIssue}).`,
      policyReason: 'recipient_email_invalid',
      correlationId: identity.correlationId,
      deferredScope: 'record',
    })
  }

  let coldAdmission: ReturnType<typeof assessVerifiedBusinessColdEmailAdmission> | null = null
  if (input.purpose === 'cold_outreach') {
    const businessContactEvidence = deriveRecipientBoundBusinessContactEvidence({
      source: input.entity.source,
      metadataJson,
      contactInfo: cleanRecord(input.entity.contactInfo),
      recipientEmail,
      website: input.entity.website,
      now,
    })
    coldAdmission = assessVerifiedBusinessColdEmailAdmission({
      strategyKey: input.strategyKey,
      recipientEmail,
      hunterEvidence: cleanRecord(metadataJson.hunterSendVerification) as HunterSendVerificationCache | null,
      businessContactEvidence,
      now,
    })
    if (!coldAdmission.allowed) {
      return held({
        reason: `Verified B2B cold email admission failed (${coldAdmission.reason}).`,
        policyReason: coldAdmission.reason,
        correlationId: identity.correlationId,
        deferredScope: classifyVerifiedBusinessColdEmailAdmissionScope(coldAdmission.reason),
      })
    }
  }

  const deliveryRoute = resolvePurposeBoundOutboundProvider(
    {
      strategyKey: input.strategyKey,
      purpose: input.purpose,
      recipientEmail,
      marketingConsentEvidence: input.marketingConsentEvidence,
      isBusinessContact: coldAdmission?.allowed === true,
    },
    {
      gmail: false,
      resend: false,
      outlook: dependencies.hasGraphCredentials(),
    }
  )
  if (!deliveryRoute.allowed) {
    return held({
      reason: deliveryRoute.error || 'Delivery is held by purpose policy.',
      policyReason: deliveryRoute.policy.reason,
      correlationId: identity.correlationId,
      provider: deliveryRoute.action === 'hold_provider_unavailable' ? 'outlook' : 'none',
      deferredScope: deliveryRoute.deferredScope,
    })
  }

  const recipientGuard = await dependencies.recipientGuard({
    scope: input.entity.scope,
    entityId: input.entity.id,
    email: recipientEmail,
  }).catch(() => ({ allowed: false as const, reason: 'recipient_guard_unavailable' }))
  if (!recipientGuard.allowed) {
    return held({
      reason: `Recipient safety check blocked delivery (${recipientGuard.reason}).`,
      policyReason: recipientGuard.reason,
      correlationId: identity.correlationId,
      deferredScope: recipientGuard.reason === 'recipient_guard_unavailable' ? 'infrastructure' : 'record',
    })
  }

  const replyCapture = await dependencies.replyCaptureReadiness({ now }).catch(() => null)
  if (!replyCapture?.ready || !replyCapture.operational) {
    return held({
      reason: replyCapture?.reason || 'Operational reply capture is unavailable.',
      policyReason: 'reply_capture_not_operational',
      correlationId: identity.correlationId,
      deferredScope: 'infrastructure',
    })
  }
  const replyTo = replyCapture.replyToEmail

  if (input.purpose !== 'transactional') {
    const mailingAddress = dependencies.mailingAddress()
    const contentCompliance = assessCommercialOutreachContent({
      html: input.html,
      mailingAddress,
    })
    if (!contentCompliance.mailingAddressConfigured) {
      return held({
        reason: 'Commercial outreach mailing address is not configured.',
        policyReason: 'commercial_mailing_address_missing',
        correlationId: identity.correlationId,
        deferredScope: 'infrastructure',
      })
    }
    if (contentCompliance.missingOptOut) {
      return held({
        reason: 'Commercial outreach content does not render a clear opt-out instruction.',
        policyReason: 'commercial_content_opt_out_missing',
        correlationId: identity.correlationId,
        deferredScope: 'lane',
      })
    }
    if (contentCompliance.missingMailingAddress) {
      return held({
        reason: 'Commercial outreach content does not render the configured physical mailing address.',
        policyReason: 'commercial_content_mailing_address_missing',
        correlationId: identity.correlationId,
        deferredScope: 'lane',
      })
    }

  }

  let coldBudget: OutlookColdBudgetReservation | null = null
  if (input.purpose === 'cold_outreach') {
    if (!isOutlookColdSendWindow(now)) {
      return held({
        reason: 'Direct cold Outlook dispatch is outside the weekday 15:00–21:59 UTC send window.',
        policyReason: 'outlook_cold_send_window_closed',
        correlationId: identity.correlationId,
        deferredScope: 'global',
      })
    }
    const invocationId = String(input.invocationId || '').trim()
    if (!invocationId) {
      return held({
        reason: 'Cold Outlook dispatch requires a stable cron invocation ID.',
        policyReason: 'outlook_cold_invocation_id_missing',
        correlationId: identity.correlationId,
        deferredScope: 'infrastructure',
      })
    }
    coldBudget = await dependencies.reserveColdAttempt({
      recipientEmail,
      idempotencyKey: identity.effectiveIdempotencyKey,
      invocationId,
      strategyKey: input.strategyKey,
      now,
    }).catch(() => null)
    if (!coldBudget?.allowed) {
      return held({
        reason: `Cold Outlook delivery budget blocked this attempt (${coldBudget?.reason || 'budget_unavailable'}).`,
        policyReason: coldBudget?.reason || 'outlook_cold_budget_unavailable',
        correlationId: identity.correlationId,
        deferredScope: coldBudget?.reason?.includes('lane') ? 'lane' : 'global',
        coldBudget,
      })
    }
  }

  try {
    const result = await dependencies.sendGraph({
      to: recipientEmail,
      subject: input.subject,
      html: input.html,
      replyTo,
      correlationId: identity.correlationId,
      eventType: input.eventType,
      idempotencyKey: identity.effectiveIdempotencyKey,
      attachments: input.attachments,
    })
    return {
      ok: true,
      provider: 'outlook',
      accepted: true,
      deduplicated: result.deduplicated,
      providerMessageId: result.providerMessageId,
      internetMessageId: result.internetMessageId,
      dispatchId: result.dispatchId,
      correlationId: result.correlationId,
      acceptanceStatus: 'accepted',
      ledgerFinalized: result.ledgerFinalized,
      reconciliationRequired: !result.ledgerFinalized,
      retrySafe: false,
      deferred: false,
      deferredScope: null,
      error: null,
      policyReason: deliveryRoute.policy.reason,
      coldBudget,
    }
  } catch (error) {
    const failure = dependencies.classifyGraphFailure(error)
    const retrySafe =
      failure.acceptance === 'not_accepted' &&
      failure.phase === 'pre_dispatch' &&
      failure.safeToFallback
    const reconciliationRequired = !retrySafe
    return {
      ok: false,
      provider: 'outlook',
      accepted: false,
      deduplicated: false,
      providerMessageId: failure.graphMessageId || null,
      internetMessageId: failure.internetMessageId || null,
      dispatchId: failure.dispatchId || null,
      correlationId: failure.correlationId || identity.correlationId,
      acceptanceStatus: failure.acceptance,
      ledgerFinalized: false,
      reconciliationRequired,
      retrySafe,
      deferred: retrySafe,
      deferredScope: retrySafe ? 'infrastructure' : null,
      error: reconciliationRequired
        ? `${failure.message} Reconcile Outlook Sent Items before another attempt.`
        : failure.message,
      policyReason: deliveryRoute.policy.reason,
      coldBudget,
    }
  }
}
