import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import {
  VIDEO_CONTENT_TYPES,
  assertVideoApprovalTransition,
  buildHeyGenRendererPrompt,
  buildVideoContentSnapshot,
  evaluateVideoLearning,
  videoMetadataSchema,
  videoPerformanceSnapshotSchema,
  type VideoApprovalStatus,
  type VideoContentAssetRow,
  type VideoPerformanceSnapshot,
} from '@/lib/content/video/contentSystem'
import { seedVestBlockVideoPilots } from '@/lib/content/video/pilotSeed'
import { logEvent } from '@/lib/system/logEvent'
import { createAdminClient } from '@/lib/supabase/admin'

const videoSelect =
  'id,parent_content_id,title,slug,content_type,service_key,language,audience,prompt,status,platform,post_type,body_markdown,cta_label,cta_url,metadata_json,approval_status,approved_by,approved_at,published_at,created_at,updated_at'

const postSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('seed_pilots') }),
  z.object({
    action: z.literal('register_render'),
    scriptId: z.string().uuid(),
    renderUrl: z.string().url().max(2000),
    heygenVideoId: z.string().max(240).optional(),
    heygenSessionId: z.string().max(240).optional(),
    actualDurationSeconds: z.number().min(0).max(3600).optional(),
    thumbnailUrls: z.array(z.string().url().max(2000)).max(10).optional(),
    costEstimate: z.number().min(0).optional(),
  }),
  z.object({
    action: z.literal('record_performance'),
    renderId: z.string().uuid(),
    snapshot: videoPerformanceSnapshotSchema,
  }),
])

const patchSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approve', 'request_changes', 'reject', 'resubmit']),
  reviewNotes: z.string().min(3).max(2000).optional(),
  complianceApproved: z.boolean().optional(),
  rightsApproved: z.boolean().optional(),
  syntheticDisclosureApplied: z.boolean().optional(),
  factCheckedBy: z.string().max(240).optional(),
})

function isVideoContentType(value: string) {
  return VIDEO_CONTENT_TYPES.includes(value as (typeof VIDEO_CONTENT_TYPES)[number])
}

async function loadVideoRows() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_assets')
    .select(videoSelect)
    .in('content_type', [...VIDEO_CONTENT_TYPES])
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) throw error
  return (data || []) as VideoContentAssetRow[]
}

async function registerPrivateRender(input: {
  scriptId: string
  renderUrl: string
  heygenVideoId?: string
  heygenSessionId?: string
  actualDurationSeconds?: number
  thumbnailUrls?: string[]
  costEstimate?: number
  actorUserId: string | null
}) {
  const admin = createAdminClient()
  const { data: script, error: scriptError } = await admin
    .from('content_assets')
    .select(videoSelect)
    .eq('id', input.scriptId)
    .single()

  if (scriptError) throw scriptError
  if (script.content_type !== 'video_script' || script.approval_status !== 'approved') {
    throw new Error('A private render can only be registered from an approved video script.')
  }

  const parsedMetadata = videoMetadataSchema.safeParse(script.metadata_json || {})
  if (!parsedMetadata.success || !parsedMetadata.data.renderer_prompt) {
    throw new Error('The approved script does not have a valid renderer prompt.')
  }

  const now = new Date().toISOString()
  const metadata = videoMetadataSchema.parse({
    ...parsedMetadata.data,
    asset_kind: 'video_render',
    generator: 'heygen_video_agent',
    render_status: 'completed',
    publication_status: 'private',
    render_url: input.renderUrl,
    heygen_video_id: input.heygenVideoId || null,
    heygen_session_id: input.heygenSessionId || null,
    actual_duration_seconds: input.actualDurationSeconds ?? null,
    thumbnail_variants: input.thumbnailUrls || [],
    cost_estimate: input.costEstimate ?? null,
  })
  const renderSlug = `${script.slug}-render-${Date.now().toString(36)}`
  const { data, error } = await admin
    .from('content_assets')
    .insert({
      parent_content_id: script.id,
      created_by: input.actorUserId,
      title: String(script.title).replace(/ — Script$/, ' — Private Render'),
      slug: renderSlug,
      content_type: 'video_render',
      service_key: script.service_key,
      language: script.language,
      audience: script.audience,
      prompt: metadata.renderer_prompt,
      status: 'draft',
      approval_status: 'review_required',
      platform: script.platform,
      post_type: script.post_type,
      body_markdown: `Private render created ${now}. Review the video, captions, claims, rights, disclosure, CTA, and destination before approval.`,
      cta_label: script.cta_label,
      cta_url: script.cta_url,
      metadata_json: metadata,
      updated_at: now,
    })
    .select(videoSelect)
    .single()

  if (error) throw error
  await logEvent({
    eventType: 'content_generated',
    actorUserId: input.actorUserId,
    entityType: 'video_render',
    entityId: data.id,
    metadata: { source: 'heygen', visibility: 'private', publicPublishing: false },
  })
  return data as VideoContentAssetRow
}

async function recordPerformance(input: {
  renderId: string
  snapshot: VideoPerformanceSnapshot
  actorUserId: string | null
}) {
  const admin = createAdminClient()
  const { data: render, error: renderError } = await admin
    .from('content_assets')
    .select(videoSelect)
    .eq('id', input.renderId)
    .single()

  if (renderError) throw renderError
  if (render.content_type !== 'video_render' || render.status !== 'published') {
    throw new Error('Performance may only be recorded for a published video render.')
  }

  const parsedMetadata = videoMetadataSchema.safeParse(render.metadata_json || {})
  if (!parsedMetadata.success) throw new Error('The video render metadata is invalid.')
  if (input.snapshot.contentId !== parsedMetadata.data.content_id) {
    throw new Error('The performance snapshot does not match the video content ID.')
  }

  const snapshots = parsedMetadata.data.performance_snapshots
    .map((snapshot) => videoPerformanceSnapshotSchema.safeParse(snapshot))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter(
      (snapshot) =>
        !(
          snapshot.window === input.snapshot.window &&
          snapshot.trafficSource === input.snapshot.trafficSource &&
          snapshot.hypothesisKey === input.snapshot.hypothesisKey
        )
    )
  snapshots.push(input.snapshot)

  const metadata = videoMetadataSchema.parse({
    ...parsedMetadata.data,
    performance_snapshots: snapshots,
  })
  const { error: updateError } = await admin
    .from('content_assets')
    .update({ metadata_json: metadata, updated_at: new Date().toISOString() })
    .eq('id', render.id)
  if (updateError) throw updateError

  const { data: improvementRun, error: runError } = await admin
    .from('improvement_runs')
    .insert({
      run_type: 'content_optimization',
      status: 'running',
      window_ended_at: new Date().toISOString(),
      data_sources_json: [
        {
          source: 'content_assets',
          contentAssetId: render.id,
          measurementWindow: input.snapshot.window,
        },
      ],
    })
    .select('id')
    .single()
  if (runError) throw runError

  const { error: experimentError } = await admin.from('experiment_results').insert({
    run_id: improvementRun.id,
    experiment_key: input.snapshot.hypothesisKey,
    category: 'video_content',
    variant_key: `${input.snapshot.contentId}:${input.snapshot.window}`,
    baseline_key: null,
    metrics_json: input.snapshot,
    winner: false,
    notes: input.snapshot.simulated
      ? 'Simulated snapshot retained for testing only; excluded from learning.'
      : 'Real video performance snapshot.',
  })
  if (experimentError) throw experimentError

  const rows = await loadVideoRows()
  const allSnapshots = rows.flatMap((row) => {
    const parsed = videoMetadataSchema.safeParse(row.metadata_json || {})
    if (!parsed.success) return []
    return parsed.data.performance_snapshots
      .map((snapshot) => videoPerformanceSnapshotSchema.safeParse(snapshot))
      .filter((result) => result.success)
      .map((result) => result.data)
  })
  const proposal = evaluateVideoLearning(allSnapshots).find(
    (candidate) => candidate.hypothesisKey === input.snapshot.hypothesisKey
  )

  if (proposal && proposal.comparableAssets >= 2) {
    const { error: insightError } = await admin.from('improvement_insights').insert({
      run_id: improvementRun.id,
      category: 'video_content',
      severity: proposal.eligible ? 'action' : 'watch',
      title: proposal.eligible
        ? `Video hypothesis ready for review: ${proposal.hypothesisKey}`
        : `Early video signal: ${proposal.hypothesisKey}`,
      summary: proposal.reason,
      supporting_data: proposal,
      recommendation: proposal.eligible
        ? 'Review the evidence before changing the relevant video prompt or format default.'
        : 'Collect more comparable real assets and measurement windows.',
      confidence: proposal.confidence === 'high' ? 0.9 : proposal.confidence === 'medium' ? 0.7 : 0.35,
      auto_applied: false,
    })
    if (insightError) throw insightError
  }

  let queuedStrategyUpdate = false
  if (proposal?.eligible) {
    const { data: existingUpdate, error: existingUpdateError } = await admin
      .from('strategy_updates')
      .select('id')
      .eq('category', 'video_content')
      .eq('target_type', 'video_prompt_default')
      .eq('target_key', proposal.hypothesisKey)
      .eq('approval_status', 'queued')
      .maybeSingle()
    if (existingUpdateError) throw existingUpdateError

    if (!existingUpdate) {
      const { error: strategyError } = await admin.from('strategy_updates').insert({
        run_id: improvementRun.id,
        category: 'video_content',
        target_type: 'video_prompt_default',
        target_key: proposal.hypothesisKey,
        risk_level: 'medium',
        approval_status: 'queued',
        title: `Review video learning: ${proposal.hypothesisKey}`,
        rationale: proposal.reason,
        proposed_change_json: proposal,
        applied_change_json: {},
        requires_admin_review: true,
      })
      if (strategyError) throw strategyError
      queuedStrategyUpdate = true
    }
  }

  const { error: finishRunError } = await admin
    .from('improvement_runs')
    .update({
      status: 'completed',
      summary_json: {
        hypothesisKey: input.snapshot.hypothesisKey,
        simulated: input.snapshot.simulated,
        learning: proposal || null,
      },
      auto_applied_count: 0,
      queued_count: queuedStrategyUpdate ? 1 : 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', improvementRun.id)
  if (finishRunError) throw finishRunError

  await logEvent({
    eventType: 'admin_action',
    actorUserId: input.actorUserId,
    entityType: 'video_performance_snapshot',
    entityId: render.id,
    metadata: {
      window: input.snapshot.window,
      simulated: input.snapshot.simulated,
      learningEligible: proposal?.eligible || false,
    },
  })

  return { snapshot: input.snapshot, learning: proposal || null }
}

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    )
  }

  try {
    const rows = await loadVideoRows()
    return NextResponse.json({ videoContent: buildVideoContentSnapshot(rows) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load video content.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    )
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid video content request.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.action === 'seed_pilots') {
      const result = await seedVestBlockVideoPilots({
        supabase: createAdminClient(),
        actorUserId: adminCheck.user?.id || null,
      })
      const rows = await loadVideoRows()
      return NextResponse.json({ result, videoContent: buildVideoContentSnapshot(rows) })
    }

    if (parsed.data.action === 'register_render') {
      const render = await registerPrivateRender({
        ...parsed.data,
        actorUserId: adminCheck.user?.id || null,
      })
      return NextResponse.json({ render })
    }

    const result = await recordPerformance({
      renderId: parsed.data.renderId,
      snapshot: parsed.data.snapshot,
      actorUserId: adminCheck.user?.id || null,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update video content.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    )
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid video review request.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const { data: asset, error: assetError } = await admin
      .from('content_assets')
      .select(videoSelect)
      .eq('id', parsed.data.id)
      .single()

    if (assetError) throw assetError
    if (!isVideoContentType(String(asset.content_type))) {
      return NextResponse.json({ error: 'This asset is not part of the video content system.' }, { status: 409 })
    }

    const currentApproval = (asset.approval_status || 'not_required') as VideoApprovalStatus
    const nextApproval: VideoApprovalStatus =
      parsed.data.decision === 'approve'
        ? 'approved'
        : parsed.data.decision === 'request_changes'
          ? 'changes_requested'
          : parsed.data.decision === 'reject'
            ? 'rejected'
            : 'review_required'
    assertVideoApprovalTransition(currentApproval, nextApproval)

    const parsedMetadata = videoMetadataSchema.safeParse(asset.metadata_json || {})
    if (!parsedMetadata.success) {
      return NextResponse.json({ error: 'The video asset metadata is invalid.' }, { status: 409 })
    }

    let metadata = parsedMetadata.data
    const now = new Date().toISOString()
    const notes = parsed.data.reviewNotes
      ? [...metadata.review_notes, parsed.data.reviewNotes]
      : metadata.review_notes

    if (parsed.data.decision === 'approve' && asset.content_type === 'video_script') {
      metadata = videoMetadataSchema.parse({
        ...metadata,
        compliance_review_status: 'approved',
        rights_review_status: 'not_required',
        fact_checked_by: parsed.data.factCheckedBy || adminCheck.user?.id || null,
        renderer_prompt: buildHeyGenRendererPrompt({
          metadata,
          approvalStatus: 'approved',
        }),
        review_notes: notes,
      })
    } else if (parsed.data.decision === 'approve' && asset.content_type === 'video_render') {
      if (!parsed.data.complianceApproved || !parsed.data.rightsApproved) {
        return NextResponse.json(
          { error: 'Compliance and rights review are required before approving a render.' },
          { status: 409 }
        )
      }
      if (
        metadata.synthetic_media_disclosure === 'required' &&
        !parsed.data.syntheticDisclosureApplied
      ) {
        return NextResponse.json(
          { error: 'Synthetic-media disclosure must be applied before approving this render.' },
          { status: 409 }
        )
      }
      metadata = videoMetadataSchema.parse({
        ...metadata,
        compliance_review_status: 'approved',
        rights_review_status: 'approved',
        synthetic_media_disclosure:
          metadata.synthetic_media_disclosure === 'required' ? 'applied' : metadata.synthetic_media_disclosure,
        fact_checked_by: parsed.data.factCheckedBy || adminCheck.user?.id || null,
        review_notes: notes,
      })
    } else {
      metadata = videoMetadataSchema.parse({
        ...metadata,
        renderer_prompt:
          asset.content_type === 'video_script' && nextApproval !== 'approved'
            ? null
            : metadata.renderer_prompt,
        review_notes: notes,
      })
    }

    const status =
      nextApproval === 'approved'
        ? 'ready'
        : nextApproval === 'rejected'
          ? 'archived'
          : 'draft'
    const { data, error } = await admin
      .from('content_assets')
      .update({
        approval_status: nextApproval,
        approved_by: nextApproval === 'approved' ? adminCheck.user?.id || null : null,
        approved_at: nextApproval === 'approved' ? now : null,
        status,
        metadata_json: metadata,
        updated_at: now,
      })
      .eq('id', asset.id)
      .select(videoSelect)
      .single()

    if (error) throw error
    await logEvent({
      eventType: 'admin_action',
      actorUserId: adminCheck.user?.id || null,
      entityType: asset.content_type,
      entityId: asset.id,
      metadata: { decision: parsed.data.decision, approvalStatus: nextApproval },
    })
    return NextResponse.json({ videoAsset: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to review video content.'
    const status = /cannot move|approval is required/i.test(message) ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
