import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAccessProfile, type AccessProfile } from '@/lib/auth/access';
import { getServerUser } from '@/lib/auth/admin';

export type ServerAccessContext = {
  userId: string;
  email?: string | null;
  profile: {
    role?: string | null;
    is_subscribed?: boolean | string | number | null;
    paypal_order_product?: string | null;
  } | null;
  access: AccessProfile;
};

export async function getServerAccessContext() : Promise<ServerAccessContext | null> {
  const user = await getServerUser();
  if (!user) return null;

  let profile: ServerAccessContext['profile'] = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('user_profiles')
      .select('role,is_subscribed,paypal_order_product')
      .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    profile = data || null;
  } catch (error) {
    console.error('[access-server] profile lookup failed:', error);
  }

  return {
    userId: user.id,
    email: user.email,
    profile,
    access: getAccessProfile({
      email: user.email,
      role: profile?.role ?? null,
      is_subscribed: profile?.is_subscribed ?? null,
      paypal_order_product: profile?.paypal_order_product ?? null,
    }),
  };
}

export async function requirePaidToolAccess(redirectPath: string) {
  const context = await getServerAccessContext();
  if (!context) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (!context.access.hasPaidAccess) {
    redirect('/credit-upload');
  }

  return context;
}
