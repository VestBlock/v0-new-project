import { z } from 'zod'

export const VIDEO_CONTENT_TYPES = ['video_brief', 'video_script', 'video_render'] as const
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number]

export const VIDEO_APPROVAL_STATUSES = [
  'not_required',
  'review_required',
  'approved',
  'changes_requested',
  'rejected',
] as const
export type VideoApprovalStatus = (typeof VIDEO_APPROVAL_STATUSES)[number]

export const videoPillarSchema = z.enum([
  'capital',
  'deals',
  'opportunity',
  'dealvault',
  'master_brand',
])

export const videoFormatSchema = z.enum([
  'hyper_real_scenario',
  'drawn_explainer',
  'presenter_explainer',
  'screen_demo',
  'case_study',
  'hybrid',
])

export const videoOrientationSchema = z.enum(['portrait', 'landscape', 'square'])
export const videoWindowSchema = z.enum(['24h', '7d', '28d'])

export const videoMetadataSchema = z.object({
  contract_version: z.literal('vestblock-video-v1'),
  asset_kind: z.enum(VIDEO_CONTENT_TYPES),
  pilot_batch: z.string().max(100).nullable().default(null),
  content_id: z.string().max(120),
  pillar: videoPillarSchema,
  persona: z.string().min(2).max(240),
  buyer_stage: z.enum(['awareness', 'consideration', 'decision', 'implementation']),
  language: z.enum(['en', 'es']),
  platform: z.enum(['youtube', 'youtube_shorts', 'linkedin', 'facebook', 'x', 'multi']),
  orientation: videoOrientationSchema,
  question_or_pain: z.string().min(10).max(1000),
  hypothesis: z.string().min(10).max(1000),
  hook_family: z.string().min(2).max(160),
  format_family: videoFormatSchema,
  visual_family: z.string().min(2).max(160),
  duration_target_seconds: z.number().int().min(15).max(900),
  source_urls: z.array(z.string().max(500)).max(20),
  claim_notes: z.array(z.string().max(1000)).max(30),
  compliance_review_status: z.enum(['pending', 'approved', 'changes_required', 'not_required']),
  rights_review_status: z.enum(['pending', 'approved', 'changes_required', 'not_required']),
  synthetic_media_disclosure: z.enum(['not_applicable', 'required', 'applied']),
  generator: z.enum(['vestblock_video_system_v1', 'heygen_video_agent', 'manual']),
  avatar_group_id: z.string().max(240).nullable().default(null),
  voice_id: z.string().max(240).nullable().default(null),
  style_id: z.string().max(240).nullable().default(null),
  prompt_version: z.string().min(1).max(120),
  render_status: z.enum(['not_started', 'queued', 'rendering', 'completed', 'failed']),
  publication_status: z.enum(['draft', 'private', 'unlisted', 'published', 'failed']),
  critical_on_screen_text: z.array(z.string().max(300)).max(30),
  script_text: z.string().max(30000).nullable().default(null),
  renderer_prompt: z.string().max(40000).nullable().default(null),
  style_name: z.string().max(160).nullable().default(null),
  renderer: z.string().max(160).nullable().default(null),
  render_url: z.string().max(2000).nullable().default(null),
  heygen_video_id: z.string().max(240).nullable().default(null),
  heygen_session_id: z.string().max(240).nullable().default(null),
  actual_duration_seconds: z.number().min(0).max(3600).nullable().default(null),
  thumbnail_variants: z.array(z.string().max(2000)).max(10).default([]),
  cost_estimate: z.number().min(0).nullable().default(null),
  fact_checked_by: z.string().max(240).nullable().default(null),
  youtube_video_id: z.string().max(120).nullable().default(null),
  review_notes: z.array(z.string().max(2000)).max(30).default([]),
  performance_snapshots: z.array(z.record(z.string(), z.unknown())).max(30).default([]),
})

export type VideoMetadata = z.infer<typeof videoMetadataSchema>

export type VideoContentAssetRow = {
  id: string
  parent_content_id?: string | null
  title: string
  slug: string
  content_type: string
  service_key?: string | null
  language?: string | null
  audience?: string | null
  prompt?: string | null
  status: 'draft' | 'ready' | 'published' | 'archived'
  platform?: string | null
  post_type?: string | null
  body_markdown?: string | null
  cta_label?: string | null
  cta_url?: string | null
  metadata_json?: Record<string, unknown> | null
  approval_status?: VideoApprovalStatus | null
  approved_by?: string | null
  approved_at?: string | null
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type VideoPilotDefinition = {
  key: string
  title: string
  slug: string
  pillar: z.infer<typeof videoPillarSchema>
  serviceKey: string
  audience: string
  persona: string
  buyerStage: 'awareness' | 'consideration' | 'decision' | 'implementation'
  platform: 'youtube' | 'youtube_shorts' | 'linkedin' | 'facebook' | 'x' | 'multi'
  orientation: z.infer<typeof videoOrientationSchema>
  questionOrPain: string
  hypothesis: string
  hookFamily: string
  formatFamily: z.infer<typeof videoFormatSchema>
  visualFamily: string
  durationTargetSeconds: number
  sourceUrls: string[]
  claimNotes: string[]
  criticalOnScreenText: string[]
  styleName: string
  styleId: string
  scriptText: string
  ctaLabel: string
  ctaUrl: string
}

// Read from the connected HeyGen Video Agent catalog on 2026-08-20.
// Style templates are aspect-ratio-specific, so the pilot contract checks
// this mapping before any asset reaches the approval queue.
export const VESTBLOCK_HEYGEN_STYLE_ASPECTS: Record<string, '16:9' | '9:16'> = {
  cb896c823a334e2c8784f8c154007aa8: '9:16', // Contact Sheet
  a7d2cc8d4f114a0f9c625ff33a9c495b: '9:16', // Journal
  '24b9aed403a04dc59c26c1e1541d6c30': '16:9', // Darkroom Print
  '4c9025a3b9734c6ea6c122fc00e04767': '16:9', // Blueprint
}

export const VESTBLOCK_VIDEO_PILOTS: VideoPilotDefinition[] = [
  {
    key: 'capital-application-spiral',
    title: 'Another Funding Application Is Not the First Move',
    slug: 'video-pilot-capital-application-spiral',
    pillar: 'capital',
    serviceKey: 'business_funding',
    audience: 'business owners considering another funding application',
    persona: 'small-business owner with an unclear funding file',
    buyerStage: 'awareness',
    platform: 'youtube_shorts',
    orientation: 'portrait',
    questionOrPain: 'The owner keeps applying without understanding whether the business file is ready.',
    hypothesis: 'Naming the application spiral and replacing it with a readiness sequence will earn attention and drive qualified next-move visits.',
    hookFamily: 'contrarian correction',
    formatFamily: 'hyper_real_scenario',
    visualFamily: 'Material Ledger cinematic realism',
    durationTargetSeconds: 45,
    sourceUrls: ['/funding', '/next-move'],
    claimNotes: [
      'Describe readiness factors without implying that any factor guarantees approval.',
      'Do not state or imply that a depicted owner is a real VestBlock customer.',
    ],
    criticalOnScreenText: ['APPLY AGAIN?', 'REVENUE', 'BANKING', 'OBLIGATIONS', 'DOCUMENTS', 'USE OF FUNDS', 'Find your next move.'],
    styleName: 'Contact Sheet with hyper-real scenario footage',
    styleId: 'cb896c823a334e2c8784f8c154007aa8',
    scriptText: `Another funding application will not fix a file no one has organized.

Before you apply again, look at what a reviewer may actually need to understand: time in business, revenue, banking activity, current obligations, credit profile, documents, and the use of funds.

VestBlock helps organize readiness and possible next steps, so you can decide whether to apply, prepare, or pause.

No approval is guaranteed. The better first move is a clearer file.

Find your next move with VestBlock.`,
    ctaLabel: 'Review your next move',
    ctaUrl: '/next-move',
  },
  {
    key: 'deals-address-is-not-a-deal',
    title: 'An Address Is Not a Deal',
    slug: 'video-pilot-address-is-not-a-deal',
    pillar: 'deals',
    serviceKey: 'sell_property',
    audience: 'property owners, buyers, and operators evaluating an opportunity',
    persona: 'operator who received a property address without enough context',
    buyerStage: 'awareness',
    platform: 'youtube_shorts',
    orientation: 'portrait',
    questionOrPain: 'Property opportunities are passed around with an address but without the context required for a serious review.',
    hypothesis: 'A simple drawn model of deal context will make VestBlock routing easy to understand and highly shareable.',
    hookFamily: 'category reframe',
    formatFamily: 'drawn_explainer',
    visualFamily: 'Material Ledger marker-and-paper diagram',
    durationTargetSeconds: 55,
    sourceUrls: ['/sell', '/buyers', '/lenders'],
    claimNotes: [
      'Keep every route conditional on verified property, seller, buyer, and capital context.',
      'Do not promise an offer, match, closing, financing, or return.',
    ],
    criticalOnScreenText: ['ADDRESS ≠ DEAL', 'PROPERTY', 'OWNER GOAL', 'TIMELINE', 'CONDITION', 'BUYER FIT', 'CAPITAL FIT', 'NEXT MOVE'],
    styleName: 'Journal',
    styleId: 'a7d2cc8d4f114a0f9c625ff33a9c495b',
    scriptText: `An address is not a deal.

A serious opportunity needs context: the property, the owner’s goal, the timeline, the condition, the numbers, the buyer criteria, and the capital path.

Without that context, people forward noise. With it, the right person can decide whether the opportunity deserves a closer review.

VestBlock helps organize the situation and route the next conversation. It does not force every property into the same answer.

The goal is not more deal flow. It is clearer deal flow.

Find your next move with VestBlock.`,
    ctaLabel: 'Start with the situation',
    ctaUrl: '/sell',
  },
  {
    key: 'dealvault-screenshot-problem',
    title: 'The Screenshot Problem',
    slug: 'video-pilot-dealvault-screenshot-problem',
    pillar: 'dealvault',
    serviceKey: 'dealvault',
    audience: 'partners and operators coordinating introductions, milestones, and payout terms',
    persona: 'deal partner reconstructing an agreement from messages and screenshots',
    buyerStage: 'consideration',
    platform: 'multi',
    orientation: 'landscape',
    questionOrPain: 'Important deal context is scattered across messages, screenshots, and memory.',
    hypothesis: 'A realistic handoff failure followed by a clean record view will make DealVault’s trust-layer role immediately legible.',
    hookFamily: 'recognizable failure',
    formatFamily: 'hybrid',
    visualFamily: 'Material Ledger cinematic-to-interface transition',
    durationTargetSeconds: 60,
    sourceUrls: ['/dealvault'],
    claimNotes: [
      'Position DealVault as a record and accountability layer, not legal advice or guaranteed enforcement.',
      'Use fictional UI data and never depict it as a real customer record.',
    ],
    criticalOnScreenText: ['WHO INTRODUCED IT?', 'WHAT WAS AGREED?', 'WHAT CHANGED?', 'WHAT HAPPENS NEXT?', 'DealVault', 'Find your next move.'],
    styleName: 'Darkroom Print plus clean product motion',
    styleId: '24b9aed403a04dc59c26c1e1541d6c30',
    scriptText: `The problem is not always the agreement. Sometimes it is proving what everyone agreed to later.

Who introduced the opportunity? What payout terms were recorded? Which milestone was completed? What changed, and who acknowledged it?

When that history lives across texts, screenshots, and memory, the partnership gets harder to manage.

DealVault is VestBlock’s supporting trust layer for clearer records, milestones, introductions, and decisions. Sensitive documents stay off-chain, while the event trail helps the team see what happened and what comes next.

Clearer records. Cleaner handoffs. A better next move.`,
    ctaLabel: 'Explore DealVault',
    ctaUrl: '/dealvault',
  },
  {
    key: 'master-brand-three-doors',
    title: 'What VestBlock Actually Does',
    slug: 'video-pilot-what-vestblock-does',
    pillar: 'master_brand',
    serviceKey: 'visibility_expansion',
    audience: 'people and businesses deciding what to do next with capital, deals, or growth opportunities',
    persona: 'new visitor who sees several VestBlock capabilities and needs one clear mental model',
    buyerStage: 'awareness',
    platform: 'youtube',
    orientation: 'landscape',
    questionOrPain: 'The breadth of VestBlock can feel disconnected without a simple master explanation.',
    hypothesis: 'A three-door drawn explanation will make the platform understandable without narrowing it to one product or market.',
    hookFamily: 'master mental model',
    formatFamily: 'drawn_explainer',
    visualFamily: 'Material Ledger blueprint',
    durationTargetSeconds: 70,
    sourceUrls: ['/', '/next-move', '/dealvault'],
    claimNotes: [
      'Preserve Capital + Deals + Opportunity as the public structure.',
      'Describe the Brain and Command Center only as supporting intelligence, not as a fourth public pillar.',
    ],
    criticalOnScreenText: ['CAPITAL', 'DEALS', 'OPPORTUNITY', 'DealVault', 'Find your next move.'],
    styleName: 'Blueprint',
    styleId: '4c9025a3b9734c6ea6c122fc00e04767',
    scriptText: `VestBlock is built around one question: what is your clearest next move?

Sometimes that move is about capital—understanding readiness, organizing the file, and reviewing realistic paths.

Sometimes it is about a deal—bringing the property, people, criteria, and capital context into one serious conversation.

And sometimes it is about opportunity—helping a business become easier to find, contact, trust, and grow.

DealVault supports those moves with clearer records when introductions, agreements, milestones, and payouts matter.

Capital. Deals. Opportunity. One coordinated platform helping people and businesses move with better context.

VestBlock. Find your next move.`,
    ctaLabel: 'Find your next move',
    ctaUrl: '/next-move',
  },
]

function metadataForPilot(
  pilot: VideoPilotDefinition,
  assetKind: 'video_brief' | 'video_script'
): VideoMetadata {
  return videoMetadataSchema.parse({
    contract_version: 'vestblock-video-v1',
    asset_kind: assetKind,
    pilot_batch: 'vestblock-video-pilot-001',
    content_id: pilot.key,
    pillar: pilot.pillar,
    persona: pilot.persona,
    buyer_stage: pilot.buyerStage,
    language: 'en',
    platform: pilot.platform,
    orientation: pilot.orientation,
    question_or_pain: pilot.questionOrPain,
    hypothesis: pilot.hypothesis,
    hook_family: pilot.hookFamily,
    format_family: pilot.formatFamily,
    visual_family: pilot.visualFamily,
    duration_target_seconds: pilot.durationTargetSeconds,
    source_urls: pilot.sourceUrls,
    claim_notes: pilot.claimNotes,
    compliance_review_status: 'pending',
    rights_review_status: 'pending',
    synthetic_media_disclosure:
      pilot.formatFamily === 'hyper_real_scenario' || pilot.formatFamily === 'hybrid'
        ? 'required'
        : 'not_applicable',
    generator: 'vestblock_video_system_v1',
    avatar_group_id: null,
    voice_id: null,
    style_id: pilot.styleId,
    prompt_version: 'vestblock-video-v1',
    render_status: 'not_started',
    publication_status: 'draft',
    critical_on_screen_text: pilot.criticalOnScreenText,
    script_text: assetKind === 'video_script' ? pilot.scriptText : null,
    renderer_prompt: null,
    style_name: pilot.styleName,
    renderer: 'heygen_video_agent',
    render_url: null,
    heygen_video_id: null,
    heygen_session_id: null,
    actual_duration_seconds: null,
    thumbnail_variants: [],
    cost_estimate: null,
    fact_checked_by: null,
    youtube_video_id: null,
    review_notes: [],
    performance_snapshots: [],
  })
}

function briefMarkdown(pilot: VideoPilotDefinition) {
  return `# ${pilot.title}

## Audience

${pilot.audience}

## Pain

${pilot.questionOrPain}

## Hypothesis

${pilot.hypothesis}

## Production direction

- Format: ${pilot.formatFamily.replaceAll('_', ' ')}
- Visual family: ${pilot.visualFamily}
- Orientation: ${pilot.orientation}
- Target: ${pilot.durationTargetSeconds} seconds
- CTA: ${pilot.ctaLabel} → ${pilot.ctaUrl}

## Claim boundaries

${pilot.claimNotes.map((note) => `- ${note}`).join('\n')}`
}

function scriptMarkdown(pilot: VideoPilotDefinition) {
  const wordCount = pilot.scriptText.trim().split(/\s+/).length
  return `# ${pilot.title}

Status: review required

Target duration: ${pilot.durationTargetSeconds} seconds

Word count: ${wordCount}

## Script

${pilot.scriptText}

## Critical on-screen text

${pilot.criticalOnScreenText.map((text) => `- ${text}`).join('\n')}

## Review checklist

- Brand and master-platform framing
- Exact claims and limitations
- Rights and fictional-scene clarity
- Synthetic-media disclosure when required
- CTA and destination`
}

export function buildPilotAssetPayloads(pilot: VideoPilotDefinition) {
  const expectedAspect = pilot.orientation === 'portrait' ? '9:16' : '16:9'
  if (VESTBLOCK_HEYGEN_STYLE_ASPECTS[pilot.styleId] !== expectedAspect) {
    throw new Error(
      `HeyGen style ${pilot.styleName} does not match ${pilot.orientation} orientation.`
    )
  }
  const briefMetadata = metadataForPilot(pilot, 'video_brief')
  const scriptMetadata = metadataForPilot(pilot, 'video_script')

  return {
    brief: {
      title: `${pilot.title} — Brief`,
      slug: `${pilot.slug}-brief`,
      content_type: 'video_brief' as const,
      service_key: pilot.serviceKey,
      language: 'en',
      audience: pilot.audience,
      prompt: 'VestBlock governed video pilot brief.',
      status: 'draft' as const,
      approval_status: 'not_required' as const,
      platform: pilot.platform,
      post_type: pilot.formatFamily,
      body_markdown: briefMarkdown(pilot),
      cta_label: pilot.ctaLabel,
      cta_url: pilot.ctaUrl,
      metadata_json: briefMetadata,
    },
    script: {
      title: `${pilot.title} — Script`,
      slug: `${pilot.slug}-script`,
      content_type: 'video_script' as const,
      service_key: pilot.serviceKey,
      language: 'en',
      audience: pilot.audience,
      prompt: 'VestBlock governed video pilot script.',
      status: 'draft' as const,
      approval_status: 'review_required' as const,
      platform: pilot.platform,
      post_type: pilot.formatFamily,
      body_markdown: scriptMarkdown(pilot),
      cta_label: pilot.ctaLabel,
      cta_url: pilot.ctaUrl,
      metadata_json: scriptMetadata,
    },
  }
}

export function buildHeyGenRendererPrompt(input: {
  metadata: VideoMetadata
  approvalStatus: VideoApprovalStatus
}) {
  if (input.metadata.asset_kind !== 'video_script') {
    throw new Error('Only a video script can become a renderer prompt.')
  }
  if (input.approvalStatus !== 'approved') {
    throw new Error('Script approval is required before renderer prompt creation.')
  }
  if (!input.metadata.script_text) {
    throw new Error('The approved video script is empty.')
  }

  const mediaDirection =
    input.metadata.format_family === 'drawn_explainer'
      ? 'Use motion graphics and handmade diagram visuals. Do not use a visible presenter.'
      : input.metadata.format_family === 'hyper_real_scenario'
        ? 'Use clearly fictional AI-generated scenario footage and licensed stock media. Do not imply that any depicted person is a real customer.'
        : input.metadata.format_family === 'hybrid'
          ? 'Use fictional scenario footage for the problem, then clean motion graphics for the explanation. Do not use real customer data.'
          : 'Use motion graphics and context-appropriate licensed stock media. Do not use a visible presenter.'

  return `Voice-over narration only. Create one ${input.metadata.duration_target_seconds}-second ${input.metadata.orientation} video about one idea.

Audience: ${input.metadata.persona}
Tone: clear, calm, credible, and practical. Never hype the outcome.

SCRIPT CONCEPT
${input.metadata.script_text}

CRITICAL ON-SCREEN TEXT
${input.metadata.critical_on_screen_text.map((text) => `- ${text}`).join('\n')}

This script is a concept and theme to convey — not a verbatim transcript. You have full creative freedom to expand, elaborate, add examples, and fill the duration naturally. Do not pad with silence or pauses.

${mediaDirection}

STYLE — VESTBLOCK MATERIAL LEDGER
Graphite, warm ivory, and restrained electric lime. Premium paper, dossier, ledger, blueprint, and tabbed-record motifs. Typography is part of the composition. Use one strong focal point per scene, deliberate pacing, clean cuts, and readable captions. Keep Capital, Deals, Opportunity, and DealVault visually connected when they appear. Avoid generic blue fintech visuals, fake dashboards, fake customer proof, money rain, approval stamps, or exaggerated success imagery.

Preferred HeyGen style: ${input.metadata.style_name || 'Blueprint'}.`
}

const APPROVAL_TRANSITIONS: Record<VideoApprovalStatus, VideoApprovalStatus[]> = {
  not_required: ['review_required'],
  review_required: ['approved', 'changes_requested', 'rejected'],
  approved: ['changes_requested'],
  changes_requested: ['review_required', 'rejected'],
  rejected: ['review_required'],
}

export function assertVideoApprovalTransition(
  current: VideoApprovalStatus,
  next: VideoApprovalStatus
) {
  if (current === next) return
  if (!APPROVAL_TRANSITIONS[current].includes(next)) {
    throw new Error(`Video approval cannot move from ${current} to ${next}.`)
  }
}

export function isVideoPublishReady(row: VideoContentAssetRow) {
  if (row.content_type !== 'video_render') return false
  if (row.approval_status !== 'approved') return false

  const parsed = videoMetadataSchema.safeParse(row.metadata_json || {})
  if (!parsed.success) return false
  const metadata = parsed.data

  return (
    metadata.render_status === 'completed' &&
    Boolean(metadata.render_url) &&
    metadata.compliance_review_status === 'approved' &&
    metadata.rights_review_status === 'approved' &&
    metadata.synthetic_media_disclosure !== 'required'
  )
}

export type VideoPerformanceSnapshot = {
  contentId: string
  hypothesisKey: string
  pillar: z.infer<typeof videoPillarSchema>
  formatFamily: z.infer<typeof videoFormatSchema>
  language: 'en' | 'es'
  trafficSource: string
  window: z.infer<typeof videoWindowSchema>
  simulated: boolean
  nativeConcurrentExperiment?: boolean
  views: number
  averagePercentageViewed?: number | null
  ctaClicks?: number | null
}

export const videoPerformanceSnapshotSchema: z.ZodType<VideoPerformanceSnapshot> = z.object({
  contentId: z.string().min(1).max(240),
  hypothesisKey: z.string().min(1).max(240),
  pillar: videoPillarSchema,
  formatFamily: videoFormatSchema,
  language: z.enum(['en', 'es']),
  trafficSource: z.string().min(1).max(160),
  window: videoWindowSchema,
  simulated: z.boolean(),
  nativeConcurrentExperiment: z.boolean().optional(),
  views: z.number().int().min(0),
  averagePercentageViewed: z.number().min(0).max(100).nullable().optional(),
  ctaClicks: z.number().int().min(0).nullable().optional(),
})

export type VideoLearningProposal = {
  hypothesisKey: string
  eligible: boolean
  confidence: 'low' | 'medium' | 'high'
  comparableAssets: number
  windows: Array<z.infer<typeof videoWindowSchema>>
  reason: string
}

export function evaluateVideoLearning(
  snapshots: VideoPerformanceSnapshot[]
): VideoLearningProposal[] {
  const real = snapshots.filter((snapshot) => !snapshot.simulated)
  const hypotheses = new Map<string, VideoPerformanceSnapshot[]>()

  for (const snapshot of real) {
    const rows = hypotheses.get(snapshot.hypothesisKey) || []
    rows.push(snapshot)
    hypotheses.set(snapshot.hypothesisKey, rows)
  }

  return [...hypotheses.entries()].map(([hypothesisKey, rows]) => {
    const nativeExperiment = rows.some((row) => row.nativeConcurrentExperiment)
    const comparableGroups = new Map<string, VideoPerformanceSnapshot[]>()

    for (const row of rows) {
      const key = [row.pillar, row.formatFamily, row.language, row.trafficSource, row.window].join('|')
      const group = comparableGroups.get(key) || []
      group.push(row)
      comparableGroups.set(key, group)
    }

    const qualifyingWindows = new Set<z.infer<typeof videoWindowSchema>>()
    const comparableIds = new Set<string>()
    for (const group of comparableGroups.values()) {
      const ids = new Set(group.map((row) => row.contentId))
      if (ids.size < 5) continue
      group.forEach((row) => comparableIds.add(row.contentId))
      qualifyingWindows.add(group[0].window)
    }

    const eligible = nativeExperiment || qualifyingWindows.size >= 2
    const observationCount = new Set(rows.map((row) => row.contentId)).size

    return {
      hypothesisKey,
      eligible,
      confidence: eligible ? (nativeExperiment ? 'high' : 'medium') : 'low',
      comparableAssets: comparableIds.size || observationCount,
      windows: [...qualifyingWindows],
      reason: nativeExperiment
        ? 'A native concurrent experiment can support a reviewed default change.'
        : eligible
          ? 'At least five comparable real assets repeated the pattern across two measurement windows.'
          : observationCount >= 2
            ? 'The evidence may create an insight, but it cannot change a default yet.'
            : 'More real, comparable observations are required.',
    }
  })
}

export type VideoContentSnapshot = {
  briefs: number
  scripts: number
  renders: number
  awaitingApproval: number
  readyToRender: number
  rendering: number
  privateRenders: number
  published: number
  nextBottleneck: string
  queue: Array<{
    id: string
    title: string
    contentType: VideoContentType
    status: string
    approvalStatus: VideoApprovalStatus
    pillar: string
    format: string
    bodyMarkdown: string
    updatedAt: string | null
  }>
}

export function buildVideoContentSnapshot(rows: VideoContentAssetRow[]): VideoContentSnapshot {
  const videos = rows.filter((row) => VIDEO_CONTENT_TYPES.includes(row.content_type as VideoContentType))
  const parsed = videos.map((row) => {
    const metadata = videoMetadataSchema.safeParse(row.metadata_json || {})
    return { row, metadata: metadata.success ? metadata.data : null }
  })
  const awaitingApproval = parsed.filter((item) => item.row.approval_status === 'review_required').length
  const readyToRender = parsed.filter(
    (item) =>
      item.row.content_type === 'video_script' &&
      item.row.status === 'ready' &&
      item.row.approval_status === 'approved'
  ).length
  const rendering = parsed.filter((item) =>
    ['queued', 'rendering'].includes(item.metadata?.render_status || '')
  ).length
  const privateRenders = parsed.filter(
    (item) => item.row.content_type === 'video_render' && item.metadata?.publication_status === 'private'
  ).length
  const published = parsed.filter(
    (item) => item.row.content_type === 'video_render' && item.row.status === 'published'
  ).length

  const nextBottleneck = awaitingApproval
    ? `${awaitingApproval} video asset${awaitingApproval === 1 ? '' : 's'} awaiting review.`
    : readyToRender
      ? `${readyToRender} approved script${readyToRender === 1 ? '' : 's'} ready for a private render.`
      : privateRenders
        ? `${privateRenders} private render${privateRenders === 1 ? '' : 's'} awaiting final review.`
        : videos.length
          ? 'Create or approve the next script.'
          : 'Seed the four-video pilot batch.'

  return {
    briefs: videos.filter((row) => row.content_type === 'video_brief').length,
    scripts: videos.filter((row) => row.content_type === 'video_script').length,
    renders: videos.filter((row) => row.content_type === 'video_render').length,
    awaitingApproval,
    readyToRender,
    rendering,
    privateRenders,
    published,
    nextBottleneck,
    queue: parsed
      .filter(({ row }) => row.content_type !== 'video_brief')
      .sort(
        (a, b) =>
          Date.parse(b.row.updated_at || b.row.created_at || '') -
          Date.parse(a.row.updated_at || a.row.created_at || '')
      )
      .slice(0, 8)
      .map(({ row, metadata }) => ({
        id: row.id,
        title: row.title,
        contentType: row.content_type as VideoContentType,
        status: row.status,
        approvalStatus: row.approval_status || 'not_required',
        pillar: metadata?.pillar || 'unknown',
        format: metadata?.format_family || row.post_type || 'unknown',
        bodyMarkdown: row.body_markdown || '',
        updatedAt: row.updated_at || row.created_at || null,
      })),
  }
}
