import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkAdminAccess } from '@/lib/auth/admin';
import {
  generateMarketingContent,
  type ContentAssetStatus,
} from '@/lib/content/contentGenerator';
import {
  vestblockMarketingServices,
  type VestBlockServiceKey,
} from '@/lib/content/marketingServices';
import { logEvent } from '@/lib/system/logEvent';
import { createAdminClient } from '@/lib/supabase/admin';

const serviceKeys = vestblockMarketingServices.map((service) => service.key) as [
  string,
  ...string[],
];

const generateSchema = z.object({
  contentType: z.enum(['seo_page', 'social_post', 'campaign']),
  serviceKey: z.enum(serviceKeys),
  prompt: z.string().max(2000).optional().default(''),
  audience: z.string().max(500).optional().default(''),
  language: z.enum(['en', 'es']).optional().default('en'),
  platform: z.string().max(80).optional().default('manual'),
  postType: z.string().max(120).optional().default('educational'),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'ready', 'published', 'archived']).optional(),
  title: z.string().min(3).max(180).optional(),
  seoTitle: z.string().max(180).optional().nullable(),
  metaDescription: z.string().max(220).optional().nullable(),
  excerpt: z.string().max(600).optional().nullable(),
  bodyMarkdown: z.string().min(1).max(30000).optional(),
  socialCaption: z.string().max(5000).optional().nullable(),
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const parsed = generateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid content generation request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY is required before the admin content generator can create new drafts.',
      },
      { status: 503 }
    );
  }

  try {
    const generated = await generateMarketingContent({
      ...parsed.data,
      serviceKey: parsed.data.serviceKey as VestBlockServiceKey,
    });
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const publishPath =
      parsed.data.contentType === 'seo_page'
        ? `/resources/${generated.slug}`
        : null;

    const { data, error } = await supabase
      .from('content_assets')
      .insert({
        created_by: adminCheck.user?.id ?? null,
        title: generated.title,
        slug: generated.slug,
        content_type: parsed.data.contentType,
        service_key: parsed.data.serviceKey,
        language: parsed.data.language,
        audience: parsed.data.audience || null,
        prompt: parsed.data.prompt || null,
        status: 'draft',
        platform: parsed.data.platform,
        post_type: parsed.data.postType,
        seo_title: generated.seoTitle || null,
        meta_description: generated.metaDescription || null,
        excerpt: generated.excerpt || null,
        body_markdown: generated.bodyMarkdown,
        social_caption: generated.socialCaption || null,
        hashtags: generated.hashtags || [],
        cta_label: generated.ctaLabel || null,
        cta_url: generated.ctaUrl || null,
        publish_path: publishPath,
        metadata_json: generated.metadata || {},
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logEvent({
      eventType: 'content_generated',
      actorUserId: adminCheck.user?.id,
      entityType: 'content_asset',
      entityId: data.id,
      metadata: {
        contentType: parsed.data.contentType,
        serviceKey: parsed.data.serviceKey,
        status: 'draft',
        publishPath,
      },
    });

    return NextResponse.json({ contentAsset: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to generate content.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid content update request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nextStatus = parsed.data.status as ContentAssetStatus | undefined;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    updated_at: now,
  };

  if (nextStatus) {
    updates.status = nextStatus;
    updates.published_at = nextStatus === 'published' ? now : null;
  }
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.seoTitle !== undefined) updates.seo_title = parsed.data.seoTitle;
  if (parsed.data.metaDescription !== undefined) {
    updates.meta_description = parsed.data.metaDescription;
  }
  if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt;
  if (parsed.data.bodyMarkdown !== undefined) {
    updates.body_markdown = parsed.data.bodyMarkdown;
  }
  if (parsed.data.socialCaption !== undefined) {
    updates.social_caption = parsed.data.socialCaption;
  }
  if (parsed.data.ctaLabel !== undefined) updates.cta_label = parsed.data.ctaLabel;
  if (parsed.data.ctaUrl !== undefined) updates.cta_url = parsed.data.ctaUrl;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('content_assets')
      .update(updates)
      .eq('id', parsed.data.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logEvent({
      eventType: nextStatus === 'published' ? 'content_published' : 'admin_action',
      actorUserId: adminCheck.user?.id,
      entityType: 'content_asset',
      entityId: parsed.data.id,
      metadata: {
        status: nextStatus || data.status,
        contentType: data.content_type,
        serviceKey: data.service_key,
        publishPath: data.publish_path,
      },
    });

    return NextResponse.json({ contentAsset: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update content asset.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
