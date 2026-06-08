import type { SupabaseClient } from '@supabase/supabase-js';

import {
  clusterLabels,
  type AeoTopic,
  vestblockAeoTopics,
} from '@/lib/aeo/topics';
import type { VestBlockServiceKey } from '@/lib/content/marketingServices';
import type { SeedContentAsset } from '@/lib/content/seedAssets';

type SupabaseLike = SupabaseClient<any, 'public', any>;

function getTopicLanguage(topic: AeoTopic): 'en' | 'es' {
  return topic.language ||
    topic.offerPath.startsWith('/es/') ||
    /espanol/i.test(topic.slug)
    ? 'es'
    : 'en';
}

function getTopicServiceKey(topic: AeoTopic): VestBlockServiceKey {
  if (topic.offerPath === '/dealvault') return 'dealvault';
  if (topic.offerPath === '/dealvault/demo') return 'dealvault';
  if (topic.offerPath === '/dealvault/demo-record') return 'dealvault';
  if (topic.offerPath === '/smart-contracts') return 'dealvault';
  if (topic.offerPath === '/tools/business-credit') return 'business_credit';
  if (topic.offerPath === '/tools/grants') return 'grants';
  if (topic.offerPath === '/business-setup') return 'business_setup';
  if (topic.offerPath === '/visibility-expansion') return 'visibility_expansion';
  if (topic.offerPath === '/ai-assistant') return 'ai_assistant';
  if (topic.offerPath === '/services/ai-credit-analysis') return 'ai_credit_analysis';
  if (topic.offerPath === '/funding/business-funding-strategy') return 'business_funding';
  if (topic.offerPath === '/real-estate-funding') return 'real_estate_funding';
  if (topic.offerPath === '/es/vestblock') return 'spanish_business_funding';
  if (topic.offerPath === '/funding') return 'business_funding';
  if (topic.offerPath === '/tools/my-dispute-letters') {
    return 'credit_dispute_letters';
  }
  if (topic.offerPath === '/dashboard') return 'financial_growth_services';
  return topic.cluster === 'business-credit'
    ? 'business_credit'
    : topic.cluster === 'funding'
      ? 'business_funding'
      : 'ai_credit_analysis';
}

function formatSectionList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n');
}

function formatFaqs(topic: AeoTopic) {
  return topic.faqs
    .map((faq) => `### ${faq.question}\n\n${faq.answer}`)
    .join('\n\n');
}

function buildBodyMarkdown(topic: AeoTopic) {
  const clusterLabel = clusterLabels[topic.cluster];
  const language = getTopicLanguage(topic);

  if (language === 'es') {
    return `# ${topic.title}

${topic.overview}

## Para quien es esta guia

${topic.audience}

## Lo mas importante antes de avanzar

${formatSectionList(topic.keyTakeaways)}

## Pasos practicos

${formatSectionList(topic.actionSteps)}

## Como encaja VestBlock

VestBlock te ayuda a organizar el siguiente paso antes de apresurarte a una aplicacion, una disputa o una decision de financiamiento. Esta pagina forma parte de la biblioteca de ${clusterLabel}, asi que la meta es explicarte el tema con claridad y conectarlo con una ruta real dentro de la plataforma.

## Preguntas frecuentes

${formatFaqs(topic)}

## Listo para el siguiente paso?

Usa VestBlock para pasar de la investigacion a un plan mas claro, con expectativas realistas, mejor documentacion y mejor seguimiento.
`;
  }

  return `# ${topic.title}

${topic.overview}

## Who this page is for

${topic.audience}

## What to know first

${formatSectionList(topic.keyTakeaways)}

## Practical next steps

${formatSectionList(topic.actionSteps)}

## How VestBlock fits in

VestBlock helps you organize the next step before you rush into an application, dispute, or funding decision. This page is part of the ${clusterLabel} library, so the goal is to make the topic easier to understand and easier to act on with a real process behind it.

## FAQ

${formatFaqs(topic)}

## Ready for the next step?

Use VestBlock to move from research into a cleaner action plan with realistic expectations, better documentation, and clearer follow-through.
`;
}

function buildExcerpt(topic: AeoTopic) {
  return topic.overview.length <= 220
    ? topic.overview
    : `${topic.overview.slice(0, 217).trimEnd()}...`;
}

export function buildTopicSeedContentAsset(topic: AeoTopic): SeedContentAsset {
  const language = getTopicLanguage(topic);

  return {
    slug: topic.slug,
    title: topic.title,
    contentType: 'seo_page',
    serviceKey: getTopicServiceKey(topic),
    language,
    audience: topic.audience,
    platform: 'manual',
    postType: 'aeo topic page',
    seoTitle: `${topic.title} | VestBlock`,
    metaDescription: topic.metaDescription,
    excerpt: buildExcerpt(topic),
    bodyMarkdown: buildBodyMarkdown(topic),
    ctaLabel:
      language === 'es' ? 'Abrir ruta en VestBlock' : 'Open VestBlock Route',
    ctaUrl: topic.offerPath,
  };
}

export const vestblockTopicSeedContentAssets: SeedContentAsset[] =
  vestblockAeoTopics.map(buildTopicSeedContentAsset);

export async function seedVestblockTopicContentAssets(input: {
  supabase: SupabaseLike;
  actorUserId?: string | null;
  publish?: boolean;
  overwrite?: boolean;
  slugs?: string[];
  clusters?: AeoTopic['cluster'][];
  limit?: number;
}) {
  const filteredBySlug = input.slugs?.length
    ? vestblockTopicSeedContentAssets.filter((asset) =>
        input.slugs?.includes(asset.slug)
      )
    : vestblockTopicSeedContentAssets;

  const filteredByCluster = input.clusters?.length
    ? filteredBySlug.filter((asset) => {
        const topic = vestblockAeoTopics.find((entry) => entry.slug === asset.slug);
        return topic ? input.clusters?.includes(topic.cluster) : false;
      })
    : filteredBySlug;

  const selectedAssets =
    typeof input.limit === 'number' && input.limit > 0
      ? filteredByCluster.slice(0, input.limit)
      : filteredByCluster;

  const status = input.publish === false ? 'draft' : 'published';
  const now = new Date().toISOString();
  let assetsToPersist = selectedAssets;

  if (input.overwrite === false && selectedAssets.length > 0) {
    const { data: existingAssets, error: existingError } = await input.supabase
      .from('content_assets')
      .select('slug')
      .in(
        'slug',
        selectedAssets.map((asset) => asset.slug)
      );

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingSlugs = new Set(
      (existingAssets || []).map((asset: { slug: string }) => asset.slug)
    );
    assetsToPersist = selectedAssets.filter((asset) => !existingSlugs.has(asset.slug));
  }

  const uniqueAssetsToPersist = Array.from(
    new Map(assetsToPersist.map((asset) => [asset.slug, asset])).values()
  );

  const payload = uniqueAssetsToPersist.map((asset) => ({
    created_by: input.actorUserId ?? null,
    title: asset.title,
    slug: asset.slug,
    content_type: asset.contentType,
    service_key: asset.serviceKey,
    language: asset.language,
    audience: asset.audience,
    prompt: 'Seeded by VestBlock topic publishing.',
    status,
    platform: asset.platform,
    post_type: asset.postType,
    seo_title: asset.seoTitle ?? null,
    meta_description: asset.metaDescription ?? null,
    excerpt: asset.excerpt ?? null,
    body_markdown: asset.bodyMarkdown,
    social_caption: asset.socialCaption ?? null,
    hashtags: asset.hashtags ?? [],
    cta_label: asset.ctaLabel,
    cta_url: asset.ctaUrl,
    publish_path: `/resources/${asset.slug}`,
    metadata_json: {
      generatedBy: 'seed-batch',
      seededAt: now,
      source: 'vestblock-aeo-topics',
    },
    created_at: now,
    updated_at: now,
    published_at: status === 'published' ? now : null,
  }));

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await input.supabase
    .from('content_assets')
    .upsert(payload, { onConflict: 'slug' })
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
