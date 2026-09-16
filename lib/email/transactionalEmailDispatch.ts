import 'server-only'

import { createHash } from 'node:crypto'

import {
  isOutlookTransactionalDispatchState,
  type OutlookTransactionalDispatchClaim,
  type OutlookTransactionalDispatchIdentity,
  type OutlookTransactionalDispatchOutcome,
} from '@/lib/email/transactionalEmailDispatchCore'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type ClaimRpcResult = {
  action?: unknown
  dispatchId?: unknown
  dispatchToken?: unknown
  state?: unknown
  graphMessageId?: unknown
  internetMessageId?: unknown
}

type FinalizeRpcResult = {
  finalized?: unknown
  reason?: unknown
  state?: unknown
}

function rpcFailure(error: { code?: string | null }) {
  return error.code
    ? `Transactional email ledger RPC failed (${error.code}).`
    : 'Transactional email ledger RPC failed.'
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseClaim(value: unknown): OutlookTransactionalDispatchClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Transactional email ledger returned an invalid claim.')
  }
  const row = value as ClaimRpcResult
  const action = optionalString(row.action)
  const dispatchId = optionalString(row.dispatchId)
  const dispatchToken = optionalString(row.dispatchToken)
  const state = isOutlookTransactionalDispatchState(row.state) ? row.state : null
  const graphMessageId = optionalString(row.graphMessageId)
  const internetMessageId = optionalString(row.internetMessageId)

  if (action === 'send' && dispatchId && dispatchToken && state === 'dispatching') {
    return { action, dispatchId, dispatchToken, state, graphMessageId, internetMessageId }
  }
  if (
    action === 'deduplicated_accepted' &&
    dispatchId &&
    (state === 'accepted' || state === 'reconciled_accepted')
  ) {
    return { action, dispatchId, dispatchToken: null, state, graphMessageId, internetMessageId }
  }
  if (
    action === 'reconciliation_required' &&
    dispatchId &&
    (state === 'dispatching' || state === 'acceptance_unknown' || state === 'failed_dispatch')
  ) {
    return { action, dispatchId, dispatchToken: null, state, graphMessageId, internetMessageId }
  }
  if (action === 'identity_conflict') {
    return {
      action,
      dispatchId,
      dispatchToken: null,
      state,
      graphMessageId,
      internetMessageId,
    }
  }

  throw new Error('Transactional email ledger returned an unsupported claim state.')
}

export async function recordOutlookTransactionalDraft(
  input: {
    dispatchId: string
    dispatchToken: string
    graphMessageId: string
    internetMessageId: string
  },
  admin: AdminClient = createAdminClient()
) {
  const { data, error } = await admin.rpc('record_outlook_transactional_draft', {
    p_dispatch_id: input.dispatchId,
    p_dispatch_token: input.dispatchToken,
    p_graph_message_id: input.graphMessageId,
    p_internet_message_id: input.internetMessageId,
  })
  if (error) throw new Error(rpcFailure(error))
  const result = (data || {}) as {
    recorded?: unknown
    reason?: unknown
    graphMessageId?: unknown
    internetMessageId?: unknown
  }
  if (
    result.recorded !== true ||
    optionalString(result.graphMessageId) !== input.graphMessageId ||
    optionalString(result.internetMessageId) !== input.internetMessageId
  ) {
    throw new Error(
      `Transactional email ledger did not persist the Graph draft identity (${optionalString(result.reason) || 'unknown_reason'}).`
    )
  }
  return {
    recorded: true as const,
    graphMessageId: input.graphMessageId,
    internetMessageId: input.internetMessageId,
  }
}

export async function claimOutlookTransactionalDispatch(
  identity: OutlookTransactionalDispatchIdentity,
  admin: AdminClient = createAdminClient()
): Promise<OutlookTransactionalDispatchClaim> {
  const { data, error } = await admin.rpc('claim_outlook_transactional_dispatch', {
    p_idempotency_key_hash: identity.idempotencyKeyHash,
    p_payload_hash: identity.payloadHash,
    p_recipient_hash: identity.recipientHash,
    p_correlation_id: identity.correlationId,
    p_event_type: identity.eventType,
    p_key_source: identity.idempotencyKeySource,
  })
  if (error) throw new Error(rpcFailure(error))
  return parseClaim(data)
}

export async function finalizeOutlookTransactionalDispatch(
  input: {
    dispatchId: string
    dispatchToken: string
    outcome: OutlookTransactionalDispatchOutcome
    errorMessage?: string | null
  },
  admin: AdminClient = createAdminClient()
) {
  const errorHash = input.errorMessage
    ? createHash('sha256').update(input.errorMessage).digest('hex')
    : null
  const { data, error } = await admin.rpc('finalize_outlook_transactional_dispatch', {
    p_dispatch_id: input.dispatchId,
    p_dispatch_token: input.dispatchToken,
    p_outcome: input.outcome,
    p_error_hash: errorHash,
  })
  if (error) throw new Error(rpcFailure(error))

  const result = (data || {}) as FinalizeRpcResult
  if (result.finalized !== true) {
    throw new Error(
      `Transactional email ledger did not finalize the owned claim (${optionalString(result.reason) || 'unknown_reason'}).`
    )
  }
  if (!isOutlookTransactionalDispatchState(result.state)) {
    throw new Error('Transactional email ledger returned an invalid finalized state.')
  }
  return { finalized: true as const, state: result.state }
}

/**
 * Operator-only recovery hook. Call this only after Sent Items has been checked
 * using the stored correlation ID. `not_sent` is the only resolution that
 * reopens the logical message for a future attempt.
 */
export async function reconcileOutlookTransactionalDispatch(
  input: {
    dispatchId: string
    resolution: 'accepted' | 'not_sent'
    note?: string | null
  },
  admin: AdminClient = createAdminClient()
) {
  const noteHash = input.note
    ? createHash('sha256').update(input.note).digest('hex')
    : null
  const { data, error } = await admin.rpc('reconcile_outlook_transactional_dispatch', {
    p_dispatch_id: input.dispatchId,
    p_resolution: input.resolution,
    p_note_hash: noteHash,
  })
  if (error) throw new Error(rpcFailure(error))
  return data
}
