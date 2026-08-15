import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  recordOperatingStrategyActivity,
  resolveOperatingStrategyBinding,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'

export const N8N_CHANNELS = [
  'resend_email',
  'outlook_graph',
  'buffer_vestblock',
  'operator_task',
  'manual_phone_task',
  'website_notification',
  'no_outreach',
] as const

export type N8nChannel = (typeof N8N_CHANNELS)[number]
export type OrchestrationMode = 'no_send' | 'internal_test' | 'approved_live'

function configuration() {
  const url = process.env.N8N_WEBHOOK_URL?.trim()
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim()
  if (!url || !secret) throw new Error('n8n webhook configuration is incomplete.')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('n8n webhook must use HTTPS.')
  const approvedHost = process.env.N8N_ALLOWED_HOST?.trim().toLowerCase()
  const hostname = parsed.hostname.toLowerCase()
  if (!(hostname.endsWith('.n8n.cloud') || (approvedHost && hostname === approvedHost))) {
    throw new Error('n8n webhook host is not allowlisted.')
  }
  return { url, secret }
}

function sign(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

export function verifyN8nSignature(input: { body: string; timestamp: string; signature: string; secret: string; now?: number }) {
  const signedAt = Date.parse(input.timestamp)
  if (!Number.isFinite(signedAt) || Math.abs((input.now ?? Date.now()) - signedAt) > 5 * 60_000) return false
  const expected = sign(input.secret, input.timestamp, input.body)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(input.signature)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

type N8nDispatchInput = {
  eventType: 'workflow_contract_test' | 'approved_outreach_requested' | 'match_reviewed' | 'strategy_version_activated'
  strategyIdentifierNamespace?: string | null
  strategyIdentifier?: string | null
  legacyStrategyLaneKey?: string | null
  legacyStrategyVersionId?: string | null
  matchId?: string | null
  crmLeadId?: string | null
  outboundEnrollmentId?: string | null
  dispatchReservationId?: string | null
  subjectNamespace?: string | null
  subjectKey?: string | null
  idempotencyKey: string
  mode: OrchestrationMode
  channel: N8nChannel
  templateKey?: string | null
  templateVersion?: number | null
  operatorUserId: string
}

function governedRuntimePayload(binding: OperatingStrategyBinding) {
  return {
    sourceNamespace: binding.namespace,
    sourceIdentifier: binding.sourceIdentifier,
    portfolioKey: binding.portfolioKey,
    strategyKey: binding.strategyKey,
    operatingStrategyId: binding.operatingStrategyId,
    operatingStrategyVersionId: binding.operatingStrategyVersionId,
    version: binding.version,
    executionMode: binding.executionMode,
    externalSendCap: binding.externalSendCap,
    destinationMode: binding.destinationMode,
    destinationPath: binding.destinationPath,
    ctaLabel: binding.ctaLabel,
    contractFingerprint: binding.contractFingerprint,
    crmOwnerKey: binding.crmOwnerKey,
    automationOwnerKey: binding.automationOwnerKey,
    dispatchAuthority: binding.dispatchAuthority,
  }
}

function optionalString(value: unknown) {
  return String(value || '').trim() || null
}

function requestedTemplateVersion(input: N8nDispatchInput) {
  return optionalString(input.templateKey) ? input.templateVersion || 1 : null
}

function resolveN8nSubject(input: N8nDispatchInput, binding: OperatingStrategyBinding | null) {
  let namespace = optionalString(input.subjectNamespace)
  let key = optionalString(input.subjectKey)
  if (Boolean(namespace) !== Boolean(key)) {
    throw new Error('n8n subject attribution requires both a namespace and key.')
  }
  if (!namespace || !key) {
    if (input.matchId) {
      namespace = 'participant_opportunity_match'
      key = input.matchId
    } else if (input.crmLeadId) {
      namespace = 'lead'
      key = input.crmLeadId
    } else if (binding) {
      namespace = 'operating_strategy_version'
      key = binding.operatingStrategyVersionId
    } else {
      namespace = 'orchestration_contract_test'
      key = input.idempotencyKey
    }
  }
  if (!/^[a-z0-9_]+$/.test(namespace) || !key) {
    throw new Error('n8n orchestration requires a valid canonical subject namespace and key.')
  }
  return { namespace, key }
}

function buildN8nPayload(input: {
  request: N8nDispatchInput
  binding: OperatingStrategyBinding | null
  subjectNamespace: string
  subjectKey: string
  operatorTaskId: string
  requestedAt: string
}) {
  return {
    contract: 'vestblock.n8n.v2',
    eventType: input.request.eventType,
    idempotencyKey: input.request.idempotencyKey,
    mode: input.request.mode,
    channel: input.request.channel,
    strategy: input.binding ? governedRuntimePayload(input.binding) : null,
    references: {
      matchId: optionalString(input.request.matchId),
      crmLeadId: optionalString(input.request.crmLeadId),
      outboundEnrollmentId: optionalString(input.request.outboundEnrollmentId),
      dispatchReservationId: optionalString(input.request.dispatchReservationId),
      subjectNamespace: input.subjectNamespace,
      subjectKey: input.subjectKey,
      operatorTaskId: input.operatorTaskId,
    },
    template: optionalString(input.request.templateKey)
      ? { key: optionalString(input.request.templateKey), version: requestedTemplateVersion(input.request) }
      : null,
    policy: {
      externalSendAllowed: false,
      requireSuppressionCheck: true,
      requireConsentOrLawfulBasis: true,
      retryCreatesDuplicate: false,
    },
    requestedAt: input.requestedAt,
  }
}

async function bindingFromGovernedOrchestrationRun(run: Record<string, unknown>) {
  if (
    run.strategy_binding_mode !== 'governed_v1' ||
    !run.operating_strategy_version_id ||
    !run.operating_strategy_id ||
    !run.strategy_identifier_namespace ||
    !run.strategy_key ||
    !run.operating_contract_fingerprint
  ) {
    return null
  }
  const admin = createAdminClient()
  const versionResult = await admin
    .from('operating_strategy_versions')
    .select('id,version,status,execution_mode,external_send_cap,destination_mode,destination_path,cta_label,crm_owner_key,automation_owner_key,owner_contract_json,operating_strategies!inner(id,strategy_key,portfolio_key)')
    .eq('id', run.operating_strategy_version_id)
    .eq('operating_strategy_id', run.operating_strategy_id)
    .in('status', ['active', 'retired'])
    .single()
  if (versionResult.error) throw versionResult.error
  const strategy = Array.isArray(versionResult.data.operating_strategies)
    ? versionResult.data.operating_strategies[0]
    : versionResult.data.operating_strategies
  const ownerContract = (versionResult.data.owner_contract_json || {}) as Record<string, unknown>
  if (!strategy?.strategy_key || !strategy?.portfolio_key) {
    throw new Error('Governed n8n run is missing its immutable operating-strategy owner.')
  }
  return {
    namespace: String(run.strategy_identifier_namespace),
    sourceIdentifier: String(run.strategy_key),
    portfolioKey: String(strategy.portfolio_key),
    strategyKey: String(strategy.strategy_key),
    operatingStrategyId: String(run.operating_strategy_id),
    operatingStrategyVersionId: String(run.operating_strategy_version_id),
    version: Number(versionResult.data.version),
    executionMode: String(versionResult.data.execution_mode),
    externalSendCap: Number(versionResult.data.external_send_cap),
    destinationMode: String(versionResult.data.destination_mode),
    destinationPath: versionResult.data.destination_path as string | null,
    ctaLabel: versionResult.data.cta_label as string | null,
    contractFingerprint: String(run.operating_contract_fingerprint),
    crmOwnerKey: String(versionResult.data.crm_owner_key),
    automationOwnerKey: String(versionResult.data.automation_owner_key),
    dispatchAuthority: String(ownerContract.dispatchAuthority || ''),
  } satisfies OperatingStrategyBinding
}

async function verifyN8nDispatchReplay(input: N8nDispatchInput, run: Record<string, unknown>) {
  const binding = await bindingFromGovernedOrchestrationRun(run)
  const hasInputBinding = Boolean(optionalString(input.strategyIdentifierNamespace))
  if (
    hasInputBinding !== Boolean(binding) ||
    (binding &&
      (binding.namespace !== optionalString(input.strategyIdentifierNamespace) ||
        binding.sourceIdentifier !== optionalString(input.strategyIdentifier)))
  ) {
    throw new Error('n8n idempotency replay conflicts with the immutable operating-strategy binding.')
  }

  const subject = resolveN8nSubject(input, binding)
  const storedTemplateVersion = optionalString(run.template_key)
    ? Number(run.template_version || 1)
    : null
  const fieldsConflict =
    run.integration_key !== 'n8n' ||
    run.event_type !== input.eventType ||
    run.mode !== input.mode ||
    run.channel !== input.channel ||
    optionalString(run.strategy_lane_key) !== optionalString(input.legacyStrategyLaneKey) ||
    optionalString(run.strategy_version_id) !== optionalString(input.legacyStrategyVersionId) ||
    optionalString(run.match_id) !== optionalString(input.matchId) ||
    optionalString(run.crm_lead_id) !== optionalString(input.crmLeadId) ||
    optionalString(run.outbound_enrollment_id) !== optionalString(input.outboundEnrollmentId) ||
    optionalString(run.dispatch_reservation_id) !== optionalString(input.dispatchReservationId) ||
    optionalString(run.template_key) !== optionalString(input.templateKey) ||
    storedTemplateVersion !== requestedTemplateVersion(input) ||
    (binding &&
      (optionalString(run.subject_namespace) !== subject.namespace ||
        optionalString(run.subject_key) !== subject.key)) ||
    (!binding && (optionalString(run.subject_namespace) !== null || optionalString(run.subject_key) !== null))
  if (fieldsConflict) {
    throw new Error('n8n idempotency replay conflicts with immutable event, mode, channel, subject, or reference evidence.')
  }

  const operatorTaskId = optionalString(run.operator_task_id)
  const createdAtMillis = Date.parse(String(run.created_at || ''))
  if (!operatorTaskId || !Number.isFinite(createdAtMillis)) {
    throw new Error('Existing n8n orchestration is missing its immutable task or request timestamp.')
  }
  const createdAt = new Date(createdAtMillis).toISOString()
  const replayPayload = buildN8nPayload({
    request: input,
    binding,
    subjectNamespace: subject.namespace,
    subjectKey: subject.key,
    operatorTaskId,
    requestedAt: createdAt,
  })
  const replayDigest = createHash('sha256').update(JSON.stringify(replayPayload)).digest('hex')
  if (run.request_digest !== replayDigest) {
    throw new Error('n8n idempotency replay request digest does not match the immutable orchestration request.')
  }
}

export async function dispatchN8nWorkflow(input: N8nDispatchInput) {
  const admin = createAdminClient()
  const hasStrategyNamespace = Boolean(input.strategyIdentifierNamespace?.trim())
  const hasStrategyIdentifier = Boolean(input.strategyIdentifier?.trim())
  if (hasStrategyNamespace !== hasStrategyIdentifier) {
    throw new Error('n8n strategy attribution requires both a namespace and source identifier.')
  }
  const isContractTest = input.eventType === 'workflow_contract_test'
  if (
    isContractTest &&
    (input.mode !== 'no_send' ||
      input.channel !== 'no_outreach' ||
      hasStrategyNamespace ||
      input.matchId ||
      input.crmLeadId ||
      input.outboundEnrollmentId ||
      input.dispatchReservationId ||
      input.templateKey ||
      input.subjectNamespace ||
      input.subjectKey)
  ) {
    throw new Error('The n8n contract test is strictly unbound, no-send, and no-outreach.')
  }
  if (!isContractTest && !hasStrategyNamespace) {
    throw new Error('Every strategy orchestration event requires an exact active operating-strategy binding.')
  }
  if (!input.templateKey && input.templateVersion != null) {
    throw new Error('n8n templateVersion cannot be supplied without a templateKey.')
  }

  const existing = await admin.from('orchestration_runs').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    await verifyN8nDispatchReplay(input, existing.data)
    return { run: existing.data, replayed: true }
  }

  const binding = hasStrategyNamespace
    ? await resolveOperatingStrategyBinding({
        namespace: input.strategyIdentifierNamespace!,
        sourceIdentifier: input.strategyIdentifier!,
      })
    : null
  if (input.mode !== 'approved_live' && input.channel !== 'no_outreach') {
    throw new Error('No-send and internal-test n8n events must use the no_outreach channel.')
  }
  if (
    input.mode === 'internal_test' &&
    binding &&
    !['internal_test', 'approved_live'].includes(binding.executionMode)
  ) {
    throw new Error('The bound operating contract does not authorize internal-test execution.')
  }

  const controls = await admin.from('orchestration_controls').select('*').eq('integration_key', 'n8n').single()
  if (controls.error) throw controls.error
  const control = controls.data
  if (control.kill_switch) throw new Error('The n8n production kill switch is engaged.')
  const approvedChannels = new Set<string>(Array.isArray(control.approved_channels_json) ? control.approved_channels_json : [])
  if (!approvedChannels.has(input.channel)) throw new Error('This outreach channel is not approved for n8n.')
  let canonicalEnrollmentActivityId: string | null = null
  let subjectNamespace = String(input.subjectNamespace || '').trim()
  let subjectKey = String(input.subjectKey || '').trim()
  if (input.mode === 'approved_live') {
    if (!control.live_send_enabled || process.env.OUTREACH_LIVE_SEND_ENABLED !== 'true') {
      throw new Error('Live external outreach is disabled. Use no-send or internal-test mode.')
    }
    if (!binding || binding.executionMode !== 'approved_live' || binding.externalSendCap < 1) {
      throw new Error('Live n8n execution requires an approved-live operating contract with remaining governed capacity.')
    }
    if (
      !input.matchId ||
      !input.outboundEnrollmentId ||
      !input.dispatchReservationId ||
      !subjectNamespace ||
      !subjectKey ||
      !input.templateKey ||
      !input.templateVersion
    ) {
      throw new Error('Live n8n execution requires an approved match, exact enrollment/reservation/subject, and versioned template.')
    }
    const match = await admin.from('participant_opportunity_matches')
      .select('id,status,outreach_eligible,operating_strategy_version_id,operating_contract_fingerprint,participant_profiles!inner(status,outreach_consent,outreach_consent_at)')
      .eq('id', input.matchId).single()
    if (match.error) throw match.error
    const profile = Array.isArray(match.data.participant_profiles) ? match.data.participant_profiles[0] : match.data.participant_profiles
    if (
      match.data.status !== 'approved' ||
      !match.data.outreach_eligible ||
      profile?.status !== 'active' ||
      !profile?.outreach_consent ||
      match.data.operating_strategy_version_id !== binding.operatingStrategyVersionId ||
      match.data.operating_contract_fingerprint !== binding.contractFingerprint
    ) {
      throw new Error('The match and outreach permission are not approved for live execution.')
    }
    const enrollment = await admin
      .from('command_center_outbound_enrollments')
      .select('id,operating_strategy_version_id,operating_contract_fingerprint,dispatch_reservation_id,dispatch_channel,canonical_activity_id,metadata_json')
      .eq('id', input.outboundEnrollmentId)
      .eq('strategy_binding_mode', 'governed_v1')
      .eq('governed_stage', 'dispatch_intent')
      .single()
    if (enrollment.error) throw enrollment.error
    const recordedSubject = (enrollment.data.metadata_json as Record<string, unknown> | null)
      ?.governedSubject as Record<string, unknown> | undefined
    if (
      enrollment.data.operating_strategy_version_id !== binding.operatingStrategyVersionId ||
      enrollment.data.operating_contract_fingerprint !== binding.contractFingerprint ||
      enrollment.data.dispatch_reservation_id !== input.dispatchReservationId ||
      enrollment.data.dispatch_channel !== input.channel ||
      String(recordedSubject?.namespace || '') !== subjectNamespace ||
      String(recordedSubject?.key || '') !== subjectKey ||
      !enrollment.data.canonical_activity_id
    ) {
      throw new Error('The n8n request does not match its exact governed enrollment lineage.')
    }
    canonicalEnrollmentActivityId = enrollment.data.canonical_activity_id

    // The current app has no governed template-approval registry. A template
    // key supplied by a caller is not approval evidence, so live n8n remains
    // fail-closed until that authority is implemented in a later gate.
    throw new Error('Live n8n dispatch remains blocked until the governed template-approval registry is implemented.')
  }

  const resolvedSubject = resolveN8nSubject(input, binding)
  subjectNamespace = resolvedSubject.namespace
  subjectKey = resolvedSubject.key

  const task = await createAdminTask({
    title: 'Review n8n no-send test',
    description: 'Confirm the signed orchestration event, idempotency result, and workflow acknowledgement. No-send tests cannot contact an external recipient.',
    taskType: 'n8n_orchestration_review',
    priority: 'low',
    entityType: input.matchId ? 'opportunity_match' : 'orchestration',
    entityId: input.matchId || input.idempotencyKey,
    dueAt: adminTaskDueDates.days(1),
    metadata: {
      eventType: input.eventType,
      mode: input.mode,
      channel: input.channel,
      idempotencyKey: input.idempotencyKey,
      operatingStrategyVersionId: binding?.operatingStrategyVersionId || null,
      operatingContractFingerprint: binding?.contractFingerprint || null,
    },
    createdBy: 'gate-4e3-n8n',
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'The orchestration review task could not be created.')

  const requestedAt = new Date().toISOString()
  const payload = buildN8nPayload({
    request: input,
    binding,
    subjectNamespace,
    subjectKey,
    operatorTaskId: task.task.id,
    requestedAt,
  })
  const body = JSON.stringify(payload)
  const digest = createHash('sha256').update(body).digest('hex')
  const created = await admin.from('orchestration_runs').insert({
    integration_key: 'n8n',
    event_type: input.eventType,
    strategy_lane_key: input.legacyStrategyLaneKey || null,
    strategy_version_id: input.legacyStrategyVersionId || null,
    strategy_key: binding?.sourceIdentifier || null,
    strategy_identifier_namespace: binding?.namespace || null,
    operating_strategy_id: binding?.operatingStrategyId || null,
    operating_strategy_version_id: binding?.operatingStrategyVersionId || null,
    strategy_binding_mode: binding ? 'governed_v1' : null,
    strategy_binding_recorded_at: binding ? requestedAt : null,
    strategy_writer_release: binding ? 'gate_3c' : null,
    destination_mode_snapshot: binding?.destinationMode || null,
    destination_path_snapshot: binding?.destinationPath || null,
    cta_label_snapshot: binding?.ctaLabel || null,
    operating_contract_fingerprint: binding?.contractFingerprint || null,
    outbound_enrollment_id: input.outboundEnrollmentId || null,
    dispatch_reservation_id: input.dispatchReservationId || null,
    subject_namespace: binding ? subjectNamespace : null,
    subject_key: binding ? subjectKey : null,
    canonical_activity_id: canonicalEnrollmentActivityId,
    match_id: input.matchId || null,
    crm_lead_id: input.crmLeadId || null,
    idempotency_key: input.idempotencyKey,
    mode: input.mode,
    channel: input.channel,
    status: 'queued',
    request_digest: digest,
    template_key: input.templateKey || null,
    template_version: requestedTemplateVersion(input),
    operator_task_id: task.task.id,
    created_at: requestedAt,
  }).select('*').single()
  if (created.error?.code === '23505') {
    const racedReplay = await admin
      .from('orchestration_runs')
      .select('*')
      .eq('idempotency_key', input.idempotencyKey)
      .single()
    if (racedReplay.error) throw racedReplay.error
    await verifyN8nDispatchReplay(input, racedReplay.data)
    return { run: racedReplay.data, replayed: true }
  }
  if (created.error) throw created.error

  if (binding && !created.data.canonical_activity_id) {
    const activityId = await recordOperatingStrategyActivity({
      binding,
      activityType: 'orchestration',
      activityNamespace: 'orchestration_run',
      activityKey: created.data.id,
      subjectNamespace,
      subjectKey,
      idempotencyKey: `n8n-orchestration:${binding.operatingStrategyVersionId}:${input.idempotencyKey}`,
      occurredAt: requestedAt,
      provenance: [
        {
          kind: 'signed_n8n_request',
          requestDigest: digest,
          mode: input.mode,
          channel: input.channel,
        },
      ],
      metadata: {
        orchestrationRunId: created.data.id,
        eventType: input.eventType,
        externalSendAllowed: false,
      },
    })
    const linked = await admin
      .from('orchestration_runs')
      .update({ canonical_activity_id: activityId, updated_at: new Date().toISOString() })
      .eq('id', created.data.id)
      .eq('operating_strategy_version_id', binding.operatingStrategyVersionId)
      .is('canonical_activity_id', null)
      .select('*')
      .single()
    if (linked.error) throw linked.error
    created.data = linked.data
  }

  const { url, secret } = configuration()
  const timestamp = new Date().toISOString()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-vestblock-secret': secret,
        'content-type': 'application/json',
        'x-vestblock-timestamp': timestamp,
        'x-vestblock-signature': sign(secret, timestamp, body),
        'x-vestblock-idempotency-key': input.idempotencyKey,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    const status = response.ok ? 'dispatched' : 'failed'
    const updated = await admin.from('orchestration_runs').update({
      status, response_status: response.status, attempt_count: 1,
      failure_code: response.ok ? null : `n8n_http_${response.status}`,
      dispatched_at: response.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', created.data.id).select('*').single()
    if (updated.error) throw updated.error
    if (!response.ok) {
      const rejection = new Error(`n8n rejected the orchestration request with HTTP ${response.status}.`)
      rejection.name = `n8n_http_${response.status}`
      throw rejection
    }
    return { run: updated.data, replayed: false }
  } catch (error) {
    await admin.from('orchestration_runs').update({
      status: 'failed', attempt_count: 1, failure_code: error instanceof Error ? error.name : 'network_error', updated_at: new Date().toISOString(),
    }).eq('id', created.data.id)
    throw error
  }
}

export async function acknowledgeN8nWorkflow(input: {
  rawBody: string
  timestamp: string
  signature: string
}) {
  const { secret } = configuration()
  if (!verifyN8nSignature({ body: input.rawBody, timestamp: input.timestamp, signature: input.signature, secret })) {
    throw new Error('Invalid or expired n8n signature.')
  }
  const body = JSON.parse(input.rawBody) as Record<string, unknown>
  const idempotencyKey = String(body.idempotencyKey || '')
  const eventType = String(body.eventType || '')
  if (!idempotencyKey || !eventType) throw new Error('n8n acknowledgement is missing required identifiers.')
  const admin = createAdminClient()
  const run = await admin.from('orchestration_runs').select('*').eq('idempotency_key', idempotencyKey).single()
  if (run.error) throw run.error
  if (run.data.event_type !== eventType) {
    throw new Error('n8n acknowledgement event type does not match its immutable orchestration run.')
  }
  const receipt = await admin.from('orchestration_webhook_receipts').insert({
    integration_key: 'n8n', idempotency_key: idempotencyKey, signature_timestamp: input.timestamp,
    body_digest: createHash('sha256').update(input.rawBody).digest('hex'), event_type: eventType, run_id: run.data.id,
  }).select('id').maybeSingle()
  let receiptId = receipt.data?.id as string | undefined
  let replayed = false
  if (receipt.error?.code === '23505') {
    const existingReceipt = await admin
      .from('orchestration_webhook_receipts')
      .select('id,body_digest,event_type,signature_timestamp')
      .eq('integration_key', 'n8n')
      .eq('idempotency_key', idempotencyKey)
      .single()
    if (existingReceipt.error) throw existingReceipt.error
    const incomingDigest = createHash('sha256').update(input.rawBody).digest('hex')
    if (
      existingReceipt.data.body_digest !== incomingDigest ||
      existingReceipt.data.event_type !== eventType ||
      Date.parse(existingReceipt.data.signature_timestamp) !== Date.parse(input.timestamp)
    ) {
      throw new Error('n8n acknowledgement replay conflicts with immutable signed receipt evidence.')
    }
    receiptId = existingReceipt.data.id
    replayed = true
  } else if (receipt.error) {
    throw receipt.error
  }
  if (!receiptId) throw new Error('n8n acknowledgement receipt was not persisted.')
  const status = body.status === 'failed' ? 'failed' : body.status === 'suppressed' ? 'suppressed' : 'acknowledged'
  const binding = await bindingFromGovernedOrchestrationRun(run.data)
  if (binding) {
    if (!run.data.canonical_activity_id || !run.data.subject_namespace || !run.data.subject_key) {
      throw new Error('Governed n8n acknowledgement is missing its canonical parent activity and subject.')
    }
    await recordOperatingStrategyActivity({
      binding,
      activityType: status === 'suppressed' ? 'suppression' : 'orchestration',
      activityNamespace: status === 'suppressed' ? 'n8n_suppression' : 'n8n_acknowledgement',
      activityKey: `${run.data.id}:${receiptId}:${status}`,
      subjectNamespace: run.data.subject_namespace,
      subjectKey: run.data.subject_key,
      parentActivityId: run.data.canonical_activity_id,
      idempotencyKey: `n8n-ack:${binding.operatingStrategyVersionId}:${receiptId}:${status}`,
      occurredAt: input.timestamp,
      provenance: [
        {
          kind: 'signed_n8n_acknowledgement',
          receiptId,
          bodyDigest: createHash('sha256').update(input.rawBody).digest('hex'),
          eventType,
        },
      ],
      metadata: {
        orchestrationRunId: run.data.id,
        status,
        failureCode: status === 'failed' ? String(body.failureCode || 'workflow_failed') : null,
      },
    })
  }
  const updated = await admin.from('orchestration_runs').update({
    status, acknowledged_at: new Date().toISOString(), failure_code: status === 'failed' ? String(body.failureCode || 'workflow_failed') : null,
    updated_at: new Date().toISOString(),
  }).eq('id', run.data.id).select('*').single()
  if (updated.error) throw updated.error
  return { run: updated.data, replayed }
}
