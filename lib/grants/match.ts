export type Answers = {
  state: string;
  business_status: string;
  industry: string;
  revenue_range: string; // "<50k" | "50k-100k" | ...
  founder_attributes: string[]; // ["women","minority","veteran","disability"]
  has_ein: boolean;
  business_name?: string;
  user_id?: string;
};

export type GrantSource = {
  id: string;
  name: string;
  sponsor: string;
  scope: 'national' | 'international' | string;
  states?: string[]; // ["ALL"] or list of states
  summary: string;
  award_low_usd?: number | null;
  award_high_usd?: number | null;
  application_cycle?: string | null;
  industry_focus?: string[]; // ["all"] or specific tags
  founder_focus?: string[]; // e.g. ["women"] | ["black","latinx"] | ["none"]
  ein_required?: boolean | null;
  revenue_cap_note?: string | null;
  link: string;
  notes?: string | null;
};

export type Grant = {
  id: string;
  name: string;
  description: string;
  link: string;
  states: string[]; // ["ALL"] -> nationwide
  industries: string[]; // canonicalized
  tags: string[]; // ['women','minority','veteran','disability'] etc.
  requires_ein: boolean;
  typical_award?: string; // "$10,000–$25,000"
  cycle?: string;
  active?: boolean;
};

export type GrantCard = {
  name: string;
  description: string;
  typical_award?: string;
  why_fit?: string;
  link: string;
};

/* ---------- helpers ---------- */

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

function buildTypicalAward(lo?: number | null, hi?: number | null) {
  if (lo && hi && lo !== hi) return `${usd(lo)}–${usd(hi)}`;
  if (lo && hi && lo === hi) return usd(lo);
  if (lo) return `up to ${usd(lo)}`;
  if (hi) return `up to ${usd(hi)}`;
  return undefined;
}

function canonIndustry(token: string): string {
  const t = token.toLowerCase();
  if (['all', '*'].includes(t)) return 'all';
  if (
    [
      'tech',
      'technology',
      'science',
      'engineering',
      'deeptech',
      'ai',
      'science_tech',
    ].includes(t)
  )
    return 'technology';
  if (['health', 'healthcare', 'medical'].includes(t)) return 'health';
  if (['jewelry'].includes(t)) return 'jewelry';
  if (['consumer', 'consumer_goods', 'retail', 'ecommerce'].includes(t))
    return 'retail';
  if (['food', 'restaurant'].includes(t)) return 'food';
  if (['media', 'creative', 'arts', 'design'].includes(t)) return 'creative';
  if (['manufacturing'].includes(t)) return 'manufacturing';
  if (['services', 'service'].includes(t)) return 'services';
  return t;
}

function normalizeTags(focus?: string[]): string[] {
  const set = new Set<string>();
  (focus || []).forEach((raw) => {
    const t = raw.toLowerCase();
    if (t === 'women' || t === 'woman' || t === 'woman-owned') set.add('women');
    if (t === 'black' || t === 'latinx' || t === 'minority')
      set.add('minority');
    if (t === 'veteran' || t === 'veteran-owned') set.add('veteran');
    if (t === 'disability' || t === 'disability-owned') set.add('disability');
  });
  return [...set];
}

export function normalizeGrant(src: GrantSource): Grant {
  const industries = (
    src.industry_focus?.length ? src.industry_focus : ['all']
  ).map(canonIndustry);
  const typical = buildTypicalAward(
    src.award_low_usd ?? undefined,
    src.award_high_usd ?? undefined
  );

  return {
    id: src.id,
    name: src.name,
    description: src.summary, // <- map summary -> description
    link: src.link,
    states: src.states?.length ? src.states : ['ALL'],
    industries,
    tags: normalizeTags(src.founder_focus),
    requires_ein: Boolean(src.ein_required),
    typical_award: typical,
    cycle: src.application_cycle || undefined,
    active: true,
  };
}

export function normalizeAll(list: GrantSource[]): Grant[] {
  return (list || []).map(normalizeGrant);
}

/* ---------- matching / scoring ---------- */

function intersects<T>(a?: T[], b?: T[]) {
  if (!a?.length || !b?.length) return true; // treat empty as wildcard
  const set = new Set(a);
  return b.some((x) => set.has(x));
}

export function scoreGrant(g: Grant, a: Answers) {
  if (g.requires_ein && !a.has_ein) return -999; // hard exclude

  let score = 0;
  // state
  if (
    !g.states.length ||
    g.states.includes('ALL') ||
    g.states.includes(a.state)
  )
    score += 4;

  // industry (handle 'all')
  const industry = canonIndustry(a.industry);
  if (g.industries.includes('all') || g.industries.includes(industry))
    score += 3;

  // founder attributes (map "minority" to our normalized tag)
  const founderHits = (a.founder_attributes || []).filter((t) =>
    g.tags.includes(t)
  ).length;
  score += Math.min(founderHits, 3);

  // helpful bump if EIN present (even if not required)
  if (a.has_ein) score += 1;

  return score;
}

export function shortlist(grants: Grant[], a: Answers, n = 5): Grant[] {
  return grants
    .map((g) => ({ g, s: scoreGrant(g, a) }))
    .filter((x) => x.s > -999)
    .sort((x, y) => y.s - x.s)
    .slice(0, n)
    .map((x) => x.g);
}

export function toCards(gs: Grant[], a: Answers): GrantCard[] {
  return gs.map((g) => {
    const why: string[] = [];
    if (g.states.includes('ALL')) why.push('Nationwide');
    else if (g.states.includes(a.state)) why.push(`Available in ${a.state}`);

    const industry = canonIndustry(a.industry);
    if (g.industries.includes(industry) && industry !== 'all')
      why.push(`Fits ${industry}`);

    const matchedTag = (a.founder_attributes || []).find((t) =>
      g.tags.includes(t)
    );
    if (matchedTag) {
      const label =
        matchedTag === 'women'
          ? 'Women-owned focus'
          : matchedTag === 'minority'
          ? 'Minority-owned focus'
          : matchedTag === 'veteran'
          ? 'Veteran-owned focus'
          : matchedTag === 'disability'
          ? 'Disability-owned focus'
          : '';
      if (label) why.push(label);
    }

    return {
      name: g.name,
      description: g.description,
      typical_award: g.typical_award,
      why_fit: why.filter(Boolean).join(' • '),
      link: g.link,
    };
  });
}

// crude dollar-range parser
export function revenueToNumberRange(r: string): [number, number] {
  if (r === '<50k') return [0, 50_000];
  if (r === '50k-100k') return [50_000, 100_000];
  if (r === '100k-250k') return [100_000, 250_000];
  if (r === '250k-500k') return [250_000, 500_000];
  return [500_000, Number.MAX_SAFE_INTEGER];
}
