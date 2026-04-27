import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export type AdminCheck = {
  isAdmin: boolean;
  user: User | null;
  reason?: string;
};

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function getServerUser() {
  const cookieStorePromise = cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      async get(name: string) {
        const cookieStore = await cookieStorePromise;
        return cookieStore.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components can read cookies but cannot always write them.
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Server Components can read cookies but cannot always write them.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function checkAdminAccess(): Promise<AdminCheck> {
  const user = await getServerUser();

  if (!user) {
    return { isAdmin: false, user: null, reason: 'not_authenticated' };
  }

  const email = user.email?.toLowerCase();
  if (email && configuredAdminEmails().includes(email)) {
    return { isAdmin: true, user };
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id,user_id,email,role')
      .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return { isAdmin: true, user };
    }
  } catch (error) {
    console.error('[admin-rbac] Unable to verify profile role:', error);
  }

  return { isAdmin: false, user, reason: 'not_admin' };
}
