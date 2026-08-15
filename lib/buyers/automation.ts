import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_BUYER_DISCOVERY_MARKETS, DEFAULT_BUYER_DISCOVERY_NICHES } from '@/lib/buyers/constants'
import { listMarketsForExpansionLane, pickDiscoveryTermsForMarket } from '@/lib/leads/marketExpansion'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { getOutboundProviderReadiness } from '@/lib/leads/outbound'
import { sendBuyerOutreachEmail } from '@/lib/buyers/outbound'
import {
  finishBuyerOutreachRun,
  listApprovedBuyerEmailOutreach,
  listBuyerOutreachForAutoApproval,
  updateBuyerOutreachMessage,
  updateBuyerPerformance,
  updateBuyerRecord,
  startBuyerOutreachRun,
} from '@/lib/buyers/repository'
import { evaluateBuyerAutoApproval } from '@/lib/buyers/automationCore'
import { BUYER_OUTREACH_TEMPLATE_VERSION } from '@/lib/buyers/outreach'
import {
  discoverAndIngestBuyersForMarket,
  runDailyBuyerFollowup,
  runDailyBuyerOutreach,
  runDailyBuyerPerformanceRollup,
  runDailyBuyerScoring,
} from '@/lib/buyers/service'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { runQualifiedSellerBuyerRouting } from '@/lib/buyers/qualifiedSellerRouting'
import type { BuyerRecord } from '@/lib/buyers/types'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
} from '@/lib/strategy/runtime-governance'
import { logEvent } from '@/lib/system/logEvent'

const GOVERNED_BUYER_NAMESPACE = 'legacy_runtime'
const GOVERNED_BUYER_SOURCE_IDENTIFIER = 'buyer-network'

function selectEmailDispatchAdapter(
  readiness: ReturnType<typeof getOutboundProviderReadiness>
) {
  if (readiness.resend) return { provider: 'resend' as const, channel: 'resend_email' }
  if (readiness.gmail) return { provider: 'gmail' as const, channel: 'gmail_email' }
  throw new Error('Buyer dispatch requires a configured outbound email provider.')
}

async function authorizeBuyerEmailDispatch() {
  const readiness = getOutboundProviderReadiness()
  const adapter = selectEmailDispatchAdapter(readiness)
  const binding = await authorizeOperatingStrategyDispatch({
    namespace: GOVERNED_BUYER_NAMESPACE,
    sourceIdentifier: GOVERNED_BUYER_SOURCE_IDENTIFIER,
    channel: adapter.channel,
    requestedExternalSends: 1,
    requiredDispatchAuthority: 'vestblock_application',
  })
  return { binding, adapter, readiness }
}

async function buyerConsentSnapshot(buyerId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('id,role,status,communication_preferences_json,outreach_consent,outreach_consent_at,consent_version,consent_recorded_at,operator_verified_at,legacy_claim_status')
    .eq('legacy_entity_type', 'buyers')
    .eq('legacy_entity_id', buyerId)
    .limit(2)
  if (error) throw error
  if ((data || []).length !== 1) {
    throw new Error('Buyer dispatch requires exactly one operator-verified participant-profile link with first-class outreach consent.')
  }
  const profile = data![0]
  const preferences = (profile.communication_preferences_json || {}) as Record<string, unknown>
  if (
    profile.role !== 'buyer' ||
    profile.status !== 'active' ||
    profile.legacy_claim_status !== 'verified' ||
    !profile.operator_verified_at ||
    profile.outreach_consent !== true ||
    !profile.outreach_consent_at ||
    preferences.email !== true
  ) {
    throw new Error('Buyer dispatch is blocked until the linked active profile has verified ownership, email permission, and recorded outreach consent.')
  }
  return {
    basis: 'participant_profile_outreach_consent',
    dispatchAuthorized: true,
    evidenceKey: `participant-profile:${profile.id}:outreach-consent:${profile.outreach_consent_at}`,
    provenance: {
      sourceTable: 'participant_profiles',
      participantProfileId: profile.id,
      legacyEntityType: 'buyers',
      legacyEntityId: buyerId,
      consentVersion: profile.consent_version,
      consentRecordedAt: profile.consent_recorded_at,
      outreachConsentAt: profile.outreach_consent_at,
      operatorVerifiedAt: profile.operator_verified_at,
    },
  }
}

async function buyerSuppressionSnapshot(buyerId: string, email: string) {
  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await admin
    .from('lead_suppressions')
    .select('id,reason')
    .eq('email', normalizedEmail)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data?.id) throw new Error(`Buyer recipient is suppressed: ${data.reason || 'active suppression'}.`)
  const checkedAt = new Date().toISOString()
  return {
    checkedAt,
    suppressionCleared: true,
    evidenceKey: `buyer-suppression-preflight:${buyerId}:${checkedAt}`,
    provenance: { sourceTable: 'lead_suppressions', matchField: 'email', subjectId: buyerId },
    activeSuppression: false,
    usableEmail: true,
  }
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function buildDigestHtml(title: string, items: string[]) {
  const rows = items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="color:#fff;">${title}</h2><ul>${rows}</ul></div>`
}

async function sendAdminDigest(subject: string, title: string, items: string[]) {
  const recipient = (
    process.env.OPERATIONS_REPORT_EMAIL ||
    process.env.OUTREACH_ALERT_EMAIL ||
    process.env.ACQUISITIONS_ALERT_EMAIL ||
    process.env.ADMIN_ALERT_EMAIL ||
    'acquisitions@vestblock.io'
  ).trim()
  if (!recipient || items.length === 0) return { ok: false, skipped: true }
  return sendEmail({
    to: recipient,
    subject,
    html: buildDigestHtml(title, items),
    eventType: 'admin_lead_followup',
  })
}

export async function runDailyBuyerDiscovery(options: { dryRun?: boolean } = {}) {
  const run = await startBuyerOutreachRun({
    runType: 'daily_discovery',
    sourceKey: 'google_places_buyers',
    requestParams: { dryRun: options.dryRun || false },
  })

  try {
    const marketLimit = envInt('BUYERS_DAILY_MARKET_COUNT', 4)
    const results: Array<{ market: string; count: number }> = []
    const evolvingMarkets = await listMarketsForExpansionLane('buyers', { limit: marketLimit }).catch(() => [])
    const markets = evolvingMarkets.length
      ? evolvingMarkets.map((market) => ({
          city: market.city,
          state: market.state,
          metroArea: market.metro_area,
          niches: pickDiscoveryTermsForMarket(market, 'buyers', new Date(), envInt('BUYERS_DAILY_NICHE_COUNT', 4)),
        }))
      : DEFAULT_BUYER_DISCOVERY_MARKETS.slice(0, marketLimit).map((market) => ({
          ...market,
          niches: [...DEFAULT_BUYER_DISCOVERY_NICHES.slice(0, envInt('BUYERS_DAILY_NICHE_COUNT', 4))],
        }))
    for (const market of markets) {
      const buyers = options.dryRun
        ? []
        : await discoverAndIngestBuyersForMarket({
            city: market.city,
            state: market.state,
            metroArea: market.metroArea,
            niches: market.niches,
            limitPerNiche: envInt('BUYERS_DAILY_LIMIT_PER_NICHE', 3),
          })
      results.push({ market: `${market.city}, ${market.state}`, count: buyers.length })
    }

    await finishBuyerOutreachRun(run.id, {
      status: 'completed',
      resultCount: results.reduce((sum, item) => sum + item.count, 0),
    })

    if (!options.dryRun) {
      await sendAdminDigest(
        'VestBlock buyer discovery report',
        'Buyer discovery summary',
        results.map((item) => `${item.market}: ${item.count} buyer prospects`)
      )
    }

    return { ok: true, count: results.reduce((sum, item) => sum + item.count, 0), results }
  } catch (error) {
    await finishBuyerOutreachRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyBuyerSend(limit = 15, options: { dryRun?: boolean } = {}) {
  const autoSendRequested = envBool('BUYER_AUTO_SEND_ENABLED', false)
  const deliveryCircuitBreaker = autoSendRequested
    ? await getDeliveryCircuitBreaker({ provider: 'gmail', allowControlledTrial: true })
    : null
  const replyCapture = getReplyCaptureReadiness()
  const autoSend = autoSendRequested && deliveryCircuitBreaker?.allowed === true && replyCapture.ready
  const dailyLimit = envInt('BUYERS_DAILY_SEND_LIMIT', 25)
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: sentLast24h, error: countError } = await admin
    .from('buyer_outreach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', since)
  if (countError) throw countError

  const remaining = Math.max(0, dailyLimit - (sentLast24h || 0))
  const circuitLimit = deliveryCircuitBreaker?.maxBatchSize || Number.POSITIVE_INFINITY
  const effectiveLimit = Math.min(limit, remaining, circuitLimit)
  const approved = effectiveLimit > 0 ? await listApprovedBuyerEmailOutreach(effectiveLimit) : []
  const results: Array<{ buyerId: string; name: string; status: string }> = []
  let authorization: Awaited<ReturnType<typeof authorizeBuyerEmailDispatch>> | null = null

  const requireAuthorization = async () => {
    if (!authorization) {
      authorization = await authorizeBuyerEmailDispatch()
    }
    return authorization
  }

  for (const row of approved) {
    const buyer = row.buyers as BuyerRecord | null
    if (!buyer?.id) continue

    if (!autoSend) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'queued_for_review' })
      continue
    }

    if (!isUsableContactEmail(buyer.contact_email)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Buyer autopilot blocked: ${buyer.name}`,
          description:
            'Approved buyer outreach could not send because there is no usable contact email. Enrich the buyer record or route a different channel.',
          taskType: 'buyer_autopilot_blocked',
          priority: 'high',
          entityType: 'buyer',
          entityId: buyer.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { reason: 'invalid_email', messageId: row.id, channel: row.channel },
        }).catch(() => null)
      }
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'invalid_email' })
      continue
    }

    if (options.dryRun) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'would_send' })
      continue
    }

    const { binding, adapter } = await requireAuthorization()
    if (buyer.outreach_status === 'do_not_contact') {
      throw new Error('Buyer dispatch is blocked because the buyer is marked do not contact.')
    }
    const consentBasisSnapshot = await buyerConsentSnapshot(buyer.id)
    const suppressionSnapshot = await buyerSuppressionSnapshot(buyer.id, buyer.contact_email!)
    const dispatchIntentAt = new Date().toISOString()
    const isFollowup = row.channel === 'email_followup'
    const nextActionAt = isFollowup ? adminTaskDueDates.days(7) : adminTaskDueDates.days(4)
    const messageVersionKey = `${row.id}:approved:${row.approved_at || row.updated_at}`
    const reservation = await reserveOperatingStrategyDispatch({
      binding,
      channel: adapter.channel,
      requestedCount: 1,
      idempotencyKey: `buyer-outreach:${binding.operatingStrategyVersionId}:${messageVersionKey}`,
    })
    const enrollmentBase = {
      strategyKey: binding.sourceIdentifier,
      channel: 'email' as const,
      messageId: row.id,
      recipient: buyer.contact_email,
      market: [buyer.headquarters_city, buyer.headquarters_state].filter(Boolean).join(', '),
      binding,
      governedStage: 'dispatch_intent' as const,
      subjectNamespace: 'buyer',
      subjectKey: buyer.id,
      dispatchIntentAt,
      dispatchReservationId: reservation.reservationId,
      dispatchChannel: adapter.channel,
      provider: adapter.provider,
      outreachPurpose: 'legacy_buyer_network_outreach',
      consentBasisSnapshot: {
        ...consentBasisSnapshot,
        messageStatus: row.status,
        approvedAt: row.approved_at,
        approvedByUserId: row.approved_by_user_id,
        capturedAt: dispatchIntentAt,
      },
      suppressionSnapshot: {
        ...suppressionSnapshot,
        replyCaptureReady: replyCapture.ready,
        deliveryCircuitAllowed: deliveryCircuitBreaker?.allowed === true,
      },
      messageVersionKey,
    }
    const dispatchIntent = await recordOutboundEnrollment({
      ...enrollmentBase,
      status: 'queued',
      nextActionAt,
      metadata: {
        buyerId: buyer.id,
        buyerCategory: buyer.category,
        authorizedChannels: [adapter.channel],
      },
    })

    const sent = await sendBuyerOutreachEmail({
      buyer,
      message: row,
      provider: adapter.provider,
      disableFallback: true,
    })
    if (!sent.ok) {
      const failedAt = new Date().toISOString()
      await recordOutboundEnrollment({
        ...enrollmentBase,
        enrollmentId: dispatchIntent.id,
        status: 'failed',
        provider: sent.provider,
        suppressionReason: sent.error || 'send_failed',
        nextActionAt: null,
        metadata: {
          buyerId: buyer.id,
          buyerCategory: buyer.category,
          authorizedChannels: [adapter.channel],
          error: sent.error || 'send_failed',
          providerResultAt: failedAt,
        },
      })
      const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
        subjectNamespace: 'buyer',
        subjectKey: buyer.id,
        messageId: row.id,
        enrollmentId: dispatchIntent.id,
        operatingStrategyVersionId: binding.operatingStrategyVersionId,
        provider: sent.provider,
        providerMessageId: sent.providerMessageId || null,
        evidenceId: `buyer-outreach:${row.id}:${sent.provider}:failed`,
        status: 'failed',
        occurredAt: failedAt,
      })
      if (!failedDeliveryOutcome.updated) {
        throw new Error(`Buyer delivery outcome attribution failed: ${failedDeliveryOutcome.reason}.`)
      }
      await updateBuyerOutreachMessage(row.id, {
        status: 'failed',
        send_provider: sent.provider,
        send_error: sent.error || 'Send failed.',
        metadata_json: {
          ...(row.metadata_json || {}),
          providerResultAt: failedAt,
        },
      })
      await updateBuyerRecord(buyer.id, { outreach_status: 'failed' })
      await createAdminTask({
        title: `Buyer autopilot send failed: ${buyer.name}`,
        description:
          'Approved buyer outreach failed during auto-send. Review provider status, recipient quality, and whether the message should be retried manually.',
        taskType: 'buyer_autopilot_send_failed',
        priority: 'urgent',
        entityType: 'buyer',
        entityId: buyer.id,
        dueAt: adminTaskDueDates.now(),
        metadata: { reason: sent.error || 'send_failed', messageId: row.id, provider: sent.provider, providerResultAt: failedAt },
      }).catch(() => null)
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'failed' })
      continue
    }

    const acceptedAt = new Date().toISOString()
    await recordOutboundEnrollment({
      ...enrollmentBase,
      enrollmentId: dispatchIntent.id,
      status: 'accepted',
      provider: sent.provider,
      providerMessageId: sent.providerMessageId || null,
      nextActionAt,
      metadata: {
        buyerId: buyer.id,
        buyerCategory: buyer.category,
        authorizedChannels: [adapter.channel],
        providerResultAt: acceptedAt,
      },
    })
    const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
      subjectNamespace: 'buyer',
      subjectKey: buyer.id,
      messageId: row.id,
      enrollmentId: dispatchIntent.id,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      provider: sent.provider,
      providerMessageId: sent.providerMessageId || null,
      evidenceId: `buyer-outreach:${row.id}:${sent.provider}:${sent.providerMessageId || 'accepted'}`,
      status: 'accepted',
      occurredAt: acceptedAt,
    })
    if (!acceptedDeliveryOutcome.updated) {
      throw new Error(`Buyer delivery outcome attribution failed: ${acceptedDeliveryOutcome.reason}.`)
    }
    await updateBuyerOutreachMessage(row.id, {
      status: 'sent',
      sent_at: acceptedAt,
      send_provider: sent.provider,
      send_error: null,
      metadata_json: {
        ...(row.metadata_json || {}),
        providerMessageId: sent.providerMessageId || null,
        providerAcceptedAt: acceptedAt,
      },
    })
    await updateBuyerRecord(buyer.id, {
      relationship_stage: 'contacted',
      outreach_status: 'sent',
      last_contacted_at: acceptedAt,
      next_follow_up_at: isFollowup ? null : nextActionAt,
    })
    await updateBuyerPerformance(buyer.id, {
      outreach_sent_count: ((buyer.metadata_json?.outreachSentCount as number) || 0) + 1,
      last_contacted_at: acceptedAt,
    })
    await logEvent({
      eventType: 'buyer_outreach_sent',
      entityType: 'buyer',
      entityId: buyer.id,
      metadata: { messageId: row.id, provider: sent.provider, providerResultAt: acceptedAt },
    })
    results.push({ buyerId: buyer.id, name: buyer.name, status: 'accepted' })
  }

  return {
    ok: true,
    count: results.length,
    results,
    autoSendEnabled: autoSend,
    autoSendRequested,
    deliveryCircuitBreaker,
    replyCapture,
    dailyLimit,
    sentLast24h: sentLast24h || 0,
    remainingBeforeRun: remaining,
  }
}

export async function runDailyBuyerApproval(
  limit = 20,
  options: { dryRun?: boolean } = {}
) {
  const minimumScore = envInt('BUYER_AUTO_APPROVE_MIN_SCORE', 40)
  const candidates = await listBuyerOutreachForAutoApproval(limit)
  const results: Array<{ buyerId: string | null; name: string; status: string; reason: string }> = []

  for (const message of candidates) {
    const buyer = message.buyers as BuyerRecord | null
    const decision = evaluateBuyerAutoApproval({
      buyer,
      message,
      templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
    })

    if (!decision.approved || !buyer) {
      results.push({
        buyerId: buyer?.id || null,
        name: buyer?.name || 'Unknown buyer',
        status: 'blocked',
        reason: decision.reason,
      })
      continue
    }

    if (!options.dryRun) {
      const approvedAt = new Date().toISOString()
      await updateBuyerOutreachMessage(message.id, {
        status: 'approved',
        approved_at: approvedAt,
        send_error: null,
      })
      await updateBuyerRecord(buyer.id, {
        outreach_status: 'approved',
        relationship_stage: 'outreach_ready',
      })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'buyer',
        entityId: buyer.id,
        metadata: {
          messageId: message.id,
          templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
          minimumScore,
          approvalMode: 'guarded_automation',
        },
      })
    }

    results.push({
      buyerId: buyer.id,
      name: buyer.name,
      status: options.dryRun ? 'would_approve' : 'approved',
      reason: decision.reason,
    })
  }

  return {
    ok: true,
    count: results.filter((result) => ['approved', 'would_approve'].includes(result.status)).length,
    reviewed: results.length,
    minimumScore,
    results,
  }
}

async function runBuyerStage<T>(name: string, task: () => Promise<T>) {
  try {
    return { ok: true as const, name, result: await task() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEvent({
      eventType: 'admin_action',
      entityType: 'buyer_pipeline',
      entityId: name,
      metadata: { action: 'buyer_automation_stage_failed', stage: name, error: message },
    }).catch(() => null)
    return { ok: false as const, name, error: message }
  }
}

export async function runDailyBuyerPipeline(options: { dryRun?: boolean } = {}) {
  const dryRun = Boolean(options.dryRun)
  const pipelineRun = await startBuyerOutreachRun({
    runType: 'daily_pipeline',
    sourceKey: 'vestblock_buyer_pipeline',
    requestParams: {
      dryRun,
      sendLimit: envInt('BUYERS_SEND_LIMIT_PER_RUN', 10),
      dailyLimit: envInt('BUYERS_DAILY_SEND_LIMIT', 25),
    },
  })

  try {
    const discovery = await runBuyerStage('discovery', () => runDailyBuyerDiscovery({ dryRun }))
    const scoring = await runBuyerStage('scoring', () =>
      dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyBuyerScoring(envInt('BUYERS_DAILY_SCORE_LIMIT', 90))
    )
    const outreach = await runBuyerStage('outreach', () =>
      runDailyBuyerOutreach(envInt('BUYERS_DAILY_OUTREACH_LIMIT', 30), { dryRun })
    )
    const followup = await runBuyerStage('followup', () =>
      runDailyBuyerFollowup(envInt('BUYERS_DAILY_FOLLOWUP_LIMIT', 25), { dryRun })
    )
    const approval = await runBuyerStage('approval', () =>
      runDailyBuyerApproval(envInt('BUYERS_DAILY_APPROVAL_LIMIT', 20), { dryRun })
    )
    const send = await runBuyerStage('send', () =>
      runDailyBuyerSend(envInt('BUYERS_SEND_LIMIT_PER_RUN', 10), { dryRun })
    )
    const performance = await runBuyerStage('performance', () =>
      dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyBuyerPerformanceRollup()
    )
    const sellerRouting = await runBuyerStage('seller_routing', () =>
      runQualifiedSellerBuyerRouting(envInt('BUYER_ROUTING_DAILY_LIMIT', 25), { dryRun })
    )
    const stages = { discovery, scoring, outreach, followup, approval, send, performance, sellerRouting }
    const ok = Object.values(stages).every((stage) => stage.ok)
    const partial = Object.values(stages).some((stage) => !stage.ok)
    const sendCount = send.ok
      ? Number(send.result.results?.filter((result) => result.status === (dryRun ? 'would_send' : 'accepted')).length || 0)
      : 0
    const failedStages = Object.values(stages)
      .filter((stage) => !stage.ok)
      .map((stage) => stage.name)

    await finishBuyerOutreachRun(pipelineRun.id, {
      status: ok ? 'completed' : 'partial',
      resultCount: sendCount,
      errorMessage: failedStages.length ? `Failed stages: ${failedStages.join(', ')}` : null,
    })

    return {
      ok,
      partial,
      runId: pipelineRun.id,
      stages,
    }
  } catch (error) {
    await finishBuyerOutreachRun(pipelineRun.id, {
      status: 'failed',
      resultCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => null)
    throw error
  }
}
