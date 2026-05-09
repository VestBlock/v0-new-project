import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import {
  generatePrPitchDraft,
  getPrEngineDashboard,
  logPrOutreach,
  queueApprovedPrOutreach,
  runPrCityExpansion,
  runPrPitchAutomation,
  runPrTargetDiscovery,
  runPrWeeklyLearning,
  updatePrOutreach,
  updatePrPitchDraft,
  upsertPrTarget,
} from '@/lib/pr/engine'
import {
  prActivityStatuses,
  prActivityTypes,
  prDiscoverySources,
  prDraftStatuses,
  prPitchChannels,
  prPriorities,
  prTargetCategories,
  prTargetStatuses,
  prTargetTypes,
} from '@/lib/pr/types'

const nullableIso = z.string().datetime().nullable().optional().or(z.literal(''))
const stringOrArray = z.union([z.string(), z.array(z.string())]).nullable().optional()

const targetSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(2).max(180),
  organizationName: z.string().max(180).nullable().optional(),
  contactName: z.string().max(180).nullable().optional(),
  contactEmail: z.string().email().max(180).nullable().optional().or(z.literal('')),
  targetType: z.enum(prTargetTypes).optional(),
  targetCategory: z.enum(prTargetCategories).optional(),
  audienceType: z.string().max(180).nullable().optional(),
  audienceUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  submissionUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
  metroArea: z.string().max(180).nullable().optional(),
  discoverySource: z.enum(prDiscoverySources).optional(),
  sourceQuery: z.string().max(400).nullable().optional(),
  status: z.enum(prTargetStatuses).optional(),
  priority: z.enum(prPriorities).optional(),
  fitScore: z.coerce.number().min(0).max(100).optional(),
  revenueScore: z.coerce.number().min(0).max(100).optional(),
  authorityScore: z.coerce.number().min(0).max(100).optional(),
  responseProbabilityScore: z.coerce.number().min(0).max(100).optional(),
  businessAudienceScore: z.coerce.number().min(0).max(100).optional(),
  backlinkScore: z.coerce.number().min(0).max(100).optional(),
  fundingAngleScore: z.coerce.number().min(0).max(100).optional(),
  cityPriorityScore: z.coerce.number().min(0).max(100).optional(),
  geography: stringOrArray,
  angleTags: stringOrArray,
  notes: z.string().max(5000).nullable().optional(),
  nextFollowUpAt: nullableIso,
  lastResult: z.string().max(500).nullable().optional(),
})

const postSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_target'),
    target: targetSchema,
  }),
  z.object({
    intent: z.literal('generate_pitch'),
    targetId: z.string().uuid(),
    pitchChannel: z.enum(prPitchChannels).optional(),
    angle: z.string().max(120).nullable().optional(),
    customPrompt: z.string().max(4000).nullable().optional(),
  }),
  z.object({
    intent: z.literal('log_outreach'),
    targetId: z.string().uuid(),
    draftId: z.string().uuid().nullable().optional(),
    activityType: z.enum(prActivityTypes).optional(),
    channel: z.enum([...prPitchChannels, 'other'] as const).optional(),
    status: z.enum(prActivityStatuses).optional(),
    subject: z.string().max(180).nullable().optional(),
    messageExcerpt: z.string().max(5000).nullable().optional(),
    destination: z.string().max(500).nullable().optional(),
    sentAt: nullableIso,
    respondedAt: nullableIso,
    nextFollowUpAt: nullableIso,
    outcome: z.string().max(500).nullable().optional(),
  }),
  z.object({
    intent: z.literal('run_discovery'),
    cityLimit: z.coerce.number().min(1).max(10).optional(),
    dryRun: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal('run_city_expansion'),
    cityLimit: z.coerce.number().min(1).max(10).optional(),
    dryRun: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal('run_pitch_automation'),
    limit: z.coerce.number().min(1).max(20).optional(),
    dryRun: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal('queue_approved_outreach'),
    limit: z.coerce.number().min(1).max(25).optional(),
    dryRun: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal('run_weekly_learning'),
    dryRun: z.boolean().optional(),
  }),
])

const patchSchema = z.discriminatedUnion('entity', [
  z.object({
    entity: z.literal('target'),
    id: z.string().uuid(),
    label: z.string().min(2).max(180).optional(),
    organizationName: z.string().max(180).nullable().optional(),
    contactName: z.string().max(180).nullable().optional(),
    contactEmail: z.string().email().max(180).nullable().optional().or(z.literal('')),
    targetType: z.enum(prTargetTypes).optional(),
    targetCategory: z.enum(prTargetCategories).optional(),
    audienceType: z.string().max(180).nullable().optional(),
    audienceUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
    submissionUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
    city: z.string().max(120).nullable().optional(),
    state: z.string().max(40).nullable().optional(),
    metroArea: z.string().max(180).nullable().optional(),
    discoverySource: z.enum(prDiscoverySources).optional(),
    sourceQuery: z.string().max(400).nullable().optional(),
    status: z.enum(prTargetStatuses).optional(),
    priority: z.enum(prPriorities).optional(),
    fitScore: z.coerce.number().min(0).max(100).optional(),
    revenueScore: z.coerce.number().min(0).max(100).optional(),
    authorityScore: z.coerce.number().min(0).max(100).optional(),
    responseProbabilityScore: z.coerce.number().min(0).max(100).optional(),
    businessAudienceScore: z.coerce.number().min(0).max(100).optional(),
    backlinkScore: z.coerce.number().min(0).max(100).optional(),
    fundingAngleScore: z.coerce.number().min(0).max(100).optional(),
    cityPriorityScore: z.coerce.number().min(0).max(100).optional(),
    geography: stringOrArray,
    angleTags: stringOrArray,
    notes: z.string().max(5000).nullable().optional(),
    nextFollowUpAt: nullableIso,
    lastResult: z.string().max(500).nullable().optional(),
  }),
  z.object({
    entity: z.literal('draft'),
    id: z.string().uuid(),
    title: z.string().min(3).max(180).optional(),
    subjectLine: z.string().max(180).nullable().optional(),
    previewText: z.string().max(220).nullable().optional(),
    bodyMarkdown: z.string().max(25000).optional(),
    founderBio: z.string().max(1200).nullable().optional(),
    keyPoints: stringOrArray,
    callToAction: z.string().max(280).nullable().optional(),
    status: z.enum(prDraftStatuses).optional(),
  }),
  z.object({
    entity: z.literal('outreach'),
    id: z.string().uuid(),
    status: z.enum(prActivityStatuses).optional(),
    subject: z.string().max(180).nullable().optional(),
    messageExcerpt: z.string().max(5000).nullable().optional(),
    respondedAt: nullableIso,
    nextFollowUpAt: nullableIso,
    outcome: z.string().max(500).nullable().optional(),
  }),
])

async function requireAdmin() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return {
      adminCheck,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: adminCheck.user ? 403 : 401 }
      ),
    }
  }

  return { adminCheck, response: null }
}

function nullableString(value?: string | null) {
  return value && value.trim() ? value.trim() : null
}

function nullableDateTime(value?: string | null) {
  return value && value.trim() ? value : null
}

export async function GET(request: Request) {
  const { response } = await requireAdmin()
  if (response) return response

  const { searchParams } = new URL(request.url)

  try {
    const dashboard = await getPrEngineDashboard({
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      status: searchParams.get('status'),
      city: searchParams.get('city'),
      state: searchParams.get('state'),
      category: searchParams.get('category'),
    })
    return NextResponse.json({ success: true, dashboard })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load PR engine.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { adminCheck, response } = await requireAdmin()
  if (response) return response

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid PR engine request.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.intent === 'create_target') {
      const target = await upsertPrTarget({
        ...parsed.data.target,
        organizationName: nullableString(parsed.data.target.organizationName),
        contactName: nullableString(parsed.data.target.contactName),
        contactEmail: nullableString(parsed.data.target.contactEmail),
        audienceType: nullableString(parsed.data.target.audienceType),
        audienceUrl: nullableString(parsed.data.target.audienceUrl),
        submissionUrl: nullableString(parsed.data.target.submissionUrl),
        city: nullableString(parsed.data.target.city),
        state: nullableString(parsed.data.target.state),
        metroArea: nullableString(parsed.data.target.metroArea),
        sourceQuery: nullableString(parsed.data.target.sourceQuery),
        nextFollowUpAt: nullableDateTime(parsed.data.target.nextFollowUpAt),
        notes: nullableString(parsed.data.target.notes),
        lastResult: nullableString(parsed.data.target.lastResult),
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, target })
    }

    if (parsed.data.intent === 'generate_pitch') {
      const draft = await generatePrPitchDraft({
        targetId: parsed.data.targetId,
        pitchChannel: parsed.data.pitchChannel,
        angle: nullableString(parsed.data.angle),
        customPrompt: nullableString(parsed.data.customPrompt),
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, draft })
    }

    if (parsed.data.intent === 'log_outreach') {
      const outreach = await logPrOutreach({
        targetId: parsed.data.targetId,
        draftId: parsed.data.draftId || null,
        activityType: parsed.data.activityType,
        channel: parsed.data.channel,
        status: parsed.data.status,
        subject: nullableString(parsed.data.subject),
        messageExcerpt: nullableString(parsed.data.messageExcerpt),
        destination: nullableString(parsed.data.destination),
        sentAt: nullableDateTime(parsed.data.sentAt),
        respondedAt: nullableDateTime(parsed.data.respondedAt),
        nextFollowUpAt: nullableDateTime(parsed.data.nextFollowUpAt),
        outcome: nullableString(parsed.data.outcome),
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, outreach })
    }

    if (parsed.data.intent === 'run_discovery') {
      const result = await runPrTargetDiscovery({
        cityLimit: parsed.data.cityLimit,
        dryRun: parsed.data.dryRun,
      })
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.intent === 'run_city_expansion') {
      const result = await runPrCityExpansion({
        cityLimit: parsed.data.cityLimit,
        dryRun: parsed.data.dryRun,
      })
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.intent === 'run_pitch_automation') {
      const result = await runPrPitchAutomation({
        limit: parsed.data.limit,
        dryRun: parsed.data.dryRun,
      })
      return NextResponse.json({ success: true, result })
    }

    if (parsed.data.intent === 'queue_approved_outreach') {
      const result = await queueApprovedPrOutreach({
        limit: parsed.data.limit,
        dryRun: parsed.data.dryRun,
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, result })
    }

    const result = await runPrWeeklyLearning({ dryRun: parsed.data.dryRun })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PR engine request failed.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const { adminCheck, response } = await requireAdmin()
  if (response) return response

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid PR engine update.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.entity === 'target') {
      const target = await upsertPrTarget({
        id: parsed.data.id,
        label: parsed.data.label,
        organizationName: nullableString(parsed.data.organizationName),
        contactName: nullableString(parsed.data.contactName),
        contactEmail: nullableString(parsed.data.contactEmail),
        targetType: parsed.data.targetType,
        targetCategory: parsed.data.targetCategory,
        audienceType: nullableString(parsed.data.audienceType),
        audienceUrl: nullableString(parsed.data.audienceUrl),
        submissionUrl: nullableString(parsed.data.submissionUrl),
        city: nullableString(parsed.data.city),
        state: nullableString(parsed.data.state),
        metroArea: nullableString(parsed.data.metroArea),
        discoverySource: parsed.data.discoverySource,
        sourceQuery: nullableString(parsed.data.sourceQuery),
        status: parsed.data.status,
        priority: parsed.data.priority,
        fitScore: parsed.data.fitScore,
        revenueScore: parsed.data.revenueScore,
        authorityScore: parsed.data.authorityScore,
        responseProbabilityScore: parsed.data.responseProbabilityScore,
        businessAudienceScore: parsed.data.businessAudienceScore,
        backlinkScore: parsed.data.backlinkScore,
        fundingAngleScore: parsed.data.fundingAngleScore,
        cityPriorityScore: parsed.data.cityPriorityScore,
        geography: parsed.data.geography,
        angleTags: parsed.data.angleTags,
        notes: nullableString(parsed.data.notes),
        nextFollowUpAt: nullableDateTime(parsed.data.nextFollowUpAt),
        lastResult: nullableString(parsed.data.lastResult),
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, target })
    }

    if (parsed.data.entity === 'draft') {
      const draft = await updatePrPitchDraft({
        id: parsed.data.id,
        title: parsed.data.title,
        subjectLine: nullableString(parsed.data.subjectLine),
        previewText: nullableString(parsed.data.previewText),
        bodyMarkdown: parsed.data.bodyMarkdown,
        founderBio: nullableString(parsed.data.founderBio),
        keyPoints: parsed.data.keyPoints,
        callToAction: nullableString(parsed.data.callToAction),
        status: parsed.data.status,
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ success: true, draft })
    }

    const outreach = await updatePrOutreach({
      id: parsed.data.id,
      status: parsed.data.status,
      subject: nullableString(parsed.data.subject),
      messageExcerpt: nullableString(parsed.data.messageExcerpt),
      respondedAt: nullableDateTime(parsed.data.respondedAt),
      nextFollowUpAt: nullableDateTime(parsed.data.nextFollowUpAt),
      outcome: nullableString(parsed.data.outcome),
      actorUserId: adminCheck.user?.id || null,
    })
    return NextResponse.json({ success: true, outreach })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update PR engine item.' },
      { status: 500 }
    )
  }
}
