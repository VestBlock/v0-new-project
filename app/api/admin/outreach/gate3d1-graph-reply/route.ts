export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  activateGate3d1Canary,
  authorizeGate3d1ReplyContinuation,
  bootstrapGate3d1FounderReviewer,
  executeAuthorizedGate3d1Reply,
  getGate3d1FounderControlReadiness,
  isExactGate3d1FounderIdentity,
  reconcileGate3d1ReplyDispatch,
  recordGate3d1ActivationApproval,
  recordGate3d1ExchangeRbacAttestation,
  releaseGate3d1CanaryControls,
  revokeGate3d1ReplyContinuation,
  saveGate3d1LocalReplyDraft,
  stageGate3d1ActivationReview,
  stopGate3d1CanaryControls,
} from '@/lib/admin/gate3d1GraphReplyControl'
import { checkAdminAccess } from '@/lib/auth/admin'
import { guardPublicMutation } from '@/lib/security/public-mutation'

const idempotencyKey = z.string().trim().min(8).max(128).regex(/^[a-z0-9][a-z0-9_.:-]+$/)
const sha256 = z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/)
const md5 = z.string().trim().toLowerCase().regex(/^[0-9a-f]{32}$/)
const reason = z.string().trim().min(20).max(2_000)

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('bootstrap'),
    idempotencyKey,
    explicitConfirmation: z.literal('BOOTSTRAP_EXACT_VERIFIED_FOUNDER'),
  }).strict(),
  z.object({
    action: z.literal('stage_activation_review'),
    operatingStrategyVersionId: z.string().uuid(),
    reason,
    idempotencyKey,
    explicitConfirmation: z.literal('STAGE_EXACT_CAP_ONE_REVIEW'),
  }).strict(),
  z.object({
    action: z.literal('approve_activation'),
    operatingStrategyVersionId: z.string().uuid(),
    manifestId: z.string().uuid(),
    expectedProposalFingerprint: md5,
    rationale: reason,
    idempotencyKey,
    explicitConfirmation: z.literal('APPROVE_EXACT_CAP_ONE_ACTIVATION_MANIFEST'),
  }).strict(),
  z.object({
    action: z.literal('activate_version'),
    operatingStrategyVersionId: z.string().uuid(),
    manifestId: z.string().uuid(),
    expectedProposalFingerprint: md5,
    idempotencyKey,
    explicitConfirmation: z.literal('ACTIVATE_EXACT_FOUNDER_APPROVED_VERSION'),
  }).strict(),
  z.object({
    action: z.literal('release_controls'),
    operatingStrategyVersionId: z.string().uuid(),
    reason,
    idempotencyKey,
    explicitConfirmation: z.literal('RELEASE_STRATEGY_THEN_GLOBAL_FOR_ONE_CANARY'),
  }).strict(),
  z.object({
    action: z.literal('stop_controls'),
    operatingStrategyId: z.string().uuid(),
    reason,
    idempotencyKey,
    explicitConfirmation: z.literal('STOP_GLOBAL_THEN_STRATEGY'),
  }).strict(),
  z.object({
    action: z.literal('draft'),
    leadId: z.string().uuid(),
    replyMemoryId: z.string().uuid(),
    subject: z.string().trim().max(240).nullable().optional(),
    authoredComment: z.string().trim().min(1).max(9_000),
    messageVersionKey: z.string().trim().regex(/^[a-z0-9][a-z0-9_.:-]{2,127}$/),
    idempotencyKey,
    explicitConfirmation: z.literal('SAVE_LOCAL_DRAFT_ONLY'),
  }).strict(),
  z.object({
    action: z.literal('record_rbac_attestation'),
    outOfScopeMailboxObjectId: z.string().uuid(),
    inScopeProofFingerprint: sha256,
    outOfScopeDenyProofFingerprint: sha256,
    expiresAt: z.string().datetime(),
    rationale: reason,
    idempotencyKey,
    explicitConfirmation: z.literal('RECORD_EXACT_SCOPED_EXCHANGE_RBAC_PROOF'),
  }).strict(),
  z.object({
    action: z.literal('authorize'),
    operatingStrategyVersionId: z.string().uuid(),
    replyMemoryId: z.string().uuid(),
    outreachMessageId: z.string().uuid(),
    exchangeRbacAttestationId: z.string().uuid(),
    reviewedPositiveReplySummarySha256: sha256,
    recipientTimeZone: z.string().trim().min(3).max(100),
    expiresAt: z.string().datetime(),
    rationale: z.string().trim().min(20).max(2_000),
    idempotencyKey,
    explicitConfirmation: z.literal('AUTHORIZE_EXACT_REVIEWED_POSITIVE_SAME_THREAD_REPLY'),
  }).strict(),
  z.object({
    action: z.literal('revoke'),
    authorizationId: z.string().uuid(),
    reason: z.string().trim().min(12).max(2_000),
    idempotencyKey,
    explicitConfirmation: z.literal('REVOKE_EXACT_CONTINUATION'),
  }).strict(),
  z.object({
    action: z.literal('execute'),
    authorizationId: z.string().uuid(),
    outreachMessageId: z.string().uuid(),
    idempotencyKey,
    explicitConfirmation: z.literal('EXECUTE_ONE_EXACT_GRAPH_REPLY'),
  }).strict(),
  z.object({
    action: z.literal('reconcile'),
    claimId: z.string().uuid(),
    resolution: z.enum(['reconciled_accepted', 'reconciled_not_sent', 'dead_lettered']),
    providerEvidenceFingerprint: sha256,
    reason: z.string().trim().min(20).max(2_000),
    idempotencyKey,
    explicitConfirmation: z.literal('RECONCILE_PROVIDER_STATE_MANUALLY'),
  }).strict(),
])

function response(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init)
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return result
}

export async function GET() {
  const access = await checkAdminAccess()
  if (
    !access.isAdmin ||
    !access.user ||
    !isExactGate3d1FounderIdentity(access.user)
  ) {
    return response(
      { error: 'The exact verified VestBlock founder is required.' },
      { status: access.user ? 403 : 401 }
    )
  }
  try {
    return response({
      readiness: await getGate3d1FounderControlReadiness(access.user.id),
    })
  } catch {
    return response(
      { error: 'Gate 3D.1 readiness is unavailable; execution remains blocked.' },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  const guard = guardPublicMutation(request, {
    scope: 'gate3d1-graph-reply-founder-control',
    maxRequests: 20,
    maxBodyBytes: 32 * 1024,
  })
  if (guard) return guard

  const access = await checkAdminAccess()
  if (
    !access.isAdmin ||
    !access.user ||
    !isExactGate3d1FounderIdentity(access.user)
  ) {
    return response(
      { error: 'The exact verified VestBlock founder is required.' },
      { status: access.user ? 403 : 401 }
    )
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return response(
      { error: 'Check the exact Gate 3D.1 founder request.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    switch (parsed.data.action) {
      case 'bootstrap':
        return response({
          founderAuthority: await bootstrapGate3d1FounderReviewer({
            actorUserId: access.user.id,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        }, { status: 201 })
      case 'stage_activation_review':
        return response({
          activationReview: await stageGate3d1ActivationReview({
            actorUserId: access.user.id,
            operatingStrategyVersionId: parsed.data.operatingStrategyVersionId,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        }, { status: 201 })
      case 'approve_activation':
        return response({
          approval: await recordGate3d1ActivationApproval({
            actorUserId: access.user.id,
            operatingStrategyVersionId: parsed.data.operatingStrategyVersionId,
            manifestId: parsed.data.manifestId,
            expectedProposalFingerprint: parsed.data.expectedProposalFingerprint,
            rationale: parsed.data.rationale,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'activate_version':
        return response({
          activation: await activateGate3d1Canary({
            actorUserId: access.user.id,
            operatingStrategyVersionId: parsed.data.operatingStrategyVersionId,
            manifestId: parsed.data.manifestId,
            expectedProposalFingerprint: parsed.data.expectedProposalFingerprint,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'release_controls':
        return response({
          controls: await releaseGate3d1CanaryControls({
            actorUserId: access.user.id,
            operatingStrategyVersionId: parsed.data.operatingStrategyVersionId,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'stop_controls':
        return response({
          controls: await stopGate3d1CanaryControls({
            actorUserId: access.user.id,
            operatingStrategyId: parsed.data.operatingStrategyId,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'draft':
        return response({
          draft: await saveGate3d1LocalReplyDraft({
            actorUserId: access.user.id,
            leadId: parsed.data.leadId,
            replyMemoryId: parsed.data.replyMemoryId,
            subject: parsed.data.subject,
            authoredComment: parsed.data.authoredComment,
            messageVersionKey: parsed.data.messageVersionKey,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        }, { status: 201 })
      case 'record_rbac_attestation':
        return response({
          rbacAttestation: await recordGate3d1ExchangeRbacAttestation({
            actorUserId: access.user.id,
            outOfScopeMailboxObjectId: parsed.data.outOfScopeMailboxObjectId,
            inScopeProofFingerprint: parsed.data.inScopeProofFingerprint,
            outOfScopeDenyProofFingerprint: parsed.data.outOfScopeDenyProofFingerprint,
            expiresAt: parsed.data.expiresAt,
            rationale: parsed.data.rationale,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        }, { status: 201 })
      case 'authorize':
        return response({
          authorization: await authorizeGate3d1ReplyContinuation({
            actorUserId: access.user.id,
            operatingStrategyVersionId: parsed.data.operatingStrategyVersionId,
            replyMemoryId: parsed.data.replyMemoryId,
            outreachMessageId: parsed.data.outreachMessageId,
            exchangeRbacAttestationId: parsed.data.exchangeRbacAttestationId,
            reviewedPositiveReplySummarySha256:
              parsed.data.reviewedPositiveReplySummarySha256,
            recipientTimeZone: parsed.data.recipientTimeZone,
            expiresAt: parsed.data.expiresAt,
            rationale: parsed.data.rationale,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        }, { status: 201 })
      case 'revoke':
        return response({
          revocation: await revokeGate3d1ReplyContinuation({
            actorUserId: access.user.id,
            authorizationId: parsed.data.authorizationId,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'execute':
        return response({
          execution: await executeAuthorizedGate3d1Reply({
            actorUserId: access.user.id,
            authorizationId: parsed.data.authorizationId,
            outreachMessageId: parsed.data.outreachMessageId,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
      case 'reconcile':
        return response({
          reconciliation: await reconcileGate3d1ReplyDispatch({
            actorUserId: access.user.id,
            claimId: parsed.data.claimId,
            resolution: parsed.data.resolution,
            providerEvidenceFingerprint: parsed.data.providerEvidenceFingerprint,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
          }),
        })
    }
  } catch (error) {
    return response(
      {
        error: error instanceof Error
          ? error.message
          : 'Gate 3D.1 action failed closed.',
      },
      { status: 422 }
    )
  }
}
