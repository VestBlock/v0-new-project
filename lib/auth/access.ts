import { isConfiguredAdminUserEmail } from '@/lib/auth/client-admin';

export type AccessTier = 'admin' | 'paid' | 'free' | 'guest';

export type AccessProfileInput = {
  email?: string | null;
  role?: string | null;
  is_subscribed?: boolean | string | number | null;
  paypal_order_product?: string | null;
};

export type AccessProfile = {
  isAdmin: boolean;
  isSubscribed: boolean;
  hasPaidAccess: boolean;
  accessTier: AccessTier;
  subscriptionProduct: string | null;
};

export function normalizeBooleanish(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'paid', 'active'].includes(normalized);
  }
  return false;
}

export function getAccessProfile(input?: AccessProfileInput | null): AccessProfile {
  const isAdmin = Boolean(
    input && (input.role === 'admin' || isConfiguredAdminUserEmail(input.email)),
  );
  const isSubscribed = normalizeBooleanish(input?.is_subscribed);
  const hasPaidAccess = isAdmin || isSubscribed;

  return {
    isAdmin,
    isSubscribed,
    hasPaidAccess,
    accessTier: isAdmin ? 'admin' : hasPaidAccess ? 'paid' : input ? 'free' : 'guest',
    subscriptionProduct: input?.paypal_order_product || null,
  };
}
