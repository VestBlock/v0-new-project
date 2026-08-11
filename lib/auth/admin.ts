import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isConfiguredAdminEmail } from '@/lib/auth/admin-emails';

export type AdminCheck = {
  isAdmin: boolean;
  user: User | null;
  reason?: string;
};

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
  const trustedRole = user.app_metadata?.role;
  if (isConfiguredAdminEmail(email) || trustedRole === 'admin') {
    return { isAdmin: true, user };
  }

  return { isAdmin: false, user, reason: 'not_admin' };
}
