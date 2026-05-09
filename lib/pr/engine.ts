import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { getOpenAIClient } from '@/lib/openai-server'
import { discoverPrTargetDestination } from '@/lib/pr/destinationDiscovery'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import type { TargetMarketRecord } from '@/lib/leads/types'
import type {
  PrActivityStatus,
  PrActivityType,
  PrAngleTemplate,
  PrDashboardSummary,
  PrDiscoverySource,
  PrDraftStatus,
  PrEngineDashboard,
  PrLearningSnapshotRecord,
  PrOutreachRecord,
  PrPitchChannel,
  PrPitchDraftRecord,
  PrPriority,
  PrRunRecord,
  PrRunType,
  PrTargetCategory,
  PrTargetRecord,
  PrTargetStatus,
  PrTargetType,
} from '@/lib/pr/types'

type AdminClient = ReturnType<typeof createAdminClient>

type UpsertTargetInput = {
  id?: string
  label?: string
  organizationName?: string | null
  contactName?: string | null
  contactEmail?: string | null
  targetType?: PrTargetType
  targetCategory?: PrTargetCategory
  audienceType?: string | null
  audienceUrl?: string | null
  submissionUrl?: string | null
  city?: string | null
  state?: string | null
  metroArea?: string | null
  discoverySource?: PrDiscoverySource
  sourceQuery?: string | null
  status?: PrTargetStatus
  priority?: PrPriority
  fitScore?: number | null
  revenueScore?: number | null
  authorityScore?: number | null
  responseProbabilityScore?: number | null
  businessAudienceScore?: number | null
  backlinkScore?: number | null
  fundingAngleScore?: number | null
  cityPriorityScore?: number | null
  geography?: string[] | string | null
  angleTags?: string[] | string | null
  notes?: string | null
  nextFollowUpAt?: string | null
  lastResult?: string | null
  metadata?: Record<string, unknown>
  ownerUserId?: string | null
  actorUserId?: string | null
}

type GeneratePitchInput = {
  targetId: string
  pitchChannel?: PrPitchChannel
  angle?: string | null
  customPrompt?: string | null
  actorUserId?: string | null
}

type UpdateDraftInput = {
  id: string
  title?: string
  subjectLine?: string | null
  previewText?: string | null
  bodyMarkdown?: string
  founderBio?: string | null
  keyPoints?: string[] | string | null
  callToAction?: string | null
  status?: PrDraftStatus
  actorUserId?: string | null
}

type LogOutreachInput = {
  targetId: string
  draftId?: string | null
  activityType?: PrActivityType
  channel?: PrPitchChannel | 'other'
  status?: PrActivityStatus
  subject?: string | null
  messageExcerpt?: string | null
  destination?: string | null
  sentAt?: string | null
  respondedAt?: string | null
  nextFollowUpAt?: string | null
  outcome?: string | null
  metadata?: Record<string, unknown>
  actorUserId?: string | null
}

type UpdateOutreachInput = {
  id: string
  status?: PrActivityStatus
  subject?: string | null
  messageExcerpt?: string | null
  respondedAt?: string | null
  nextFollowUpAt?: string | null
  outcome?: string | null
  actorUserId?: string | null
}

type DiscoverySeed = {
  key: string
  targetType: PrTargetType
  targetCategory: PrTargetCategory
  audienceType: string
  audienceLabel: string
  angleTags: string[]
  baseRevenueScore: number
  baseAuthorityScore: number
  baseResponseProbabilityScore: number
  baseBusinessAudienceScore: number
  baseBacklinkScore: number
  baseFundingAngleScore: number
  notes: string
}

type DiscoveryTargetRow = {
  dedupe_key: string
  label: string
  organization_name: string | null
  contact_name: string | null
  contact_email: string | null
  target_type: PrTargetType
  target_category: PrTargetCategory
  audience_type: string | null
  audience_url: string | null
  submission_url: string | null
  city: string | null
  state: string | null
  metro_area: string | null
  discovery_source: PrDiscoverySource
  source_query: string | null
  status: PrTargetStatus
  priority: PrPriority
  fit_score: number
  revenue_score: number
  authority_score: number
  response_probability_score: number
  business_audience_score: number
  backlink_score: number
  funding_angle_score: number
  city_priority_score: number
  owner_user_id: string | null
  geography: string[]
  angle_tags: string[]
  notes: string | null
  metadata_json: Record<string, unknown>
  next_follow_up_at: string | null
  last_result: string | null
}

type LearningMetrics = {
  sent: number
  replied: number
  wins: number
  ignored: number
}

const categoryRevenueBias: Record<PrTargetCategory, number> = {
  minority_business: 77,
  hispanic_business: 79,
  black_business: 78,
  women_owned_business: 73,
  immigrant_business: 76,
  local_small_business: 72,
  chamber: 74,
  startup: 61,
  fintech: 66,
  automation: 68,
  government_contracting: 71,
}

const categoryAngleMap: Record<PrTargetCategory, string[]> = {
  minority_business: ['visibility-expansion-systems', 'ai-local-demand'],
  hispanic_business: ['visibility-expansion-systems', 'ai-local-demand'],
  black_business: ['visibility-expansion-systems', 'ai-local-demand'],
  women_owned_business: ['visibility-expansion-systems', 'ai-local-demand'],
  immigrant_business: ['visibility-expansion-systems', 'ai-local-demand'],
  local_small_business: ['real-estate-operator-accountability', 'visibility-expansion-systems'],
  chamber: ['real-estate-operator-accountability', 'visibility-expansion-systems'],
  startup: ['operator-playbooks', 'ai-local-demand'],
  fintech: ['ai-local-demand', 'operator-playbooks'],
  automation: ['ai-local-demand', 'operator-playbooks'],
  government_contracting: ['government-readiness', 'operator-playbooks'],
}

const prAngleLibrary: PrAngleTemplate[] = [
  {
    id: 'visibility-expansion-systems',
    label: 'Search visibility services',
    description:
      'Position VestBlock as a premium visibility, PR, and AI-answer growth service for customer-focused businesses.',
    use_case:
      'Great for chambers, local business ecosystems, community newsletters, and small-business coverage.',
    ideal_targets: ['chamber', 'newsletter', 'group', 'community'],
    target_categories: [
      'minority_business',
      'hispanic_business',
      'black_business',
      'women_owned_business',
      'immigrant_business',
      'chamber',
    ],
    sample_hooks: [
      'Why small businesses need visibility systems instead of vague marketing retainers',
      'What answer-engine and local authority growth look like when they have to drive revenue',
    ],
  },
  {
    id: 'real-estate-operator-accountability',
    label: 'Real estate operator accountability',
    description:
      'Lead with DealVault as workflow infrastructure for agreement tracking, payout accountability, proof records, and milestone trails.',
    use_case:
      'Works well for small-business media, chambers, proptech angles, contractor ecosystems, and operator-focused real estate audiences.',
    ideal_targets: ['newsletter', 'journalist', 'partner', 'directory'],
    target_categories: [
      'local_small_business',
      'chamber',
      'automation',
      'startup',
    ],
    sample_hooks: [
      'How small real estate businesses can track agreements and payouts without exposing sensitive documents on-chain',
      'Why contractor milestones and partner splits need a cleaner audit trail',
    ],
  },
  {
    id: 'ai-local-demand',
    label: 'AI local demand engine',
    description:
      'Talk about automated SEO, content, and lead capture as a real growth engine rather than vanity marketing.',
    use_case:
      'Fits tech, startup, automation, local business, and RevOps-style publications that care about real outcomes.',
    ideal_targets: ['journalist', 'podcast', 'newsletter', 'expert_source'],
    target_categories: ['automation', 'startup', 'fintech', 'local_small_business'],
    sample_hooks: [
      'Why local growth automation should be measured like a revenue pipeline',
      'What AI-driven demand gen looks like when it has to pay for itself',
    ],
  },
  {
    id: 'government-readiness',
    label: 'Government opportunity readiness',
    description:
      'Use SAM intelligence and readiness framing to pitch public-sector growth and contracting coverage.',
    use_case:
      'Good for gov contracting newsletters, supplier diversity groups, procurement media, and public-sector channels.',
    ideal_targets: ['newsletter', 'group', 'journalist', 'partner'],
    target_categories: ['government_contracting', 'minority_business', 'chamber'],
    sample_hooks: [
      'How smaller firms can stop missing high-fit contract opportunities',
      'What to automate before chasing public-sector deal flow',
    ],
  },
  {
    id: 'operator-playbooks',
    label: 'Underserved founder growth systems',
    description:
      'Offer tactical playbooks, templates, and operator lessons from running daily growth automation.',
    use_case:
      'Strong for podcasts, expert-source platforms, startup communities, and founder-focused newsletters.',
    ideal_targets: ['podcast', 'expert_source', 'community', 'journalist'],
    target_categories: ['startup', 'automation', 'fintech', 'local_small_business'],
    sample_hooks: [
      'The daily operating rhythm behind a lean demand engine',
      'How small teams can automate follow-up without sounding robotic',
    ],
  },
]

const discoverySeeds: DiscoverySeed[] = [
  {
    key: 'minority-business-newsletter',
    targetType: 'newsletter',
    targetCategory: 'minority_business',
    audienceType: 'minority-owned SMB audience',
    audienceLabel: 'minority business newsletter',
    angleTags: ['visibility-expansion-systems', 'ai-local-demand'],
    baseRevenueScore: 82,
    baseAuthorityScore: 68,
    baseResponseProbabilityScore: 58,
    baseBusinessAudienceScore: 86,
    baseBacklinkScore: 60,
    baseFundingAngleScore: 85,
    notes: 'Visibility target for practical growth systems and local business traction.',
  },
  {
    key: 'hispanic-business-newsletter',
    targetType: 'newsletter',
    targetCategory: 'hispanic_business',
    audienceType: 'Hispanic business audience',
    audienceLabel: 'Hispanic business newsletter',
    angleTags: ['visibility-expansion-systems', 'ai-local-demand'],
    baseRevenueScore: 83,
    baseAuthorityScore: 67,
    baseResponseProbabilityScore: 59,
    baseBusinessAudienceScore: 87,
    baseBacklinkScore: 58,
    baseFundingAngleScore: 86,
    notes: 'Strong fit for bilingual growth-system and operator-support positioning.',
  },
  {
    key: 'black-business-roundup',
    targetType: 'group',
    targetCategory: 'black_business',
    audienceType: 'Black-owned business community',
    audienceLabel: 'Black business roundup',
    angleTags: ['visibility-expansion-systems', 'ai-local-demand'],
    baseRevenueScore: 81,
    baseAuthorityScore: 64,
    baseResponseProbabilityScore: 57,
    baseBusinessAudienceScore: 85,
    baseBacklinkScore: 55,
    baseFundingAngleScore: 84,
    notes: 'Prioritize trust, clearer growth systems, and practical operator outcomes.',
  },
  {
    key: 'women-owned-business-channel',
    targetType: 'community',
    targetCategory: 'women_owned_business',
    audienceType: 'women-owned business ecosystem',
    audienceLabel: 'women-owned business feature outlet',
    angleTags: ['visibility-expansion-systems', 'ai-local-demand'],
    baseRevenueScore: 76,
    baseAuthorityScore: 63,
    baseResponseProbabilityScore: 55,
    baseBusinessAudienceScore: 82,
    baseBacklinkScore: 54,
    baseFundingAngleScore: 81,
    notes: 'Good fit for readiness stories, operator systems, and service-driven growth.',
  },
  {
    key: 'immigrant-business-channel',
    targetType: 'community',
    targetCategory: 'immigrant_business',
    audienceType: 'immigrant founder audience',
    audienceLabel: 'immigrant business channel',
    angleTags: ['visibility-expansion-systems', 'ai-local-demand'],
    baseRevenueScore: 79,
    baseAuthorityScore: 62,
    baseResponseProbabilityScore: 55,
    baseBusinessAudienceScore: 84,
    baseBacklinkScore: 54,
    baseFundingAngleScore: 82,
    notes: 'Helpful when local markets show diverse founder demand or Spanish-business signals.',
  },
  {
    key: 'small-business-newsletter',
    targetType: 'newsletter',
    targetCategory: 'local_small_business',
    audienceType: 'local small business owners',
    audienceLabel: 'small business newsletter',
    angleTags: ['real-estate-operator-accountability', 'visibility-expansion-systems'],
    baseRevenueScore: 80,
    baseAuthorityScore: 70,
    baseResponseProbabilityScore: 61,
    baseBusinessAudienceScore: 88,
    baseBacklinkScore: 63,
    baseFundingAngleScore: 81,
    notes: 'High-fit target for operator-accountability stories, business-owner traffic, and local authority.',
  },
  {
    key: 'local-chamber',
    targetType: 'chamber',
    targetCategory: 'chamber',
    audienceType: 'chamber members and local SMBs',
    audienceLabel: 'chamber ecosystem',
    angleTags: ['real-estate-operator-accountability', 'visibility-expansion-systems'],
    baseRevenueScore: 81,
    baseAuthorityScore: 72,
    baseResponseProbabilityScore: 58,
    baseBusinessAudienceScore: 89,
    baseBacklinkScore: 65,
    baseFundingAngleScore: 84,
    notes: 'Good channel for local trust, referral partnerships, and premium operator-story reach.',
  },
  {
    key: 'automation-podcast',
    targetType: 'podcast',
    targetCategory: 'automation',
    audienceType: 'automation and ops operators',
    audienceLabel: 'automation podcast',
    angleTags: ['ai-local-demand', 'operator-playbooks'],
    baseRevenueScore: 64,
    baseAuthorityScore: 62,
    baseResponseProbabilityScore: 54,
    baseBusinessAudienceScore: 63,
    baseBacklinkScore: 44,
    baseFundingAngleScore: 58,
    notes: 'Good for authority and partnerships, but lower direct revenue bias than SMB channels.',
  },
  {
    key: 'startup-fintech-publication',
    targetType: 'journalist',
    targetCategory: 'fintech',
    audienceType: 'startup and fintech audience',
    audienceLabel: 'fintech or startup publication',
    angleTags: ['ai-local-demand', 'operator-playbooks'],
    baseRevenueScore: 62,
    baseAuthorityScore: 70,
    baseResponseProbabilityScore: 47,
    baseBusinessAudienceScore: 58,
    baseBacklinkScore: 59,
    baseFundingAngleScore: 50,
    notes: 'Useful for narrative shaping, but should not outrank business-owner channels.',
  },
  {
    key: 'expert-source-network',
    targetType: 'expert_source',
    targetCategory: 'automation',
    audienceType: 'expert quote network',
    audienceLabel: 'expert quote network',
    angleTags: ['operator-playbooks', 'visibility-expansion-systems'],
    baseRevenueScore: 58,
    baseAuthorityScore: 66,
    baseResponseProbabilityScore: 72,
    baseBusinessAudienceScore: 52,
    baseBacklinkScore: 38,
    baseFundingAngleScore: 56,
    notes: 'Fast-response channel for authority-building and quick earned media.',
  },
  {
    key: 'government-contracting-newsletter',
    targetType: 'newsletter',
    targetCategory: 'government_contracting',
    audienceType: 'government contracting audience',
    audienceLabel: 'government contracting newsletter',
    angleTags: ['government-readiness', 'operator-playbooks'],
    baseRevenueScore: 73,
    baseAuthorityScore: 64,
    baseResponseProbabilityScore: 53,
    baseBusinessAudienceScore: 69,
    baseBacklinkScore: 51,
    baseFundingAngleScore: 74,
    notes: 'Good for Gov Contract Readiness, especially when SAM and supplier diversity angles align.',
  },
]

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[]
}

function listify(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function clampScore(value: number | null | undefined, fallback = 50) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0, Math.min(100, Math.round(value)))
}

function safeString(value?: string | null) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function excerpt(value: string | null | undefined, limit = 320) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit - 1).trim()}…`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDedupeKey(parts: Array<string | null | undefined>) {
  return slugify(parts.filter(Boolean).join('|'))
}

function nowPlusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function choosePriority(value: number): PrPriority {
  if (value >= 88) return 'urgent'
  if (value >= 75) return 'high'
  if (value >= 55) return 'normal'
  return 'low'
}

function chooseTargetStatus(fitScore: number): PrTargetStatus {
  if (fitScore >= 72) return 'ready'
  if (fitScore >= 56) return 'researching'
  return 'new'
}

function sourceQuery(city: string, state: string, seed: DiscoverySeed) {
  return `"${city} ${state}" ${seed.audienceLabel}`
}

function audienceUrlFromQuery(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function selectAnglesForCategory(category: PrTargetCategory, extra: string[] = []) {
  return Array.from(new Set([...(categoryAngleMap[category] || []), ...extra])).slice(0, 3)
}

function computeFitScore(input: {
  cityPriorityScore: number
  revenueScore: number
  authorityScore: number
  responseProbabilityScore: number
  businessAudienceScore: number
  backlinkScore: number
  fundingAngleScore: number
}) {
  return clampScore(
    input.cityPriorityScore * 0.18 +
      input.revenueScore * 0.22 +
      input.authorityScore * 0.11 +
      input.responseProbabilityScore * 0.14 +
      input.businessAudienceScore * 0.18 +
      input.backlinkScore * 0.07 +
      input.fundingAngleScore * 0.1
  )
}

function getPreferredPitchChannel(target: PrTargetRecord): PrPitchChannel {
  if (target.target_type === 'directory') return 'application'
  if (target.target_type === 'expert_source') return 'quote'
  if (target.target_type === 'podcast') return 'email'
  return 'email'
}

function bestImmediateMove(summary: PrDashboardSummary, targets: PrTargetRecord[]) {
  const highestReady = [...targets]
    .filter((target) => ['ready', 'follow_up_due', 'submitted'].includes(target.status))
    .sort((a, b) => b.fit_score - a.fit_score)[0]

  if (summary.followUpDue > 0 && highestReady) {
    return `Follow up on ${highestReady.label} in ${highestReady.city || highestReady.state || 'the active queue'} before expanding lower-fit visibility work.`
  }

  if (summary.approvedDrafts > 0) {
    return 'Send approved PR drafts first so the learning loop gets fresh signal this week.'
  }

  if (highestReady) {
    return `Generate and approve copy for ${highestReady.label}; it is the strongest unsent PR target in the queue.`
  }

  return 'Expand into the next high-fit city batch and seed minority-business plus chamber channels first.'
}

function fallbackPitch(target: PrTargetRecord, input: GeneratePitchInput) {
  const angle =
    prAngleLibrary.find((item) => item.id === input.angle) ??
    prAngleLibrary.find((item) => target.angle_tags.includes(item.id)) ??
    prAngleLibrary[0]
  const cityLabel = [target.city, target.state].filter(Boolean).join(', ')
  const locationPhrase = cityLabel ? ` in ${cityLabel}` : ''
  const audienceLabel = target.audience_type || target.target_category.replaceAll('_', ' ')
  const firstName = target.contact_name?.split(' ')[0] || 'there'
  const pitchChannel = input.pitchChannel || getPreferredPitchChannel(target)
  const title = `${angle.label} ${pitchChannel} pitch for ${target.label}`
  const subjectLine = `Story idea for ${target.label}: ${angle.sample_hooks[0]}`
  const previewText = `A practical VestBlock angle tailored for ${target.label}${locationPhrase}.`
  const bodyMarkdown = [
    `Hi ${firstName},`,
    '',
    `I run VestBlock, where we help operator-led businesses tighten agreement workflows, improve follow-up, and build demand systems that create real deal flow instead of vanity traffic.`,
    '',
    `I thought your ${audienceLabel}${locationPhrase} audience could be a strong fit for a practical angle around **${angle.label.toLowerCase()}**.`,
    '',
    `A few directions we can make useful right away:`,
    `- ${angle.sample_hooks[0]}`,
    `- ${angle.sample_hooks[1]}`,
    `- How operators can create momentum without adding bloated software or generic advice`,
    '',
    `If useful, I can send a shorter founder quote, a contributed outline, or a version tailored to ${target.city || 'your local market'}.`,
    '',
    `Best,`,
    `VestBlock`,
  ].join('\n')

  return {
    title,
    subjectLine,
    previewText,
    bodyMarkdown,
    founderBio:
      'VestBlock helps operator-led businesses tighten agreement workflows, automate follow-up, and build growth systems tied to real revenue outcomes.',
    keyPoints: angle.sample_hooks,
    callToAction: 'Happy to send a shorter founder quote, Q&A answer, or custom outline if useful.',
    sourcePrompt: `Fallback PR template using ${angle.id}.`,
    model: 'template_fallback',
  }
}

async function generatePitchWithAi(target: PrTargetRecord, input: GeneratePitchInput) {
  const openai = getOpenAIClient()
  if (!openai) return fallbackPitch(target, input)

  const angle =
    prAngleLibrary.find((item) => item.id === input.angle) ??
    prAngleLibrary.find((item) => target.angle_tags.includes(item.id)) ??
    prAngleLibrary[0]
  const preferredOutput =
    target.target_type === 'expert_source'
      ? 'short founder quote'
      : target.target_type === 'podcast'
        ? 'podcast pitch'
        : target.target_type === 'directory'
          ? 'application answer'
          : 'email pitch'

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
    temperature: 0.35,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You write concise, practical PR outreach for a revenue-minded growth company. Return valid JSON with keys title, subjectLine, previewText, bodyMarkdown, founderBio, keyPoints, callToAction. Keep it human, specific, and non-spammy.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          company: 'VestBlock',
          target,
          preferredOutput,
          angle,
          customPrompt: input.customPrompt || '',
          instructions: [
            'Emphasize useful operator insight, DealVault agreement accountability, visibility expansion systems, or AI-driven responsiveness.',
            'Do not sound like a press release.',
            'Keep the message short enough to actually send.',
            'Mention city relevance when it strengthens the angle.',
            'Optimize for trust, clarity, and fast yes/no response.',
          ],
        }),
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) return fallbackPitch(target, input)

  try {
    const parsed = JSON.parse(content)
    return {
      title: String(parsed.title || fallbackPitch(target, input).title),
      subjectLine: excerpt(parsed.subjectLine, 180),
      previewText: excerpt(parsed.previewText, 200),
      bodyMarkdown: String(parsed.bodyMarkdown || fallbackPitch(target, input).bodyMarkdown),
      founderBio: excerpt(parsed.founderBio, 420),
      keyPoints: listify(parsed.keyPoints),
      callToAction: excerpt(parsed.callToAction, 260),
      sourcePrompt: excerpt(input.customPrompt || angle.description, 800),
      model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
    }
  } catch {
    return fallbackPitch(target, input)
  }
}

async function createPrRun(input: {
  runType: PrRunType
  city?: string | null
  state?: string | null
  targetCategory?: PrTargetCategory | null
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pr_runs')
    .insert({
      run_type: input.runType,
      status: 'running',
      city: input.city || null,
      state: input.state || null,
      target_category: input.targetCategory || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as PrRunRecord
}

async function finishPrRun(
  runId: string,
  input: {
    status: 'completed' | 'partial' | 'failed'
    summary: Record<string, unknown>
    createdTargetCount?: number
    createdDraftCount?: number
    createdTaskCount?: number
    errorMessage?: string | null
  }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pr_runs')
    .update({
      status: input.status,
      summary_json: input.summary,
      created_target_count: input.createdTargetCount ?? 0,
      created_draft_count: input.createdDraftCount ?? 0,
      created_task_count: input.createdTaskCount ?? 0,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as PrRunRecord
}

async function insertLearningSnapshots(
  rows: Array<{
    runId?: string | null
    snapshotType: 'angle' | 'category' | 'city' | 'operator'
    angleKey?: string | null
    targetCategory?: PrTargetCategory | null
    city?: string | null
    state?: string | null
    metrics: Record<string, unknown>
    recommendation?: string | null
  }>
) {
  if (!rows.length) return [] as PrLearningSnapshotRecord[]
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pr_learning_snapshots')
    .insert(
      rows.map((row) => ({
        run_id: row.runId || null,
        snapshot_type: row.snapshotType,
        angle_key: row.angleKey || null,
        target_category: row.targetCategory || null,
        city: row.city || null,
        state: row.state || null,
        metrics_json: row.metrics,
        recommendation: row.recommendation || null,
      }))
    )
    .select('*')

  if (error) throw new Error(error.message)
  return (data || []) as PrLearningSnapshotRecord[]
}

async function listPriorityMarkets(limit = 8) {
  const admin = createAdminClient()
  const { data: markets, error } = await admin
    .from('target_markets')
    .select('*')
    .in('status', ['active', 'queued', 'scraped'])
    .order('final_score', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (markets || []) as TargetMarketRecord[]
}

async function listFallbackCities(limit = 6) {
  const admin = createAdminClient()
  const { data: leads, error } = await admin
    .from('leads')
    .select('city,state,lead_score,best_offer,language_segment')
    .not('city', 'is', null)
    .not('state', 'is', null)
    .order('lead_score', { ascending: false, nullsFirst: false })
    .limit(300)

  if (error) throw new Error(error.message)

  const cityMap = new Map<string, { city: string; state: string; final_score: number; niche_focus: string[] }>()
  for (const lead of leads || []) {
    const key = `${lead.city}|${lead.state}`
    const current = cityMap.get(key) || {
      city: lead.city as string,
      state: lead.state as string,
      final_score: 0,
      niche_focus: [],
    }
    current.final_score += Number(lead.lead_score || 0)
    if (lead.best_offer) current.niche_focus.push(String(lead.best_offer))
    if (lead.language_segment) current.niche_focus.push(String(lead.language_segment))
    cityMap.set(key, current)
  }

  return Array.from(cityMap.values())
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, limit)
}

async function getCityDiscoveryContext(limit = 8) {
  const markets = await listPriorityMarkets(limit)
  if (markets.length) {
    return markets.map((market) => ({
      city: market.city,
      state: market.state,
      metroArea: market.metro_area,
      marketScore: clampScore(market.final_score / 2, 60),
      rawMarketScore: market.final_score,
      nicheFocus: market.niche_focus || [],
    }))
  }

  const fallback = await listFallbackCities(limit)
  return fallback.map((market) => ({
    city: market.city,
    state: market.state,
    metroArea: null,
    marketScore: clampScore(market.final_score / 5, 58),
    rawMarketScore: market.final_score,
    nicheFocus: market.niche_focus || [],
  }))
}

function pickCategoriesForCity(input: {
  city: string
  state: string
  nicheFocus: string[]
}) {
  const picks: PrTargetCategory[] = ['local_small_business', 'chamber']
  const haystack = `${input.city} ${input.state} ${input.nicheFocus.join(' ')}`.toLowerCase()

  if (/(spanish|hispanic|latino|bilingual)/.test(haystack)) picks.push('hispanic_business')
  if (/(government|contract|procurement|sam)/.test(haystack)) picks.push('government_contracting')
  if (/(startup|llc|tech|automation|ai)/.test(haystack)) picks.push('startup', 'automation')
  if (!picks.includes('minority_business')) picks.push('minority_business')
  if (!picks.includes('black_business') && /(atlanta|detroit|chicago|memphis|milwaukee|houston)/i.test(input.city)) {
    picks.push('black_business')
  }
  if (!picks.includes('immigrant_business') && /(miami|houston|chicago|phoenix|las vegas|dallas)/i.test(input.city)) {
    picks.push('immigrant_business')
  }

  return Array.from(new Set(picks)).slice(0, 5)
}

function buildDiscoveryRowsForCity(input: {
  city: string
  state: string
  metroArea?: string | null
  cityPriorityScore: number
  targetCategories: PrTargetCategory[]
  discoverySource: PrDiscoverySource
  nicheFocus: string[]
}) {
  const rows: DiscoveryTargetRow[] = []
  for (const seed of discoverySeeds.filter((item) => input.targetCategories.includes(item.targetCategory))) {
    const query = sourceQuery(input.city, input.state, seed)
    const audienceUrl = audienceUrlFromQuery(query)
    const revenueScore = clampScore((seed.baseRevenueScore + categoryRevenueBias[seed.targetCategory]) / 2)
    const authorityScore = clampScore(seed.baseAuthorityScore + (input.cityPriorityScore >= 70 ? 4 : 0))
    const responseProbabilityScore = clampScore(
      seed.baseResponseProbabilityScore + (seed.targetType === 'newsletter' || seed.targetType === 'chamber' ? 4 : 0)
    )
    const businessAudienceScore = clampScore(
      seed.baseBusinessAudienceScore + (seed.targetCategory === 'chamber' || seed.targetCategory === 'local_small_business' ? 4 : 0)
    )
    const backlinkScore = clampScore(seed.baseBacklinkScore + (seed.targetType === 'directory' ? 6 : 0))
    const fundingAngleScore = clampScore(seed.baseFundingAngleScore + (input.nicheFocus.join(' ').toLowerCase().includes('spanish') ? 4 : 0))
    const fitScore = computeFitScore({
      cityPriorityScore: input.cityPriorityScore,
      revenueScore,
      authorityScore,
      responseProbabilityScore,
      businessAudienceScore,
      backlinkScore,
      fundingAngleScore,
    })
    const priority = choosePriority(fitScore)
    const targetStatus = chooseTargetStatus(fitScore)
    const label = `${input.city} ${seed.audienceLabel}`
    const dedupeKey = buildDedupeKey([seed.key, input.city, input.state])

    rows.push({
      dedupe_key: dedupeKey,
      label,
      organization_name: label,
      contact_name: null,
      contact_email: null,
      target_type: seed.targetType,
      target_category: seed.targetCategory,
      audience_type: seed.audienceType,
      audience_url: audienceUrl,
      submission_url: null,
      city: input.city,
      state: input.state,
      metro_area: input.metroArea || null,
      discovery_source: input.discoverySource,
      source_query: query,
      status: targetStatus,
      priority,
      fit_score: fitScore,
      revenue_score: revenueScore,
      authority_score: authorityScore,
      response_probability_score: responseProbabilityScore,
      business_audience_score: businessAudienceScore,
      backlink_score: backlinkScore,
      funding_angle_score: fundingAngleScore,
      city_priority_score: clampScore(input.cityPriorityScore),
      owner_user_id: null,
      geography: compact([input.city, input.state, input.metroArea || null]),
      angle_tags: selectAnglesForCategory(seed.targetCategory, seed.angleTags),
      notes: `${seed.notes} Search query seeded for operator review: ${query}.`,
      metadata_json: {
        seedKey: seed.key,
        searchQuery: query,
        cityPriorityScore: input.cityPriorityScore,
        nicheFocus: input.nicheFocus,
        seededAt: new Date().toISOString(),
      },
      next_follow_up_at: targetStatus === 'ready' ? nowPlusDays(2) : null,
      last_result: null,
    })
  }

  return rows
}

async function upsertDiscoveryTargets(rows: DiscoveryTargetRow[], dryRun = false) {
  if (!rows.length || dryRun) return { created: 0, rows }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pr_targets')
    .upsert(rows, { onConflict: 'dedupe_key' })
    .select('*')

  if (error) throw new Error(error.message)
  return { created: (data || []).length, rows: data as PrTargetRecord[] }
}

function computeSummary(
  targets: PrTargetRecord[],
  drafts: PrPitchDraftRecord[],
  outreach: PrOutreachRecord[]
): PrDashboardSummary {
  const dueTargetIds = new Set(
    targets
      .filter((target) => {
        if (!target.next_follow_up_at) return false
        if (['won', 'archived', 'not_a_fit'].includes(target.status)) return false
        return new Date(target.next_follow_up_at).getTime() <= Date.now()
      })
      .map((target) => target.id)
  )

  outreach.forEach((item) => {
    if (
      item.next_follow_up_at &&
      new Date(item.next_follow_up_at).getTime() <= Date.now() &&
      ['queued', 'waiting', 'sent'].includes(item.status)
    ) {
      dueTargetIds.add(item.target_id)
    }
  })

  const targetsByTypeMap = new Map<string, number>()
  const targetsByCategoryMap = new Map<string, number>()
  const cityMap = new Map<string, { count: number; wins: number }>()

  const targetById = new Map(targets.map((target) => [target.id, target]))

  targets.forEach((target) => {
    targetsByTypeMap.set(target.target_type, (targetsByTypeMap.get(target.target_type) || 0) + 1)
    targetsByCategoryMap.set(
      target.target_category,
      (targetsByCategoryMap.get(target.target_category) || 0) + 1
    )
    const cityKey = [target.city, target.state].filter(Boolean).join(', ')
    if (cityKey) {
      const current = cityMap.get(cityKey) || { count: 0, wins: 0 }
      current.count += 1
      if (target.status === 'won') current.wins += 1
      cityMap.set(cityKey, current)
    }
  })

  outreach.forEach((item) => {
    if (item.status === 'won') {
      const target = targetById.get(item.target_id)
      const cityKey = target ? [target.city, target.state].filter(Boolean).join(', ') : null
      if (cityKey) {
        const current = cityMap.get(cityKey) || { count: 0, wins: 0 }
        current.wins += 1
        cityMap.set(cityKey, current)
      }
    }
  })

  const summary = {
    totalTargets: targets.length,
    readyToPitch: targets.filter((target) => ['ready', 'pitched', 'submitted', 'follow_up_due'].includes(target.status)).length,
    approvedDrafts: drafts.filter((draft) => draft.status === 'approved').length,
    followUpDue: dueTargetIds.size,
    wins:
      targets.filter((target) => target.status === 'won').length +
      outreach.filter((item) => item.status === 'won').length,
    urgentTargets: targets.filter((target) => target.priority === 'urgent' || target.fit_score >= 88).length,
    targetsByType: Array.from(targetsByTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    targetsByCategory: Array.from(targetsByCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topCities: Array.from(cityMap.entries())
      .map(([city, stats]) => ({ city, count: stats.count, wins: stats.wins }))
      .sort((a, b) => b.wins - a.wins || b.count - a.count)
      .slice(0, 6),
  } satisfies Omit<PrDashboardSummary, 'bestImmediateMove'>

  return {
    ...summary,
    bestImmediateMove: bestImmediateMove(summary as PrDashboardSummary, targets),
  }
}

export async function getPrEngineDashboard(options?: {
  limit?: number
  status?: string | null
  city?: string | null
  state?: string | null
  category?: string | null
}) {
  const admin = createAdminClient()
  const limit = Math.max(20, Math.min(options?.limit || 120, 250))

  let targetQuery = admin
    .from('pr_targets')
    .select('*')
    .order('fit_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (options?.status) targetQuery = targetQuery.eq('status', options.status)
  if (options?.city) targetQuery = targetQuery.eq('city', options.city)
  if (options?.state) targetQuery = targetQuery.eq('state', options.state)
  if (options?.category) targetQuery = targetQuery.eq('target_category', options.category)

  const [targetsResult, draftsResult, outreachResult, runsResult, learningResult] = await Promise.all([
    targetQuery,
    admin.from('pr_pitch_drafts').select('*').order('updated_at', { ascending: false }).limit(limit),
    admin.from('pr_outreach_log').select('*').order('created_at', { ascending: false }).limit(limit),
    admin.from('pr_runs').select('*').order('started_at', { ascending: false }).limit(20),
    admin
      .from('pr_learning_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (targetsResult.error) throw new Error(targetsResult.error.message)
  if (draftsResult.error) throw new Error(draftsResult.error.message)
  if (outreachResult.error) throw new Error(outreachResult.error.message)
  if (runsResult.error) throw new Error(runsResult.error.message)
  if (learningResult.error) throw new Error(learningResult.error.message)

  const targets = (targetsResult.data || []) as PrTargetRecord[]
  const drafts = (draftsResult.data || []) as PrPitchDraftRecord[]
  const outreach = (outreachResult.data || []) as PrOutreachRecord[]
  const recentRuns = (runsResult.data || []) as PrRunRecord[]
  const learningSnapshots = (learningResult.data || []) as PrLearningSnapshotRecord[]
  const targetMap = new Map(targets.map((target) => [target.id, target]))

  return {
    summary: computeSummary(targets, drafts, outreach),
    targets,
    drafts: drafts.map((draft) => ({
      ...draft,
      target: targetMap.get(draft.target_id)
        ? {
            id: targetMap.get(draft.target_id)!.id,
            label: targetMap.get(draft.target_id)!.label,
            status: targetMap.get(draft.target_id)!.status,
          }
        : null,
    })),
    outreach: outreach.map((item) => ({
      ...item,
      target: targetMap.get(item.target_id)
        ? {
            id: targetMap.get(item.target_id)!.id,
            label: targetMap.get(item.target_id)!.label,
            status: targetMap.get(item.target_id)!.status,
          }
        : null,
    })),
    followUpQueue: targets
      .filter((target) => {
        if (!target.next_follow_up_at) return false
        if (['won', 'archived', 'not_a_fit'].includes(target.status)) return false
        return new Date(target.next_follow_up_at).getTime() <= Date.now()
      })
      .sort((a, b) => new Date(a.next_follow_up_at || 0).getTime() - new Date(b.next_follow_up_at || 0).getTime()),
    angleLibrary: prAngleLibrary,
    recentRuns,
    learningSnapshots,
  } satisfies PrEngineDashboard
}

export async function upsertPrTarget(input: UpsertTargetInput) {
  const admin = createAdminClient()

  if (input.id) {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.label !== undefined) payload.label = input.label.trim()
    if (input.organizationName !== undefined) payload.organization_name = safeString(input.organizationName)
    if (input.contactName !== undefined) payload.contact_name = safeString(input.contactName)
    if (input.contactEmail !== undefined) payload.contact_email = safeString(input.contactEmail)
    if (input.targetType !== undefined) payload.target_type = input.targetType
    if (input.targetCategory !== undefined) payload.target_category = input.targetCategory
    if (input.audienceType !== undefined) payload.audience_type = safeString(input.audienceType)
    if (input.audienceUrl !== undefined) payload.audience_url = safeString(input.audienceUrl)
    if (input.submissionUrl !== undefined) payload.submission_url = safeString(input.submissionUrl)
    if (input.city !== undefined) payload.city = safeString(input.city)
    if (input.state !== undefined) payload.state = safeString(input.state)
    if (input.metroArea !== undefined) payload.metro_area = safeString(input.metroArea)
    if (input.discoverySource !== undefined) payload.discovery_source = input.discoverySource
    if (input.sourceQuery !== undefined) payload.source_query = safeString(input.sourceQuery)
    if (input.status !== undefined) payload.status = input.status
    if (input.priority !== undefined) payload.priority = input.priority
    if (input.fitScore !== undefined) payload.fit_score = clampScore(input.fitScore)
    if (input.revenueScore !== undefined) payload.revenue_score = clampScore(input.revenueScore)
    if (input.authorityScore !== undefined) payload.authority_score = clampScore(input.authorityScore)
    if (input.responseProbabilityScore !== undefined) {
      payload.response_probability_score = clampScore(input.responseProbabilityScore)
    }
    if (input.businessAudienceScore !== undefined) {
      payload.business_audience_score = clampScore(input.businessAudienceScore)
    }
    if (input.backlinkScore !== undefined) payload.backlink_score = clampScore(input.backlinkScore)
    if (input.fundingAngleScore !== undefined) payload.funding_angle_score = clampScore(input.fundingAngleScore)
    if (input.cityPriorityScore !== undefined) payload.city_priority_score = clampScore(input.cityPriorityScore)
    if (input.ownerUserId !== undefined) payload.owner_user_id = input.ownerUserId || null
    if (input.geography !== undefined) payload.geography = listify(input.geography)
    if (input.angleTags !== undefined) payload.angle_tags = listify(input.angleTags)
    if (input.notes !== undefined) payload.notes = safeString(input.notes)
    if (input.nextFollowUpAt !== undefined) payload.next_follow_up_at = input.nextFollowUpAt || null
    if (input.lastResult !== undefined) payload.last_result = safeString(input.lastResult)
    if (input.metadata !== undefined) payload.metadata_json = input.metadata || {}

    const { data, error } = await admin.from('pr_targets').update(payload).eq('id', input.id).select('*').single()
    if (error) throw new Error(error.message)

    await logEvent({
      eventType: 'admin_action',
      actorUserId: input.actorUserId,
      entityType: 'pr_target',
      entityId: input.id,
      metadata: { action: 'target_updated', updates: Object.keys(payload) },
    })
    return data as PrTargetRecord
  }

  const label = safeString(input.label)
  if (!label) throw new Error('label is required to create a PR target.')

  const city = safeString(input.city)
  const state = safeString(input.state)
  const targetType = input.targetType || 'newsletter'
  const targetCategory = input.targetCategory || 'local_small_business'
  const dedupeKey = buildDedupeKey([label, city, state, targetType, targetCategory])
  const revenueScore = clampScore(input.revenueScore ?? categoryRevenueBias[targetCategory], 60)
  const authorityScore = clampScore(input.authorityScore, 58)
  const responseProbabilityScore = clampScore(input.responseProbabilityScore, 54)
  const businessAudienceScore = clampScore(input.businessAudienceScore, 70)
  const backlinkScore = clampScore(input.backlinkScore, 56)
  const fundingAngleScore = clampScore(input.fundingAngleScore, 70)
  const cityPriorityScore = clampScore(input.cityPriorityScore, city ? 66 : 50)
  const fitScore =
    input.fitScore !== undefined && input.fitScore !== null
      ? clampScore(input.fitScore)
      : computeFitScore({
          cityPriorityScore,
          revenueScore,
          authorityScore,
          responseProbabilityScore,
          businessAudienceScore,
          backlinkScore,
          fundingAngleScore,
        })

  const payload = {
    dedupe_key: dedupeKey,
    label,
    organization_name: safeString(input.organizationName) || label,
    contact_name: safeString(input.contactName),
    contact_email: safeString(input.contactEmail),
    target_type: targetType,
    target_category: targetCategory,
    audience_type: safeString(input.audienceType),
    audience_url: safeString(input.audienceUrl),
    submission_url: safeString(input.submissionUrl),
    city,
    state,
    metro_area: safeString(input.metroArea),
    discovery_source: input.discoverySource || 'manual',
    source_query: safeString(input.sourceQuery),
    status: input.status || chooseTargetStatus(fitScore),
    priority: input.priority || choosePriority(fitScore),
    fit_score: fitScore,
    revenue_score: revenueScore,
    authority_score: authorityScore,
    response_probability_score: responseProbabilityScore,
    business_audience_score: businessAudienceScore,
    backlink_score: backlinkScore,
    funding_angle_score: fundingAngleScore,
    city_priority_score: cityPriorityScore,
    owner_user_id: input.ownerUserId || null,
    geography: listify(input.geography || compact([city, state])),
    angle_tags: selectAnglesForCategory(targetCategory, listify(input.angleTags)),
    notes: safeString(input.notes),
    next_follow_up_at: input.nextFollowUpAt || null,
    last_result: safeString(input.lastResult),
    metadata_json: input.metadata || {},
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin.from('pr_targets').insert(payload).select('*').single()
  if (error) throw new Error(error.message)

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'pr_target',
    entityId: data.id,
    metadata: { action: 'target_created', targetCategory, targetType, city, state },
  })

  return data as PrTargetRecord
}

export async function generatePrPitchDraft(input: GeneratePitchInput) {
  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('pr_targets').select('*').eq('id', input.targetId).single()
  if (targetError) throw new Error(targetError.message)

  const pitchChannel = input.pitchChannel || getPreferredPitchChannel(target as PrTargetRecord)
  const pitch = await generatePitchWithAi(target as PrTargetRecord, { ...input, pitchChannel })
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('pr_pitch_drafts')
    .insert({
      target_id: input.targetId,
      title: pitch.title,
      pitch_channel: pitchChannel,
      subject_line: pitch.subjectLine || null,
      preview_text: pitch.previewText || null,
      body_markdown: pitch.bodyMarkdown,
      founder_bio: pitch.founderBio || null,
      key_points: pitch.keyPoints || [],
      call_to_action: pitch.callToAction || null,
      status: 'draft',
      source_prompt: pitch.sourcePrompt || null,
      model: pitch.model || null,
      metadata_json: {
        angle: input.angle || null,
        targetStatus: target.status,
        targetCategory: target.target_category,
        city: target.city,
        state: target.state,
      },
      generated_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  if (!['ready', 'pitched', 'submitted', 'won'].includes(target.status)) {
    await admin.from('pr_targets').update({ status: 'ready', updated_at: now }).eq('id', input.targetId)
  }

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'pr_pitch_draft',
    entityId: data.id,
    metadata: {
      action: 'pitch_generated',
      targetId: input.targetId,
      channel: pitchChannel,
      angle: input.angle || null,
    },
  })

  return data as PrPitchDraftRecord
}

export async function updatePrPitchDraft(input: UpdateDraftInput) {
  const admin = createAdminClient()
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.subjectLine !== undefined) payload.subject_line = safeString(input.subjectLine)
  if (input.previewText !== undefined) payload.preview_text = safeString(input.previewText)
  if (input.bodyMarkdown !== undefined) payload.body_markdown = input.bodyMarkdown
  if (input.founderBio !== undefined) payload.founder_bio = safeString(input.founderBio)
  if (input.keyPoints !== undefined) payload.key_points = listify(input.keyPoints)
  if (input.callToAction !== undefined) payload.call_to_action = safeString(input.callToAction)
  if (input.status !== undefined) {
    payload.status = input.status
    if (input.status === 'approved') payload.approved_at = new Date().toISOString()
    if (input.status === 'sent') payload.sent_at = new Date().toISOString()
  }

  const { data, error } = await admin.from('pr_pitch_drafts').update(payload).eq('id', input.id).select('*').single()
  if (error) throw new Error(error.message)

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'pr_pitch_draft',
    entityId: input.id,
    metadata: { action: 'pitch_updated', status: input.status || null },
  })

  return data as PrPitchDraftRecord
}

async function syncTargetAfterOutreach(
  admin: AdminClient,
  input: LogOutreachInput | UpdateOutreachInput,
  outreach: Pick<PrOutreachRecord, 'target_id' | 'status' | 'next_follow_up_at' | 'outcome' | 'responded_at'>
) {
  let nextStatus: PrTargetStatus | undefined
  if (outreach.status === 'won') nextStatus = 'won'
  else if (outreach.status === 'lost') nextStatus = 'not_a_fit'
  else if (outreach.responded_at) nextStatus = 'submitted'
  else if (outreach.next_follow_up_at && new Date(outreach.next_follow_up_at).getTime() <= Date.now()) nextStatus = 'follow_up_due'
  else if (['queued', 'sent', 'waiting'].includes(outreach.status)) nextStatus = 'submitted'

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if ('sentAt' in input) payload.last_contacted_at = input.sentAt || new Date().toISOString()
  if (outreach.next_follow_up_at !== undefined) payload.next_follow_up_at = outreach.next_follow_up_at
  if (outreach.outcome !== undefined) payload.last_result = outreach.outcome || null
  if (nextStatus) payload.status = nextStatus

  await admin.from('pr_targets').update(payload).eq('id', outreach.target_id)
}

export async function logPrOutreach(input: LogOutreachInput) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const initialStatus = input.status || 'waiting'
  const nextFollowUpAt =
    input.nextFollowUpAt ||
    (input.activityType === 'submission' || input.activityType === 'follow_up' ? nowPlusDays(4) : null)

  const payload = {
    target_id: input.targetId,
    draft_id: input.draftId || null,
    activity_type: input.activityType || 'submission',
    channel: input.channel || 'email',
    status: initialStatus,
    subject: safeString(input.subject),
    message_excerpt: excerpt(input.messageExcerpt, 1200),
    destination: safeString(input.destination),
    sent_at: initialStatus === 'queued' ? null : input.sentAt || now,
    responded_at: input.respondedAt || null,
    next_follow_up_at: nextFollowUpAt,
    outcome: safeString(input.outcome),
    metadata_json: input.metadata || {},
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await admin.from('pr_outreach_log').insert(payload).select('*').single()
  if (error) throw new Error(error.message)

  if (input.draftId) {
    const nextDraftStatus = payload.status === 'sent' || payload.status === 'won' ? 'sent' : 'approved'
    await admin
      .from('pr_pitch_drafts')
      .update({
        status: nextDraftStatus,
        sent_at: nextDraftStatus === 'sent' ? payload.sent_at : null,
        updated_at: now,
      })
      .eq('id', input.draftId)
  }

  await syncTargetAfterOutreach(admin, input, {
    target_id: input.targetId,
    status: payload.status,
    next_follow_up_at: payload.next_follow_up_at,
    outcome: payload.outcome,
    responded_at: payload.responded_at,
  })

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'pr_outreach',
    entityId: data.id,
    metadata: { action: 'outreach_logged', status: payload.status, activityType: payload.activity_type },
  })

  return data as PrOutreachRecord
}

function getPrOutreachDestination(target: PrTargetRecord) {
  const metadata = target.metadata_json || {}
  const metadataCandidates = [
    typeof metadata.contactPageUrl === 'string' ? metadata.contactPageUrl : null,
    typeof metadata.discoveredDestination === 'string' ? metadata.discoveredDestination : null,
    typeof metadata.websiteUrl === 'string' ? metadata.websiteUrl : null,
  ]
  const candidates = [target.contact_email, target.submission_url, target.audience_url, ...metadataCandidates]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate.includes('google.com/search?q=')) continue
    if (candidate.includes('duckduckgo.com/html/?q=')) continue
    return candidate
  }

  return null
}

function getPrOutreachChannel(target: PrTargetRecord, draft: PrPitchDraftRecord): LogOutreachInput['channel'] {
  if (draft.pitch_channel) return draft.pitch_channel
  if (target.contact_email) return 'email'
  if (target.submission_url) return 'application'
  if (target.audience_url) return 'form'
  return 'other'
}

export async function queueApprovedPrOutreach(options?: {
  limit?: number
  dryRun?: boolean
  actorUserId?: string | null
}) {
  const run = await createPrRun({ runType: 'follow_up_enforcement' })
  const admin = createAdminClient()

  try {
    const limit = Math.max(1, Math.min(options?.limit || 10, 25))
    const { data: drafts, error: draftError } = await admin
      .from('pr_pitch_drafts')
      .select('*, pr_targets(*)')
      .in('status', ['approved', 'draft'])
      .order('approved_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: true })
      .limit(limit * 4)

    if (draftError) throw new Error(draftError.message)

    const candidateDrafts = (drafts || []) as Array<PrPitchDraftRecord & { pr_targets: PrTargetRecord | null }>
    const draftIds = candidateDrafts.map((draft) => draft.id)
    let queuedDraftIds = new Set<string>()

    if (draftIds.length) {
      const { data: existingOutreach, error: outreachError } = await admin
        .from('pr_outreach_log')
        .select('draft_id,status')
        .in('draft_id', draftIds)
        .in('status', ['queued', 'sent', 'waiting', 'won'])
      if (outreachError) throw new Error(outreachError.message)
      queuedDraftIds = new Set((existingOutreach || []).map((row) => row.draft_id).filter(Boolean))
    }

    const eligibleDrafts = candidateDrafts
      .filter((draft) => {
        const target = draft.pr_targets
        if (!target || queuedDraftIds.has(draft.id)) return false
        if (draft.status === 'approved') return true
        return draft.status === 'draft' && Number(target.fit_score || 0) >= 70
      })
      .sort((left, right) => {
        const leftTarget = left.pr_targets!
        const rightTarget = right.pr_targets!
        if (left.status !== right.status) return left.status === 'approved' ? -1 : 1
        const fitDelta = Number(rightTarget.fit_score || 0) - Number(leftTarget.fit_score || 0)
        if (fitDelta !== 0) return fitDelta
        return Date.parse(left.approved_at || left.updated_at) - Date.parse(right.approved_at || right.updated_at)
      })
      .slice(0, limit)

    const queued: string[] = []
    const missingDestination: string[] = []
    let autoApprovedDrafts = 0

    for (const draft of eligibleDrafts) {
      let target = draft.pr_targets!
      let destination = getPrOutreachDestination(target)

      if (!destination && !options?.dryRun) {
        const discovered = await discoverPrTargetDestination(target).catch(() => null)
        if (discovered?.destination) {
          const nextMetadata = {
            ...(target.metadata_json || {}),
            prDestinationDiscoveredAt: new Date().toISOString(),
            prDestinationProvider: discovered.provider,
            sourceQuery: discovered.sourceQuery,
            contactPageUrl: discovered.contactPageUrl,
            discoveredDestination: discovered.destination,
          }

          const { data: refreshedTarget, error: updateError } = await admin
            .from('pr_targets')
            .update({
              contact_email: discovered.contactEmail || target.contact_email,
              submission_url: discovered.submissionUrl || target.submission_url,
              audience_url: discovered.audienceUrl || target.audience_url,
              metadata_json: nextMetadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.id)
            .select('*')
            .single()

          if (!updateError && refreshedTarget) {
            target = refreshedTarget as PrTargetRecord
            destination = getPrOutreachDestination(target)
          }
        }
      }

      if (!destination) {
        missingDestination.push(draft.id)
        if (!options?.dryRun) {
          await createAdminTask({
            title: `PR target missing contact path: ${target.label}`,
            description:
              'This approved PR draft cannot be queued because the target does not have a contact email, submission URL, or audience URL. Add a usable destination and queue it again.',
            taskType: 'pr_missing_contact_path',
            priority: target.fit_score >= 85 ? 'high' : 'normal',
            entityType: 'pr_target',
            entityId: target.id,
            dueAt: adminTaskDueDates.hours(12),
            metadata: {
              draftId: draft.id,
              targetType: target.target_type,
              targetCategory: target.target_category,
              city: target.city,
              state: target.state,
            },
          })
        }
        continue
      }

      if (options?.dryRun) {
        queued.push(draft.id)
        continue
      }

      if (draft.status !== 'approved') {
        await admin
          .from('pr_pitch_drafts')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id)
        autoApprovedDrafts += 1
      }

      await logPrOutreach({
        targetId: target.id,
        draftId: draft.id,
        activityType: 'submission',
        channel: getPrOutreachChannel(target, draft),
        status: 'queued',
        subject: draft.subject_line,
        messageExcerpt: draft.preview_text || draft.body_markdown,
        destination,
        sentAt: null,
        nextFollowUpAt: nowPlusDays(4),
        actorUserId: options?.actorUserId || null,
      })
      queued.push(draft.id)
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary: {
        eligibleDrafts: eligibleDrafts.length,
        queuedDrafts: queued.length,
        missingDestination: missingDestination.length,
        autoApprovedDrafts,
      },
      createdTaskCount: missingDestination.length,
    })

    return {
      runId: run.id,
      eligibleDrafts: eligibleDrafts.length,
      queuedDrafts: queued.length,
      missingDestination: missingDestination.length,
      autoApprovedDrafts,
      draftIds: queued,
      dryRun: Boolean(options?.dryRun),
    }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR outreach queue failed.',
    })
    throw error
  }
}

export async function updatePrOutreach(input: UpdateOutreachInput) {
  const admin = createAdminClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.status !== undefined) payload.status = input.status
  if (input.subject !== undefined) payload.subject = safeString(input.subject)
  if (input.messageExcerpt !== undefined) payload.message_excerpt = excerpt(input.messageExcerpt, 1200)
  if (input.respondedAt !== undefined) payload.responded_at = input.respondedAt || null
  if (input.nextFollowUpAt !== undefined) payload.next_follow_up_at = input.nextFollowUpAt || null
  if (input.outcome !== undefined) payload.outcome = safeString(input.outcome)

  const { data, error } = await admin.from('pr_outreach_log').update(payload).eq('id', input.id).select('*').single()
  if (error) throw new Error(error.message)

  await syncTargetAfterOutreach(admin, input, {
    target_id: data.target_id,
    status: (payload.status as PrActivityStatus | undefined) || data.status,
    next_follow_up_at:
      payload.next_follow_up_at === undefined ? data.next_follow_up_at : (payload.next_follow_up_at as string | null),
    outcome: payload.outcome === undefined ? data.outcome : (payload.outcome as string | null),
    responded_at: payload.responded_at === undefined ? data.responded_at : (payload.responded_at as string | null),
  })

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'pr_outreach',
    entityId: input.id,
    metadata: { action: 'outreach_updated', status: input.status || null },
  })

  return data as PrOutreachRecord
}

export async function runPrTargetDiscovery(options?: {
  cityLimit?: number
  dryRun?: boolean
}) {
  const run = await createPrRun({ runType: 'target_discovery' })
  try {
    const cityContexts = await getCityDiscoveryContext(options?.cityLimit || 5)
    const rows = cityContexts.flatMap((context) =>
      buildDiscoveryRowsForCity({
        city: context.city,
        state: context.state,
        metroArea: context.metroArea,
        cityPriorityScore: context.marketScore,
        targetCategories: pickCategoriesForCity({
          city: context.city,
          state: context.state,
          nicheFocus: context.nicheFocus,
        }),
        discoverySource: 'category_seed',
        nicheFocus: context.nicheFocus,
      })
    )

    const result = await upsertDiscoveryTargets(rows, Boolean(options?.dryRun))
    const summary = {
      cities: cityContexts.map((context) => `${context.city}, ${context.state}`),
      discovered: rows.length,
      upserted: result.created,
      categories: Array.from(new Set(rows.map((row) => row.target_category))),
    }

    if (!options?.dryRun) {
      await logEvent({
        eventType: 'admin_action',
        entityType: 'pr_engine',
        entityId: run.id,
        metadata: { action: 'target_discovery_completed', ...summary },
      })
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary,
      createdTargetCount: rows.length,
    })

    return { runId: run.id, ...summary, dryRun: Boolean(options?.dryRun) }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR target discovery failed.',
    })
    throw error
  }
}

export async function runPrCityExpansion(options?: {
  cityLimit?: number
  dryRun?: boolean
}) {
  const run = await createPrRun({ runType: 'city_expansion' })
  try {
    const admin = createAdminClient()
    const cityContexts = await getCityDiscoveryContext(12)
    const { data: existing } = await admin
      .from('pr_targets')
      .select('city,state')
      .not('city', 'is', null)
      .not('state', 'is', null)

    const existingMap = new Map<string, number>()
    for (const row of existing || []) {
      const key = `${row.city}|${row.state}`
      existingMap.set(key, (existingMap.get(key) || 0) + 1)
    }

    const candidateCities = cityContexts
      .filter((context) => (existingMap.get(`${context.city}|${context.state}`) || 0) < 4)
      .sort((a, b) => b.marketScore - a.marketScore)
      .slice(0, options?.cityLimit || 3)

    const rows = candidateCities.flatMap((context) =>
      buildDiscoveryRowsForCity({
        city: context.city,
        state: context.state,
        metroArea: context.metroArea,
        cityPriorityScore: clampScore(context.marketScore + 8),
        targetCategories: pickCategoriesForCity({
          city: context.city,
          state: context.state,
          nicheFocus: context.nicheFocus,
        }),
        discoverySource: 'city_expansion_seed',
        nicheFocus: context.nicheFocus,
      })
    )

    const result = await upsertDiscoveryTargets(rows, Boolean(options?.dryRun))
    const summary = {
      expandedCities: candidateCities.map((city) => `${city.city}, ${city.state}`),
      discovered: rows.length,
      upserted: result.created,
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary,
      createdTargetCount: rows.length,
    })

    return { runId: run.id, ...summary, dryRun: Boolean(options?.dryRun) }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR city expansion failed.',
    })
    throw error
  }
}

export async function runPrPitchAutomation(options?: {
  limit?: number
  dryRun?: boolean
}) {
  const run = await createPrRun({ runType: 'pitch_generation' })
  try {
    const admin = createAdminClient()
    const limit = Math.max(1, Math.min(options?.limit || 8, 20))
    const { data: targets, error: targetError } = await admin
      .from('pr_targets')
      .select('*')
      .in('status', ['ready', 'researching', 'follow_up_due'])
      .gte('fit_score', 68)
      .order('fit_score', { ascending: false })
      .limit(30)

    if (targetError) throw new Error(targetError.message)

    const { data: drafts, error: draftError } = await admin
      .from('pr_pitch_drafts')
      .select('id,target_id,status')
      .in('status', ['draft', 'approved', 'sent'])
      .limit(300)

    if (draftError) throw new Error(draftError.message)

    const activeDraftTargetIds = new Set((drafts || []).map((draft) => draft.target_id))
    const eligibleTargets = ((targets || []) as PrTargetRecord[])
      .filter((target) => !activeDraftTargetIds.has(target.id))
      .slice(0, limit)

    const createdDrafts: string[] = []
    for (const target of eligibleTargets) {
      if (options?.dryRun) continue
      const preferredAngle =
        target.angle_tags.find((angle) =>
          prAngleLibrary.some((item) => item.id === angle && item.target_categories?.includes(target.target_category))
        ) || target.angle_tags[0]
      const draft = await generatePrPitchDraft({
        targetId: target.id,
        pitchChannel: getPreferredPitchChannel(target),
        angle: preferredAngle || null,
      })
      createdDrafts.push(draft.id)
    }

    const summary = {
      eligibleTargets: eligibleTargets.length,
      createdDrafts: createdDrafts.length,
      targets: eligibleTargets.map((target) => target.label),
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary,
      createdDraftCount: createdDrafts.length,
    })

    return { runId: run.id, ...summary, dryRun: Boolean(options?.dryRun) }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR pitch automation failed.',
    })
    throw error
  }
}

export async function runPrEngineMonitor(input: {
  admin?: AdminClient
  dryRun?: boolean
}) {
  const run = await createPrRun({ runType: 'follow_up_enforcement' })
  const admin = input.admin || createAdminClient()
  try {
    const nowIso = new Date().toISOString()
    const { data: dueTargets, error } = await admin
      .from('pr_targets')
      .select('*')
      .in('status', ['ready', 'pitched', 'submitted', 'follow_up_due'])
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', nowIso)
      .order('next_follow_up_at', { ascending: true })
      .limit(50)

    if (error) throw new Error(error.message)

    const tasksCreated: string[] = []
    const targetIds: string[] = []
    for (const target of (dueTargets || []) as PrTargetRecord[]) {
      targetIds.push(target.id)
      if (!input.dryRun) {
        await admin.from('pr_targets').update({ status: 'follow_up_due', updated_at: new Date().toISOString() }).eq('id', target.id)
      }

      const task = await createAdminTask({
        title: `PR follow-up due: ${target.label}`,
        description:
          'A PR target is due for follow-up. Review the last pitch or submission, send the next touch, and record the outcome.',
        taskType: 'pr_followup_due',
        priority: target.priority === 'urgent' || target.fit_score >= 85 ? 'urgent' : 'high',
        entityType: 'pr_target',
        entityId: target.id,
        dueAt: adminTaskDueDates.now(),
        metadata: {
          targetType: target.target_type,
          targetCategory: target.target_category,
          city: target.city,
          state: target.state,
          nextFollowUpAt: target.next_follow_up_at,
        },
      })
      if (task.ok && !task.duplicate && task.task?.id) tasksCreated.push(task.task.id)
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary: { scanned: targetIds.length, tasksCreated: tasksCreated.length },
      createdTaskCount: tasksCreated.length,
    })

    return {
      runId: run.id,
      scanned: targetIds.length,
      tasksCreated: tasksCreated.length,
      targetIds,
      dryRun: Boolean(input.dryRun),
    }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR follow-up enforcement failed.',
    })
    throw error
  }
}

function rateOutcomeBuckets(outreach: Array<PrOutreachRecord & { target?: PrTargetRecord | null }>) {
  const angleMetrics = new Map<string, LearningMetrics>()
  const categoryMetrics = new Map<string, LearningMetrics>()
  const cityMetrics = new Map<string, LearningMetrics>()

  for (const item of outreach) {
    const target = item.target
    if (!target) continue

    const metricsFor = (map: Map<string, LearningMetrics>, key: string) => {
      const current = map.get(key) || { sent: 0, replied: 0, wins: 0, ignored: 0 }
      current.sent += 1
      if (item.responded_at || item.status === 'won') current.replied += 1
      if (item.status === 'won') current.wins += 1
      if (item.status === 'lost' || (!item.responded_at && item.status === 'archived')) current.ignored += 1
      map.set(key, current)
    }

    target.angle_tags.forEach((angle) => metricsFor(angleMetrics, angle))
    metricsFor(categoryMetrics, target.target_category)
    const cityKey = [target.city, target.state].filter(Boolean).join(', ')
    if (cityKey) metricsFor(cityMetrics, cityKey)
  }

  return { angleMetrics, categoryMetrics, cityMetrics }
}

export async function runPrWeeklyLearning(options?: { dryRun?: boolean }) {
  const run = await createPrRun({ runType: 'weekly_learning' })
  try {
    const admin = createAdminClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [targetsResult, outreachResult] = await Promise.all([
      admin.from('pr_targets').select('*').order('fit_score', { ascending: false }).limit(200),
      admin.from('pr_outreach_log').select('*').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(250),
    ])

    if (targetsResult.error) throw new Error(targetsResult.error.message)
    if (outreachResult.error) throw new Error(outreachResult.error.message)

    const targets = (targetsResult.data || []) as PrTargetRecord[]
    const targetMap = new Map(targets.map((target) => [target.id, target]))
    const outreach = ((outreachResult.data || []) as PrOutreachRecord[]).map((item) => ({
      ...item,
      target: targetMap.get(item.target_id) || null,
    }))

    const rated = rateOutcomeBuckets(outreach)
    const snapshots: Array<{
      runId?: string | null
      snapshotType: 'angle' | 'category' | 'city' | 'operator'
      angleKey?: string | null
      targetCategory?: PrTargetCategory | null
      city?: string | null
      state?: string | null
      metrics: Record<string, unknown>
      recommendation?: string | null
    }> = []

    const angleLeaders = Array.from(rated.angleMetrics.entries())
      .map(([key, metrics]) => ({ key, metrics }))
      .sort((a, b) => b.metrics.wins - a.metrics.wins || b.metrics.replied - a.metrics.replied)
      .slice(0, 4)

    angleLeaders.forEach(({ key, metrics }) => {
      snapshots.push({
        runId: run.id,
        snapshotType: 'angle',
        angleKey: key,
        metrics,
        recommendation:
          metrics.replied > 0
            ? `Keep leaning into ${key} for similar audiences.`
            : `Rework ${key} with a shorter hook or stronger local framing.`,
      })
    })

    const categoryLeaders = Array.from(rated.categoryMetrics.entries())
      .map(([key, metrics]) => ({ key, metrics }))
      .sort((a, b) => b.metrics.wins - a.metrics.wins || b.metrics.replied - a.metrics.replied)
      .slice(0, 6)

    categoryLeaders.forEach(({ key, metrics }) => {
      snapshots.push({
        runId: run.id,
        snapshotType: 'category',
        targetCategory: key as PrTargetCategory,
        metrics,
        recommendation:
          metrics.wins > 0
            ? `Keep prioritizing ${key.replaceAll('_', ' ')} because it is producing real traction.`
            : `Reduce time on ${key.replaceAll('_', ' ')} unless reply quality improves.`,
      })
    })

    const cityLeaders = Array.from(rated.cityMetrics.entries())
      .map(([key, metrics]) => ({ key, metrics }))
      .sort((a, b) => b.metrics.wins - a.metrics.wins || b.metrics.replied - a.metrics.replied)
      .slice(0, 6)

    cityLeaders.forEach(({ key, metrics }) => {
      const [city, state] = key.split(', ').map((item) => item.trim())
      snapshots.push({
        runId: run.id,
        snapshotType: 'city',
        city: city || null,
        state: state || null,
        metrics,
        recommendation:
          metrics.replied > 0
            ? `Keep expanding in ${key}; the city is showing visibility signal.`
            : `Try a different category mix or chamber-first angle in ${key}.`,
      })
    })

    const operatorNote = {
      bestAngles: angleLeaders.map((item) => item.key),
      bestCategories: categoryLeaders.slice(0, 3).map((item) => item.key),
      bestCities: cityLeaders.slice(0, 3).map((item) => item.key),
      replyCount: outreach.filter((item) => Boolean(item.responded_at)).length,
      winCount: outreach.filter((item) => item.status === 'won').length,
    }

    snapshots.push({
      runId: run.id,
      snapshotType: 'operator',
      metrics: operatorNote,
      recommendation:
        operatorNote.winCount > 0
          ? 'Double down on the cities and angles already producing replies or features.'
          : 'This week needs more sent volume or sharper angles before PR can compound.',
    })

    if (!options?.dryRun) {
      await insertLearningSnapshots(snapshots)
    }

    await finishPrRun(run.id, {
      status: 'completed',
      summary: operatorNote,
    })

    return { runId: run.id, dryRun: Boolean(options?.dryRun), ...operatorNote }
  } catch (error) {
    await finishPrRun(run.id, {
      status: 'failed',
      summary: {},
      errorMessage: error instanceof Error ? error.message : 'PR weekly learning failed.',
    })
    throw error
  }
}

export { prAngleLibrary }
