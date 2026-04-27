export type VestBlockProductType = 'vestblock_pro' | 'funding_strategy_review';

export type VestBlockProduct = {
  type: VestBlockProductType;
  label: string;
  amount: string;
  defaultReturnPath: string;
  description: string;
};

export const vestblockProducts: Record<VestBlockProductType, VestBlockProduct> = {
  vestblock_pro: {
    type: 'vestblock_pro',
    label: 'VestBlock Pro',
    amount: '75',
    defaultReturnPath: '/credit-upload',
    description: 'Lifetime access to VestBlock Pro tools.',
  },
  funding_strategy_review: {
    type: 'funding_strategy_review',
    label: 'Business Funding Readiness Plan',
    amount: '300',
    defaultReturnPath: '/funding/credit-card-strategy',
    description:
      'One-time readiness plan for business funding eligibility, credit cleanup, and application preparation.',
  },
};

export function getVestBlockProduct(type?: string | null) {
  if (type && type in vestblockProducts) {
    return vestblockProducts[type as VestBlockProductType];
  }

  return vestblockProducts.vestblock_pro;
}

export function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
}
