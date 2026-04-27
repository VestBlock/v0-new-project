import { createChatCompletion } from '@/lib/openai-service';
import {
  getVestBlockMarketingService,
  vestblockMarketingServices,
  type VestBlockServiceKey,
} from '@/lib/content/marketingServices';

export type ContentAssetType = 'seo_page' | 'social_post' | 'campaign';
export type ContentAssetStatus = 'draft' | 'ready' | 'published' | 'archived';

export type ContentGenerationInput = {
  contentType: ContentAssetType;
  serviceKey: VestBlockServiceKey;
  prompt?: string;
  audience?: string;
  language?: 'en' | 'es';
  platform?: string;
  postType?: string;
};

export type GeneratedContentAsset = {
  title: string;
  slug: string;
  seoTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  bodyMarkdown: string;
  socialCaption?: string;
  hashtags?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  metadata?: Record<string, unknown>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function uniqueSlug(base: string) {
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

function serviceListForPrompt() {
  return vestblockMarketingServices
    .map(
      (service) =>
        `- ${service.key}: ${service.label} -> ${service.offerPath}; ${service.valuePromise}`
    )
    .join('\n');
}

function safeJsonParse(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function normalizeHashtags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function generateMarketingContent(
  input: ContentGenerationInput
): Promise<GeneratedContentAsset> {
  const service = getVestBlockMarketingService(input.serviceKey);
  const language = input.language || 'en';
  const audience = input.audience || service.audience;
  const postType = input.postType || 'educational';
  const platform = input.platform || 'manual';

  const system = `You are VestBlock's content operations assistant.
Create practical, customer-facing marketing content for an AI-powered credit repair, business funding, grants, and financial opportunity platform.

Compliance rules:
- Do not guarantee credit score increases, deletions, loan approvals, funding, grant awards, or payment terms.
- Do not claim VestBlock provides legal, tax, or underwriting advice.
- Keep credit repair framed around accuracy, documentation, user review, and dispute rights.
- Keep business funding and grants framed around readiness, eligibility, documentation, and fit.
- Avoid hype, fake testimonials, fake timelines, and spammy SEO filler.
- For Spanish, write natural Spanish for business owners and keep the same compliance standard.

Available VestBlock services:
${serviceListForPrompt()}

Return ONLY valid JSON with these keys:
title, slug, seoTitle, metaDescription, excerpt, bodyMarkdown, socialCaption, hashtags, ctaLabel, ctaUrl, metadata.
bodyMarkdown must be ready for manual publishing.`;

  const user = `Create one ${input.contentType} content asset.

Service: ${service.label}
Service key: ${service.key}
Offer path: ${service.offerPath}
Audience: ${audience}
Language: ${language}
Platform: ${platform}
Post type: ${postType}
User request: ${input.prompt || 'Create a useful, conversion-aware content draft.'}

Service value promise:
${service.valuePromise}

Proof points:
${service.proofPoints.map((point) => `- ${point}`).join('\n')}

Service-specific compliance notes:
${service.complianceNotes.map((note) => `- ${note}`).join('\n')}

Content requirements:
- If content_type is seo_page: include an H1, short intro, sections, bullet checklist, FAQ, and a clear CTA back to ${service.offerPath}.
- If content_type is social_post: include one polished caption, a short hook, 3-7 hashtags, and a CTA.
- If content_type is campaign: include a campaign theme, 5 post ideas, 2 email ideas, and a landing-page CTA.
- Keep it specific to VestBlock and the selected service.
- Do not include markdown code fences.`;

  const completion = await createChatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    false,
    {
      model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o',
      temperature: 0.65,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
      timeout: 55000,
    }
  );

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse(raw);
  const title = String(parsed.title || `${service.label} Content Draft`).trim();

  return {
    title,
    slug: uniqueSlug(String(parsed.slug || title || service.label)),
    seoTitle: parsed.seoTitle ? String(parsed.seoTitle).trim() : title,
    metaDescription: parsed.metaDescription
      ? String(parsed.metaDescription).trim().slice(0, 170)
      : undefined,
    excerpt: parsed.excerpt ? String(parsed.excerpt).trim() : undefined,
    bodyMarkdown: String(parsed.bodyMarkdown || parsed.socialCaption || '').trim(),
    socialCaption: parsed.socialCaption ? String(parsed.socialCaption).trim() : undefined,
    hashtags: normalizeHashtags(parsed.hashtags),
    ctaLabel: parsed.ctaLabel ? String(parsed.ctaLabel).trim() : 'Start with VestBlock',
    ctaUrl: parsed.ctaUrl ? String(parsed.ctaUrl).trim() : service.offerPath,
    metadata: {
      ...(parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {}),
      generatedBy: 'openai',
      serviceLabel: service.label,
      platform,
      postType,
      language,
    },
  };
}
