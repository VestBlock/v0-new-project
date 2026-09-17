import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildVideoRenderAttemptKey,
  videoMetadataSchema,
  type VideoContentAssetRow,
} from '@/lib/content/video/contentSystem'
import { getHeyGenVideo } from '@/lib/content/video/heyGenClient'
import { logEvent } from '@/lib/system/logEvent'

type SupabaseLike = SupabaseClient<any, 'public', any>

function renderSlugToken(input: {
  heygenVideoId?: string | null
  heygenSessionId?: string | null
  renderUrl: string
}) {
  const token =
    input.heygenVideoId ||
    input.heygenSessionId ||
    createHash('sha256').update(input.renderUrl).digest('hex').slice(0, 20)
  return token.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

export function buildPrivateVideoRenderPayload(input: {
  script: VideoContentAssetRow
  renderUrl: string
  heygenVideoId?: string | null
  heygenSessionId?: string | null
  actualDurationSeconds?: number | null
  thumbnailUrls?: string[]
  costEstimate?: number | null
  actorUserId?: string | null
  now?: Date
}) {
  if (input.script.content_type !== 'video_script' || input.script.approval_status !== 'approved') {
    throw new Error('A private render can only be registered from an approved video script.')
  }

  const parsedMetadata = videoMetadataSchema.safeParse(input.script.metadata_json || {})
  if (!parsedMetadata.success || !parsedMetadata.data.renderer_prompt) {
    throw new Error('The approved script does not have a valid renderer prompt.')
  }

  let parsedRenderUrl: URL
  try {
    parsedRenderUrl = new URL(input.renderUrl)
  } catch {
    throw new Error('The private render URL is invalid.')
  }
  if (parsedRenderUrl.protocol !== 'https:') {
    throw new Error('The private render URL must use HTTPS.')
  }

  const now = (input.now || new Date()).toISOString()
  const metadata = videoMetadataSchema.parse({
    ...parsedMetadata.data,
    asset_kind: 'video_render',
    generator: 'heygen_video_agent',
    render_status: 'completed',
    publication_status: 'private',
    render_url: parsedRenderUrl.toString(),
    render_url_source: input.heygenVideoId ? 'provider_ephemeral' : 'external',
    render_url_refreshed_at: now,
    heygen_video_id: input.heygenVideoId || null,
    heygen_session_id: input.heygenSessionId || null,
    render_completed_at: now,
    render_error: null,
    render_attempt_key:
      parsedMetadata.data.render_attempt_key || buildVideoRenderAttemptKey(input.script),
    actual_duration_seconds: input.actualDurationSeconds ?? null,
    thumbnail_variants: input.thumbnailUrls || [],
    cost_estimate: input.costEstimate ?? null,
  })

  return {
    parent_content_id: input.script.id,
    created_by: input.actorUserId || null,
    title: String(input.script.title).replace(/ — Script$/, ' — Private Render'),
    slug: `${input.script.slug}-render-${renderSlugToken(input)}`,
    content_type: 'video_render' as const,
    service_key: input.script.service_key,
    language: input.script.language,
    audience: input.script.audience,
    prompt: metadata.renderer_prompt,
    status: 'draft' as const,
    approval_status: 'review_required' as const,
    platform: input.script.platform,
    post_type: input.script.post_type,
    body_markdown: `Private render created ${now}. Review the video, captions, claims, rights, disclosure, CTA, and destination before approval.`,
    cta_label: input.script.cta_label,
    cta_url: input.script.cta_url,
    metadata_json: metadata,
    updated_at: now,
  }
}

export async function createPrivateVideoRender(input: {
  supabase: SupabaseLike
  script: VideoContentAssetRow
  renderUrl: string
  heygenVideoId?: string | null
  heygenSessionId?: string | null
  actualDurationSeconds?: number | null
  thumbnailUrls?: string[]
  costEstimate?: number | null
  actorUserId?: string | null
  now?: Date
}) {
  const payload = buildPrivateVideoRenderPayload(input)

  const { data: existing, error: existingError } = await input.supabase
    .from('content_assets')
    .select('*')
    .eq('slug', payload.slug)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing as VideoContentAssetRow

  const { data, error } = await input.supabase
    .from('content_assets')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error

  await logEvent({
    eventType: 'content_generated',
    actorUserId: input.actorUserId || null,
    entityType: 'video_render',
    entityId: data.id,
    metadata: { source: 'heygen', visibility: 'private', publicPublishing: false },
  })

  return data as VideoContentAssetRow
}

/**
 * HeyGen returns a pre-signed, expiring media URL. The provider video ID is the
 * stable reference; refresh the URL at the authenticated review/publish seam
 * instead of treating the stored URL as durable media storage.
 */
export async function refreshHeyGenPrivateRenderUrl(input: {
  supabase: SupabaseLike
  render: VideoContentAssetRow
  apiKey: string
  fetchImpl?: typeof fetch
  now?: Date
}) {
  if (input.render.content_type !== 'video_render') {
    throw new Error('Only a private video render can refresh its provider URL.')
  }

  const parsedMetadata = videoMetadataSchema.safeParse(input.render.metadata_json || {})
  if (!parsedMetadata.success) throw new Error('The private render metadata is invalid.')
  const metadata = parsedMetadata.data
  if (metadata.generator !== 'heygen_video_agent' || !metadata.heygen_video_id) {
    return input.render
  }
  if (!input.render.updated_at) {
    throw new Error('The private render revision is required before refreshing its URL.')
  }

  const video = await getHeyGenVideo({
    apiKey: input.apiKey,
    videoId: metadata.heygen_video_id,
    fetchImpl: input.fetchImpl,
  })
  if (video.status !== 'completed' || !video.videoUrl) {
    throw new Error('HeyGen does not currently expose a completed private render URL.')
  }

  let parsedRenderUrl: URL
  try {
    parsedRenderUrl = new URL(video.videoUrl)
  } catch {
    throw new Error('HeyGen returned an invalid private render URL.')
  }
  if (parsedRenderUrl.protocol !== 'https:') {
    throw new Error('HeyGen returned a non-HTTPS private render URL.')
  }

  const refreshedAt = (input.now || new Date()).toISOString()
  const refreshedMetadata = videoMetadataSchema.parse({
    ...metadata,
    render_url: parsedRenderUrl.toString(),
    render_url_source: 'provider_ephemeral',
    render_url_refreshed_at: refreshedAt,
    thumbnail_variants: video.thumbnailUrl ? [video.thumbnailUrl] : metadata.thumbnail_variants,
    actual_duration_seconds: video.durationSeconds ?? metadata.actual_duration_seconds,
  })
  const { data, error } = await input.supabase
    .from('content_assets')
    .update({ metadata_json: refreshedMetadata, updated_at: refreshedAt })
    .eq('id', input.render.id)
    .eq('updated_at', input.render.updated_at)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error('The private render changed while its provider URL was refreshing; retry the read.')
  }
  return data as VideoContentAssetRow
}
