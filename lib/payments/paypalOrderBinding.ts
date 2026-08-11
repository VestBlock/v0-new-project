import {
  getVestBlockProduct,
  isVestBlockProductType,
  type VestBlockProduct,
  type VestBlockProductType,
} from './products';

export type PaypalOrderBinding = {
  version: 'vb2';
  productType: VestBlockProductType;
  userId: string;
  requestId: string | null;
};

type PaypalAmount = { currency_code?: unknown; value?: unknown };
type PaypalPurchaseUnit = {
  custom_id?: unknown;
  amount?: PaypalAmount;
  payments?: {
    captures?: Array<{ id?: unknown; status?: unknown; amount?: PaypalAmount }>;
  };
};

type PaypalOrder = {
  id?: unknown;
  status?: unknown;
  purchase_units?: PaypalPurchaseUnit[];
};

function amountInCents(value: unknown) {
  const amount = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function buildPaypalCustomId(input: Omit<PaypalOrderBinding, 'version'>) {
  return ['vb2', input.productType, input.userId, input.requestId || 'none'].join('|');
}

export function parsePaypalCustomId(value: unknown): PaypalOrderBinding | null {
  if (typeof value !== 'string') return null;
  const [version, productType, userId, requestId, ...extra] = value.split('|');
  if (
    version !== 'vb2' ||
    extra.length > 0 ||
    !isVestBlockProductType(productType) ||
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    (requestId !== 'none' && !/^[0-9a-f-]{36}$/i.test(requestId))
  ) {
    return null;
  }

  return {
    version,
    productType,
    userId,
    requestId: requestId === 'none' ? null : requestId,
  };
}

export function verifyPaypalOrderBinding(
  order: PaypalOrder,
  authenticatedUserId: string
): { binding: PaypalOrderBinding; product: VestBlockProduct } {
  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  if (units.length !== 1) throw new Error('PayPal order must contain exactly one purchase unit.');

  const unit = units[0];
  const binding = parsePaypalCustomId(unit.custom_id);
  if (!binding) throw new Error('PayPal order is missing a valid VestBlock binding.');
  if (binding.userId !== authenticatedUserId) throw new Error('PayPal order belongs to a different account.');

  const product = getVestBlockProduct(binding.productType);
  if (unit.amount?.currency_code !== 'USD') throw new Error('PayPal order currency does not match VestBlock checkout.');
  if (amountInCents(unit.amount?.value) !== amountInCents(product.amount)) {
    throw new Error('PayPal order amount does not match the bound VestBlock product.');
  }
  if (product.type === 'funding_strategy_review' && !binding.requestId) {
    throw new Error('Funding review checkout is missing its request binding.');
  }
  if (product.type === 'vestblock_pro' && binding.requestId) {
    throw new Error('Credit tools checkout contains an unexpected request binding.');
  }

  return { binding, product };
}

export function verifyPaypalCapture(
  captureOrder: PaypalOrder,
  product: VestBlockProduct
) {
  const capture = captureOrder.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== 'COMPLETED') {
    throw new Error(`PayPal capture status was ${String(capture?.status || 'unknown')}.`);
  }
  if (capture.amount?.currency_code !== 'USD') {
    throw new Error('PayPal capture currency does not match VestBlock checkout.');
  }
  if (amountInCents(capture.amount?.value) !== amountInCents(product.amount)) {
    throw new Error('PayPal capture amount does not match the bound VestBlock product.');
  }

  return {
    amount: String(capture.amount.value),
    transactionId: typeof capture.id === 'string' ? capture.id : null,
  };
}
