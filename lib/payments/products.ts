export const vestBlockProductTypes = [
  'vestblock_pro',
  'funding_strategy_review',
] as const;

export type VestBlockProductType = (typeof vestBlockProductTypes)[number];

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
    label: 'Credit Review Tools Access',
    amount: '75',
    defaultReturnPath: '/credit-upload',
    description: 'Optional access to VestBlock credit review and dispute-letter tools.',
  },
  funding_strategy_review: {
    type: 'funding_strategy_review',
    label: 'Business Funding Prep Plan',
    amount: '300',
    defaultReturnPath: '/funding/business-funding-strategy',
    description:
      'One-time prep plan for business funding eligibility, credit cleanup, and application preparation.',
  },
};

export function isVestBlockProductType(type?: string | null): type is VestBlockProductType {
  return Boolean(type && type in vestblockProducts);
}

export function getVestBlockProduct(type: VestBlockProductType) {
  return vestblockProducts[type];
}

export function getDefaultVestBlockProduct() {
  return vestblockProducts.vestblock_pro;
}

export function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
}
