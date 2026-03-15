import OpenAI from 'openai';
import type { BizAnswers, CatalogItem, Roadmap } from '@/lib/bizcredit/match';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type ModelOut = {
  steps: {
    vendors: { id: string; notes: string }[];
    monitoring: { id: string; notes: string }[];
    cards: { id: string; notes: string }[];
    lenders: { id: string; notes: string }[];
  };
};

/**
 * Rewrites the "notes" field for each item using GPT, tailored to the user's answers.
 * Returns a full Roadmap['steps'] object so you can merge or replace cleanly.
 *
 * Usage:
 *   const rewritten = await rewriteReasonsJSON(answers, roadmap);
 *   roadmap = { steps: { ...roadmap.steps, ...rewritten } };
 */
export async function rewriteReasonsJSON(
  answers: BizAnswers,
  roadmap: Roadmap
): Promise<Roadmap['steps']> {
  const profile = {
    has_ein: answers.has_ein,
    has_bank: answers.has_bank,
    credit_score_range: answers.credit_score_range,
    monthly_revenue: answers.monthly_revenue,
    business_type: answers.business_type ?? 'n/a',
    location_state: answers.location_state ?? 'n/a',
  };

  // Send a minimal, clean snapshot of current items to the model
  const items = {
    vendors: roadmap.steps.vendors.map(slim),
    monitoring: roadmap.steps.monitoring.map(slim),
    cards: roadmap.steps.cards.map(slim),
    lenders: roadmap.steps.lenders.map(slim),
  };

  const system = [
    'You rewrite SHORT (1–2 sentences) practical NOTES for each business-credit item.',
    "Be specific to EIN/bank status, revenue fit, and 'starter' suitability.",
    'Return STRICT JSON ONLY with shape:',
    `{ "steps": { "vendors":[{"id":"...","notes":"..."}], "monitoring":[...], "cards":[...], "lenders":[...] } }`,
    'No prose, no markdown.',
  ].join(' ');

  const user = JSON.stringify({
    profile,
    items,
    variation: String(Date.now()), // encourage different phrasings on regenerate
  });

  try {
    // IMPORTANT: Chat Completions JSON mode, not the Responses API.
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const text = chat.choices[0]?.message?.content ?? '{}';
    const parsed: ModelOut = safeParseJSON<ModelOut>(text, {
      steps: { vendors: [], monitoring: [], cards: [], lenders: [] },
    });

    // Build new steps while preserving required fields & avoiding nulls
    return {
      prerequisites: [...roadmap.steps.prerequisites],
      vendors: applyNotes(roadmap.steps.vendors, parsed.steps.vendors),
      monitoring: applyNotes(roadmap.steps.monitoring, parsed.steps.monitoring),
      cards: applyNotes(roadmap.steps.cards, parsed.steps.cards),
      lenders: applyNotes(roadmap.steps.lenders, parsed.steps.lenders),
    };
  } catch (err) {
    console.error('rewriteReasonsJSON() failed, using fallback notes:', err);
    // Fallback: keep original notes or synthesize brief defaults
    return {
      prerequisites: [...roadmap.steps.prerequisites],
      vendors: fallbackNotes(roadmap.steps.vendors, profile),
      monitoring: fallbackNotes(roadmap.steps.monitoring, profile),
      cards: fallbackNotes(roadmap.steps.cards, profile),
      lenders: fallbackNotes(roadmap.steps.lenders, profile),
    };
  }
}

/* ---------------- helpers ---------------- */

function slim(i: CatalogItem) {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    link: i.link, // required string in your type
    notes: i.notes ?? '', // never send null to model
    min_revenue: i.min_revenue ?? 0,
    ein_required: !!i.ein_required,
  };
}

function safeParseJSON<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function applyNotes(
  items: CatalogItem[],
  updates: { id: string; notes: string }[]
): CatalogItem[] {
  const byId = new Map(updates.map((u) => [u.id, sanitize(u.notes)]));
  return items.map((it) => ({
    ...it,
    // keep link as-is (string), update notes if provided (no nulls)
    notes: byId.get(it.id) ?? it.notes ?? undefined,
  }));
}

function fallbackNotes(
  items: CatalogItem[],
  p: Pick<BizAnswers, 'has_ein' | 'has_bank' | 'monthly_revenue'>
): CatalogItem[] {
  return items.map((it) => ({
    ...it,
    notes:
      it.notes ??
      [
        'Solid starter option.',
        p.has_ein ? 'Works with EIN in place.' : 'Usable while EIN is pending.',
        p.has_bank
          ? 'Pairs well with a dedicated business bank account.'
          : 'Okay before bank account is opened.',
        typeof it.min_revenue === 'number' && it.min_revenue > 0
          ? `Typical minimum revenue ≈ $${it.min_revenue.toLocaleString()}/mo.`
          : undefined,
      ]
        .filter(Boolean)
        .join(' '),
  }));
}

function sanitize(s: string): string {
  // Ensure we never introduce nulls; return trimmed string or undefined via caller
  return String(s || '').trim();
}
