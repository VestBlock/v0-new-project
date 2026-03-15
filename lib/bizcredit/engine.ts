import { appendAffiliateLenders } from './affiliates';
import { BizAnswers, CatalogItem, Roadmap } from './match';

// helpers
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded<T>(arr: T[], seed: number) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildRoadmap(
  a: BizAnswers,
  catalog: {
    vendors: CatalogItem[];
    monitoring: CatalogItem[];
    cards: CatalogItem[];
    lenders: CatalogItem[];
  },
  opts?: { excludeIds?: string[]; seed?: number }
): Roadmap {
  const ex = new Set(opts?.excludeIds ?? []);
  const seed = opts?.seed ?? Date.now();

  const prereq: string[] = [];
  if (!a.has_ein) prereq.push('Obtain EIN (IRS)');
  if (!a.has_bank) prereq.push('Open a dedicated business bank account');

  const vendorsCand = catalog.vendors.filter(
    (v) =>
      (!v.ein_required || a.has_ein) &&
      a.monthly_revenue >= (v.min_revenue ?? 0) &&
      !ex.has(v.id)
  );
  const vendors = shuffleSeeded(vendorsCand, seed + 11).slice(0, 3);

  const monitoringCand = catalog.monitoring.filter((m) => !ex.has(m.id));
  const monitoring = shuffleSeeded(monitoringCand, seed + 22).slice(0, 2);

  const cardsCand = catalog.cards.filter(
    (c) => a.monthly_revenue >= (c.min_revenue ?? 0) && !ex.has(c.id)
  );
  const cards = shuffleSeeded(cardsCand, seed + 33).slice(0, 3);

  const lendersCand = catalog.lenders.filter((l) => !ex.has(l.id));
  const lenders = appendAffiliateLenders(
    shuffleSeeded(lendersCand, seed + 44).slice(0, 3),
    ex
  );

  return {
    steps: { prerequisites: prereq, vendors, monitoring, cards, lenders },
  };
}
