import type { SupabaseClient } from '@supabase/supabase-js'

import { vestblockAeoTopics, type AeoTopic } from '@/lib/aeo/topics'
import { buildTopicSeedContentAsset, seedVestblockTopicContentAssets } from '@/lib/content/topicSeedAssets'
import { logEvent } from '@/lib/system/logEvent'

type SupabaseLike = SupabaseClient<any, 'public', any>

type ContentAssetRow = {
  id: string
  slug: string
  title: string
  content_type: string
  service_key: string | null
  language: string | null
  status: 'draft' | 'ready' | 'published' | 'archived'
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

type DailyPublishOptions = {
  supabase: SupabaseLike
  actorUserId?: string | null
  limit?: number
  clusters?: AeoTopic['cluster'][]
  preferSpanish?: boolean
  dryRun?: boolean
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseClusters(value: string | undefined): AeoTopic['cluster'][] | undefined {
  if (!value) return undefined
  const allowed = new Set<AeoTopic['cluster']>([
    'credit-repair',
    'business-credit',
    'funding',
    'credit-builder',
    'disputes',
  ])
  const clusters = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is AeoTopic['cluster'] => allowed.has(item as AeoTopic['cluster']))
  return clusters.length ? clusters : undefined
}

function sortDraftPublishQueue(rows: ContentAssetRow[]) {
  return [...rows].sort((a, b) => {
    const statusWeight = (value: ContentAssetRow['status']) => (value === 'ready' ? 2 : value === 'draft' ? 1 : 0)
    const languageWeight = (value: string | null) => (value === 'es' ? 1 : 0)
    const statusDelta = statusWeight(b.status) - statusWeight(a.status)
    if (statusDelta !== 0) return statusDelta
    const languageDelta = languageWeight(b.language) - languageWeight(a.language)
    if (languageDelta !== 0) return languageDelta
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
    return aTime - bTime
  })
}

function topicIntentWeight(topic: AeoTopic) {
  switch (topic.intent) {
    case 'lead-capture':
      return 12
    case 'comparison':
      return 8
    case 'tool-support':
      return 6
    case 'education':
    default:
      return 4
  }
}

function getTopicLanguage(topic: AeoTopic) {
  return topic.language || topic.offerPath.startsWith('/es/') || /espanol/i.test(topic.slug) ? 'es' : 'en'
}

function chooseTopicsToPublish(input: {
  limit: number
  existingSlugs: Set<string>
  publishedAssets: ContentAssetRow[]
  clusters?: AeoTopic['cluster'][]
  preferSpanish: boolean
}) {
  const publishedByService = new Map<string, number>()
  const publishedByCluster = new Map<AeoTopic['cluster'], number>()

  for (const asset of input.publishedAssets) {
    if (asset.service_key) {
      publishedByService.set(asset.service_key, (publishedByService.get(asset.service_key) || 0) + 1)
    }
    const topic = vestblockAeoTopics.find((entry) => entry.slug === asset.slug)
    if (topic) {
      publishedByCluster.set(topic.cluster, (publishedByCluster.get(topic.cluster) || 0) + 1)
    }
  }

  const candidates = vestblockAeoTopics
    .filter((topic) => !input.existingSlugs.has(topic.slug))
    .filter((topic) => !input.clusters?.length || input.clusters.includes(topic.cluster))
    .map((topic) => {
      const asset = buildTopicSeedContentAsset(topic)
      const language = getTopicLanguage(topic)
      const serviceCoverage = publishedByService.get(asset.serviceKey) || 0
      const clusterCoverage = publishedByCluster.get(topic.cluster) || 0
      const score =
        topicIntentWeight(topic) +
        (input.preferSpanish && language === 'es' ? 30 : 0) +
        (serviceCoverage === 0 ? 20 : Math.max(0, 8 - serviceCoverage)) +
        (clusterCoverage === 0 ? 14 : Math.max(0, 6 - clusterCoverage))

      return { topic, score, language, serviceCoverage, clusterCoverage }
    })

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.language !== b.language) return a.language === 'es' ? -1 : 1
    return a.topic.title.localeCompare(b.topic.title)
  })

  return candidates.slice(0, input.limit).map((entry) => entry.topic)
}

export function getDailyPublisherConfigFromEnv() {
  return {
    limit: parsePositiveInteger(process.env.DAILY_CONTENT_PUBLISH_LIMIT, 2),
    preferSpanish: parseBoolean(process.env.DAILY_CONTENT_PUBLISH_PREFER_SPANISH, true),
    clusters: parseClusters(process.env.DAILY_CONTENT_PUBLISH_CLUSTERS),
  }
}

export async function runDailyContentPublisher(options: DailyPublishOptions) {
  const limit = options.limit && options.limit > 0 ? options.limit : 2
  const preferSpanish = options.preferSpanish ?? true
  const now = new Date().toISOString()

  const { data: assets, error } = await options.supabase
    .from('content_assets')
    .select('id,slug,title,content_type,service_key,language,status,created_at,updated_at,published_at')
    .eq('content_type', 'seo_page')
    .order('updated_at', { ascending: true })
    .limit(1000)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (assets || []) as ContentAssetRow[]
  const publishedAssets = rows.filter((row) => row.status === 'published')
  const unpublishedAssets = sortDraftPublishQueue(
    rows.filter((row) => row.status === 'draft' || row.status === 'ready')
  )

  const publishExisting = unpublishedAssets.slice(0, limit)
  const remainingSlots = Math.max(0, limit - publishExisting.length)

  const existingSlugs = new Set(rows.map((row) => row.slug))
  const topicsToSeed =
    remainingSlots > 0
      ? chooseTopicsToPublish({
          limit: remainingSlots,
          existingSlugs,
          publishedAssets,
          clusters: options.clusters,
          preferSpanish,
        })
      : []

  if (options.dryRun) {
    return {
      publishedExistingCount: publishExisting.length,
      seededNewCount: topicsToSeed.length,
      publishedExisting: publishExisting,
      seededTopics: topicsToSeed.map((topic) => ({
        slug: topic.slug,
        title: topic.title,
        cluster: topic.cluster,
        language: getTopicLanguage(topic),
      })),
      limit,
      preferSpanish,
    }
  }

  let publishedExistingCount = 0
  let seededNewCount = 0

  if (publishExisting.length > 0) {
    const ids = publishExisting.map((asset) => asset.id)
    const { error: publishError } = await options.supabase
      .from('content_assets')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
      })
      .in('id', ids)

    if (publishError) {
      throw new Error(publishError.message)
    }

    publishedExistingCount = publishExisting.length

    await Promise.all(
      publishExisting.map((asset) =>
        logEvent({
          eventType: 'content_published',
          actorUserId: options.actorUserId ?? null,
          entityType: 'content_asset',
          entityId: asset.id,
          metadata: {
            source: 'daily-content-publisher',
            slug: asset.slug,
            title: asset.title,
          },
        })
      )
    )
  }

  if (topicsToSeed.length > 0) {
    const seeded = await seedVestblockTopicContentAssets({
      supabase: options.supabase,
      actorUserId: options.actorUserId ?? null,
      publish: true,
      overwrite: false,
      slugs: topicsToSeed.map((topic) => topic.slug),
    })
    seededNewCount = seeded.length
  }

  await logEvent({
    eventType: 'content_published',
    actorUserId: options.actorUserId ?? null,
    entityType: 'content_batch',
    entityId: null,
    metadata: {
      source: 'daily-content-publisher',
      publishedExistingCount,
      seededNewCount,
      totalPublished: publishedExistingCount + seededNewCount,
      limit,
      preferSpanish,
      clusters: options.clusters ?? null,
    },
  })

  return {
    publishedExistingCount,
    seededNewCount,
    publishedExisting: publishExisting,
    seededTopics: topicsToSeed.map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      cluster: topic.cluster,
      language: getTopicLanguage(topic),
    })),
    limit,
    preferSpanish,
  }
}
