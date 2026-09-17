import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  VESTBLOCK_VIDEO_PILOTS,
  assertVideoApprovalTransition,
  buildHeyGenRendererPrompt,
  buildPilotAssetPayloads,
  buildVideoContentSnapshot,
  evaluateVideoLearning,
  isVideoPublishReady,
  videoMetadataSchema,
  type VideoPerformanceSnapshot,
} from '@/lib/content/video/contentSystem'
type TestModuleLoader = typeof import('node:module') & {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const moduleLoader = require('node:module') as TestModuleLoader
const originalLoad = moduleLoader._load
moduleLoader._load = function loadForTest(request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}
const {
  availableVideoSubmitSlots,
  getVideoAutomationConfigFromEnv,
  isVideoRenderOverAgeAfterProviderPoll,
  isVideoScriptReadyForAutomaticRender,
  isVideoSubmissionWithinIdempotencyReplayWindow,
  persistVideoAttemptMetadata,
  reconcileVideoScriptAttempt,
  replayAmbiguousVideoSubmission,
  submitVideoScriptAttempt,
  videoRenderAttemptKey,
  videoRenderMatchesScriptAttempt,
  videoScriptRenderPriority,
} = require('@/lib/content/video/automation') as typeof import('@/lib/content/video/automation')
const {
  HeyGenApiError,
  createHeyGenVideoAgent,
  getHeyGenVideo,
  getHeyGenVideoAgentSession,
} = require('@/lib/content/video/heyGenClient') as typeof import('@/lib/content/video/heyGenClient')
const {
  buildPrivateVideoRenderPayload,
  refreshHeyGenPrivateRenderUrl,
} = require('@/lib/content/video/privateRender') as typeof import('@/lib/content/video/privateRender')
moduleLoader._load = originalLoad

assert.equal(VESTBLOCK_VIDEO_PILOTS.length, 4, 'The governed pilot must contain four videos.')

const slugs = new Set<string>()
for (const pilot of VESTBLOCK_VIDEO_PILOTS) {
  const payloads = buildPilotAssetPayloads(pilot)
  assert.equal(payloads.brief.content_type, 'video_brief')
  assert.equal(payloads.script.content_type, 'video_script')
  assert.equal(payloads.script.approval_status, 'review_required')
  assert.ok(payloads.script.body_markdown.includes(pilot.scriptText))
  assert.equal('parent_content_id' in payloads.script, false)
  assert.doesNotThrow(() => videoMetadataSchema.parse(payloads.brief.metadata_json))
  assert.doesNotThrow(() => videoMetadataSchema.parse(payloads.script.metadata_json))
  assert.equal(payloads.script.metadata_json.style_id, pilot.styleId)
  slugs.add(payloads.brief.slug)
  slugs.add(payloads.script.slug)
}
assert.equal(slugs.size, 8, 'Every pilot brief and script needs a stable unique slug.')

const firstScript = buildPilotAssetPayloads(VESTBLOCK_VIDEO_PILOTS[0]).script
const firstMetadata = videoMetadataSchema.parse(firstScript.metadata_json)
assert.throws(
  () => buildHeyGenRendererPrompt({ metadata: firstMetadata, approvalStatus: 'review_required' }),
  /approval is required/i
)
const rendererPrompt = buildHeyGenRendererPrompt({ metadata: firstMetadata, approvalStatus: 'approved' })
assert.match(rendererPrompt, /Voice-over narration only/)
assert.match(rendererPrompt, /VESTBLOCK PRIVATE LEDGER/)
assert.match(rendererPrompt, /not a verbatim transcript/i)
assert.match(rendererPrompt, /Find your next move/i)

assert.doesNotThrow(() => assertVideoApprovalTransition('review_required', 'approved'))
assert.throws(
  () => assertVideoApprovalTransition('not_required', 'approved'),
  /cannot move/i
)

const completedRenderMetadata = videoMetadataSchema.parse({
  ...firstMetadata,
  asset_kind: 'video_render',
  generator: 'heygen_video_agent',
  renderer_prompt: rendererPrompt,
  render_status: 'completed',
  publication_status: 'private',
  render_url: 'https://example.test/private-render.mp4',
  compliance_review_status: 'approved',
  rights_review_status: 'approved',
  synthetic_media_disclosure: 'applied',
})
assert.equal(completedRenderMetadata.render_started_at, null)
assert.equal(completedRenderMetadata.render_completed_at, null)
assert.equal(completedRenderMetadata.render_error, null)
assert.equal(completedRenderMetadata.render_attempt_key, null)

assert.equal(
  isVideoPublishReady({
    id: 'render-1',
    title: 'Private render',
    slug: 'private-render',
    content_type: 'video_render',
    status: 'ready',
    approval_status: 'approved',
    metadata_json: completedRenderMetadata,
  }),
  true
)
assert.equal(
  isVideoPublishReady({
    id: 'render-2',
    title: 'Undisclosed render',
    slug: 'undisclosed-render',
    content_type: 'video_render',
    status: 'ready',
    approval_status: 'approved',
    metadata_json: {
      ...completedRenderMetadata,
      synthetic_media_disclosure: 'required',
    },
  }),
  false,
  'A realistic synthetic render cannot pass the publication gate without disclosure.'
)

function snapshot(contentId: string, window: '24h' | '7d', patch: Partial<VideoPerformanceSnapshot> = {}): VideoPerformanceSnapshot {
  return {
    contentId,
    hypothesisKey: 'contrarian-capital-hook',
    pillar: 'capital',
    formatFamily: 'hyper_real_scenario',
    language: 'en',
    trafficSource: 'youtube_browse',
    window,
    simulated: false,
    views: 100,
    averagePercentageViewed: 65,
    ctaClicks: 2,
    ...patch,
  }
}

const oneWindow = Array.from({ length: 5 }, (_, index) => snapshot(`asset-${index + 1}`, '24h'))
assert.equal(evaluateVideoLearning(oneWindow)[0].eligible, false)

const repeatedWindows = [
  ...oneWindow,
  ...Array.from({ length: 5 }, (_, index) => snapshot(`asset-${index + 1}`, '7d')),
]
const eligible = evaluateVideoLearning(repeatedWindows)[0]
assert.equal(eligible.eligible, true)
assert.equal(eligible.confidence, 'medium')
assert.deepEqual(new Set(eligible.windows), new Set(['24h', '7d']))

const simulatedOnly = repeatedWindows.map((row) => ({ ...row, simulated: true }))
assert.deepEqual(evaluateVideoLearning(simulatedOnly), [])

const nativeExperiment = evaluateVideoLearning([
  snapshot('native-a', '24h', { nativeConcurrentExperiment: true }),
  snapshot('native-b', '24h'),
])[0]
assert.equal(nativeExperiment.eligible, true)
assert.equal(nativeExperiment.confidence, 'high')

const queue = buildVideoContentSnapshot([
  {
    id: 'script-1',
    title: 'Review script',
    slug: 'review-script',
    content_type: 'video_script',
    status: 'draft',
    approval_status: 'review_required',
    body_markdown: firstScript.body_markdown,
    metadata_json: firstMetadata,
  },
  {
    id: 'script-2',
    title: 'Approved script',
    slug: 'approved-script',
    content_type: 'video_script',
    status: 'ready',
    approval_status: 'approved',
    body_markdown: firstScript.body_markdown,
    metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
  },
])
assert.equal(queue.awaitingApproval, 1)
assert.equal(queue.readyToRender, 1)
assert.match(queue.nextBottleneck, /awaiting review/i)

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260821032418_add_video_content_asset_contract.sql'
  ),
  'utf8'
)
for (const contentType of ['video_brief', 'video_script', 'video_render']) {
  assert.match(migration, new RegExp(`'${contentType}'`))
}
assert.match(migration, /parent_content_id uuid/i)
assert.match(migration, /approval_status text not null/i)
assert.match(migration, /references public\.content_assets\(id\) on delete set null/i)
assert.doesNotMatch(
  migration,
  /create policy/i,
  'The video extension must not widen the existing public RLS policy.'
)

const reviewPacket = fs.readFileSync(
  path.join(
    process.cwd(),
    'docs/content/video/VESTBLOCK_VIDEO_PILOT_001_REVIEW.md'
  ),
  'utf8'
)
for (const pilot of VESTBLOCK_VIDEO_PILOTS) {
  assert.match(reviewPacket, new RegExp(pilot.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.ok(reviewPacket.includes(pilot.scriptText))
  assert.ok(reviewPacket.includes(pilot.styleName.split(/ plus | with /)[0]))
}

const privateRenderPayload = buildPrivateVideoRenderPayload({
  script: {
    id: '9a9bbfaf-aa63-4297-b46b-f6274f87fd44',
    title: firstScript.title,
    slug: firstScript.slug,
    content_type: 'video_script',
    status: 'ready',
    approval_status: 'approved',
    metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
  },
  renderUrl: 'https://files.heygen.test/private-render.mp4',
  heygenVideoId: 'video-123',
  heygenSessionId: 'session-123',
  actualDurationSeconds: 44.2,
  thumbnailUrls: ['https://files.heygen.test/thumbnail.jpg'],
  now: new Date('2026-09-16T18:00:00.000Z'),
})
assert.equal(privateRenderPayload.status, 'draft')
assert.equal(privateRenderPayload.approval_status, 'review_required')
assert.equal(privateRenderPayload.metadata_json.publication_status, 'private')
assert.equal(privateRenderPayload.metadata_json.render_status, 'completed')
assert.equal(privateRenderPayload.metadata_json.render_completed_at, '2026-09-16T18:00:00.000Z')
assert.equal(privateRenderPayload.metadata_json.render_url_source, 'provider_ephemeral')
assert.equal(privateRenderPayload.metadata_json.render_url_refreshed_at, '2026-09-16T18:00:00.000Z')
assert.match(privateRenderPayload.slug, /video-123$/)
const manualRenderPayload = buildPrivateVideoRenderPayload({
  script: {
    id: '9a9bbfaf-aa63-4297-b46b-f6274f87fd44',
    title: firstScript.title,
    slug: firstScript.slug,
    content_type: 'video_script',
    status: 'ready',
    approval_status: 'approved',
    metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
  },
  renderUrl: 'https://example.test/manually-registered.mp4',
})
assert.equal(
  manualRenderPayload.slug,
  buildPrivateVideoRenderPayload({
    script: {
      id: '9a9bbfaf-aa63-4297-b46b-f6274f87fd44',
      title: firstScript.title,
      slug: firstScript.slug,
      content_type: 'video_script',
      status: 'ready',
      approval_status: 'approved',
      metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
    },
    renderUrl: 'https://example.test/manually-registered.mp4',
  }).slug,
  'Retrying a manual render registration must resolve to the same ledger slug.'
)
assert.throws(
  () =>
    buildPrivateVideoRenderPayload({
      script: {
        id: 'script-unapproved',
        title: firstScript.title,
        slug: firstScript.slug,
        content_type: 'video_script',
        status: 'draft',
        approval_status: 'review_required',
        metadata_json: firstMetadata,
      },
      renderUrl: 'https://files.heygen.test/private-render.mp4',
    }),
  /approved video script/i
)

assert.deepEqual(getVideoAutomationConfigFromEnv({}), {
  apiKey: null,
  submitLimit: 1,
  staleClaimMinutes: 20,
  maxRenderMinutes: 90,
  requestTimeoutMs: 8_000,
})
assert.equal(
  getVideoAutomationConfigFromEnv({ VIDEO_CONTENT_MAX_RENDER_MINUTES: '1' })
    .maxRenderMinutes,
  30,
  'The configurable render expiry must stay above the production reconciliation cadence.'
)
const overdueRenderMetadata = videoMetadataSchema.parse({
  ...firstMetadata,
  renderer_prompt: rendererPrompt,
  render_status: 'rendering',
  render_started_at: '2026-09-16T16:00:00.000Z',
  render_attempt_key: 'vestblock-video:overdue-render:approved-revision',
  heygen_session_id: 'session-overdue',
  heygen_video_id: 'video-overdue',
})
assert.equal(
  isVideoRenderOverAgeAfterProviderPoll({
    metadata: overdueRenderMetadata,
    now: new Date('2026-09-16T18:00:00.000Z'),
    maxRenderMinutes: 90,
    providerStatus: 'completed',
  }),
  false,
  'A completed provider result must win over the nominal render age.'
)
assert.equal(
  isVideoRenderOverAgeAfterProviderPoll({
    metadata: overdueRenderMetadata,
    now: new Date('2026-09-16T18:00:00.000Z'),
    maxRenderMinutes: 90,
    providerStatus: 'processing',
  }),
  true,
  'An overdue provider render that is still processing must be flagged without becoming terminal.'
)
assert.equal(
  getVideoAutomationConfigFromEnv({
    HEYGEN_API_KEY: 'configured',
    VIDEO_CONTENT_RENDER_LIMIT: '99',
  }).submitLimit,
  2,
  'The renderer must keep a hard concurrency/cost ceiling.'
)
assert.equal(
  isVideoScriptReadyForAutomaticRender({
    id: 'script-review-required',
    title: firstScript.title,
    slug: firstScript.slug,
    content_type: 'video_script',
    status: 'draft',
    approval_status: 'review_required',
    metadata_json: firstMetadata,
  }),
  false,
  'The automation must never render an unapproved script.'
)
assert.equal(
  isVideoScriptReadyForAutomaticRender({
    id: 'script-approved',
    title: firstScript.title,
    slug: firstScript.slug,
    content_type: 'video_script',
    status: 'ready',
    approval_status: 'approved',
    metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
  }),
  true,
  'An approved script with a renderer prompt must enter the automatic render lane.'
)
const propertyScript = buildPilotAssetPayloads(VESTBLOCK_VIDEO_PILOTS[1]).script
assert.ok(
  videoScriptRenderPriority({
    id: 'property-script',
    ...propertyScript,
    status: 'ready',
    approval_status: 'approved',
  }) >
    videoScriptRenderPriority({
      id: 'capital-script',
      ...firstScript,
      status: 'ready',
      approval_status: 'approved',
    }),
  'Property acquisition content must take the first available render slot.'
)

const approvedRevisionOne = {
  id: 'script-attempt',
  title: firstScript.title,
  slug: firstScript.slug,
  content_type: 'video_script',
  status: 'ready' as const,
  approval_status: 'approved' as const,
  approved_at: '2026-09-16T18:00:00.000Z',
  updated_at: '2026-09-16T18:00:00.000Z',
  metadata_json: { ...firstMetadata, renderer_prompt: rendererPrompt },
}
const approvedRevisionTwo = {
  ...approvedRevisionOne,
  approved_at: '2026-09-16T20:00:00.000Z',
  updated_at: '2026-09-16T20:00:00.000Z',
}
const revisionOneRender = {
  id: 'render-attempt-one',
  parent_content_id: approvedRevisionOne.id,
  title: 'Revision one render',
  slug: 'revision-one-render',
  content_type: 'video_render',
  status: 'draft' as const,
  approval_status: 'review_required' as const,
  metadata_json: {
    ...completedRenderMetadata,
    render_attempt_key: videoRenderAttemptKey(approvedRevisionOne),
  },
}
assert.equal(videoRenderMatchesScriptAttempt(revisionOneRender, approvedRevisionOne), true)
assert.equal(
  videoRenderMatchesScriptAttempt(revisionOneRender, approvedRevisionTwo),
  false,
  'A historical render must not block a newly approved script revision.'
)
assert.equal(
  privateRenderPayload.metadata_json.render_attempt_key,
  videoRenderAttemptKey({
    id: '9a9bbfaf-aa63-4297-b46b-f6274f87fd44',
    approved_at: null,
    updated_at: null,
    created_at: null,
  }),
  'A manually registered child render must suppress duplicate automation for the same revision.'
)
assert.equal(
  availableVideoSubmitSlots(
    [
      {
        ...approvedRevisionOne,
        metadata_json: {
          ...firstMetadata,
          renderer_prompt: rendererPrompt,
          render_status: 'rendering',
          render_attempt_key: videoRenderAttemptKey(approvedRevisionOne),
        },
      },
    ],
    1
  ),
  0,
  'An in-flight render must consume the global submission slot across cron invocations.'
)

const contentPublisherRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/cron/content-publisher/route.ts'),
  'utf8'
)
assert.match(contentPublisherRoute, /runVideoContentPilot/)
assert.match(contentPublisherRoute, /status: 'skipped' as const, reason: 'dry_run' as const/)
assert.match(contentPublisherRoute, /Promise\.allSettled/)
assert.match(contentPublisherRoute, /seoPublisherSucceeded/)
assert.match(contentPublisherRoute, /videoLaneHealthy \? 200 : 503|seoPublisherSucceeded && videoLaneHealthy \? 200 : 503/)
const vercelConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')
) as { crons?: Array<{ path?: string; schedule?: string }> }
assert.equal(
  vercelConfig.crons?.some((cron) => cron.path?.startsWith('/api/cron/content-publisher')),
  true,
  'Video automation must remain reachable through a scheduled production cron.'
)
const videoReconciliationCron = vercelConfig.crons?.find(
  (cron) => cron.path === '/api/cron/video-content-pilot'
)
assert.ok(
  videoReconciliationCron?.schedule,
  'In-flight video renders need a dedicated reconciliation schedule.'
)
const videoCronMinuteField = videoReconciliationCron.schedule.split(/\s+/)[0]
const videoCronMinutes = videoCronMinuteField
  .split(',')
  .map((value) => Number.parseInt(value, 10))
  .sort((a, b) => a - b)
assert.ok(
  videoCronMinutes.length > 1 &&
    videoCronMinutes.every((value) => Number.isInteger(value) && value >= 0 && value < 60),
  'The reconciliation cron must declare multiple valid checks per hour.'
)
const videoCronMinuteGaps = videoCronMinutes.map((minute, index) => {
  const nextMinute = videoCronMinutes[(index + 1) % videoCronMinutes.length]
  return index === videoCronMinutes.length - 1 ? 60 + nextMinute - minute : nextMinute - minute
})
assert.ok(
  Math.max(...videoCronMinuteGaps) < getVideoAutomationConfigFromEnv({}).maxRenderMinutes,
  'The production reconciliation cadence must poll before the nominal render expiry.'
)

async function testHeyGenClient() {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init })
    return new Response(
      JSON.stringify({
        data: {
          session_id: 'session-123',
          status: 'generating',
          video_id: 'video-123',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }) as typeof fetch

  const session = await createHeyGenVideoAgent({
    apiKey: 'test-key-never-log-this',
    prompt: rendererPrompt,
    orientation: 'portrait',
    styleId: firstMetadata.style_id,
    callbackId: 'vestblock-video:test-attempt',
    idempotencyKey: 'vestblock-video:test-attempt',
    fetchImpl,
  })
  assert.equal(session.sessionId, 'session-123')
  assert.equal(session.videoId, 'video-123')
  assert.equal(requests[0].url, 'https://api.heygen.com/v3/video-agents')
  const headers = new Headers(requests[0].init?.headers)
  assert.equal(headers.get('x-api-key'), 'test-key-never-log-this')
  assert.equal(headers.get('idempotency-key'), 'vestblock-video:test-attempt')
  const body = JSON.parse(String(requests[0].init?.body))
  assert.equal(body.mode, 'generate')
  assert.equal(body.orientation, 'portrait')
  assert.equal(body.style_id, firstMetadata.style_id)
  assert.equal(body.callback_id, 'vestblock-video:test-attempt')
  assert.equal(body.visibility, 'private')
  assert.equal(body.incognito_mode, true)
  assert.equal(JSON.stringify(body).includes('test-key-never-log-this'), false)

  const video = await getHeyGenVideo({
    apiKey: 'test-key',
    videoId: 'video-123',
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          data: {
            id: 'video-123',
            status: 'completed',
            video_url: 'https://files.heygen.test/video.mp4',
            thumbnail_url: 'https://files.heygen.test/thumb.jpg',
            duration: 44.2,
          },
        }),
        { status: 200 }
      )) as typeof fetch,
  })
  assert.equal(video.status, 'completed')
  assert.equal(video.videoUrl, 'https://files.heygen.test/video.mp4')

  const unknownSession = await getHeyGenVideoAgentSession({
    apiKey: 'test-key',
    sessionId: 'session-unknown',
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ data: { session_id: 'session-unknown', status: 'new_provider_state' } }),
        { status: 200 }
      )) as typeof fetch,
  })
  assert.equal(
    unknownSession.status,
    'unknown',
    'An unfamiliar provider status must not be treated as endlessly generating.'
  )

  await assert.rejects(
    createHeyGenVideoAgent({
      apiKey: 'secret-key',
      prompt: rendererPrompt,
      orientation: 'landscape',
      callbackId: 'script-id',
      idempotencyKey: 'script-id',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ error: { code: 'payment_required', message: 'API credits required.' } }),
          { status: 402 }
        )) as typeof fetch,
    }),
    (error: unknown) =>
      error instanceof HeyGenApiError &&
      error.status === 402 &&
      error.code === 'payment_required' &&
      !error.message.includes('secret-key')
  )

  const casPredicates: Array<[string, unknown]> = []
  const casChain = {
    update() {
      return this
    },
    eq(column: string, value: unknown) {
      casPredicates.push([column, value])
      return this
    },
    filter(column: string, _operator: string, value: unknown) {
      casPredicates.push([column, value])
      return this
    },
    select() {
      return this
    },
    async maybeSingle() {
      return { data: { id: 'script-attempt' }, error: null }
    },
  }
  const casUpdated = await persistVideoAttemptMetadata({
    supabase: { from: () => casChain } as never,
    scriptId: 'script-attempt',
    metadata: videoMetadataSchema.parse({
      ...firstMetadata,
      renderer_prompt: rendererPrompt,
      render_status: 'rendering',
      render_attempt_key: 'attempt-cas',
    }),
    expectedAttemptKey: 'attempt-cas',
    now: new Date('2026-09-16T18:30:00.000Z'),
  })
  assert.equal(casUpdated, true)
  assert.ok(casPredicates.some(([column, value]) => column === 'approval_status' && value === 'approved'))
  assert.ok(
    casPredicates.some(
      ([column, value]) =>
        column === 'metadata_json->>render_attempt_key' && value === 'attempt-cas'
    ),
    'Post-provider writes must compare-and-set against the claimed render attempt.'
  )

  function createAttemptStore() {
    let metadata: ReturnType<typeof videoMetadataSchema.parse> | null = null
    const chain = {
      update(input: { metadata_json: ReturnType<typeof videoMetadataSchema.parse> }) {
        metadata = input.metadata_json
        return this
      },
      select() {
        return this
      },
      eq() {
        return this
      },
      filter() {
        return this
      },
      async maybeSingle() {
        return { data: { id: 'script-recovery-test' }, error: null }
      },
    }
    return {
      supabase: { from: () => chain } as never,
      metadata: () => metadata,
    }
  }

  const reconciliationStore = createAttemptStore()
  let providerPhase: 'processing' | 'completed' = 'processing'
  const reconciliationFetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url)
    if (requestUrl.includes('/v3/video-agents/')) {
      return new Response(
        JSON.stringify({
          data: {
            session_id: 'session-late-completion',
            status: providerPhase === 'completed' ? 'completed' : 'generating',
            video_id: 'video-late-completion',
          },
        }),
        { status: 200 }
      )
    }
    return new Response(
      JSON.stringify({
        data: {
          id: 'video-late-completion',
          status: providerPhase,
          video_url:
            providerPhase === 'completed'
              ? 'https://files.heygen.test/late-completion.mp4'
              : null,
          thumbnail_url: 'https://files.heygen.test/late-completion.jpg',
          duration: 52,
        },
      }),
      { status: 200 }
    )
  }) as typeof fetch
  const lateAttemptMetadata = videoMetadataSchema.parse({
    ...firstMetadata,
    renderer_prompt: rendererPrompt,
    render_status: 'rendering',
    render_started_at: '2026-09-16T18:00:00.000Z',
    render_attempt_key: 'vestblock-video:late-completion:approved-revision',
    heygen_session_id: 'session-late-completion',
    heygen_video_id: 'video-late-completion',
    provider_submission_status: 'accepted',
  })
  const lateScript = {
    ...approvedRevisionOne,
    id: 'script-recovery-test',
    metadata_json: lateAttemptMetadata,
  }
  const atNinetyMinutes = await reconcileVideoScriptAttempt({
    supabase: reconciliationStore.supabase,
    script: lateScript,
    metadata: lateAttemptMetadata,
    apiKey: 'test-key',
    fetchImpl: reconciliationFetch,
    actorUserId: null,
    now: new Date('2026-09-16T19:30:00.000Z'),
    maxRenderMinutes: 90,
    requestTimeoutMs: 8_000,
  })
  const ninetyMinuteMetadata = reconciliationStore.metadata()
  assert.equal(atNinetyMinutes.failures, 0)
  assert.equal(ninetyMinuteMetadata?.render_status, 'rendering')
  assert.equal(ninetyMinuteMetadata?.provider_recovery_status, 'manual_review_required')

  providerPhase = 'completed'
  let registeredLateRender: ReturnType<typeof buildPrivateVideoRenderPayload> | null = null
  const atNinetyFiveMinutes = await reconcileVideoScriptAttempt({
    supabase: reconciliationStore.supabase,
    script: lateScript,
    metadata: videoMetadataSchema.parse(ninetyMinuteMetadata),
    apiKey: 'test-key',
    fetchImpl: reconciliationFetch,
    actorUserId: null,
    now: new Date('2026-09-16T19:35:00.000Z'),
    maxRenderMinutes: 90,
    requestTimeoutMs: 8_000,
    createPrivateRender: async (input) => {
      registeredLateRender = buildPrivateVideoRenderPayload(input)
      return { id: 'private-render-late', ...registeredLateRender }
    },
  })
  assert.equal(atNinetyFiveMinutes.privateRendersCreated, 1)
  assert.equal(reconciliationStore.metadata()?.render_status, 'completed')
  const registeredLateRenderResult = registeredLateRender as ReturnType<
    typeof buildPrivateVideoRenderPayload
  > | null
  assert.equal(registeredLateRenderResult?.status, 'draft')
  assert.equal(registeredLateRenderResult?.approval_status, 'review_required')
  assert.equal(registeredLateRenderResult?.metadata_json.publication_status, 'private')

  const ambiguousStore = createAttemptStore()
  const ambiguousRequestKeys: string[] = []
  const ambiguousScript = {
    ...approvedRevisionOne,
    id: 'script-recovery-test',
    metadata_json: videoMetadataSchema.parse({
      ...firstMetadata,
      renderer_prompt: rendererPrompt,
      render_status: 'not_started',
    }),
  }
  const timedOutSubmission = await submitVideoScriptAttempt({
    supabase: ambiguousStore.supabase,
    script: ambiguousScript,
    metadata: videoMetadataSchema.parse(ambiguousScript.metadata_json),
    apiKey: 'test-key',
    now: new Date('2026-09-16T20:00:00.000Z'),
    requestTimeoutMs: 8_000,
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      ambiguousRequestKeys.push(new Headers(init?.headers).get('idempotency-key') || '')
      throw new TypeError('socket closed after request write')
    }) as typeof fetch,
  })
  const ambiguousMetadata = videoMetadataSchema.parse(ambiguousStore.metadata())
  assert.equal(timedOutSubmission.failures, 0)
  assert.equal(ambiguousMetadata.render_status, 'queued')
  assert.equal(ambiguousMetadata.provider_submission_status, 'ambiguous')
  assert.equal(ambiguousMetadata.provider_recovery_status, 'manual_review_required')
  assert.equal(ambiguousMetadata.render_completed_at, null)

  const hardRejectionStore = createAttemptStore()
  const hardRejection = await submitVideoScriptAttempt({
    supabase: hardRejectionStore.supabase,
    script: ambiguousScript,
    metadata: videoMetadataSchema.parse(ambiguousScript.metadata_json),
    apiKey: 'test-key',
    now: new Date('2026-09-16T20:00:00.000Z'),
    requestTimeoutMs: 8_000,
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          error: { code: 'payment_required', message: 'API credits required.' },
        }),
        { status: 402 }
      )) as typeof fetch,
  })
  const hardRejectionMetadata = videoMetadataSchema.parse(hardRejectionStore.metadata())
  assert.equal(hardRejection.failures, 1)
  assert.equal(hardRejection.submitted, 0)
  assert.equal(hardRejectionMetadata.render_status, 'failed')
  assert.ok(hardRejectionMetadata.render_completed_at)
  assert.match(hardRejection.error || '', /payment|credits|required/i)

  const rateLimitedStore = createAttemptStore()
  const rateLimitedSubmission = await submitVideoScriptAttempt({
    supabase: rateLimitedStore.supabase,
    script: ambiguousScript,
    metadata: videoMetadataSchema.parse(ambiguousScript.metadata_json),
    apiKey: 'test-key',
    now: new Date('2026-09-16T20:00:00.000Z'),
    requestTimeoutMs: 8_000,
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ error: { code: 'rate_limited', message: 'Try again later.' } }),
        { status: 429 }
      )) as typeof fetch,
  })
  const rateLimitedMetadata = videoMetadataSchema.parse(rateLimitedStore.metadata())
  assert.equal(rateLimitedSubmission.failures, 0)
  assert.equal(rateLimitedMetadata.render_status, 'queued')
  assert.equal(rateLimitedMetadata.provider_submission_status, 'ambiguous')
  assert.equal(rateLimitedMetadata.provider_recovery_status, 'manual_review_required')
  assert.equal(
    isVideoSubmissionWithinIdempotencyReplayWindow(
      ambiguousMetadata,
      new Date('2026-09-16T20:30:00.000Z')
    ),
    true
  )

  const replayedSubmission = await replayAmbiguousVideoSubmission({
    supabase: ambiguousStore.supabase,
    script: ambiguousScript,
    metadata: ambiguousMetadata,
    apiKey: 'test-key',
    now: new Date('2026-09-16T20:30:00.000Z'),
    requestTimeoutMs: 8_000,
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      ambiguousRequestKeys.push(new Headers(init?.headers).get('idempotency-key') || '')
      return new Response(
        JSON.stringify({
          data: {
            session_id: 'session-replayed',
            status: 'generating',
            video_id: 'video-replayed',
          },
        }),
        { status: 200 }
      )
    }) as typeof fetch,
  })
  const recoveredMetadata = videoMetadataSchema.parse(ambiguousStore.metadata())
  assert.equal(replayedSubmission.recovered, 1)
  assert.equal(recoveredMetadata.provider_submission_status, 'accepted')
  assert.equal(recoveredMetadata.heygen_session_id, 'session-replayed')
  assert.equal(recoveredMetadata.heygen_video_id, 'video-replayed')
  assert.deepEqual(
    ambiguousRequestKeys,
    [ambiguousMetadata.render_attempt_key, ambiguousMetadata.render_attempt_key],
    'An ambiguous POST must replay the identical provider request key, never create a new job key.'
  )
  assert.equal(
    isVideoSubmissionWithinIdempotencyReplayWindow(
      ambiguousMetadata,
      new Date('2026-09-17T20:00:00.000Z')
    ),
    false,
    'Automatic POST replay must stop before the provider idempotency window expires.'
  )

  let storedMetadata: Record<string, unknown> | null = null
  const refreshPredicates: Array<[string, unknown]> = []
  const updateChain = {
    eq(column: string, value: unknown) {
      refreshPredicates.push([column, value])
      return this
    },
    select() {
      return this
    },
    async maybeSingle() {
      return {
        data: {
          id: 'render-refresh',
          content_type: 'video_render',
          metadata_json: storedMetadata,
        },
        error: null,
      }
    },
  }
  const fakeSupabase = {
    from() {
      return {
        update(input: { metadata_json: Record<string, unknown> }) {
          storedMetadata = input.metadata_json
          return updateChain
        },
      }
    },
  }
  const refreshed = await refreshHeyGenPrivateRenderUrl({
    supabase: fakeSupabase as never,
    render: {
      id: 'render-refresh',
      title: 'Private render',
      slug: 'private-render',
      content_type: 'video_render',
      status: 'draft',
      approval_status: 'review_required',
      metadata_json: privateRenderPayload.metadata_json,
      updated_at: '2026-09-16T18:00:00.000Z',
    },
    apiKey: 'test-key',
    now: new Date('2026-09-16T19:00:00.000Z'),
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          data: {
            id: 'video-123',
            status: 'completed',
            video_url: 'https://files.heygen.test/refreshed-video.mp4',
            thumbnail_url: 'https://files.heygen.test/refreshed-thumb.jpg',
            duration: 45,
          },
        }),
        { status: 200 }
      )) as typeof fetch,
  })
  const refreshedMetadata = videoMetadataSchema.parse(refreshed.metadata_json)
  assert.equal(refreshedMetadata.render_url, 'https://files.heygen.test/refreshed-video.mp4')
  assert.equal(refreshedMetadata.render_url_source, 'provider_ephemeral')
  assert.equal(refreshedMetadata.render_url_refreshed_at, '2026-09-16T19:00:00.000Z')
  assert.ok(
    refreshPredicates.some(
      ([column, value]) =>
        column === 'updated_at' && value === '2026-09-16T18:00:00.000Z'
    ),
    'URL refresh must not overwrite a concurrent approval or review edit.'
  )
}

void testHeyGenClient()
  .then(() => console.log('video-content-system: ok'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
