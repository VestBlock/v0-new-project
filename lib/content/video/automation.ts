import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildVideoRenderAttemptKey,
  buildVideoContentSnapshot,
  VIDEO_CONTENT_TYPES,
  videoMetadataSchema,
  type VideoContentAssetRow,
  type VideoMetadata,
} from '@/lib/content/video/contentSystem'
import {
  createHeyGenVideoAgent,
  getHeyGenVideo,
  getHeyGenVideoAgentSession,
  HeyGenApiError,
  type HeyGenVideoAgentSession,
} from '@/lib/content/video/heyGenClient'
import { seedVestBlockVideoPilots, type VideoPilotSeedResult } from '@/lib/content/video/pilotSeed'
import { createPrivateVideoRender } from '@/lib/content/video/privateRender'

type SupabaseLike = SupabaseClient<any, 'public', any>

export const VIDEO_CONTENT_SELECT =
  'id,parent_content_id,title,slug,content_type,service_key,language,audience,prompt,status,platform,post_type,body_markdown,cta_label,cta_url,metadata_json,approval_status,approved_by,approved_at,published_at,created_at,updated_at'

type VideoAutomationConfig = {
  apiKey: string | null
  submitLimit: number
  staleClaimMinutes: number
  maxRenderMinutes: number
  requestTimeoutMs: number
}

export type VideoContentPilotResult = {
  status: 'blocked' | 'idle' | 'submitted' | 'processing' | 'completed' | 'failed'
  configuration: {
    provider: 'heygen_video_agent_v3'
    ready: boolean
    blocker: string | null
    submitLimit: number
  }
  seed: VideoPilotSeedResult
  submitted: number
  reconciled: number
  privateRendersCreated: number
  failures: number
  errors: string[]
  videoContent: ReturnType<typeof buildVideoContentSnapshot>
}

function parseBoundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  max: number,
  min = 1
) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(min, Math.min(parsed, max))
}

export function getVideoAutomationConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): VideoAutomationConfig {
  return {
    apiKey: env.HEYGEN_API_KEY?.trim() || null,
    // Video Agent jobs are cost-bearing and can take 20–45 minutes. Keep the
    // default deliberately sequential even if several scripts are approved.
    submitLimit: parseBoundedPositiveInteger(env.VIDEO_CONTENT_RENDER_LIMIT, 1, 2),
    staleClaimMinutes: parseBoundedPositiveInteger(
      env.VIDEO_CONTENT_STALE_CLAIM_MINUTES,
      20,
      180
    ),
    maxRenderMinutes: parseBoundedPositiveInteger(
      env.VIDEO_CONTENT_MAX_RENDER_MINUTES,
      90,
      360,
      30
    ),
    requestTimeoutMs: parseBoundedPositiveInteger(
      env.VIDEO_CONTENT_PROVIDER_TIMEOUT_MS,
      8_000,
      12_000
    ),
  }
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown video renderer error.'
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function isDeterministicHeyGenSubmissionRejection(error: unknown) {
  return (
    error instanceof HeyGenApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 425, 429].includes(error.status)
  )
}

function parseMetadata(row: VideoContentAssetRow): VideoMetadata | null {
  const parsed = videoMetadataSchema.safeParse(row.metadata_json || {})
  return parsed.success ? parsed.data : null
}

export function isVideoScriptReadyForAutomaticRender(row: VideoContentAssetRow) {
  if (
    row.content_type !== 'video_script' ||
    row.status !== 'ready' ||
    row.approval_status !== 'approved'
  ) {
    return false
  }
  const metadata = parseMetadata(row)
  return Boolean(
    metadata && metadata.render_status === 'not_started' && metadata.renderer_prompt
  )
}

export function videoScriptRenderPriority(row: VideoContentAssetRow) {
  const metadata = parseMetadata(row)
  if (row.service_key === 'sell_property' || metadata?.pillar === 'deals') return 100
  if (row.service_key === 'dealvault' || metadata?.pillar === 'dealvault') return 60
  if (metadata?.pillar === 'master_brand') return 40
  if (metadata?.pillar === 'capital') return 20
  return 10
}

export function videoRenderAttemptKey(
  row: Pick<VideoContentAssetRow, 'id' | 'approved_at' | 'updated_at' | 'created_at'>
) {
  return buildVideoRenderAttemptKey(row)
}

export function videoRenderMatchesScriptAttempt(
  render: VideoContentAssetRow,
  script: VideoContentAssetRow
) {
  if (render.content_type !== 'video_render' || render.parent_content_id !== script.id) return false
  const metadata = parseMetadata(render)
  return Boolean(
    metadata?.render_attempt_key &&
      metadata.render_attempt_key === videoRenderAttemptKey(script)
  )
}

export function availableVideoSubmitSlots(rows: VideoContentAssetRow[], submitLimit: number) {
  const inFlightCount = rows.filter((row) => {
    if (row.content_type !== 'video_script') return false
    const metadata = parseMetadata(row)
    return Boolean(metadata && ['queued', 'rendering'].includes(metadata.render_status))
  }).length
  return Math.max(0, submitLimit - inFlightCount)
}

function isStaleClaim(metadata: VideoMetadata, now: Date, staleClaimMinutes: number) {
  if (metadata.heygen_session_id || !metadata.render_started_at) return false
  const startedAt = Date.parse(metadata.render_started_at)
  if (!Number.isFinite(startedAt)) return true
  return now.getTime() - startedAt >= staleClaimMinutes * 60_000
}

function isExpiredRender(metadata: VideoMetadata, now: Date, maxRenderMinutes: number) {
  if (!metadata.render_started_at) return false
  const startedAt = Date.parse(metadata.render_started_at)
  if (!Number.isFinite(startedAt)) return true
  return now.getTime() - startedAt >= maxRenderMinutes * 60_000
}

export function isVideoRenderOverAgeAfterProviderPoll(input: {
  metadata: VideoMetadata
  now: Date
  maxRenderMinutes: number
  providerStatus: 'processing' | 'completed' | 'failed'
}) {
  // Provider truth takes precedence over the local age. In particular, a
  // completed render can arrive between cron passes and must still be captured
  // into the private review ledger instead of being misclassified as timed out.
  if (input.providerStatus !== 'processing') return false
  return isExpiredRender(input.metadata, input.now, input.maxRenderMinutes)
}

function appendVideoReviewNote(metadata: VideoMetadata, message: string) {
  if (metadata.review_notes.includes(message)) return metadata.review_notes
  return [...metadata.review_notes, message].slice(-30)
}

export function buildRecoverableVideoAttemptMetadata(input: {
  metadata: VideoMetadata
  message: string
  renderStatus?: 'queued' | 'rendering'
  submissionStatus?: VideoMetadata['provider_submission_status']
}) {
  const renderStatus =
    input.renderStatus || (input.metadata.render_status === 'rendering' ? 'rendering' : 'queued')
  return videoMetadataSchema.parse({
    ...input.metadata,
    render_status: renderStatus,
    render_completed_at: null,
    render_error: input.message.slice(0, 1000),
    provider_submission_status:
      input.submissionStatus || input.metadata.provider_submission_status,
    provider_recovery_status: 'manual_review_required',
    review_notes: appendVideoReviewNote(input.metadata, input.message),
  })
}

function buildActiveVideoAttemptMetadata(input: {
  metadata: VideoMetadata
  renderStatus: 'queued' | 'rendering'
  sessionId?: string | null
  videoId?: string | null
}) {
  return videoMetadataSchema.parse({
    ...input.metadata,
    render_status: input.renderStatus,
    heygen_session_id: input.sessionId ?? input.metadata.heygen_session_id,
    heygen_video_id: input.videoId ?? input.metadata.heygen_video_id,
    render_completed_at: null,
    render_error: null,
    provider_submission_status: 'accepted',
    provider_recovery_status: 'none',
  })
}

function buildProviderSessionMetadata(input: {
  metadata: VideoMetadata
  session: HeyGenVideoAgentSession
  now: Date
}) {
  const failed = input.session.status === 'failed'
  const activeMetadata = videoMetadataSchema.parse({
    ...input.metadata,
    render_status: failed
      ? 'failed'
      : input.session.status === 'generating'
        ? 'rendering'
        : 'queued',
    heygen_session_id: input.session.sessionId,
    heygen_video_id: input.session.videoId,
    render_completed_at: failed ? input.now.toISOString() : null,
    render_error: failed
      ? input.session.failureMessage || 'HeyGen rejected the Video Agent render.'
      : null,
    provider_submission_status: 'accepted',
    provider_recovery_status: failed ? 'manual_review_required' : 'none',
  })
  const nonTerminalWarning =
    input.session.status === 'waiting_for_input'
      ? 'HeyGen requested interactive input; the attempt remains recoverable and requires manual provider review.'
      : input.session.status === 'unknown'
        ? 'HeyGen returned an unrecognized non-terminal status; the attempt remains recoverable and requires manual provider review.'
        : null
  return {
    failed,
    metadata:
      !failed && nonTerminalWarning
        ? buildRecoverableVideoAttemptMetadata({
            metadata: activeMetadata,
            message: nonTerminalWarning,
            renderStatus: activeMetadata.render_status === 'rendering' ? 'rendering' : 'queued',
            submissionStatus: 'accepted',
          })
        : activeMetadata,
  }
}

const HEYGEN_IDEMPOTENCY_REPLAY_WINDOW_MINUTES = 23 * 60

export function isVideoSubmissionWithinIdempotencyReplayWindow(
  metadata: VideoMetadata,
  now: Date
) {
  if (!metadata.render_started_at) return false
  const startedAt = Date.parse(metadata.render_started_at)
  if (!Number.isFinite(startedAt)) return false
  const ageMs = now.getTime() - startedAt
  return ageMs >= 0 && ageMs < HEYGEN_IDEMPOTENCY_REPLAY_WINDOW_MINUTES * 60_000
}

async function loadVideoRows(supabase: SupabaseLike) {
  const { data, error } = await supabase
    .from('content_assets')
    .select(VIDEO_CONTENT_SELECT)
    .in('content_type', [...VIDEO_CONTENT_TYPES])
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data || []) as VideoContentAssetRow[]
}

export async function persistVideoAttemptMetadata(input: {
  supabase: SupabaseLike
  scriptId: string
  metadata: VideoMetadata
  expectedAttemptKey: string
  now: Date
}) {
  const { data, error } = await input.supabase
    .from('content_assets')
    .update({
      metadata_json: input.metadata,
      updated_at: input.now.toISOString(),
    })
    .eq('id', input.scriptId)
    .eq('status', 'ready')
    .eq('approval_status', 'approved')
    .filter('metadata_json->>render_attempt_key', 'eq', input.expectedAttemptKey)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function failScriptRender(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  metadata: VideoMetadata
  message: string
  now: Date
}) {
  if (!input.metadata.render_attempt_key) return false
  const metadata = videoMetadataSchema.parse({
    ...input.metadata,
    render_status: 'failed',
    render_error: input.message.slice(0, 1000),
    render_completed_at: input.now.toISOString(),
  })
  return persistVideoAttemptMetadata({
    supabase: input.supabase,
    scriptId: input.script.id,
    metadata,
    expectedAttemptKey: input.metadata.render_attempt_key,
    now: input.now,
  })
}

async function isCurrentVideoAttempt(input: {
  supabase: SupabaseLike
  scriptId: string
  expectedAttemptKey: string | null
}) {
  if (!input.expectedAttemptKey) return false
  const { data, error } = await input.supabase
    .from('content_assets')
    .select('id')
    .eq('id', input.scriptId)
    .eq('status', 'ready')
    .eq('approval_status', 'approved')
    .filter('metadata_json->>render_attempt_key', 'eq', input.expectedAttemptKey)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function reconcileVideoScriptAttempt(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  metadata: VideoMetadata
  apiKey: string
  fetchImpl?: typeof fetch
  actorUserId: string | null
  now: Date
  maxRenderMinutes: number
  requestTimeoutMs: number
  createPrivateRender?: typeof createPrivateVideoRender
}) {
  const attemptKey = input.metadata.render_attempt_key
  if (
    !attemptKey ||
    !(await isCurrentVideoAttempt({
      supabase: input.supabase,
      scriptId: input.script.id,
      expectedAttemptKey: attemptKey,
    }))
  ) {
    return { reconciled: 0, privateRendersCreated: 0, failures: 0 }
  }

  const session = input.metadata.heygen_session_id
    ? await getHeyGenVideoAgentSession({
        apiKey: input.apiKey,
        sessionId: input.metadata.heygen_session_id,
        fetchImpl: input.fetchImpl,
        timeoutMs: input.requestTimeoutMs,
      })
    : null
  const videoId = session?.videoId || input.metadata.heygen_video_id

  if (session?.status === 'failed') {
    const updated = await failScriptRender({
      ...input,
      message:
        session.failureMessage ||
        'HeyGen reported that the Video Agent session failed.',
    })
    return {
      reconciled: updated ? 1 : 0,
      privateRendersCreated: 0,
      failures: updated ? 1 : 0,
    }
  }

  const sessionWarning =
    session?.status === 'waiting_for_input'
      ? 'HeyGen is waiting for interactive input; manual provider review is required while reconciliation remains active.'
      : session?.status === 'unknown'
        ? 'HeyGen returned an unrecognized non-terminal session status; manual provider review is required while reconciliation remains active.'
        : session?.status === 'completed' && !videoId
          ? 'HeyGen reported a completed session without a video ID; manual provider review is required while reconciliation remains active.'
          : null

  if (!videoId) {
    const renderStatus = session?.status === 'thinking' ? 'queued' : 'rendering'
    const activeMetadata = buildActiveVideoAttemptMetadata({
      metadata: input.metadata,
      renderStatus,
      sessionId: session?.sessionId,
    })
    const overAge = isVideoRenderOverAgeAfterProviderPoll({
      metadata: activeMetadata,
      now: input.now,
      maxRenderMinutes: input.maxRenderMinutes,
      providerStatus: 'processing',
    })
    const metadata =
      sessionWarning || overAge
        ? buildRecoverableVideoAttemptMetadata({
            metadata: activeMetadata,
            message:
              sessionWarning ||
              `The HeyGen render exceeded ${input.maxRenderMinutes} minutes and was still processing when polled; reconciliation remains active and manual provider review is recommended.`,
            renderStatus,
            submissionStatus: 'accepted',
          })
        : activeMetadata
    const updated = await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata,
      expectedAttemptKey: attemptKey,
      now: input.now,
    })
    return { reconciled: updated ? 1 : 0, privateRendersCreated: 0, failures: 0 }
  }

  const video = await getHeyGenVideo({
    apiKey: input.apiKey,
    videoId,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.requestTimeoutMs,
  })
  if (video.status === 'failed') {
    const updated = await failScriptRender({
      ...input,
      message: video.failureMessage || 'HeyGen reported that the video render failed.',
    })
    return {
      reconciled: updated ? 1 : 0,
      privateRendersCreated: 0,
      failures: updated ? 1 : 0,
    }
  }

  const providerStatus =
    video.status === 'completed' && video.videoUrl ? 'completed' : 'processing'
  const activeMetadata = buildActiveVideoAttemptMetadata({
    metadata: input.metadata,
    renderStatus: 'rendering',
    sessionId: session?.sessionId,
    videoId: video.videoId,
  })
  const missingCompletedOutput = video.status === 'completed' && !video.videoUrl
  const overAge = isVideoRenderOverAgeAfterProviderPoll({
      metadata: activeMetadata,
      now: input.now,
      maxRenderMinutes: input.maxRenderMinutes,
      providerStatus,
    })
  const progressMetadata =
    missingCompletedOutput || sessionWarning || overAge
      ? buildRecoverableVideoAttemptMetadata({
          metadata: activeMetadata,
          message: missingCompletedOutput
            ? 'HeyGen reported completion without a usable video URL; reconciliation remains active and manual provider review is required.'
            : sessionWarning ||
              `The HeyGen render exceeded ${input.maxRenderMinutes} minutes and was still processing when polled; reconciliation remains active and manual provider review is recommended.`,
          renderStatus: 'rendering',
          submissionStatus: 'accepted',
        })
      : activeMetadata

  if (providerStatus !== 'completed' || !video.videoUrl) {
    const updated = await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata: progressMetadata,
      expectedAttemptKey: attemptKey,
      now: input.now,
    })
    return { reconciled: updated ? 1 : 0, privateRendersCreated: 0, failures: 0 }
  }

  if (
    !(await isCurrentVideoAttempt({
      supabase: input.supabase,
      scriptId: input.script.id,
      expectedAttemptKey: attemptKey,
    }))
  ) {
    return { reconciled: 0, privateRendersCreated: 0, failures: 0 }
  }

  await (input.createPrivateRender || createPrivateVideoRender)({
    supabase: input.supabase,
    script: input.script,
    renderUrl: video.videoUrl,
    heygenVideoId: video.videoId,
    heygenSessionId: session?.sessionId || input.metadata.heygen_session_id,
    actualDurationSeconds: video.durationSeconds,
    thumbnailUrls: video.thumbnailUrl ? [video.thumbnailUrl] : [],
    actorUserId: input.actorUserId,
    now: input.now,
  })
  const metadata = videoMetadataSchema.parse({
    ...input.metadata,
    render_status: 'completed',
    heygen_video_id: video.videoId,
    heygen_session_id: session?.sessionId || input.metadata.heygen_session_id,
    render_completed_at: input.now.toISOString(),
    render_error: null,
    provider_submission_status: 'accepted',
    provider_recovery_status: 'none',
  })
  const updated = await persistVideoAttemptMetadata({
    supabase: input.supabase,
    scriptId: input.script.id,
    metadata,
    expectedAttemptKey: attemptKey,
    now: input.now,
  })
  return {
    reconciled: updated ? 1 : 0,
    privateRendersCreated: 1,
    failures: 0,
  }
}

async function claimScriptForRender(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  metadata: VideoMetadata
  now: Date
}) {
  const metadata = videoMetadataSchema.parse({
    ...input.metadata,
    render_status: 'queued',
    render_started_at: input.now.toISOString(),
    render_completed_at: null,
    render_error: null,
    render_attempt_key: videoRenderAttemptKey(input.script),
    provider_submission_status: 'submitting',
    provider_recovery_status: 'none',
  })
  const { data, error } = await input.supabase
    .from('content_assets')
    .update({ metadata_json: metadata, updated_at: input.now.toISOString() })
    .eq('id', input.script.id)
    .eq('status', 'ready')
    .eq('approval_status', 'approved')
    .filter('metadata_json->>render_status', 'eq', 'not_started')
    .select(VIDEO_CONTENT_SELECT)
    .maybeSingle()
  if (error) throw error
  return data ? ({ row: data as VideoContentAssetRow, metadata } as const) : null
}

export async function submitVideoScriptAttempt(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  metadata: VideoMetadata
  apiKey: string
  fetchImpl?: typeof fetch
  now: Date
  requestTimeoutMs: number
}) {
  const claim = await claimScriptForRender(input)
  if (!claim) return { submitted: 0, failures: 0 }

  try {
    const session = await createHeyGenVideoAgent({
      apiKey: input.apiKey,
      prompt: claim.metadata.renderer_prompt as string,
      orientation: claim.metadata.orientation === 'portrait' ? 'portrait' : 'landscape',
      styleId: claim.metadata.style_id,
      // The database compare-and-set is the duplicate-submission guard. Keep
      // the attempt key in HeyGen's callback ID so an ambiguous transport
      // failure can be reconciled with provider evidence before any retry.
      callbackId: claim.metadata.render_attempt_key as string,
      idempotencyKey: claim.metadata.render_attempt_key as string,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.requestTimeoutMs,
    })
    const { metadata, failed } = buildProviderSessionMetadata({
      metadata: claim.metadata,
      session,
      now: input.now,
    })
    const updated = await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata,
      expectedAttemptKey: claim.metadata.render_attempt_key as string,
      now: input.now,
    })
    return {
      submitted: updated && !failed ? 1 : 0,
      failures: updated && failed ? 1 : 0,
      error: updated
        ? undefined
        : 'The script changed while HeyGen accepted the render; recover it using the stored callback attempt before retrying.',
    }
  } catch (error) {
    if (isDeterministicHeyGenSubmissionRejection(error)) {
      const message = `HeyGen rejected the video submission: ${safeErrorMessage(error)}`
      await failScriptRender({
        supabase: input.supabase,
        script: input.script,
        metadata: claim.metadata,
        message,
        now: input.now,
      })
      return { submitted: 0, failures: 1, error: message }
    }
    const message = `${safeErrorMessage(error)} Submission outcome is ambiguous. Recover with callback/idempotency key ${claim.metadata.render_attempt_key}; do not create a new attempt.`
    const metadata = buildRecoverableVideoAttemptMetadata({
      metadata: claim.metadata,
      message,
      renderStatus: 'queued',
      submissionStatus: 'ambiguous',
    })
    const updated = await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata,
      expectedAttemptKey: claim.metadata.render_attempt_key as string,
      now: input.now,
    })
    return {
      submitted: 0,
      failures: 0,
      error: updated
        ? message
        : 'The ambiguous HeyGen submission changed before its recoverable state could be recorded.',
    }
  }
}

export async function replayAmbiguousVideoSubmission(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  metadata: VideoMetadata
  apiKey: string
  fetchImpl?: typeof fetch
  now: Date
  requestTimeoutMs: number
}) {
  const attemptKey = input.metadata.render_attempt_key
  if (
    !attemptKey ||
    !input.metadata.renderer_prompt ||
    !['ambiguous', 'submitting'].includes(input.metadata.provider_submission_status) ||
    !isVideoSubmissionWithinIdempotencyReplayWindow(input.metadata, input.now)
  ) {
    return { recovered: 0, failures: 0, error: 'The submission is outside automatic replay safety.' }
  }

  try {
    const session = await createHeyGenVideoAgent({
      apiKey: input.apiKey,
      prompt: input.metadata.renderer_prompt,
      orientation: input.metadata.orientation === 'portrait' ? 'portrait' : 'landscape',
      styleId: input.metadata.style_id,
      callbackId: attemptKey,
      idempotencyKey: attemptKey,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.requestTimeoutMs,
    })
    const { metadata, failed } = buildProviderSessionMetadata({
      metadata: input.metadata,
      session,
      now: input.now,
    })
    const updated = await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata,
      expectedAttemptKey: attemptKey,
      now: input.now,
    })
    return {
      recovered: updated && !failed ? 1 : 0,
      failures: updated && failed ? 1 : 0,
      error: updated
        ? undefined
        : 'The ambiguous submission changed while its idempotent provider response was being recorded.',
    }
  } catch (error) {
    if (isDeterministicHeyGenSubmissionRejection(error)) {
      const message = `HeyGen rejected the idempotent video submission replay: ${safeErrorMessage(error)}`
      await failScriptRender({
        supabase: input.supabase,
        script: input.script,
        metadata: input.metadata,
        message,
        now: input.now,
      })
      return { recovered: 0, failures: 1, error: message }
    }
    const message = `${safeErrorMessage(error)} Idempotent replay remains recoverable with callback key ${attemptKey} while the 24-hour provider window is open.`
    const metadata = buildRecoverableVideoAttemptMetadata({
      metadata: input.metadata,
      message,
      renderStatus: 'queued',
      submissionStatus: 'ambiguous',
    })
    await persistVideoAttemptMetadata({
      supabase: input.supabase,
      scriptId: input.script.id,
      metadata,
      expectedAttemptKey: attemptKey,
      now: input.now,
    })
    return { recovered: 0, failures: 0, error: message }
  }
}

function resultStatus(input: {
  configured: boolean
  submitted: number
  privateRendersCreated: number
  failures: number
  videoContent: ReturnType<typeof buildVideoContentSnapshot>
}): VideoContentPilotResult['status'] {
  if (!input.configured) return 'blocked'
  if (input.failures > 0) return 'failed'
  if (input.privateRendersCreated > 0) return 'completed'
  if (input.submitted > 0) return 'submitted'
  if (input.videoContent.rendering > 0) return 'processing'
  return 'idle'
}

export async function runVideoContentPilot(input: {
  supabase: SupabaseLike
  actorUserId?: string | null
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  now?: Date
}): Promise<VideoContentPilotResult> {
  const now = input.now || new Date()
  const actorUserId = input.actorUserId || null
  const config = getVideoAutomationConfigFromEnv(input.env)
  const seed = await seedVestBlockVideoPilots({ supabase: input.supabase, actorUserId })
  let rows = await loadVideoRows(input.supabase)

  if (!config.apiKey) {
    const videoContent = buildVideoContentSnapshot(rows)
    return {
      status: 'blocked',
      configuration: {
        provider: 'heygen_video_agent_v3',
        ready: false,
        blocker: 'HEYGEN_API_KEY is not configured.',
        submitLimit: config.submitLimit,
      },
      seed,
      submitted: 0,
      reconciled: 0,
      privateRendersCreated: 0,
      failures: 0,
      errors: [],
      videoContent,
    }
  }

  let submitted = 0
  let reconciled = 0
  let privateRendersCreated = 0
  let failures = 0
  const errors: string[] = []

  const scriptsToReconcile = rows
    .filter((row) => row.content_type === 'video_script')
    .filter((script) => {
      const metadata = parseMetadata(script)
      return Boolean(metadata && ['queued', 'rendering'].includes(metadata.render_status))
    })
    .sort((a, b) => {
      const aStarted = Date.parse(parseMetadata(a)?.render_started_at || '')
      const bStarted = Date.parse(parseMetadata(b)?.render_started_at || '')
      return (Number.isFinite(aStarted) ? aStarted : 0) - (Number.isFinite(bStarted) ? bStarted : 0)
    })
    .slice(0, config.submitLimit)

  for (const script of scriptsToReconcile) {
    const metadata = parseMetadata(script)
    if (!metadata || !['queued', 'rendering'].includes(metadata.render_status)) continue
    if (!metadata.heygen_session_id && !metadata.heygen_video_id) {
      if (isStaleClaim(metadata, now, config.staleClaimMinutes)) {
        if (isVideoSubmissionWithinIdempotencyReplayWindow(metadata, now)) {
          const replayMetadata = ['ambiguous', 'submitting'].includes(
            metadata.provider_submission_status
          )
            ? metadata
            : buildRecoverableVideoAttemptMetadata({
                metadata,
                message: `The HeyGen submission has no recorded provider ID; replaying the same callback/idempotency key ${metadata.render_attempt_key}.`,
                renderStatus: 'queued',
                submissionStatus: 'ambiguous',
              })
          const recovery = await replayAmbiguousVideoSubmission({
            supabase: input.supabase,
            script,
            metadata: replayMetadata,
            apiKey: config.apiKey,
            fetchImpl: input.fetchImpl,
            now,
            requestTimeoutMs: config.requestTimeoutMs,
          })
          reconciled += recovery.recovered
          failures += recovery.failures
          if (recovery.error) errors.push(recovery.error)
        } else {
          const message = `The HeyGen submission has no recorded provider ID and is outside the 24-hour idempotency replay window. Recover it manually with callback key ${metadata.render_attempt_key}; do not create a new attempt.`
          const recoverableMetadata = buildRecoverableVideoAttemptMetadata({
            metadata,
            message,
            renderStatus: 'queued',
            submissionStatus: 'ambiguous',
          })
          const updated = await persistVideoAttemptMetadata({
            supabase: input.supabase,
            scriptId: script.id,
            metadata: recoverableMetadata,
            expectedAttemptKey: metadata.render_attempt_key as string,
            now,
          })
          if (updated) errors.push(message)
        }
      }
      continue
    }

    try {
      const result = await reconcileVideoScriptAttempt({
        supabase: input.supabase,
        script,
        metadata,
        apiKey: config.apiKey,
        fetchImpl: input.fetchImpl,
        actorUserId,
        now,
        maxRenderMinutes: config.maxRenderMinutes,
        requestTimeoutMs: config.requestTimeoutMs,
      })
      reconciled += result.reconciled
      privateRendersCreated += result.privateRendersCreated
      failures += result.failures
    } catch (error) {
      const message = safeErrorMessage(error)
      const recoverableMessage = `HeyGen reconciliation could not read a terminal job state: ${message}. The known provider attempt remains active for a later poll or manual review.`
      const recoverableMetadata = buildRecoverableVideoAttemptMetadata({
        metadata,
        message: recoverableMessage,
      })
      await persistVideoAttemptMetadata({
        supabase: input.supabase,
        scriptId: script.id,
        metadata: recoverableMetadata,
        expectedAttemptKey: metadata.render_attempt_key as string,
        now,
      })
      errors.push(message)
      // Read failures never invent a terminal provider state. The known
      // provider attempt stays in flight until a later poll reports one.
    }
  }

  rows = await loadVideoRows(input.supabase)
  const renders = rows.filter((row) => row.content_type === 'video_render')
  const availableSubmitSlots = availableVideoSubmitSlots(rows, config.submitLimit)
  const candidates = rows
    .filter(isVideoScriptReadyForAutomaticRender)
    .filter(
      (script) =>
        !renders.some((render) => videoRenderMatchesScriptAttempt(render, script))
    )
    .sort((a, b) => videoScriptRenderPriority(b) - videoScriptRenderPriority(a))
    .map((script) => ({ script, metadata: parseMetadata(script) }))
    .filter(
      (item): item is { script: VideoContentAssetRow; metadata: VideoMetadata } =>
        Boolean(
          item.metadata &&
            item.metadata.render_status === 'not_started' &&
            item.metadata.renderer_prompt
        )
    )
    .slice(0, availableSubmitSlots)

  for (const candidate of candidates) {
    const result = await submitVideoScriptAttempt({
      supabase: input.supabase,
      script: candidate.script,
      metadata: candidate.metadata,
      apiKey: config.apiKey,
      fetchImpl: input.fetchImpl,
      now,
      requestTimeoutMs: config.requestTimeoutMs,
    })
    submitted += result.submitted
    failures += result.failures
    if (result.error) errors.push(result.error)
  }

  rows = await loadVideoRows(input.supabase)
  const videoContent = buildVideoContentSnapshot(rows)
  return {
    status: resultStatus({
      configured: true,
      submitted,
      privateRendersCreated,
      failures,
      videoContent,
    }),
    configuration: {
      provider: 'heygen_video_agent_v3',
      ready: true,
      blocker: null,
      submitLimit: config.submitLimit,
    },
    seed,
    submitted,
    reconciled,
    privateRendersCreated,
    failures,
    errors,
    videoContent,
  }
}
