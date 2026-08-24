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
assert.match(rendererPrompt, /VESTBLOCK MATERIAL LEDGER/)
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

console.log('video-content-system: ok')
