import type { CatalogItem } from './match';

export const AFFILIATE_LENDERS: CatalogItem[] = [
  {
    id: 'affiliate-funding-playbook',
    name: 'The Funding Playbook',
    category: 'lender',
    notes: 'Full-service funding concierge with expert underwriting support.',
    link: 'https://thefundingplaybook.com/homepage?am_id=VestBlock',
  },
  {
    id: 'affiliate-opm-mastery',
    name: 'OPM Mastery Network',
    category: 'lender',
    notes: 'Lending network tailored for founders with 700+ personal credit scores.',
    link: 'https://opmmastery.referralrock.com/l/ROBERTSAND60/referral',
  },
  {
    id: 'affiliate-bigger-funding',
    name: 'Bigger Funding',
    category: 'lender',
    notes: 'Apply for larger business capital programs via David Allen Capital.',
    link: 'https://davidallencapital.com/business-capital/vestblock',
  },
  {
    id: 'affiliate-micro-funding',
    name: 'Micro-Funding',
    category: 'lender',
    notes: 'Flexible micro-funding options for gig workers and small businesses.',
    link: 'https://davidallencapital.com/gigfunding/vestblock',
  },
  {
    id: 'affiliate-line-of-credit',
    name: 'Line of Credit',
    category: 'lender',
    notes: 'Revolving credit lines with quick access to working capital.',
    link: 'https://davidallencapital.com/line-of-credit/vestblock',
  },
];

export function appendAffiliateLenders(
  lenders: CatalogItem[],
  exclude?: Set<string>
): CatalogItem[] {
  const seen = new Set(lenders.map((l) => l.id));
  const filteredExtras = AFFILIATE_LENDERS.filter((partner) => {
    if (seen.has(partner.id)) return false;
    if (exclude?.has(partner.id)) return false;
    return true;
  });
  return [...lenders, ...filteredExtras];
}
