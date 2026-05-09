import { decodeHtmlEntities, safeUrl, stripHtml } from '@/lib/leads/utils';
import type { WebsiteWeaknessReport } from '@/lib/leads/types';

export type SitePreviewInput = {
  websiteUrl: string;
  businessName?: string;
  industry?: string;
  primaryOffer?: string;
  cityFocus?: string;
  packageType: 'ai_assistant' | 'visibility_expansion';
};

export type SitePreviewResult = {
  normalizedUrl: string | null;
  siteName: string;
  pageTitle: string;
  metaDescription: string;
  heroHeading: string;
  inferredOffer: string;
  inferredIndustry: string;
  websiteReport: WebsiteWeaknessReport;
  botPreview: {
    greeting: string;
    openingPrompt: string;
    suggestedQuestions: string[];
    qualificationSteps: string[];
  };
  growthPreview: {
    samplePageTitle: string;
    sampleSlug: string;
    sampleHeadline: string;
    sampleSections: string[];
    quickWins: string[];
  };
};

type WebsiteSnapshot = {
  normalizedUrl: string | null;
  siteName: string;
  pageTitle: string;
  metaDescription: string;
  heroHeading: string;
  textSnippet: string;
  websiteReport: WebsiteWeaknessReport;
};

const fallbackWeaknessReport: WebsiteWeaknessReport = {
  websiteExists: false,
  responseTimeMs: null,
  hasViewportMeta: false,
  hasChat: false,
  hasOnlineBooking: false,
  hasClearCta: false,
  hasTrustSignals: false,
  hasContactSignals: false,
  isLikelyOutdated: true,
  estimatedSpeed: 'unreachable',
  weakSignals: ['Website could not be reached'],
};

function extractTagContent(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return decodeHtmlEntities(match?.[1] || '');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function titleCasePhrase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hostnameLabel(urlString: string) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, '');
    const base = host.split('.')[0] || host;
    return titleCasePhrase(base.replace(/[-_]+/g, ' '));
  } catch {
    return 'Your Business';
  }
}

function inferIndustryFromText(source: string) {
  const lower = source.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\b(hvac|heating|cooling|air conditioning)\b/, 'HVAC'],
    [/\b(dentist|dental|orthodont)\b/, 'Dental'],
    [/\b(plumb|drain|sewer|water heater)\b/, 'Plumbing'],
    [/\b(roofer|roofing|roof repair)\b/, 'Roofing'],
    [/\b(attorney|law firm|lawyer|legal)\b/, 'Legal'],
    [/\b(med spa|injectables|botox|esthetic|aesthetic)\b/, 'Med Spa'],
    [/\b(chiropractic|chiropractor)\b/, 'Chiropractic'],
    [/\b(auto repair|mechanic|transmission|brake)\b/, 'Auto Repair'],
    [/\b(salon|barber|hair studio|stylist)\b/, 'Salon'],
    [/\b(remodel|renovation|kitchen|bathroom)\b/, 'Home Remodeling'],
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(lower)) return label;
  }

  return 'Service Business';
}

function inferOffer(
  snapshot: WebsiteSnapshot,
  input: SitePreviewInput
) {
  if (input.primaryOffer?.trim()) return input.primaryOffer.trim();

  const combined = [
    snapshot.heroHeading,
    snapshot.pageTitle,
    snapshot.metaDescription,
    snapshot.textSnippet,
  ]
    .filter(Boolean)
    .join(' ');

  const lower = combined.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\bemergency hvac|ac repair|air conditioning repair\b/, 'AC repair and HVAC service'],
    [/\broof replacement|roof repair|roofing\b/, 'roof repair and roof replacement'],
    [/\bteeth cleaning|cosmetic dentistry|dental implants\b/, 'general and cosmetic dentistry'],
    [/\bwater heater|drain cleaning|plumbing\b/, 'plumbing and drain service'],
    [/\bpersonal injury|family law|criminal defense\b/, 'legal consultations'],
    [/\bmed spa|injectable|facial|botox\b/, 'med spa treatments'],
    [/\bkitchen remodel|bathroom remodel|home remodeling\b/, 'home remodeling projects'],
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(lower)) return label;
  }

  return 'your main service';
}

function buildWebsiteReport(html: string, responseTimeMs: number, responseOk: boolean): WebsiteWeaknessReport {
  const lower = html.toLowerCase();
  const weakSignals: string[] = [];

  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasChat = /(intercom|drift|tawk\.to|zendesk|chat with us|live chat)/i.test(lower);
  const hasOnlineBooking = /(book now|schedule now|reserve now|appointment|online booking|calendly)/i.test(lower);
  const hasClearCta = /(call now|get quote|book now|schedule|start today|contact us|apply now|request estimate)/i.test(lower);
  const hasTrustSignals =
    /(testimonials|reviews|case stud|why choose us|google reviews|facebook reviews|before and after|licensed|insured)/i.test(
      lower
    );
  const hasContactSignals =
    /(mailto:|tel:|contact us|contact information|call us|visit us)/i.test(lower);
  const isLikelyOutdated =
    /copyright\s*(19|20)\d{2}/i.test(lower) &&
    !new RegExp(`copyright\\s*${new Date().getFullYear()}`, 'i').test(lower);

  if (!hasViewportMeta) weakSignals.push('Missing mobile viewport meta tag');
  if (!hasChat) weakSignals.push('No clear chat or live support signal');
  if (!hasOnlineBooking) weakSignals.push('No online booking or scheduling flow detected');
  if (!hasClearCta) weakSignals.push('No strong call-to-action detected above the fold');
  if (!hasTrustSignals) weakSignals.push('Trust signals or proof elements are hard to find');
  if (!hasContactSignals) weakSignals.push('Contact path is weak or unclear');
  if (isLikelyOutdated) weakSignals.push('Site appears outdated');
  if (responseTimeMs > 2500) weakSignals.push('Slow initial response time');

  const estimatedSpeed =
    responseTimeMs > 2500 ? 'slow' : responseTimeMs > 1200 ? 'moderate' : 'fast';

  return {
    websiteExists: responseOk,
    responseTimeMs,
    hasViewportMeta,
    hasChat,
    hasOnlineBooking,
    hasClearCta,
    hasTrustSignals,
    hasContactSignals,
    isLikelyOutdated,
    estimatedSpeed,
    weakSignals,
  };
}

async function fetchWebsiteSnapshot(websiteUrl: string): Promise<WebsiteSnapshot> {
  const normalized = safeUrl(websiteUrl);
  if (!normalized) {
    return {
      normalizedUrl: null,
      siteName: 'Your Business',
      pageTitle: '',
      metaDescription: '',
      heroHeading: '',
      textSnippet: '',
      websiteReport: {
        ...fallbackWeaknessReport,
        weakSignals: ['Enter a valid website URL to generate a preview'],
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const startedAt = Date.now();

  try {
    const response = await fetch(normalized, {
      headers: {
        'user-agent': 'VestBlock Product Preview/1.0 (+https://www.vestblock.io)',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const html = await response.text();
    const responseTimeMs = Date.now() - startedAt;
    const pageTitle = extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = extractTagContent(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    );
    const heroHeading =
      extractTagContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      extractTagContent(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const textSnippet = stripHtml(html).slice(0, 1400);
    const siteName = pageTitle
      ? titleCasePhrase(pageTitle.split(/[\|\-–]/)[0]?.trim() || pageTitle.trim())
      : hostnameLabel(normalized);

    return {
      normalizedUrl: normalized,
      siteName,
      pageTitle,
      metaDescription,
      heroHeading,
      textSnippet,
      websiteReport: buildWebsiteReport(html, responseTimeMs, response.ok),
    };
  } catch {
    return {
      normalizedUrl: normalized,
      siteName: hostnameLabel(normalized),
      pageTitle: '',
      metaDescription: '',
      heroHeading: '',
      textSnippet: '',
      websiteReport: fallbackWeaknessReport,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildFallbackPreview(input: SitePreviewInput, snapshot: WebsiteSnapshot): SitePreviewResult {
  const inferredIndustry =
    input.industry?.trim() ||
    inferIndustryFromText(
      [snapshot.pageTitle, snapshot.metaDescription, snapshot.heroHeading, snapshot.textSnippet]
        .filter(Boolean)
        .join(' ')
    );
  const inferredOffer = inferOffer(snapshot, input);
  const siteName = input.businessName?.trim() || snapshot.siteName;
  const cityFocus = input.cityFocus?.trim() || 'your target city';
  const slugRoot = slugify(inferredOffer || inferredIndustry || siteName) || 'service';
  const offerLabel =
    inferredOffer === 'your main service'
      ? 'your main service'
      : titleCasePhrase(inferredOffer);
  const samplePageTitle =
    inferredOffer === 'your main service'
      ? `${siteName} service page for ${titleCasePhrase(cityFocus)}`
      : `${offerLabel} in ${titleCasePhrase(cityFocus)} | ${siteName}`;
  const sampleHeadline =
    inferredOffer === 'your main service'
      ? `${siteName} for people in ${titleCasePhrase(cityFocus)} who want a clearer next step`
      : `${offerLabel} for ${titleCasePhrase(cityFocus)} customers who want a clearer next step`;

  return {
    normalizedUrl: snapshot.normalizedUrl,
    siteName,
    pageTitle: snapshot.pageTitle,
    metaDescription: snapshot.metaDescription,
    heroHeading: snapshot.heroHeading,
    inferredOffer,
    inferredIndustry,
    websiteReport: snapshot.websiteReport,
    botPreview: {
      greeting: `Thanks for contacting ${siteName}. I can answer common questions and help point visitors to the right next step.`,
      openingPrompt:
        inferredOffer === 'your main service'
          ? 'Do you want pricing, a quote, a booking, or help with a specific question?'
          : `Do you want pricing, a quote, a booking, or help with ${inferredOffer}?`,
      suggestedQuestions:
        inferredOffer === 'your main service'
          ? [
              'What do you need help with today?',
              'What city or service area are you in?',
              'Would you like a quote, a booking, or a call back?',
            ]
          : [
              `What kind of ${inferredOffer} do you need help with?`,
              'What city or service area are you in?',
              'Would you like a quote, a booking, or a call back?',
            ],
      qualificationSteps: [
        'Understand what the visitor needs help with',
        'Capture service area, timing, and urgency',
        'Guide them toward a quote, booking, or human follow-up',
      ],
    },
    growthPreview: {
      samplePageTitle,
      sampleSlug: `/${slugify(cityFocus)}/${slugRoot}`,
      sampleHeadline,
      sampleSections: [
        `What visitors want to know before they contact ${siteName}`,
        `How ${siteName} helps people in ${titleCasePhrase(cityFocus)}`,
        'Questions, proof, and next-step content that can improve trust and conversion',
      ],
      quickWins: snapshot.websiteReport.weakSignals.slice(0, 3).length
        ? snapshot.websiteReport.weakSignals.slice(0, 3)
        : [
            'Add a stronger above-the-fold call to action',
            'Give visitors a clearer booking or quote path',
            'Add proof and trust signals near the main CTA',
          ],
    },
  };
}

export async function generateSitePreview(input: SitePreviewInput): Promise<SitePreviewResult> {
  const snapshot = await fetchWebsiteSnapshot(input.websiteUrl);
  return buildFallbackPreview(input, snapshot);
}
