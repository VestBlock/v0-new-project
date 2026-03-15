import { appendAffiliateLenders } from './affiliates';

export type BizAnswers = {
  user_id: string;
  has_ein: boolean;
  has_bank: boolean;
  credit_score_range: 'poor' | 'fair' | 'good' | 'excellent' | 'unknown';
  monthly_revenue: number; // dollars
  business_type?: string;
  location_state?: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  category: 'vendor' | 'monitoring' | 'card' | 'lender';
  notes?: string;
  link: string;
  ein_required?: boolean;
  min_revenue?: number;
  fit_tags?: string[]; // e.g. ["any"]
};

export type Roadmap = {
  steps: {
    prerequisites: string[]; // open bank, get EIN, etc
    vendors: CatalogItem[];
    monitoring: CatalogItem[];
    cards: CatalogItem[];
    lenders: CatalogItem[];
  };
};

export function buildRoadmap(
  a: BizAnswers,
  catalog: {
    vendors: CatalogItem[];
    monitoring: CatalogItem[];
    cards: CatalogItem[];
    lenders: CatalogItem[];
  }
): Roadmap {
  const prereq: string[] = [];
  if (!a.has_ein) prereq.push('Obtain EIN (IRS)');
  if (!a.has_bank) prereq.push('Open a dedicated business bank account');

  // vendors: require EIN if item says so; no revenue gate unless specified
  const vendors = catalog.vendors
    .filter(
      (v) =>
        (!v.ein_required || a.has_ein) &&
        a.monthly_revenue >= (v.min_revenue ?? 0)
    )
    .slice(0, 3);

  // monitoring: always useful
  const monitoring = catalog.monitoring.slice(0, 2);

  // cards: simple revenue gating
  const cards = catalog.cards
    .filter((c) => a.monthly_revenue >= (c.min_revenue ?? 0))
    .slice(0, 3);

  // lenders: always listed (affiliate requirement)
  const lenders = appendAffiliateLenders(catalog.lenders.slice(0, 3));

  return {
    steps: { prerequisites: prereq, vendors, monitoring, cards, lenders },
  };
}
